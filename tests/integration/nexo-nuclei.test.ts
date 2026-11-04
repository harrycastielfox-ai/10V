import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const admin = "00000000-0000-4000-8000-000000000001";
const member = "00000000-0000-4000-8000-000000000002";
const organizationA = "10000000-0000-4000-8000-000000000001";
const organizationB = "10000000-0000-4000-8000-000000000002";
const personA = "20000000-0000-4000-8000-000000000001";
const personB = "20000000-0000-4000-8000-000000000002";
const nucleusA = "30000000-0000-4000-8000-000000000001";
const nucleusB = "30000000-0000-4000-8000-000000000002";
const migrationPath = resolve(
  "supabase/migrations/20261104170000_nexo_organogram_nuclei.sql",
);

describe("NEXO organogram nuclei migration", () => {
  const db = new PGlite();

  async function asUser<T>(
    userId: string,
    action: (tx: Pick<PGlite, "query" | "exec">) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      return action(tx);
    });
  }

  beforeAll(async () => {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create schema private;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;

      create table public.profiles (
        id uuid primary key,
        nome text,
        email text,
        login text,
        cargo text not null,
        status_autorizacao text not null
      );
      create table public.auditoria (
        id uuid primary key default gen_random_uuid(),
        executor_user_id uuid,
        executor_nome text,
        executor_email text,
        executor_login text,
        acao text,
        modulo text,
        entidade text,
        entidade_id text,
        descricao text,
        metadata jsonb,
        created_at timestamptz default now()
      );
      insert into public.profiles (id, nome, cargo, status_autorizacao) values
        ('${admin}', 'Admin sintético', 'admin', 'autorizado'),
        ('${member}', 'Membro sintético', 'membro', 'autorizado');

      create function public.current_user_can_access_nexo()
      returns boolean language sql stable security invoker set search_path = '' as $$
        select exists (
          select 1 from public.profiles
          where id = (select auth.uid())
            and status_autorizacao = 'autorizado'
            and cargo in ('admin', 'delegado', 'atlas_access')
        )
      $$;
      grant execute on function public.current_user_can_access_nexo() to authenticated;

      create table public.nexo_organizacoes (
        id uuid primary key,
        nome text not null,
        created_by uuid references public.profiles(id),
        updated_by uuid references public.profiles(id),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz
      );
      create table public.nexo_pessoas (
        id uuid primary key,
        nome text not null,
        created_by uuid references public.profiles(id),
        updated_by uuid references public.profiles(id),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz
      );
      create table public.nexo_vinculos (
        id uuid primary key default gen_random_uuid(),
        organizacao_id uuid not null references public.nexo_organizacoes(id),
        pessoa_id uuid not null references public.nexo_pessoas(id),
        status text not null default 'nao_confirmado',
        funcao text,
        confianca smallint not null default 0,
        fonte_resumo text,
        superior_vinculo_id uuid references public.nexo_vinculos(id),
        municipio_atuacao text,
        uf_atuacao text,
        created_by uuid references public.profiles(id),
        updated_by uuid references public.profiles(id),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz
      );
      create table public.nexo_hierarquia_eventos (
        id uuid primary key default gen_random_uuid(),
        organizacao_id uuid not null references public.nexo_organizacoes(id),
        pessoa_id uuid not null references public.nexo_pessoas(id),
        vinculo_id uuid not null references public.nexo_vinculos(id),
        tipo text not null,
        funcao_anterior text,
        funcao_nova text,
        superior_anterior_nome text,
        superior_novo_nome text,
        status_anterior text,
        status_novo text,
        municipio_atuacao_anterior text,
        municipio_atuacao_novo text,
        uf_atuacao_anterior text,
        uf_atuacao_novo text,
        pessoa_nome text not null,
        justificativa text,
        ocorrido_em timestamptz not null default now(),
        autor_id uuid references public.profiles(id)
      );

      create function private.prepare_nexo_row()
      returns trigger language plpgsql security definer set search_path = '' as $$
      begin
        if tg_op = 'INSERT' then new.created_by := coalesce(auth.uid(), new.created_by); end if;
        new.updated_at := now();
        new.updated_by := coalesce(auth.uid(), new.updated_by);
        return new;
      end;
      $$;
      create function private.audit_nexo_row_change()
      returns trigger language plpgsql security definer set search_path = '' as $$
      begin
        insert into public.auditoria (
          executor_user_id, acao, modulo, entidade, entidade_id, descricao, metadata
        ) values (
          auth.uid(), lower(tg_op), 'nexo', tg_table_name,
          case when tg_op = 'DELETE' then old.id::text else new.id::text end,
          'Alteração sintética do NEXO', jsonb_build_object('operation', tg_op)
        );
        if tg_op = 'DELETE' then return old; end if;
        return new;
      end;
      $$;

      grant select, insert, update on public.nexo_organizacoes,
        public.nexo_pessoas, public.nexo_vinculos to authenticated;
      grant select on public.profiles to authenticated;
      grant select on public.nexo_hierarquia_eventos to authenticated;
      insert into public.nexo_organizacoes (id, nome, created_by, updated_by) values
        ('${organizationA}', 'Organização A', '${admin}', '${admin}'),
        ('${organizationB}', 'Organização B', '${admin}', '${admin}');
      insert into public.nexo_pessoas (id, nome, created_by, updated_by) values
        ('${personA}', 'Pessoa A', '${admin}', '${admin}'),
        ('${personB}', 'Pessoa B', '${admin}', '${admin}');
    `);

    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
    if (migration) await db.exec(migration);
  });

  afterAll(async () => db.close());

  it("aceita somente núcleo ativo da mesma organização do vínculo", async () => {
    await asUser(admin, (tx) =>
      tx.query(
        `insert into public.nexo_nucleos
          (id, organizacao_id, nome, cor, created_by, updated_by)
         values ($1, $2, 'Núcleo A', '#0f766e', $3, $3),
                ($4, $5, 'Núcleo B', '#1d4ed8', $3, $3)`,
        [nucleusA, organizationA, admin, nucleusB, organizationB],
      ),
    );
    const inserted = await asUser(admin, (tx) =>
      tx.query<{ nucleo_id: string }>(
        `insert into public.nexo_vinculos
          (organizacao_id, pessoa_id, status, nucleo_id, created_by, updated_by)
         values ($1, $2, 'confirmado', $3, $4, $4)
         returning nucleo_id`,
        [organizationA, personA, nucleusA, admin],
      ),
    );
    expect(inserted.rows).toEqual([{ nucleo_id: nucleusA }]);

    await expect(
      asUser(admin, (tx) =>
        tx.query(
          `insert into public.nexo_vinculos
            (organizacao_id, pessoa_id, status, nucleo_id, created_by, updated_by)
           values ($1, $2, 'confirmado', $3, $4, $4)`,
          [organizationA, personB, nucleusB, admin],
        ),
      ),
    ).rejects.toMatchObject({ code: "22023" });
  });

  it("arquiva núcleo, desassocia integrantes e registra uma única mudança real", async () => {
    await asUser(admin, async (tx) => {
      const before = await tx.query<{ count: number }>(
        `select count(*)::int as count from public.nexo_hierarquia_eventos
         where pessoa_id = $1`,
        [personA],
      );
      await tx.query("select public.nexo_arquivar_nucleo($1)", [nucleusA]);
      const link = await tx.query<{ nucleo_id: string | null }>(
        "select nucleo_id from public.nexo_vinculos where pessoa_id = $1",
        [personA],
      );
      expect(link.rows).toEqual([{ nucleo_id: null }]);

      const events = await tx.query<{
        nucleo_anterior_nome: string | null;
        nucleo_novo_nome: string | null;
      }>(
        `select nucleo_anterior_nome, nucleo_novo_nome
         from public.nexo_hierarquia_eventos
         where pessoa_id = $1 order by ocorrido_em`,
        [personA],
      );
      expect(events.rows.slice(before.rows[0].count)).toEqual([
        { nucleo_anterior_nome: "Núcleo A", nucleo_novo_nome: null },
      ]);
    });
  });

  it("não expõe núcleos a usuário sem acesso ao NEXO", async () => {
    const invisible = await asUser(member, (tx) =>
      tx.query("select id from public.nexo_nucleos"),
    );
    expect(invisible.rows).toEqual([]);
    await expect(
      asUser(member, (tx) =>
        tx.query(
          `insert into public.nexo_nucleos
            (organizacao_id, nome, cor, created_by, updated_by)
           values ($1, 'Não autorizado', '#334155', $2, $2)`,
          [organizationA, member],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
