drop policy if exists localizacao_enderecos_select on public.localizacao_enderecos;
drop policy if exists localizacao_enderecos_insert on public.localizacao_enderecos;
drop policy if exists localizacao_enderecos_update on public.localizacao_enderecos;
drop policy if exists localizacao_enderecos_nexo_select on public.localizacao_enderecos;
drop policy if exists localizacao_enderecos_nexo_insert on public.localizacao_enderecos;
drop policy if exists localizacao_enderecos_nexo_update on public.localizacao_enderecos;

create policy localizacao_enderecos_select
on public.localizacao_enderecos
for select
to authenticated
using (
  deleted_at is null
  and (
    (select public.current_user_can_access_localizacao())
    or (
      (select public.current_user_can_access_nexo())
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
  )
);

create policy localizacao_enderecos_insert
on public.localizacao_enderecos
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (select public.current_user_can_access_localizacao())
    or (select public.current_user_can_access_nexo())
  )
);

create policy localizacao_enderecos_update
on public.localizacao_enderecos
for update
to authenticated
using (
  deleted_at is null
  and (
    (select public.current_user_can_access_localizacao())
    or (
      (select public.current_user_can_access_nexo())
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
  )
)
with check (
  (select public.current_user_can_access_localizacao())
  or (
    (select public.current_user_can_access_nexo())
    and updated_by = (select auth.uid())
  )
);
