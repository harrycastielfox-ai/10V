-- NEXO - preserva o PDF original e a trilha de revisão humana.
-- O arquivo continua privado no bucket nexo-private; esta camada guarda apenas
-- metadados, hash e as alegações escolhidas no cadastro.

create table if not exists public.nexo_documentos_fontes (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.nexo_pessoas(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 255),
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes integer not null check (size_bytes between 1 and 15728640),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  page_count smallint check (page_count between 1 and 30),
  extractor_version text not null default 'nexo-pdf-v1',
  ocr_status text not null default 'nao_aplicado'
    check (ocr_status in ('nao_aplicado', 'pendente', 'concluido', 'indisponivel')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  deleted_at timestamptz
);

create index if not exists nexo_documentos_fontes_pessoa_idx
  on public.nexo_documentos_fontes (pessoa_id, created_at desc)
  where deleted_at is null;
create index if not exists nexo_documentos_fontes_hash_idx
  on public.nexo_documentos_fontes (sha256);

create table if not exists public.nexo_documento_alegacoes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.nexo_documentos_fontes(id) on delete cascade,
  campo text not null check (char_length(btrim(campo)) between 1 and 120),
  rotulo text not null check (char_length(btrim(rotulo)) between 1 and 180),
  valor_original text not null,
  valor_normalizado text,
  pagina smallint not null check (pagina between 1 and 30),
  fonte text not null,
  confianca text not null check (confianca in ('alta', 'revisar')),
  estado text not null default 'aceito'
    check (estado in ('sugerido', 'aceito', 'rejeitado', 'corrigido')),
  coordenadas jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  unique (documento_id, campo, pagina, valor_original)
);

create index if not exists nexo_documento_alegacoes_documento_idx
  on public.nexo_documento_alegacoes (documento_id, pagina, campo);

alter table public.nexo_documentos_fontes enable row level security;
alter table public.nexo_documento_alegacoes enable row level security;

drop policy if exists nexo_documentos_fontes_select on public.nexo_documentos_fontes;
create policy nexo_documentos_fontes_select on public.nexo_documentos_fontes
for select to authenticated using (
  deleted_at is null
  and (select public.current_user_can_access_nexo())
  and exists (
    select 1 from public.nexo_pessoas pessoa
    where pessoa.id = pessoa_id and pessoa.deleted_at is null
  )
);

drop policy if exists nexo_documentos_fontes_insert on public.nexo_documentos_fontes;
create policy nexo_documentos_fontes_insert on public.nexo_documentos_fontes
for insert to authenticated with check (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.nexo_pessoas pessoa
    where pessoa.id = pessoa_id and pessoa.deleted_at is null
  )
);

drop policy if exists nexo_documentos_fontes_delete on public.nexo_documentos_fontes;
create policy nexo_documentos_fontes_delete on public.nexo_documentos_fontes
for delete to authenticated using (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
);

drop policy if exists nexo_documento_alegacoes_select on public.nexo_documento_alegacoes;
create policy nexo_documento_alegacoes_select on public.nexo_documento_alegacoes
for select to authenticated using (
  (select public.current_user_can_access_nexo())
  and exists (
    select 1
    from public.nexo_documentos_fontes documento
    join public.nexo_pessoas pessoa on pessoa.id = documento.pessoa_id
    where documento.id = documento_id
      and documento.deleted_at is null
      and pessoa.deleted_at is null
  )
);

drop policy if exists nexo_documento_alegacoes_insert on public.nexo_documento_alegacoes;
create policy nexo_documento_alegacoes_insert on public.nexo_documento_alegacoes
for insert to authenticated with check (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.nexo_documentos_fontes documento
    join public.nexo_pessoas pessoa on pessoa.id = documento.pessoa_id
    where documento.id = documento_id
      and documento.deleted_at is null
      and pessoa.deleted_at is null
  )
);

drop policy if exists nexo_documento_alegacoes_delete on public.nexo_documento_alegacoes;
create policy nexo_documento_alegacoes_delete on public.nexo_documento_alegacoes
for delete to authenticated using (
  (select public.current_user_can_access_nexo())
  and created_by = (select auth.uid())
);

drop trigger if exists audit_nexo_documentos_fontes on public.nexo_documentos_fontes;
create trigger audit_nexo_documentos_fontes
after insert or update or delete on public.nexo_documentos_fontes
for each row execute function private.audit_nexo_row_change();

drop trigger if exists audit_nexo_documento_alegacoes on public.nexo_documento_alegacoes;
create trigger audit_nexo_documento_alegacoes
after insert or update or delete on public.nexo_documento_alegacoes
for each row execute function private.audit_nexo_row_change();

revoke all on table public.nexo_documentos_fontes, public.nexo_documento_alegacoes from anon;
grant select, insert on table public.nexo_documentos_fontes, public.nexo_documento_alegacoes to authenticated;

comment on table public.nexo_documentos_fontes is
  'PDF original privado usado como fonte de cadastro; contém hash e metadados de preservação.';
comment on table public.nexo_documento_alegacoes is
  'Campos escolhidos na revisão humana, com página, fonte, confiança e estado auditável.';
