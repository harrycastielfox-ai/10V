alter table public.nexo_fotos
  alter column pessoa_id drop not null;

alter table public.nexo_fotos
  add column if not exists organizacao_id uuid references public.nexo_organizacoes(id) on delete cascade;

alter table public.nexo_fotos
  drop constraint if exists nexo_fotos_owner_check;

alter table public.nexo_fotos
  add constraint nexo_fotos_owner_check check (
    (pessoa_id is not null and organizacao_id is null)
    or (pessoa_id is null and organizacao_id is not null)
  );

create index if not exists nexo_fotos_organizacao_idx
  on public.nexo_fotos (organizacao_id, created_at desc)
  where organizacao_id is not null;

create or replace function public.nexo_remover_organizacao(p_organizacao_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (select public.current_user_can_access_nexo()) then
    raise exception 'not authorized';
  end if;

  update public.nexo_organizacoes
  set deleted_at = now(), updated_at = now(), updated_by = auth.uid()
  where id = p_organizacao_id and deleted_at is null;

  if not found then return false; end if;

  update public.nexo_vinculos
  set deleted_at = now(), updated_at = now(), updated_by = auth.uid()
  where organizacao_id = p_organizacao_id and deleted_at is null;

  update public.nexo_territorios
  set deleted_at = now(), updated_at = now(), updated_by = auth.uid()
  where organizacao_id = p_organizacao_id and deleted_at is null;

  update public.nexo_veiculos_vinculos
  set deleted_at = now(), updated_at = now(), updated_by = auth.uid()
  where organizacao_id = p_organizacao_id and deleted_at is null;

  return true;
end;
$$;

revoke all on function public.nexo_remover_organizacao(uuid) from public, anon;
grant execute on function public.nexo_remover_organizacao(uuid) to authenticated;
