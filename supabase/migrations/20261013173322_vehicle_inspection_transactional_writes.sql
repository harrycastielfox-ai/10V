-- Mantém criação, primeira versão e vinculação de PDF em operações atômicas.
-- Os objetos no Storage permanecem imutáveis; apenas o vínculo derivado é criado aqui.

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
  p_original_vehicle_data jsonb default '{}'::jsonb
)
returns public.vehicle_inspections
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inspection public.vehicle_inspections;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status_autorizacao = 'autorizado'
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.deleted_at is null
  ) then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;

  insert into public.vehicle_inspections (
    vehicle_id, inspection_date, location, inspector_notes, findings,
    police_report_number, presentation_reason, presenting_institution,
    yard_type, yard_location, delivery_restricted, checklist, linked_people,
    original_vehicle_data, created_by, updated_by
  ) values (
    p_vehicle_id, coalesce(p_inspection_date, current_date), nullif(btrim(p_location), ''),
    nullif(btrim(p_inspector_notes), ''), coalesce(p_findings, '{}'::jsonb),
    nullif(btrim(p_police_report_number), ''), nullif(btrim(p_presentation_reason), ''),
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

revoke all on function public.create_vehicle_inspection(uuid, date, text, text, jsonb, text, text, text, text, text, boolean, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_vehicle_inspection(uuid, date, text, text, jsonb, text, text, text, text, text, boolean, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.attach_vehicle_inspection_pdf(
  p_inspection_id uuid,
  p_version integer,
  p_storage_path text,
  p_pdf_sha256 text
)
returns public.vehicle_inspections
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inspection public.vehicle_inspections;
  v_version_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status_autorizacao = 'autorizado'
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  if nullif(btrim(p_storage_path), '') is null
    or p_pdf_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_PDF_REFERENCE';
  end if;

  select * into v_inspection
  from public.vehicle_inspections
  where id = p_inspection_id
  for update;

  if not found then
    raise exception 'INSPECTION_NOT_FOUND';
  end if;

  if v_inspection.current_version <> p_version then
    raise exception 'INSPECTION_VERSION_MISMATCH';
  end if;

  update public.vehicle_inspection_versions
  set pdf_storage_path = p_storage_path,
      pdf_sha256 = p_pdf_sha256
  where inspection_id = p_inspection_id
    and version = p_version
    and pdf_storage_path is null
    and pdf_sha256 is null
  returning id into v_version_id;

  if v_version_id is null then
    raise exception 'PDF_ALREADY_LINKED_OR_VERSION_NOT_FOUND';
  end if;

  update public.vehicle_inspections
  set pdf_storage_path = p_storage_path,
      pdf_sha256 = p_pdf_sha256,
      status = 'emitido',
      updated_by = auth.uid()
  where id = p_inspection_id
  returning * into v_inspection;

  return v_inspection;
end;
$$;

revoke all on function public.attach_vehicle_inspection_pdf(uuid, integer, text, text) from public, anon;
grant execute on function public.attach_vehicle_inspection_pdf(uuid, integer, text, text) to authenticated;
