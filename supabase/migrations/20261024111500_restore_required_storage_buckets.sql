-- Recria somente os buckets ainda referenciados pelo aplicativo atual.
-- Não inclui localizacao-private: o módulo de Localização foi removido.
-- A migration é idempotente e não altera nem remove objetos existentes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'vehicle-photos',
    'vehicle-photos',
    false,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'object-photos',
    'object-photos',
    false,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  (
    'vehicle-inspection-pdfs',
    'vehicle-inspection-pdfs',
    false,
    15728640,
    array['application/pdf']::text[]
  )
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
