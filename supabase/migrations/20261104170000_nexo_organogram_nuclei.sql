-- Agrupamentos internos explícitos para o Organograma 2.0.
-- Um núcleo pertence à organização; a participação pertence ao vínculo.
create table public.nexo_nucleos (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.nexo_organizacoes(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  descricao text,
  cor text not null default '#0f766e' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  ordem integer not null default 0 check (ordem >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  deleted_at timestamptz
);

create unique index nexo_nucleos_org_nome_ativo_idx
  on public.nexo_nucleos (organizacao_id, lower(nome))
  where deleted_at is null;
create index nexo_nucleos_org_ordem_idx
  on public.nexo_nucleos (organizacao_id, ordem, nome)
  where deleted_at is null;

alter table public.nexo_vinculos
  add column nucleo_id uuid references public.nexo_nucleos(id) on delete set null;
create index nexo_vinculos_nucleo_idx
  on public.nexo_vinculos (nucleo_id)
  where nucleo_id is not null and deleted_at is null;

alter table public.nexo_hierarquia_eventos
  add column nucleo_anterior_nome text,
  add column nucleo_novo_nome text;

create trigger prepare_nexo_nucleo
before insert or update on public.nexo_nucleos
for each row execute function private.prepare_nexo_row();

create trigger audit_nexo_nucleo
after insert or update on public.nexo_nucleos
for each row execute function private.audit_nexo_row_change();

alter table public.nexo_nucleos enable row level security;

create policy nexo_nucleos_select on public.nexo_nucleos
for select to authenticated
using (deleted_at is null and (select public.current_user_can_access_nexo()));

create policy nexo_nucleos_insert on public.nexo_nucleos
for insert to authenticated
with check (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy nexo_nucleos_update on public.nexo_nucleos
for update to authenticated
using (deleted_at is null and (select public.current_user_can_access_nexo()))
with check (
  (select public.current_user_can_access_nexo())
  and updated_by = (select auth.uid())
);

revoke all on table public.nexo_nucleos from public, anon, authenticated;
grant select, insert, update on table public.nexo_nucleos to authenticated;

create function private.validate_nexo_link_nucleus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_organizacao_id uuid;
begin
  if new.status = 'desvinculado' or new.deleted_at is not null then
    new.nucleo_id := null;
  end if;
  if new.nucleo_id is null then
    return new;
  end if;

  select organizacao_id into v_organizacao_id
  from public.nexo_nucleos
  where id = new.nucleo_id and deleted_at is null;

  if not found or v_organizacao_id <> new.organizacao_id then
    raise exception 'nexo_nucleo_invalido' using errcode = '22023';
  end if;
  return new;
end;
$function$;

revoke all on function private.validate_nexo_link_nucleus()
from public, anon, authenticated;

create trigger validate_nexo_link_nucleus
before insert or update of nucleo_id, organizacao_id, status, deleted_at
on public.nexo_vinculos
for each row execute function private.validate_nexo_link_nucleus();

-- Permite que o wrapper de gestão aplique núcleo na mesma alteração que já
-- registra função, chefia, situação e cidade, evitando dois eventos artificiais.
create function private.prepare_nexo_link_nucleus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payload_text text := current_setting('app.nexo_link_nucleus_payload', true);
  v_payload jsonb;
  v_target_pessoa_id uuid;
begin
  if nullif(v_payload_text, '') is not null then
    v_payload := v_payload_text::jsonb;
  end if;
  if v_payload is not null and v_payload ? 'pessoa_id' then
    v_target_pessoa_id := nullif(v_payload ->> 'pessoa_id', '')::uuid;
  end if;
  if v_payload is not null
      and v_payload ? 'nucleo_id'
      and new.status <> 'desvinculado'
      and (v_target_pessoa_id is null or new.pessoa_id = v_target_pessoa_id) then
    new.nucleo_id := nullif(v_payload ->> 'nucleo_id', '')::uuid;
  end if;
  return new;
end;
$function$;

revoke all on function private.prepare_nexo_link_nucleus()
from public, anon, authenticated;

create trigger prepare_nexo_link_nucleus
before insert or update of status, funcao, confianca, fonte_resumo,
  superior_vinculo_id, organizacao_id
on public.nexo_vinculos
for each row execute function private.prepare_nexo_link_nucleus();

create or replace function private.track_nexo_hierarchy()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  v_old_superior text;
  v_new_superior text;
  v_old_nucleus text;
  v_new_nucleus text;
  v_person_name text;
begin
  if tg_op = 'UPDATE' and old.funcao is not distinct from new.funcao
      and old.superior_vinculo_id is not distinct from new.superior_vinculo_id
      and old.status is not distinct from new.status
      and old.organizacao_id is not distinct from new.organizacao_id
      and old.municipio_atuacao is not distinct from new.municipio_atuacao
      and old.uf_atuacao is not distinct from new.uf_atuacao
      and old.nucleo_id is not distinct from new.nucleo_id
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
  if tg_op = 'UPDATE' and old.nucleo_id is not null then
    select nome into v_old_nucleus from public.nexo_nucleos where id = old.nucleo_id;
  end if;
  if new.nucleo_id is not null then
    select nome into v_new_nucleus from public.nexo_nucleos where id = new.nucleo_id;
  end if;

  insert into public.nexo_hierarquia_eventos (
    organizacao_id, pessoa_id, vinculo_id, tipo, funcao_anterior, funcao_nova,
    superior_anterior_nome, superior_novo_nome, status_anterior, status_novo,
    municipio_atuacao_anterior, municipio_atuacao_novo,
    uf_atuacao_anterior, uf_atuacao_novo,
    nucleo_anterior_nome, nucleo_novo_nome,
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
    v_old_nucleus, v_new_nucleus,
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

drop trigger if exists track_nexo_hierarchy on public.nexo_vinculos;
create trigger track_nexo_hierarchy after insert or update of
  funcao, superior_vinculo_id, status, organizacao_id, municipio_atuacao,
  uf_atuacao, nucleo_id, deleted_at on public.nexo_vinculos
for each row execute function private.track_nexo_hierarchy();

create function public.nexo_arquivar_nucleo(p_nucleo_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not (select public.current_user_can_access_nexo()) then
    raise exception 'nexo_access_denied' using errcode = '42501';
  end if;
  perform id from public.nexo_nucleos
  where id = p_nucleo_id and deleted_at is null
  for update;
  if not found then
    raise exception 'nexo_nucleo_nao_encontrado' using errcode = 'P0002';
  end if;

  update public.nexo_vinculos
  set nucleo_id = null, updated_by = auth.uid()
  where nucleo_id = p_nucleo_id and deleted_at is null;

  update public.nexo_nucleos
  set deleted_at = now(), updated_by = auth.uid()
  where id = p_nucleo_id;
  return p_nucleo_id;
end;
$function$;

revoke all on function public.nexo_arquivar_nucleo(uuid) from public, anon;
grant execute on function public.nexo_arquivar_nucleo(uuid) to authenticated;

create function public.nexo_gerenciar_vinculo(
  p_vinculo_id uuid, p_acao text, p_organizacao_id uuid,
  p_status text, p_funcao text, p_confianca smallint,
  p_fonte_resumo text, p_superior_vinculo_id uuid,
  p_municipio_atuacao text, p_uf_atuacao text, p_nucleo_id uuid
)
returns uuid language plpgsql security invoker set search_path = '' as $function$
declare
  v_pessoa_id uuid;
  v_result uuid;
begin
  select pessoa_id into v_pessoa_id
  from public.nexo_vinculos
  where id = p_vinculo_id;
  perform set_config(
    'app.nexo_link_nucleus_payload',
    jsonb_build_object('nucleo_id', p_nucleo_id, 'pessoa_id', v_pessoa_id)::text,
    true
  );
  v_result := public.nexo_gerenciar_vinculo(
    p_vinculo_id, p_acao, p_organizacao_id, p_status, p_funcao,
    p_confianca, p_fonte_resumo, p_superior_vinculo_id,
    p_municipio_atuacao, p_uf_atuacao
  );
  perform set_config('app.nexo_link_nucleus_payload', '', true);
  return v_result;
end;
$function$;

revoke all on function public.nexo_gerenciar_vinculo(
  uuid, text, uuid, text, text, smallint, text, uuid, text, text, uuid
) from public, anon;
grant execute on function public.nexo_gerenciar_vinculo(
  uuid, text, uuid, text, text, smallint, text, uuid, text, text, uuid
) to authenticated;
