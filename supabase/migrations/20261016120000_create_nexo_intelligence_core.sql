-- NEXO — Núcleo Estratégico de Vínculos e Organizações.
-- Cadastros sensíveis, hipóteses de vínculo graduadas, fotografias privadas e auditoria.

create or replace function public.current_user_can_access_nexo()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.status_autorizacao = 'autorizado'
      and p.cargo in ('atlas_access', 'delegado', 'admin')
  );
$function$;

revoke all on function public.current_user_can_access_nexo() from public, anon;
grant execute on function public.current_user_can_access_nexo() to authenticated;

create table if not exists public.nexo_organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 180),
  sigla text,
  status text not null default 'monitoramento'
    check (status in ('monitoramento', 'ativa', 'inativa', 'indeterminada')),
  cor text not null default '#ef4444' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  descricao text,
  area_atuacao text,
  nivel_risco text not null default 'moderado'
    check (nivel_risco in ('baixo', 'moderado', 'alto', 'critico')),
  simbolo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  deleted_at timestamptz
);

create table if not exists public.nexo_pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 180),
  apelido text,
  cpf text,
  rg text,
  data_nascimento date,
  nome_mae text,
  telefone text,
  observacoes text,
  foto_perfil_path text,
  foto_relatorio_path text,
  endereco_id uuid references public.localizacao_enderecos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  deleted_at timestamptz
);

create table if not exists public.nexo_vinculos (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.nexo_organizacoes(id) on delete cascade,
  pessoa_id uuid not null references public.nexo_pessoas(id) on delete cascade,
  status text not null default 'nao_confirmado'
    check (status in ('confirmado', 'provavel', 'suspeito', 'nao_confirmado', 'desvinculado')),
  funcao text,
  confianca smallint not null default 0 check (confianca between 0 and 100),
  fonte_resumo text,
  desde date,
  ate date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint nexo_vinculos_periodo_check check (ate is null or desde is null or ate >= desde)
);

create unique index if not exists nexo_vinculos_unico_ativo_idx
  on public.nexo_vinculos (organizacao_id, pessoa_id) where deleted_at is null;
create index if not exists nexo_pessoas_busca_idx
  on public.nexo_pessoas (lower(nome), lower(coalesce(apelido, ''))) where deleted_at is null;
create index if not exists nexo_vinculos_pessoa_idx
  on public.nexo_vinculos (pessoa_id, status) where deleted_at is null;
create index if not exists nexo_vinculos_organizacao_idx
  on public.nexo_vinculos (organizacao_id, status) where deleted_at is null;

create table if not exists public.nexo_fotos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.nexo_pessoas(id) on delete cascade,
  storage_path text not null unique,
  legenda text,
  categoria text not null default 'album'
    check (categoria in ('perfil', 'relatorio', 'album')),
  capturada_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid()
);

create index if not exists nexo_fotos_pessoa_idx on public.nexo_fotos (pessoa_id, created_at desc);

create or replace function private.prepare_nexo_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$function$;

revoke all on function private.prepare_nexo_row() from public, anon, authenticated, service_role;

drop trigger if exists prepare_nexo_organizacao on public.nexo_organizacoes;
create trigger prepare_nexo_organizacao before insert or update on public.nexo_organizacoes
for each row execute function private.prepare_nexo_row();
drop trigger if exists prepare_nexo_pessoa on public.nexo_pessoas;
create trigger prepare_nexo_pessoa before insert or update on public.nexo_pessoas
for each row execute function private.prepare_nexo_row();
drop trigger if exists prepare_nexo_vinculo on public.nexo_vinculos;
create trigger prepare_nexo_vinculo before insert or update on public.nexo_vinculos
for each row execute function private.prepare_nexo_row();

