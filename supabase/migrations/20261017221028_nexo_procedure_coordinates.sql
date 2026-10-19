-- Georreferenciamento analítico do local do fato, sem alterar o procedimento original.
alter table public.nexo_procedimento_contextos
  add column latitude double precision,
  add column longitude double precision;

alter table public.nexo_procedimento_contextos
  add constraint nexo_procedimento_contextos_coordenadas_check check (
    (latitude is null and longitude is null)
    or (
      latitude is not null and longitude is not null
      and
      latitude between -90 and 90
      and longitude between -180 and 180
    )
  );

alter table public.nexo_procedimento_contextos
  drop constraint nexo_procedimento_contextos_dados_check;

alter table public.nexo_procedimento_contextos
  add constraint nexo_procedimento_contextos_dados_check check (
    data_fato is not null or hora_fato is not null or bairro is not null
    or (latitude is not null and longitude is not null)
  );

comment on column public.nexo_procedimento_contextos.latitude is
  'Latitude do local do fato marcada no mapa; sua origem é descrita em fonte.';
comment on column public.nexo_procedimento_contextos.longitude is
  'Longitude do local do fato marcada no mapa; sua origem é descrita em fonte.';
