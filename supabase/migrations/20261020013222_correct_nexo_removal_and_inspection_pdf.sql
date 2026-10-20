-- Lock a visible row first, then update that cursor without requesting the
-- removed row through SELECT again. Both steps keep the caller's RLS policies.
create or replace function public.soft_delete_nexo_territorio(p_territorio_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  target_cursor cursor for
    select id from public.nexo_territorios
    where id = p_territorio_id and deleted_at is null for update;
  target_id uuid;
begin
  if auth.uid() is null or not (select public.current_user_can_access_nexo()) then
    raise exception 'nexo_permission_denied' using errcode = '42501';
  end if;

  open target_cursor;
  fetch target_cursor into target_id;
  if not found then
    close target_cursor;
    return false;
  end if;
  update public.nexo_territorios set deleted_at = now() where current of target_cursor;
  close target_cursor;
  return true;
end;
$function$;

create or replace function public.soft_delete_nexo_veiculo_vinculo(p_vinculo_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  target_cursor cursor for
    select id from public.nexo_veiculos_vinculos
    where id = p_vinculo_id and deleted_at is null for update;
  target_id uuid;
begin
  if auth.uid() is null
    or not (select public.current_user_can_access_nexo())
    or not (select public.current_user_can_access_vehicles()) then
    raise exception 'nexo_vehicle_link_permission_denied' using errcode = '42501';
  end if;

  open target_cursor;
  fetch target_cursor into target_id;
  if not found then
    close target_cursor;
    return false;
  end if;
  update public.nexo_veiculos_vinculos set deleted_at = now() where current of target_cursor;
  close target_cursor;
  return true;
end;
$function$;

revoke all on function public.soft_delete_nexo_territorio(uuid) from public, anon;
revoke all on function public.soft_delete_nexo_veiculo_vinculo(uuid) from public, anon;
grant execute on function public.soft_delete_nexo_territorio(uuid) to authenticated;
grant execute on function public.soft_delete_nexo_veiculo_vinculo(uuid) to authenticated;

-- A new inspection revision must not advertise the PDF from the old revision.
-- Historical PDF paths and hashes remain on vehicle_inspection_versions.
create or replace function private.invalidate_vehicle_inspection_pdf()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.current_version is distinct from old.current_version then
    new.pdf_storage_path := null;
    new.pdf_sha256 := null;
  end if;
  return new;
end;
$function$;

revoke all on function private.invalidate_vehicle_inspection_pdf() from public, anon, authenticated;
create trigger invalidate_vehicle_inspection_pdf
  before update of current_version on public.vehicle_inspections
  for each row execute function private.invalidate_vehicle_inspection_pdf();
