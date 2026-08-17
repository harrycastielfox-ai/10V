import { describe, expect, it } from "vitest";
import {
  clearSessionCaches,
  currentSessionGeneration,
  isSessionGenerationCurrent,
  registerSessionCache,
} from "./sessionCache";

describe("sessionCache", () => {
  it("limpa todos os caches registrados quando a sessão muda", () => {
    let inqueritos: string[] | null = ["dados do usuário anterior"];
    let boletins: string[] | null = ["dados do usuário anterior"];
    registerSessionCache(() => {
      inqueritos = null;
    });
    registerSessionCache(() => {
      boletins = null;
    });

    clearSessionCaches();

    expect(inqueritos).toBeNull();
    expect(boletins).toBeNull();
  });

  it("descarta resposta que chega depois do logout", () => {
    const generation = currentSessionGeneration();
    expect(isSessionGenerationCurrent(generation)).toBe(true);

    clearSessionCaches();

    expect(isSessionGenerationCurrent(generation)).toBe(false);
  });
});
