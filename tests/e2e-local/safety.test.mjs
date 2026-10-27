import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const safetyModule = new URL("../../scripts/e2e-local/safety.mjs", import.meta.url);

test("local status accepts only loopback service coordinates and keeps keys opaque", async () => {
  const { parseLocalStatus } = await import(safetyModule);
  const status = parseLocalStatus(
    JSON.stringify({
      API_URL: "http://127.0.0.1:54121",
      DB_URL: "postgresql://postgres:local-password@127.0.0.1:54122/postgres",
      ANON_KEY: "local-anon-key",
      SERVICE_ROLE_KEY: "local-service-key",
    }),
  );
  assert.deepEqual(status, {
    apiUrl: "http://127.0.0.1:54121",
    dbUrl: "postgresql://postgres:local-password@127.0.0.1:54122/postgres",
    anonKey: "local-anon-key",
    serviceRoleKey: "local-service-key",
  });
  for (const patch of [
    { API_URL: "https://project.supabase.co" },
    { DB_URL: "postgresql://postgres:secret@db.example.com:5432/postgres" },
    { SERVICE_ROLE_KEY: "" },
  ]) {
    assert.throws(
      () =>
        parseLocalStatus(
          JSON.stringify({
            API_URL: "http://127.0.0.1:54121",
            DB_URL: "postgresql://postgres:local@127.0.0.1:54122/postgres",
            ANON_KEY: "anon",
            SERVICE_ROLE_KEY: "service",
            ...patch,
          }),
        ),
      /local|loopback|status/i,
    );
  }
});

test("Playwright environment is allowlisted and never receives service credentials", async () => {
  const { buildPlaywrightEnvironment } = await import(safetyModule);
  const env = buildPlaywrightEnvironment({
    systemEnvironment: {
      PATH: "test-path",
      SystemRoot: "C:\\Windows",
      SUPABASE_SERVICE_ROLE_KEY: "must-not-pass",
      VITE_SUPABASE_URL: "https://production.example",
      DATABASE_URL: "postgresql://production",
      RANDOM_SECRET: "must-not-pass",
    },
    gatewayUrl: "http://127.0.0.1:55121",
    upstreamUrl: "http://127.0.0.1:54121",
    anonKey: "local-anon",
    users: [{ email: "admin.synthetic@example.test", password: "synthetic-password" }],
    appPort: 4174,
  });
  assert.equal(env.PATH, "test-path");
  assert.equal(env.SystemRoot, "C:\\Windows");
  assert.equal(env.E2E_FULLSTACK, "1");
  assert.equal(env.E2E_SUPABASE_URL, "http://127.0.0.1:55121");
  assert.equal(env.E2E_SUPABASE_UPSTREAM_URL, "http://127.0.0.1:54121");
  assert.equal(env.E2E_SUPABASE_PUBLISHABLE_KEY, "local-anon");
  assert.equal(env.E2E_APP_PORT, "4174");
  assert.deepEqual(JSON.parse(env.E2E_SYNTHETIC_USERS_JSON), [
    { email: "admin.synthetic@example.test", password: "synthetic-password" },
  ]);
  for (const forbidden of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "VITE_SUPABASE_URL",
    "DATABASE_URL",
    "RANDOM_SECRET",
  ]) {
    assert.equal(forbidden in env, false, forbidden);
  }

  assert.throws(
    () =>
      buildPlaywrightEnvironment({
        gatewayUrl: "http://127.0.0.1:55121",
        upstreamUrl: "https://project.supabase.co",
        anonKey: "local-anon",
        users: [{ email: "admin.synthetic@example.test", password: "synthetic-password" }],
        appPort: 4174,
      }),
    /loopback|127\.0\.0\.1/i,
  );
});

test("workspace verification rejects links and mismatched manifests", async (t) => {
  const { assertPreparedWorkspace } = await import(safetyModule);
  const root = await mkdtemp(join(tmpdir(), "workspace-safety-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = join(root, ".git", "codex-recovery-e2e");
  const workspace = join(base, "recovery-safe");
  await mkdir(workspace, { recursive: true });
  const manifest = {
    marker: "codex-recovery-e2e",
    localOnly: true,
    projectId: "codex-recovery-1234abcd",
  };
  await writeFile(join(workspace, "manifest.json"), JSON.stringify(manifest));
  await assertPreparedWorkspace({
    repoRoot: root,
    workspaceRoot: workspace,
    projectId: manifest.projectId,
  });

  await assert.rejects(
    assertPreparedWorkspace({
      repoRoot: root,
      workspaceRoot: workspace,
      projectId: "production-ref",
    }),
    /project|manifest/i,
  );
  const outside = join(root, "outside");
  await mkdir(outside);
  const link = join(base, "recovery-link");
  await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
  assert.equal((await lstat(link)).isSymbolicLink(), true);
  await assert.rejects(
    assertPreparedWorkspace({ repoRoot: root, workspaceRoot: link, projectId: manifest.projectId }),
    /link|workspace|manifest/i,
  );
});
