-- Optional, explicit links from a procedural participant to NEXO records.
alter table public.inquerito_pessoas
  add column if not exists nexo_pessoa_id uuid
    references public.nexo_pessoas(id) on delete set null,
  add column if not exists nexo_organizacao_id uuid
    references public.nexo_organizacoes(id) on delete set null,
  add column if not exists nexo_vinculo_id uuid
    references public.nexo_vinculos(id) on delete set null,
  add column if not exists faccao_nome_informada text,
  add column if not exists faccao_sigla_informada text,
  add column if not exists funcao_faccao_informada text,
  add column if not exists faccao_fonte_informada text;

create index if not exists inquerito_pessoas_nexo_pessoa_idx
  on public.inquerito_pessoas (nexo_pessoa_id)
  where nexo_pessoa_id is not null;

create index if not exists inquerito_pessoas_nexo_organizacao_idx
  on public.inquerito_pessoas (nexo_organizacao_id)
  where nexo_organizacao_id is not null;

create index if not exists inquerito_pessoas_nexo_vinculo_idx
  on public.inquerito_pessoas (nexo_vinculo_id)
  where nexo_vinculo_id is not null;

-- The table's row policy does not hide individual columns. Expose the participant
-- data normally, but return NEXO identifiers only through the permission-checked RPC.
revoke select on table public.inquerito_pessoas from authenticated;
grant select (
  id,
  inquerito_id,
  papel,
  nome,
  observacao,
  autoria_determinada,
  preso,
  ordem,
  created_by,
  created_at,
  updated_at,
  faccao_nome_informada,
  faccao_sigla_informada,
  funcao_faccao_informada,
  faccao_fonte_informada
) on table public.inquerito_pessoas to authenticated;

