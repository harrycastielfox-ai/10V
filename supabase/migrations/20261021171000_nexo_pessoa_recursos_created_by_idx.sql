-- Apoia as verificações de autoria usadas pelas políticas de atualização e exclusão.
create index if not exists nexo_pessoa_recursos_created_by_idx
  on public.nexo_pessoa_recursos (created_by)
  where deleted_at is null;
