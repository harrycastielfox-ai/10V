-- Normaliza tipificacoes legadas que chegaram da planilha em um unico texto.
-- A virgula so e' separador quando o trecho seguinte comeca por codigo numerico
-- (ex.: "..., 57: AMEACA"). Virgulas juridicas como "ART. 121, § 2º" permanecem.

alter table public.procedural_tags
  drop constraint if exists procedural_tags_name_check;

alter table public.procedural_tags
  add constraint procedural_tags_name_check
  check (length(btrim(name)) between 2 and 500) not valid;

create temporary table split_tipificacao_parts as
select distinct
  i.id as inquerito_id,
  case
    when length(btrim(part.value)) <= 500 then btrim(part.value)
    else left(btrim(part.value), 487) || '... ' || left(md5(lower(btrim(part.value))), 8)
  end as tag_name
from public.inqueritos i
cross join lateral regexp_split_to_table(
  i.tipificacao,
  ',[[:space:]]*(?=[+]?[[:space:]]*[0-9]+[[:space:]]*:)'
) as part(value)
where nullif(btrim(i.tipificacao), '') is not null
  and i.tipificacao ~ ',[[:space:]]*[+]?[[:space:]]*[0-9]+[[:space:]]*:'
  and nullif(btrim(part.value), '') is not null;

insert into public.procedural_tags (
  scope,
  name,
  slug,
  color,
  is_system,
  active,
  created_by
)
select distinct
  'tipificacao',
  parts.tag_name,
  'split-' || md5(lower(parts.tag_name)),
  'purple',
  false,
  true,
  null::uuid
from split_tipificacao_parts parts
on conflict do nothing;

insert into public.inquerito_tag_links (inquerito_id, tag_id, created_by)
select distinct
  parts.inquerito_id,
  tags.id,
  null::uuid
from split_tipificacao_parts parts
join public.procedural_tags tags
  on tags.scope = 'tipificacao'
 and lower(btrim(tags.name)) = lower(btrim(parts.tag_name))
where tags.active
on conflict do nothing;

-- Remove somente o vinculo legado combinado; as tags e os procedimentos
-- permanecem preservados. A tag antiga e' apenas desativada quando fica orfa.
delete from public.inquerito_tag_links links
using public.inqueritos inquiries, public.procedural_tags tags
where links.inquerito_id = inquiries.id
  and links.tag_id = tags.id
  and tags.scope = 'tipificacao'
  and tags.slug = 'legacy-' || md5(lower(btrim(inquiries.tipificacao)))
  and exists (
    select 1
    from split_tipificacao_parts parts
    where parts.inquerito_id = inquiries.id
  );

update public.procedural_tags tags
set active = false,
    updated_at = now()
where tags.scope = 'tipificacao'
  and tags.slug like 'legacy-%'
  and not exists (
    select 1
    from public.inquerito_tag_links links
    where links.tag_id = tags.id
  )
  and exists (
    select 1
    from public.inqueritos inquiries
    where inquiries.tipificacao ~ ',[[:space:]]*[+]?[[:space:]]*[0-9]+[[:space:]]*:'
      and tags.slug = 'legacy-' || md5(lower(btrim(inquiries.tipificacao)))
  );

drop table split_tipificacao_parts;
