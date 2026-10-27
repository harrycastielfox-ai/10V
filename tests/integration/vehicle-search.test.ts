import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const sourceSql = readFileSync(
  resolve("supabase/migrations/20260731175836_allow_unspecified_vehicle_situation.sql"),
  "utf8",
);
const fixSql = readFileSync(
  resolve("supabase/migrations/20261025123642_restore_vehicle_search_normalization.sql"),
  "utf8",
);

// Intentional mojibake: an independent snapshot of the pure SQL function read
// from the linked project's catalog on 2026-10-25, not decoded from local SQL.
const catalogAccentAlphabet = "Ã¡Ã\u00a0Ã¢Ã£Ã¤Ã©Ã¨ÃªÃ«Ã­Ã¬Ã®Ã¯Ã³Ã²Ã´ÃµÃ¶ÃºÃ¹Ã»Ã¼Ã§Ã±Ã½Ã¿";
const catalogNormalizer = String.raw`
  create or replace function public.normalize_vehicle_search(p_value text)
  returns text language sql immutable set search_path = '' as $function$
    select trim(regexp_replace(translate(lower(coalesce(p_value, '')),
      '${catalogAccentAlphabet}',
      'aaaaaeeeeiiiiooooouuuucnyy'), '\s+', ' ', 'g'));
  $function$;
`;

function functionSql(source: string, name: string) {
  const sql = source.match(
    new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$function\\$;`),
  )?.[0];
  if (!sql) throw new Error(`Function missing from fixture source: ${name}`);
  return sql;
}

const contractsSql = `
  select p.oid::text as identity, p.proname as name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as result,
    pg_get_userbyid(p.proowner) as owner,
    p.prosecdef as security_definer, p.provolatile as volatility,
    p.proparallel as parallel, p.proisstrict as strict,
    p.procost as cost, p.proconfig as settings, p.proacl::text as acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('normalize_vehicle_search', 'list_vehicles_page')
  order by p.proname
`;
const indexesSql = `
  select indexname, indexdef from pg_indexes
  where schemaname = 'public' and tablename = 'vehicles' order by indexname
`;

type Contract = Record<string, unknown>;
type VehicleRow = { id: string; updated_at: Date; total_count: number };
const legacyId = "10000000-0000-4000-8000-000000000001";
const newId = "10000000-0000-4000-8000-000000000005";
const rpcSignature = "integer,timestamptz,uuid,text,text,text,text,text,text,date,date,boolean";

async function bootstrap(db: PGlite) {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
    create extension pg_trgm;
    create table public.vehicles (
      id uuid primary key,
      internal_id text not null,
      vehicle_type text not null default 'motocicleta',
      brand_model text, color text, plate text,
      situation text, occurrence_type text, status text, procedure_type text,
      procedure_number text, police_report_number text,
      custody_location text not null default 'visible', storage_location text,
      pending_identification boolean not null default false,
      search_text text not null,
      created_at timestamptz not null default '2026-10-01T00:00:00Z',
      updated_at timestamptz not null default '2026-10-24T00:00:00Z',
      deleted_at timestamptz
    );
    alter table public.vehicles enable row level security;
    create policy synthetic_visible on public.vehicles
      for select to authenticated using (custody_location = 'visible');
    grant select on public.vehicles to authenticated;
  `);
  await db.exec(catalogNormalizer);
  await db.exec(functionSql(sourceSql, "list_vehicles_page"));
  await db.exec(`
    revoke all on function public.normalize_vehicle_search(text) from public, anon;
    grant execute on function public.normalize_vehicle_search(text) to authenticated, service_role;
    revoke all on function public.list_vehicles_page(${rpcSignature}) from public, anon;
    grant execute on function public.list_vehicles_page(${rpcSignature}) to authenticated, service_role;
    insert into public.vehicles (id, internal_id, search_text) values
      ('${legacyId}', 'SYNTHETIC-LEGACY', public.normalize_vehicle_search('São João Motocicléta')),
      ('10000000-0000-4000-8000-000000000002', 'SYNTHETIC-OTHER', 'bicicleta azul');
    insert into public.vehicles (id, internal_id, search_text, custody_location) values
      ('10000000-0000-4000-8000-000000000003', 'SYNTHETIC-HIDDEN',
       public.normalize_vehicle_search('São João Motocicléta'), 'hidden');
    insert into public.vehicles (id, internal_id, search_text, deleted_at) values
      ('10000000-0000-4000-8000-000000000004', 'SYNTHETIC-DELETED',
       public.normalize_vehicle_search('São João Motocicléta'), now());
    create index vehicles_search_trgm_idx on public.vehicles
      using gin (search_text gin_trgm_ops) where deleted_at is null;
  `);
}

