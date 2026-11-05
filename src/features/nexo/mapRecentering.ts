export const TERRITORY_MAP_RECENTER_INTERVAL_MS = 30_000;

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
