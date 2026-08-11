import { describe, expect, it } from "vitest";
import {
  calculateInqueritoOperationalPriorityDetails,
  isTruthyLike,
  normalizeCaseCategory,
  normalizeText,
} from "./inqueritosPriority";

function isoDateOffset(days: number) {
  const now = new Date();
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, 12, 0, 0, 0),
  );
  return target.toISOString().slice(0, 10);
}

describe("normalizeText", () => {
  it("lowercases, trims and strips accents", () => {
    expect(normalizeText("  Violência Doméstica  ")).toBe("violencia domestica");
  });

  it("handles undefined as empty string", () => {
    expect(normalizeText(undefined)).toBe("");
  });
});

describe("normalizeCaseCategory", () => {
  it("matches a known category regardless of accents or case", () => {
    expect(normalizeCaseCategory("cvli")).toBe("CVLI");
    expect(normalizeCaseCategory("VIOLÊNCIA DOMÉSTICA")).toBe("Violência Doméstica e Familiar");
  });

  it("falls back for empty or unrecognized values", () => {
    expect(normalizeCaseCategory("")).toBe("—");
    expect(normalizeCaseCategory("selecione")).toBe("—");
    expect(normalizeCaseCategory("categoria-inexistente")).toBe("—");
  });

  it("honors a custom fallback", () => {
    expect(normalizeCaseCategory(null, "Outro")).toBe("Outro");
  });
});

describe("isTruthyLike", () => {
  it("accepts common truthy aliases", () => {
    for (const value of ["true", "T", "1", "sim", "S", "yes", "y"]) {
      expect(isTruthyLike(value)).toBe(true);
    }
  });

  it("rejects falsy or unrelated values", () => {
    for (const value of ["false", "0", "nao", "", null, undefined]) {
      expect(isTruthyLike(value)).toBe(false);
    }
  });
});

describe("calculateInqueritoOperationalPriorityDetails", () => {
  it("prioritizes réu preso above everything else", () => {
    const result = calculateInqueritoOperationalPriorityDetails({
      reu_preso: "sim",
      categoria_criminal: "outro",
      prazo: isoDateOffset(30),
    });
    expect(result).toEqual({ priority: "ALTA", reason: "Alta por réu preso" });
  });

  it("treats an active medida protetiva as ALTA", () => {
    const result = calculateInqueritoOperationalPriorityDetails({
      medida_protetiva: "ativa",
    });
    expect(result.priority).toBe("ALTA");
    expect(result.reason).toBe("Alta por medida protetiva");
  });

  it("treats a high-severity category as ALTA", () => {
    const result = calculateInqueritoOperationalPriorityDetails({
      categoria_criminal: "CVLI",
    });
    expect(result).toEqual({ priority: "ALTA", reason: "Alta por categoria crítica" });
  });

  it("treats an overdue prazo as ALTA", () => {
    const result = calculateInqueritoOperationalPriorityDetails({
      prazo: isoDateOffset(-1),
    });
    expect(result).toEqual({ priority: "ALTA", reason: "Alta por prazo vencido" });
  });

  it("treats a prazo within 7 days as MÉDIA", () => {
    const result = calculateInqueritoOperationalPriorityDetails({
      prazo: isoDateOffset(5),
    });
    expect(result).toEqual({ priority: "MÉDIA", reason: "Média por prazo próximo" });
  });

  it("does not flag a prazo further than 7 days away as urgent", () => {
    const result = calculateInqueritoOperationalPriorityDetails({
      prazo: isoDateOffset(8),
    });
    expect(result.reason).not.toBe("Média por prazo próximo");
  });

  it("treats a medium-severity category as MÉDIA", () => {
    const result = calculateInqueritoOperationalPriorityDetails({
      categoria_criminal: "Drogas",
    });
    expect(result).toEqual({ priority: "MÉDIA", reason: "Média por categoria intermediária" });
  });

  it("falls back to manual priority when no automatic signal applies", () => {
    expect(calculateInqueritoOperationalPriorityDetails({ prioridade: "media" })).toEqual({
      priority: "MÉDIA",
      reason: "Média por prioridade manual",
    });
    expect(calculateInqueritoOperationalPriorityDetails({ prioridade: "baixa" })).toEqual({
      priority: "BAIXA",
      reason: "Baixa por prioridade manual",
    });
  });

  it("defaults to BAIXA when there is no signal at all", () => {
    const result = calculateInqueritoOperationalPriorityDetails({});
    expect(result).toEqual({ priority: "BAIXA", reason: "Baixa sem sinais críticos" });
  });

  it("réu preso outranks an overdue prazo and a high category", () => {
    const result = calculateInqueritoOperationalPriorityDetails({
      reu_preso_normalizado: true,
      categoria_criminal: "outro",
      prazo: isoDateOffset(-10),
    });
    expect(result.reason).toBe("Alta por réu preso");
  });
});
