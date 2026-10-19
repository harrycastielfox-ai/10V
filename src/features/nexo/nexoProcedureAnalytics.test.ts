import { describe, expect, it } from "vitest";
import type { BoRecord } from "@/features/bo/boTypes";
import type { InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import {
  buildNexoProcedureRows,
  EMPTY_PROCEDURE_FILTERS,
  filterNexoProcedureRows,
  geocodedProcedureIncidents,
  summarizeNexoProcedures,
  validProcedureCoordinates,
  type NexoProcedureContext,
} from "./nexoProcedureAnalytics";
import type { NexoRegistroVinculado } from "./nexoTypes";

function inquiry(id: string, overrides: Partial<InqueritoRecord> = {}) {
  return {
    id,
    numero_ppe: `IP ${id}`,
    numero_bo: null,
    faccao: "Sim",
    nome_faccao: "Grupo Atlas",
    categoria_criminal: "CVLI",
    tipificacao: "Homicídio doloso",
    bairro: "Centro",
    data_fato: "2026-10-12",
    situacao: "Em andamento",
    created_at: "2026-10-17T10:00:00Z",
    ...overrides,
  } as InqueritoRecord;
}

function report(id: string, overrides: Partial<BoRecord> = {}) {
  return {
    id,
    numero_bo: `BO ${id}`,
    infracao_penal: "Homicídio doloso",
    status: "Em Andamento",
    inquerito_id: null,
    local_bairro: "Centro",
    created_at: "2026-10-17T23:00:00Z",
    ...overrides,
  } as BoRecord;
}

function build(
  inquiries: InqueritoRecord[],
  reports: BoRecord[] = [],
  links: NexoRegistroVinculado[] = [],
  contexts: NexoProcedureContext[] = [],
) {
  return buildNexoProcedureRows({
    inquiries,
    reports,
    links,
    contexts,
    organizations: [],
    people: [],
  });
}

describe("NEXO procedural analytics", () => {
  it("includes confirmed faction cases, not 'Não' or 'A definir'", () => {
    const rows = build([
      inquiry("yes"),
      inquiry("no", { faccao: "Não", nome_faccao: "Grupo Atlas" }),
      inquiry("pending", { faccao: "A definir", nome_faccao: null }),
    ]);
    expect(rows.map((row) => row.procedureId)).toEqual(["yes"]);
  });

  it("includes an explicitly linked case even without the source flag", () => {
    const rows = build([inquiry("linked", { faccao: "Não", nome_faccao: null })], [], [
      {
        id: "link-1",
        inquerito_id: "linked",
        bo_id: null,
        organizacao_id: "org-1",
        pessoa_id: null,
      },
    ] as NexoRegistroVinculado[]);
    expect(rows).toHaveLength(1);
    expect(rows[0].linkedToNexo).toBe(true);
  });

  it("deduplicates an inquiry and its B.O. for CVLI rankings", () => {
    const rows = build(
      [inquiry("one", { numero_bo: "BO 001" })],
      [report("bo-1", { numero_bo: "BO 001", inquerito_id: "one" })],
    );
    const summary = summarizeNexoProcedures(rows);
    expect(summary.total).toBe(2);
    expect(summary.cvli).toBe(1);
    expect(summary.neighborhoods).toEqual([{ key: "centro", label: "Centro", count: 1 }]);
  });

  it("uses the fact date, never the registration timestamp, and does not invent an hour", () => {
    const rows = build([
      inquiry("one", { data_fato: "2026-10-12", created_at: "2026-10-17T23:00:00Z" }),
      inquiry("two", { data_fato: null, created_at: "2026-10-17T21:00:00Z" }),
    ]);
    const summary = summarizeNexoProcedures(rows);
    expect(summary.knownDates).toBe(1);
    expect(summary.dates[0].key).toBe("2026-10-12");
    expect(summary.hours).toEqual([]);
  });

  it("uses sourced NEXO context for missing hour and analytical corrections", () => {
    const rows = build(
      [inquiry("one")],
      [],
      [],
      [
        {
          id: "context-1",
          inquerito_id: "one",
          bo_id: null,
          data_fato: "2026-10-11",
          hora_fato: "21:35:00",
          bairro: "São José",
          latitude: null,
          longitude: null,
          fonte: "Relatório conferido",
          updated_at: "2026-10-17T12:00:00Z",
        },
      ],
    );
    const summary = summarizeNexoProcedures(rows);
    expect(rows[0].factDate).toBe("2026-10-11");
    expect(rows[0].factTime).toBe("21:35");
    expect(summary.hours[0]).toMatchObject({ key: "21", count: 1 });
    expect(summary.neighborhoods[0].key).toBe("sao jose");
  });

  it("filters by factual period and CVLI without including undated cases", () => {
    const rows = build([
      inquiry("in", { data_fato: "2026-10-12" }),
      inquiry("out", { data_fato: "2026-09-01" }),
      inquiry("undated", { data_fato: null }),
      inquiry("other", { categoria_criminal: "DROGAS", tipificacao: "Tráfico" }),
    ]);
    const filtered = filterNexoProcedureRows(rows, {
      ...EMPTY_PROCEDURE_FILTERS,
      from: "2026-10-01",
      to: "2026-10-31",
      classification: "cvli",
    });
    expect(filtered.map((row) => row.procedureId)).toEqual(["in"]);
  });

  it("maps only valid sourced coordinates and merges a B.O. with its inquiry", () => {
    const rows = build(
      [inquiry("one", { numero_bo: "BO 001" }), inquiry("two")],
      [report("bo-1", { numero_bo: "BO 001", inquerito_id: "one" })],
      [],
      [
        {
          id: "point-1",
          inquerito_id: null,
          bo_id: "bo-1",
          data_fato: null,
          hora_fato: null,
          bairro: null,
          latitude: -16.5702,
          longitude: -39.5635,
          fonte: "Local conferido",
          updated_at: "2026-10-17T12:00:00Z",
        },
      ],
    );
    const mapped = geocodedProcedureIncidents(rows);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({ incidentId: "one", latitude: -16.5702 });
    expect(validProcedureCoordinates(-91, -39)).toBeNull();
    expect(validProcedureCoordinates(0, 0)).toEqual({ latitude: 0, longitude: 0 });
  });
});
