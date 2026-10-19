create table if not exists public.nexo_observacoes (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid references public.nexo_pessoas(id) on delete cascade,
  organizacao_id uuid references public.nexo_organizacoes(id) on delete cascade,
  conteudo text not null check (char_length(btrim(conteudo)) between 1 and 10000),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  constraint nexo_observacoes_escopo_check check (
    (pessoa_id is not null and organizacao_id is null)
    or (pessoa_id is null and organizacao_id is not null)
  )
);

create index if not exists nexo_observacoes_pessoa_idx
  on public.nexo_observacoes (pessoa_id, created_at desc)
  where pessoa_id is not null;
create index if not exists nexo_observacoes_organizacao_idx
  on public.nexo_observacoes (organizacao_id, created_at desc)
  where organizacao_id is not null;

alter table public.nexo_observacoes enable row level security;

create policy nexo_observacoes_select on public.nexo_observacoes
for select to authenticated
using ((select public.current_user_can_access_nexo()));

create policy nexo_observacoes_insert on public.nexo_observacoes
for insert to authenticated
with check (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
);

revoke all on table public.nexo_observacoes from anon;
grant select, insert on table public.nexo_observacoes to authenticated;

drop trigger if exists audit_nexo_observacoes on public.nexo_observacoes;
create trigger audit_nexo_observacoes
after insert on public.nexo_observacoes
for each row execute function private.audit_nexo_row_change();

create or replace function public.nexo_gerenciar_vinculo(
  p_vinculo_id uuid,
  p_acao text,
  p_organizacao_id uuid default null,
  p_status text default 'nao_confirmado',
  p_funcao text default null,
  p_confianca smallint default 0,
  p_fonte_resumo text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
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
  if p_status not in ('confirmado', 'provavel', 'suspeito', 'nao_confirmado') then
    raise exception 'nexo_vinculo_status_invalido' using errcode = '22023';
  end if;
  if p_confianca < 0 or p_confianca > 100 then
    raise exception 'nexo_vinculo_confianca_invalida' using errcode = '22023';
  end if;

  select * into v_vinculo
  from public.nexo_vinculos
  where id = p_vinculo_id and deleted_at is null
  for update;

  if not found then
    raise exception 'nexo_vinculo_nao_encontrado' using errcode = 'P0002';
  end if;

  if p_acao = 'remover' then
    update public.nexo_vinculos
    set status = 'desvinculado', ate = current_date, updated_by = auth.uid()
    where id = v_vinculo.id;
    return v_vinculo.id;
  end if;

  if p_acao = 'atualizar' or p_organizacao_id is null
     or p_organizacao_id = v_vinculo.organizacao_id then
    update public.nexo_vinculos
    set status = p_status,
        funcao = nullif(btrim(p_funcao), ''),
        confianca = p_confianca,
        fonte_resumo = nullif(btrim(p_fonte_resumo), ''),
        ate = null,
        updated_by = auth.uid()
    where id = v_vinculo.id;
    return v_vinculo.id;
  end if;

  update public.nexo_vinculos
  set status = 'desvinculado', ate = current_date, updated_by = auth.uid()
  where id = v_vinculo.id;

  select id into v_destino_id
  from public.nexo_vinculos
  where pessoa_id = v_vinculo.pessoa_id
    and organizacao_id = p_organizacao_id
    and deleted_at is null
  limit 1
  for update;

  if v_destino_id is null then
    insert into public.nexo_vinculos (
      organizacao_id, pessoa_id, status, funcao, confianca, fonte_resumo,
      desde, ate, created_by, updated_by
    ) values (
      p_organizacao_id, v_vinculo.pessoa_id, p_status,
      nullif(btrim(p_funcao), ''), p_confianca, nullif(btrim(p_fonte_resumo), ''),
      current_date, null, auth.uid(), auth.uid()
    ) returning id into v_destino_id;
  else
    update public.nexo_vinculos
    set status = p_status,
        funcao = nullif(btrim(p_funcao), ''),
        confianca = p_confianca,
        fonte_resumo = nullif(btrim(p_fonte_resumo), ''),
        desde = current_date,
        ate = null,
        updated_by = auth.uid()
    where id = v_destino_id;
  end if;

  return v_destino_id;
end;
$function$;

revoke all on function public.nexo_gerenciar_vinculo(uuid, text, uuid, text, text, smallint, text)
from public, anon;
grant execute on function public.nexo_gerenciar_vinculo(uuid, text, uuid, text, text, smallint, text)
to authenticated;

comment on table public.nexo_observacoes is
  'Anotações operacionais cumulativas e imutáveis de dossiês individuais ou de facções.';
