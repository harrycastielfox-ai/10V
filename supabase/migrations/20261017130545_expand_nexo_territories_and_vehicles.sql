begin;

alter table public.nexo_territorios
  add column if not exists categoria text not null default 'area_influencia'
    check (categoria in (
      'area_influencia', 'ponto_venda', 'ponto_encontro', 'esconderijo',
      'deposito', 'rota_operacional', 'outro'
    )),
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists municipio text not null default 'Itabela',
  add column if not exists uf text not null default 'BA',
  add column if not exists ponto_referencia text,
  add column if not exists link_navegacao text;

alter table public.nexo_territorios drop constraint if exists nexo_territorios_pontos_check;
alter table public.nexo_territorios
  add constraint nexo_territorios_pontos_check
  check (jsonb_typeof(pontos) = 'array');

create table public.nexo_veiculos_vinculos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.vehicles(id) on delete restrict,
  pessoa_id uuid references public.nexo_pessoas(id) on delete cascade,
  organizacao_id uuid references public.nexo_organizacoes(id) on delete cascade,
  tipo_posse text not null default 'associado'
    check (tipo_posse in ('posse', 'uso_frequente', 'associado', 'apreendido', 'historico')),
  confianca integer not null default 0 check (confianca between 0 and 100),
  fonte_resumo text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint nexo_veiculo_owner_check check (num_nonnulls(pessoa_id, organizacao_id) = 1)
);

create unique index nexo_veiculos_vinculos_pessoa_unique
  on public.nexo_veiculos_vinculos (veiculo_id, pessoa_id)
  where pessoa_id is not null and deleted_at is null;
create unique index nexo_veiculos_vinculos_organizacao_unique
  on public.nexo_veiculos_vinculos (veiculo_id, organizacao_id)
  where organizacao_id is not null and deleted_at is null;
create index nexo_veiculos_vinculos_pessoa_idx
  on public.nexo_veiculos_vinculos (pessoa_id) where deleted_at is null;
create index nexo_veiculos_vinculos_organizacao_idx
  on public.nexo_veiculos_vinculos (organizacao_id) where deleted_at is null;
create index nexo_veiculos_vinculos_veiculo_idx
  on public.nexo_veiculos_vinculos (veiculo_id) where deleted_at is null;

create trigger prepare_nexo_veiculo_vinculo
  before insert or update on public.nexo_veiculos_vinculos
  for each row execute function private.prepare_nexo_row();
create trigger audit_nexo_veiculos_vinculos
  after insert or update on public.nexo_veiculos_vinculos
  for each row execute function private.audit_nexo_row_change();

alter table public.nexo_veiculos_vinculos enable row level security;

create policy nexo_veiculos_vinculos_select on public.nexo_veiculos_vinculos
  for select to authenticated
  using (
    deleted_at is null
    and (select public.current_user_can_access_nexo())
    and (select public.current_user_can_access_vehicles())
  );
create policy nexo_veiculos_vinculos_insert on public.nexo_veiculos_vinculos
  for insert to authenticated
  with check (
    (select public.current_user_can_access_nexo())
    and (select public.current_user_can_access_vehicles())
    and created_by = (select auth.uid())
  );
create policy nexo_veiculos_vinculos_update on public.nexo_veiculos_vinculos
  for update to authenticated
  using (
    deleted_at is null
    and (select public.current_user_can_access_nexo())
    and (select public.current_user_can_access_vehicles())
  )
  with check (
    (select public.current_user_can_access_nexo())
    and (select public.current_user_can_access_vehicles())
    and updated_by = (select auth.uid())
  );

revoke all on public.nexo_veiculos_vinculos from anon;
grant select, insert, update on public.nexo_veiculos_vinculos to authenticated;

comment on table public.nexo_veiculos_vinculos is
  'Vínculos auditáveis entre veículos já cadastrados e pessoas ou facções do NEXO.';
comment on column public.nexo_territorios.categoria is
  'Finalidade operacional informada para o local; não representa constatação automática.';

commit;
