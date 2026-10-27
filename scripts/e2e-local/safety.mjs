import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Local Supabase status is missing ${label}`);
  }
  return value.trim();
}

function exactLoopbackHttpOrigin(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid local loopback origin`);
  }
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(`${label} must be an exact HTTP 127.0.0.1 loopback origin`);
  }
  return url.origin;
}

function localDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Local Supabase status contains an invalid database URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.search ||
    url.hash
  ) {
    throw new Error("Database URL must point to PostgreSQL on the 127.0.0.1 loopback interface");
  }
  return value;
}

export function parseLocalStatus(json) {
  let status;
  try {
    status = JSON.parse(json);
  } catch {
    throw new Error("Local Supabase status was not valid JSON");
  }
  if (!status || typeof status !== "object" || Array.isArray(status)) {
    throw new Error("Local Supabase status must be a JSON object");
  }
  const apiUrl = exactLoopbackHttpOrigin(requiredString(status.API_URL, "API_URL"), "API URL");
  const dbUrl = localDatabaseUrl(requiredString(status.DB_URL, "DB_URL"));
  return {
    apiUrl,
    dbUrl,
    anonKey: requiredString(status.ANON_KEY, "ANON_KEY"),
    serviceRoleKey: requiredString(status.SERVICE_ROLE_KEY, "SERVICE_ROLE_KEY"),
  };
}

export function buildPlaywrightEnvironment({
  systemEnvironment = process.env,
  gatewayUrl,
  upstreamUrl,
  anonKey,
  users,
  appPort,
}) {
  const url = exactLoopbackHttpOrigin(gatewayUrl, "E2E Supabase gateway URL");
  const upstream = exactLoopbackHttpOrigin(upstreamUrl, "E2E Supabase upstream URL");
  if (!Number.isInteger(appPort) || appPort < 1024 || appPort > 65535) {
    throw new Error("E2E application port must be an unprivileged local port");
  }
  if (!Array.isArray(users) || !users.length) throw new Error("Synthetic E2E users are required");
  for (const user of users) {
    if (
      !user ||
      typeof user.email !== "string" ||
      !user.email.toLowerCase().endsWith(".test") ||
      typeof user.password !== "string" ||
      user.password.length < 12
    ) {
      throw new Error("E2E users must use synthetic .test identities and nontrivial passwords");
    }
  }
  const env = {};
  for (const name of [
    "ComSpec",
    "HOME",
    "LOCALAPPDATA",
    "PATH",
    "PATHEXT",
    "SystemDrive",
    "SystemRoot",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WINDIR",
  ]) {
    if (typeof systemEnvironment[name] === "string") env[name] = systemEnvironment[name];
  }
  return {
    ...env,
    E2E_FULLSTACK: "1",
    E2E_APP_PORT: String(appPort),
    E2E_SUPABASE_URL: url,
    E2E_SUPABASE_UPSTREAM_URL: upstream,
    E2E_SUPABASE_PUBLISHABLE_KEY: requiredString(anonKey, "ANON_KEY"),
    E2E_SYNTHETIC_USERS_JSON: JSON.stringify(users),
  };
}

export async function assertPreparedWorkspace({ repoRoot, workspaceRoot, projectId }) {
  const root = resolve(repoRoot);
  const workspace = resolve(workspaceRoot);
  const workspaceStat = await lstat(workspace);
  if (!workspaceStat.isDirectory() || workspaceStat.isSymbolicLink()) {
    throw new Error("Prepared E2E workspace must be a real directory, not a link");
  }
  const base = await realpath(join(root, ".git", "codex-recovery-e2e"));
  const actual = await realpath(workspace);
  const rel = relative(base, actual);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error("Prepared E2E workspace is outside the private Git runtime area");
  }
  const manifest = JSON.parse(await readFile(join(actual, "manifest.json"), "utf8"));
  if (
    manifest.marker !== "codex-recovery-e2e" ||
    manifest.localOnly !== true ||
    manifest.projectId !== projectId ||
    !projectId?.startsWith("codex-recovery-")
  ) {
    throw new Error("Prepared E2E workspace manifest does not match the isolated project");
  }
  return manifest;
}
