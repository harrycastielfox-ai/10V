import { describe, expect, it } from "vitest";
import type { NexoMapPoint, NexoTerritorio } from "../nexoTypes";
import { findTerritoryOverlaps } from "./nexoTerritoryMapUtils";

function territory(id: string, pontos: NexoMapPoint[]): NexoTerritorio {
  return {
    id,
    organizacao_id: `org-${id}`,
    bairro: `Área ${id}`,
    categoria: "area_influencia",
    classificacao: "confirmado",
    confianca: 80,
    fonte_resumo: null,
    observacoes: null,
    logradouro: null,
    numero: null,
    complemento: null,
    municipio: "Itabela",
    uf: "BA",
    ponto_referencia: null,
    link_navegacao: null,
    pontos,
    created_at: "2026-10-17T12:00:00.000Z",
    updated_at: "2026-10-17T12:00:00.000Z",
  };
}

describe("findTerritoryOverlaps", () => {
  it("identifica duas áreas que se cruzam", () => {
    const first = territory("a", [
      { x: 10, y: 10 },
      { x: 50, y: 10 },
      { x: 50, y: 50 },
      { x: 10, y: 50 },
    ]);
    const second = territory("b", [
      { x: 30, y: 30 },
      { x: 70, y: 30 },
      { x: 70, y: 70 },
      { x: 30, y: 70 },
    ]);

    expect(findTerritoryOverlaps([first, second])).toHaveLength(1);
  });

  it("ignora áreas separadas e marcações incompletas", () => {
    const first = territory("a", [
      { x: 5, y: 5 },
      { x: 20, y: 5 },
      { x: 20, y: 20 },
      { x: 5, y: 20 },
    ]);
    const second = territory("b", [
      { x: 70, y: 70 },
      { x: 90, y: 70 },
      { x: 90, y: 90 },
      { x: 70, y: 90 },
    ]);
    const incomplete = territory("c", [
      { x: 10, y: 10 },
      { x: 15, y: 15 },
    ]);

    expect(findTerritoryOverlaps([first, second, incomplete])).toEqual([]);
  });
});
