-- Permite que um mesmo B.O. seja relacionado simultaneamente a um Inquérito
-- e a uma Representação. As duas chaves estrangeiras e seus índices permanecem.

begin;

alter table public.boletins_ocorrencia
  drop constraint if exists boletins_ocorrencia_vinculo_unico_check;

comment on column public.boletins_ocorrencia.inquerito_id is
  'Inquérito relacionado ao B.O.; pode coexistir com uma Representação.';

comment on column public.boletins_ocorrencia.representacao_id is
  'Representação relacionada ao B.O.; pode coexistir com um Inquérito.';

commit;
