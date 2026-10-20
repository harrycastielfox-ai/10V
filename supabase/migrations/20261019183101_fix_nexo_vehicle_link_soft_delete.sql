-- A policy de SELECT dos vínculos veiculares oculta registros com deleted_at.
-- Isso impede que um UPDATE comum conclua o soft delete, pois a nova versão da
-- linha deixa de ser visível e o Postgres a rejeita pela RLS.
--
-- A RPC segue o padrão dos demais soft deletes do projeto: valida as duas
-- permissões pelo JWT e executa somente a transição controlada para removido.
create or replace function public.soft_delete_nexo_veiculo_vinculo(p_vinculo_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
    or not (select public.current_user_can_access_nexo())
    or not (select public.current_user_can_access_vehicles()) then
    raise exception 'nexo_vehicle_link_permission_denied' using errcode = '42501';
  end if;

  update public.nexo_veiculos_vinculos
  set deleted_at = now()
  where id = p_vinculo_id
    and deleted_at is null;

  return found;
end;
$function$;

revoke all on function public.soft_delete_nexo_veiculo_vinculo(uuid) from public, anon;
grant execute on function public.soft_delete_nexo_veiculo_vinculo(uuid) to authenticated;

comment on function public.soft_delete_nexo_veiculo_vinculo(uuid) is
  'Remove logicamente um vínculo veicular do NEXO após validar acesso ao NEXO e a veículos.';
