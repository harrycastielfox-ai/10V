import { describe, expect, it } from "vitest";
import { classifyAuthorship, getAuthorshipLabel } from "@/lib/authorship";

describe("classificação de autoria", () => {
  it.each([
    ["Determinada", "determinada"],
    ["Desconhecida", "desconhecida"],
    ["Sem Autoria", "sem_autoria"],
    ["Indeterminada", "desconhecida"],
    ["Não determinada", "desconhecida"],
    ["", "nao_informada"],
  ])("classifica %s", (value, expected) => {
    expect(classifyAuthorship(value)).toBe(expected);
  });

  it("exibe a nomenclatura oficial", () => {
    expect(getAuthorshipLabel("Indeterminada")).toBe("Desconhecida");
    expect(getAuthorshipLabel(null)).toBe("Não informada");
  });
});
