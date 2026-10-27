import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(
  new URL("../../scripts/migrations/reconcile-content.mjs", import.meta.url),
);

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "migration-lexical-test-"));
  const supabase = join(root, "supabase");
  const migrations = join(supabase, "migrations");
  const file = join(migrations, "01_example.sql");
  await mkdir(migrations, { recursive: true });
  await writeFile(file, "SELECT 1;");
  t.after(async () => {
    await unlink(file);
    await rmdir(migrations);
    await rmdir(supabase);
    await rmdir(root);
  });
  return root;
}

test("CLI accepts remote metadata on stdin and emits a safe comparison", async (t) => {
  const cwd = await fixture(t);
  const run = spawnSync(process.execPath, [script, "--compare-stdin"], {
    cwd,
    encoding: "utf8",
    input: JSON.stringify([
      { version: "02", name: "example", statements: ["SELECT /* metadata */ 1"] },
    ]),
  });
  assert.equal(run.status, 0);
  assert.equal(JSON.parse(run.stdout).summary.lexicallyEqual, 1);
  assert.equal(run.stdout.includes("SELECT"), false);
});

test("CLI returns nonzero for lexical failures without printing statement contents", async (t) => {
  const cwd = await fixture(t);
  const privateValue = "synthetic-private-unterminated-value";
  const run = spawnSync(process.execPath, [script, "--compare-stdin"], {
    cwd,
    encoding: "utf8",
    input: JSON.stringify([
      { version: "02", name: "example", statements: [`SELECT '${privateValue}`] },
    ]),
  });
  assert.equal(run.status, 1);
  assert.equal(JSON.parse(run.stdout).summary.inconclusive, 1);
  assert.equal(`${run.stdout}${run.stderr}`.includes(privateValue), false);
});

test("CLI does not echo malformed JSON input in parsing errors", async (t) => {
  const cwd = await fixture(t);
  const privateValue = "synthetic-private-invalid-json";
  const run = spawnSync(process.execPath, [script, "--compare-stdin"], {
    cwd,
    encoding: "utf8",
    input: privateValue,
  });
  assert.equal(run.status, 1);
  assert.equal(`${run.stdout}${run.stderr}`.includes(privateValue), false);
});
