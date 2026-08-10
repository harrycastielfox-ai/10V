create table if not exists public.user_saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  scope text not null check (length(btrim(scope)) between 2 and 60),
  name text not null check (length(btrim(name)) between 2 and 80),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  columns jsonb check (columns is null or jsonb_typeof(columns) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scope, name)
);

create index if not exists user_saved_filters_user_scope_idx
  on public.user_saved_filters (user_id, scope, name);

drop trigger if exists set_user_saved_filters_updated_at on public.user_saved_filters;
create trigger set_user_saved_filters_updated_at
before update on public.user_saved_filters
for each row execute function public.touch_user_configuration_updated_at();

alter table public.user_saved_filters enable row level security;

drop policy if exists user_saved_filters_select_own on public.user_saved_filters;
create policy user_saved_filters_select_own on public.user_saved_filters
for select to authenticated using (user_id = auth.uid());

drop policy if exists user_saved_filters_insert_own on public.user_saved_filters;
create policy user_saved_filters_insert_own on public.user_saved_filters
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists user_saved_filters_update_own on public.user_saved_filters;
create policy user_saved_filters_update_own on public.user_saved_filters
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_saved_filters_delete_own on public.user_saved_filters;
create policy user_saved_filters_delete_own on public.user_saved_filters
for delete to authenticated using (user_id = auth.uid());

revoke all on table public.user_saved_filters from public, anon;
grant select, insert, update, delete on table public.user_saved_filters to authenticated;

comment on table public.user_saved_filters is
  'Consultas nomeadas privadas, com filtros e organizacao opcional de colunas.';
