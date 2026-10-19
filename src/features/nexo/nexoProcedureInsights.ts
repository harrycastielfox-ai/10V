import {
  filterNexoProcedureRows,
  normalizeProcedureText,
  validProcedureCoordinates,
  type NexoProcedureFilters,
  type NexoProcedureRow,
} from "./nexoProcedureAnalytics";

const DAY_IN_MS = 86_400_000;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const UNKNOWN_NEIGHBORHOODS = new Set([
  "nao informado",
  "nao informada",
  "sem informacao",
  "ignorado",
  "ignorada",
  "nao consta",
  "a definir",
]);

export type ProcedureMissingField = "date" | "time" | "neighborhood" | "coordinates";

export interface ProcedureHeatmapCell {
  /** JavaScript calendar convention: Sunday = 0, Monday = 1, Saturday = 6. */
  weekday: number;
  hour: number;
  count: number;
}

export interface ProcedureHeatmap {
  /** Complete 7 × 24 grid in Monday-first display order. */
  cells: ProcedureHeatmapCell[];
  /** Unique CVLI incidents with both a valid fact date and a fact time. */
  knownTimes: number;
  total: number;
  coveragePercent: number;
  missingDates: number;
  missingTimes: number;
  maxCount: number;
  peak: ProcedureHeatmapCell | null;
}

export interface ProcedurePeriodCounts {
  from: string;
  to: string;
  total: number;
  cvli: number;
}

export interface ProcedurePeriodComparison {
  days: number;
  current: ProcedurePeriodCounts;
  previous: ProcedurePeriodCounts;
  /** Change in unique CVLI incidents, current minus previous. */
  delta: number;
  /** Null when the previous period has no CVLI incidents. */
  deltaPercent: number | null;
  totalDelta: number;
  totalDeltaPercent: number | null;
  undated: number;
}

export interface ProcedureDataCoverage {
  total: number;
  complete: number;
  coveragePercent: number;
  missingDate: number;
  missingTime: number;
  missingNeighborhood: number;
  missingCoordinates: number;
  withDate: number;
  withTime: number;
  withNeighborhood: number;
  withCoordinates: number;
}

export interface ResolvedProcedureRow extends NexoProcedureRow {
  /** Sources recorded for any analytical context associated with this incident. */
  analysisSources: string[];
}

export interface ResolvedProcedureScope {
  procedures: ResolvedProcedureRow[];
  incidents: NexoProcedureRow[];
  /** Same procedure filters, with factual date bounds removed for period comparisons. */
  comparisonIncidents: NexoProcedureRow[];
}

/** Parse calendar dates without applying the computer's timezone or accepting rollovers. */
function factDateTimestamp(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

function factTime(value: string | null | undefined): string | null {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(value)) {
    return null;
  }
  return value.slice(0, 5);
}

function neighborhood(value: string | null | undefined): string | null {
  const normalized = normalizeProcedureText(value);
  return normalized && !UNKNOWN_NEIGHBORHOODS.has(normalized) ? value!.trim() : null;
}

function percentage(value: number, total: number) {
  return total ? Math.round((value / total) * 1_000) / 10 : 0;
}

function percentChange(current: number, previous: number) {
  return previous ? Math.round(((current - previous) / previous) * 1_000) / 10 : null;
}

/**
 * Keep one factual incident for linked B.O./inquiry records. Sourced context takes
 * precedence over source fields; inquiries win ties, then stable procedure IDs.
 * Coordinates are always selected as a complete pair from the same source.
 */
