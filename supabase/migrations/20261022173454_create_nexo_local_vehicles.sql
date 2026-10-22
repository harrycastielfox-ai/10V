begin;

create table public.nexo_veiculos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid references public.nexo_pessoas(id) on delete cascade,
  organizacao_id uuid references public.nexo_organizacoes(id) on delete cascade,
  tipo text not null default 'automovel'
    check (tipo in ('automovel', 'motocicleta', 'caminhao', 'onibus', 'bicicleta', 'outro')),
  placa text,
  marca_modelo text not null check (btrim(marca_modelo) <> ''),
  ano_fabricacao integer,
  ano_modelo integer,
  cor text,
  renavam text,
  numero_motor text,
  chassi text,
  cidade_estado text,
  numero_carroceria text,
  proprietario_nome text,
  proprietario_documento text,
  situacao text check (
    situacao is null or situacao in (
      'regular', 'apreendido', 'liberado', 'adulterado', 'em_investigacao',
      'recuperado', 'periciado', 'pendente_identificacao'
    )
  ),
  detran_atualizado_em date,
  tipo_posse text not null default 'associado'
    check (tipo_posse in ('posse', 'uso_frequente', 'associado', 'apreendido', 'historico')),
  confianca integer not null default 50 check (confianca between 0 and 100),
  fonte_resumo text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint nexo_veiculo_local_owner_check
    check (num_nonnulls(pessoa_id, organizacao_id) = 1),
  constraint nexo_veiculo_local_identifier_check
    check (num_nonnulls(placa, renavam, numero_motor, chassi) >= 1),
  constraint nexo_veiculo_local_years_check check (
    (ano_fabricacao is null or ano_fabricacao between 1800 and 3000)
    and (ano_modelo is null or ano_modelo between 1800 and 3000)
  )
);

create index nexo_veiculos_pessoa_idx
  on public.nexo_veiculos (pessoa_id, created_at desc)
  where pessoa_id is not null and deleted_at is null;
create index nexo_veiculos_organizacao_idx
  on public.nexo_veiculos (organizacao_id, created_at desc)
  where organizacao_id is not null and deleted_at is null;
create index nexo_veiculos_identificadores_idx
  on public.nexo_veiculos (placa, renavam, numero_motor, chassi)
  where deleted_at is null;
create index nexo_veiculos_created_by_idx
  on public.nexo_veiculos (created_by)
  where created_by is not null;
create index nexo_veiculos_updated_by_idx
  on public.nexo_veiculos (updated_by)
  where updated_by is not null;

-- A versão anterior do cadastro rápido criava por engano uma ficha em
-- Veículos Apreendidos. Convertemos apenas os registros marcados pelo texto
-- exato daquela funcionalidade e preservamos seus dados dentro do NEXO.
insert into public.nexo_veiculos (
  pessoa_id, organizacao_id, tipo, placa, marca_modelo,
  ano_fabricacao, ano_modelo, cor, renavam, numero_motor, chassi,
  cidade_estado, numero_carroceria, proprietario_nome, proprietario_documento,
  situacao, detran_atualizado_em, tipo_posse, confianca, fonte_resumo,
  observacoes, created_at, updated_at, created_by, updated_by
)
select
  link.pessoa_id,
  link.organizacao_id,
  vehicle.vehicle_type,
  vehicle.plate,
  coalesce(nullif(btrim(vehicle.brand_model), ''), 'Veículo sem modelo informado'),
  vehicle.manufacture_year,
  vehicle.model_year,
  vehicle.color,
  vehicle.renavam,
  vehicle.engine_number,
  vehicle.chassis,
  nullif(substring(vehicle.observations from 'Cidade/Estado de referência: ([^\n]+)'), ''),
  nullif(substring(vehicle.observations from 'Número da carroceria: ([^\n]+)'), ''),
  nullif(
    regexp_replace(
      split_part(coalesce(vehicle.involved_people, ''), ' - Proprietário', 1),
      '^\(Outros:\)\s*',
      ''
    ),
    ''
  ),
  nullif(substring(vehicle.involved_people from 'CPF/CNPJ\s+(.+)$'), ''),
  vehicle.situation,
  case
    when substring(vehicle.observations from 'Última atualização informada do Detran: ([0-9]{4}-[0-9]{2}-[0-9]{2})') is not null
      then substring(vehicle.observations from 'Última atualização informada do Detran: ([0-9]{4}-[0-9]{2}-[0-9]{2})')::date
    else null
  end,
  link.tipo_posse,
  link.confianca,
  'Cadastro realizado diretamente no dossiê NEXO',
  null,
  least(link.created_at, vehicle.created_at),
  greatest(link.updated_at, vehicle.updated_at),
  coalesce(link.created_by, vehicle.created_by),
  coalesce(link.updated_by, vehicle.updated_by)
