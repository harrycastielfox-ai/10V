import { describe, expect, it } from "vitest";
import {
  applyBoDiligenceSuggestion,
  applyBoInfractionSuggestion,
  getActiveBoInfractionQuery,
  getBoDiligenceSuggestions,
  getBoInfractionSuggestions,
} from "./boSuggestions";

const options = [
  "21: LESÃO CORPORAL DOLOSA (ART. 129 DO CPB)",
  "57: AMEAÇA (ART. 147 DO CPB)",
  "110: DANO (ART. 163 DO CPB)",
];

describe("sugestões de infração do B.O.", () => {
  it("usa apenas a linha que está sendo digitada", () => {
    expect(getActiveBoInfractionQuery("57: AMEAÇA\ndano")).toBe("dano");
  });

  it("busca por número ou palavra ignorando acentos", () => {
    expect(getBoInfractionSuggestions("57", options)[0]).toContain("AMEAÇA");
    expect(getBoInfractionSuggestions("lesao", options)[0]).toContain("LESÃO");
  });

  it("não sugere novamente uma infração já selecionada", () => {
    expect(getBoInfractionSuggestions(`${options[1]}\nameaça`, options)).toEqual([]);
  });

  it("substitui a linha atual e prepara a próxima", () => {
    expect(applyBoInfractionSuggestion("amea", options[1])).toBe(`${options[1]}\n`);
  });
});

describe("sugestões de diligências do B.O.", () => {
  const diligenceOptions = [
    "Intimar e ouvir a vítima.",
    "Aguardar o laudo pericial requisitado.",
    "Elaborar relatório final.",
  ];

  it("só abre a busca depois de duas letras", () => {
    expect(getBoDiligenceSuggestions("i", diligenceOptions)).toEqual([]);
    expect(getBoDiligenceSuggestions("in", diligenceOptions)[0]).toBe("Intimar e ouvir a vítima.");
  });

  it("busca apenas na linha atual e ignora acentos", () => {
    expect(getBoDiligenceSuggestions("Outra diligência\nvitima", diligenceOptions)).toEqual([
      "Intimar e ouvir a vítima.",
    ]);
  });

  it("substitui a linha atual sem alterar as anteriores", () => {
    expect(applyBoDiligenceSuggestion("Primeira diligência\nlaudo", diligenceOptions[1])).toBe(
      `Primeira diligência\n${diligenceOptions[1]}`,
    );
  });
});