export function uniqueProcedureIncidents(rows: NexoProcedureRow[]): NexoProcedureRow[] {
  const groups = new Map<string, NexoProcedureRow[]>();
  for (const row of rows) {
    const group = groups.get(row.incidentId);
    if (group) group.push(row);
    else groups.set(row.incidentId, [row]);
  }
  return [...groups.values()].map((group) => {
    const ordered = [...group].sort(
      (a, b) =>
        Number(a.kind === "bo") - Number(b.kind === "bo") || a.id.localeCompare(b.id, "pt-BR"),
    );
    const base = ordered[0];
    const sourcedDate = ordered.find((row) => factDateTimestamp(row.context?.data_fato) !== null)
      ?.context?.data_fato;
    const sourceDate = ordered.find((row) => factDateTimestamp(row.factDate) !== null)?.factDate;
    const sourcedTime = ordered.map((row) => factTime(row.context?.hora_fato)).find(Boolean);
    const sourceTime = ordered.map((row) => factTime(row.factTime)).find(Boolean);
    const sourcedNeighborhood = ordered
      .map((row) => neighborhood(row.context?.bairro))
      .find(Boolean);
    const sourceNeighborhood = ordered.map((row) => neighborhood(row.neighborhood)).find(Boolean);
    const sourcedPoint = ordered
      .map((row) => validProcedureCoordinates(row.context?.latitude, row.context?.longitude))
      .find(Boolean);
    const sourcePoint = ordered
      .map((row) => validProcedureCoordinates(row.latitude, row.longitude))
      .find(Boolean);
    const point = sourcedPoint || sourcePoint;
    const factions: string[] = [];
    const factionNames = new Set<string>();
    for (const faction of ordered.flatMap((row) => row.factions)) {
      const key = normalizeProcedureText(faction);
      if (key && !factionNames.has(key)) {
        factionNames.add(key);
        factions.push(faction);
      }
    }
    return {
      ...base,
      factDate: sourcedDate || sourceDate || null,
      factTime: sourcedTime || sourceTime || null,
      neighborhood: sourcedNeighborhood || sourceNeighborhood || null,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      factions,
      cvli: ordered.some((row) => row.cvli),
      linkedToNexo: ordered.some((row) => row.linkedToNexo),
    };
  });
}

/**
 * Resolve factual values once before any procedure/type/date filter. A linked
 * procedure keeps its own identity and editable context while exposing the same
 * incident facts used by charts, completeness filters, map points, and exports.
 */
export function resolveProcedureScope(
  rows: NexoProcedureRow[],
  filters: NexoProcedureFilters,
): ResolvedProcedureScope {
  const canonical = uniqueProcedureIncidents(rows);
  const canonicalById = new Map(canonical.map((incident) => [incident.incidentId, incident]));
  const sourcesByIncident = new Map<string, Set<string>>();
  for (const row of rows) {
    const source = row.context?.fonte.trim();
    if (!source) continue;
    const sources = sourcesByIncident.get(row.incidentId) || new Set<string>();
    sources.add(source);
    sourcesByIncident.set(row.incidentId, sources);
  }
  const projected: ResolvedProcedureRow[] = rows.map((row) => {
    const incident = canonicalById.get(row.incidentId)!;
    return {
      ...row,
      factDate: incident.factDate,
      factTime: incident.factTime,
      neighborhood: incident.neighborhood,
      latitude: incident.latitude,
      longitude: incident.longitude,
      cvli: incident.cvli,
      analysisSources: [...(sourcesByIncident.get(row.incidentId) || [])].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    };
  });
  const allowedProcedureIds = new Set(
    filterNexoProcedureRows(projected, filters).map((row) => row.id),
  );
  const procedures = projected.filter((row) => allowedProcedureIds.has(row.id));
  const allowedIncidentIds = new Set(procedures.map((row) => row.incidentId));
  const comparisonIncidentIds = new Set(
    filterNexoProcedureRows(projected, { ...filters, from: "", to: "" }).map(
      (row) => row.incidentId,
    ),
  );
  return {
    procedures,
    incidents: canonical.filter((incident) => allowedIncidentIds.has(incident.incidentId)),
    comparisonIncidents: canonical.filter((incident) =>
      comparisonIncidentIds.has(incident.incidentId),
    ),
  };
}

export function procedureMissingFields(row: NexoProcedureRow): ProcedureMissingField[] {
  const missing: ProcedureMissingField[] = [];
  if (factDateTimestamp(row.factDate) === null) missing.push("date");
  if (!factTime(row.factTime)) missing.push("time");
  if (!neighborhood(row.neighborhood)) missing.push("neighborhood");
  if (!validProcedureCoordinates(row.latitude, row.longitude)) missing.push("coordinates");
  return missing;
}