from public.nexo_veiculos_vinculos link
join public.vehicles vehicle on vehicle.id = link.veiculo_id
where link.deleted_at is null
  and vehicle.deleted_at is null
  and link.fonte_resumo = 'Cadastro rápido realizado no dossiê NEXO'
  and link.observacoes = 'Veículo criado e vinculado a partir do cadastro rápido.';

alter table public.nexo_veiculos_vinculos disable trigger audit_nexo_veiculos_vinculos;
update public.nexo_veiculos_vinculos
set deleted_at = now()
where deleted_at is null
  and fonte_resumo = 'Cadastro rápido realizado no dossiê NEXO'
  and observacoes = 'Veículo criado e vinculado a partir do cadastro rápido.';
alter table public.nexo_veiculos_vinculos enable trigger audit_nexo_veiculos_vinculos;

-- Remove da listagem de apreendidos somente a ficha criada pelo fluxo antigo,
-- sem tocar em veículos que ganharam qualquer outro vínculo ou dado operacional.
alter table public.vehicles disable trigger enforce_vehicle_privileged_changes;
alter table public.vehicles disable trigger audit_vehicle_critical_changes;
update public.vehicles vehicle
set deleted_at = now()
where vehicle.deleted_at is null
  and exists (
    select 1
    from public.nexo_veiculos_vinculos link
    where link.veiculo_id = vehicle.id
      and link.fonte_resumo = 'Cadastro rápido realizado no dossiê NEXO'
      and link.observacoes = 'Veículo criado e vinculado a partir do cadastro rápido.'
  )
  and not exists (
    select 1
    from public.nexo_veiculos_vinculos other_link
    where other_link.veiculo_id = vehicle.id
      and other_link.deleted_at is null
  )
  and not exists (select 1 from public.vehicle_photos photo where photo.vehicle_id = vehicle.id)
  and not exists (select 1 from public.vehicle_movements movement where movement.vehicle_id = vehicle.id)
  and not exists (
    select 1 from public.vehicle_inspections inspection where inspection.vehicle_id = vehicle.id
  )
  and vehicle.inquerito_id is null
  and vehicle.procedure_number is null
  and vehicle.police_report_number is null
  and vehicle.court_process_number is null;
alter table public.vehicles enable trigger audit_vehicle_critical_changes;
alter table public.vehicles enable trigger enforce_vehicle_privileged_changes;

create trigger prepare_nexo_veiculo
  before insert or update on public.nexo_veiculos
  for each row execute function private.prepare_nexo_row();
create trigger audit_nexo_veiculos
  after insert or update on public.nexo_veiculos
  for each row execute function private.audit_nexo_row_change();

alter table public.nexo_veiculos enable row level security;

create policy nexo_veiculos_select on public.nexo_veiculos
  for select to authenticated
  using (
    deleted_at is null
    and (select public.current_user_can_access_nexo())
  );
create policy nexo_veiculos_insert on public.nexo_veiculos
  for insert to authenticated
  with check (
    (select public.current_user_can_access_nexo())
    and created_by = (select auth.uid())
  );
create policy nexo_veiculos_update on public.nexo_veiculos
  for update to authenticated
  using (
    deleted_at is null
    and (select public.current_user_can_access_nexo())
  )
  with check (
    (select public.current_user_can_access_nexo())
    and updated_by = (select auth.uid())
  );

revoke all on public.nexo_veiculos from anon;
grant select, insert, update on public.nexo_veiculos to authenticated;

create or replace function public.soft_delete_nexo_veiculo(p_veiculo_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  target_cursor cursor for
    select id from public.nexo_veiculos
    where id = p_veiculo_id and deleted_at is null for update;
  target_id uuid;
begin
  if auth.uid() is null or not (select public.current_user_can_access_nexo()) then
    raise exception 'nexo_vehicle_permission_denied' using errcode = '42501';
  end if;

  open target_cursor;
  fetch target_cursor into target_id;
  if not found then
    close target_cursor;
    return false;
  end if;
  update public.nexo_veiculos set deleted_at = now() where current of target_cursor;
  close target_cursor;
  return true;
end;
$function$;

revoke all on function public.soft_delete_nexo_veiculo(uuid) from public, anon;
grant execute on function public.soft_delete_nexo_veiculo(uuid) to authenticated;

comment on table public.nexo_veiculos is
  'Fichas veiculares exclusivas de dossiês NEXO; não integram o cadastro de veículos apreendidos.';
comment on function public.soft_delete_nexo_veiculo(uuid) is
  'Remove logicamente uma ficha veicular exclusiva do NEXO preservando auditoria e histórico.';

commit;
