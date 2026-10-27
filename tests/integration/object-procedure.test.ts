import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const linkedObject = "10000000-0000-4000-8000-000000000001";
const unlinkedObject = "10000000-0000-4000-8000-000000000002";
const originalObjects = readFileSync(
  resolve("supabase/migrations/20260805090000_objetos_apreendidos.sql"),
  "utf8",
);
const originalAdjustment = readFileSync(
  resolve("supabase/migrations/20260805110000_objetos_ajustes_situacao.sql"),
  "utf8",
);
const fixMigration = readFileSync(
  resolve("supabase/migrations/20261025070926_fix_objects_without_procedure.sql"),
  "utf8",
);

const functionContractsSql = `
  select p.oid::text as identity, p.proname as name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as result,
    p.prosecdef as security_definer, p.proconfig as config, p.proacl::text as acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('list_objects_page', 'object_overview_stats')
  order by p.proname
`;

type FunctionContract = {
  identity: string;
  name: string;
  arguments: string;
  result: string;
  security_definer: boolean;
  config: string[];
  acl: string;
};

// Load the real SQL bodies unchanged. Only their table and access prerequisites
// are synthetic; this suite does not provide Supabase Auth or its HTTP APIs.
function functionSql(source: string, name: string) {
  const sql = source.match(
    new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$function\\$;`),
  )?.[0];
  if (!sql) throw new Error(`Function not found in source migration: ${name}`);
  return sql;
}

function functionAccessSql(source: string, name: string) {
  return Array.from(
    source.matchAll(
      new RegExp(`(?:revoke all|grant execute) on function public\\.${name}\\([\\s\\S]*?;`, "g"),
    ),
    (match) => match[0],
  ).join("\n");
}

async function bootstrap(db: PGlite) {
  await db.exec(`
    create role anon;
    create role authenticated;
    grant usage on schema public to anon, authenticated;
    create table public.inqueritos (id uuid primary key);
    create table public.objects (
      id uuid primary key,
      internal_id text not null,
      object_type text not null default 'outro',
      description text not null default 'Synthetic object',
      brand_model text,
      quantity integer not null default 1,
      situation text not null default 'apreendido',
      occurrence_type text,
      status text,
      procedure_type text,
      procedure_number text,
      police_report_number text,
      inquerito_id uuid references public.inqueritos(id),
      custody_location text not null default 'visible',
      storage_location text,
      pending_identification boolean not null default false,
      search_text text not null default 'synthetic object',
      created_at timestamptz not null default '2026-10-01T12:00:00Z',
      updated_at timestamptz not null default '2026-10-25T12:00:00Z',
      release_date date,
      deleted_at timestamptz
    );
    alter table public.objects enable row level security;
    -- A deliberately narrow fixture policy makes invoker/RLS regressions
    -- observable without reconstructing the application's profile hierarchy.
    create policy fixture_objects_visible on public.objects
      for select to authenticated using (custody_location = 'visible');
    grant select on public.objects to authenticated;
    insert into public.inqueritos values ('20000000-0000-4000-8000-000000000001');
    insert into public.objects (id, internal_id, inquerito_id) values (
      '${linkedObject}', 'SYNTHETIC-FK', '20000000-0000-4000-8000-000000000001'
    );
    insert into public.objects (id, internal_id) values
      ('${unlinkedObject}', 'SYNTHETIC-UNLINKED');
    insert into public.objects (id, internal_id, procedure_number) values
      ('10000000-0000-4000-8000-000000000003', 'SYNTHETIC-IP', 'IP-SYNTHETIC');
    insert into public.objects (id, internal_id, police_report_number) values
      ('10000000-0000-4000-8000-000000000004', 'SYNTHETIC-BO', 'BO-SYNTHETIC');
    insert into public.objects (id, internal_id, deleted_at) values
      ('10000000-0000-4000-8000-000000000005', 'SYNTHETIC-DELETED', now());
    insert into public.objects (id, internal_id, custody_location) values
      ('10000000-0000-4000-8000-000000000006', 'SYNTHETIC-HIDDEN', 'hidden');
  `);
  await db.exec(functionSql(originalObjects, "normalize_object_search"));
  await db.exec(functionAccessSql(originalObjects, "normalize_object_search"));
  await db.exec(functionSql(originalAdjustment, "list_objects_page"));
  await db.exec(functionAccessSql(originalAdjustment, "list_objects_page"));
  await db.exec(functionSql(originalAdjustment, "object_overview_stats"));
  await db.exec(functionAccessSql(originalObjects, "object_overview_stats"));
}

describe("objects without a linked procedure in isolated PostgreSQL", () => {
  const db = new PGlite();
  let originalContracts: FunctionContract[];

  async function asAuthenticated<T>(action: (tx: Pick<PGlite, "query" | "exec">) => Promise<T>) {
    return db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      return action(tx);
    });
  }

  beforeAll(async () => {
    await bootstrap(db);
    originalContracts = (await db.query<FunctionContract>(functionContractsSql)).rows;
    await db.exec(fixMigration);
  });

  afterAll(async () => db.close());

  it("reproduces the legacy false positive from the original function definitions", async () => {
    const legacy = new PGlite();
    try {
      await bootstrap(legacy);
      await legacy.transaction(async (tx) => {
        await tx.exec("set local role authenticated");
        const list = await tx.query<{ id: string; total_count: number }>(`
          select id, total_count from public.list_objects_page(p_without_procedure => true)
        `);
        expect(list.rows).toEqual([
          { id: unlinkedObject, total_count: 2 },
          { id: linkedObject, total_count: 2 },
        ]);
        const overview = await tx.query<{ stats: { withoutProcedure: number } }>(
          "select public.object_overview_stats() as stats",
        );
        expect(overview.rows[0].stats.withoutProcedure).toBe(2);
      });
    } finally {
      await legacy.close();
    }
  });

  it("excludes an object linked by inquerito_id even when both document numbers are null", async () => {
    const result = await asAuthenticated((tx) =>
      tx.query<{ id: string; total_count: number }>(`
        select id, total_count from public.list_objects_page(p_without_procedure => true)
      `),
    );
    expect(result.rows).toEqual([{ id: unlinkedObject, total_count: 1 }]);
  });

  it("does not count the foreign-key-linked object as withoutProcedure", async () => {
    const result = await asAuthenticated((tx) =>
      tx.query<{ stats: { total: number; withoutProcedure: number } }>(
        "select public.object_overview_stats() as stats",
      ),
    );
    expect(result.rows[0].stats.withoutProcedure).toBe(1);
    expect(result.rows[0].stats.total).toBe(4);
  });

  it.each([null, false])(
    "preserves unfiltered results when without-procedure is %s",
    async (flag) => {
      const result = await asAuthenticated((tx) =>
        tx.query<{ id: string; total_count: number }>(
          "select id, total_count from public.list_objects_page(p_without_procedure => $1::boolean)",
          [flag],
        ),
      );
      expect(result.rows).toEqual([
        { id: "10000000-0000-4000-8000-000000000004", total_count: 4 },
        { id: "10000000-0000-4000-8000-000000000003", total_count: 4 },
        { id: unlinkedObject, total_count: 4 },
        { id: linkedObject, total_count: 4 },
      ]);
    },
  );

  it("retains search normalization, other filters and cursor pagination", async () => {
    await asAuthenticated(async (tx) => {
      const filtered = await tx.query<{ id: string }>(`
        select id from public.list_objects_page(
          p_search => 'SÝNTHETIC', p_object_type => 'outro',
          p_start_date => '2026-10-01', p_end_date => '2026-10-01',
          p_without_procedure => true
        )
      `);
      expect(filtered.rows).toEqual([{ id: unlinkedObject }]);
      const mismatched = await tx.query(`
        select id from public.list_objects_page(
          p_object_type => 'documento', p_without_procedure => true
        )
      `);
      expect(mismatched.rows).toEqual([]);
      const nextPage = await tx.query<{ id: string; total_count: number }>(`
        select id, total_count from public.list_objects_page(
          p_limit => 1,
          p_cursor_updated_at => '2026-10-25T12:00:00Z',
          p_cursor_id => '10000000-0000-4000-8000-000000000003'
        )
      `);
      expect(nextPage.rows).toEqual([{ id: unlinkedObject, total_count: 4 }]);
    });
  });

  it("preserves function identity, signatures, ACLs and SECURITY INVOKER", async () => {
    const current = (await db.query<FunctionContract>(functionContractsSql)).rows;
    expect(current).toEqual(originalContracts);
    expect(current).toHaveLength(2);
    for (const contract of current) {
      expect(contract.security_definer).toBe(false);
      expect(contract.config).toEqual(['search_path=""']);
    }
  });

  it.each(["select * from public.list_objects_page()", "select public.object_overview_stats()"])(
    "continues denying anonymous execution: %s",
    async (query) => {
      await expect(
        db.transaction(async (tx) => {
          await tx.exec("set local role anon");
          return tx.query(query);
        }),
      ).rejects.toMatchObject({ code: "42501" });
    },
  );
});
