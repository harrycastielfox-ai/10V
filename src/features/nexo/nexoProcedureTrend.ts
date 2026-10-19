import type { NexoProcedureRow } from "./nexoProcedureAnalytics";
import { uniqueProcedureIncidents } from "./nexoProcedureInsights";

const DAY = 86_400_000;

export interface ProcedureTrendBucket {
  from: string;
  to: string;
  label: string;
  count: number;
}

export interface ProcedureTrend {
  granularity: "day" | "week" | "month";
  /** Number of calendar months per bucket; one for daily/weekly series. */
  step: number;
  from: string | null;
  to: string | null;
  buckets: ProcedureTrendBucket[];
  /** Unique CVLI incidents inside the displayed range with a valid fact date. */
  total: number;
  sourceTotal: number;
  knownDates: number;
  missingDates: number;
  outsideRange: number;
  maxCount: number;
  invalidRange: boolean;
}

function timestamp(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
    ? parsed
    : null;
}

function iso(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

function shortDate(value: number) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function monthIndex(value: number) {
  const date = new Date(value);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function monthStart(index: number) {
  const date = new Date(0);
  date.setUTCFullYear(Math.floor(index / 12), index % 12, 1);
  return date.getTime();
}

/** Calendar-aligned, zero-filled CVLI trend based exclusively on dates of the facts. */
export function buildProcedureTrend(rows: NexoProcedureRow[], from = "", to = ""): ProcedureTrend {
  const incidents = uniqueProcedureIncidents(rows).filter((row) => row.cvli);
  const dates = incidents
    .map((row) => timestamp(row.factDate))
    .filter((date): date is number => date !== null)
    .sort((a, b) => a - b);
  const result: ProcedureTrend = {
    granularity: "day",
    step: 1,
    from: null,
    to: null,
    buckets: [],
    total: 0,
    sourceTotal: incidents.length,
    knownDates: dates.length,
    missingDates: incidents.length - dates.length,
    outsideRange: 0,
    maxCount: 0,
    invalidRange: false,
  };
  const requestedStart = timestamp(from);
  const requestedEnd = timestamp(to);
  if (
    (from && requestedStart === null) ||
    (to && requestedEnd === null) ||
    (requestedStart !== null && requestedEnd !== null && requestedStart > requestedEnd)
  ) {
    return { ...result, invalidRange: true };
  }
  const start =
    requestedStart ?? (dates.length ? Math.min(dates[0], requestedEnd ?? Infinity) : requestedEnd);
  const end =
    requestedEnd ??
    (dates.length
      ? Math.max(dates[dates.length - 1], requestedStart ?? -Infinity)
      : requestedStart);
  if (start === null || end === null) return result;
  result.from = iso(start);
  result.to = iso(end);
  const days = Math.round((end - start) / DAY) + 1;
  const monday = start - ((new Date(start).getUTCDay() + 6) % 7) * DAY;
  const weekCount = Math.floor((end - monday) / (7 * DAY)) + 1;
  const monthCount = monthIndex(end) - monthIndex(start) + 1;
  if (days <= 40) {
    result.granularity = "day";
  } else if (weekCount <= 40) {
    result.granularity = "week";
  } else {
    result.granularity = "month";
    result.step = Math.ceil(monthCount / 40);
  }
  const ranges: Array<{ start: number; end: number }> = [];
  if (result.granularity === "month") {
    const firstMonth = monthIndex(start);
    for (let index = firstMonth; index <= monthIndex(end); index += result.step) {
      ranges.push({
        start: Math.max(start, monthStart(index)),
        end: Math.min(end, monthStart(index + result.step) - DAY),
      });
    }
  } else {
    const width = result.granularity === "day" ? DAY : 7 * DAY;
    for (
      let cursor = result.granularity === "day" ? start : monday;
      cursor <= end;
      cursor += width
    ) {
      ranges.push({ start: Math.max(start, cursor), end: Math.min(end, cursor + width - DAY) });
    }
  }
  let cursor = 0;
  while (cursor < dates.length && dates[cursor] < start) cursor += 1;
  result.buckets = ranges.map((range) => {
    let count = 0;
    while (cursor < dates.length && dates[cursor] <= range.end) {
      count += 1;
      cursor += 1;
    }
    const label =
      result.granularity === "day"
        ? shortDate(range.start)
        : result.granularity === "month" && result.step === 1
          ? new Date(range.start)
              .toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
              .replace(" de ", "/")
          : result.granularity === "month"
            ? `${new Date(range.start).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric", timeZone: "UTC" })}–${new Date(range.end).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric", timeZone: "UTC" })}`
            : `${shortDate(range.start)}–${shortDate(range.end)}`;
    return { from: iso(range.start), to: iso(range.end), label, count };
  });
  result.total = result.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  result.maxCount = Math.max(0, ...result.buckets.map((bucket) => bucket.count));
  result.outsideRange = result.knownDates - result.total;
  return result;
}
