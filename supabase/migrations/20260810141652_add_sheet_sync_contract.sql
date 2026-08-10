-- Contrato seguro de sincronizacao da planilha oficial da DT com o SIPI.
-- A integracao usa chaves tecnicas persistentes, exclusao logica, idempotencia
-- e um RPC transacional disponivel exclusivamente ao service_role.

create extension if not exists pgcrypto;

alter table public.inqueritos
  add column if not exists sheet_source_id text,
  add column if not exists sheet_name text,
  add column if not exists sheet_record_key text,
  add column if not exists sheet_row_number integer,
  add column if not exists sheet_payload_hash text,
  add column if not exists sheet_synced_at timestamptz,
  add column if not exists sheet_deleted_at timestamptz;

alter table public.representacoes
  add column if not exists origem_registro text,
  add column if not exists sheet_source_id text,
  add column if not exists sheet_name text,
  add column if not exists sheet_record_key text,
  add column if not exists sheet_row_number integer,
  add column if not exists sheet_payload_hash text,
  add column if not exists sheet_synced_at timestamptz,
  add column if not exists sheet_deleted_at timestamptz;

alter table public.inqueritos
  drop constraint if exists inqueritos_origem_registro_check;

alter table public.inqueritos
  add constraint inqueritos_origem_registro_check
  check (
    origem_registro is null
    or origem_registro in ('novo', 'restaurado', 'relacionado', 'migrado', 'planilha_oficial')
  ) not valid;

alter table public.representacoes
  drop constraint if exists representacoes_origem_registro_check;

alter table public.representacoes
  add constraint representacoes_origem_registro_check
  check (
    origem_registro is null
    or origem_registro in ('novo', 'restaurado', 'relacionado', 'migrado', 'planilha_oficial')
  ) not valid;

create unique index if not exists inqueritos_sheet_source_record_uidx
  on public.inqueritos (sheet_source_id, sheet_record_key)
  where sheet_source_id is not null and sheet_record_key is not null;

create unique index if not exists representacoes_sheet_source_record_uidx
  on public.representacoes (sheet_source_id, sheet_record_key)
  where sheet_source_id is not null and sheet_record_key is not null;

create index if not exists inqueritos_sheet_sync_lookup_idx
  on public.inqueritos (sheet_source_id, sheet_name, sheet_synced_at desc)
  where sheet_source_id is not null;

create index if not exists representacoes_sheet_sync_lookup_idx
  on public.representacoes (sheet_source_id, sheet_name, sheet_synced_at desc)
  where sheet_source_id is not null;

comment on column public.inqueritos.sheet_record_key is
  'Identificador tecnico persistente da linha na planilha; nunca depende do numero da linha ou apenas do PPE.';
comment on column public.representacoes.sheet_record_key is
  'Identificador tecnico persistente da linha na planilha; nunca depende do numero da linha ou apenas do PPE.';

create table if not exists public.sheet_sync_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  source_document_id text not null,
  source_sheet_name text not null,
  source_record_key text not null,
  entity text not null check (entity in ('inquerito', 'representacao')),
  action text not null check (action in ('create', 'update', 'delete', 'restore', 'noop')),
  status text not null check (status in ('applied', 'ignored')),
  entity_id uuid,
  payload_hash text,
  sheet_row_number integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sheet_sync_events_source_created_idx
  on public.sheet_sync_events (source_document_id, created_at desc);

create index if not exists sheet_sync_events_record_created_idx
  on public.sheet_sync_events (source_document_id, source_record_key, created_at desc);

alter table public.sheet_sync_events enable row level security;

drop policy if exists sheet_sync_events_privileged_select on public.sheet_sync_events;
create policy sheet_sync_events_privileged_select
on public.sheet_sync_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.cargo in ('admin', 'delegado')
  )
);

revoke all on table public.sheet_sync_events from public, anon, authenticated;
grant select on table public.sheet_sync_events to authenticated;

