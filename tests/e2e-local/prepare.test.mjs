import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceModule = new URL("../../scripts/schema-replay/sources.mjs", import.meta.url);
const prepareModule = new URL("../../scripts/e2e-local/prepare.mjs", import.meta.url);
const hash = (content) => createHash("sha256").update(content).digest("hex");
const adapterPath = "tests/schema-replay/supabase-adapter.sql";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "recovery-prepare-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, ".git"));
  for (const path of [
    "docs/supabase-schema-proposta.sql",
    "docs/proposta-padronizacao-campos-operacionais.sql",
    "docs/proposta-rls-representacoes-sigilosas.sql",
    "docs/proposta-profiles-telefone.sql",
    "docs/auditoria-avatar-rpc-proposta.sql",
    "supabase/2026-05-03_inqueritos_add_missing_columns.sql",
    "supabase/migrations",
    "tests/schema-replay/supabase-adapter.sql",
    "tests/schema-replay/catalog-prelude.sql",
    "tests/schema-replay/platform-grants.sql",
    "scripts/schema-replay/sources.mjs",
    "scripts/e2e-local/prepare.mjs",
  ]) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await cp(join(repoRoot, path), target, { recursive: true });
  }
  return root;
}

async function filesUnder(root) {
  const paths = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) paths.push(...(await filesUnder(path)));
    else paths.push(path);
  }
  return paths;
}

test("recovery plan preserves the independently recorded replay order and hashes", async () => {
  const { loadRecoveryPlan } = await import(sourceModule);
  const plan = await loadRecoveryPlan(repoRoot, {
    mode: "recovered",
    includePlatformAdapter: true,
  });
  const recorded = JSON.parse(
    await readFile(join(repoRoot, "tests/schema-replay/results/recovered.json"), "utf8"),
  );
  assert.deepEqual(
    plan.map(({ sql, ...entry }) => entry),
    recorded.applied,
  );
  for (const entry of plan) {
    assert.equal(hash(entry.sql), entry.sha256);
    const source = await readFile(join(repoRoot, entry.path), "utf8");
    if (entry.section) {
      assert.equal(hash(source), entry.sourceSha256);
      assert.ok(source.includes(entry.sql), `Unchanged source section: ${entry.path}`);
    } else {
      assert.equal(entry.sql, source);
    }
  }
});

test("real Supabase plan excludes only the platform adapter, including its hashes", async () => {
  const { loadRecoveryPlan } = await import(sourceModule);
  const withAdapter = await loadRecoveryPlan(repoRoot, {
    mode: "recovered",
    includePlatformAdapter: true,
  });
  const realSupabase = await loadRecoveryPlan(repoRoot, {
    mode: "recovered",
    includePlatformAdapter: false,
  });
  assert.deepEqual(
    realSupabase,
    withAdapter.filter((entry) => entry.path !== adapterPath),
  );
  assert.equal(realSupabase.filter((entry) => entry.phase === "migration").length, 122);
  const gap = realSupabase.findIndex((entry) => entry.phase === "documentary-gap");
  assert.equal(
    realSupabase[gap + 1].path,
    "supabase/migrations/20261024123000_harden_privileged_rpcs.sql",
  );
  const legacy = await loadRecoveryPlan(repoRoot, { mode: "legacy" });
  assert.equal(
    legacy.some((entry) => entry.phase === "documentary-gap"),
    false,
  );
  const bare = await loadRecoveryPlan(repoRoot, { mode: "bare" });
  assert.ok(bare.every((entry) => entry.phase === "migration"));
  await assert.rejects(loadRecoveryPlan(repoRoot, { mode: "unknown" }), /mode/i);
});

test("source extraction fails closed when documentary boundaries are ambiguous", async (t) => {
  const { loadRecoveryPlan } = await import(sourceModule);
  const root = await fixture(t);
  const path = join(root, "docs/supabase-schema-proposta.sql");
  await writeFile(
    path,
    `${await readFile(path, "utf8")}\ncreate table if not exists public.inqueritos (\n`,
  );
  await assert.rejects(
    loadRecoveryPlan(root, { mode: "recovered" }),
    /boundary missing or ambiguous/,
  );
});

