-- Tipificação de trânsito e de violência doméstica passa dos 120 caracteres
-- com facilidade, e o corte deixava o essencial de fora — o nome terminava no
-- meio da conduta. O limite sobe para 300 — há tipificação de 261 caracteres importada do
-- catálogo oficial, e ela precisa caber. O slug acompanha.

alter table public.procedural_tags
  drop constraint if exists procedural_tags_name_check;

alter table public.procedural_tags
  add constraint procedural_tags_name_check
  check (length(btrim(name)) between 2 and 300);

alter table public.procedural_tags
  drop constraint if exists procedural_tags_slug_check;

alter table public.procedural_tags
  add constraint procedural_tags_slug_check
  check (length(btrim(slug)) between 2 and 400);
