-- Application dependency missing from the migration history.
-- Provenance: public.set_updated_at() definition inspected read-only from the
-- configured Supabase catalog on 2026-10-25 by the parent recovery agent and
-- supplied in its task message. No table rows or sensitive literals were read.
-- This is a disclosed local prerequisite, not a claim that the history creates
-- the function. Its search_path is preserved from that observed definition.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- The same read-only catalog inspection confirmed this missing prerequisite's
-- type and nullability. Its production default was not provided or inferred.
-- This empty database needs only the nullable text column to parse later DDL;
-- no inserts, data backfills or claims of default-value parity are made here.
alter table public.profiles add column funcao_institucional text;

-- Same read-only catalog provenance (2026-10-25), supplied by the parent:
-- inqueritos.visibilidade is nullable text, has no default and no constraint
-- referencing it according to pg_get_constraintdef. Its creation is absent
-- from the migration history, although later RLS policies depend on it.
alter table public.inqueritos add column visibilidade text;