test("prepare writes a verifiable unchanged bundle only inside a new private Git workspace", async (t) => {
  const { prepareLocalWorkspace } = await import(prepareModule);
  const { loadRecoveryPlan } = await import(sourceModule);
  const root = await fixture(t);
  const runtime = await prepareLocalWorkspace({ repoRoot: root });
  const base = join(root, ".git", "codex-recovery-e2e");
  assert.ok(relative(base, runtime.workspaceRoot).startsWith("recovery-"));
  assert.equal(relative(base, runtime.workspaceRoot).includes(sep), false);
  assert.equal((await lstat(runtime.workspaceRoot)).isSymbolicLink(), false);
  assert.equal(runtime.manifest.marker, "codex-recovery-e2e");
  assert.equal(runtime.manifest.localOnly, true);
  assert.equal(runtime.manifest.projectId, runtime.projectId);
  assert.deepEqual(runtime.manifest.excludedSources, [adapterPath]);
  const bundle = await readFile(runtime.bundlePath, "utf8");
  assert.equal(hash(bundle), runtime.manifest.bundle.sha256);
  const config = await readFile(runtime.configPath, "utf8");
  assert.equal(hash(config), runtime.manifest.config.sha256);
  assert.match(config, new RegExp(`project_id = "${runtime.projectId}"`));
  assert.match(config, /\[db.seed\]\nenabled = false/);
  assert.match(config, /\[local_smtp\]\nenabled = false/);
  assert.match(config, /\[analytics\]\nenabled = false/);
  const plan = await loadRecoveryPlan(root, { mode: "recovered", includePlatformAdapter: false });
  assert.deepEqual(
    runtime.manifest.entries,
    plan.map(({ sql, ...entry }) => entry),
  );
  let cursor = 0;
  for (const entry of plan) {
    const position = bundle.indexOf(entry.sql, cursor);
    assert.ok(position >= cursor, `Missing or changed SQL: ${entry.path}`);
    cursor = position + entry.sql.length;
  }
  assert.equal(bundle.includes("create schema if not exists auth"), false);
  assert.equal(
    (await filesUnder(runtime.workspaceRoot)).some(
      (path) => path.endsWith(".sql") && path.includes(`${sep}migrations${sep}`),
    ),
    false,
  );
});

test("prepare never imports project links, repository config, or environment secrets and never overwrites prior work", async (t) => {
  const { prepareLocalWorkspace } = await import(prepareModule);
  const root = await fixture(t);
  const sentinel = "DO_NOT_COPY_TEST_SECRET_82659";
  await writeFile(join(root, ".env"), `SUPABASE_SERVICE_ROLE_KEY=${sentinel}\n`);
  await writeFile(join(root, ".env.local"), `VITE_SUPABASE_URL=https://${sentinel}.supabase.co\n`);
  await writeFile(join(root, "supabase/config.toml"), `project_id = "${sentinel}"\n`);
  await mkdir(join(root, "supabase/.temp"));
  await writeFile(join(root, "supabase/.temp/project-ref"), sentinel);
  const first = await prepareLocalWorkspace({ repoRoot: root });
  await writeFile(join(first.workspaceRoot, "preserved-data"), sentinel);
  const second = await prepareLocalWorkspace({ repoRoot: root });
  assert.notEqual(first.workspaceRoot, second.workspaceRoot);
  assert.notEqual(first.projectId, second.projectId);
  assert.equal(await readFile(join(first.workspaceRoot, "preserved-data"), "utf8"), sentinel);
  for (const path of await filesUnder(second.workspaceRoot)) {
    assert.equal((await readFile(path, "utf8")).includes(sentinel), false, path);
    assert.equal(relative(second.workspaceRoot, path).split(sep).includes(".env"), false);
    assert.equal(path.includes(`${sep}.temp${sep}`), false);
  }
});

test("prepare rejects linked Git/runtime paths and unsafe options before writing outside Git", async (t) => {
  const { prepareLocalWorkspace } = await import(prepareModule);
  const root = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), "recovery-outside-test-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(
    outside,
    join(root, ".git/codex-recovery-e2e"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(prepareLocalWorkspace({ repoRoot: root }), /link|symbolic|within/i);
  assert.deepEqual(await readdir(outside), []);
  await assert.rejects(prepareLocalWorkspace({ repoRoot: root, ports: { api: 443 } }), /port/i);
  await assert.rejects(
    prepareLocalWorkspace({ repoRoot: root, siteUrl: "https://example.com" }),
    /loopback|local/i,
  );
});
