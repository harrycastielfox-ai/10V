-- Requisicoes judiciais/ministeriais sao registradas separadamente na interface,
-- mas compartilham a tabela de registros processuais. O valor normalizado precisa
-- ser aceito pela restricao que protege a classificacao canonica.
alter table public.representacoes
  drop constraint if exists representacoes_tipo_normalizado_check;

alter table public.representacoes
  add constraint representacoes_tipo_normalizado_check
  check (
    tipo_normalizado is null
    or tipo_normalizado = any (
      array[
        'prisao_preventiva',
        'prisao_temporaria',
        'busca_apreensao',
        'medida_protetiva',
        'interceptacao',
        'quebra_sigilo',
        'representacao',
        'requisicao_judicial_ministerial',
        'outros'
      ]::text[]
    )
  ) not valid;

alter table public.representacoes
  validate constraint representacoes_tipo_normalizado_check;

comment on constraint representacoes_tipo_normalizado_check on public.representacoes is
  'Restringe o tipo normalizado aos valores canonicos, incluindo requisicao judicial/ministerial.';
