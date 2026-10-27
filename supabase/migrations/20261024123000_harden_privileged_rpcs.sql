-- Prepared from the production function signatures inspected on 2026-10-24.
-- This migration is intentionally not applied automatically. It closes a gap
-- where a user whose account was suspended could retain privileged RPC access.

create or replace function public.admin_update_user_access(
  target_user_id uuid,
  new_role public.user_role,
  new_status public.authorization_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_role public.user_role;
  requester_status public.authorization_status;
  target_current_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select p.cargo, p.status_autorizacao
    into requester_role, requester_status
  from public.profiles p
  where p.id = auth.uid();

  if requester_role is null or requester_status <> 'autorizado' then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if requester_role not in ('admin', 'delegado', 'atlas_access') then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  select p.cargo into target_current_role
  from public.profiles p
  where p.id = target_user_id
  for update;

  if target_current_role is null then
    raise exception 'TARGET_PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if target_user_id = auth.uid() and requester_role <> 'admin' then
    raise exception 'SELF_ELEVATION_DENIED' using errcode = '42501';
  end if;
  if requester_role <> 'admin' and target_current_role in ('admin', 'delegado') then
    raise exception 'ACCESS_DENIED_TARGET_ROLE' using errcode = '42501';
  end if;
  if requester_role <> 'admin' and new_role in ('admin', 'delegado') then
    raise exception 'ACCESS_DENIED_ROLE_ASSIGNMENT' using errcode = '42501';
  end if;
  if requester_role = 'atlas_access' and target_current_role = 'atlas_access' then
    raise exception 'ACCESS_DENIED_TARGET_ROLE' using errcode = '42501';
  end if;
  if requester_role = 'atlas_access' and new_role not in ('membro', 'sipi_access') then
    raise exception 'ACCESS_DENIED_ROLE_ASSIGNMENT' using errcode = '42501';
  end if;

  update public.profiles p
  set cargo = new_role, status_autorizacao = new_status, updated_at = now()
  where p.id = target_user_id;
end;
$$;

create or replace function public.list_profiles_for_admin()
returns table (
  id uuid, nome text, email text, login text, avatar_path text, telefone text,
  funcao_institucional text, cargo public.user_role,
  status_autorizacao public.authorization_status,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_role public.user_role;
  requester_status public.authorization_status;
  requester_function text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select p.cargo, p.status_autorizacao, p.funcao_institucional
    into requester_role, requester_status, requester_function
  from public.profiles p
  where p.id = auth.uid();

  if requester_role is null or requester_status <> 'autorizado' then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if requester_role not in ('admin', 'delegado', 'atlas_access')
     and requester_function is distinct from 'juiz' then
    raise exception 'INSUFFICIENT_PRIVILEGE' using errcode = '42501';
  end if;

  return query
  select p.id, p.nome, p.email, p.login, p.avatar_path, p.telefone,
    p.funcao_institucional, p.cargo, p.status_autorizacao, p.created_at, p.updated_at
  from public.profiles p
  where p.id = auth.uid()
     or requester_role = 'admin'
     or requester_function = 'juiz'
     or coalesce(p.funcao_institucional, '') not in ('juiz', 'delegado')
  order by p.created_at desc;
end;
$$;

create or replace function public.list_auditoria(p_limit integer default 100)
returns table (
  id uuid, executor_user_id uuid, executor_nome text, executor_email text,
  executor_login text, executor_avatar_path text, acao text, modulo text,
  entidade text, entidade_id text, descricao text, metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_role public.user_role;
  v_status public.authorization_status;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  select p.cargo, p.status_autorizacao into v_role, v_status
  from public.profiles p where p.id = auth.uid();
  if v_role is null or v_status <> 'autorizado' then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if v_role not in ('admin', 'delegado') then
    raise exception 'INSUFFICIENT_PRIVILEGE' using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 100), 1), 200);
  return query
  select a.id, a.executor_user_id, coalesce(a.executor_nome, p.nome),
    coalesce(a.executor_email, p.email), coalesce(a.executor_login, p.login),
    p.avatar_path, a.acao, a.modulo, a.entidade, a.entidade_id, a.descricao,
    a.metadata, a.created_at
  from public.auditoria a
  left join public.profiles p on p.id = a.executor_user_id
  order by a.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.list_auditoria_by_user(
  p_user_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid, executor_user_id uuid, executor_nome text, executor_email text,
  executor_login text, executor_avatar_path text, acao text, modulo text,
  entidade text, entidade_id text, descricao text, metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_role public.user_role;
  v_status public.authorization_status;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  select p.cargo, p.status_autorizacao into v_role, v_status
  from public.profiles p where p.id = auth.uid();
  if v_role is null or v_status <> 'autorizado' then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if v_role not in ('admin', 'delegado') then
    raise exception 'INSUFFICIENT_PRIVILEGE' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'INVALID_USER_ID' using errcode = '22023';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  return query
  select a.id, a.executor_user_id, coalesce(a.executor_nome, p.nome),
    coalesce(a.executor_email, p.email), coalesce(a.executor_login, p.login),
    p.avatar_path, a.acao, a.modulo, a.entidade, a.entidade_id, a.descricao,
    a.metadata, a.created_at
  from public.auditoria a
  left join public.profiles p on p.id = a.executor_user_id
  where a.executor_user_id = p_user_id
  order by a.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.list_auditoria_for_admin_user(
  p_user_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid, executor_user_id uuid, executor_nome text, executor_email text,
  executor_login text, executor_avatar_path text, acao text, modulo text,
  entidade text, entidade_id text, descricao text, metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_role public.user_role;
  v_status public.authorization_status;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  select p.cargo, p.status_autorizacao into v_role, v_status
  from public.profiles p where p.id = auth.uid();
  if v_role is null or v_status <> 'autorizado' then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if v_role not in ('admin', 'delegado') then
    raise exception 'INSUFFICIENT_PRIVILEGE' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'INVALID_USER_ID' using errcode = '22023';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  return query
  select a.id, a.executor_user_id, coalesce(a.executor_nome, p.nome),
    coalesce(a.executor_email, p.email), coalesce(a.executor_login, p.login),
    p.avatar_path, a.acao, a.modulo, a.entidade, a.entidade_id, a.descricao,
    a.metadata, a.created_at
  from public.auditoria a
  left join public.profiles p on p.id = a.executor_user_id
  where a.executor_user_id = p_user_id
     or a.entidade_id = p_user_id::text
     or a.metadata ->> 'target_user_id' = p_user_id::text
  order by a.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.admin_update_user_access(uuid, public.user_role, public.authorization_status) from public;
revoke all on function public.admin_update_user_access(uuid, public.user_role, public.authorization_status) from anon;
revoke all on function public.list_profiles_for_admin() from public;
revoke all on function public.list_profiles_for_admin() from anon;
revoke all on function public.list_auditoria(integer) from public;
revoke all on function public.list_auditoria(integer) from anon;
revoke all on function public.list_auditoria_by_user(uuid, integer) from public;
revoke all on function public.list_auditoria_by_user(uuid, integer) from anon;
revoke all on function public.list_auditoria_for_admin_user(uuid, integer) from public;
revoke all on function public.list_auditoria_for_admin_user(uuid, integer) from anon;

grant execute on function public.admin_update_user_access(uuid, public.user_role, public.authorization_status) to authenticated;
grant execute on function public.list_profiles_for_admin() to authenticated;
grant execute on function public.list_auditoria(integer) to authenticated;
grant execute on function public.list_auditoria_by_user(uuid, integer) to authenticated;
grant execute on function public.list_auditoria_for_admin_user(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
