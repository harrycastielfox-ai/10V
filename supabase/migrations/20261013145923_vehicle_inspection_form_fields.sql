-- Campos estruturados do formulario de vistoria, derivados do modelo operacional.
-- Os dados continuam derivados e vinculados ao veiculo original.

alter table public.vehicle_inspections
  add column if not exists police_report_number text,
  add column if not exists presentation_reason text,
  add column if not exists presenting_institution text,
  add column if not exists yard_type text,
  add column if not exists yard_location text,
  add column if not exists delivery_restricted boolean not null default false,
  add column if not exists checklist jsonb not null default '{}'::jsonb,
  add column if not exists linked_people jsonb not null default '[]'::jsonb,
  add column if not exists original_vehicle_data jsonb not null default '{}'::jsonb;

alter table public.vehicle_inspections
  drop constraint if exists vehicle_inspections_presentation_reason_check;
alter table public.vehicle_inspections
  add constraint vehicle_inspections_presentation_reason_check check (
    presentation_reason is null or presentation_reason in (
      'suspeita_adulteracao_sinais', 'suspeita_clonagem', 'recuperacao_furto_roubo',
      'trafico_drogas', 'acidente', 'local_crime', 'verificacao',
      'condutor_nao_habilitado', 'instrumento_crime', 'veiculo_abandonado', 'outros'
    )
  );

alter table public.vehicle_inspections
  drop constraint if exists vehicle_inspections_presenting_institution_check;
alter table public.vehicle_inspections
  add constraint vehicle_inspections_presenting_institution_check check (
    presenting_institution is null or presenting_institution in (
      'policia_militar', 'policia_civil', 'policia_rodoviaria_federal',
      'policia_federal', 'guarda_municipal', 'outros'
    )
  );

alter table public.vehicle_inspections
  drop constraint if exists vehicle_inspections_yard_type_check;
alter table public.vehicle_inspections
  add constraint vehicle_inspections_yard_type_check check (
    yard_type is null or yard_type in (
      'pericia', 'guincho', 'prf', 'detran', 'delegacia', 'disep', 'outros'
    )
  );

drop function if exists public.update_vehicle_inspection(uuid, date, text, text, jsonb, text);

create or replace function public.update_vehicle_inspection(
  p_inspection_id uuid,
  p_inspection_date date,
  p_location text,
  p_inspector_notes text,
  p_findings jsonb,
  p_change_reason text,
  p_police_report_number text default null,
  p_presentation_reason text default null,
  p_presenting_institution text default null,
  p_yard_type text default null,
  p_yard_location text default null,
  p_delivery_restricted boolean default false,
  p_checklist jsonb default '{}'::jsonb,
  p_linked_people jsonb default '[]'::jsonb,
  p_original_vehicle_data jsonb default '{}'::jsonb
)
returns public.vehicle_inspections
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current public.vehicle_inspections;
  v_next_version integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status_autorizacao = 'autorizado'
  ) then raise exception 'ACCESS_DENIED'; end if;

  select * into v_current from public.vehicle_inspections
  where id = p_inspection_id for update;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;

  v_next_version := v_current.current_version + 1;
  update public.vehicle_inspections
  set inspection_date = coalesce(p_inspection_date, inspection_date),
      location = nullif(btrim(p_location), ''),
      inspector_notes = nullif(btrim(p_inspector_notes), ''),
      police_report_number = nullif(btrim(p_police_report_number), ''),
      presentation_reason = nullif(btrim(p_presentation_reason), ''),
      presenting_institution = nullif(btrim(p_presenting_institution), ''),
      yard_type = nullif(btrim(p_yard_type), ''),
      yard_location = nullif(btrim(p_yard_location), ''),
      delivery_restricted = coalesce(p_delivery_restricted, false),
      findings = coalesce(p_findings, '{}'::jsonb),
      checklist = coalesce(p_checklist, '{}'::jsonb),
      linked_people = coalesce(p_linked_people, '[]'::jsonb),
      original_vehicle_data = coalesce(p_original_vehicle_data, '{}'::jsonb),
      current_version = v_next_version,
      status = 'rascunho',
      updated_by = auth.uid()
  where id = p_inspection_id;

  insert into public.vehicle_inspection_versions (inspection_id, version, snapshot, change_reason, created_by)
  select p_inspection_id, v_next_version,
    jsonb_build_object(
      'vehicle_id', vehicle_id, 'inspection_date', inspection_date, 'location', location,
      'inspector_notes', inspector_notes, 'police_report_number', police_report_number,
      'presentation_reason', presentation_reason, 'presenting_institution', presenting_institution,
      'yard_type', yard_type, 'yard_location', yard_location,
      'delivery_restricted', delivery_restricted, 'findings', findings,
      'checklist', checklist, 'linked_people', linked_people,
      'original_vehicle_data', original_vehicle_data
    ), nullif(btrim(p_change_reason), ''), auth.uid()
  from public.vehicle_inspections where id = p_inspection_id;

  select * into v_current from public.vehicle_inspections where id = p_inspection_id;
  return v_current;
end;
$$;

revoke all on function public.update_vehicle_inspection(uuid, date, text, text, jsonb, text, text, text, text, text, text, boolean, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.update_vehicle_inspection(uuid, date, text, text, jsonb, text, text, text, text, text, text, boolean, jsonb, jsonb, jsonb) to authenticated;
