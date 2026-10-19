begin;

create table if not exists public.nexo_registros_vinculados (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid references public.nexo_pessoas(id) on delete cascade,
  organizacao_id uuid references public.nexo_organizacoes(id) on delete cascade,
  inquerito_id uuid references public.inqueritos(id) on delete cascade,
  bo_id uuid references public.boletins_ocorrencia(id) on delete cascade,
  observacao text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  constraint nexo_registro_owner_check check (num_nonnulls(pessoa_id, organizacao_id) = 1),
  constraint nexo_registro_target_check check (num_nonnulls(inquerito_id, bo_id) = 1),
  unique (pessoa_id, inquerito_id),
  unique (pessoa_id, bo_id),
  unique (organizacao_id, inquerito_id),
  unique (organizacao_id, bo_id)
);

create index if not exists nexo_registros_pessoa_idx on public.nexo_registros_vinculados (pessoa_id);
create index if not exists nexo_registros_organizacao_idx on public.nexo_registros_vinculados (organizacao_id);
create index if not exists nexo_registros_inquerito_idx on public.nexo_registros_vinculados (inquerito_id);
create index if not exists nexo_registros_bo_idx on public.nexo_registros_vinculados (bo_id);

alter table public.nexo_registros_vinculados enable row level security;

create policy nexo_registros_select on public.nexo_registros_vinculados
  for select using (public.current_user_can_access_nexo());
create policy nexo_registros_insert on public.nexo_registros_vinculados
  for insert with check (public.current_user_can_access_nexo());
create policy nexo_registros_delete on public.nexo_registros_vinculados
  for delete using (public.current_user_can_access_nexo());

revoke all on table public.nexo_registros_vinculados from anon;
grant select, insert, delete on table public.nexo_registros_vinculados to authenticated;

commit;
