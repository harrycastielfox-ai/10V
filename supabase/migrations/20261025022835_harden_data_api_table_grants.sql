-- Replace legacy/default Data API grants with the minimum privileges used by
-- the current frontend. RLS remains the row-level authorization boundary.
--
-- This migration is intentionally limited to tables that are both used by the
-- application and missing explicit grants from the migration history.

revoke all on table public.nexo_pessoas from public, anon, authenticated;
revoke all on table public.nexo_organizacoes from public, anon, authenticated;
revoke all on table public.nexo_vinculos from public, anon, authenticated;
revoke all on table public.nexo_documentos_fontes from public, anon, authenticated;
revoke all on table public.nexo_documento_alegacoes from public, anon, authenticated;
revoke all on table public.vehicle_inspections from public, anon, authenticated;
revoke all on table public.vehicle_inspection_versions from public, anon, authenticated;

grant select, insert, update
  on table public.nexo_pessoas
  to authenticated;

grant select, insert, update
  on table public.nexo_organizacoes
  to authenticated;

grant select, insert, update
  on table public.nexo_vinculos
  to authenticated;

grant select, insert, delete
  on table public.nexo_documentos_fontes
  to authenticated;

grant select, insert, delete
  on table public.nexo_documento_alegacoes
  to authenticated;

-- Vistorias are written only through the transactional RPCs. Keeping direct
-- INSERT/UPDATE grants would let a browser session forge history rows or make
-- the current row disagree with its immutable snapshots.
grant select on table public.vehicle_inspections to authenticated;
grant select on table public.vehicle_inspection_versions to authenticated;

drop policy if exists vehicle_inspections_insert_authorized
  on public.vehicle_inspections;
drop policy if exists vehicle_inspections_update_authorized
  on public.vehicle_inspections;
drop policy if exists vehicle_inspection_versions_insert_authorized
  on public.vehicle_inspection_versions;
drop policy if exists vehicle_inspection_versions_update_authorized
  on public.vehicle_inspection_versions;

create or replace function public.create_vehicle_inspection(
  p_vehicle_id uuid,
  p_inspection_date date,
  p_location text default null,
  p_inspector_notes text default null,
  p_findings jsonb default '{}'::jsonb,
  p_police_report_number text default null,
  p_presentation_reason text default null,
  p_presenting_institution text default null,
  p_yard_type text default null,
  p_yard_location text default null,
  p_delivery_restricted boolean default false,
  p_checklist jsonb default '{}'::jsonb,
  p_linked_people jsonb default '[]'::jsonb,
  p_original_vehicle_data jsonb default '{}'::jsonb,
  p_bo_id uuid default null
)
returns public.vehicle_inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inspection public.vehicle_inspections;
  v_police_report_number text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- The previous SECURITY INVOKER implementation inherited the Vehicles RLS
  -- check (authorized and cargo <> membro) while resolving p_vehicle_id.
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status_autorizacao = 'autorizado'
      and p.cargo <> 'membro'
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.deleted_at is null
  ) then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;

  if p_bo_id is not null then
    -- Preserve the B.O. select policy that SECURITY INVOKER previously applied.
    if not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.status_autorizacao = 'autorizado'
        and p.cargo <> 'membro'
    ) then
      raise exception 'ACCESS_DENIED';
    end if;

    select bo.numero_bo into v_police_report_number
    from public.boletins_ocorrencia bo
    where bo.id = p_bo_id and bo.deleted_at is null;
    if not found then raise exception 'BO_NOT_FOUND'; end if;
  else
    v_police_report_number := nullif(btrim(p_police_report_number), '');
  end if;

  insert into public.vehicle_inspections (
    vehicle_id, inspection_date, location, inspector_notes, findings,
    bo_id, police_report_number, presentation_reason, presenting_institution,
    yard_type, yard_location, delivery_restricted, checklist, linked_people,
    original_vehicle_data, created_by, updated_by
  ) values (
    p_vehicle_id, coalesce(p_inspection_date, current_date), nullif(btrim(p_location), ''),
    nullif(btrim(p_inspector_notes), ''), coalesce(p_findings, '{}'::jsonb),
    p_bo_id, v_police_report_number, nullif(btrim(p_presentation_reason), ''),
    nullif(btrim(p_presenting_institution), ''), nullif(btrim(p_yard_type), ''),
    nullif(btrim(p_yard_location), ''), coalesce(p_delivery_restricted, false),
    coalesce(p_checklist, '{}'::jsonb), coalesce(p_linked_people, '[]'::jsonb),
    coalesce(p_original_vehicle_data, '{}'::jsonb), auth.uid(), auth.uid()
  ) returning * into v_inspection;

  insert into public.vehicle_inspection_versions (
    inspection_id, version, snapshot, change_reason, created_by
  ) values (
    v_inspection.id, 1,
    jsonb_build_object(
      'vehicle_id', v_inspection.vehicle_id,
      'inspection_date', v_inspection.inspection_date,
      'location', v_inspection.location,
      'inspector_notes', v_inspection.inspector_notes,
      'bo_id', v_inspection.bo_id,
      'police_report_number', v_inspection.police_report_number,
      'presentation_reason', v_inspection.presentation_reason,
      'presenting_institution', v_inspection.presenting_institution,
      'yard_type', v_inspection.yard_type,
      'yard_location', v_inspection.yard_location,
      'delivery_restricted', v_inspection.delivery_restricted,
      'findings', v_inspection.findings,
      'checklist', v_inspection.checklist,
      'linked_people', v_inspection.linked_people,
      'original_vehicle_data', v_inspection.original_vehicle_data
    ),
    'Criação do relatório', auth.uid()
  );

  return v_inspection;
