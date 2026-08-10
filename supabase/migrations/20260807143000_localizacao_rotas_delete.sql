-- Permite remover rotas salvas do modulo Localizacao Operacional.
-- Enderecos e pessoas vinculadas permanecem preservados por FKs set null/cascade
-- apenas no sentido inverso; apagar a rota remove somente o trajeto salvo.

drop policy if exists localizacao_rotas_delete on public.localizacao_rotas_salvas;
create policy localizacao_rotas_delete
on public.localizacao_rotas_salvas
for delete
to authenticated
using ((select public.current_user_can_access_localizacao()));

grant delete on table public.localizacao_rotas_salvas to authenticated;
