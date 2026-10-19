alter table public.nexo_pessoas
  add column if not exists naturalidade text,
  add column if not exists nome_pai text,
  add column if not exists usar_local_faccao boolean not null default false;

alter table public.localizacao_enderecos
  add column if not exists link_navegacao text;

create or replace function public.nexo_criar_pessoa_completa(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_pessoa_id uuid;
  v_endereco_id uuid;
  v_pessoa jsonb := p_payload -> 'pessoa';
  v_endereco jsonb := p_payload -> 'endereco';
  v_vinculo jsonb := p_payload -> 'vinculo';
begin
  if not (select public.current_user_can_access_nexo()) then
    raise exception 'nexo_access_denied' using errcode = '42501';
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
      (v_endereco ->> 'latitude')::double precision,
      (v_endereco ->> 'longitude')::double precision,
      auth.uid(), auth.uid()
    ) returning id into v_endereco_id;
  end if;

  insert into public.nexo_pessoas (
    nome, apelido, cpf, rg, data_nascimento, naturalidade, nome_mae, nome_pai,
    telefone, observacoes, usar_local_faccao, endereco_id, created_by, updated_by
  ) values (
    v_pessoa ->> 'nome', nullif(v_pessoa ->> 'apelido', ''),
    nullif(v_pessoa ->> 'cpf', ''), nullif(v_pessoa ->> 'rg', ''),
    (v_pessoa ->> 'data_nascimento')::date,
    nullif(v_pessoa ->> 'naturalidade', ''),
    nullif(v_pessoa ->> 'nome_mae', ''), nullif(v_pessoa ->> 'nome_pai', ''),
    nullif(v_pessoa ->> 'telefone', ''), nullif(v_pessoa ->> 'observacoes', ''),
    coalesce((v_pessoa ->> 'usar_local_faccao')::boolean, false),
    v_endereco_id, auth.uid(), auth.uid()
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

comment on column public.nexo_pessoas.usar_local_faccao is
  'Indica que a localização individual é desconhecida e a referência territorial da facção deve ser usada.';
comment on column public.localizacao_enderecos.link_navegacao is
  'Link fornecido para navegação externa, como Google Maps ou Waze.';
