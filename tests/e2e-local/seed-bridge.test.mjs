import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCAL_SEED_BRIDGE_FILENAME,
  LOCAL_SEED_BRIDGE_SQL,
} from "../../scripts/e2e-local/seed-bridge.mjs";

test("local seed bridge is an isolated service-role-only bootstrap", () => {
  const normalized = LOCAL_SEED_BRIDGE_SQL.replace(/\s+/g, " ").toLowerCase();

  assert.equal(LOCAL_SEED_BRIDGE_FILENAME, "20261025000001_e2e_seed_bridge.sql");
  assert.match(normalized, /create or replace function public\.e2e_prepare_synthetic_profile/);
  assert.match(normalized, /security definer set search_path = ''/);
  assert.match(normalized, /auth\.role\(\) is distinct from 'service_role'/);
  assert.match(normalized, /p_email not like '%@example\.test'/);
  assert.match(normalized, /set_config\('request\.jwt\.claim\.sub', p_user_id::text, true\)/);
  assert.match(normalized, /revoke all on function public\.e2e_prepare_synthetic_profile/);
  assert.match(
    normalized,
    /grant execute on function public\.e2e_prepare_synthetic_profile[\s\S]*to service_role/,
  );
  assert.doesNotMatch(normalized, /to (anon|authenticated)/);
  assert.doesNotMatch(normalized, /https?:\/\//);
});
