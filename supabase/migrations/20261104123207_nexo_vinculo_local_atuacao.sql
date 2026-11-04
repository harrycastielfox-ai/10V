-- Local de atuacao pertence ao vinculo organizacional, nao ao endereco residencial.
alter table public.nexo_vinculos
  add column municipio_atuacao text,
  add column uf_atuacao text,
  add constraint nexo_vinculos_uf_atuacao_check
    check (uf_atuacao is null or uf_atuacao ~ '^[A-Z]{2}$');

alter table public.nexo_hierarquia_eventos
  add column municipio_atuacao_anterior text,
  add column municipio_atuacao_novo text,
  add column uf_atuacao_anterior text,
  add column uf_atuacao_novo text;

-- Os wrappers atomicos antigos recebem JSON. Este trigger permite propagar os
-- novos campos na mesma transacao sem duplicar centenas de linhas das funcoes.
create function private.prepare_nexo_link_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payload_text text := current_setting('app.nexo_link_location_payload', true);
  v_payload jsonb;
begin
  if nullif(v_payload_text, '') is not null then
    v_payload := v_payload_text::jsonb;
  end if;
  if v_payload is not null and v_payload ? 'municipio_atuacao' then
    new.municipio_atuacao := nullif(btrim(v_payload ->> 'municipio_atuacao'), '');
  else
    new.municipio_atuacao := nullif(btrim(new.municipio_atuacao), '');
  end if;
  if v_payload is not null and v_payload ? 'uf_atuacao' then
    new.uf_atuacao := upper(nullif(btrim(v_payload ->> 'uf_atuacao'), ''));
  else
    new.uf_atuacao := upper(nullif(btrim(new.uf_atuacao), ''));
  end if;
  return new;
end;
$function$;

revoke all on function private.prepare_nexo_link_location() from public, anon, authenticated;

create trigger prepare_nexo_link_location
before insert or update of municipio_atuacao, uf_atuacao, status, funcao,
  confianca, fonte_resumo, superior_vinculo_id, organizacao_id
on public.nexo_vinculos
for each row execute function private.prepare_nexo_link_location();

create or replace function private.track_nexo_hierarchy()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  v_old_superior text;
  v_new_superior text;
  v_person_name text;
begin
  if tg_op = 'UPDATE' and old.funcao is not distinct from new.funcao
      and old.superior_vinculo_id is not distinct from new.superior_vinculo_id
      and old.status is not distinct from new.status
      and old.organizacao_id is not distinct from new.organizacao_id
      and old.municipio_atuacao is not distinct from new.municipio_atuacao
      and old.uf_atuacao is not distinct from new.uf_atuacao
      and old.deleted_at is not distinct from new.deleted_at then
    return new;
  end if;

  select nome into v_person_name from public.nexo_pessoas where id = new.pessoa_id;
  if tg_op = 'UPDATE' and old.superior_vinculo_id is not null then
    select p.nome into v_old_superior from public.nexo_vinculos v
      join public.nexo_pessoas p on p.id = v.pessoa_id
      where v.id = old.superior_vinculo_id;
  end if;
  if new.superior_vinculo_id is not null then
    select p.nome into v_new_superior from public.nexo_vinculos v
      join public.nexo_pessoas p on p.id = v.pessoa_id
      where v.id = new.superior_vinculo_id;
  end if;

  insert into public.nexo_hierarquia_eventos (
    organizacao_id, pessoa_id, vinculo_id, tipo, funcao_anterior, funcao_nova,
    superior_anterior_nome, superior_novo_nome, status_anterior, status_novo,
    municipio_atuacao_anterior, municipio_atuacao_novo,
    uf_atuacao_anterior, uf_atuacao_novo,
    pessoa_nome, justificativa, autor_id
  ) values (
    new.organizacao_id, new.pessoa_id, new.id,
    case when new.status = 'desvinculado' then 'saida'
      when tg_op = 'INSERT' then 'entrada' else 'alteracao' end,
    case when tg_op = 'UPDATE' then old.funcao else null end, new.funcao,
    v_old_superior, v_new_superior,
    case when tg_op = 'UPDATE' then old.status else null end, new.status,
    case when tg_op = 'UPDATE' then old.municipio_atuacao else null end,
    new.municipio_atuacao,
    case when tg_op = 'UPDATE' then old.uf_atuacao else null end,
    new.uf_atuacao,
    coalesce(v_person_name, 'Pessoa'), new.fonte_resumo, auth.uid()
  );

  if tg_op = 'UPDATE' and new.status = 'desvinculado' and old.status <> 'desvinculado'
    or tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null
    or tg_op = 'UPDATE' and new.organizacao_id is distinct from old.organizacao_id then
    update public.nexo_vinculos
      set superior_vinculo_id = null, updated_by = auth.uid()
      where superior_vinculo_id = new.id and deleted_at is null;
  end if;
  return new;
end;
$function$;

drop trigger track_nexo_hierarchy on public.nexo_vinculos;
create trigger track_nexo_hierarchy after insert or update of
  funcao, superior_vinculo_id, status, organizacao_id, municipio_atuacao,
  uf_atuacao, deleted_at on public.nexo_vinculos
  for each row execute function private.track_nexo_hierarchy();

-- Preserva a implementacao validada e cria wrappers incrementais. As funcoes
-- internas ficam fora do schema exposto pela Data API.
alter function public.nexo_gerenciar_vinculo(uuid, text, uuid, text, text, smallint, text, uuid)
  set schema private;
alter function private.nexo_gerenciar_vinculo(uuid, text, uuid, text, text, smallint, text, uuid)
  rename to nexo_gerenciar_vinculo_sem_local_atuacao;