create or replace function public.apply_sheet_sync_record(
  p_request_id uuid,
  p_source_document_id text,
  p_source_sheet_name text,
  p_source_record_key text,
  p_entity text,
  p_operation text,
  p_payload jsonb default '{}'::jsonb,
  p_payload_hash text default null,
  p_sheet_row_number integer default null,
  p_existing_codigo_interno text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sync_actor constant uuid := '00000000-0000-4000-8000-000000000042'::uuid;
  v_started_at timestamptz := clock_timestamp();
  v_now timestamptz := now();
  v_entity_id uuid;
  v_action text;
  v_previous_deleted_at timestamptz;
  v_existing_event public.sheet_sync_events%rowtype;
  v_inquerito public.inqueritos%rowtype;
  v_representacao public.representacoes%rowtype;
  v_unknown_keys text[];
begin
  if p_request_id is null then
    raise exception 'sheet_sync_request_id_required' using errcode = '22023';
  end if;

  select * into v_existing_event
  from public.sheet_sync_events
  where request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'requestId', v_existing_event.request_id,
      'entity', v_existing_event.entity,
      'entityId', v_existing_event.entity_id,
      'action', v_existing_event.action,
      'status', v_existing_event.status,
      'idempotentReplay', true
    );
  end if;

  if nullif(btrim(coalesce(p_source_document_id, '')), '') is null
     or nullif(btrim(coalesce(p_source_sheet_name, '')), '') is null
     or nullif(btrim(coalesce(p_source_record_key, '')), '') is null then
    raise exception 'sheet_sync_source_identity_required' using errcode = '22023';
  end if;

  if p_entity not in ('inquerito', 'representacao') then
    raise exception 'sheet_sync_invalid_entity' using errcode = '22023';
  end if;

  if p_operation not in ('upsert', 'delete') then
    raise exception 'sheet_sync_invalid_operation' using errcode = '22023';
  end if;

  if p_sheet_row_number is not null and p_sheet_row_number < 2 then
    raise exception 'sheet_sync_invalid_row_number' using errcode = '22023';
  end if;

  -- O trigger institucional continua exigindo autor. Este ator sintetico so pode
  -- ser assumido dentro deste RPC, cujo EXECUTE pertence exclusivamente ao
  -- service_role. A auditoria resultante e rotulada como integracao automatica.
  perform set_config('request.jwt.claim.sub', v_sync_actor::text, true);

  if p_entity = 'inquerito' then
    select id, deleted_at
      into v_entity_id, v_previous_deleted_at
    from public.inqueritos
    where sheet_source_id = btrim(p_source_document_id)
      and sheet_record_key = btrim(p_source_record_key);

    if v_entity_id is null and nullif(btrim(coalesce(p_existing_codigo_interno, '')), '') is not null then
      select id, deleted_at
        into v_entity_id, v_previous_deleted_at
      from public.inqueritos
      where codigo_interno = btrim(p_existing_codigo_interno)
        and sheet_source_id is null;

      if v_entity_id is null then
        raise exception 'sheet_sync_bootstrap_target_not_found' using errcode = 'P0002';
      end if;
    end if;

    if p_operation = 'delete' then
      if v_entity_id is null then
        v_action := 'noop';
      elsif v_previous_deleted_at is not null then
        v_action := 'noop';
      else
        update public.inqueritos
        set deleted_at = v_now,
            sheet_deleted_at = v_now,
            sheet_synced_at = v_now,
            sheet_payload_hash = nullif(btrim(coalesce(p_payload_hash, '')), ''),
            sheet_row_number = p_sheet_row_number,
            updated_at = v_now
        where id = v_entity_id;
        v_action := 'delete';
      end if;
    else
      select array_agg(key order by key)
        into v_unknown_keys
      from jsonb_object_keys(coalesce(p_payload, '{}'::jsonb)) as supplied(key)
      where key <> all (array[
        'numero_ppe','numero_fisico','numero_bo','tipo','tipificacao','gravidade','prioridade',
        'situacao','status_diligencias','data_fato','data_instauracao','prazo','bairro','distrito',
        'vitima','investigado','reu_preso','elucidado','faccao','nome_faccao','equipe','escrivao',
        'relatorio_enviado','data_envio_relatorio','medida_protetiva','numero_processo_medida',
        'observacoes','motivacao','diligencias_pendentes','representacoes_legais','dias_decorridos',
        'autoria_determinada'
      ]::text[]);

      if v_unknown_keys is not null then
        raise exception 'sheet_sync_unknown_inquerito_fields: %', array_to_string(v_unknown_keys, ',')
          using errcode = '22023';
      end if;

      v_inquerito := jsonb_populate_record(null::public.inqueritos, coalesce(p_payload, '{}'::jsonb));

      if v_entity_id is null then
        insert into public.inqueritos (
          codigo_interno, numero_ppe, numero_fisico, numero_bo, tipo, tipificacao, gravidade,
          prioridade, situacao, status_diligencias, data_fato, data_instauracao, prazo, bairro,
          distrito, vitima, investigado, reu_preso, elucidado, faccao, nome_faccao, equipe,
          escrivao, relatorio_enviado, data_envio_relatorio, medida_protetiva,
          numero_processo_medida, observacoes, motivacao, diligencias_pendentes,
          representacoes_legais, dias_decorridos, autoria_determinada, origem_registro,
          sheet_source_id, sheet_name, sheet_record_key, sheet_row_number, sheet_payload_hash,
          sheet_synced_at, sheet_deleted_at, deleted_at
        ) values (
          'SHEET-INQ-' || upper(substr(encode(digest(p_source_document_id || ':' || p_source_sheet_name || ':' || p_source_record_key, 'sha256'), 'hex'), 1, 20)),
          v_inquerito.numero_ppe, v_inquerito.numero_fisico, v_inquerito.numero_bo,
          v_inquerito.tipo, v_inquerito.tipificacao, v_inquerito.gravidade, v_inquerito.prioridade,
          v_inquerito.situacao, v_inquerito.status_diligencias, v_inquerito.data_fato,
          v_inquerito.data_instauracao, v_inquerito.prazo, v_inquerito.bairro,
          v_inquerito.distrito, v_inquerito.vitima, v_inquerito.investigado,
          v_inquerito.reu_preso, v_inquerito.elucidado, v_inquerito.faccao,
          v_inquerito.nome_faccao, v_inquerito.equipe, v_inquerito.escrivao,
          v_inquerito.relatorio_enviado, v_inquerito.data_envio_relatorio,
          v_inquerito.medida_protetiva, v_inquerito.numero_processo_medida,
          v_inquerito.observacoes, v_inquerito.motivacao, v_inquerito.diligencias_pendentes,
          v_inquerito.representacoes_legais, v_inquerito.dias_decorridos,
          v_inquerito.autoria_determinada, 'planilha_oficial', btrim(p_source_document_id),
          btrim(p_source_sheet_name), btrim(p_source_record_key), p_sheet_row_number,
          nullif(btrim(coalesce(p_payload_hash, '')), ''), v_now, null, null
        ) returning id into v_entity_id;
        v_action := 'create';
      else
        update public.inqueritos
        set numero_ppe = v_inquerito.numero_ppe,
            numero_fisico = v_inquerito.numero_fisico,
            numero_bo = v_inquerito.numero_bo,
            tipo = v_inquerito.tipo,
            tipificacao = v_inquerito.tipificacao,
            gravidade = v_inquerito.gravidade,
            prioridade = v_inquerito.prioridade,
            situacao = v_inquerito.situacao,
            status_diligencias = v_inquerito.status_diligencias,
            data_fato = v_inquerito.data_fato,
            data_instauracao = v_inquerito.data_instauracao,
            prazo = v_inquerito.prazo,
            bairro = v_inquerito.bairro,
            distrito = v_inquerito.distrito,
            vitima = v_inquerito.vitima,
            investigado = v_inquerito.investigado,
            reu_preso = v_inquerito.reu_preso,
            elucidado = v_inquerito.elucidado,
            faccao = v_inquerito.faccao,
            nome_faccao = v_inquerito.nome_faccao,
            equipe = v_inquerito.equipe,
            escrivao = v_inquerito.escrivao,
            relatorio_enviado = v_inquerito.relatorio_enviado,
            data_envio_relatorio = v_inquerito.data_envio_relatorio,
            medida_protetiva = v_inquerito.medida_protetiva,
            numero_processo_medida = v_inquerito.numero_processo_medida,
            observacoes = v_inquerito.observacoes,
            motivacao = v_inquerito.motivacao,
            diligencias_pendentes = v_inquerito.diligencias_pendentes,
            representacoes_legais = v_inquerito.representacoes_legais,
            dias_decorridos = v_inquerito.dias_decorridos,
            autoria_determinada = v_inquerito.autoria_determinada,
            origem_registro = case when sheet_source_id is null then origem_registro else 'planilha_oficial' end,
            sheet_source_id = btrim(p_source_document_id),
            sheet_name = btrim(p_source_sheet_name),
            sheet_record_key = btrim(p_source_record_key),
            sheet_row_number = p_sheet_row_number,
            sheet_payload_hash = nullif(btrim(coalesce(p_payload_hash, '')), ''),
            sheet_synced_at = v_now,
            sheet_deleted_at = null,
            deleted_at = null,
            updated_at = v_now
        where id = v_entity_id;
        v_action := case when v_previous_deleted_at is null then 'update' else 'restore' end;
      end if;
    end if;
  else
    select id, deleted_at
      into v_entity_id, v_previous_deleted_at
    from public.representacoes
    where sheet_source_id = btrim(p_source_document_id)
      and sheet_record_key = btrim(p_source_record_key);

    if v_entity_id is null and nullif(btrim(coalesce(p_existing_codigo_interno, '')), '') is not null then
      select id, deleted_at
        into v_entity_id, v_previous_deleted_at
      from public.representacoes
      where codigo_interno = btrim(p_existing_codigo_interno)
        and sheet_source_id is null;

      if v_entity_id is null then
        raise exception 'sheet_sync_bootstrap_target_not_found' using errcode = 'P0002';
      end if;
    end if;

    if p_operation = 'delete' then
      if v_entity_id is null then
        v_action := 'noop';
      elsif v_previous_deleted_at is not null then
        v_action := 'noop';
      else
        update public.representacoes
        set deleted_at = v_now,
            sheet_deleted_at = v_now,
            sheet_synced_at = v_now,
            sheet_payload_hash = nullif(btrim(coalesce(p_payload_hash, '')), ''),
            sheet_row_number = p_sheet_row_number,
            updated_at = v_now
        where id = v_entity_id;
        v_action := 'delete';
      end if;
    else
      select array_agg(key order by key)
        into v_unknown_keys
      from jsonb_object_keys(coalesce(p_payload, '{}'::jsonb)) as supplied(key)
      where key <> all (array[
        'numero_ppe','processo_judicial','tipo','data_representacao','responsavel','vitima',
        'investigado','status','data_decisao_judicial','observacoes_decisao','data_cumprimento',
        'equipe_cumprimento','resultado_cumprimento','observacoes_cumprimento',
        'vara_juizo','prazo_concedido_dias','data_vencimento','equipe_responsavel',
        'cumprimento_status','observacoes_internas'
      ]::text[]);

      if v_unknown_keys is not null then
        raise exception 'sheet_sync_unknown_representacao_fields: %', array_to_string(v_unknown_keys, ',')
          using errcode = '22023';
      end if;

      v_representacao := jsonb_populate_record(null::public.representacoes, coalesce(p_payload, '{}'::jsonb));

      if v_entity_id is null then
        insert into public.representacoes (
          codigo_interno, numero_ppe, processo_judicial, tipo, data_representacao,
          responsavel, vitima, investigado, status, data_decisao_judicial,
          observacoes_decisao, data_cumprimento, equipe_cumprimento,
          resultado_cumprimento, observacoes_cumprimento, vara_juizo,
          prazo_concedido_dias, data_vencimento, equipe_responsavel,
          cumprimento_status, observacoes_internas, origem_registro,
          sheet_source_id, sheet_name, sheet_record_key, sheet_row_number,
          sheet_payload_hash, sheet_synced_at, sheet_deleted_at, deleted_at
        ) values (
          'SHEET-REP-' || upper(substr(encode(digest(p_source_document_id || ':' || p_source_sheet_name || ':' || p_source_record_key, 'sha256'), 'hex'), 1, 20)),
          v_representacao.numero_ppe, v_representacao.processo_judicial,
          v_representacao.tipo, v_representacao.data_representacao,
          v_representacao.responsavel, v_representacao.vitima,
          v_representacao.investigado, v_representacao.status,
          v_representacao.data_decisao_judicial, v_representacao.observacoes_decisao,
          v_representacao.data_cumprimento, v_representacao.equipe_cumprimento,
          v_representacao.resultado_cumprimento, v_representacao.observacoes_cumprimento,
          v_representacao.vara_juizo, v_representacao.prazo_concedido_dias,
          v_representacao.data_vencimento, v_representacao.equipe_responsavel,
          v_representacao.cumprimento_status, v_representacao.observacoes_internas,
          'planilha_oficial', btrim(p_source_document_id), btrim(p_source_sheet_name),
          btrim(p_source_record_key), p_sheet_row_number,
          nullif(btrim(coalesce(p_payload_hash, '')), ''), v_now, null, null
        ) returning id into v_entity_id;
        v_action := 'create';
      else
        update public.representacoes
        set numero_ppe = v_representacao.numero_ppe,
            processo_judicial = v_representacao.processo_judicial,
            tipo = v_representacao.tipo,
            data_representacao = v_representacao.data_representacao,
            responsavel = v_representacao.responsavel,
            vitima = v_representacao.vitima,
            investigado = v_representacao.investigado,
            status = v_representacao.status,
            data_decisao_judicial = v_representacao.data_decisao_judicial,
            observacoes_decisao = v_representacao.observacoes_decisao,
            data_cumprimento = v_representacao.data_cumprimento,
            equipe_cumprimento = v_representacao.equipe_cumprimento,
            resultado_cumprimento = v_representacao.resultado_cumprimento,
            observacoes_cumprimento = v_representacao.observacoes_cumprimento,
            vara_juizo = v_representacao.vara_juizo,
            prazo_concedido_dias = v_representacao.prazo_concedido_dias,
            data_vencimento = v_representacao.data_vencimento,
            equipe_responsavel = v_representacao.equipe_responsavel,
            cumprimento_status = v_representacao.cumprimento_status,
            observacoes_internas = v_representacao.observacoes_internas,
            origem_registro = case when sheet_source_id is null then origem_registro else 'planilha_oficial' end,
            sheet_source_id = btrim(p_source_document_id),
            sheet_name = btrim(p_source_sheet_name),
            sheet_record_key = btrim(p_source_record_key),
            sheet_row_number = p_sheet_row_number,
            sheet_payload_hash = nullif(btrim(coalesce(p_payload_hash, '')), ''),
            sheet_synced_at = v_now,
            sheet_deleted_at = null,
            deleted_at = null,
            updated_at = v_now
        where id = v_entity_id;
        v_action := case when v_previous_deleted_at is null then 'update' else 'restore' end;
      end if;
    end if;
  end if;

  -- Enriquece o evento produzido pelo trigger institucional sem registrar o
  -- conteudo sensivel da linha no log.
  update public.auditoria
  set executor_nome = 'Integracao Google Planilhas',
      executor_email = 'sistema.planilhas@sipi.local',
      executor_login = 'sheet_sync',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'google_sheets_sync',
        'source_document_id', btrim(p_source_document_id),
        'source_sheet_name', btrim(p_source_sheet_name),
        'source_record_key', btrim(p_source_record_key),
        'request_id', p_request_id,
        'payload_hash', nullif(btrim(coalesce(p_payload_hash, '')), '')
      )
  where executor_user_id = v_sync_actor
    and entidade_id = v_entity_id::text
    and created_at >= v_started_at;

  insert into public.sheet_sync_events (
    request_id, source_document_id, source_sheet_name, source_record_key,
    entity, action, status, entity_id, payload_hash, sheet_row_number, metadata
  ) values (
    p_request_id, btrim(p_source_document_id), btrim(p_source_sheet_name),
    btrim(p_source_record_key), p_entity, v_action,
    case when v_action = 'noop' then 'ignored' else 'applied' end,
    v_entity_id, nullif(btrim(coalesce(p_payload_hash, '')), ''), p_sheet_row_number,
    jsonb_build_object('operation', p_operation)
  );

  return jsonb_build_object(
    'requestId', p_request_id,
    'entity', p_entity,
    'entityId', v_entity_id,
    'action', v_action,
    'status', case when v_action = 'noop' then 'ignored' else 'applied' end,
    'idempotentReplay', false
  );
end;
$function$;

revoke all on function public.apply_sheet_sync_record(
  uuid, text, text, text, text, text, jsonb, text, integer, text
) from public, anon, authenticated;

grant execute on function public.apply_sheet_sync_record(
  uuid, text, text, text, text, text, jsonb, text, integer, text
) to service_role;

comment on function public.apply_sheet_sync_record(
  uuid, text, text, text, text, text, jsonb, text, integer, text
) is 'Aplica uma mutacao idempotente da planilha oficial com exclusao logica e auditoria transacional.';
