import { describe, expect, it } from "vitest";
import type { NexoProcedureContext, NexoProcedureRow } from "./nexoProcedureAnalytics";
import { describeProcedureIncident } from "./nexoProcedureProvenance";

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
    updated_at: "2026-10-18T12:00:00Z",
    ...overrides,
  };
}

function row(id: string, overrides: Partial<NexoProcedureRow> = {}): NexoProcedureRow {
  return {
    id: `inquerito:${id}`,
    kind: "inquerito",
    procedureId: id,
    incidentId: "shared",
    number: `IP ${id}`,
    nature: "Homicídio doloso",
    status: "Em andamento",
    neighborhood: "Centro",
    factDate: "2026-10-12",
    factTime: null,
    sourceFactDate: "2026-10-12",
    sourceNeighborhood: "Centro",
    latitude: null,
    longitude: null,
    factions: ["Grupo Atlas"],
    cvli: true,
    linkedToNexo: true,
    context: null,
    ...overrides,
  };
}

describe("NEXO procedure incident provenance", () => {
  it("keeps an original value visible while treating its own complement as a correction, not a conflict", () => {
    const result = describeProcedureIncident(
      [
        row("ip", {
          context: context({ data_fato: "2026-10-13", bairro: "Bairro corrigido" }),
        }),
      ],
      "shared",
    )!;
    expect(result.disagreementCount).toBe(0);
    expect(result.fields.date.value).toBe("2026-10-13");
    expect(result.fields.date.sources).toMatchObject([
      { origin: "original", value: "2026-10-12", effective: false, selected: false },
      {
        origin: "complement",
        value: "2026-10-13",
        effective: true,
        selected: true,
        sourceText: "Relatório conferido",
        updatedAt: "2026-10-18T12:00:00Z",
      },
    ]);
    expect(result.fields.date.chosenSource?.origin).toBe("complement");
  });

  it("detects disagreements between two effective sourced values while consistently choosing the inquiry", () => {
    const inquiry = row("ip", {
      context: context({ data_fato: "2026-10-10", hora_fato: "21:35", fonte: "Fonte IP" }),
    });
    const bo = row("bo", {
      id: "bo:bo",
      kind: "bo",
      number: "BO 123",
      context: context({ data_fato: "2026-10-15", hora_fato: "09:05", fonte: "Fonte BO" }),
    });
    const result = describeProcedureIncident([bo, inquiry], "shared")!;
    expect(result).toEqual(describeProcedureIncident([inquiry, bo], "shared"));
    expect(result.incident.factDate).toBe("2026-10-10");
    expect(result.fields.date).toMatchObject({ value: "2026-10-10", hasDisagreement: true });
    expect(result.fields.time).toMatchObject({ value: "21:35", hasDisagreement: true });
    expect(result.fields.date.chosenSource?.number).toBe("IP ip");
    expect(result.disagreementCount).toBe(2);
  });

  it("does not invent original B.O. time or coordinates from inherited row values", () => {
    const result = describeProcedureIncident(
      [
        row("ip", {
          context: context({ hora_fato: "21:35", latitude: -16.5, longitude: -39.5 }),
        }),
        row("bo", {
          id: "bo:bo",
          kind: "bo",
          factTime: "21:35",
          latitude: -16.5,
          longitude: -39.5,
        }),
      ],
      "shared",
    )!;
    expect(result.fields.time.sources).toHaveLength(1);
    expect(result.fields.time.sources[0]).toMatchObject({
      recordId: "inquerito:ip",
      origin: "complement",
    });
    expect(result.fields.coordinates.sources).toHaveLength(1);
    expect(result.fields.coordinates.sources[0].origin).toBe("complement");
    expect(result.disagreementCount).toBe(0);
  });

  it("does not count an inquiry date correction against the B.O.'s inherited old source date", () => {
    const result = describeProcedureIncident(
      [
        row("ip", {
          factDate: "2026-10-13",
          context: context({ data_fato: "2026-10-13" }),
        }),
        row("bo", { id: "bo:bo", kind: "bo", factDate: "2026-10-13" }),
      ],
      "shared",
    )!;
    expect(result.fields.date.hasDisagreement).toBe(false);
    expect(result.fields.date.sources).toHaveLength(2);
    expect(result.fields.date.sources.every((source) => source.kind === "inquerito")).toBe(true);
  });

  it("does not turn an inherited inquiry neighborhood correction into a B.O. disagreement", () => {
    const result = describeProcedureIncident(
      [
        row("ip", {
          neighborhood: "Bairro corrigido",
          context: context({ bairro: "Bairro corrigido" }),
        }),
        row("bo", { id: "bo:bo", kind: "bo", neighborhood: "Bairro corrigido" }),
      ],
      "shared",
    )!;
    expect(result.fields.neighborhood.hasDisagreement).toBe(false);
    expect(result.fields.neighborhood.sources).toHaveLength(2);
    expect(result.fields.neighborhood.sources.every((source) => source.kind === "inquerito")).toBe(
      true,
    );
  });

  it("keeps a B.O.'s own original neighborhood as effective evidence when it disagrees", () => {
    const result = describeProcedureIncident(
      [
        row("ip", {
          neighborhood: "Bairro corrigido",
          context: context({ bairro: "Bairro corrigido" }),
        }),
        row("bo", { id: "bo:bo", kind: "bo" }),
      ],
      "shared",
    )!;
    expect(result.fields.neighborhood.hasDisagreement).toBe(true);
    expect(result.fields.neighborhood.sources.find((source) => source.kind === "bo")).toMatchObject(
      {
        origin: "original",
        value: "Centro",
        effective: true,
        selected: false,
      },
    );
  });

  it("excludes invalid date/time/coordinate evidence and respects explicitly missing originals", () => {
    const result = describeProcedureIncident(
      [
        row("invalid", {
          factDate: "2026-02-30",
          factTime: "25:00",
          sourceFactDate: null,
          sourceNeighborhood: null,
          neighborhood: null,
          latitude: -91,
          longitude: -39,
          context: context({
            data_fato: "2026-02-30",
            hora_fato: "21:80",
            latitude: Number.NaN,
            longitude: -39,
          }),
        }),
      ],
      "shared",
    )!;
    expect(result.fields.date.value).toBeNull();
    expect(result.fields.time.value).toBeNull();
    expect(result.fields.neighborhood.value).toBeNull();
    expect(result.fields.coordinates.value).toBeNull();
    for (const field of Object.values(result.fields)) expect(field.sources).toEqual([]);
    expect(describeProcedureIncident([], "missing")).toBeNull();
  });

  it("compares meaningful neighborhoods without accent/case noise and requires a full coordinate pair", () => {
    const result = describeProcedureIncident(
      [
        row("ip", {
          sourceNeighborhood: "São José",
          neighborhood: "São José",
          context: context({ latitude: -16.5, longitude: -39.5 }),
        }),
        row("bo", {
          id: "bo:bo",
          kind: "bo",
          sourceNeighborhood: "sao jose",
          neighborhood: "sao jose",
          context: context({ latitude: -16.5, longitude: null }),
        }),
      ],
      "shared",
    )!;
    expect(result.fields.neighborhood.hasDisagreement).toBe(false);
    expect(result.fields.coordinates.sources).toHaveLength(1);
    expect(result.fields.coordinates.value).toEqual({ latitude: -16.5, longitude: -39.5 });
  });
});
