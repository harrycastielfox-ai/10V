-- Situacao (autoria e prisao) deixa de ser exclusiva do autor/investigado.
--
-- Na pratica a mesma pessoa pode ocupar os dois lados do fato: em agressao
-- mutua, quem consta como vitima tambem responde. A versao anterior
-- (20260817140000) descartava esses campos para qualquer papel diferente de
-- autor_investigado, o que apagaria em silencio o que o usuario informou.
--
-- Unica mudanca em relacao a versao anterior: os dois campos passam a ser
-- gravados para todos os papeis. Todas as verificacoes de acesso e sigilo
-- continuam iguais.

create or replace function public.replace_inquerito_pessoas(
  p_inquerito_id uuid,
  p_pessoas jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_visibilidade text;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória' using errcode = '42501';
  end if;

  if not public.current_user_can_access_inqueritos() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  select i.visibilidade
    into v_visibilidade
  from public.inqueritos i
  where i.id = p_inquerito_id
    and i.deleted_at is null;

  if not found then
    raise exception 'Inquérito não encontrado' using errcode = 'P0002';
  end if;

  if public.inquerito_is_sigiloso(v_visibilidade)
     and not public.current_user_can_access_inqueritos_sigilosos() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_pessoas, '[]'::jsonb)) <> 'array' then
    raise exception 'Lista de pessoas inválida' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_pessoas, '[]'::jsonb)) item
    where coalesce(item->>'papel', '') not in ('vitima', 'autor_investigado', 'testemunha', 'outro')
      or nullif(btrim(item->>'nome'), '') is null
  ) then
    raise exception 'Pessoa envolvida possui papel ou nome inválido' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_pessoas, '[]'::jsonb)) item
    where (item ? 'autoria_determinada'
           and jsonb_typeof(item->'autoria_determinada') not in ('boolean', 'null'))
       or (item ? 'preso'
           and jsonb_typeof(item->'preso') not in ('boolean', 'null'))
  ) then
    raise exception 'Situação da pessoa envolvida inválida' using errcode = '22023';
  end if;

  delete from public.inquerito_pessoas
  where inquerito_id = p_inquerito_id;

  insert into public.inquerito_pessoas (
    inquerito_id,
    papel,
    nome,
    observacao,
    autoria_determinada,
    preso,
    ordem,
    created_by
  )
  select
    p_inquerito_id,
    item->>'papel',
    btrim(item->>'nome'),
    nullif(btrim(item->>'observacao'), ''),
    nullif(item->>'autoria_determinada', '')::boolean,
    nullif(item->>'preso', '')::boolean,
    coalesce((item->>'ordem')::integer, ordinality::integer - 1),
    auth.uid()
  from jsonb_array_elements(coalesce(p_pessoas, '[]'::jsonb))
    with ordinality as source(item, ordinality);
end;
$function$;

comment on column public.inquerito_pessoas.autoria_determinada is
  'true = autoria determinada, false = desconhecida, null = nao informado. Vale para qualquer papel: a vitima tambem pode responder pelo fato.';

comment on column public.inquerito_pessoas.preso is
  'true = preso, false = solto, null = nao informado. Vale para qualquer papel.';
