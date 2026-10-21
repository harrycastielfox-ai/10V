-- NEXO - recursos documentais anexados diretamente à ficha da pessoa.
-- Diferente dos documentos-fonte, estes arquivos são materiais de consulta
-- (inquéritos, relatórios e outros PDFs) e recebem uma observação própria.

create table if not exists public.nexo_pessoa_recursos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.nexo_pessoas(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 255),
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes integer not null check (size_bytes between 1 and 15728640),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  observacao text check (observacao is null or char_length(observacao) <= 4000),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  deleted_at timestamptz
);

create index if not exists nexo_pessoa_recursos_pessoa_idx
  on public.nexo_pessoa_recursos (pessoa_id, created_at desc)
  where deleted_at is null;

alter table public.nexo_pessoa_recursos enable row level security;

drop policy if exists nexo_pessoa_recursos_select on public.nexo_pessoa_recursos;
create policy nexo_pessoa_recursos_select on public.nexo_pessoa_recursos
for select to authenticated using (
  deleted_at is null
  and (select public.current_user_can_access_nexo())
  and exists (
    select 1 from public.nexo_pessoas pessoa
    where pessoa.id = pessoa_id and pessoa.deleted_at is null
  )
);

drop policy if exists nexo_pessoa_recursos_insert on public.nexo_pessoa_recursos;
create policy nexo_pessoa_recursos_insert on public.nexo_pessoa_recursos
for insert to authenticated with check (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.nexo_pessoas pessoa
    where pessoa.id = pessoa_id and pessoa.deleted_at is null
  )
);

drop policy if exists nexo_pessoa_recursos_delete on public.nexo_pessoa_recursos;
create policy nexo_pessoa_recursos_delete on public.nexo_pessoa_recursos
for delete to authenticated using (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
);

drop trigger if exists audit_nexo_pessoa_recursos on public.nexo_pessoa_recursos;
create trigger audit_nexo_pessoa_recursos
after insert or update or delete on public.nexo_pessoa_recursos
for each row execute function private.audit_nexo_row_change();

revoke all on table public.nexo_pessoa_recursos from anon;
grant select, insert, delete on table public.nexo_pessoa_recursos to authenticated;

comment on table public.nexo_pessoa_recursos is
  'PDFs anexados à ficha de uma pessoa para consulta, com observação descritiva e acesso privado.';
