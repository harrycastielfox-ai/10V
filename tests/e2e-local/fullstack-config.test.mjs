import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../..");
const cli = resolve(repoRoot, "node_modules/@playwright/test/cli.js");

function list(overrides = {}) {
  return spawnSync(
    process.execPath,
    [cli, "test", "--config", "playwright.fullstack.config.ts", "--list"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        ...overrides,
      },
    },
  );
}

const valid = {
  E2E_FULLSTACK: "1",
  E2E_APP_PORT: "4174",
  E2E_SUPABASE_URL: "http://127.0.0.1:55121",
  E2E_SUPABASE_UPSTREAM_URL: "http://127.0.0.1:54121",
  E2E_SUPABASE_PUBLISHABLE_KEY: "local-anon-key",
  E2E_SYNTHETIC_USERS_JSON: JSON.stringify([
    {
      email: "admin.synthetic@example.test",
      login: "admin.synthetic",
      password: "synthetic-password-123",
      cargo: "admin",
      status_autorizacao: "autorizado",
    },
    {
      email: "blocked.synthetic@example.test",
      login: "blocked.synthetic",
      password: "synthetic-password-456",
      cargo: "membro",
      status_autorizacao: "bloqueado",
    },
  ]),
};

test("full-stack config refuses implicit or remote environments", () => {
  const missing = list();
  assert.notEqual(missing.status, 0);
  assert.match(`${missing.stdout}\n${missing.stderr}`, /E2E_FULLSTACK/i);
  const remote = list({ ...valid, E2E_SUPABASE_URL: "https://project.supabase.co" });
  assert.notEqual(remote.status, 0);
  assert.match(`${remote.stdout}\n${remote.stderr}`, /loopback|127\.0\.0\.1/i);
  const remoteUpstream = list({
    ...valid,
    E2E_SUPABASE_UPSTREAM_URL: "https://project.supabase.co",
  });
  assert.notEqual(remoteUpstream.status, 0);
  assert.match(`${remoteUpstream.stdout}\n${remoteUpstream.stderr}`, /loopback|127\.0\.0\.1/i);
});

test("full-stack config lists only real isolated tests and does not start services", () => {
  const result = list(valid);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /auth\.e2e\.ts/);
  assert.match(result.stdout, /bo\.e2e\.ts/);
  assert.match(result.stdout, /inqueritos\.e2e\.ts/);
  assert.match(result.stdout, /nexo\.e2e\.ts/);
  assert.match(result.stdout, /objects\.e2e\.ts/);
  assert.match(result.stdout, /representacoes\.e2e\.ts/);
  assert.match(result.stdout, /Total: 15 tests in 9 files/);
});
