-- Modulo de Boletins de Ocorrencia.
-- Mantem o cadastro enxuto da planilha oficial e acrescenta apenas vinculos
-- opcionais com Inqueritos ou Representacoes.

begin;

create table if not exists public.boletins_ocorrencia (
  id uuid primary key default gen_random_uuid(),
  numero_bo text not null,
  infracao_penal text not null,
  diligencias_pendentes text,
  responsavel_nome text,
  observacao text,
  status text not null default 'Pendente',
  inquerito_id uuid references public.inqueritos(id) on delete set null,
  representacao_id uuid references public.representacoes(id) on delete set null,
  origem_registro text not null default 'sipi',
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint boletins_ocorrencia_numero_check check (btrim(numero_bo) <> ''),
  constraint boletins_ocorrencia_infracao_check check (btrim(infracao_penal) <> ''),
  constraint boletins_ocorrencia_status_check check (
    status in (
      'Pendente',
      'Em Andamento',
      'Agendada',
      'Aguardando Terceiros',
      'Concluida',
      'Cancelada',
      'Suspensa',
      'Aguardando Aprovacao/Revisao'
    )
  ),
  constraint boletins_ocorrencia_vinculo_unico_check check (
    num_nonnulls(inquerito_id, representacao_id) <= 1
  ),
  constraint boletins_ocorrencia_origem_check check (
    origem_registro in ('sipi', 'google_sheets', 'migrado')
  )
);

comment on table public.boletins_ocorrencia is
  'Cadastro operacional de B.O. baseado na planilha oficial da unidade.';

create unique index if not exists boletins_ocorrencia_numero_active_uidx
  on public.boletins_ocorrencia (lower(btrim(numero_bo)))
  where deleted_at is null;
create index if not exists boletins_ocorrencia_status_updated_idx
  on public.boletins_ocorrencia (status, updated_at desc, id desc)
  where deleted_at is null;
create index if not exists boletins_ocorrencia_updated_idx
  on public.boletins_ocorrencia (updated_at desc, id desc)
  where deleted_at is null;
create index if not exists boletins_ocorrencia_inquerito_idx
  on public.boletins_ocorrencia (inquerito_id)
  where deleted_at is null and inquerito_id is not null;
create index if not exists boletins_ocorrencia_representacao_idx
  on public.boletins_ocorrencia (representacao_id)
  where deleted_at is null and representacao_id is not null;
create index if not exists boletins_ocorrencia_created_by_idx
  on public.boletins_ocorrencia (created_by)
  where deleted_at is null and created_by is not null;
create index if not exists boletins_ocorrencia_search_trgm_idx
  on public.boletins_ocorrencia using gin (search_text extensions.gin_trgm_ops)
  where deleted_at is null;

