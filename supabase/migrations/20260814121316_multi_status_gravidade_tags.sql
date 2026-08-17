-- Permite classificar um procedimento com multiplos status e gravidades.
-- Os campos legados continuam guardando a primeira tag selecionada para
-- preservar indicadores, historico de status e integracoes existentes.

alter table public.procedural_tags
  drop constraint if exists procedural_tags_scope_check;

alter table public.procedural_tags
  add constraint procedural_tags_scope_check
  check (
    scope in (
      'inquerito_status',
      'inquerito_gravidade',
      'tipificacao',
      'inquerito_geral',
      'movimentacao_tipo',
      'movimentacao_status',
      'prioridade',
      'movimentacao_geral'
    )
  );

insert into public.procedural_tags (scope, name, slug, color, is_system)
values
  ('inquerito_gravidade', 'CVLI', 'cvli', 'red', true),
  ('inquerito_gravidade', 'Tráfico de Drogas', 'trafico-de-drogas', 'purple', true),
  ('inquerito_gravidade', 'MILAE', 'milae', 'red', true),
  ('inquerito_gravidade', 'Violência Doméstica e Familiar', 'violencia-domestica-e-familiar', 'amber', true),
  ('inquerito_gravidade', 'Sexuais', 'sexuais', 'red', true),
  ('inquerito_gravidade', 'Patrimonial', 'patrimonial', 'blue', true),
  ('inquerito_gravidade', 'Raciais e de Preconceito', 'raciais-e-de-preconceito', 'purple', true),
  ('inquerito_gravidade', 'Trânsito', 'transito', 'cyan', true),
  ('inquerito_gravidade', 'Criança e Adolescente', 'crianca-e-adolescente', 'amber', true),
  ('inquerito_gravidade', 'Pessoa Idosa', 'pessoa-idosa', 'amber', true),
  ('inquerito_gravidade', 'Outros', 'outros', 'slate', true)
on conflict (scope, slug) do update
set name = excluded.name,
    color = excluded.color,
    is_system = true,
    active = true,
    updated_at = now();

-- Preserva categorias legadas que nao fazem parte do catalogo inicial.
insert into public.procedural_tags (scope, name, slug, color, is_system, created_by)
select distinct
  'inquerito_gravidade',
  case
    when length(btrim(i.gravidade)) <= 500 then btrim(i.gravidade)
    else left(btrim(i.gravidade), 487) || '... ' || left(md5(lower(btrim(i.gravidade))), 8)
  end,
  'legacy-gravidade-' || md5(lower(btrim(i.gravidade))),
  'slate',
  false,
  null::uuid
from public.inqueritos i
where nullif(btrim(i.gravidade), '') is not null
on conflict do nothing;

-- Preserva status legados que ainda nao pertencem ao catalogo normalizado.
insert into public.procedural_tags (scope, name, slug, color, is_system, created_by)
select distinct
  'inquerito_status',
  case
    when length(btrim(i.situacao)) <= 500 then btrim(i.situacao)
    else left(btrim(i.situacao), 487) || '... ' || left(md5(lower(btrim(i.situacao))), 8)
  end,
  'legacy-status-' || md5(lower(btrim(i.situacao))),
  'slate',
  false,
  null::uuid
from public.inqueritos i
where nullif(btrim(i.situacao), '') is not null
on conflict do nothing;

-- Vincula os valores legados sem alterar as linhas principais nem gerar
-- eventos artificiais no historico/auditoria dos procedimentos.
insert into public.inquerito_tag_links (inquerito_id, tag_id, created_by)
select i.id, t.id, null::uuid
from public.inqueritos i
join public.procedural_tags t
  on t.scope = 'inquerito_gravidade'
 and lower(btrim(t.name)) = lower(btrim(i.gravidade))
where nullif(btrim(i.gravidade), '') is not null
on conflict do nothing;

insert into public.inquerito_tag_links (inquerito_id, tag_id, created_by)
select i.id, t.id, null::uuid
from public.inqueritos i
join public.procedural_tags t
  on t.scope = 'inquerito_status'
 and lower(btrim(t.name)) = lower(btrim(i.situacao))
where nullif(btrim(i.situacao), '') is not null
on conflict do nothing;

insert into public.inquerito_tag_links (inquerito_id, tag_id, created_by)
select i.id, i.status_tag_id, null::uuid
from public.inqueritos i
join public.procedural_tags t
  on t.id = i.status_tag_id
 and t.scope = 'inquerito_status'
where i.status_tag_id is not null
on conflict do nothing;

create or replace function public.replace_inquerito_tags(
  p_inquerito_id uuid,
  p_tag_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticacao obrigatoria.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.inqueritos i where i.id = p_inquerito_id) then
    raise exception 'Procedimento nao encontrado ou sem acesso.' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_tag_ids, '{}'::uuid[])) requested(id)
    left join public.procedural_tags t on t.id = requested.id
    where t.id is null
       or not t.active
       or t.scope not in (
         'inquerito_status',
         'inquerito_gravidade',
         'tipificacao',
         'inquerito_geral'
       )
  ) then
    raise exception 'Uma ou mais tags do procedimento sao invalidas.' using errcode = '22023';
  end if;

  delete from public.inquerito_tag_links where inquerito_id = p_inquerito_id;
  insert into public.inquerito_tag_links (inquerito_id, tag_id, created_by)
  select p_inquerito_id, requested.id, auth.uid()
  from (select distinct unnest(coalesce(p_tag_ids, '{}'::uuid[])) as id) requested;
end;
$$;

revoke all on function public.replace_inquerito_tags(uuid, uuid[]) from public, anon;
grant execute on function public.replace_inquerito_tags(uuid, uuid[]) to authenticated;

comment on table public.procedural_tags is
  'Catalogo controlado de status, gravidades, tipificacoes, tipos de protocolo, prioridades e tags operacionais.';

notify pgrst, 'reload schema';
