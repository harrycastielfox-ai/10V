import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20261025181500_reconcile_live_catalog.sql",
  import.meta.url,
);

test("live catalog reconciliation is local-first, idempotent and contains every confirmed gap", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const fragment of [
    "add column if not exists dados_anteriores jsonb",
    "add column if not exists dados_novos jsonb",
    "add column if not exists usuario text",
    "add column if not exists autoria_determinada text",
    "add column if not exists avatar_url text",
    "create table if not exists private.productivity_events",
    "create or replace function private.is_yes_like",
    "create or replace function private.track_inquerito_productivity",
    "create or replace function public.handle_new_user_profile",
    "create or replace function public.list_escrivao_productivity",
    "create or replace function public.rls_auto_enable",
    "create or replace function public.update_own_avatar",
    "create or replace function public.update_own_name",
    "create or replace function public.update_own_phone",
    "avatars_owner_select",
    "avatars_owner_insert",
    "avatars_owner_update",
    "avatars_owner_delete",
    "inqueritos_categoria_criminal_idx",
    "inqueritos_escrivao_responsavel_idx",
    "inqueritos_relatorio_status_idx",
    "inqueritos_tipo_norm_idx",
    "representacoes_sigilo_norm_idx",
    "representacoes_tipo_norm_idx",
    "on_auth_user_created_profile",
    "track_inquerito_productivity",
    "set_profiles_updated_at",
    "create event trigger ensure_rls",
  ]) {
    assert.match(sql.toLowerCase(), new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(sql, /drop\s+(table|schema)|db\s+(push|reset)|project[_-]?ref/i);
  assert.match(sql, /insert into storage\.buckets[\s\S]*on conflict \(id\) do nothing/i);
});

test("new SECURITY DEFINER functions use fixed search paths and explicit grants", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const normalized = sql.replace(/\s+/g, " ");

  assert.match(sql, /handle_new_user_profile\(\)[\s\S]*?security definer\s+set search_path = ''/i);
  assert.match(sql, /list_escrivao_productivity[\s\S]*?security definer\s+set search_path = ''/i);
  assert.match(sql, /update_own_avatar[\s\S]*?security definer\s+set search_path = ''/i);
  assert.match(sql, /update_own_name[\s\S]*?security definer\s+set search_path = ''/i);
  assert.match(sql, /update_own_phone[\s\S]*?security definer\s+set search_path = ''/i);
  assert.match(sql, /rls_auto_enable\(\)[\s\S]*?security definer\s+set search_path = pg_catalog/i);

  assert.match(
    normalized,
    /revoke all on function public\.handle_new_user_profile\(\) from public, anon, authenticated/i,
  );
  assert.match(
    normalized,
    /grant execute on function public\.list_escrivao_productivity\(integer\) to authenticated, service_role/i,
  );
  assert.match(
    normalized,
    /grant execute on function public\.update_own_avatar\(text\) to authenticated, service_role/i,
  );
  assert.match(
    normalized,
    /grant execute on function public\.update_own_name\(text\) to authenticated, service_role/i,
  );
  assert.match(
    normalized,
    /grant execute on function public\.update_own_phone\(text\) to authenticated, service_role/i,
  );
});