create or replace function public.replace_inquerito_pessoas(
  p_inquerito_id uuid,
  p_pessoas jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_visibilidade text;
  v_pode_acessar_nexo boolean;
  v_payload_has_stable_ids boolean;
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
      or (item ? 'autoria_determinada'
          and jsonb_typeof(item->'autoria_determinada') not in ('boolean', 'null'))
      or (item ? 'preso'
          and jsonb_typeof(item->'preso') not in ('boolean', 'null'))
      or (item ? 'id' and jsonb_typeof(item->'id') not in ('string', 'null'))
      or (item ? 'nexo_pessoa_id'
          and jsonb_typeof(item->'nexo_pessoa_id') not in ('string', 'null'))
      or (item ? 'nexo_organizacao_id'
          and jsonb_typeof(item->'nexo_organizacao_id') not in ('string', 'null'))
      or (item ? 'nexo_vinculo_id'
          and jsonb_typeof(item->'nexo_vinculo_id') not in ('string', 'null'))
  ) then
    raise exception 'Pessoa envolvida possui dados inválidos' using errcode = '22023';
  end if;

  select coalesce(
    bool_and(
      jsonb_typeof(item->'id') = 'string'
      and nullif(item->>'id', '') is not null
    ),
    true
  )
  into v_payload_has_stable_ids
  from jsonb_array_elements(coalesce(p_pessoas, '[]'::jsonb)) item;

  if not v_payload_has_stable_ids and exists (
    select 1
    from public.inquerito_pessoas previous
    where previous.inquerito_id = p_inquerito_id
      and (
        previous.nexo_pessoa_id is not null
        or previous.nexo_organizacao_id is not null
        or previous.nexo_vinculo_id is not null
        or previous.faccao_nome_informada is not null
        or previous.faccao_sigla_informada is not null
        or previous.funcao_faccao_informada is not null
        or previous.faccao_fonte_informada is not null
      )
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(p_pessoas, '[]'::jsonb))
          with ordinality as source(item, ordinality)
        where (
          nullif(source.item->>'id', '') is not null
          and previous.id = nullif(source.item->>'id', '')::uuid
        ) or (
          nullif(source.item->>'id', '') is null
          and previous.ordem = source.ordinality::integer - 1
          and previous.papel = source.item->>'papel'
          and previous.nome = btrim(source.item->>'nome')
        )
      )
  ) then
    raise exception 'Atualize o aplicativo para editar pessoas com vínculos ou informações de facção sem perder esses dados'
      using errcode = '22023';
  end if;

  v_pode_acessar_nexo := coalesce(public.current_user_can_access_nexo(), false);

  if v_pode_acessar_nexo and exists (
    select 1
    from jsonb_array_elements(coalesce(p_pessoas, '[]'::jsonb)) item
    where not exists (
      select 1 from public.inquerito_pessoas previous
      where previous.inquerito_id = p_inquerito_id
        and previous.id = nullif(item->>'id', '')::uuid
        and previous.nexo_pessoa_id is not distinct from nullif(item->>'nexo_pessoa_id', '')::uuid
        and previous.nexo_organizacao_id is not distinct from nullif(item->>'nexo_organizacao_id', '')::uuid
        and previous.nexo_vinculo_id is not distinct from nullif(item->>'nexo_vinculo_id', '')::uuid
    )
    and ((
      nullif(item->>'nexo_pessoa_id', '') is not null
      and not exists (
        select 1 from public.nexo_pessoas pessoa
        where pessoa.id = nullif(item->>'nexo_pessoa_id', '')::uuid
          and pessoa.deleted_at is null
      )
    ) or (
      nullif(item->>'nexo_organizacao_id', '') is not null
      and not exists (
        select 1 from public.nexo_organizacoes organizacao
        where organizacao.id = nullif(item->>'nexo_organizacao_id', '')::uuid
          and organizacao.deleted_at is null
      )
    ) or (
      nullif(item->>'nexo_vinculo_id', '') is not null
      and (
        nullif(item->>'nexo_pessoa_id', '') is null
        or nullif(item->>'nexo_organizacao_id', '') is null
        or not exists (
          select 1 from public.nexo_vinculos vinculo
          where vinculo.id = nullif(item->>'nexo_vinculo_id', '')::uuid
            and vinculo.pessoa_id = nullif(item->>'nexo_pessoa_id', '')::uuid
            and vinculo.organizacao_id = nullif(item->>'nexo_organizacao_id', '')::uuid
            and vinculo.deleted_at is null
        )
      )
    )
  )) then
    raise exception 'O perfil, a facção ou o vínculo selecionado não está disponível no NEXO' using errcode = '22023';
  end if;

  with source as (
    select
      item,
      ordinality,
      nullif(item->>'id', '')::uuid as supplied_id
    from jsonb_array_elements(coalesce(p_pessoas, '[]'::jsonb))
      with ordinality as rows(item, ordinality)
  ), normalized as (
    select
      source.item,
      source.ordinality,
      source.supplied_id,
      existing.id as existing_id,
      existing.nexo_pessoa_id as old_nexo_pessoa_id,
      existing.nexo_organizacao_id as old_nexo_organizacao_id,
      existing.nexo_vinculo_id as old_nexo_vinculo_id,
      existing.faccao_nome_informada as old_faccao_nome_informada,
      existing.faccao_sigla_informada as old_faccao_sigla_informada,
      existing.funcao_faccao_informada as old_funcao_faccao_informada,
      existing.faccao_fonte_informada as old_faccao_fonte_informada
    from source
    left join lateral (
      select pessoa.*
      from public.inquerito_pessoas pessoa
      where pessoa.inquerito_id = p_inquerito_id
        and (
          (source.supplied_id is not null and pessoa.id = source.supplied_id)
          or (
            source.supplied_id is null
            and pessoa.ordem = source.ordinality::integer - 1
            and pessoa.papel = source.item->>'papel'
            and pessoa.nome = btrim(source.item->>'nome')
          )
        )
      limit 1
    ) existing on true
  )
  insert into public.inquerito_pessoas as current_person (
    id,
    inquerito_id,
    papel,
    nome,
    observacao,
    autoria_determinada,
    preso,
    ordem,
    created_by,
    updated_at,
    nexo_pessoa_id,
    nexo_organizacao_id,
    nexo_vinculo_id,
    faccao_nome_informada,
    faccao_sigla_informada,
    funcao_faccao_informada,
    faccao_fonte_informada
  )
  select
    coalesce(
      normalized.existing_id,
      case
        when normalized.supplied_id is null then gen_random_uuid()
        when exists (
          select 1 from public.inquerito_pessoas collision
          where collision.id = normalized.supplied_id
        ) then gen_random_uuid()
        else normalized.supplied_id
      end
    ),
    p_inquerito_id,
    normalized.item->>'papel',
    btrim(normalized.item->>'nome'),
    nullif(btrim(normalized.item->>'observacao'), ''),
    nullif(normalized.item->>'autoria_determinada', '')::boolean,
    nullif(normalized.item->>'preso', '')::boolean,
    coalesce((normalized.item->>'ordem')::integer, normalized.ordinality::integer - 1),
    auth.uid(),
    now(),
    case
      when not v_pode_acessar_nexo then normalized.old_nexo_pessoa_id
      when normalized.item ? 'nexo_pessoa_id'
        then nullif(normalized.item->>'nexo_pessoa_id', '')::uuid
      else normalized.old_nexo_pessoa_id
    end,
    case
      when not v_pode_acessar_nexo then normalized.old_nexo_organizacao_id
      when normalized.item ? 'nexo_organizacao_id'
        then nullif(normalized.item->>'nexo_organizacao_id', '')::uuid
      else normalized.old_nexo_organizacao_id
    end,
    case
      when not v_pode_acessar_nexo then normalized.old_nexo_vinculo_id
      when normalized.item ? 'nexo_vinculo_id'
        then nullif(normalized.item->>'nexo_vinculo_id', '')::uuid
      else normalized.old_nexo_vinculo_id
    end,
    case when normalized.item ? 'faccao_nome_informada'
      then nullif(btrim(normalized.item->>'faccao_nome_informada'), '')
      else normalized.old_faccao_nome_informada end,
    case when normalized.item ? 'faccao_sigla_informada'
      then nullif(btrim(normalized.item->>'faccao_sigla_informada'), '')
      else normalized.old_faccao_sigla_informada end,
    case when normalized.item ? 'funcao_faccao_informada'
      then nullif(btrim(normalized.item->>'funcao_faccao_informada'), '')
      else normalized.old_funcao_faccao_informada end,
    case when normalized.item ? 'faccao_fonte_informada'
      then nullif(btrim(normalized.item->>'faccao_fonte_informada'), '')
      else normalized.old_faccao_fonte_informada end
  from normalized
  on conflict (id) do update set
    inquerito_id = excluded.inquerito_id,
    papel = excluded.papel,
    nome = excluded.nome,
    observacao = excluded.observacao,
    autoria_determinada = excluded.autoria_determinada,
    preso = excluded.preso,
    ordem = excluded.ordem,
    updated_at = now(),
    nexo_pessoa_id = excluded.nexo_pessoa_id,
    nexo_organizacao_id = excluded.nexo_organizacao_id,
    nexo_vinculo_id = excluded.nexo_vinculo_id,
    faccao_nome_informada = excluded.faccao_nome_informada,
    faccao_sigla_informada = excluded.faccao_sigla_informada,
    funcao_faccao_informada = excluded.funcao_faccao_informada,
    faccao_fonte_informada = excluded.faccao_fonte_informada;

  delete from public.inquerito_pessoas existing
  where existing.inquerito_id = p_inquerito_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_pessoas, '[]'::jsonb))
        with ordinality as source(item, ordinality)
      where (
        nullif(source.item->>'id', '') is not null
        and existing.id = nullif(source.item->>'id', '')::uuid
      ) or (
        nullif(source.item->>'id', '') is null
        and existing.ordem = source.ordinality::integer - 1
        and existing.papel = source.item->>'papel'
        and existing.nome = btrim(source.item->>'nome')
      )
    );
