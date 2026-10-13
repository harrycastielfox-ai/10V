-- Vincula as fotografias tecnicas ja preservadas no cadastro do veiculo
-- a uma vistoria e a uma categoria de observacao.

create table if not exists public.vehicle_inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.vehicle_inspections(id) on delete cascade,
  vehicle_photo_id uuid not null references public.vehicle_photos(id) on delete restrict,
  category text not null,
  caption text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  constraint vehicle_inspection_photos_category_check check (category in (
    'veiculo', 'chassi', 'motor', 'etiqueta_seguranca', 'placa',
    'sinal_identificador', 'outros'
  )),
  constraint vehicle_inspection_photos_unique_link unique (inspection_id, vehicle_photo_id)
);

create index if not exists vehicle_inspection_photos_inspection_category_idx
  on public.vehicle_inspection_photos (inspection_id, category, created_at);

alter table public.vehicle_inspection_photos enable row level security;

drop policy if exists vehicle_inspection_photos_select_authorized on public.vehicle_inspection_photos;
create policy vehicle_inspection_photos_select_authorized
on public.vehicle_inspection_photos for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
);

drop policy if exists vehicle_inspection_photos_insert_authorized on public.vehicle_inspection_photos;
create policy vehicle_inspection_photos_insert_authorized
on public.vehicle_inspection_photos for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status_autorizacao = 'autorizado'
  )
  and exists (
    select 1
    from public.vehicle_inspections vi
    join public.vehicle_photos vp on vp.vehicle_id = vi.vehicle_id
    where vi.id = vehicle_inspection_photos.inspection_id
      and vp.id = vehicle_inspection_photos.vehicle_photo_id
  )
);

grant select, insert on public.vehicle_inspection_photos to authenticated;

create or replace function public.audit_vehicle_inspection_photo_link_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_nome text;
  v_actor_email text;
  v_actor_login text;
begin
  if v_actor_id is null then
    raise exception 'audit_actor_required' using errcode = '42501';
  end if;

  select p.nome, p.email, p.login
    into v_actor_nome, v_actor_email, v_actor_login
  from public.profiles p where p.id = v_actor_id;

  insert into public.auditoria (
    executor_user_id, executor_nome, executor_email, executor_login,
    acao, modulo, entidade, entidade_id, descricao, metadata
  ) values (
    v_actor_id, v_actor_nome, v_actor_email, v_actor_login,
    'link_photo', 'vistorias', 'vehicle_inspection_photo', new.inspection_id::text,
    'Vinculou fotografia técnica ao relatório de vistoria',
    jsonb_build_object(
      'source', 'database_trigger',
      'category', new.category,
      'vehicle_photo_id', new.vehicle_photo_id
    )
  );
  return new;
end;
$$;

revoke all on function public.audit_vehicle_inspection_photo_link_create() from public, anon, authenticated;

drop trigger if exists audit_vehicle_inspection_photo_links_create on public.vehicle_inspection_photos;
create trigger audit_vehicle_inspection_photo_links_create
after insert on public.vehicle_inspection_photos
for each row execute function public.audit_vehicle_inspection_photo_link_create();
