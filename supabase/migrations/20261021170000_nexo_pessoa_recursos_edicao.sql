-- Permite corrigir a observação de um recurso sem substituir o PDF original.

drop policy if exists nexo_pessoa_recursos_update on public.nexo_pessoa_recursos;
create policy nexo_pessoa_recursos_update on public.nexo_pessoa_recursos
for update to authenticated
using (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
  and deleted_at is null
)
with check (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
  and deleted_at is null
  and exists (
    select 1 from public.nexo_pessoas pessoa
    where pessoa.id = pessoa_id and pessoa.deleted_at is null
  )
);

grant update (observacao) on table public.nexo_pessoa_recursos to authenticated;
