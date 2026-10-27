# Local schema recovery and migration replay

Run from any directory with Node and the repository's already installed dependencies:

```powershell
node C:\Users\Henrique\Documents\Codex\10V\scripts\schema-replay\replay.mjs --mode=bare --write-report
node C:\Users\Henrique\Documents\Codex\10V\scripts\schema-replay\replay.mjs --mode=legacy --write-report
node C:\Users\Henrique\Documents\Codex\10V\scripts\schema-replay\replay.mjs --mode=recovered --write-report
```

The modes deliberately make different claims:

| Mode               | Current result                                                     | Scope                                                                                                            |
| ------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `bare`             | Exit 1; first migration cannot find `inqueritos`                   | Fresh PGlite without application prerequisites.                                                                  |
| `legacy` (default) | Exit 1; 117/122 migrations before incompatible audit RPC OUT types | Initial prerequisites and unchanged migration history only. The history remains incomplete.                      |
| `recovered`        | Exit 0; 122/122 migrations and ten runtime probes                  | Candidate recovered baseline with one explicit documentary evolution and a local-only catalog reconciliation proposal. |

The runner stops at the first error. No known failure becomes a passing test. `complete` requires every migration and, in recovered mode, every runtime probe. `ddlComplete` and `runtimeComplete` distinguish these results. `--write-report` writes a deterministic report to `tests/schema-replay/results/<mode>.json`; without it only a compact result is printed. Reports include source/migration/runner/probe hashes, all applied files, documentary insertions, runtime probes and the first error. New migrations are discovered dynamically; unexpected SQL filenames fail rather than being excluded silently.

The initial prelude extracts complete unchanged sections for tables/enums/profiles from `docs/supabase-schema-proposta.sql`, normalized columns/constraints from `docs/proposta-padronizacao-campos-operacionais.sql`, and authorization helpers/grants/RLS from `docs/proposta-rls-representacoes-sigilosas.sql`. It also loads the legacy inqueritos-column SQL outside the migrations folder and the nullable phone column from `docs/proposta-profiles-telefone.sql`. The obsolete `auditoria` definition is excluded because migrations create it. Source boundaries and hashes are recorded; changed boundaries fail closed.

`catalog-prelude.sql` discloses the missing `set_updated_at()`, `profiles.funcao_institucional` and `inqueritos.visibilidade` prerequisites, with provenance from the parent's read-only catalog inspection on 2026-10-25. Default parity for `funcao_institucional` remains unverified. `platform-grants.sql` adds only confirmed `authenticated` USAGE on `public` and SELECT on `profiles`. Runtime probes verify that schema creation and profile writes remain denied, and SELECT remains restricted by the real self policy. There are no broad browser grants.

Only recovered mode inserts the exact application block from `docs/auditoria-avatar-rpc-proposta.sql` immediately before `20261024123000_harden_privileged_rpcs.sql`. That source explicitly evolves audit RPC OUT types through transactional DROP/CREATE and restored grants. The insertion is a separately hashed `documentary-gap` phase. No historical migration is rewritten. This ordering is a disclosed recovery model, not proof of the exact production application date or a valid standalone history.

The partial Auth/Storage adapter has no real identities, object bytes, API, JWT verification, signing service, GoTrue, protected-delete triggers or S3 backend. PGlite uses the real bundled `pgcrypto`, `pg_trgm` and `unaccent` extensions; extension creation remains in the original SQL. Each invocation creates and discards an in-memory database and has no network/production connection configuration.

Runtime probes use synthetic identities and the complete recovered schema to check platform grants, profile self visibility, administrative RPC contracts/denials, all hardened audit directory contracts/denials, real NEXO person RLS, frontend creation RPC idempotency/denials and vehicle normalization. They do not establish full RLS coverage or Supabase service/default-privilege parity. The existing integration suite remains separate.

The three intermediate `legacy-*.json` snapshots preserve earlier dependency discoveries with their then-current manifests. Current reproducibility is established by the three main reports and runner.
