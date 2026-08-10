-- Corrige as policies de UPDATE usadas por exclusões suaves em Localização.
--
-- O trigger private.prepare_localizacao_row() já carimba updated_by = auth.uid()
-- nas atualizações. A policy anterior também exigia updated_by = auth.uid()
-- no WITH CHECK, mas em algumas execuções via PostgREST/Supabase o check
-- bloqueia a alteração antes do carimbo ser aceito, impedindo deleted_at.

drop policy if exists localizacao_enderecos_update on public.localizacao_enderecos;
create policy localizacao_enderecos_update on public.localizacao_enderecos
for update
to authenticated
using (
  deleted_at is null
  and (select public.current_user_can_access_localizacao())
)
with check ((select public.current_user_can_access_localizacao()));

drop policy if exists localizacao_pessoas_update on public.localizacao_pessoas;
create policy localizacao_pessoas_update on public.localizacao_pessoas
for update
to authenticated
using (
  deleted_at is null
  and (select public.current_user_can_access_localizacao())
)
with check ((select public.current_user_can_access_localizacao()));

grant update on table public.localizacao_enderecos, public.localizacao_pessoas to authenticated;
