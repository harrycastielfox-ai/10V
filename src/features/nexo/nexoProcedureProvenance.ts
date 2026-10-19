import {
  normalizeProcedureText,
  validProcedureCoordinates,
  type NexoProcedureRow,
} from "./nexoProcedureAnalytics";
import { uniqueProcedureIncidents } from "./nexoProcedureInsights";

export type ProcedureProvenanceField = "date" | "time" | "neighborhood" | "coordinates";

export interface ProcedureCoordinates {
  latitude: number;
  longitude: number;
}

export interface ProcedureFieldSource<T> {
  recordId: string;
  procedureId: string;
  kind: NexoProcedureRow["kind"];
  number: string;
  origin: "original" | "complement";
  value: T;
  sourceText: string | null;
  updatedAt: string | null;
  /** A valid own complement replaces this procedure's original value. */
  effective: boolean;
  /** Effective evidence agreeing with the selected incident value. */
  selected: boolean;
}

export interface ProcedureFieldProvenance<T> {
  key: ProcedureProvenanceField;
  label: string;
  value: T | null;
  sources: ProcedureFieldSource<T>[];
  chosenSource: ProcedureFieldSource<T> | null;
  /** Disagreement between procedures' effective evidence, not a correction of one source. */
  hasDisagreement: boolean;
}

export interface ProcedureIncidentDescription {
  incident: NexoProcedureRow;
  records: NexoProcedureRow[];
  fields: {
    date: ProcedureFieldProvenance<string>;
    time: ProcedureFieldProvenance<string>;
    neighborhood: ProcedureFieldProvenance<string>;
    coordinates: ProcedureFieldProvenance<ProcedureCoordinates>;
  };
  disagreementCount: number;
}

const UNKNOWN_NEIGHBORHOODS = new Set([
  "nao informado",
  "nao informada",
  "sem informacao",
  "ignorado",
  "ignorada",
  "nao consta",
  "a definir",
]);

function validDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? value
    : null;
}

function validTime(value: string | null | undefined): string | null {
  return value && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(value)
    ? value.slice(0, 5)
    : null;
}

function validNeighborhood(value: string | null | undefined): string | null {
  const normalized = normalizeProcedureText(value);
  return normalized && !UNKNOWN_NEIGHBORHOODS.has(normalized) ? value!.trim() : null;
}

function rawDate(row: NexoProcedureRow): string | null {
  if (row.sourceFactDate !== undefined) return validDate(row.sourceFactDate);
  return validDate(row.context?.data_fato) ? null : validDate(row.factDate);
}

function rawNeighborhood(row: NexoProcedureRow): string | null {
  if (row.sourceNeighborhood !== undefined) return validNeighborhood(row.sourceNeighborhood);
  return validNeighborhood(row.context?.bairro) ? null : validNeighborhood(row.neighborhood);
}

function originalDate(row: NexoProcedureRow, records: NexoProcedureRow[]): string | null {
  const value = rawDate(row);
  if (!value || row.kind !== "bo") return value;
  // The current B.O. model inherits its source fact date from its linked inquiry.
  // Do not present that inherited value as independent B.O. evidence.
  const inherited = records.some((other) => other.kind === "inquerito" && rawDate(other) === value);
  return inherited ? null : value;
}

function originalNeighborhood(row: NexoProcedureRow, records: NexoProcedureRow[]): string | null {
  const value = rawNeighborhood(row);
  if (!value || row.kind !== "bo" || validNeighborhood(row.context?.bairro)) return value;
  const effectiveValue = validNeighborhood(row.neighborhood);
  if (!effectiveValue || normalizeProcedureText(value) === normalizeProcedureText(effectiveValue)) {
    return value;
  }
  // When the B.O. has no own neighborhood, its row can inherit an inquiry
  // correction while sourceNeighborhood retains that inquiry's original value.
  const inherited = records.some(
    (other) =>
      other.kind === "inquerito" &&
      normalizeProcedureText(validNeighborhood(other.context?.bairro) || other.neighborhood) ===
        normalizeProcedureText(effectiveValue),
  );
  return inherited ? null : value;
}

function describeField<T>(input: {
  key: ProcedureProvenanceField;
  label: string;
  value: T | null;
  records: NexoProcedureRow[];
  original: (row: NexoProcedureRow) => T | null;
  complement: (row: NexoProcedureRow) => T | null;
  valueKey: (value: T) => string;
}): ProcedureFieldProvenance<T> {
  const sources: ProcedureFieldSource<T>[] = [];
  for (const row of input.records) {
    const original = input.original(row);
    const complement = input.complement(row);
    function source(value: T, origin: "original" | "complement", effective: boolean) {
      return {
        recordId: row.id,
        procedureId: row.procedureId,
        kind: row.kind,
        number: row.number,
        origin,
        value,
        sourceText: origin === "complement" ? row.context?.fonte.trim() || null : null,
        updatedAt: origin === "complement" ? row.context?.updated_at || null : null,
        effective,
        selected:
          effective &&
          input.value !== null &&
          input.valueKey(value) === input.valueKey(input.value),
      };
    }
    if (original !== null) sources.push(source(original, "original", complement === null));
    if (complement !== null) sources.push(source(complement, "complement", true));
  }
  const effectiveKeys = new Set(
    sources.filter((item) => item.effective).map((item) => input.valueKey(item.value)),
  );
  const agreeing = sources.filter((item) => item.selected);
  const chosenSource = agreeing.find((item) => item.origin === "complement") || agreeing[0] || null;
  return {
    key: input.key,
    label: input.label,
    value: input.value,
    sources,
    chosenSource,
    hasDisagreement: effectiveKeys.size > 1,
  };
}

/** Describe provenance from the full raw procedure dataset, before analytical projection. */
export function describeProcedureIncident(
  rows: NexoProcedureRow[],
  incidentId: string,
): ProcedureIncidentDescription | null {
  const records = rows
    .filter((row) => row.incidentId === incidentId)
    .sort(
      (a, b) =>
        Number(a.kind === "bo") - Number(b.kind === "bo") || a.id.localeCompare(b.id, "pt-BR"),
    );
  if (!records.length) return null;
  const incident = uniqueProcedureIncidents(records)[0];
  const fields = {
    date: describeField({
      key: "date",
      label: "Data do fato",
      value: validDate(incident.factDate),
      records,
      original: (row) => originalDate(row, records),
      complement: (row) => validDate(row.context?.data_fato),
      valueKey: (value) => value,
    }),
    time: describeField({
      key: "time",
      label: "Hora do fato",
      value: validTime(incident.factTime),
      records,
      original: () => null,
      complement: (row) => validTime(row.context?.hora_fato),
      valueKey: (value) => value,
    }),
    neighborhood: describeField({
      key: "neighborhood",
      label: "Bairro",
      value: validNeighborhood(incident.neighborhood),
      records,
      original: (row) => originalNeighborhood(row, records),
      complement: (row) => validNeighborhood(row.context?.bairro),
      valueKey: normalizeProcedureText,
    }),
    coordinates: describeField({
      key: "coordinates",
      label: "Coordenadas",
      value: validProcedureCoordinates(incident.latitude, incident.longitude),
      records,
      original: () => null,
      complement: (row) => validProcedureCoordinates(row.context?.latitude, row.context?.longitude),
      valueKey: (value) => `${value.latitude},${value.longitude}`,
    }),
  };
  return {
    incident,
    records,
    fields,
    disagreementCount: Object.values(fields).filter((field) => field.hasDisagreement).length,
  };
}
