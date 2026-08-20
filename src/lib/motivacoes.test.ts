import { describe, expect, it } from "vitest";
import { MOTIVACAO_SUGGESTIONS, mergeMotivacaoSuggestions } from "./motivacoes";

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
});
