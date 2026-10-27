-- Synthetic prerequisites only. Production definitions under test are loaded
-- unchanged from supabase/migrations by the integration suite.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create type public.user_role as enum ('admin', 'delegado', 'atlas_access', 'membro', 'sipi_access');
create type public.authorization_status as enum ('aguardando', 'autorizado', 'bloqueado');
create table public.profiles (
  id uuid primary key, nome text, email text, login text, avatar_path text,
  telefone text, funcao_institucional text, cargo public.user_role not null,
  status_autorizacao public.authorization_status not null,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.auditoria (
  id uuid primary key default gen_random_uuid(), executor_user_id uuid,
  executor_nome text, executor_email text, executor_login text, acao text,
  modulo text, entidade text, entidade_id text, descricao text,
  metadata jsonb, created_at timestamptz default now()
);
create table public.vehicles (id uuid primary key, deleted_at timestamptz);
create table public.boletins_ocorrencia (
  id uuid primary key, numero_bo text, deleted_at timestamptz
);
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (id uuid primary key, bucket_id text);
insert into storage.buckets (id, name, public) values ('vehicle-photos', 'vehicle-photos', true);
insert into storage.objects (id, bucket_id) values ('20000000-0000-4000-8000-000000000001', 'vehicle-photos');
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- Only identities and payloads from synthetic fixtures are used.
insert into public.profiles (id, nome, cargo, status_autorizacao, funcao_institucional)
values
  ('00000000-0000-4000-8000-000000000001', 'Synthetic admin', 'admin', 'autorizado', null),
  ('00000000-0000-4000-8000-000000000002', 'Synthetic member', 'membro', 'autorizado', null),
  ('00000000-0000-4000-8000-000000000003', 'Synthetic blocked admin', 'admin', 'bloqueado', null),
  ('00000000-0000-4000-8000-000000000004', 'Synthetic judge', 'membro', 'autorizado', 'juiz'),
  ('00000000-0000-4000-8000-000000000005', 'Synthetic atlas user', 'atlas_access', 'autorizado', null);
insert into public.vehicles (id) values ('10000000-0000-4000-8000-000000000001');
insert into public.boletins_ocorrencia (id, numero_bo)
values ('20000000-0000-4000-8000-000000000001', 'BO-SYNTHETIC-1');
grant select on public.profiles, public.vehicles, public.boletins_ocorrencia to authenticated;

-- These placeholders only exercise relation-level grants; NEXO policies and
-- complete NEXO schema are outside this fixture's coverage.
create table public.nexo_pessoas (id uuid primary key);
create table public.nexo_organizacoes (id uuid primary key);
create table public.nexo_vinculos (id uuid primary key);
create table public.nexo_documentos_fontes (id uuid primary key);
create table public.nexo_documento_alegacoes (id uuid primary key);