create or replace function private.audit_nexo_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_actor_nome text;
  v_actor_email text;
  v_actor_login text;
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_action text := case when tg_op = 'INSERT' then 'create' when tg_op = 'DELETE' then 'delete' else 'update' end;
begin
  if v_actor_id is null then
    raise exception 'nexo_audit_actor_required' using errcode = '42501';
  end if;

  select p.nome, p.email, p.login
    into v_actor_nome, v_actor_email, v_actor_login
  from public.profiles p where p.id = v_actor_id;

  insert into public.auditoria (
    executor_user_id, executor_nome, executor_email, executor_login,
    acao, modulo, entidade, entidade_id, descricao, metadata
  ) values (
    v_actor_id, v_actor_nome, v_actor_email, v_actor_login,
    v_action, 'nexo', tg_table_name, v_row ->> 'id',
    case v_action when 'create' then 'Criou registro no NEXO'
      when 'delete' then 'Excluiu registro no NEXO'
      else 'Atualizou registro no NEXO' end,
    jsonb_build_object('source', 'database_trigger', 'operation', tg_op)
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function private.audit_nexo_row_change()
from public, anon, authenticated, service_role;

drop trigger if exists audit_nexo_organizacoes on public.nexo_organizacoes;
create trigger audit_nexo_organizacoes after insert or update on public.nexo_organizacoes
for each row execute function private.audit_nexo_row_change();
drop trigger if exists audit_nexo_pessoas on public.nexo_pessoas;
create trigger audit_nexo_pessoas after insert or update on public.nexo_pessoas
for each row execute function private.audit_nexo_row_change();
drop trigger if exists audit_nexo_vinculos on public.nexo_vinculos;
create trigger audit_nexo_vinculos after insert or update on public.nexo_vinculos
for each row execute function private.audit_nexo_row_change();
drop trigger if exists audit_nexo_fotos on public.nexo_fotos;
create trigger audit_nexo_fotos after insert or delete on public.nexo_fotos
for each row execute function private.audit_nexo_row_change();

alter table public.nexo_organizacoes enable row level security;
alter table public.nexo_pessoas enable row level security;
alter table public.nexo_vinculos enable row level security;
alter table public.nexo_fotos enable row level security;

create policy nexo_organizacoes_select on public.nexo_organizacoes
for select to authenticated using (deleted_at is null and (select public.current_user_can_access_nexo()));
create policy nexo_organizacoes_insert on public.nexo_organizacoes
for insert to authenticated with check (
  (select public.current_user_can_access_nexo()) and created_by = (select auth.uid())
);
create policy nexo_organizacoes_update on public.nexo_organizacoes
for update to authenticated using (deleted_at is null and (select public.current_user_can_access_nexo()))
with check ((select public.current_user_can_access_nexo()) and updated_by = (select auth.uid()));

create policy nexo_pessoas_select on public.nexo_pessoas
for select to authenticated using (deleted_at is null and (select public.current_user_can_access_nexo()));
create policy nexo_pessoas_insert on public.nexo_pessoas
for insert to authenticated with check (
  (select public.current_user_can_access_nexo()) and created_by = (select auth.uid())
);
create policy nexo_pessoas_update on public.nexo_pessoas
for update to authenticated using (deleted_at is null and (select public.current_user_can_access_nexo()))
with check ((select public.current_user_can_access_nexo()) and updated_by = (select auth.uid()));

create policy nexo_vinculos_select on public.nexo_vinculos
for select to authenticated using (deleted_at is null and (select public.current_user_can_access_nexo()));
create policy nexo_vinculos_insert on public.nexo_vinculos
for insert to authenticated with check (
  (select public.current_user_can_access_nexo()) and created_by = (select auth.uid())
);
create policy nexo_vinculos_update on public.nexo_vinculos
for update to authenticated using (deleted_at is null and (select public.current_user_can_access_nexo()))
with check ((select public.current_user_can_access_nexo()) and updated_by = (select auth.uid()));

create policy nexo_fotos_select on public.nexo_fotos
for select to authenticated using ((select public.current_user_can_access_nexo()));
create policy nexo_fotos_insert on public.nexo_fotos
for insert to authenticated with check (
  (select public.current_user_can_access_nexo()) and created_by = (select auth.uid())
);
create policy nexo_fotos_delete on public.nexo_fotos
for delete to authenticated using ((select public.current_user_can_access_nexo()));

revoke all on table public.nexo_organizacoes, public.nexo_pessoas,
  public.nexo_vinculos, public.nexo_fotos from anon;
grant select, insert, update on table public.nexo_organizacoes,
  public.nexo_pessoas, public.nexo_vinculos to authenticated;
grant select, insert, delete on table public.nexo_fotos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nexo-private', 'nexo-private', false, 8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy nexo_storage_select on storage.objects
for select to authenticated using (
  bucket_id = 'nexo-private' and (select public.current_user_can_access_nexo())
);
create policy nexo_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'nexo-private'
  and owner_id = (select auth.uid())::text
  and (select public.current_user_can_access_nexo())
);
create policy nexo_storage_update on storage.objects
for update to authenticated using (
  bucket_id = 'nexo-private'
  and owner_id = (select auth.uid())::text
  and (select public.current_user_can_access_nexo())
) with check (
  bucket_id = 'nexo-private'
  and owner_id = (select auth.uid())::text
  and (select public.current_user_can_access_nexo())
);
create policy nexo_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'nexo-private'
  and owner_id = (select auth.uid())::text
  and (select public.current_user_can_access_nexo())
);

