import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { verifyRecoveredRuntime } from "../../tests/schema-replay/runtime-probes.mjs";
import { loadRecoveryPlan } from "./sources.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const mode = args.find((arg) => arg.startsWith("--mode="))?.slice(7) ?? "legacy";
const writeReport = args.includes("--write-report");
if (
  !["bare", "legacy", "recovered"].includes(mode) ||
  args.some(
    (arg) => !["--mode=bare", "--mode=legacy", "--mode=recovered", "--write-report"].includes(arg),
  )
) {
  console.error(
    "Usage: node scripts/schema-replay/replay.mjs [--mode=bare|legacy|recovered] [--write-report]",
  );
  process.exit(2);
}

const hash = (sql) => createHash("sha256").update(sql).digest("hex");
const unix = (path) => path.replaceAll("\\", "/");
const load = async (path) => {
  const sql = await readFile(resolve(root, path), "utf8");
  return { path: unix(path), sql, sha256: hash(sql) };
};

const plan = await loadRecoveryPlan(root, { mode, includePlatformAdapter: true });
const migrations = plan.filter((entry) => entry.phase === "migration");
const prelude = plan.filter((entry) => entry.phase === "prelude");
const documentaryGaps = plan.filter((entry) => entry.phase === "documentary-gap");

const describe = ({ sql, ...entry }) => entry;
const report = {
  formatVersion: 1,
  runnerSha256: hash(await readFile(fileURLToPath(import.meta.url), "utf8")),
  mode,
  classification:
    mode === "recovered"
      ? "candidate recovered baseline; includes explicit documentary evolution; catalog parity pending"
      : "historical replay with initial prerequisites only",
  complete: false,
  ddlComplete: false,
  runtimeComplete: mode === "recovered" ? false : null,
  engine: {
    package: "@electric-sql/pglite",
    version: JSON.parse(
      await readFile(resolve(root, "node_modules/@electric-sql/pglite/package.json"), "utf8"),
    ).version,
    registeredExtensions: ["pgcrypto", "pg_trgm", "unaccent"],
  },
  database: "fresh in-memory PostgreSQL; discarded after this process",
  scope:
    "DDL replay only; no Supabase API, Storage service, Auth service or production equivalence claim",
  security:
    "Migrations and selected documented prelude sections execute unchanged. No original security statements are rewritten or skipped by the runner.",
  prelude: prelude.map(describe),
  documentaryGaps: documentaryGaps.map(describe),
  migrations: migrations.map(describe),
  applied: [],
  runtimeProbes: [],
  runtimeProbeSource: describe(await load("tests/schema-replay/runtime-probes.mjs")),
  failure: null,
};
const db = new PGlite({ extensions: { pgcrypto, pg_trgm, unaccent } });
let current = null;
try {
  for (const entry of plan) {
    current = entry;
    await db.exec(entry.sql);
    report.applied.push(describe(entry));
  }
  report.ddlComplete = true;
  if (mode === "recovered") {
    current = { phase: "runtime", path: "tests/schema-replay/runtime-probes.mjs" };
    await verifyRecoveredRuntime(db, report.runtimeProbes);
    report.runtimeComplete = true;
  }
  report.complete = true;
} catch (error) {
  const position = Number(error.position);
  const relativeLine =
    Number.isFinite(position) && position > 0 && typeof current?.sql === "string"
      ? current.sql.slice(0, position - 1).split("\n").length
      : null;
  report.failure = {
    phase: current?.phase ?? "engine",
    file: current?.path ?? null,
    section: current?.section ?? null,
    sqlstate: /^[0-9A-Z]{5}$/.test(error.code ?? "") ? error.code : null,
    errorCode: error.code ?? null,
    message: error.message,
    position: Number.isFinite(position) ? position : null,
    sourceLine: relativeLine === null ? null : (current.startLine ?? 1) + relativeLine - 1,
    detail: error.detail ?? null,
    hint: error.hint ?? null,
    runtimeProbe: report.runtimeProbes.find((probe) => probe.passed === false)?.name ?? null,
    appliedMigrationCount: report.applied.filter((entry) => entry.phase === "migration").length,
    totalMigrationCount: migrations.length,
    remainingMigrationCount:
      migrations.length - report.applied.filter((entry) => entry.phase === "migration").length,
  };
  // Some historical files explicitly BEGIN. Release an aborted transaction only
  // to close the ephemeral engine; never continue replay after a failure.
  await db.exec("rollback").catch(() => {});
} finally {
  await db.close();
}

if (writeReport) {
  const target = resolve(root, `tests/schema-replay/results/${mode}.json`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Report: ${unix(relative(root, target))}`);
}
const appliedCount = report.applied.filter((entry) => entry.phase === "migration").length;
console.log(
  JSON.stringify(
    {
      mode,
      complete: report.complete,
      ddlComplete: report.ddlComplete,
      runtimeComplete: report.runtimeComplete,
      appliedMigrationCount: appliedCount,
      totalMigrationCount: migrations.length,
      failure: report.failure,
    },
    null,
    2,
  ),
);
if (!report.complete) process.exitCode = 1;
