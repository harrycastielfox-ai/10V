import { describe, expect, it } from "vitest";
import type { NexoProcedureContext, NexoProcedureRow } from "./nexoProcedureAnalytics";
import { EMPTY_PROCEDURE_FILTERS } from "./nexoProcedureAnalytics";
import {
  buildProcedureHeatmap,
  compareProcedurePeriods,
  procedureDataCoverage,
  procedureMissingFields,
  resolveProcedureScope,
  uniqueProcedureIncidents,
} from "./nexoProcedureInsights";

function row(id: string, overrides: Partial<NexoProcedureRow> = {}): NexoProcedureRow {
  return {
    id: `inquerito:${id}`,
    kind: "inquerito",
    procedureId: id,
    incidentId: id,
    number: `IP ${id}`,
    nature: "Homicídio doloso",
    status: "Em andamento",
    neighborhood: "Centro",
    factDate: "2026-10-12",
    factTime: "21:35",
    latitude: -16.57,
    longitude: -39.56,
    factions: ["Grupo Atlas"],
    cvli: true,
    linkedToNexo: true,
    context: null,
    ...overrides,
  };
}

function context(overrides: Partial<NexoProcedureContext> = {}): NexoProcedureContext {
  return {
    id: "context",
    inquerito_id: null,
    bo_id: null,
    data_fato: null,
    hora_fato: null,
    bairro: null,
    latitude: null,
    longitude: null,
    fonte: "Relatório conferido",
    updated_at: "2026-10-17T12:00:00Z",
    ...overrides,
  };
}

