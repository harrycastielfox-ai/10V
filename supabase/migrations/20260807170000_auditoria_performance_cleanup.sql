-- Remove estruturas duplicadas apontadas pelo Supabase Performance Advisor.
-- As estruturas preservadas possuem a mesma definicao das removidas.

drop index if exists public.auditoria_created_at_idx;
drop index if exists public.auditoria_executor_user_id_created_at_idx;
drop index if exists public.auditoria_modulo_created_at_idx;

drop policy if exists auditoria_select_admin_delegado on public.auditoria;

drop policy if exists auditoria_admin_delegado_select on public.auditoria;
create policy auditoria_admin_delegado_select
on public.auditoria
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.cargo in ('admin'::public.user_role, 'delegado'::public.user_role)
  )
);

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);
