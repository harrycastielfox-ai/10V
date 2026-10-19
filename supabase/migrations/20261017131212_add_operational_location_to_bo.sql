begin;

alter table public.boletins_ocorrencia
  add column if not exists local_categoria text
    check (local_categoria is null or local_categoria in (
      'area_influencia', 'ponto_venda', 'ponto_encontro', 'esconderijo',
      'deposito', 'rota_operacional', 'outro'
    )),
  add column if not exists local_logradouro text,
  add column if not exists local_numero text,
  add column if not exists local_bairro text,
  add column if not exists local_municipio text,
  add column if not exists local_uf text,
  add column if not exists local_ponto_referencia text,
  add column if not exists local_link_navegacao text;

comment on column public.boletins_ocorrencia.local_categoria is
  'Classificação operacional informada do local do fato; não constitui conclusão automática.';

commit;
