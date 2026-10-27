import { createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { loadRecoveryPlan, recoverySourceConstants } from "../schema-replay/sources.mjs";

const DEFAULT_PORTS = Object.freeze({ api: 54121, db: 54122, shadow: 54120, studio: 54123 });
const hash = (content) => createHash("sha256").update(content).digest("hex");

function ensureChild(parent, child, label) {
  const rel = relative(parent, child);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${label} must remain within its private Git workspace`);
  }
}

function validatePorts(input = {}) {
  const ports = { ...DEFAULT_PORTS, ...input };
  for (const [name, port] of Object.entries(ports)) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new Error(`Unsafe local ${name} port: ${port}`);
    }
  }
  if (new Set(Object.values(ports)).size !== Object.keys(ports).length) {
    throw new Error("Local Supabase ports must be unique");
  }
  return ports;
}

function validateSiteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Test site URL must be a valid local loopback URL");
  }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password) {
    throw new Error("Test site URL must use plain HTTP on the 127.0.0.1 loopback interface");
  }
  return url.origin;
}

function buildConfig(projectId, ports, siteUrl) {
  return `project_id = "${projectId}"

[api]
enabled = true
port = ${ports.api}
schemas = ["public", "storage", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = ${ports.db}
shadow_port = ${ports.shadow}
major_version = 17

[db.seed]
enabled = false

[studio]
enabled = true
port = ${ports.studio}
api_url = "http://127.0.0.1:${ports.api}"

[local_smtp]
enabled = false

[analytics]
enabled = false

[auth]
enabled = true
site_url = "${siteUrl}"
additional_redirect_urls = ["${siteUrl}"]

[edge_runtime]
enabled = true
policy = "per_worker"
`;
}

export async function prepareLocalWorkspace({
  repoRoot,
  ports: requestedPorts = {},
  siteUrl: requestedSiteUrl = "http://127.0.0.1:4174",
} = {}) {
  if (!repoRoot) throw new Error("repoRoot is required");
  const root = resolve(repoRoot);
  const ports = validatePorts(requestedPorts);
  const siteUrl = validateSiteUrl(requestedSiteUrl);
  const gitDir = join(root, ".git");
  const gitStat = await lstat(gitDir);
  if (!gitStat.isDirectory() || gitStat.isSymbolicLink()) {
    throw new Error("A private, non-linked Git directory is required for the local workspace");
  }

  const base = join(gitDir, "codex-recovery-e2e");
  await mkdir(base, { recursive: true, mode: 0o700 });
  const baseStat = await lstat(base);
  if (!baseStat.isDirectory() || baseStat.isSymbolicLink()) {
    throw new Error("The local recovery base must not be a symbolic link");
  }
  const resolvedGit = await realpath(gitDir);
  const resolvedBase = await realpath(base);
  ensureChild(resolvedGit, resolvedBase, "Recovery base");

  const workspaceRoot = await mkdtemp(join(resolvedBase, "recovery-"));
  const resolvedWorkspace = await realpath(workspaceRoot);
  ensureChild(resolvedBase, resolvedWorkspace, "Recovery workspace");
  const projectId = `codex-recovery-${randomBytes(8).toString("hex")}`;
  const supabaseDir = join(resolvedWorkspace, "supabase");
  await mkdir(supabaseDir, { recursive: true, mode: 0o700 });

  const plan = await loadRecoveryPlan(root, {
    mode: "recovered",
    includePlatformAdapter: false,
  });
  const bundle = plan.map((entry) => entry.sql).join("\n\n");
  const config = buildConfig(projectId, ports, siteUrl);
  const bundlePath = join(resolvedWorkspace, "recovered-baseline.sql");
  const configPath = join(supabaseDir, "config.toml");
  const manifestPath = join(resolvedWorkspace, "manifest.json");
  const manifest = {
    formatVersion: 1,
    marker: "codex-recovery-e2e",
    localOnly: true,
    projectId,
    ports,
    siteUrl,
    excludedSources: [recoverySourceConstants.platformAdapter],
    entries: plan.map(({ sql, ...entry }) => entry),
    bundle: { path: "recovered-baseline.sql", sha256: hash(bundle) },
    config: { path: "supabase/config.toml", sha256: hash(config) },
  };
  await writeFile(bundlePath, bundle, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await writeFile(configPath, config, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  return {
    workspaceRoot: resolvedWorkspace,
    projectId,
    ports,
    manifestPath,
    bundlePath,
    configPath,
    manifest,
  };
}
