-- Complemento analítico do NEXO: não altera o procedimento policial original.
create table public.nexo_procedimento_contextos (
  id uuid primary key default gen_random_uuid(),
  inquerito_id uuid unique references public.inqueritos(id) on delete cascade,
  bo_id uuid unique references public.boletins_ocorrencia(id) on delete cascade,
  data_fato date,
  hora_fato time without time zone,
  bairro text check (bairro is null or char_length(btrim(bairro)) between 1 and 160),
  fonte text not null check (char_length(btrim(fonte)) between 3 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  updated_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  constraint nexo_procedimento_contextos_escopo_check check (
    (inquerito_id is not null and bo_id is null)
    or (inquerito_id is null and bo_id is not null)
  ),
  constraint nexo_procedimento_contextos_dados_check check (
    data_fato is not null or hora_fato is not null or bairro is not null
  )
);

create index nexo_procedimento_contextos_autor_idx
  on public.nexo_procedimento_contextos (created_by);
create index nexo_procedimento_contextos_atualizado_por_idx
  on public.nexo_procedimento_contextos (updated_by);

alter table public.nexo_procedimento_contextos enable row level security;

create policy nexo_procedimento_contextos_select on public.nexo_procedimento_contextos
for select to authenticated using (
  (select public.current_user_can_access_nexo())
  and (
    (inquerito_id is not null and exists (
      select 1 from public.inqueritos i where i.id = inquerito_id and i.deleted_at is null
    ))
    or (bo_id is not null and exists (
      select 1 from public.boletins_ocorrencia b where b.id = bo_id and b.deleted_at is null
    ))
  )
);

create policy nexo_procedimento_contextos_insert on public.nexo_procedimento_contextos
for insert to authenticated with check (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (
    (inquerito_id is not null and exists (
      select 1 from public.inqueritos i where i.id = inquerito_id and i.deleted_at is null
    ))
    or (bo_id is not null and exists (
      select 1 from public.boletins_ocorrencia b where b.id = bo_id and b.deleted_at is null
    ))
  )
);

create policy nexo_procedimento_contextos_update on public.nexo_procedimento_contextos
for update to authenticated
using ((select public.current_user_can_access_nexo()))
with check (
  (select public.current_user_can_access_nexo())
  and updated_by = (select auth.uid())
  and (
    (inquerito_id is not null and exists (
      select 1 from public.inqueritos i where i.id = inquerito_id and i.deleted_at is null
    ))
    or (bo_id is not null and exists (
      select 1 from public.boletins_ocorrencia b where b.id = bo_id and b.deleted_at is null
    ))
  )
);

revoke all on table public.nexo_procedimento_contextos from public, anon, authenticated;
grant select, insert, update on table public.nexo_procedimento_contextos to authenticated;

create trigger prepare_nexo_procedimento_contexto
before insert or update on public.nexo_procedimento_contextos
for each row execute function private.prepare_nexo_row();

create trigger audit_nexo_procedimento_contexto
after insert or update on public.nexo_procedimento_contextos
for each row execute function private.audit_nexo_row_change();

comment on table public.nexo_procedimento_contextos is
  'Complemento analítico do NEXO para data, horário e bairro do fato, com fonte. Não substitui o registro policial original.';