end;
$$;

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
  p_original_vehicle_data jsonb default '{}'::jsonb,
  p_bo_id uuid default null
)
returns public.vehicle_inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.vehicle_inspections;
  v_next_version integer;
  v_police_report_number text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status_autorizacao = 'autorizado'
  ) then raise exception 'ACCESS_DENIED'; end if;

  select * into v_current from public.vehicle_inspections
  where id = p_inspection_id for update;
  if not found then raise exception 'INSPECTION_NOT_FOUND'; end if;

  if p_bo_id is not null then
    if not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.status_autorizacao = 'autorizado'
        and p.cargo <> 'membro'
    ) then
      raise exception 'ACCESS_DENIED';
    end if;

    select bo.numero_bo into v_police_report_number
    from public.boletins_ocorrencia bo
    where bo.id = p_bo_id and bo.deleted_at is null;
    if not found then raise exception 'BO_NOT_FOUND'; end if;
  else
    v_police_report_number := nullif(btrim(p_police_report_number), '');
  end if;

  v_next_version := v_current.current_version + 1;
  update public.vehicle_inspections
  set inspection_date = coalesce(p_inspection_date, inspection_date),
      location = nullif(btrim(p_location), ''),
      inspector_notes = nullif(btrim(p_inspector_notes), ''),
      bo_id = p_bo_id,
      police_report_number = v_police_report_number,
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

  insert into public.vehicle_inspection_versions (
    inspection_id, version, snapshot, change_reason, created_by
  )
  select p_inspection_id, v_next_version,
    jsonb_build_object(
      'vehicle_id', vehicle_id,
      'inspection_date', inspection_date,
      'location', location,
      'inspector_notes', inspector_notes,
      'bo_id', bo_id,
      'police_report_number', police_report_number,
      'presentation_reason', presentation_reason,
      'presenting_institution', presenting_institution,
      'yard_type', yard_type,
      'yard_location', yard_location,
      'delivery_restricted', delivery_restricted,
      'findings', findings,
      'checklist', checklist,
      'linked_people', linked_people,
      'original_vehicle_data', original_vehicle_data
    ), nullif(btrim(p_change_reason), ''), auth.uid()
  from public.vehicle_inspections where id = p_inspection_id;

  select * into v_current from public.vehicle_inspections where id = p_inspection_id;
  return v_current;
end;
$$;

alter function public.attach_vehicle_inspection_pdf(uuid, integer, text, text)
  security definer;
alter function public.attach_vehicle_inspection_pdf(uuid, integer, text, text)
  set search_path = '';

revoke all on function public.create_vehicle_inspection(
  uuid, date, text, text, jsonb, text, text, text, text, text, boolean, jsonb, jsonb, jsonb, uuid
) from public, anon, authenticated;
revoke all on function public.update_vehicle_inspection(
  uuid, date, text, text, jsonb, text, text, text, text, text, text, boolean, jsonb, jsonb, jsonb, uuid
) from public, anon, authenticated;
revoke all on function public.attach_vehicle_inspection_pdf(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.create_vehicle_inspection(
  uuid, date, text, text, jsonb, text, text, text, text, text, boolean, jsonb, jsonb, jsonb, uuid
) to authenticated;
grant execute on function public.update_vehicle_inspection(
  uuid, date, text, text, jsonb, text, text, text, text, text, text, boolean, jsonb, jsonb, jsonb, uuid
) to authenticated;
grant execute on function public.attach_vehicle_inspection_pdf(uuid, integer, text, text)
  to authenticated;
