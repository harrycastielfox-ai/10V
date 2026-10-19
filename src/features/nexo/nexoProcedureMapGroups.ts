export interface GroupableProcedurePoint {
  id: string;
  latitude: number;
  longitude: number;
  cvli: boolean;
}

export interface ProcedurePointGroup<T extends GroupableProcedurePoint> {
  id: string;
  latitude: number;
  longitude: number;
  cvliCount: number;
  points: T[];
}

/** Groups overlapping markers at the current map zoom, including identical coordinates. */
export function groupProcedureMapPoints<T extends GroupableProcedurePoint>(
  source: T[],
  zoom: number,
  radius = 44,
): ProcedurePointGroup<T>[] {
  const points = source
    .filter(
      (point) =>
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude) &&
        Math.abs(point.latitude) <= 90 &&
        Math.abs(point.longitude) <= 180,
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const worldSize = 256 * 2 ** zoom;
  const distance = Math.max(1, radius);
  const projected = points.map((point) => {
    const latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
    const sine = Math.sin((latitude * Math.PI) / 180);
    return {
      x: ((point.longitude + 180) / 360) * worldSize,
      y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * worldSize,
    };
  });
  const parent = points.map((_, index) => index);
  function root(index: number): number {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  }
  const buckets = new Map<string, number[]>();
  projected.forEach((point, index) => {
    const column = Math.floor(point.x / distance);
    const row = Math.floor(point.y / distance);
    for (let x = column - 1; x <= column + 1; x += 1) {
      for (let y = row - 1; y <= row + 1; y += 1) {
        for (const neighbor of buckets.get(`${x}:${y}`) || []) {
          const other = projected[neighbor];
          if ((other.x - point.x) ** 2 + (other.y - point.y) ** 2 <= distance ** 2) {
            parent[root(index)] = root(neighbor);
          }
        }
      }
    }
    const key = `${column}:${row}`;
    const bucket = buckets.get(key) || [];
    bucket.push(index);
    buckets.set(key, bucket);
  });
  const groups = new Map<number, T[]>();
  points.forEach((point, index) => {
    const key = root(index);
    const group = groups.get(key) || [];
    group.push(point);
    groups.set(key, group);
  });
  return [...groups.values()].map((members) => ({
    id: members.map((point) => point.id).join("|"),
    latitude: members.reduce((sum, point) => sum + point.latitude, 0) / members.length,
    longitude: members.reduce((sum, point) => sum + point.longitude, 0) / members.length,
    cvliCount: members.filter((point) => point.cvli).length,
    points: members,
  }));
}
