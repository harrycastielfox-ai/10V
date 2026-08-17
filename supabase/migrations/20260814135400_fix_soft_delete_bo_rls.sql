-- A exclusao logica torna deleted_at nao nulo. A politica SELECT oculta essa
-- nova versao da linha e, por isso, uma funcao invoker nao consegue concluir
-- o UPDATE. A funcao continua validando o usuario pelo JWT antes de executar,
-- mas passa a realizar somente esse UPDATE controlado como proprietaria.
create or replace function public.soft_delete_bo(p_bo_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not (select public.current_user_can_manage_bos()) then
    raise exception 'bo_permission_denied' using errcode = '42501';
  end if;

  update public.boletins_ocorrencia
  set deleted_at = now()
  where id = p_bo_id
    and deleted_at is null;

  return found;
end;
$function$;

revoke all on function public.soft_delete_bo(uuid) from public, anon;
grant execute on function public.soft_delete_bo(uuid) to authenticated;