create or replace function public.normalize_bo_search(p_value text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select trim(
    regexp_replace(
      translate(
        lower(coalesce(p_value, '')),
        'áàâãäéèêëíìîïóòôõöúùûüçñýÿ',
        'aaaaaeeeeiiiiooooouuuucnyy'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$function$;

revoke all on function public.normalize_bo_search(text) from public, anon;
grant execute on function public.normalize_bo_search(text) to authenticated;

create or replace function private.prepare_bo_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  new.numero_bo := btrim(new.numero_bo);
  new.infracao_penal := btrim(new.infracao_penal);
  new.diligencias_pendentes := nullif(btrim(new.diligencias_pendentes), '');
  new.responsavel_nome := nullif(btrim(new.responsavel_nome), '');
  new.observacao := nullif(btrim(new.observacao), '');
  new.search_text := public.normalize_bo_search(concat_ws(' ',
    new.numero_bo,
    new.infracao_penal,
    new.diligencias_pendentes,
    new.responsavel_nome,
    new.observacao,
    new.status
  ));
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$function$;

revoke all on function private.prepare_bo_row() from public, anon, authenticated, service_role;

drop trigger if exists prepare_bo_row on public.boletins_ocorrencia;
create trigger prepare_bo_row
before insert or update on public.boletins_ocorrencia
for each row execute function private.prepare_bo_row();

create or replace function public.current_user_can_access_bos()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.status_autorizacao = 'autorizado'
      and p.cargo <> 'membro'
  );
$function$;

create or replace function public.current_user_can_manage_bos()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.status_autorizacao = 'autorizado'
      and p.cargo in ('sipi_access', 'delegado', 'admin')
  );
$function$;

revoke all on function public.current_user_can_access_bos() from public, anon;
revoke all on function public.current_user_can_manage_bos() from public, anon;
grant execute on function public.current_user_can_access_bos() to authenticated;
grant execute on function public.current_user_can_manage_bos() to authenticated;

alter table public.boletins_ocorrencia enable row level security;

drop policy if exists boletins_ocorrencia_select_authorized on public.boletins_ocorrencia;
create policy boletins_ocorrencia_select_authorized
on public.boletins_ocorrencia for select to authenticated
using (deleted_at is null and (select public.current_user_can_access_bos()));

drop policy if exists boletins_ocorrencia_insert_authorized on public.boletins_ocorrencia;
create policy boletins_ocorrencia_insert_authorized
on public.boletins_ocorrencia for insert to authenticated
with check (
  (select public.current_user_can_manage_bos())
  and created_by = (select auth.uid())
);

drop policy if exists boletins_ocorrencia_update_authorized on public.boletins_ocorrencia;
create policy boletins_ocorrencia_update_authorized
on public.boletins_ocorrencia for update to authenticated
using (deleted_at is null and (select public.current_user_can_manage_bos()))
with check ((select public.current_user_can_manage_bos()));

revoke all on table public.boletins_ocorrencia from anon;
grant select, insert, update on table public.boletins_ocorrencia to authenticated;
grant select, insert, update, delete on table public.boletins_ocorrencia to service_role;

create or replace function public.soft_delete_bo(p_bo_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not (select public.current_user_can_manage_bos()) then
    raise exception 'bo_permission_denied' using errcode = '42501';
  end if;

  update public.boletins_ocorrencia
  set deleted_at = now()
  where id = p_bo_id and deleted_at is null;

  return found;
end;
$function$;

revoke all on function public.soft_delete_bo(uuid) from public, anon;
grant execute on function public.soft_delete_bo(uuid) to authenticated;

create or replace function private.audit_bo_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_actor_nome text;
  v_actor_email text;
  v_actor_login text;
  v_old_row jsonb := '{}'::jsonb;
  v_new_row jsonb := '{}'::jsonb;
  v_changed_fields jsonb := '[]'::jsonb;
  v_action text;
  v_entity_id text;
begin
  if v_actor_id is null then
    raise exception 'audit_actor_required' using errcode = '42501';
  end if;

  if tg_op <> 'INSERT' then v_old_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new_row := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(field_name order by field_name), '[]'::jsonb)
    into v_changed_fields
    from (
      select keys.field_name
      from jsonb_object_keys(v_new_row) keys(field_name)
      where (v_old_row -> keys.field_name) is distinct from (v_new_row -> keys.field_name)
        and keys.field_name not in ('search_text', 'updated_at', 'updated_by')
    ) changed;
    if jsonb_array_length(v_changed_fields) = 0 then return new; end if;
  end if;

  v_action := case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end;
  if tg_op = 'UPDATE'
    and (v_old_row ->> 'deleted_at') is null
    and (v_new_row ->> 'deleted_at') is not null then
    v_action := 'delete';
  end if;
  v_entity_id := coalesce(v_new_row ->> 'id', v_old_row ->> 'id');

  select p.nome, p.email, p.login
  into v_actor_nome, v_actor_email, v_actor_login
  from public.profiles p where p.id = v_actor_id;

  insert into public.auditoria (
    executor_user_id, executor_nome, executor_email, executor_login,
    acao, modulo, entidade, entidade_id, descricao, metadata,
    dados_anteriores, dados_novos
  ) values (
    v_actor_id, v_actor_nome, v_actor_email, v_actor_login,
    v_action, 'bo', 'boletim_ocorrencia', v_entity_id,
    case v_action
      when 'create' then 'Criou boletim de ocorrencia'
      when 'delete' then 'Excluiu boletim de ocorrencia'
      else 'Editou boletim de ocorrencia'
    end,
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'database_trigger',
      'operation', tg_op,
      'changed_fields', v_changed_fields,
      'numero_bo', coalesce(v_new_row ->> 'numero_bo', v_old_row ->> 'numero_bo')
    )),
    case when tg_op = 'INSERT' then null else v_old_row - 'search_text' end,
    case when tg_op = 'DELETE' then null else v_new_row - 'search_text' end
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function private.audit_bo_row_change() from public, anon, authenticated, service_role;

drop trigger if exists audit_bo_critical_changes on public.boletins_ocorrencia;
create trigger audit_bo_critical_changes
after insert or update or delete on public.boletins_ocorrencia
for each row execute function private.audit_bo_row_change();

commit;