describe("vehicle search normalization with legacy stored text", () => {
  const db = new PGlite({ extensions: { pg_trgm } });
  let contractsBefore: Contract[];
  let indexesBefore: Contract[];
  let catalogResults: Array<{ input: string; normalized: string }>;

  async function asAuthenticated<T>(action: (tx: Pick<PGlite, "exec" | "query">) => Promise<T>) {
    return db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      return action(tx);
    });
  }

  beforeAll(async () => {
    await bootstrap(db);
    contractsBefore = (await db.query<Contract>(contractsSql)).rows;
    indexesBefore = (await db.query<Contract>(indexesSql)).rows;
    catalogResults = (
      await db.query<{ input: string; normalized: string }>(`
        select input, public.normalize_vehicle_search(input) as normalized
        from (values ('Motocicléta'), ('São João')) as synthetic(input)
      `)
    ).rows;
    await db.exec(fixSql);
    await db.query(
      `
      insert into public.vehicles (id, internal_id, search_text, situation, updated_at)
      values ($1, 'SYNTHETIC-NEW', public.normalize_vehicle_search('São João Motocicléta'),
        'apreendido', '2026-10-25T00:00:00Z')
    `,
      [newId],
    );
  });

  afterAll(async () => db.close());

  it("reproduces the current catalog's broken accent folding from an explicit fixture", () => {
    expect(catalogResults).toEqual([
      { input: "Motocicléta", normalized: "motocicléta" },
      { input: "São João", normalized: "são joão" },
    ]);
  });

  it.each([
    ["Motocicléta", "motocicleta"],
    ["São João", "sao joao"],
    ["ÁÀÂÃÄ ÉÈÊË ÍÌÎÏ ÓÒÔÕÖ ÚÙÛÜ ÇÑÝŸ", "aaaaa eeee iiii ooooo uuuu cnyy"],
    ["  São\tJoão\n  Motocicléta  ", "sao joao motocicleta"],
    ["  ABC-1234  ", "abc-1234"],
    [null, ""],
  ])("normalizes the synthetic input %j", async (input, expected) => {
    const result = await asAuthenticated((tx) =>
      tx.query<{ normalized: string }>(
        "select public.normalize_vehicle_search(p_value => $1::text) as normalized",
        [input],
      ),
    );
    expect(result.rows).toEqual([{ normalized: expected }]);
  });

  it.each(["motocicleta", "Motocicléta", "sao joao", "São João"])(
    "finds legacy and new records for %s while preserving RLS and deleted filtering",
    async (search) => {
      const result = await asAuthenticated((tx) =>
        tx.query<VehicleRow>(
          "select id, total_count from public.list_vehicles_page(p_search => $1)",
          [search],
        ),
      );
      expect(result.rows).toEqual([
        { id: newId, total_count: 2 },
        { id: legacyId, total_count: 2 },
      ]);
    },
  );

  it("preserves the keyset cursor and total count after the normalized search", async () => {
    const result = await asAuthenticated((tx) =>
      tx.query<VehicleRow>(
        `
      select id, total_count from public.list_vehicles_page(
        p_search => 'sao joao', p_limit => 1,
        p_cursor_updated_at => '2026-10-25T00:00:00Z', p_cursor_id => $1
      )
    `,
        [newId],
      ),
    );
    expect(result.rows).toEqual([{ id: legacyId, total_count: 2 }]);
  });

  it("preserves the explicit missing-situation filter", async () => {
    const result = await asAuthenticated((tx) =>
      tx.query<VehicleRow>(`
      select id, total_count from public.list_vehicles_page(
        p_search => 'sao joao', p_situation => 'nao_informada'
      )
    `),
    );
    expect(result.rows).toEqual([{ id: legacyId, total_count: 1 }]);
  });

  it("does not rewrite stored legacy search text or ordering timestamps", async () => {
    const result = await db.query<{ search_text: string; updated_at: Date }>(
      "select search_text, updated_at from public.vehicles where id = $1",
      [legacyId],
    );
    expect(result.rows).toEqual([
      {
        search_text: "são joão motocicléta",
        updated_at: new Date("2026-10-24T00:00:00Z"),
      },
    ]);
  });

  it("preserves both function identities, ACLs, ownership and execution settings", async () => {
    expect((await db.query<Contract>(contractsSql)).rows).toEqual(contractsBefore);
  });

  it("keeps anonymous callers denied", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        await tx.query("select public.normalize_vehicle_search('São João')");
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("preserves service-role execution of the pure normalizer", async () => {
    const result = await db.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      return tx.query<{ normalized: string }>(
        "select public.normalize_vehicle_search('São João') as normalized",
      );
    });
    expect(result.rows).toEqual([{ normalized: "sao joao" }]);
  });

  // A local EXPLAIN experiment with an expression GIN produced an Index Cond
  // as postgres, but authenticated + RLS kept normalization in the Filter.
  // That did not establish a benefit for the application's execution path;
  // preserve the raw-text index rather than add unproven write/storage costs.
  it("preserves existing indexes without introducing an unproven replacement", async () => {
    expect((await db.query<Contract>(indexesSql)).rows).toEqual(indexesBefore);
  });
});
