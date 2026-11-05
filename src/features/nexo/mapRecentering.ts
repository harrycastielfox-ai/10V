export const TERRITORY_MAP_RECENTER_INTERVAL_MS = 30_000;
export const TERRITORY_MAP_CENTER: [number, number] = [-16.575, -39.559];
export const TERRITORY_MAP_ZOOM = 15;
const TERRITORY_MAP_CENTER_TOLERANCE = 0.000_1;

export function isTerritoryMapAtDefaultView(latitude: number, longitude: number, zoom: number) {
  return (
    Math.abs(latitude - TERRITORY_MAP_CENTER[0]) <= TERRITORY_MAP_CENTER_TOLERANCE &&
    Math.abs(longitude - TERRITORY_MAP_CENTER[1]) <= TERRITORY_MAP_CENTER_TOLERANCE &&
    zoom === TERRITORY_MAP_ZOOM
  );
}

export function shouldAnimateMapRecentering(automatic: boolean, prefersReducedMotion: boolean) {
  return !automatic && !prefersReducedMotion;
}

export function scheduleRigidMapRecentering({
  drawing,
  recenter,
  intervalMs = TERRITORY_MAP_RECENTER_INTERVAL_MS,
}: {
  drawing: boolean;
  recenter: () => void;
  intervalMs?: number;
}) {
  if (drawing) return () => undefined;
  const timer = globalThis.setInterval(recenter, intervalMs);
  return () => globalThis.clearInterval(timer);
}
