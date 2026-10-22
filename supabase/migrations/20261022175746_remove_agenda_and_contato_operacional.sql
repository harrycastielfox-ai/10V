-- Remove integralmente os módulos Agenda e Contato Operacional.
-- Os endereços usados pelo NEXO são migrados antes da exclusão das tabelas
-- antigas para que nenhum dossiê perca seus dados.

create table public.nexo_enderecos (
  id uuid primary key default gen_random_uuid(),
  logradouro text not null check (char_length(btrim(logradouro)) between 2 and 240),
  numero text,
  bairro text,
  municipio text not null default 'Itabela',
  uf text not null default 'BA' check (char_length(uf) = 2),
  ponto_referencia text,
  como_chegar text,
  link_navegacao text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  deleted_at timestamptz,
  constraint nexo_enderecos_latitude_check
    check (latitude is null or latitude between -90 and 90),
  constraint nexo_enderecos_longitude_check
    check (longitude is null or longitude between -180 and 180),
  constraint nexo_enderecos_coordinates_pair_check
    check ((latitude is null) = (longitude is null))
);

insert into public.nexo_enderecos (
  id, logradouro, numero, bairro, municipio, uf, ponto_referencia, como_chegar,
  link_navegacao, latitude, longitude, created_at, updated_at, created_by, updated_by, deleted_at
)
select distinct on (e.id)
  e.id, e.logradouro, e.numero, e.bairro, e.municipio, e.uf, e.ponto_referencia,
  e.como_chegar, e.link_navegacao, e.latitude, e.longitude, e.created_at, e.updated_at,
  e.created_by, e.updated_by, e.deleted_at
from public.localizacao_enderecos e
join public.nexo_pessoas p on p.endereco_id = e.id
order by e.id;

alter table public.nexo_pessoas
  drop constraint if exists nexo_pessoas_endereco_id_fkey;

alter table public.nexo_pessoas
  add constraint nexo_pessoas_endereco_id_fkey
  foreign key (endereco_id) references public.nexo_enderecos(id) on delete set null;

create index nexo_enderecos_coordinates_idx
  on public.nexo_enderecos (latitude, longitude)
  where deleted_at is null and latitude is not null;

create index nexo_enderecos_updated_idx
  on public.nexo_enderecos (updated_at desc)
  where deleted_at is null;

create trigger prepare_nexo_endereco
before insert or update on public.nexo_enderecos
for each row execute function private.prepare_nexo_row();

create trigger audit_nexo_enderecos
after insert or update on public.nexo_enderecos
for each row execute function private.audit_nexo_row_change();

alter table public.nexo_enderecos enable row level security;

create policy nexo_enderecos_select
on public.nexo_enderecos for select to authenticated
using (deleted_at is null and (select public.current_user_can_access_nexo()));

create policy nexo_enderecos_insert
on public.nexo_enderecos for insert to authenticated
with check (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
);

create policy nexo_enderecos_update
on public.nexo_enderecos for update to authenticated
using (deleted_at is null and (select public.current_user_can_access_nexo()))
with check (
  (select public.current_user_can_access_nexo())
  and updated_by = (select auth.uid())
);

revoke all on table public.nexo_enderecos from anon, authenticated;
grant select, insert, update on table public.nexo_enderecos to authenticated;
grant select, insert, update, delete on table public.nexo_enderecos to service_role;

comment on table public.nexo_enderecos is
  'Endereços exclusivos das fichas de pessoas do NEXO.';

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
    insert into public.nexo_enderecos (
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
      insert into public.nexo_enderecos (
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
      update public.nexo_enderecos set
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

create or replace function public.list_bo_responsaveis()
returns table (
  id uuid,
  nome text,
  funcao_institucional text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select p.id, p.nome, p.funcao_institucional
  from public.profiles p
  where (select public.current_user_can_manage_bos())
    and p.status_autorizacao = 'autorizado'
    and p.cargo <> 'membro'
  order by p.nome asc
  limit 200;
$function$;

revoke all on function public.list_bo_responsaveis() from public, anon;
grant execute on function public.list_bo_responsaveis() to authenticated;

comment on function public.list_bo_responsaveis() is
  'Lista mínima de servidores autorizados para o seletor de responsável do B.O.';

-- Apaga registros, anexos e histórico exclusivos dos módulos removidos.
-- Os objetos do bucket foram removidos pela Storage API antes desta migration.
-- A tabela storage.objects/buckets é protegida contra exclusões SQL diretas.
delete from public.auditoria where modulo in ('agenda', 'localizacao');

drop policy if exists localizacao_storage_select on storage.objects;
drop policy if exists localizacao_storage_insert on storage.objects;
drop policy if exists localizacao_storage_update on storage.objects;
drop policy if exists localizacao_storage_delete on storage.objects;

drop function if exists public.agenda_conflitos(
  timestamptz, integer, uuid, text, uuid, text, uuid
);
drop function if exists public.list_agendamentos_periodo(
  timestamptz, timestamptz, uuid, text, text, integer
);
drop function if exists public.agenda_overview_stats();
drop function if exists public.soft_delete_agendamento(uuid);
drop function if exists public.list_agenda_responsaveis();

drop table if exists public.agendamentos;
drop function if exists private.prepare_agendamento_row();
drop function if exists private.audit_agendamento_row_change();
drop function if exists public.normalize_agenda_search(text);
drop function if exists public.current_user_can_manage_agenda();
drop function if exists public.current_user_can_access_agenda();
drop sequence if exists public.agendamento_codigo_seq;

drop function if exists public.localizacao_bairro_painel(uuid);
drop function if exists public.localizacao_overview_stats();
drop function if exists public.soft_delete_localizacao_endereco(uuid);
drop function if exists public.soft_delete_localizacao_pessoa(uuid);

drop table if exists public.localizacao_chegadas;
drop table if exists public.localizacao_registros_fotograficos;
drop table if exists public.localizacao_rotas_salvas;
drop table if exists public.localizacao_diligencias;
drop table if exists public.localizacao_pessoas;
drop table if exists public.localizacao_enderecos;
drop table if exists public.localizacao_bairros;

drop function if exists private.sync_localizacao_endereco_bairro();
drop function if exists private.prepare_localizacao_row();
drop function if exists private.audit_localizacao_row_change();
drop function if exists public.current_user_can_access_localizacao();
drop sequence if exists public.localizacao_diligencia_codigo_seq;
