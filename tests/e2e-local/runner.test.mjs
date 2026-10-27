import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

const runnerModule = new URL("../../scripts/e2e-local/run.mjs", import.meta.url);

test("runner command plan is local, exact-workspace and narrowly stopped", async () => {
  const { buildSupabaseCommands } = await import(runnerModule);
  const repoRoot = resolve(import.meta.dirname, "../..");
  const workspaceRoot = resolve(repoRoot, ".git/codex-recovery-e2e/recovery-test");
  const projectId = "codex-recovery-test1234";
  const plan = buildSupabaseCommands({ repoRoot, workspaceRoot, projectId });
  assert.equal(plan.executable, process.execPath);
  for (const command of [plan.start, plan.reset, plan.status, plan.stop]) {
    assert.equal(command.includes("--workdir"), true);
    assert.equal(command[command.indexOf("--workdir") + 1], workspaceRoot);
    assert.equal(
      command.some((part) => /^https?:\/\//.test(part)),
      false,
    );
    assert.equal(command.includes("--linked"), false);
    assert.equal(command.includes("--project-ref"), false);
  }
  assert.deepEqual(plan.reset.slice(-2), ["--local", "--no-seed"]);
  assert.deepEqual(plan.status.slice(-2), ["-o", "json"]);
  assert.equal(plan.stop.includes("--project-id"), true);
  assert.equal(plan.stop[plan.stop.indexOf("--project-id") + 1], projectId);
  assert.equal(plan.stop.includes("--all"), false);
  assert.equal(plan.stop.includes("--no-backup"), false);
});

test("CLI environment drops remote Supabase credentials", async () => {
  const { buildCliEnvironment } = await import(runnerModule);
  const env = buildCliEnvironment({
    PATH: "test-path",
    SystemRoot: "C:\\Windows",
    SUPABASE_ACCESS_TOKEN: "remote-token",
    SUPABASE_DB_PASSWORD: "remote-password",
    SUPABASE_PROJECT_REF: "production-ref",
    DATABASE_URL: "postgresql://remote",
  });
  assert.deepEqual(env, { PATH: "test-path", SystemRoot: "C:\\Windows" });
});
