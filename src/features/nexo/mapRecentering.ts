export const TERRITORY_MAP_RECENTER_INTERVAL_MS = 30_000;

export function scheduleRigidMapRecentering({
  drawing,
  recenter,
}: {
  drawing: boolean;
  recenter: () => void;
}) {
  if (drawing) return () => undefined;
  const timer = globalThis.setInterval(recenter, TERRITORY_MAP_RECENTER_INTERVAL_MS);
  return () => globalThis.clearInterval(timer);
}
