import assert from "node:assert/strict";
import test from "node:test";

import { buildParityEvidence, compareCatalogs } from "../../scripts/schema-replay/parity.mjs";

const emptyCatalog = () => ({
  tables: [],
  columns: [],
  policies: [],
  functions: [],
  tableGrants: [],
  constraints: [],
  indexes: [],
  enums: [],
  triggers: [],
});

test("compareCatalogs reports deterministic key-only differences", () => {
  const candidate = emptyCatalog();
  const remote = emptyCatalog();

  candidate.tables.push({ schema: "public", name: "alpha", rls: true });
  remote.tables.push(
    { schema: "public", name: "alpha", rls: false },
    { schema: "public", name: "beta", rls: true },
  );

  const differences = compareCatalogs(candidate, remote);

  assert.deepEqual(
    differences.tables.missingCandidate.map(({ key }) => key),
    ["public.beta"],
  );
  assert.deepEqual(
    differences.tables.changed.map(({ key, fields }) => ({ key, fields })),
    [{ key: "public.alpha", fields: ["rls"] }],
  );
});

test("buildParityEvidence separates engine noise from application drift", () => {
  const candidate = emptyCatalog();
  const remote = emptyCatalog();

  candidate.functions.push({
    schema: "public",
    name: "digest",
    arguments: "text, text",
    extension: "pgcrypto",
    bodyHash: "candidate-extension-hash",
  });
  candidate.constraints.push({
    schema: "public",
    table: "records",
    name: "records_id_not_null",
    type: "n",
  });
  candidate.functions.push({
    schema: "public",
    name: "shared_rpc",
    arguments: "",
    extension: null,
    bodyHash: "candidate-body-hash",
    serviceRoleExecute: false,
  });
  remote.functions.push({
    schema: "public",
    name: "shared_rpc",
    arguments: "",
    extension: null,
    bodyHash: "remote-body-hash",
    serviceRoleExecute: true,
  });
  remote.functions.push({
    schema: "public",
    name: "remote_rpc",
    arguments: "p_id uuid",
    extension: null,
    bodyHash: "remote-only-body-hash",
  });

  const evidence = buildParityEvidence(compareCatalogs(candidate, remote), {
    generatedAt: "2026-10-25T18:00:00.000Z",
    remoteVerifiedAt: "2026-10-25T17:50:00.000Z",
  });

  assert.deepEqual(evidence.interpretation.remoteOnlyApplication.functions, [
    "public.remote_rpc(p_id uuid)",
  ]);
  assert.deepEqual(evidence.interpretation.candidateOnlyApplication.functions, []);
  assert.equal(evidence.interpretation.engineNoise.pgcryptoFunctions, 1);
  assert.equal(evidence.interpretation.engineNoise.notNullConstraints, 1);
  assert.deepEqual(evidence.categories.functions.changedFingerprints, [
    { key: "public.shared_rpc()", fields: ["bodyHash"] },
  ]);
});

test("parity evidence never serializes catalog bodies or raw object values", () => {
  const candidate = emptyCatalog();
  const remote = emptyCatalog();
  candidate.functions.push({
    schema: "public",
    name: "sensitive_rpc",
    arguments: "",
    extension: null,
    bodyHash: "candidate-secret-marker",
  });
  remote.functions.push({
    schema: "public",
    name: "sensitive_rpc",
    arguments: "",
    extension: null,
    bodyHash: "remote-secret-marker",
  });

  const serialized = JSON.stringify(
    buildParityEvidence(compareCatalogs(candidate, remote), {
      generatedAt: "2026-10-25T18:00:00.000Z",
      remoteVerifiedAt: "2026-10-25T17:50:00.000Z",
    }),
  );

  assert.doesNotMatch(serialized, /candidate-secret-marker|remote-secret-marker/);
  assert.match(serialized, /sensitive_rpc/);
});
