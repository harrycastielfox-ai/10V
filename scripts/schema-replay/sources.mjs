import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const VALID_MODES = new Set(["bare", "legacy", "recovered"]);
const PLATFORM_ADAPTER = "tests/schema-replay/supabase-adapter.sql";

const hash = (sql) => createHash("sha256").update(sql).digest("hex");
const unix = (path) => path.replaceAll("\\", "/");

async function load(root, path) {
  const sql = await readFile(resolve(root, path), "utf8");
  return { path: unix(path), sql, sha256: hash(sql) };
}

// Extract complete, unchanged SQL sections rather than maintaining a second
// independently invented application schema. Boundaries fail closed if the
// documentary source changes or becomes ambiguous.
function section(source, label, start, end = null) {
  const from = source.sql.indexOf(start);
  const until = end === null ? source.sql.length : source.sql.indexOf(end, from + start.length);
  const duplicateStart = from >= 0 && source.sql.indexOf(start, from + 1) >= 0;
  if (from < 0 || until < 0 || duplicateStart) {
    throw new Error(`Legacy source boundary missing or ambiguous: ${label}`);
  }
  const sql = source.sql.slice(from, until);
  return {
    path: source.path,
    section: label,
    startLine: source.sql.slice(0, from).split("\n").length,
    endLine: source.sql.slice(0, until).split("\n").length - 1,
    sourceSha256: source.sha256,
    sha256: hash(sql),
    sql,
  };
}

export async function loadRecoveryPlan(
  repoRoot,
  { mode = "recovered", includePlatformAdapter = true } = {},
) {
  if (!VALID_MODES.has(mode)) throw new Error(`Unsupported recovery mode: ${mode}`);
  const root = resolve(repoRoot);
  const migrationNames = (await readdir(resolve(root, "supabase/migrations")))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  if (!migrationNames.length || migrationNames.some((file) => !/^\d{14}_.+\.sql$/.test(file))) {
    throw new Error(
      "Migration inventory must contain timestamped SQL files only; no files may be silently excluded.",
    );
  }

  const migrations = await Promise.all(
    migrationNames.map((file) => load(root, `supabase/migrations/${file}`)),
  );
  const plan = [];
  if (mode !== "bare") {
    if (includePlatformAdapter) {
      plan.push({ phase: "prelude", ...(await load(root, PLATFORM_ADAPTER)) });
    }
    const legacy = await load(root, "docs/supabase-schema-proposta.sql");
    const normalization = await load(root, "docs/proposta-padronizacao-campos-operacionais.sql");
    const representationSecurity = await load(
      root,
      "docs/proposta-rls-representacoes-sigilosas.sql",
    );
    const profilePhone = await load(root, "docs/proposta-profiles-telefone.sql");
    plan.push(
      {
        phase: "prelude",
        ...section(
          legacy,
          "initial inqueritos table",
          "create table if not exists public.inqueritos (",
          "create table if not exists public.representacoes (",
        ),
      },
      {
        phase: "prelude",
        ...section(
          legacy,
          "initial representacoes table",
          "create table if not exists public.representacoes (",
          "create table if not exists public.auditoria (",
        ),
      },
      {
        phase: "prelude",
        ...section(
          legacy,
          "initial enums, profiles and profile policies",
          "-- Fase 1+2: perfis, cargos e status de autorização.",
          "-- RPC controlada para resolver login -> email",
        ),
      },
      {
        phase: "prelude",
        ...(await load(root, "supabase/2026-05-03_inqueritos_add_missing_columns.sql")),
      },
      { phase: "prelude", ...(await load(root, "tests/schema-replay/catalog-prelude.sql")) },
      {
        phase: "prelude",
        ...section(
          normalization,
          "documented normalized columns and constraints (inqueritos and representacoes)",
          "-- Inqueritos.",
          "alter table public.profiles",
        ),
      },
      {
        phase: "prelude",
        ...section(
          representationSecurity,
          "documented initial representacoes RLS and authorization helpers",
          "-- 2. APLICACAO PROPOSTA",
          "-- 3. CHECAGENS MANUAIS DEPOIS DE APLICAR",
        ),
      },
      {
        phase: "prelude",
        ...section(
          profilePhone,
          "documented initial profiles phone column",
          "-- 2.1. Adiciona telefone ao contrato de public.profiles.",
          "-- 2.2. Atualiza a trigger de criacao de perfil.",
        ),
      },
      { phase: "prelude", ...(await load(root, "tests/schema-replay/platform-grants.sql")) },
    );
  }

  const gap =
    mode === "recovered"
      ? {
          phase: "documentary-gap",
          beforeMigration: "supabase/migrations/20261024123000_harden_privileged_rpcs.sql",
          ...section(
            await load(root, "docs/auditoria-avatar-rpc-proposta.sql"),
            "documented audit RPC OUT-type evolution with restored grants",
            "begin;",
          ),
        }
      : null;
  for (const migration of migrations) {
    if (gap?.beforeMigration === migration.path) plan.push(gap);
    plan.push({ phase: "migration", ...migration });
  }
  return plan;
}

export const recoverySourceConstants = Object.freeze({ platformAdapter: PLATFORM_ADAPTER });
