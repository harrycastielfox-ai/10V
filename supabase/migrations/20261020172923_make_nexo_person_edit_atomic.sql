create or replace function public.nexo_atualizar_pessoa_completa(
  p_pessoa_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_pessoa_atual public.nexo_pessoas%rowtype;
  v_pessoa jsonb := p_payload -> 'pessoa';
  v_endereco jsonb := p_payload -> 'endereco';
  v_vinculo jsonb := p_payload -> 'vinculo';
  v_endereco_id uuid;
  v_vinculo_atual public.nexo_vinculos%rowtype;
  v_vinculo_historico public.nexo_vinculos%rowtype;
  v_organizacao_id uuid;
  v_status text;
  v_confianca smallint;
  v_superior_vinculo_id uuid;
  v_updated_at timestamptz;
begin
  if not (select public.current_user_can_access_nexo()) then
    raise exception 'nexo_access_denied' using errcode = '42501';
  end if;

  select * into v_pessoa_atual
  from public.nexo_pessoas
  where id = p_pessoa_id and deleted_at is null
  for update;

  if not found then
    raise exception 'nexo_pessoa_nao_encontrada' using errcode = 'P0002';
  end if;

  if p_expected_updated_at is null
      or v_pessoa_atual.updated_at is distinct from p_expected_updated_at then
    raise exception 'nexo_edicao_conflito'
      using errcode = 'P0001',
      detail = 'A ficha foi alterada depois que esta edição foi iniciada.',
      hint = 'Recarregue a ficha antes de tentar salvar novamente.';
  end if;

  if v_pessoa is null or jsonb_typeof(v_pessoa) <> 'object' then
    raise exception 'nexo_pessoa_payload_invalido' using errcode = '22023';
  end if;

  if v_endereco is not null and jsonb_typeof(v_endereco) = 'object' then
    if v_pessoa_atual.endereco_id is null then
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
    else
      v_endereco_id := v_pessoa_atual.endereco_id;
      update public.localizacao_enderecos set
        logradouro = v_endereco ->> 'logradouro',
        numero = nullif(v_endereco ->> 'numero', ''),
        bairro = nullif(v_endereco ->> 'bairro', ''),
        municipio = coalesce(nullif(v_endereco ->> 'municipio', ''), 'Itabela'),
        uf = coalesce(nullif(v_endereco ->> 'uf', ''), 'BA'),
        ponto_referencia = nullif(v_endereco ->> 'ponto_referencia', ''),
        como_chegar = nullif(v_endereco ->> 'como_chegar', ''),
        link_navegacao = nullif(v_endereco ->> 'link_navegacao', ''),
        latitude = nullif(v_endereco ->> 'latitude', '')::double precision,
        longitude = nullif(v_endereco ->> 'longitude', '')::double precision,
        updated_by = auth.uid()
      where id = v_endereco_id;
    end if;
  else
    v_endereco_id := null;
  end if;

  update public.nexo_pessoas set
    nome = v_pessoa ->> 'nome',
    apelido = nullif(v_pessoa ->> 'apelido', ''),
    cpf = nullif(v_pessoa ->> 'cpf', ''),
    rg = nullif(v_pessoa ->> 'rg', ''),
    data_nascimento = nullif(v_pessoa ->> 'data_nascimento', '')::date,
    naturalidade = nullif(v_pessoa ->> 'naturalidade', ''),
    nome_mae = nullif(v_pessoa ->> 'nome_mae', ''),
    nome_pai = nullif(v_pessoa ->> 'nome_pai', ''),
    nome_social = nullif(v_pessoa ->> 'nome_social', ''),
    sexo = nullif(v_pessoa ->> 'sexo', ''),
    raca_cor = nullif(v_pessoa ->> 'raca_cor', ''),
    estado_civil = nullif(v_pessoa ->> 'estado_civil', ''),
    nacionalidade = coalesce(nullif(v_pessoa ->> 'nacionalidade', ''), 'Brasileira'),
    escolaridade = nullif(v_pessoa ->> 'escolaridade', ''),
    profissao = nullif(v_pessoa ->> 'profissao', ''),
    idade_aproximada = coalesce((v_pessoa ->> 'idade_aproximada')::boolean, false),
    idade_aproximada_valor = nullif(v_pessoa ->> 'idade_aproximada_valor', '')::integer,
    em_situacao_rua = coalesce((v_pessoa ->> 'em_situacao_rua')::boolean, false),
    usa_tornozeleira = coalesce((v_pessoa ->> 'usa_tornozeleira')::boolean, false),
    altura_cm = nullif(v_pessoa ->> 'altura_cm', '')::integer,
    tipo_fisico = nullif(v_pessoa ->> 'tipo_fisico', ''),
    estado_aparente = nullif(v_pessoa ->> 'estado_aparente', ''),
    sinais_particulares = nullif(v_pessoa ->> 'sinais_particulares', ''),
    documentos_extras = coalesce(v_pessoa -> 'documentos_extras', '[]'::jsonb),
    contatos = coalesce(v_pessoa -> 'contatos', '[]'::jsonb),
    telefone = nullif(v_pessoa ->> 'telefone', ''),
    observacoes = nullif(v_pessoa ->> 'observacoes', ''),
    usar_local_faccao = coalesce((v_pessoa ->> 'usar_local_faccao')::boolean, false),
    endereco_id = v_endereco_id,
    updated_by = auth.uid()
  where id = p_pessoa_id
  returning updated_at into v_updated_at;

  if v_vinculo is not null and jsonb_typeof(v_vinculo) = 'object' then
    v_organizacao_id := nullif(v_vinculo ->> 'organizacao_id', '')::uuid;
    v_status := coalesce(nullif(v_vinculo ->> 'status', ''), 'nao_confirmado');
    v_confianca := coalesce((v_vinculo ->> 'confianca')::smallint, 0);
    v_superior_vinculo_id := nullif(v_vinculo ->> 'superior_vinculo_id', '')::uuid;

    if v_status not in ('confirmado', 'provavel', 'suspeito', 'nao_confirmado', 'desvinculado')
        or v_confianca < 0 or v_confianca > 100 then
      raise exception 'nexo_vinculo_dados_invalidos' using errcode = '22023';
    end if;

    select * into v_vinculo_atual
    from public.nexo_vinculos
    where pessoa_id = p_pessoa_id and deleted_at is null and status <> 'desvinculado'
    order by updated_at desc
    limit 1
    for update;

    if found then
      if v_organizacao_id is null or v_status = 'desvinculado' then
        perform public.nexo_gerenciar_vinculo(
          v_vinculo_atual.id, 'remover', null, 'nao_confirmado', null, 0, null, null
        );
      elsif v_organizacao_id is distinct from v_vinculo_atual.organizacao_id then
        perform public.nexo_gerenciar_vinculo(
          v_vinculo_atual.id, 'transferir', v_organizacao_id, v_status,
          nullif(v_vinculo ->> 'funcao', ''), v_confianca,
          nullif(v_vinculo ->> 'fonte_resumo', ''), null
        );
      else
        perform public.nexo_gerenciar_vinculo(
          v_vinculo_atual.id, 'atualizar', v_organizacao_id, v_status,
          nullif(v_vinculo ->> 'funcao', ''), v_confianca,
          nullif(v_vinculo ->> 'fonte_resumo', ''), v_superior_vinculo_id
        );
      end if;
    elsif v_organizacao_id is not null and v_status <> 'desvinculado' then
      select * into v_vinculo_historico
      from public.nexo_vinculos
      where pessoa_id = p_pessoa_id and organizacao_id = v_organizacao_id and deleted_at is null
      limit 1
      for update;

      if found then
        perform public.nexo_gerenciar_vinculo(
          v_vinculo_historico.id, 'atualizar', v_organizacao_id, v_status,
          nullif(v_vinculo ->> 'funcao', ''), v_confianca,
          nullif(v_vinculo ->> 'fonte_resumo', ''), v_superior_vinculo_id
        );
      else
        insert into public.nexo_vinculos (
          organizacao_id, pessoa_id, status, funcao, confianca, fonte_resumo,
          superior_vinculo_id, desde, created_by, updated_by
        ) values (
          v_organizacao_id, p_pessoa_id, v_status,
          nullif(v_vinculo ->> 'funcao', ''), v_confianca,
          nullif(v_vinculo ->> 'fonte_resumo', ''), v_superior_vinculo_id,
          current_date, auth.uid(), auth.uid()
        );
      end if;
    end if;
  end if;

  return v_updated_at;
end;
$function$;

revoke all on function public.nexo_atualizar_pessoa_completa(uuid, timestamptz, jsonb)
  from public, anon;
grant execute on function public.nexo_atualizar_pessoa_completa(uuid, timestamptz, jsonb)
  to authenticated;

comment on function public.nexo_atualizar_pessoa_completa(uuid, timestamptz, jsonb) is
  'Atualiza pessoa, endereço e vínculo em uma única transação e rejeita versões desatualizadas.';
