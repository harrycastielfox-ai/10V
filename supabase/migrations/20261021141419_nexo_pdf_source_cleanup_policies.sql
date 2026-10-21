-- Permite limpar uma fonte recém-criada se a etapa de alegações falhar.
drop policy if exists nexo_documentos_fontes_delete on public.nexo_documentos_fontes;
create policy nexo_documentos_fontes_delete on public.nexo_documentos_fontes
for delete to authenticated using (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
);

drop policy if exists nexo_documento_alegacoes_delete on public.nexo_documento_alegacoes;
create policy nexo_documento_alegacoes_delete on public.nexo_documento_alegacoes
for delete to authenticated using (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
);
