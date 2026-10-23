-- Requisicoes vinculadas a procedimentos usam a tabela canonica de movimentacoes.
-- Os campos sao opcionais para manter a compatibilidade com os demais tipos.
alter table public.representacoes
  add column if not exists requisicao_origem text,
  add column if not exists requisicao_numero_documento text,
  add column if not exists requisicao_data_recebimento date,
  add column if not exists requisicao_prazo_dias integer,
  add column if not exists requisicao_conteudo text;

alter table public.representacoes
  drop constraint if exists representacoes_requisicao_origem_check,
  drop constraint if exists representacoes_requisicao_numero_documento_check,
  drop constraint if exists representacoes_requisicao_prazo_dias_check,
  drop constraint if exists representacoes_requisicao_conteudo_check;

alter table public.representacoes
  add constraint representacoes_requisicao_origem_check
    check (requisicao_origem is null or length(btrim(requisicao_origem)) between 1 and 120) not valid,
  add constraint representacoes_requisicao_numero_documento_check
    check (requisicao_numero_documento is null or length(btrim(requisicao_numero_documento)) <= 120) not valid,
  add constraint representacoes_requisicao_prazo_dias_check
    check (requisicao_prazo_dias is null or requisicao_prazo_dias between 1 and 3650) not valid,
  add constraint representacoes_requisicao_conteudo_check
    check (requisicao_conteudo is null or length(btrim(requisicao_conteudo)) between 1 and 5000) not valid;

comment on column public.representacoes.requisicao_origem is
  'Origem de uma requisicao vinculada ao procedimento.';
comment on column public.representacoes.requisicao_numero_documento is
  'Numero do oficio ou documento que originou a requisicao.';
comment on column public.representacoes.requisicao_data_recebimento is
  'Data em que a requisicao foi recebida.';
comment on column public.representacoes.requisicao_prazo_dias is
  'Prazo informado para atendimento da requisicao, em dias.';
comment on column public.representacoes.requisicao_conteudo is
  'Descricao do que foi requisitado, preservada separadamente das observacoes gerais.';
