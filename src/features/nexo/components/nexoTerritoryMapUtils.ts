import type { NexoMapPoint, NexoTerritorio } from "../nexoTypes";

export function centerOf(points: NexoMapPoint[]) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function pointInPolygon(point: NexoMapPoint, polygon: NexoMapPoint[]) {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current++
  ) {
    const a = polygon[current];
    const b = polygon[previous];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function orientation(a: NexoMapPoint, b: NexoMapPoint, c: NexoMapPoint) {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function segmentsIntersect(
  firstA: NexoMapPoint,
  firstB: NexoMapPoint,
  secondA: NexoMapPoint,
  secondB: NexoMapPoint,
) {
  const first = orientation(firstA, firstB, secondA);
  const second = orientation(firstA, firstB, secondB);
  const third = orientation(secondA, secondB, firstA);
  const fourth = orientation(secondA, secondB, firstB);
  return first * second < 0 && third * fourth < 0;
}

function polygonsOverlap(first: NexoMapPoint[], second: NexoMapPoint[]) {
  if (first.some((point) => pointInPolygon(point, second))) return true;
  if (second.some((point) => pointInPolygon(point, first))) return true;
  return first.some((firstPoint, firstIndex) =>
    second.some((secondPoint, secondIndex) =>
      segmentsIntersect(
        firstPoint,
        first[(firstIndex + 1) % first.length],
        secondPoint,
        second[(secondIndex + 1) % second.length],
      ),
    ),
  );
}

export function findTerritoryOverlaps(territories: NexoTerritorio[]) {
  const valid = territories.filter((territory) => territory.pontos.length >= 3);
  return valid.flatMap((territory, index) =>
    valid.slice(index + 1).flatMap((candidate) =>
      polygonsOverlap(territory.pontos, candidate.pontos)
        ? [
            {
              id: `${territory.id}:${candidate.id}`,
              first: territory,
              second: candidate,
              center: {
                x: (centerOf(territory.pontos).x + centerOf(candidate.pontos).x) / 2,
                y: (centerOf(territory.pontos).y + centerOf(candidate.pontos).y) / 2,
              },
            },
          ]
        : [],
    ),
  );
}
