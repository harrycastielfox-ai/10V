-- Explicit LOCAL adapter, not a dump or a faithful Supabase installation.
-- Only the database surfaces referenced by the repository are represented.
-- No application tables, application functions, fixture identities or default
-- broad browser-role grants belong here. Never execute this against Supabase.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create schema extensions;

-- Auth users are an empty FK target; this does not implement GoTrue, sessions,
-- credentials, JWT verification, registration triggers or administrative APIs.
create table auth.users (
  id uuid primary key,
  email varchar(255),
  raw_user_meta_data jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Storage columns are the subset read by SQL policies/migrations. There is no
-- upload/signing service, object bytes, protected-delete trigger, S3 backend or
-- promise that this adapter models the complete Storage catalog/security model.
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner_id text,
  metadata jsonb
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
