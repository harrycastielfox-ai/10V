-- An inquiry foreign key is a procedure link even when the text numbers are
-- absent. Keep the list filter and overview counter consistent. Replacing the
-- existing functions preserves their signatures, EXECUTE grants and invoker RLS.

create or replace function public.list_objects_page(
  p_limit integer default 20,
  p_cursor_updated_at timestamptz default null,
  p_cursor_id uuid default null,
  p_search text default null,
  p_object_type text default null,
  p_situation text default null,
  p_occurrence_type text default null,
  p_status text default null,
  p_custody_location text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_pending_identification boolean default null,
  p_without_procedure boolean default null
)
returns table (
  id uuid,
  internal_id text,
  object_type text,
  description text,
  brand_model text,
  quantity integer,
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
    select o.*
    from public.objects o
    where o.deleted_at is null
      and (nullif(btrim(p_search), '') is null
        or o.search_text like '%' || public.normalize_object_search(p_search) || '%')
      and (p_object_type is null or o.object_type = p_object_type)
      and (p_situation is null or o.situation = p_situation)
      and (p_occurrence_type is null or o.occurrence_type = p_occurrence_type)
      and (p_status is null or o.status = p_status)
      and (p_custody_location is null or o.custody_location = p_custody_location)
      and (p_start_date is null or o.created_at >= p_start_date::timestamptz)
      and (p_end_date is null or o.created_at < (p_end_date + 1)::timestamptz)
      and (p_pending_identification is null or o.pending_identification = p_pending_identification)
      and (
        p_without_procedure is not true
        or (o.procedure_number is null and o.police_report_number is null and o.inquerito_id is null)
      )
  ),
  counted as (
    select filtered.*, count(*) over () as matching_total
    from filtered
  )
  select
    c.id, c.internal_id, c.object_type, c.description, c.brand_model, c.quantity,
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

create or replace function public.object_overview_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with available as (
    select * from public.objects where deleted_at is null
  ),
  by_type as (
    select object_type as key, count(*)::bigint as total
    from available group by object_type
  ),
  by_situation as (
    select situation as key, count(*)::bigint as total
    from available group by situation
  ),
  monthly as (
    select date_trunc('month', created_at) as month, count(*)::bigint as total
    from available
    where created_at >= date_trunc('month', now()) - interval '5 months'
    group by date_trunc('month', created_at)
  )
  select jsonb_build_object(
    'total', (select count(*) from available),
    'seized', (select count(*) from available where situation = 'apreendido'),
    'released', (select count(*) from available where situation = 'liberado'),
    'destroyed', (select count(*) from available where situation = 'incinerado'),
    'pendingIdentification', (select count(*) from available where pending_identification),
    'withoutProcedure', (
      select count(*) from available
      where procedure_number is null and police_report_number is null and inquerito_id is null
    ),
    'releasedThisMonth', (
      select count(*) from available
      where situation = 'liberado'
        and release_date >= date_trunc('month', current_date)::date
    ),
    'byType', coalesce((select jsonb_object_agg(key, total) from by_type), '{}'::jsonb),
    'bySituation', coalesce((select jsonb_object_agg(key, total) from by_situation), '{}'::jsonb),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(month, 'YYYY-MM'), 'total', total) order by month)
      from monthly
    ), '[]'::jsonb)
  );
$function$;
