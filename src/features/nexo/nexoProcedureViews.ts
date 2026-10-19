import type { NexoProcedureFilters } from "./nexoProcedureAnalytics";
import type { ProcedureMissingField } from "./nexoProcedureInsights";

export const MAX_PROCEDURE_VIEWS = 8;

export interface ProcedureViewState {
  filters: NexoProcedureFilters;
  rank: { kind: "neighborhood" | "date" | "hour"; key: string } | null;
  time: { weekday: number; hour: number } | null;
  range: { from: string; to: string } | null;
  map: {
    selectionIds: string[];
    bounds: { north: number; south: number; east: number; west: number } | null;
  } | null;
  missingField: ProcedureMissingField | "all";
  sortOrder: "recent" | "oldest" | "pending" | "number";
}

export interface SavedProcedureView {
  id: string;
  name: string;
  createdAt: string;
  state: ProcedureViewState;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, max: number) {
  return typeof value === "string" && value.length <= max ? value : null;
}

function validDate(value: unknown) {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function viewState(value: unknown): ProcedureViewState | null {
  if (!record(value) || !record(value.filters)) return null;
  const filters = value.filters;
  if (
    text(filters.query, 300) === null ||
    text(filters.faction, 240) === null ||
    typeof filters.kind !== "string" ||
    !["todos", "inquerito", "bo"].includes(filters.kind) ||
    typeof filters.classification !== "string" ||
    !["todos", "cvli", "outros"].includes(filters.classification) ||
    !validDate(filters.from) ||
    !validDate(filters.to) ||
    (filters.from && filters.to && String(filters.from) > String(filters.to)) ||
    typeof value.missingField !== "string" ||
    !["all", "date", "time", "neighborhood", "coordinates"].includes(value.missingField) ||
    typeof value.sortOrder !== "string" ||
    !["recent", "oldest", "pending", "number"].includes(value.sortOrder)
  )
    return null;
  let rank: ProcedureViewState["rank"] = null;
  if (value.rank !== null) {
    if (
      !record(value.rank) ||
      typeof value.rank.kind !== "string" ||
      !["neighborhood", "date", "hour"].includes(value.rank.kind) ||
      !text(value.rank.key, 240)
    )
      return null;
    if (value.rank.kind === "date" && !validDate(value.rank.key)) return null;
    if (value.rank.kind === "hour" && !/^([01]\d|2[0-3])$/.test(String(value.rank.key)))
      return null;
    rank = {
      kind: value.rank.kind as NonNullable<ProcedureViewState["rank"]>["kind"],
      key: String(value.rank.key),
    };
  }
  let time: ProcedureViewState["time"] = null;
  if (value.time !== null) {
    if (
      !record(value.time) ||
      !Number.isInteger(value.time.weekday) ||
      !Number.isInteger(value.time.hour) ||
      Number(value.time.weekday) < 0 ||
      Number(value.time.weekday) > 6 ||
      Number(value.time.hour) < 0 ||
      Number(value.time.hour) > 23
    )
      return null;
    time = { weekday: Number(value.time.weekday), hour: Number(value.time.hour) };
  }
  let range: ProcedureViewState["range"] = null;
  if (value.range != null) {
    if (
      !record(value.range) ||
      !value.range.from ||
      !value.range.to ||
      !validDate(value.range.from) ||
      !validDate(value.range.to) ||
      String(value.range.from) > String(value.range.to)
    )
      return null;
    range = { from: String(value.range.from), to: String(value.range.to) };
  }
  let map: ProcedureViewState["map"] = null;
  if (value.map != null) {
    if (
      !record(value.map) ||
      !Array.isArray(value.map.selectionIds) ||
      value.map.selectionIds.length > 500 ||
      value.map.selectionIds.some((id) => !text(id, 100))
    )
      return null;
    let bounds: NonNullable<ProcedureViewState["map"]>["bounds"] = null;
    if (value.map.bounds != null) {
      const candidate = value.map.bounds;
      if (
        !record(candidate) ||
        ["north", "south", "east", "west"].some(
          (key) => typeof candidate[key] !== "number" || !Number.isFinite(candidate[key]),
        ) ||
        Number(candidate.north) > 90 ||
        Number(candidate.north) < -90 ||
        Number(candidate.south) > 90 ||
        Number(candidate.south) < -90 ||
        Number(candidate.east) > 180 ||
        Number(candidate.east) < -180 ||
        Number(candidate.west) > 180 ||
        Number(candidate.west) < -180 ||
        Number(candidate.north) < Number(candidate.south)
      )
        return null;
      bounds = {
        north: Number(candidate.north),
        south: Number(candidate.south),
        east: Number(candidate.east),
        west: Number(candidate.west),
      };
    }
    const selectionIds = [...new Set(value.map.selectionIds as string[])];
    map = selectionIds.length || bounds ? { selectionIds, bounds } : null;
  }
  return {
    filters: {
      query: String(filters.query),
      faction: String(filters.faction),
      kind: filters.kind as NexoProcedureFilters["kind"],
      classification: filters.classification as NexoProcedureFilters["classification"],
      from: String(filters.from),
      to: String(filters.to),
    },
    rank,
    time,
    range,
    map,
    missingField: value.missingField as ProcedureViewState["missingField"],
    sortOrder: value.sortOrder as ProcedureViewState["sortOrder"],
  };
}

export function parseProcedureViews(serialized: string | null): SavedProcedureView[] {
  if (!serialized || serialized.length > 50_000) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    const views: SavedProcedureView[] = [];
    const ids = new Set<string>();
    for (const candidate of parsed) {
      if (!record(candidate)) continue;
      const id = text(candidate.id, 80);
      const name = text(candidate.name, 60)?.trim();
      const createdAt = text(candidate.createdAt, 40);
      const state = viewState(candidate.state);
      if (
        !id ||
        !name ||
        !createdAt ||
        !Number.isFinite(Date.parse(createdAt)) ||
        !state ||
        ids.has(id)
      )
        continue;
      ids.add(id);
      views.push({ id, name, createdAt, state });
      if (views.length === MAX_PROCEDURE_VIEWS) break;
    }
    return views;
  } catch {
    return [];
  }
}

export function sameProcedureView(a: ProcedureViewState, b: ProcedureViewState) {
  const sameBounds =
    a.map?.bounds && b.map?.bounds
      ? (
          Object.keys(a.map.bounds) as (keyof NonNullable<
            NonNullable<ProcedureViewState["map"]>["bounds"]
          >)[]
        ).every((key) => Math.abs(a.map!.bounds![key] - b.map!.bounds![key]) < 0.00001)
      : !a.map?.bounds && !b.map?.bounds;
  return (
    (Object.keys(a.filters) as (keyof NexoProcedureFilters)[]).every(
      (key) => a.filters[key] === b.filters[key],
    ) &&
    a.rank?.kind === b.rank?.kind &&
    a.rank?.key === b.rank?.key &&
    a.time?.weekday === b.time?.weekday &&
    a.time?.hour === b.time?.hour &&
    a.range?.from === b.range?.from &&
    a.range?.to === b.range?.to &&
    JSON.stringify([...(a.map?.selectionIds || [])].sort()) ===
      JSON.stringify([...(b.map?.selectionIds || [])].sort()) &&
    sameBounds &&
    a.missingField === b.missingField &&
    a.sortOrder === b.sortOrder
  );
}