export function procedureDataCoverage(rows: NexoProcedureRow[]): ProcedureDataCoverage {
  const incidents = uniqueProcedureIncidents(rows);
  let complete = 0;
  const counts: Record<ProcedureMissingField, number> = {
    date: 0,
    time: 0,
    neighborhood: 0,
    coordinates: 0,
  };
  for (const incident of incidents) {
    const missing = procedureMissingFields(incident);
    if (!missing.length) complete += 1;
    for (const field of missing) counts[field] += 1;
  }
  const total = incidents.length;
  return {
    total,
    complete,
    coveragePercent: percentage(complete, total),
    missingDate: counts.date,
    missingTime: counts.time,
    missingNeighborhood: counts.neighborhood,
    missingCoordinates: counts.coordinates,
    withDate: total - counts.date,
    withTime: total - counts.time,
    withNeighborhood: total - counts.neighborhood,
    withCoordinates: total - counts.coordinates,
  };
}

export function buildProcedureHeatmap(rows: NexoProcedureRow[]): ProcedureHeatmap {
  const incidents = uniqueProcedureIncidents(rows).filter((row) => row.cvli);
  const cells = WEEKDAY_ORDER.flatMap((weekday) =>
    Array.from({ length: 24 }, (_, hour) => ({ weekday, hour, count: 0 })),
  );
  const cellsByKey = new Map(cells.map((cell) => [`${cell.weekday}:${cell.hour}`, cell]));
  let knownTimes = 0;
  let missingDates = 0;
  let missingTimes = 0;
  for (const incident of incidents) {
    const date = factDateTimestamp(incident.factDate);
    const time = factTime(incident.factTime);
    if (date === null) missingDates += 1;
    if (!time) missingTimes += 1;
    if (date === null || !time) continue;
    const weekday = new Date(date).getUTCDay();
    const hour = Number(time.slice(0, 2));
    cellsByKey.get(`${weekday}:${hour}`)!.count += 1;
    knownTimes += 1;
  }
  const peak = cells.reduce<ProcedureHeatmapCell | null>(
    (current, cell) => (cell.count > (current?.count || 0) ? { ...cell } : current),
    null,
  );
  return {
    cells,
    knownTimes,
    total: incidents.length,
    coveragePercent: percentage(knownTimes, incidents.length),
    missingDates,
    missingTimes,
    maxCount: peak?.count || 0,
    peak,
  };
}

/** Compare adjacent equal-length calendar windows, inclusive of both chosen endpoints. */
export function compareProcedurePeriods(
  rows: NexoProcedureRow[],
  from: string,
  to: string,
): ProcedurePeriodComparison | null {
  const start = factDateTimestamp(from);
  const end = factDateTimestamp(to);
  if (start === null || end === null || start > end) return null;
  const days = (end - start) / DAY_IN_MS + 1;
  const previousStart = start - days * DAY_IN_MS;
  const previousEnd = start - DAY_IN_MS;
  const incidents = uniqueProcedureIncidents(rows);
  const current: ProcedurePeriodCounts = { from, to, total: 0, cvli: 0 };
  const previous: ProcedurePeriodCounts = {
    from: new Date(previousStart).toISOString().slice(0, 10),
    to: new Date(previousEnd).toISOString().slice(0, 10),
    total: 0,
    cvli: 0,
  };
  let undated = 0;
  for (const incident of incidents) {
    const date = factDateTimestamp(incident.factDate);
    if (date === null) {
      undated += 1;
      continue;
    }
    const period =
      date >= start && date <= end
        ? current
        : date >= previousStart && date <= previousEnd
          ? previous
          : null;
    if (!period) continue;
    period.total += 1;
    if (incident.cvli) period.cvli += 1;
  }
  return {
    days,
    current,
    previous,
    delta: current.cvli - previous.cvli,
    deltaPercent: percentChange(current.cvli, previous.cvli),
    totalDelta: current.total - previous.total,
    totalDeltaPercent: percentChange(current.total, previous.total),
    undated,
  };
}
