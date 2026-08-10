-- Restaura e documenta a RPC usada pela tela administrativa para alterar
-- a função institucional de um perfil. A escrita direta em profiles continua
-- revogada; toda autorização é validada dentro desta função.

alter table public.profiles
  drop constraint if exists profiles_funcao_institucional_check;

alter table public.profiles
  add constraint profiles_funcao_institucional_check
  check (
    funcao_institucional is null
    or funcao_institucional in (
      'juiz',
      'promotor',
      'delegado',
      'escrivao',
      'investigador',
      'agente_policia',
      'administrativo'
    )
  );

create or replace function public.admin_update_user_function(
  target_user_id uuid,
  new_function text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_role public.user_role;
  requester_status public.authorization_status;
  target_name text;
  target_current_function text;
  normalized_function text;
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

  if requester_role not in ('admin', 'delegado') then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  normalized_function := nullif(btrim(coalesce(new_function, '')), '');

  if normalized_function is not null and normalized_function not in (
    'juiz',
    'promotor',
    'delegado',
    'escrivao',
    'investigador',
    'agente_policia',
    'administrativo'
  ) then
    raise exception 'INVALID_INSTITUTIONAL_FUNCTION' using errcode = '22023';
  end if;

  select p.funcao_institucional, p.nome
    into target_current_function, target_name
  from public.profiles p
  where p.id = target_user_id
  for update;

  if not found then
    raise exception 'TARGET_PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Funções protegidas somente podem ser atribuídas, alteradas ou removidas
  -- por um administrador.
  if requester_role <> 'admin' and (
    normalized_function in ('juiz', 'promotor', 'delegado')
    or target_current_function in ('juiz', 'promotor', 'delegado')
  ) then
    raise exception 'PROTECTED_FUNCTION_ACCESS_DENIED' using errcode = '42501';
  end if;

  update public.profiles p
  set
    funcao_institucional = normalized_function,
    updated_at = now()
  where p.id = target_user_id;

  perform public.log_auditoria(
    'admin_update_function',
    'admin_usuarios',
    'profiles',
    target_user_id::text,
    'Atualizou a função institucional do usuário alvo: '
      || coalesce(target_name, target_user_id::text),
    jsonb_build_object(
      'target_user_id', target_user_id,
      'old_funcao_institucional', target_current_function,
      'new_funcao_institucional', normalized_function
    )
  );

  return normalized_function;
end;
$$;

revoke all on function public.admin_update_user_function(uuid, text) from public;
revoke all on function public.admin_update_user_function(uuid, text) from anon;
grant execute on function public.admin_update_user_function(uuid, text) to authenticated;

comment on function public.admin_update_user_function(uuid, text) is
  'Atualiza a função institucional de um perfil com autorização administrativa interna.';

notify pgrst, 'reload schema';
