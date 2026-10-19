import { describe, expect, it } from "vitest";
import { EMPTY_PROCEDURE_FILTERS } from "./nexoProcedureAnalytics";
import {
  MAX_PROCEDURE_VIEWS,
  parseProcedureViews,
  sameProcedureView,
  type SavedProcedureView,
} from "./nexoProcedureViews";

function view(id = "view-1"): SavedProcedureView {
  return {
    id,
    name: "CVLI · Centro",
    createdAt: "2026-10-18T02:00:00Z",
    state: {
      filters: {
        ...EMPTY_PROCEDURE_FILTERS,
        classification: "cvli",
        from: "2026-10-01",
        to: "2026-10-18",
      },
      rank: { kind: "neighborhood", key: "centro" },
      time: { weekday: 1, hour: 21 },
      range: { from: "2026-10-06", to: "2026-10-12" },
      map: null,
      missingField: "time",
      sortOrder: "pending",
    },
  };
}

describe("saved procedure views", () => {
  it("ignores corrupted storage and rejects impossible date/hour filters", () => {
    expect(parseProcedureViews("{broken")).toEqual([]);
    const invalidDate = view("invalid-date");
    invalidDate.state.filters.from = "2026-02-30";
    const invalidHour = view("invalid-hour");
    invalidHour.state.time = { weekday: 7, hour: 24 };
    expect(parseProcedureViews(JSON.stringify([invalidDate, invalidHour, view()]))).toEqual([
      view(),
    ]);
  });

  it("bounds storage size and rejects duplicate IDs without losing valid views", () => {
    const list = [
      view(),
      view(),
      ...Array.from({ length: 14 }, (_, index) => view(`view-${index + 2}`)),
    ];
    const parsed = parseProcedureViews(JSON.stringify(list));
    expect(parsed).toHaveLength(MAX_PROCEDURE_VIEWS);
    expect(new Set(parsed.map((item) => item.id)).size).toBe(MAX_PROCEDURE_VIEWS);
    expect(parseProcedureViews(" ".repeat(50_001))).toEqual([]);
  });

  it("restores the exact factual period, rank and completeness filter", () => {
    const saved = view();
    const [restored] = parseProcedureViews(JSON.stringify([saved]));
    expect(sameProcedureView(restored.state, saved.state)).toBe(true);
    expect(sameProcedureView(restored.state, { ...saved.state, missingField: "coordinates" })).toBe(
      false,
    );
    expect(sameProcedureView(restored.state, { ...saved.state, time: null })).toBe(false);
  });

  it("rejects array-valued enums and invalid geographic bounds", () => {
    const malformed = view();
    const badEnum = {
      ...malformed,
      state: {
        ...malformed.state,
        filters: { ...malformed.state.filters, kind: ["todos"], classification: ["cvli"] },
      },
    };
    expect(parseProcedureViews(JSON.stringify([badEnum]))).toEqual([]);
    const badBounds = {
      ...malformed,
      state: {
        ...malformed.state,
        map: {
          selectionIds: ["inquerito:1"],
          bounds: { north: 100, south: -16, east: -39, west: -40 },
        },
      },
    };
    expect(parseProcedureViews(JSON.stringify([badBounds]))).toEqual([]);
    const withMap = view();
    withMap.state.map = {
      selectionIds: ["inquerito:1"],
      bounds: { north: -16.55, south: -16.59, east: -39.55, west: -39.59 },
    };
    expect(parseProcedureViews(JSON.stringify([withMap]))[0].state.map).toEqual(withMap.state.map);
  });
});
