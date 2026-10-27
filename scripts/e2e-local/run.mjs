import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startLocalGateway } from "./gateway.mjs";
import { prepareLocalWorkspace } from "./prepare.mjs";
import { probeLocalSecureLogin } from "./preflight.mjs";
import { LOCAL_SEED_BRIDGE_FILENAME, LOCAL_SEED_BRIDGE_SQL } from "./seed-bridge.mjs";
import { seedLocalSupabase } from "./seed.mjs";
import {
  assertPreparedWorkspace,
  buildPlaywrightEnvironment,
  parseLocalStatus,
} from "./safety.mjs";

const SYSTEM_ENV_ALLOWLIST = [
  "APPDATA",
  "ComSpec",
  "HOME",
  "LOCALAPPDATA",
  "PATH",
  "Path",
  "PATHEXT",
  "SystemDrive",
  "SystemRoot",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "WINDIR",
];

export function buildCliEnvironment(source = process.env) {
  const env = {};
  for (const name of SYSTEM_ENV_ALLOWLIST) {
    if (typeof source[name] === "string") env[name] = source[name];
  }
  return env;
}

export function buildSupabaseCommands({ repoRoot, workspaceRoot, projectId }) {
  const cli = resolve(repoRoot, "node_modules/supabase/dist/supabase.js");
  const prefix = [cli];
  const workdir = ["--workdir", resolve(workspaceRoot)];
  return {
    executable: process.execPath,
    start: [
      ...prefix,
      "start",
      ...workdir,
      "--exclude",
      "realtime,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor",
      "--yes",
    ],
    reset: [...prefix, "db", "reset", ...workdir, "--local", "--no-seed"],
    status: [...prefix, "status", ...workdir, "-o", "json"],
    stop: [...prefix, "stop", ...workdir, "--project-id", projectId],
  };
}

function runCommand(executable, args, { env, capture = false, label }) {
  const result = spawnSync(executable, args, {
    cwd: undefined,
    env,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${label} failed locally${result.status === null ? "" : ` (exit ${result.status})`}`,
    );
  }
  return capture ? result.stdout : "";
}

function requireDocker(env) {
  const result = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  if (result.error?.code === "ENOENT") {
    throw new Error("Docker is not installed or is not available in PATH.");
  }
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new Error("Docker is installed, but its local daemon is not available.");
  }
}

async function materializeRuntime(repoRoot, runtime) {
  await assertPreparedWorkspace({
    repoRoot,
    workspaceRoot: runtime.workspaceRoot,
    projectId: runtime.projectId,
  });
  const migrationDir = join(runtime.workspaceRoot, "supabase", "migrations");
  await mkdir(migrationDir, { recursive: true, mode: 0o700 });
  const migrationPath = join(migrationDir, "20261025000000_recovered_baseline.sql");
  await writeFile(migrationPath, await readFile(runtime.bundlePath), { mode: 0o600, flag: "wx" });
  const seedBridgePath = join(migrationDir, LOCAL_SEED_BRIDGE_FILENAME);
  await writeFile(seedBridgePath, LOCAL_SEED_BRIDGE_SQL, { mode: 0o600, flag: "wx" });
  const targetFunctions = join(runtime.workspaceRoot, "supabase", "functions");
  for (const name of ["_shared", "secure-login", "capture-access-context"]) {
    await cp(join(repoRoot, "supabase", "functions", name), join(targetFunctions, name), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  }
  const functionEnvPath = join(targetFunctions, ".env");
  await writeFile(functionEnvPath, `LOGIN_RATE_LIMIT_SECRET=${randomBytes(32).toString("hex")}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  return { functionEnvPath };
}

export async function runLocalFullstack({
  repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
} = {}) {
  const root = resolve(repoRoot);
  const cliEnv = buildCliEnvironment();
  requireDocker(cliEnv);
  const runtime = await prepareLocalWorkspace({ repoRoot: root });
  const { functionEnvPath } = await materializeRuntime(root, runtime);
  const commands = buildSupabaseCommands({
    repoRoot: root,
    workspaceRoot: runtime.workspaceRoot,
    projectId: runtime.projectId,
  });
  let started = false;
  let gateway;
  let primaryError;
  try {
    runCommand(commands.executable, commands.start, {
      env: cliEnv,
      label: "Supabase local start",
    });
    started = true;
    runCommand(commands.executable, commands.reset, {
      env: cliEnv,
      label: "Supabase isolated database reset",
    });
    const status = parseLocalStatus(
      runCommand(commands.executable, commands.status, {
        env: cliEnv,
        capture: true,
        label: "Supabase local status",
      }),
    );
    const users = await seedLocalSupabase({
      apiUrl: status.apiUrl,
      serviceRoleKey: status.serviceRoleKey,
      runId: randomBytes(5).toString("hex"),
    });
    gateway = await startLocalGateway(status.apiUrl);
    const preflightUser = users.find(
      (user) => user.cargo === "admin" && user.status_autorizacao === "autorizado",
    );
    if (!preflightUser) throw new Error("Synthetic administrator is missing from the local seed");
    await probeLocalSecureLogin({
      origin: status.apiUrl,
      anonKey: status.anonKey,
      user: preflightUser,
    });
    await probeLocalSecureLogin({
      origin: gateway.url,
      anonKey: status.anonKey,
      user: preflightUser,
    });
    const playwrightEnv = buildPlaywrightEnvironment({
      systemEnvironment: cliEnv,
      gatewayUrl: gateway.url,
      upstreamUrl: status.apiUrl,
      anonKey: status.anonKey,
      users,
      appPort: 4174,
    });
    const playwright = resolve(root, "node_modules/@playwright/test/cli.js");
    runCommand(
      process.execPath,
      [playwright, "test", "--config", resolve(root, "playwright.fullstack.config.ts")],
      { env: playwrightEnv, label: "Playwright isolated full-stack suite" },
    );
  } catch (error) {
    primaryError = error;
    if (gateway) {
      console.error(`Local gateway diagnostics: ${JSON.stringify(gateway.snapshot())}`);
    }
    throw error;
  } finally {
    if (gateway) await gateway.close().catch(() => {});
    await rm(functionEnvPath, { force: true }).catch(() => {});
    if (started) {
      try {
        runCommand(commands.executable, commands.stop, {
          env: cliEnv,
          label: "Supabase isolated stop",
        });
      } catch (stopError) {
        if (!primaryError) throw stopError;
      }
    }
  }
  return { projectId: runtime.projectId, workspaceRoot: runtime.workspaceRoot };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runLocalFullstack()
    .then(({ projectId }) => console.log(`Isolated full-stack E2E passed for ${projectId}.`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "Local full-stack E2E failed.");
      process.exitCode = 1;
    });
}
