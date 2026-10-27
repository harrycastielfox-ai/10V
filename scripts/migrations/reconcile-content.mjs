/**
 * Print safe fingerprints: node scripts/migrations/reconcile-content.mjs
 * Compare remote metadata supplied through stdin (never executed or saved):
 * node scripts/migrations/reconcile-content.mjs --compare-stdin
 * stdin must be [{version,name,statements:string[]}]. Output excludes SQL.
 * Query metadata only: SELECT version,name,statements
 * FROM supabase_migrations.schema_migrations ORDER BY version;
 */
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createSqlLexicalTools } from "./sql-lexical.mjs";

async function main() {
  const tools = createSqlLexicalTools();
  const directory = resolve("supabase/migrations");
  const local = [];
  for (const file of (await readdir(directory)).sort()) {
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (match)
      local.push({
        version: match[1],
        name: match[2],
        statements: [await readFile(resolve(directory, file), "utf8")],
      });
  }
  if (process.argv.includes("--compare-stdin")) {
    let input = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) input += chunk;
    let remote;
    try {
      remote = JSON.parse(input);
    } catch {
      throw new Error("Invalid remote migration metadata JSON");
    }
    const report = tools.compare(local, remote);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.summary.inconclusive) process.exitCode = 1;
  } else {
    const summaries = tools.summarize(local);
    if (process.argv.includes("--statement-manifest")) {
      for (let i = 0; i < summaries.length; i++) {
        if (!summaries[i].error) summaries[i].commands = tools.commandManifest(local[i].statements);
      }
    }
    process.stdout.write(`${JSON.stringify(summaries)}\n`);
    if (summaries.some((row) => row.error)) process.exitCode = 1;
  }
}

try {
  await main();
} catch {
  // Do not print an exception that might include JSON input or SQL contents.
  process.stderr.write("Migration comparison failed: invalid metadata or local input.\n");
  process.exitCode = 1;
}