describe("NEXO advanced procedure insights", () => {
  it("merges missing facts across an inquiry and its B.O. without duplicating the incident", () => {
    const inquiry = row("shared", {
      factDate: null,
      factTime: null,
      neighborhood: null,
      latitude: -16,
      longitude: null,
      cvli: false,
      linkedToNexo: false,
    });
    const bo = row("bo", {
      incidentId: "shared",
      kind: "bo",
      factions: ["grupo atlas", "Núcleo Norte"],
    });
    const originalInquiry = { ...inquiry };
    const incidents = uniqueProcedureIncidents([inquiry, bo]);
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      incidentId: "shared",
      factDate: "2026-10-12",
      factTime: "21:35",
      neighborhood: "Centro",
      latitude: -16.57,
      longitude: -39.56,
      cvli: true,
      linkedToNexo: true,
      factions: ["Grupo Atlas", "Núcleo Norte"],
    });
    expect(inquiry).toEqual(originalInquiry);
  });

  it("never constructs a point from two incomplete coordinate pairs or replaces a valid first fact", () => {
    const incidents = uniqueProcedureIncidents([
      row("one", { latitude: -16, longitude: null }),
      row("two", {
        incidentId: "one",
        latitude: null,
        longitude: -39,
        factDate: "2026-10-13",
      }),
    ]);
    expect(incidents[0]).toMatchObject({
      latitude: null,
      longitude: null,
      factDate: "2026-10-12",
    });
  });

  it("resolves conflicting B.O./inquiry facts consistently regardless of input order", () => {
    const inquiry = row("ip", {
      incidentId: "shared",
      factDate: "2026-10-12",
      neighborhood: "Centro",
      context: context({ data_fato: "2026-10-10", latitude: -16.5, longitude: -39.5 }),
    });
    const bo = row("bo", {
      incidentId: "shared",
      kind: "bo",
      factDate: "2026-10-15",
      neighborhood: "Outro bairro",
      context: context({
        data_fato: "2026-10-14",
        bairro: "Bairro conferido",
        latitude: -17,
        longitude: -40,
      }),
    });
    const first = uniqueProcedureIncidents([inquiry, bo]);
    const reversed = uniqueProcedureIncidents([bo, inquiry]);
    expect(first).toEqual(reversed);
    expect(first[0]).toMatchObject({
      id: "inquerito:ip",
      factDate: "2026-10-10",
      neighborhood: "Bairro conferido",
      latitude: -16.5,
      longitude: -39.5,
    });
  });

  it("establishes one factual date before date filtering, even when linked records contradict it", () => {
    const rows = [
      row("ip", {
        incidentId: "shared",
        factDate: "2026-10-10",
        context: context({ data_fato: "2026-10-10", fonte: "Conferência do inquérito" }),
      }),
      row("bo", {
        incidentId: "shared",
        kind: "bo",
        factDate: "2026-10-15",
        context: context({ data_fato: "2026-10-15", fonte: "Conferência do B.O." }),
      }),
    ];
    const incorrectDate = resolveProcedureScope(rows, {
      ...EMPTY_PROCEDURE_FILTERS,
      from: "2026-10-15",
      to: "2026-10-15",
    });
    expect(incorrectDate.procedures).toEqual([]);
    expect(incorrectDate.incidents).toEqual([]);
    expect(incorrectDate.comparisonIncidents).toHaveLength(1);
    expect(incorrectDate.comparisonIncidents[0].factDate).toBe("2026-10-10");

    const correctDate = resolveProcedureScope(rows, {
      ...EMPTY_PROCEDURE_FILTERS,
      from: "2026-10-10",
      to: "2026-10-10",
    });
    expect(correctDate.procedures).toHaveLength(2);
    expect(correctDate.procedures.map((item) => item.factDate)).toEqual([
      "2026-10-10",
      "2026-10-10",
    ]);
    expect(correctDate.incidents).toHaveLength(1);
  });

  it("keeps canonical table/export facts when type and number filters retain only the B.O.", () => {
    const inquiryContext = context({
      data_fato: "2026-10-10",
      hora_fato: "21:35",
      bairro: "Centro conferido",
      latitude: -16.5,
      longitude: -39.5,
      fonte: "Conferência do inquérito",
    });
    const boContext = context({
      data_fato: "2026-10-15",
      hora_fato: "09:05",
      bairro: "Bairro divergente",
      latitude: -17,
      longitude: -40,
      fonte: "Conferência do B.O.",
    });
    const scope = resolveProcedureScope(
      [
        row("ip", { incidentId: "shared", context: inquiryContext }),
        row("bo", {
          incidentId: "shared",
          kind: "bo",
          number: "BO 123/2026",
          sourceFactDate: "2026-10-15",
          sourceNeighborhood: "Bairro original",
          context: boContext,
          cvli: false,
        }),
      ],
      {
        ...EMPTY_PROCEDURE_FILTERS,
        kind: "bo",
        query: "BO 123",
        classification: "cvli",
        from: "2026-10-10",
        to: "2026-10-10",
      },
    );
    expect(scope.procedures).toHaveLength(1);
    expect(scope.procedures[0]).toMatchObject({
      procedureId: "bo",
      kind: "bo",
      number: "BO 123/2026",
      factDate: "2026-10-10",
      factTime: "21:35",
      neighborhood: "Centro conferido",
      latitude: -16.5,
      longitude: -39.5,
      cvli: true,
      sourceFactDate: "2026-10-15",
      sourceNeighborhood: "Bairro original",
      context: boContext,
    });
    expect(scope.procedures[0].analysisSources).toEqual([
      "Conferência do B.O.",
      "Conferência do inquérito",
    ]);
    expect(scope.incidents[0].factDate).toBe("2026-10-10");
    expect(scope.comparisonIncidents[0].factDate).toBe("2026-10-10");
  });

  it("builds a 168-cell CVLI calendar grid using factual weekdays and hours", () => {
    const heatmap = buildProcedureHeatmap([
      row("one"),
      row("bo", { kind: "bo", incidentId: "one" }),
      row("midnight", { factDate: "2026-10-11", factTime: "00:01" }),
      row("unrelated", { cvli: false }),
      row("missing-time", { factTime: null }),
      row("missing-date", { factDate: null }),
    ]);
    expect(heatmap.cells).toHaveLength(168);
    expect(heatmap.cells[0]).toEqual({ weekday: 1, hour: 0, count: 0 });
    expect(heatmap.cells.find((cell) => cell.weekday === 1 && cell.hour === 21)?.count).toBe(1);
    expect(heatmap.cells.find((cell) => cell.weekday === 0 && cell.hour === 0)?.count).toBe(1);
    expect(heatmap).toMatchObject({
      total: 4,
      knownTimes: 2,
      missingDates: 1,
      missingTimes: 1,
      coveragePercent: 50,
    });
  });

  it("treats invalid fact dates and times as incomplete rather than rolling them into another cell", () => {
    const invalid = row("invalid", {
      factDate: "2026-02-30",
      factTime: "25:35",
      neighborhood: "Não informado",
      latitude: Number.NaN,
    });
    expect(procedureMissingFields(invalid)).toEqual([
      "date",
      "time",
      "neighborhood",
      "coordinates",
    ]);
    expect(buildProcedureHeatmap([invalid])).toMatchObject({
      knownTimes: 0,
      total: 1,
      maxCount: 0,
      peak: null,
    });
    expect(compareProcedurePeriods([invalid], "2026-02-01", "2026-02-28")?.undated).toBe(1);
  });

  it("compares inclusive adjacent windows over a year boundary and deduplicates both periods", () => {
    const result = compareProcedurePeriods(
      [
        row("current-start", { factDate: "2026-01-01" }),
        row("current-end", { factDate: "2026-01-03" }),
        row("current-other", { factDate: "2026-01-02", cvli: false }),
        row("previous-start", { factDate: "2025-12-29" }),
        row("previous-bo", {
          factDate: "2025-12-29",
          kind: "bo",
          incidentId: "previous-start",
        }),
        row("previous-other", { factDate: "2025-12-31", cvli: false }),
        row("too-old", { factDate: "2025-12-28" }),
        row("too-new", { factDate: "2026-01-04" }),
        row("undated", { factDate: null }),
      ],
      "2026-01-01",
      "2026-01-03",
    );
    expect(result).toEqual({
      days: 3,
      current: { from: "2026-01-01", to: "2026-01-03", total: 3, cvli: 2 },
      previous: { from: "2025-12-29", to: "2025-12-31", total: 2, cvli: 1 },
      delta: 1,
      deltaPercent: 100,
      totalDelta: 1,
      totalDeltaPercent: 50,
      undated: 1,
    });
  });

  it("uses leap days and returns no percentage when the previous count is zero", () => {
    const result = compareProcedurePeriods(
      [row("current", { factDate: "2024-03-01" })],
      "2024-03-01",
      "2024-03-01",
    );
    expect(result).toMatchObject({
      days: 1,
      previous: { from: "2024-02-29", to: "2024-02-29", total: 0, cvli: 0 },
      delta: 1,
      deltaPercent: null,
      totalDeltaPercent: null,
    });
    expect(compareProcedurePeriods([], "", "2026-10-12")).toBeNull();
    expect(compareProcedurePeriods([], "2026-10-13", "2026-10-12")).toBeNull();
    expect(compareProcedurePeriods([], "2026-02-30", "2026-03-01")).toBeNull();
  });

  it("reports incident completeness after linked procedures fill each other's missing fields", () => {
    const coverage = procedureDataCoverage([
      row("shared", { latitude: null, longitude: null, factTime: null }),
      row("bo", { incidentId: "shared", kind: "bo", factDate: null }),
      row("incomplete", {
        factDate: null,
        factTime: null,
        neighborhood: " ",
        latitude: null,
        longitude: null,
      }),
    ]);
    expect(coverage).toEqual({
      total: 2,
      complete: 1,
      coveragePercent: 50,
      missingDate: 1,
      missingTime: 1,
      missingNeighborhood: 1,
      missingCoordinates: 1,
      withDate: 1,
      withTime: 1,
      withNeighborhood: 1,
      withCoordinates: 1,
    });
    expect(procedureDataCoverage([]).coveragePercent).toBe(0);
  });
});
