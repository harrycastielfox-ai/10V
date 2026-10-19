import { describe, expect, it } from "vitest";
import type { NexoProcedureRow } from "./nexoProcedureAnalytics";
import { buildProcedureTrend } from "./nexoProcedureTrend";

function row(
  id: string,
  date: string | null,
  overrides: Partial<NexoProcedureRow> = {},
): NexoProcedureRow {
  return {
    id: `inquerito:${id}`,
    kind: "inquerito",
    procedureId: id,
    incidentId: id,
    number: id,
    nature: "Homicídio doloso",
    status: "Em andamento",
    neighborhood: "Centro",
    factDate: date,
    factTime: null,
    latitude: null,
    longitude: null,
    factions: [],
    cvli: true,
    linkedToNexo: true,
    context: null,
    ...overrides,
  };
}

describe("historical CVLI trend", () => {
  it("fills gap days and includes both declared endpoints", () => {
    const trend = buildProcedureTrend(
      [row("a", "2026-10-02"), row("b", "2026-10-04")],
      "2026-10-01",
      "2026-10-05",
    );
    expect(trend.granularity).toBe("day");
    expect(trend.buckets.map((bucket) => bucket.count)).toEqual([0, 1, 0, 1, 0]);
    expect(trend.buckets[0].from).toBe("2026-10-01");
    expect(trend.buckets.at(-1)?.to).toBe("2026-10-05");
    expect(trend.total).toBe(2);
  });

  it("aligns weeks to Monday through a year boundary and clips partial weeks", () => {
    const trend = buildProcedureTrend(
      [row("a", "2025-12-28"), row("b", "2025-12-29"), row("c", "2026-01-01")],
      "2025-12-20",
      "2026-02-03",
    );
    expect(trend.granularity).toBe("week");
    expect(trend.buckets[0]).toMatchObject({ from: "2025-12-20", to: "2025-12-21", count: 0 });
    expect(trend.buckets.find((bucket) => bucket.from === "2025-12-29")).toMatchObject({
      to: "2026-01-04",
      count: 2,
    });
    expect(trend.buckets.at(-1)?.to).toBe("2026-02-03");
    expect(trend.total).toBe(3);
  });

  it("keeps at most 40 buckets for long periods and preserves leap days", () => {
    const trend = buildProcedureTrend(
      [row("a", "2024-02-29"), row("b", "2026-01-01")],
      "1900-01-01",
      "2026-10-17",
    );
    expect(trend.granularity).toBe("month");
    expect(trend.step).toBeGreaterThan(1);
    expect(trend.buckets.length).toBeLessThanOrEqual(40);
    expect(trend.total).toBe(2);
    expect(trend.buckets[0].from).toBe("1900-01-01");
    expect(trend.buckets.at(-1)?.to).toBe("2026-10-17");
    expect(buildProcedureTrend([], "2025-01-01", "2025-10-07").buckets.length).toBeLessThanOrEqual(
      40,
    );
  });

  it("deduplicates linked BO/inquiry facts and excludes non-CVLI and invalid dates", () => {
    const trend = buildProcedureTrend(
      [
        row("a", "2026-10-02"),
        row("bo-a", "2026-10-02", { kind: "bo", incidentId: "a" }),
        row("b", null),
        row("c", "2026-02-30"),
        row("d", "2026-10-03", { cvli: false }),
        row("e", "2026-09-30"),
      ],
      "2026-10-01",
      "2026-10-05",
    );
    expect(trend).toMatchObject({
      total: 1,
      sourceTotal: 4,
      knownDates: 2,
      missingDates: 2,
      outsideRange: 1,
    });
  });

  it("derives the open range from valid factual dates and rejects reversed ranges", () => {
    const rows = [row("a", "2026-10-02"), row("b", "2026-10-04")];
    expect(buildProcedureTrend(rows)).toMatchObject({
      from: "2026-10-02",
      to: "2026-10-04",
      total: 2,
    });
    expect(buildProcedureTrend(rows, "2026-10-10", "")).toMatchObject({
      from: "2026-10-10",
      to: "2026-10-10",
      total: 0,
      invalidRange: false,
    });
    expect(buildProcedureTrend(rows, "2026-10-05", "2026-10-01").invalidRange).toBe(true);
    expect(buildProcedureTrend(rows, "2026-02-30", "").invalidRange).toBe(true);
    expect(buildProcedureTrend([row("missing", null)]).buckets).toEqual([]);
  });
});
