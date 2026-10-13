-- Relatórios de vistoria: registro versionado vinculado ao veículo.
-- O PDF é um derivado; o cadastro do veículo e os dados de origem permanecem intactos.

create table if not exists public.vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  status text not null default 'rascunho',
  inspection_date date not null default current_date,
  location text,
  inspector_notes text,
  findings jsonb not null default '{}'::jsonb,
  current_version integer not null default 1,
  pdf_storage_path text,
  pdf_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  constraint vehicle_inspections_status_check check (status in ('rascunho', 'emitido', 'cancelado')),
  constraint vehicle_inspections_version_check check (current_version > 0),
  constraint vehicle_inspections_pdf_hash_check check (
    pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'
  )
);

create table if not exists public.vehicle_inspection_versions (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.vehicle_inspections(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  change_reason text,
  pdf_storage_path text,
  pdf_sha256 text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  constraint vehicle_inspection_versions_version_check check (version > 0),
  constraint vehicle_inspection_versions_pdf_hash_check check (
    pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint vehicle_inspection_versions_unique_version unique (inspection_id, version)
);

create index if not exists vehicle_inspections_vehicle_date_idx
  on public.vehicle_inspections (vehicle_id, inspection_date desc, updated_at desc);
create index if not exists vehicle_inspections_updated_idx
  on public.vehicle_inspections (updated_at desc, id desc);
create index if not exists vehicle_inspection_versions_inspection_idx
  on public.vehicle_inspection_versions (inspection_id, version desc);

drop trigger if exists set_vehicle_inspections_updated_at on public.vehicle_inspections;
create trigger set_vehicle_inspections_updated_at
before update on public.vehicle_inspections
for each row execute function public.set_updated_at();

alter table public.vehicle_inspections enable row level security;
alter table public.vehicle_inspection_versions enable row level security;

drop policy if exists vehicle_inspections_select_authorized on public.vehicle_inspections;
create policy vehicle_inspections_select_authorized
on public.vehicle_inspections for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
);

drop policy if exists vehicle_inspections_insert_authorized on public.vehicle_inspections;
create policy vehicle_inspections_insert_authorized
on public.vehicle_inspections for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
);

drop policy if exists vehicle_inspections_update_authorized on public.vehicle_inspections;
create policy vehicle_inspections_update_authorized
on public.vehicle_inspections for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
);

drop policy if exists vehicle_inspection_versions_select_authorized on public.vehicle_inspection_versions;
create policy vehicle_inspection_versions_select_authorized
on public.vehicle_inspection_versions for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
);

drop policy if exists vehicle_inspection_versions_insert_authorized on public.vehicle_inspection_versions;
create policy vehicle_inspection_versions_insert_authorized
on public.vehicle_inspection_versions for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
);

drop policy if exists vehicle_inspection_versions_update_authorized on public.vehicle_inspection_versions;
create policy vehicle_inspection_versions_update_authorized
on public.vehicle_inspection_versions for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
);

comment on table public.vehicle_inspections is
  'Relatorios de vistoria derivados do cadastro do veiculo, com metadados e hash do PDF opcional.';
comment on table public.vehicle_inspection_versions is
  'Historico imutavel de snapshots e documentos derivados de uma vistoria.';

insert into storage.buckets (id, name, public)
values ('vehicle-inspection-pdfs', 'vehicle-inspection-pdfs', false)
on conflict (id) do nothing;

drop policy if exists vehicle_inspection_pdfs_read_authorized on storage.objects;
create policy vehicle_inspection_pdfs_read_authorized
on storage.objects for select to authenticated
using (
  bucket_id = 'vehicle-inspection-pdfs'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
);

drop policy if exists vehicle_inspection_pdfs_insert_authorized on storage.objects;
create policy vehicle_inspection_pdfs_insert_authorized
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vehicle-inspection-pdfs'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
);

drop policy if exists vehicle_inspection_pdfs_update_authorized on storage.objects;
create policy vehicle_inspection_pdfs_update_authorized
on storage.objects for update to authenticated
using (
  bucket_id = 'vehicle-inspection-pdfs'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
)
with check (bucket_id = 'vehicle-inspection-pdfs');
