export const ORGANOGRAM_RECENTER_INTERVAL_MS = 15_000;

export function scheduleRigidOrganogramRecentering(recenter: () => void) {
  const timer = globalThis.setInterval(recenter, ORGANOGRAM_RECENTER_INTERVAL_MS);
  return () => globalThis.clearInterval(timer);
}