end;
$function$;

revoke all on function public.replace_inquerito_pessoas(uuid, jsonb) from public, anon;
grant execute on function public.replace_inquerito_pessoas(uuid, jsonb) to authenticated;

create schema if not exists private;

create or replace function private.list_inquerito_pessoa_nexo_links(p_inquerito_id uuid)
returns table (
  inquerito_pessoa_id uuid,
  nexo_pessoa_id uuid,
  nexo_organizacao_id uuid,
  nexo_vinculo_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_visibilidade text;
begin
  if auth.uid() is null or not public.current_user_can_access_inqueritos() then
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

  if not coalesce(public.current_user_can_access_nexo(), false) then
    return;
  end if;

  return query
  select pessoa.id, pessoa.nexo_pessoa_id, pessoa.nexo_organizacao_id, pessoa.nexo_vinculo_id
  from public.inquerito_pessoas pessoa
  where pessoa.inquerito_id = p_inquerito_id;
end;
$function$;

revoke all on function private.list_inquerito_pessoa_nexo_links(uuid)
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.list_inquerito_pessoa_nexo_links(uuid) to authenticated;

create or replace function public.list_inquerito_pessoa_nexo_links(p_inquerito_id uuid)
returns table (
  inquerito_pessoa_id uuid,
  nexo_pessoa_id uuid,
  nexo_organizacao_id uuid,
  nexo_vinculo_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select *
  from private.list_inquerito_pessoa_nexo_links(p_inquerito_id);
$function$;

revoke all on function public.list_inquerito_pessoa_nexo_links(uuid) from public, anon;
grant execute on function public.list_inquerito_pessoa_nexo_links(uuid) to authenticated;

comment on column public.inquerito_pessoas.nexo_pessoa_id is
  'Perfil NEXO selecionado explicitamente para a pessoa mencionada no procedimento.';
comment on column public.inquerito_pessoas.nexo_vinculo_id is
  'Vínculo NEXO específico selecionado; status e fonte continuam sendo lidos do NEXO.';
comment on column public.inquerito_pessoas.faccao_nome_informada is
  'Nome/snapshot da facção informado no contexto deste procedimento; sem vínculo NEXO, não é confirmação.';
comment on function public.replace_inquerito_pessoas(uuid, jsonb) is
  'Substitui pessoas do inquérito, preservando referências NEXO de usuários sem permissão para consultá-las.';
comment on function private.list_inquerito_pessoa_nexo_links(uuid) is
  'Retorna referencias NEXO apenas apos validar acesso ao procedimento e ao NEXO.';
comment on function public.list_inquerito_pessoa_nexo_links(uuid) is
  'Retorna referências NEXO das pessoas do inquérito apenas para usuários autorizados ao NEXO.';
