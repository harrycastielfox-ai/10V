create or replace function public.nexo_remover_pessoa(p_pessoa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (select public.current_user_can_access_nexo()) then
    raise exception 'not authorized';
  end if;

  update public.nexo_pessoas
  set deleted_at = now(), updated_at = now(), updated_by = auth.uid()
  where id = p_pessoa_id and deleted_at is null;

  if not found then
    raise exception 'person not found or already removed';
  end if;

  update public.nexo_vinculos
  set deleted_at = now(), updated_at = now(), updated_by = auth.uid()
  where pessoa_id = p_pessoa_id and deleted_at is null;
end;
$$;

revoke all on function public.nexo_remover_pessoa(uuid) from public, anon;
grant execute on function public.nexo_remover_pessoa(uuid) to authenticated;
