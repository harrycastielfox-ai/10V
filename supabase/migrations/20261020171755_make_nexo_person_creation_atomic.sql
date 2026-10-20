alter table public.nexo_pessoas
  add column if not exists creation_request_id uuid;

create unique index if not exists nexo_pessoas_creation_request_id_uidx
  on public.nexo_pessoas (creation_request_id)
  where creation_request_id is not null;

create or replace function public.nexo_criar_pessoa_completa(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_pessoa_id uuid;
  v_endereco_id uuid;
  v_request_id uuid := nullif(p_payload ->> 'request_id', '')::uuid;
  v_pessoa jsonb := p_payload -> 'pessoa';
  v_endereco jsonb := p_payload -> 'endereco';
  v_vinculo jsonb := p_payload -> 'vinculo';
begin
  if not (select public.current_user_can_access_nexo()) then
    raise exception 'nexo_access_denied' using errcode = '42501';
  end if;

  if v_request_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_request_id::text, 0));
    select id into v_pessoa_id
    from public.nexo_pessoas
    where creation_request_id = v_request_id and deleted_at is null;
    if found then
      return v_pessoa_id;
    end if;
  end if;

  if v_endereco is not null and jsonb_typeof(v_endereco) = 'object' then
    insert into public.localizacao_enderecos (
      logradouro, numero, bairro, municipio, uf, ponto_referencia, como_chegar,
      link_navegacao, latitude, longitude, created_by, updated_by
    ) values (
      v_endereco ->> 'logradouro', nullif(v_endereco ->> 'numero', ''),
      nullif(v_endereco ->> 'bairro', ''),
      coalesce(nullif(v_endereco ->> 'municipio', ''), 'Itabela'),
      coalesce(nullif(v_endereco ->> 'uf', ''), 'BA'),
      nullif(v_endereco ->> 'ponto_referencia', ''),
      nullif(v_endereco ->> 'como_chegar', ''),
      nullif(v_endereco ->> 'link_navegacao', ''),
      nullif(v_endereco ->> 'latitude', '')::double precision,
      nullif(v_endereco ->> 'longitude', '')::double precision,
      auth.uid(), auth.uid()
    ) returning id into v_endereco_id;
  end if;

  insert into public.nexo_pessoas (
    nome, apelido, cpf, rg, data_nascimento, naturalidade, nome_mae, nome_pai,
    nome_social, sexo, raca_cor, estado_civil, nacionalidade, escolaridade, profissao,
    idade_aproximada, idade_aproximada_valor, em_situacao_rua, usa_tornozeleira,
    altura_cm, tipo_fisico, estado_aparente, sinais_particulares, documentos_extras,
    contatos, telefone, observacoes, usar_local_faccao, endereco_id,
    creation_request_id, created_by, updated_by
  ) values (
    v_pessoa ->> 'nome', nullif(v_pessoa ->> 'apelido', ''),
    nullif(v_pessoa ->> 'cpf', ''), nullif(v_pessoa ->> 'rg', ''),
    nullif(v_pessoa ->> 'data_nascimento', '')::date,
    nullif(v_pessoa ->> 'naturalidade', ''),
    nullif(v_pessoa ->> 'nome_mae', ''), nullif(v_pessoa ->> 'nome_pai', ''),
    nullif(v_pessoa ->> 'nome_social', ''), nullif(v_pessoa ->> 'sexo', ''),
    nullif(v_pessoa ->> 'raca_cor', ''), nullif(v_pessoa ->> 'estado_civil', ''),
    coalesce(nullif(v_pessoa ->> 'nacionalidade', ''), 'Brasileira'),
    nullif(v_pessoa ->> 'escolaridade', ''), nullif(v_pessoa ->> 'profissao', ''),
    coalesce((v_pessoa ->> 'idade_aproximada')::boolean, false),
    nullif(v_pessoa ->> 'idade_aproximada_valor', '')::integer,
    coalesce((v_pessoa ->> 'em_situacao_rua')::boolean, false),
    coalesce((v_pessoa ->> 'usa_tornozeleira')::boolean, false),
    nullif(v_pessoa ->> 'altura_cm', '')::integer,
    nullif(v_pessoa ->> 'tipo_fisico', ''), nullif(v_pessoa ->> 'estado_aparente', ''),
    nullif(v_pessoa ->> 'sinais_particulares', ''),
    coalesce(v_pessoa -> 'documentos_extras', '[]'::jsonb),
    coalesce(v_pessoa -> 'contatos', '[]'::jsonb),
    nullif(v_pessoa ->> 'telefone', ''), nullif(v_pessoa ->> 'observacoes', ''),
    coalesce((v_pessoa ->> 'usar_local_faccao')::boolean, false),
    v_endereco_id, v_request_id, auth.uid(), auth.uid()
  ) returning id into v_pessoa_id;

  if v_vinculo is not null and jsonb_typeof(v_vinculo) = 'object' then
    insert into public.nexo_vinculos (
      organizacao_id, pessoa_id, status, funcao, confianca, fonte_resumo,
      created_by, updated_by
    ) values (
      (v_vinculo ->> 'organizacao_id')::uuid, v_pessoa_id,
      coalesce(nullif(v_vinculo ->> 'status', ''), 'nao_confirmado'),
      nullif(v_vinculo ->> 'funcao', ''),
      coalesce((v_vinculo ->> 'confianca')::smallint, 0),
      nullif(v_vinculo ->> 'fonte_resumo', ''), auth.uid(), auth.uid()
    );
  end if;

  return v_pessoa_id;
end;
$function$;

revoke all on function public.nexo_criar_pessoa_completa(jsonb) from public, anon;
grant execute on function public.nexo_criar_pessoa_completa(jsonb) to authenticated;

comment on column public.nexo_pessoas.creation_request_id is
  'Identificador técnico idempotente do envio que criou a ficha; evita duplicação após resposta perdida.';
