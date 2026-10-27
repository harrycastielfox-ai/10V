export const LOCAL_SEED_BRIDGE_FILENAME = "20261025000001_e2e_seed_bridge.sql";

// This SQL is materialized only inside the private .git/codex-recovery-e2e
// workspace. It is never copied into the project migration history and is
// callable only by the local service_role used by the synthetic test seed.
export const LOCAL_SEED_BRIDGE_SQL = `
create or replace function public.e2e_prepare_synthetic_profile(
  p_user_id uuid,
  p_nome text,
  p_email text,
  p_login text,
  p_cargo public.user_role,
  p_status public.authorization_status,
  p_funcao text,
  p_sigilo boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'E2E_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  if p_email not like '%@example.test'
     or p_login !~ '^[a-z]+\\.[a-z0-9]{8,20}$' then
    raise exception 'E2E_SYNTHETIC_IDENTITY_REQUIRED' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and u.email = p_email
  ) then
    raise exception 'E2E_AUTH_USER_REQUIRED' using errcode = '23503';
  end if;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);

  update public.profiles
  set nome = p_nome,
      email = p_email,
      login = p_login,
      cargo = p_cargo,
      status_autorizacao = p_status,
      funcao_institucional = p_funcao,
      can_access_sigiloso = p_sigilo,
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'E2E_PROFILE_TRIGGER_REQUIRED' using errcode = '23503';
  end if;
end;
$function$;

revoke all on function public.e2e_prepare_synthetic_profile(
  uuid,
  text,
  text,
  text,
  public.user_role,
  public.authorization_status,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.e2e_prepare_synthetic_profile(
  uuid,
  text,
  text,
  text,
  public.user_role,
  public.authorization_status,
  text,
  boolean
) to service_role;
`;
