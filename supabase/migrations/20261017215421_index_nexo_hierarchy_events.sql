create index nexo_hierarquia_eventos_autor_idx
  on public.nexo_hierarquia_eventos (autor_id) where autor_id is not null;
create index nexo_hierarquia_eventos_vinculo_idx
  on public.nexo_hierarquia_eventos (vinculo_id);