create or replace function public.nexo_criar_pessoa_completa(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_pessoa_id uuid;
  v_endereco_id uuid;
  v_pessoa jsonb := p_payload -> 'pessoa';
  v_endereco jsonb := p_payload -> 'endereco';
  v_vinculo jsonb := p_payload -> 'vinculo';
begin
  if not (select public.current_user_can_access_nexo()) then
    raise exception 'nexo_access_denied' using errcode = '42501';
  end if;

  if v_endereco is not null and jsonb_typeof(v_endereco) = 'object' then
    insert into public.localizacao_enderecos (
      logradouro, numero, bairro, municipio, uf, ponto_referencia, como_chegar,
      latitude, longitude, created_by, updated_by
    ) values (
      v_endereco ->> 'logradouro', nullif(v_endereco ->> 'numero', ''),
      nullif(v_endereco ->> 'bairro', ''), coalesce(nullif(v_endereco ->> 'municipio', ''), 'Itabela'),
      coalesce(nullif(v_endereco ->> 'uf', ''), 'BA'), nullif(v_endereco ->> 'ponto_referencia', ''),
      nullif(v_endereco ->> 'como_chegar', ''), (v_endereco ->> 'latitude')::double precision,
      (v_endereco ->> 'longitude')::double precision, auth.uid(), auth.uid()
    ) returning id into v_endereco_id;
  end if;

  insert into public.nexo_pessoas (
    nome, apelido, cpf, rg, data_nascimento, nome_mae, telefone, observacoes,
    endereco_id, created_by, updated_by
  ) values (
    v_pessoa ->> 'nome', nullif(v_pessoa ->> 'apelido', ''), nullif(v_pessoa ->> 'cpf', ''),
    nullif(v_pessoa ->> 'rg', ''), (v_pessoa ->> 'data_nascimento')::date,
    nullif(v_pessoa ->> 'nome_mae', ''), nullif(v_pessoa ->> 'telefone', ''),
    nullif(v_pessoa ->> 'observacoes', ''), v_endereco_id, auth.uid(), auth.uid()
  ) returning id into v_pessoa_id;

  if v_vinculo is not null and jsonb_typeof(v_vinculo) = 'object' then
    insert into public.nexo_vinculos (
      organizacao_id, pessoa_id, status, funcao, confianca, fonte_resumo,
      created_by, updated_by
    ) values (
      (v_vinculo ->> 'organizacao_id')::uuid, v_pessoa_id,
      coalesce(nullif(v_vinculo ->> 'status', ''), 'nao_confirmado'),
      nullif(v_vinculo ->> 'funcao', ''), coalesce((v_vinculo ->> 'confianca')::smallint, 0),
      nullif(v_vinculo ->> 'fonte_resumo', ''), auth.uid(), auth.uid()
    );
  end if;

  return v_pessoa_id;
end;
$function$;

revoke all on function public.nexo_criar_pessoa_completa(jsonb) from public, anon;
grant execute on function public.nexo_criar_pessoa_completa(jsonb) to authenticated;

comment on table public.nexo_pessoas is
  'Pessoas de interesse cadastradas no NEXO. O cadastro não implica vínculo confirmado.';
comment on table public.nexo_vinculos is
  'Hipóteses e vínculos graduados entre pessoas e organizações, sempre com status e confiança.';
