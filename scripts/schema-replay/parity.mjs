import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const KEY_BUILDERS = Object.freeze({
  tables: (entry) => `${entry.schema}.${entry.name}`,
  columns: (entry) => `${entry.schema}.${entry.table}.${entry.name}`,
  policies: (entry) => `${entry.schema}.${entry.table}.${entry.name}`,
  functions: (entry) => `${entry.schema}.${entry.name}(${entry.arguments})`,
  tableGrants: (entry) => `${entry.schema}.${entry.table}:${entry.role}`,
  constraints: (entry) => `${entry.schema}.${entry.table}.${entry.name}`,
  indexes: (entry) => `${entry.schema}.${entry.table}.${entry.name}`,
  enums: (entry) => `${entry.schema}.${entry.name}`,
  triggers: (entry) => `${entry.schema}.${entry.table}.${entry.name}`,
});

const IGNORED_FINGERPRINT_FIELDS = Object.freeze({
  columns: new Set(["position"]),
  functions: new Set(["serviceRoleExecute"]),
  tableGrants: new Set([
    "delete",
    "insert",
    "references",
    "select",
    "trigger",
    "truncate",
    "update",
  ]),
});

function stableEntries(catalog, kind) {
  const entries = catalog?.[kind];
  if (!Array.isArray(entries)) {
    throw new TypeError(`Catalog category ${kind} must be an array.`);
  }

  const key = KEY_BUILDERS[kind];
  return [...entries].sort((left, right) => key(left).localeCompare(key(right)));
}

function changedFields(candidate, remote) {
  return [...new Set([...Object.keys(candidate), ...Object.keys(remote)])]
    .sort()
    .filter((field) => JSON.stringify(candidate[field]) !== JSON.stringify(remote[field]));
}

export function compareCatalogs(candidate, remote) {
  return Object.fromEntries(
    Object.entries(KEY_BUILDERS).map(([kind, key]) => {
      const candidateEntries = stableEntries(candidate, kind);
      const remoteEntries = stableEntries(remote, kind);
      const candidateMap = new Map(candidateEntries.map((entry) => [key(entry), entry]));
      const remoteMap = new Map(remoteEntries.map((entry) => [key(entry), entry]));
      const candidateKeys = [...candidateMap.keys()];
      const remoteKeys = [...remoteMap.keys()];

      const missingCandidate = remoteKeys
        .filter((entryKey) => !candidateMap.has(entryKey))
        .map((entryKey) => ({ key: entryKey, remote: remoteMap.get(entryKey) }));
      const missingRemote = candidateKeys
        .filter((entryKey) => !remoteMap.has(entryKey))
        .map((entryKey) => ({ key: entryKey, candidate: candidateMap.get(entryKey) }));
      const changed = candidateKeys.flatMap((entryKey) => {
        if (!remoteMap.has(entryKey)) return [];
        const candidateEntry = candidateMap.get(entryKey);
        const remoteEntry = remoteMap.get(entryKey);
        const fields = changedFields(candidateEntry, remoteEntry);
        return fields.length === 0
          ? []
          : [{ key: entryKey, fields, candidate: candidateEntry, remote: remoteEntry }];
      });

      return [
        kind,
        {
          candidateCount: candidateMap.size,
          remoteCount: remoteMap.size,
          missingCandidate,
          missingRemote,
          changed,
        },
      ];
    }),
  );
}

function isCandidateEngineNoise(kind, difference) {
  if (kind === "functions") return Boolean(difference.candidate?.extension);
  if (kind === "constraints") return difference.candidate?.type === "n";
  return false;
}

function keyList(entries) {
  return entries.map(({ key }) => key).sort((left, right) => left.localeCompare(right));
}

function fingerprintList(kind, entries) {
  const ignored = IGNORED_FINGERPRINT_FIELDS[kind] ?? new Set();
  return entries
    .map(({ key, fields }) => ({
      key,
      fields: fields.filter((field) => !ignored.has(field)).sort(),
    }))
    .filter(({ fields }) => fields.length > 0)
    .sort((left, right) => left.key.localeCompare(right.key));
}

function countChangedField(entries, field) {
  return entries.filter(({ fields }) => fields.includes(field)).length;
}

