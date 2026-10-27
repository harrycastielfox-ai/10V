-- Restore accent folding without rewriting persisted vehicle search text.
-- CREATE OR REPLACE preserves function identity, ownership and existing ACLs.
create or replace function public.normalize_vehicle_search(p_value text)
returns text
language sql
immutable
security invoker
parallel unsafe
called on null input
cost 100
set search_path = ''
as $function$
  select trim(
    regexp_replace(
      translate(
        lower(coalesce(p_value, '')),
        -- ASCII-only Unicode escapes prevent another transport-encoding change.
        U&'\00E1\00E0\00E2\00E3\00E4\00E9\00E8\00EA\00EB\00ED\00EC\00EE\00EF\00F3\00F2\00F4\00F5\00F6\00FA\00F9\00FB\00FC\00E7\00F1\00FD\00FF',
        'aaaaaeeeeiiiiooooouuuucnyy'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$function$;

-- Legacy search_text retains accents. Fold both operands so old and new rows
-- remain searchable with either spelling, without firing update/audit triggers.
create or replace function public.list_vehicles_page(
  p_limit integer default 20,
  p_cursor_updated_at timestamptz default null,
  p_cursor_id uuid default null,
  p_search text default null,
  p_vehicle_type text default null,
  p_situation text default null,
  p_occurrence_type text default null,
  p_status text default null,
  p_custody_location text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_pending_identification boolean default null
)
returns table (
  id uuid,
  internal_id text,
  vehicle_type text,
  brand_model text,
  color text,
  plate text,
  situation text,
  occurrence_type text,
  procedure_type text,
  procedure_number text,
  police_report_number text,
  custody_location text,
  storage_location text,
  pending_identification boolean,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with filtered as (
    select v.*
    from public.vehicles v
    where v.deleted_at is null
      and (nullif(btrim(p_search), '') is null
        or public.normalize_vehicle_search(v.search_text)
          like '%' || public.normalize_vehicle_search(p_search) || '%')
      and (p_vehicle_type is null or v.vehicle_type = p_vehicle_type)
      and (
        p_situation is null
        or (p_situation = 'nao_informada' and v.situation is null)
        or (p_situation <> 'nao_informada' and v.situation = p_situation)
      )
      and (p_occurrence_type is null or v.occurrence_type = p_occurrence_type)
      and (p_status is null or v.status = p_status)
      and (p_custody_location is null or v.custody_location = p_custody_location)
      and (p_start_date is null or v.created_at >= p_start_date::timestamptz)
      and (p_end_date is null or v.created_at < (p_end_date + 1)::timestamptz)
      and (p_pending_identification is null or v.pending_identification = p_pending_identification)
  ),
  counted as (
    select filtered.*, count(*) over () as matching_total
    from filtered
  )
  select
    c.id, c.internal_id, c.vehicle_type, c.brand_model, c.color, c.plate,
    c.situation, c.occurrence_type, c.procedure_type, c.procedure_number,
    c.police_report_number, c.custody_location, c.storage_location,
    c.pending_identification, c.updated_at, c.matching_total
  from counted c
  where p_cursor_updated_at is null
    or p_cursor_id is null
    or (c.updated_at, c.id) < (p_cursor_updated_at, p_cursor_id)
  order by c.updated_at desc, c.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$function$;

-- Preserve the existing raw-text index. A local authenticated/RLS EXPLAIN
-- retained the folded expression as a Filter even with an expression GIN;
-- no benefit was established for that execution path. The compatibility
-- predicate therefore pays normalization per candidate row. This migration
-- introduces no index build, backfill, trigger changes, or table-row writes.
