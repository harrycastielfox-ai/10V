import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleRigidMapRecentering } from "./mapRecentering";

describe("scheduleRigidMapRecentering", () => {
  afterEach(() => vi.useRealTimers());

  it("recentraliza em períodos rígidos de 30 segundos e encerra na limpeza", () => {
    vi.useFakeTimers();
    const recenter = vi.fn();
    const stop = scheduleRigidMapRecentering({ drawing: false, recenter });

    vi.advanceTimersByTime(29_999);
    expect(recenter).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(recenter).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    expect(recenter).toHaveBeenCalledTimes(2);

    stop();
    vi.advanceTimersByTime(30_000);
    expect(recenter).toHaveBeenCalledTimes(2);
  });

  it("não agenda recentralização durante o desenho", () => {
    vi.useFakeTimers();
    const recenter = vi.fn();
    scheduleRigidMapRecentering({ drawing: true, recenter });

    vi.advanceTimersByTime(90_000);
    expect(recenter).not.toHaveBeenCalled();
  });

  it("aceita intervalo específico para a Central sem alterar o padrão", () => {
    vi.useFakeTimers();
    const recenter = vi.fn();
    const stop = scheduleRigidMapRecentering({
      drawing: false,
      recenter,
      intervalMs: 10_000,
    });

    vi.advanceTimersByTime(9_999);
    expect(recenter).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(recenter).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(recenter).toHaveBeenCalledTimes(2);

    stop();
  });
});
