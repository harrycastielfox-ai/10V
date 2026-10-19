begin;

-- Áreas de influência são hipóteses registradas pelo operador, não deduções a partir
-- do endereço de pessoas. Os pontos são percentuais da imagem-base do painel.
create table public.nexo_territorios (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.nexo_organizacoes(id) on delete cascade,
  bairro text not null check (btrim(bairro) <> ''),
  classificacao text not null default 'em_analise'
    check (classificacao in ('confirmado', 'indicativo', 'disputado', 'historico', 'em_analise')),
  confianca integer not null default 0 check (confianca between 0 and 100),
  fonte_resumo text,
  observacoes text,
  pontos jsonb not null check (jsonb_typeof(pontos) = 'array' and jsonb_array_length(pontos) >= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  deleted_at timestamptz
);

create index nexo_territorios_organizacao_idx on public.nexo_territorios (organizacao_id)
  where deleted_at is null;
create index nexo_territorios_bairro_idx on public.nexo_territorios (lower(bairro))
  where deleted_at is null;
create index nexo_territorios_created_by_idx on public.nexo_territorios (created_by)
  where created_by is not null;
create index nexo_territorios_updated_by_idx on public.nexo_territorios (updated_by)
  where updated_by is not null;

create trigger prepare_nexo_territorio before insert or update on public.nexo_territorios
  for each row execute function private.prepare_nexo_row();
create trigger audit_nexo_territorios after insert or update on public.nexo_territorios
  for each row execute function private.audit_nexo_row_change();

alter table public.nexo_territorios enable row level security;

create policy nexo_territorios_select on public.nexo_territorios
  for select to authenticated
  using (deleted_at is null and (select public.current_user_can_access_nexo()));
create policy nexo_territorios_insert on public.nexo_territorios
  for insert to authenticated
  with check ((select public.current_user_can_access_nexo()) and created_by = (select auth.uid()));
create policy nexo_territorios_update on public.nexo_territorios
  for update to authenticated
  using (deleted_at is null and (select public.current_user_can_access_nexo()))
  with check ((select public.current_user_can_access_nexo()) and updated_by = (select auth.uid()));

revoke all on public.nexo_territorios from anon;
grant select, insert, update on public.nexo_territorios to authenticated;

comment on table public.nexo_territorios is
  'Áreas de influência registradas manualmente; polígonos ilustrativos sobre imagem-base e classificação de evidência.';

commit;
