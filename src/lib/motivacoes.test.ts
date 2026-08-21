import { describe, expect, it } from "vitest";
import {
  MOTIVACAO_SUGGESTIONS,
  getContextualMotivacaoSuggestions,
  mergeMotivacaoSuggestions,
} from "./motivacoes";

describe("mergeMotivacaoSuggestions", () => {
  it("devolve o catálogo em ordem alfabética quando não há motivação gravada", () => {
    const merged = mergeMotivacaoSuggestions();
    const sorted = [...merged].sort((left, right) => left.localeCompare(right, "pt-BR"));

    expect(merged).toEqual(sorted);
    expect(merged).toHaveLength(MOTIVACAO_SUGGESTIONS.length);
    expect(merged).toContain("Ambição");
  });

  it("acrescenta motivação nova vinda dos procedimentos", () => {
    const merged = mergeMotivacaoSuggestions(["Disputa por ponto de mototáxi"]);

    expect(merged).toContain("Disputa por ponto de mototáxi");
    expect(merged).toHaveLength(MOTIVACAO_SUGGESTIONS.length + 1);
  });

  it("não repete motivação que só muda em acento, caixa ou espaço", () => {
    const merged = mergeMotivacaoSuggestions(["  vinganca ", "AMBICAO", "Vingança"]);

    expect(merged.filter((item) => item.toLowerCase().startsWith("vingan"))).toEqual(["Vingança"]);
    expect(merged).toHaveLength(MOTIVACAO_SUGGESTIONS.length);
  });

  it("descarta entradas vazias", () => {
    expect(mergeMotivacaoSuggestions(["", "   "])).toHaveLength(MOTIVACAO_SUGGESTIONS.length);
  });

  it("prioriza motivações ligadas à tipificação sem selecionar uma delas", () => {
    const suggestions = getContextualMotivacaoSuggestions(mergeMotivacaoSuggestions(), [
      "110: DANO (ART. 163 CAPUT DO CPB)",
    ]);

    expect(suggestions[0]).toBe("Vandalismo ou dano ao patrimônio");
    expect(suggestions).toContain("Conflito na comunidade");
  });

  it("combina sugestões quando há mais de uma tipificação", () => {
    const suggestions = getContextualMotivacaoSuggestions(mergeMotivacaoSuggestions(), [
      "Homicídio qualificado",
      "Violência doméstica",
    ]);

    expect(suggestions).toContain("Vingança");
    expect(suggestions).toContain("Violência doméstica");
  });

  it("busca no catálogo completo sem perder o ranking contextual", () => {
    const suggestions = getContextualMotivacaoSuggestions(
      mergeMotivacaoSuggestions(),
      ["Tráfico de drogas"],
      "acerto",
    );

    expect(suggestions).toEqual(["Acerto de contas (tráfico de drogas)", "Acerto de contas"]);
  });
});
