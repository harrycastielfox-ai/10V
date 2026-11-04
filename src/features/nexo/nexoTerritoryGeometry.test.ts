import { describe, expect, it } from "vitest";
import { collectTerritoryPolygons, finishTerritoryPolygon } from "./nexoTerritoryGeometry";

const first = [
  { x: -39.56, y: -16.57 },
  { x: -39.55, y: -16.57 },
  { x: -39.55, y: -16.58 },
];
const second = [
  { x: -39.58, y: -16.56 },
  { x: -39.57, y: -16.56 },
  { x: -39.57, y: -16.57 },
];

describe("geometria territorial com várias áreas", () => {
  it("conclui um contorno e inicia outro sem ligar os pontos", () => {
    expect(finishTerritoryPolygon([], first)).toEqual({ polygons: [first], draft: [] });
    expect(finishTerritoryPolygon([first], second)).toEqual({
      polygons: [first, second],
      draft: [],
    });
  });

  it("preserva o contorno legado e inclui o rascunho válido no salvamento", () => {
    expect(collectTerritoryPolygons(first, [])).toEqual([first]);
    expect(collectTerritoryPolygons(first, [second])).toEqual([second, first]);
    expect(collectTerritoryPolygons(first.slice(0, 2), [second])).toEqual([second]);
  });
});