create function public.nexo_gerenciar_vinculo(
  p_vinculo_id uuid, p_acao text, p_organizacao_id uuid default null,
  p_status text default 'nao_confirmado', p_funcao text default null,
  p_confianca smallint default 0, p_fonte_resumo text default null,
  p_superior_vinculo_id uuid default null
)
returns uuid language sql security invoker set search_path = '' as $function$
  select private.nexo_gerenciar_vinculo_sem_local_atuacao(
    p_vinculo_id, p_acao, p_organizacao_id, p_status, p_funcao,
    p_confianca, p_fonte_resumo, p_superior_vinculo_id
  );
$function$;

create function public.nexo_gerenciar_vinculo(
  p_vinculo_id uuid, p_acao text, p_organizacao_id uuid,
  p_status text, p_funcao text, p_confianca smallint,
  p_fonte_resumo text, p_superior_vinculo_id uuid,
  p_municipio_atuacao text, p_uf_atuacao text
)
returns uuid language plpgsql security invoker set search_path = '' as $function$
begin
  perform set_config(
    'app.nexo_link_location_payload',
    jsonb_build_object(
      'municipio_atuacao', p_municipio_atuacao,
      'uf_atuacao', p_uf_atuacao
    )::text,
    true
  );
  return private.nexo_gerenciar_vinculo_sem_local_atuacao(
    p_vinculo_id, p_acao, p_organizacao_id, p_status, p_funcao,
    p_confianca, p_fonte_resumo, p_superior_vinculo_id
  );
end;
$function$;

alter function public.nexo_criar_pessoa_completa(jsonb) set schema private;
alter function private.nexo_criar_pessoa_completa(jsonb)
  rename to nexo_criar_pessoa_completa_sem_local_atuacao;

create function public.nexo_criar_pessoa_completa(p_payload jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $function$
declare
  v_vinculo jsonb := p_payload -> 'vinculo';
begin
  if v_vinculo is not null and jsonb_typeof(v_vinculo) = 'object'
      and (v_vinculo ? 'municipio_atuacao' or v_vinculo ? 'uf_atuacao') then
    perform set_config(
      'app.nexo_link_location_payload',
      jsonb_build_object(
        'municipio_atuacao', v_vinculo ->> 'municipio_atuacao',
        'uf_atuacao', v_vinculo ->> 'uf_atuacao'
      )::text,
      true
    );
  else
    perform set_config('app.nexo_link_location_payload', '', true);
  end if;
  return private.nexo_criar_pessoa_completa_sem_local_atuacao(p_payload);
end;
$function$;

alter function public.nexo_atualizar_pessoa_completa(uuid, timestamptz, jsonb)
  set schema private;
alter function private.nexo_atualizar_pessoa_completa(uuid, timestamptz, jsonb)
  rename to nexo_atualizar_pessoa_completa_sem_local_atuacao;

create function public.nexo_atualizar_pessoa_completa(
  p_pessoa_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb
)
returns timestamptz language plpgsql security invoker set search_path = '' as $function$
declare
  v_vinculo jsonb := p_payload -> 'vinculo';
begin
  if v_vinculo is not null and jsonb_typeof(v_vinculo) = 'object'
      and (v_vinculo ? 'municipio_atuacao' or v_vinculo ? 'uf_atuacao') then
    perform set_config(
      'app.nexo_link_location_payload',
      jsonb_build_object(
        'municipio_atuacao', v_vinculo ->> 'municipio_atuacao',
        'uf_atuacao', v_vinculo ->> 'uf_atuacao'
      )::text,
      true
    );
  else
    perform set_config('app.nexo_link_location_payload', '', true);
  end if;
  return private.nexo_atualizar_pessoa_completa_sem_local_atuacao(
    p_pessoa_id, p_expected_updated_at, p_payload
  );
end;
$function$;

revoke all on function private.nexo_gerenciar_vinculo_sem_local_atuacao(
  uuid, text, uuid, text, text, smallint, text, uuid
) from public, anon;
grant execute on function private.nexo_gerenciar_vinculo_sem_local_atuacao(
  uuid, text, uuid, text, text, smallint, text, uuid
) to authenticated;
revoke all on function private.nexo_criar_pessoa_completa_sem_local_atuacao(jsonb)
  from public, anon;
grant execute on function private.nexo_criar_pessoa_completa_sem_local_atuacao(jsonb)
  to authenticated;
revoke all on function private.nexo_atualizar_pessoa_completa_sem_local_atuacao(
  uuid, timestamptz, jsonb
) from public, anon;
grant execute on function private.nexo_atualizar_pessoa_completa_sem_local_atuacao(
  uuid, timestamptz, jsonb
) to authenticated;

revoke all on function public.nexo_gerenciar_vinculo(
  uuid, text, uuid, text, text, smallint, text, uuid
) from public, anon;
grant execute on function public.nexo_gerenciar_vinculo(
  uuid, text, uuid, text, text, smallint, text, uuid
) to authenticated;
revoke all on function public.nexo_gerenciar_vinculo(
  uuid, text, uuid, text, text, smallint, text, uuid, text, text
) from public, anon;
grant execute on function public.nexo_gerenciar_vinculo(
  uuid, text, uuid, text, text, smallint, text, uuid, text, text
) to authenticated;
revoke all on function public.nexo_criar_pessoa_completa(jsonb) from public, anon;
grant execute on function public.nexo_criar_pessoa_completa(jsonb) to authenticated;
revoke all on function public.nexo_atualizar_pessoa_completa(uuid, timestamptz, jsonb)
  from public, anon;
grant execute on function public.nexo_atualizar_pessoa_completa(uuid, timestamptz, jsonb)
  to authenticated;
