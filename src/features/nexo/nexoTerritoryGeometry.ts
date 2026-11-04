import type { NexoMapPoint } from "./nexoTypes";

function validPolygon(points: NexoMapPoint[]) {
  return points.length >= 3;
}

function samePolygon(first: NexoMapPoint[], second: NexoMapPoint[]) {
  return (
    first.length === second.length &&
    first.every((point, index) => point.x === second[index]?.x && point.y === second[index]?.y)
  );
}

export function collectTerritoryPolygons(draft: NexoMapPoint[], polygons: NexoMapPoint[][] = []) {
  const complete = polygons.filter(validPolygon);
  if (validPolygon(draft) && !complete.some((polygon) => samePolygon(polygon, draft))) {
    return [...complete, draft];
  }
  return complete;
}

export function finishTerritoryPolygon(polygons: NexoMapPoint[][], draft: NexoMapPoint[]) {
  return {
    polygons: collectTerritoryPolygons(draft, polygons),
    draft: [] as NexoMapPoint[],
  };
}

export function territoryPolygons(territory: {
  pontos: NexoMapPoint[];
  poligonos?: NexoMapPoint[][] | null;
}) {
  return collectTerritoryPolygons(territory.pontos, territory.poligonos || []);
}
