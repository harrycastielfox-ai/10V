-- Situacao individual das pessoas envolvidas no inquerito.
--
-- Ate aqui "autoria" e "reu preso" existiam apenas no inquerito, soltos de quem
-- descreviam: quem preenchia o cadastro nao tinha como saber a qual pessoa a
-- informacao se referia. Agora cada investigado carrega a sua situacao, e o
-- procedimento deriva os campos antigos a partir dela.
--
-- Ambas as colunas sao anulaveis de proposito: null significa "nao informado",
-- diferente de false ("solto" / "autoria desconhecida").

alter table public.inquerito_pessoas
  add column if not exists autoria_determinada boolean,
  add column if not exists preso boolean;

comment on column public.inquerito_pessoas.autoria_determinada is
  'Apenas para papel autor_investigado: true = autoria determinada, false = desconhecida, null = nao informado.';

comment on column public.inquerito_pessoas.preso is
  'Apenas para papel autor_investigado: true = preso, false = solto, null = nao informado.';

-- RPC atualizada para gravar os dois campos. O corpo repete as mesmas verificacoes
-- de acesso e sigilo da versao anterior (20260731100000), com duas mudancas:
-- validacao do tipo dos campos novos e gravacao deles apenas para investigados.
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
    case
      when item->>'papel' = 'autor_investigado'
        then nullif(item->>'autoria_determinada', '')::boolean
      else null
    end,
    case
      when item->>'papel' = 'autor_investigado'
        then nullif(item->>'preso', '')::boolean
      else null
    end,
    coalesce((item->>'ordem')::integer, ordinality::integer - 1),
    auth.uid()
  from jsonb_array_elements(coalesce(p_pessoas, '[]'::jsonb))
    with ordinality as source(item, ordinality);
end;
$function$;

comment on function public.replace_inquerito_pessoas(uuid, jsonb) is
  'Substitui a lista de pessoas do inquerito, incluindo autoria e prisao de cada investigado.';
