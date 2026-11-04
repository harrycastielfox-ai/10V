import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ORGANOGRAM_RECENTER_INTERVAL_MS,
  scheduleRigidOrganogramRecentering,
} from "./organogramRecentering";

describe("scheduleRigidOrganogramRecentering", () => {
  afterEach(() => vi.useRealTimers());

  it("recentraliza rigidamente a cada 15 segundos e interrompe no cleanup", () => {
    vi.useFakeTimers();
    const recenter = vi.fn();
    const stop = scheduleRigidOrganogramRecentering(recenter);

    vi.advanceTimersByTime(ORGANOGRAM_RECENTER_INTERVAL_MS - 1);
    expect(recenter).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(recenter).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(ORGANOGRAM_RECENTER_INTERVAL_MS);
    expect(recenter).toHaveBeenCalledTimes(2);

    stop();
    vi.advanceTimersByTime(ORGANOGRAM_RECENTER_INTERVAL_MS);
    expect(recenter).toHaveBeenCalledTimes(2);
  });
});
