revoke all on table public.user_table_preferences from authenticated;
grant select, insert, update, delete on table public.user_table_preferences to authenticated;

revoke all on table public.user_saved_filters from authenticated;
grant select, insert, update, delete on table public.user_saved_filters to authenticated;

drop policy if exists user_table_preferences_select_own on public.user_table_preferences;
create policy user_table_preferences_select_own on public.user_table_preferences
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists user_table_preferences_insert_own on public.user_table_preferences;
create policy user_table_preferences_insert_own on public.user_table_preferences
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists user_table_preferences_update_own on public.user_table_preferences;
create policy user_table_preferences_update_own on public.user_table_preferences
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists user_table_preferences_delete_own on public.user_table_preferences;
create policy user_table_preferences_delete_own on public.user_table_preferences
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists user_saved_filters_select_own on public.user_saved_filters;
create policy user_saved_filters_select_own on public.user_saved_filters
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists user_saved_filters_insert_own on public.user_saved_filters;
create policy user_saved_filters_insert_own on public.user_saved_filters
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists user_saved_filters_update_own on public.user_saved_filters;
create policy user_saved_filters_update_own on public.user_saved_filters
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists user_saved_filters_delete_own on public.user_saved_filters;
create policy user_saved_filters_delete_own on public.user_saved_filters
for delete to authenticated using (user_id = (select auth.uid()));