export function buildParityEvidence(
  differences,
  {
    generatedAt,
    remoteVerifiedAt,
    candidateLabel = "recovered-local",
    remoteLabel = "production-catalog",
  },
) {
  if (!generatedAt || !remoteVerifiedAt) {
    throw new TypeError("generatedAt and remoteVerifiedAt are required.");
  }

  const categories = Object.fromEntries(
    Object.entries(KEY_BUILDERS).map(([kind]) => {
      const difference = differences[kind];
      if (!difference) throw new TypeError(`Missing parity difference category ${kind}.`);

      return [
        kind,
        {
          candidateCount: difference.candidateCount,
          remoteCount: difference.remoteCount,
          missingInCandidate: keyList(difference.missingCandidate),
          missingInRemoteApplication: keyList(
            difference.missingRemote.filter((entry) => !isCandidateEngineNoise(kind, entry)),
          ),
          changedFingerprints: fingerprintList(kind, difference.changed),
        },
      ];
    }),
  );

  const remoteOnlyApplication = Object.fromEntries(
    Object.entries(differences)
      .map(([kind, difference]) => [kind, keyList(difference.missingCandidate)])
      .filter(([, keys]) => keys.length > 0),
  );
  const candidateOnlyApplication = Object.fromEntries(
    Object.entries(differences)
      .map(([kind, difference]) => [
        kind,
        keyList(difference.missingRemote.filter((entry) => !isCandidateEngineNoise(kind, entry))),
      ])
      .filter(([, keys]) => keys.length > 0),
  );

  // Keep these keys stable even when the corresponding list is empty. They are
  // the two categories most likely to drive a migration-reconciliation decision.
  remoteOnlyApplication.functions ??= [];
  candidateOnlyApplication.functions ??= [];

  const exactKinds = Object.entries(differences)
    .filter(
      ([, difference]) =>
        difference.missingCandidate.length === 0 &&
        difference.missingRemote.length === 0 &&
        difference.changed.length === 0,
    )
    .map(([kind]) => kind)
    .sort();

  return {
    schemaVersion: 1,
    generatedAt,
    remoteVerifiedAt,
    sources: { candidate: candidateLabel, remote: remoteLabel },
    safety: {
      catalogMetadataOnly: true,
      containsApplicationRows: false,
      containsRawDefinitions: false,
      containsCredentials: false,
    },
    categories,
    interpretation: {
      exactKinds,
      remoteOnlyApplication,
      candidateOnlyApplication,
      engineNoise: {
        pgcryptoFunctions: differences.functions.missingRemote.filter(
          ({ candidate }) => candidate.extension === "pgcrypto",
        ).length,
        notNullConstraints: differences.constraints.missingRemote.filter(
          ({ candidate }) => candidate.type === "n",
        ).length,
      },
      environmentDependent: {
        functionServiceRoleExecuteFingerprints: countChangedField(
          differences.functions.changed,
          "serviceRoleExecute",
        ),
        tableGrantFingerprints: differences.tableGrants.changed.length,
      },
      limitations: [
        "Fingerprint differences identify catalog drift but do not prove a behavioral difference.",
        "PGlite exposes pgcrypto in public while hosted Supabase exposes it through a platform schema.",
        "PGlite models NOT NULL as named constraints; hosted PostgreSQL does not return those rows in the same way.",
        "Role inheritance and platform default grants are not reproduced by the PGlite adapter; grant parity requires the Docker-backed Supabase run.",
      ],
    },
  };
}

function option(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const candidatePath = option("candidate");
  const remotePath = option("remote");
  const outputPath = option("output");
  const remoteVerifiedAt = option("remote-verified-at");
  if (!candidatePath || !remotePath || !outputPath || !remoteVerifiedAt) {
    throw new Error(
      "Usage: node scripts/schema-replay/parity.mjs --candidate=<json> --remote=<json> --output=<json> --remote-verified-at=<ISO timestamp>",
    );
  }

  const [candidate, remote] = await Promise.all(
    [candidatePath, remotePath].map(async (path) => JSON.parse(await readFile(path, "utf8"))),
  );
  const evidence = buildParityEvidence(compareCatalogs(candidate, remote), {
    generatedAt: new Date().toISOString(),
    remoteVerifiedAt,
  });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      outputPath,
      exactKinds: evidence.interpretation.exactKinds,
      remoteOnlyKinds: Object.entries(evidence.interpretation.remoteOnlyApplication)
        .filter(([, keys]) => keys.length > 0)
        .map(([kind]) => kind),
      candidateOnlyKinds: Object.entries(evidence.interpretation.candidateOnlyApplication)
        .filter(([, keys]) => keys.length > 0)
        .map(([kind]) => kind),
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
