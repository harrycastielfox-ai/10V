-- O acesso a procedimentos e movimentacoes sigilosas passa a ser uma
-- permissao individual. Cargo ou funcao institucional nao concedem mais
-- acesso automatico.

alter table public.profiles
  add column if not exists can_access_sigiloso boolean not null default false;

comment on column public.profiles.can_access_sigiloso is
  'Permissao individual para acessar procedimentos e movimentacoes sigilosas. Desligada por padrao.';

create or replace function public.current_user_can_access_inqueritos_sigilosos()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.status_autorizacao = 'autorizado'
      and p.can_access_sigiloso is true
  );
$$;

create or replace function public.current_user_can_access_representacoes_sigilosas()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.status_autorizacao = 'autorizado'
      and p.can_access_sigiloso is true
  );
$$;

comment on function public.current_user_can_access_inqueritos_sigilosos() is
  'Autoriza sigilo de procedimentos somente pela permissao individual do perfil autenticado.';

comment on function public.current_user_can_access_representacoes_sigilosas() is
  'Autoriza sigilo de movimentacoes somente pela permissao individual do perfil autenticado.';

revoke all on function public.current_user_can_access_inqueritos_sigilosos() from public;
revoke all on function public.current_user_can_access_inqueritos_sigilosos() from anon;
revoke all on function public.current_user_can_access_representacoes_sigilosas() from public;
revoke all on function public.current_user_can_access_representacoes_sigilosas() from anon;
grant execute on function public.current_user_can_access_inqueritos_sigilosos() to authenticated;
grant execute on function public.current_user_can_access_representacoes_sigilosas() to authenticated;

create or replace function public.admin_get_user_sigilo_access(p_target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_requester_role public.user_role;
  v_requester_status public.authorization_status;
  v_enabled boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select p.cargo, p.status_autorizacao
    into v_requester_role, v_requester_status
  from public.profiles as p
  where p.id = (select auth.uid());

  if v_requester_status is distinct from 'autorizado'
     or v_requester_role not in ('admin', 'delegado') then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  select p.can_access_sigiloso
    into v_enabled
  from public.profiles as p
  where p.id = p_target_user_id;

  if not found then
    raise exception 'TARGET_PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return v_enabled;
end;
$$;

create or replace function public.admin_update_user_sigilo_access(
  p_target_user_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester_role public.user_role;
  v_requester_status public.authorization_status;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  if p_enabled is null then
    raise exception 'INVALID_PERMISSION_VALUE' using errcode = '22004';
  end if;

  select p.cargo, p.status_autorizacao
    into v_requester_role, v_requester_status
  from public.profiles as p
  where p.id = (select auth.uid());

  if v_requester_status is distinct from 'autorizado'
     or v_requester_role not in ('admin', 'delegado') then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  update public.profiles as p
  set can_access_sigiloso = p_enabled
  where p.id = p_target_user_id;

  if not found then
    raise exception 'TARGET_PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return p_enabled;
end;
$$;

revoke all on function public.admin_get_user_sigilo_access(uuid) from public;
revoke all on function public.admin_get_user_sigilo_access(uuid) from anon;
revoke all on function public.admin_update_user_sigilo_access(uuid, boolean) from public;
revoke all on function public.admin_update_user_sigilo_access(uuid, boolean) from anon;
grant execute on function public.admin_get_user_sigilo_access(uuid) to authenticated;
grant execute on function public.admin_update_user_sigilo_access(uuid, boolean) to authenticated;

comment on function public.admin_get_user_sigilo_access(uuid) is
  'Consulta a permissao individual de sigilo de um perfil. Restrito a Admin e Delegado autorizados.';

comment on function public.admin_update_user_sigilo_access(uuid, boolean) is
  'Liga ou desliga a permissao individual de sigilo. Restrito a Admin e Delegado autorizados.';

-- Inclui a nova permissao na trilha de auditoria critica de perfis.
drop trigger if exists audit_profiles_access_changes on public.profiles;
create trigger audit_profiles_access_changes
after update of cargo, status_autorizacao, funcao_institucional, can_access_sigiloso
on public.profiles
for each row
when (
  old.cargo is distinct from new.cargo
  or old.status_autorizacao is distinct from new.status_autorizacao
  or old.funcao_institucional is distinct from new.funcao_institucional
  or old.can_access_sigiloso is distinct from new.can_access_sigiloso
)
execute function public.audit_critical_row_change();
