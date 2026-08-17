-- Corrige rótulos do catálogo que foram gravados com UTF-8 interpretado como Latin-1.
-- A identificação por escopo/slug mantém a migração determinística sem depender de UUIDs.
update public.procedural_tags
set
  name = case slug
    when 'crianca-e-adolescente' then 'Criança e Adolescente'
    when 'trafico-de-drogas' then 'Tráfico de Drogas'
    when 'transito' then 'Trânsito'
    when 'violencia-domestica-e-familiar' then 'Violência Doméstica e Familiar'
    else name
  end,
  updated_at = now()
where scope = 'inquerito_gravidade'
  and slug in (
    'crianca-e-adolescente',
    'trafico-de-drogas',
    'transito',
    'violencia-domestica-e-familiar'
  );
