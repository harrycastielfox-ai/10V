-- NEXO contem inteligencia policial sensivel. Centraliza a autorizacao usada
-- pelas politicas RLS e RPCs para permitir acesso apenas a delegado e admin.
create or replace function public.current_user_can_access_nexo()
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
      and p.cargo in ('delegado', 'admin')
  );
$function$;

revoke all on function public.current_user_can_access_nexo() from public, anon;
grant execute on function public.current_user_can_access_nexo() to authenticated;

comment on function public.current_user_can_access_nexo() is
  'Autoriza acesso ao NEXO exclusivamente para perfis autorizados de delegado ou administrador.';
