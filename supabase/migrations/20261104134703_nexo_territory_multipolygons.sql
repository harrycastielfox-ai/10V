begin;

alter table public.nexo_territorios
  add column if not exists poligonos jsonb not null default '[]'::jsonb;

update public.nexo_territorios
set poligonos = jsonb_build_array(pontos)
where jsonb_array_length(pontos) >= 3
  and poligonos = '[]'::jsonb;

alter table public.nexo_territorios
  drop constraint if exists nexo_territorios_poligonos_check;
alter table public.nexo_territorios
  add constraint nexo_territorios_poligonos_check
  check (jsonb_typeof(poligonos) = 'array');

comment on column public.nexo_territorios.poligonos is
  'Coleção de contornos independentes registrados manualmente para o mesmo local; pontos preserva o primeiro contorno para compatibilidade.';

commit;
