-- Auditoria transacional do modulo de relatorios de vistoria.
-- O evento registra a operacao e metadados tecnicos, sem copiar notas ou o PDF.

create or replace function public.audit_vehicle_inspection_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_nome text;
  v_actor_email text;
  v_actor_login text;
  v_old_row jsonb := '{}'::jsonb;
  v_new_row jsonb := '{}'::jsonb;
  v_changed_fields jsonb := '[]'::jsonb;
  v_action text;
  v_description text;
  v_entity_id text;
begin
  if v_actor_id is null then
    raise exception 'audit_actor_required' using errcode = '42501';
  end if;

  if tg_op <> 'INSERT' then
    v_old_row := to_jsonb(old);
  end if;

  if tg_op <> 'DELETE' then
    v_new_row := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(changed.field_name order by changed.field_name), '[]'::jsonb)
      into v_changed_fields
    from (
      select fields.field_name
      from jsonb_object_keys(v_new_row) as fields(field_name)
      where fields.field_name <> 'updated_at'
        and (v_old_row -> fields.field_name) is distinct from (v_new_row -> fields.field_name)
    ) as changed;

    if jsonb_array_length(v_changed_fields) = 0 then
      return new;
    end if;
  end if;

  v_action := case tg_op
    when 'INSERT' then 'create'
    when 'DELETE' then 'delete'
    else 'update'
  end;
  v_entity_id := coalesce(v_new_row ->> 'id', v_old_row ->> 'id');
  v_description := case v_action
    when 'create' then 'Criou relatório de vistoria'
    when 'delete' then 'Excluiu relatório de vistoria'
    else 'Atualizou relatório de vistoria'
  end;

  select p.nome, p.email, p.login
    into v_actor_nome, v_actor_email, v_actor_login
  from public.profiles p
  where p.id = v_actor_id;

  insert into public.auditoria (
    executor_user_id,
    executor_nome,
    executor_email,
    executor_login,
    acao,
    modulo,
    entidade,
    entidade_id,
    descricao,
    metadata
  ) values (
    v_actor_id,
    v_actor_nome,
    v_actor_email,
    v_actor_login,
    v_action,
    'vistorias',
    'vehicle_inspection',
    v_entity_id,
    v_description,
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'database_trigger',
      'operation', tg_op,
      'changed_fields', v_changed_fields,
      'vehicle_id', coalesce(v_new_row ->> 'vehicle_id', v_old_row ->> 'vehicle_id'),
      'status', coalesce(v_new_row ->> 'status', v_old_row ->> 'status'),
      'current_version', coalesce(v_new_row ->> 'current_version', v_old_row ->> 'current_version'),
      'pdf_attached', coalesce(v_new_row ->> 'pdf_storage_path', v_old_row ->> 'pdf_storage_path') is not null,
      'pdf_hash_present', coalesce(v_new_row ->> 'pdf_sha256', v_old_row ->> 'pdf_sha256') is not null
    ))
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_vehicle_inspection_change() from public, anon, authenticated;

drop trigger if exists audit_vehicle_inspections_changes on public.vehicle_inspections;
create trigger audit_vehicle_inspections_changes
after insert or update or delete on public.vehicle_inspections
for each row execute function public.audit_vehicle_inspection_change();

create or replace function public.audit_vehicle_inspection_version_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_nome text;
  v_actor_email text;
  v_actor_login text;
begin
  if v_actor_id is null then
    raise exception 'audit_actor_required' using errcode = '42501';
  end if;

  select p.nome, p.email, p.login
    into v_actor_nome, v_actor_email, v_actor_login
  from public.profiles p
  where p.id = v_actor_id;

  insert into public.auditoria (
    executor_user_id,
    executor_nome,
    executor_email,
    executor_login,
    acao,
    modulo,
    entidade,
    entidade_id,
    descricao,
    metadata
  ) values (
    v_actor_id,
    v_actor_nome,
    v_actor_email,
    v_actor_login,
    'create_version',
    'vistorias',
    'vehicle_inspection_version',
    new.inspection_id::text,
    'Criou versão de relatório de vistoria',
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'database_trigger',
      'version', new.version,
      'has_change_reason', nullif(btrim(coalesce(new.change_reason, '')), '') is not null,
      'pdf_attached', new.pdf_storage_path is not null,
      'pdf_hash_present', new.pdf_sha256 is not null
    ))
  );
  return new;
end;
$$;

revoke all on function public.audit_vehicle_inspection_version_create() from public, anon, authenticated;

drop trigger if exists audit_vehicle_inspection_versions_create on public.vehicle_inspection_versions;
create trigger audit_vehicle_inspection_versions_create
after insert on public.vehicle_inspection_versions
for each row execute function public.audit_vehicle_inspection_version_create();

comment on function public.audit_vehicle_inspection_change() is
  'Audita criacao, revisao e anexacao de PDF de relatorios de vistoria sem persistir conteudo sensivel.';
comment on function public.audit_vehicle_inspection_version_create() is
  'Audita a criacao de snapshots versionados de relatorios de vistoria.';
