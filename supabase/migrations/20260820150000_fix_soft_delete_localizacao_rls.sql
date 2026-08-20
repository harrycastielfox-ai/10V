-- Exclusão lógica em Localização, pelo mesmo caminho já usado nos B.O.
--
-- A policy de SELECT esconde a linha com deleted_at preenchido. Como o cliente
-- pede a linha alterada de volta, o UPDATE feito pelo próprio usuário não
-- conclui: a nova versão da linha deixa de ser visível e a operação é recusada
-- com "new row violates row-level security policy".
--
-- A função valida a permissão pelo JWT antes de executar e só então faz o
-- UPDATE controlado como proprietária, sem devolver a linha.

create or replace function public.soft_delete_localizacao_endereco(p_endereco_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not (select public.current_user_can_access_localizacao()) then
    raise exception 'localizacao_permission_denied' using errcode = '42501';
  end if;

  update public.localizacao_enderecos
  set deleted_at = now()
  where id = p_endereco_id
    and deleted_at is null;

  return found;
end;
$function$;

create or replace function public.soft_delete_localizacao_pessoa(p_pessoa_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not (select public.current_user_can_access_localizacao()) then
    raise exception 'localizacao_permission_denied' using errcode = '42501';
  end if;

  update public.localizacao_pessoas
  set deleted_at = now()
  where id = p_pessoa_id
    and deleted_at is null;

  return found;
end;
$function$;

revoke all on function public.soft_delete_localizacao_endereco(uuid) from public, anon;
revoke all on function public.soft_delete_localizacao_pessoa(uuid) from public, anon;
grant execute on function public.soft_delete_localizacao_endereco(uuid) to authenticated;
grant execute on function public.soft_delete_localizacao_pessoa(uuid) to authenticated;
