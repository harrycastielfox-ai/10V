alter table public.nexo_vinculos
  add column superior_vinculo_id uuid references public.nexo_vinculos(id) on delete set null;

create index nexo_vinculos_superior_idx
  on public.nexo_vinculos (superior_vinculo_id) where superior_vinculo_id is not null;

create table public.nexo_hierarquia_eventos (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.nexo_organizacoes(id) on delete cascade,
  pessoa_id uuid not null references public.nexo_pessoas(id) on delete cascade,
  vinculo_id uuid not null references public.nexo_vinculos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'alteracao', 'saida')),
  funcao_anterior text,
  funcao_nova text,
  superior_anterior_nome text,
  superior_novo_nome text,
  status_anterior text,
  status_novo text,
  pessoa_nome text not null,
  justificativa text,
  ocorrido_em timestamptz not null default now(),
  autor_id uuid references public.profiles(id) on delete set null default auth.uid()
);

create index nexo_hierarquia_eventos_org_data_idx
  on public.nexo_hierarquia_eventos (organizacao_id, ocorrido_em desc);
create index nexo_hierarquia_eventos_pessoa_data_idx
  on public.nexo_hierarquia_eventos (pessoa_id, ocorrido_em desc);

alter table public.nexo_hierarquia_eventos enable row level security;
create policy nexo_hierarquia_eventos_select on public.nexo_hierarquia_eventos
  for select to authenticated
  using ((select public.current_user_can_access_nexo()));
revoke all on table public.nexo_hierarquia_eventos from public, anon, authenticated;
grant select on table public.nexo_hierarquia_eventos to authenticated;

create function private.validate_nexo_superior()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  v_superior public.nexo_vinculos%rowtype;
begin
  if new.status = 'desvinculado' or new.deleted_at is not null then
    new.superior_vinculo_id := null;
  end if;
  if new.superior_vinculo_id is null then return new; end if;
  if new.superior_vinculo_id = new.id then
    raise exception 'nexo_hierarquia_ciclo' using errcode = '22023';
  end if;
  select * into v_superior from public.nexo_vinculos
    where id = new.superior_vinculo_id and deleted_at is null and status <> 'desvinculado';
  if not found or v_superior.organizacao_id <> new.organizacao_id then
    raise exception 'nexo_superior_invalido' using errcode = '22023';
  end if;
  if exists (
    with recursive ancestrais as (
      select id, superior_vinculo_id from public.nexo_vinculos where id = new.superior_vinculo_id
      union all
      select pai.id, pai.superior_vinculo_id
      from public.nexo_vinculos pai join ancestrais a on pai.id = a.superior_vinculo_id
    )
    select 1 from ancestrais where id = new.id
  ) then
    raise exception 'nexo_hierarquia_ciclo' using errcode = '22023';
  end if;
  return new;
end;
$function$;

create trigger validate_nexo_superior before insert or update of
  superior_vinculo_id, organizacao_id, status, deleted_at on public.nexo_vinculos
  for each row execute function private.validate_nexo_superior();

create function private.track_nexo_hierarchy()
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
    pessoa_nome, justificativa, autor_id
  ) values (
    new.organizacao_id, new.pessoa_id, new.id,
    case when new.status = 'desvinculado' then 'saida'
      when tg_op = 'INSERT' then 'entrada' else 'alteracao' end,
    case when tg_op = 'UPDATE' then old.funcao else null end, new.funcao,
    v_old_superior, v_new_superior,
    case when tg_op = 'UPDATE' then old.status else null end, new.status,
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

create trigger track_nexo_hierarchy after insert or update of
  funcao, superior_vinculo_id, status, organizacao_id, deleted_at on public.nexo_vinculos
  for each row execute function private.track_nexo_hierarchy();

revoke all on function private.validate_nexo_superior() from public, anon, authenticated;
revoke all on function private.track_nexo_hierarchy() from public, anon, authenticated;

drop function public.nexo_gerenciar_vinculo(uuid, text, uuid, text, text, smallint, text);
create function public.nexo_gerenciar_vinculo(
  p_vinculo_id uuid, p_acao text, p_organizacao_id uuid default null,
  p_status text default 'nao_confirmado', p_funcao text default null,
  p_confianca smallint default 0, p_fonte_resumo text default null,
  p_superior_vinculo_id uuid default null
)
returns uuid language plpgsql security invoker set search_path = '' as $function$
declare
  v_vinculo public.nexo_vinculos%rowtype;
  v_destino_id uuid;
begin
  if not (select public.current_user_can_access_nexo()) then
    raise exception 'nexo_access_denied' using errcode = '42501';
  end if;
  if p_acao not in ('atualizar', 'remover', 'transferir') then
    raise exception 'nexo_vinculo_acao_invalida' using errcode = '22023';
  end if;
  if p_status not in ('confirmado', 'provavel', 'suspeito', 'nao_confirmado')
      or p_confianca < 0 or p_confianca > 100 then
    raise exception 'nexo_vinculo_dados_invalidos' using errcode = '22023';
  end if;
  select * into v_vinculo from public.nexo_vinculos
    where id = p_vinculo_id and deleted_at is null for update;
  if not found then
    raise exception 'nexo_vinculo_nao_encontrado' using errcode = 'P0002';
  end if;
  if p_acao = 'remover' then
    update public.nexo_vinculos set status = 'desvinculado', ate = current_date,
      superior_vinculo_id = null, updated_by = auth.uid() where id = v_vinculo.id;
    return v_vinculo.id;
  end if;
  if p_acao = 'atualizar' or p_organizacao_id is null
      or p_organizacao_id = v_vinculo.organizacao_id then
    update public.nexo_vinculos set status = p_status,
      funcao = nullif(btrim(p_funcao), ''), confianca = p_confianca,
      fonte_resumo = nullif(btrim(p_fonte_resumo), ''),
      superior_vinculo_id = p_superior_vinculo_id,
      ate = null, updated_by = auth.uid() where id = v_vinculo.id;
    return v_vinculo.id;
  end if;

  update public.nexo_vinculos set status = 'desvinculado', ate = current_date,
    superior_vinculo_id = null, updated_by = auth.uid() where id = v_vinculo.id;
  select id into v_destino_id from public.nexo_vinculos
    where pessoa_id = v_vinculo.pessoa_id and organizacao_id = p_organizacao_id
      and deleted_at is null limit 1 for update;
  if v_destino_id is null then
    insert into public.nexo_vinculos (
      organizacao_id, pessoa_id, status, funcao, confianca, fonte_resumo,
      superior_vinculo_id, desde, ate, created_by, updated_by
    ) values (
      p_organizacao_id, v_vinculo.pessoa_id, p_status,
      nullif(btrim(p_funcao), ''), p_confianca, nullif(btrim(p_fonte_resumo), ''),
      p_superior_vinculo_id, current_date, null, auth.uid(), auth.uid()
    ) returning id into v_destino_id;
  else
    update public.nexo_vinculos set status = p_status,
      funcao = nullif(btrim(p_funcao), ''), confianca = p_confianca,
      fonte_resumo = nullif(btrim(p_fonte_resumo), ''),
      superior_vinculo_id = p_superior_vinculo_id,
      desde = current_date, ate = null, updated_by = auth.uid()
      where id = v_destino_id;
  end if;
  return v_destino_id;
end;
$function$;

revoke all on function public.nexo_gerenciar_vinculo(uuid, text, uuid, text, text, smallint, text, uuid)
  from public, anon;
grant execute on function public.nexo_gerenciar_vinculo(uuid, text, uuid, text, text, smallint, text, uuid)
  to authenticated;
