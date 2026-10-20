-- Endereços são compartilhados com o módulo Localização. Estas políticas
-- permitem ao operador do NEXO criar um endereço próprio e consultar/editar
-- somente o que ele criou ou o que já está vinculado a uma ficha do NEXO.

create policy localizacao_enderecos_nexo_select
on public.localizacao_enderecos
for select
to authenticated
using (
  deleted_at is null
  and (select public.current_user_can_access_nexo())
  and (
    created_by = (select auth.uid())
    or exists (
      select 1
      from public.nexo_pessoas pessoa
      where pessoa.endereco_id = localizacao_enderecos.id
        and pessoa.deleted_at is null
    )
  )
);

create policy localizacao_enderecos_nexo_insert
on public.localizacao_enderecos
for insert
to authenticated
with check (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
);

create policy localizacao_enderecos_nexo_update
on public.localizacao_enderecos
for update
to authenticated
using (
  deleted_at is null
  and (select public.current_user_can_access_nexo())
  and (
    created_by = (select auth.uid())
    or exists (
      select 1
      from public.nexo_pessoas pessoa
      where pessoa.endereco_id = localizacao_enderecos.id
        and pessoa.deleted_at is null
    )
  )
)
with check (
  (select public.current_user_can_access_nexo())
  and updated_by = (select auth.uid())
);
