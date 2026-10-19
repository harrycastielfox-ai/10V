-- Índices de suporte às chaves estrangeiras do NEXO, conforme Database Advisor.

create index if not exists nexo_organizacoes_created_by_idx
  on public.nexo_organizacoes (created_by) where created_by is not null;
create index if not exists nexo_organizacoes_updated_by_idx
  on public.nexo_organizacoes (updated_by) where updated_by is not null;
create index if not exists nexo_pessoas_endereco_idx
  on public.nexo_pessoas (endereco_id) where endereco_id is not null and deleted_at is null;
create index if not exists nexo_pessoas_created_by_idx
  on public.nexo_pessoas (created_by) where created_by is not null;
create index if not exists nexo_pessoas_updated_by_idx
  on public.nexo_pessoas (updated_by) where updated_by is not null;
create index if not exists nexo_vinculos_created_by_idx
  on public.nexo_vinculos (created_by) where created_by is not null;
create index if not exists nexo_vinculos_updated_by_idx
  on public.nexo_vinculos (updated_by) where updated_by is not null;
create index if not exists nexo_fotos_created_by_idx
  on public.nexo_fotos (created_by) where created_by is not null;
