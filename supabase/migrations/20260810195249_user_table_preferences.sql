create table if not exists public.user_table_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  scope text not null check (length(btrim(scope)) between 2 and 60),
  columns jsonb not null default '[]'::jsonb check (jsonb_typeof(columns) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (user_id, scope)
);

create or replace function public.touch_user_configuration_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_user_configuration_updated_at() from public, anon, authenticated;

drop trigger if exists set_user_table_preferences_updated_at on public.user_table_preferences;
create trigger set_user_table_preferences_updated_at
before update on public.user_table_preferences
for each row execute function public.touch_user_configuration_updated_at();

alter table public.user_table_preferences enable row level security;

drop policy if exists user_table_preferences_select_own on public.user_table_preferences;
create policy user_table_preferences_select_own on public.user_table_preferences
for select to authenticated using (user_id = auth.uid());

drop policy if exists user_table_preferences_insert_own on public.user_table_preferences;
create policy user_table_preferences_insert_own on public.user_table_preferences
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists user_table_preferences_update_own on public.user_table_preferences;
create policy user_table_preferences_update_own on public.user_table_preferences
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_table_preferences_delete_own on public.user_table_preferences;
create policy user_table_preferences_delete_own on public.user_table_preferences
for delete to authenticated using (user_id = auth.uid());

revoke all on table public.user_table_preferences from public, anon;
grant select, insert, update, delete on table public.user_table_preferences to authenticated;

comment on table public.user_table_preferences is
  'Preferencias privadas de visibilidade, ordem e largura das tabelas por usuario.';
