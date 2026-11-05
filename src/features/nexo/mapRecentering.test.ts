import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTerritoryMapAtDefaultView,
  scheduleRigidMapRecentering,
  shouldAnimateMapRecentering,
} from "./mapRecentering";

describe("isTerritoryMapAtDefaultView", () => {
  it("evita recentralização redundante quando centro e zoom já são os padrões", () => {
    expect(isTerritoryMapAtDefaultView(-16.575, -39.559, 15)).toBe(true);
    expect(isTerritoryMapAtDefaultView(-16.574997, -39.559021, 15)).toBe(true);
  });

  it("solicita recentralização quando posição ou zoom foram alterados", () => {
    expect(isTerritoryMapAtDefaultView(-16.57, -39.559, 15)).toBe(false);
    expect(isTerritoryMapAtDefaultView(-16.575, -39.559, 14)).toBe(false);
  });
});

describe("shouldAnimateMapRecentering", () => {
  it("desativa animação nos ciclos automáticos para evitar trabalho periódico", () => {
    expect(shouldAnimateMapRecentering(true, false)).toBe(false);
  });

  it("mantém animação no comando manual quando movimento reduzido está desligado", () => {
    expect(shouldAnimateMapRecentering(false, false)).toBe(true);
  });

  it("desativa animação manual quando movimento reduzido está ativo", () => {
    expect(shouldAnimateMapRecentering(false, true)).toBe(false);
  });
});

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
