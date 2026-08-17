import { describe, expect, it } from "vitest";
import { getBoStatusLabel, normalizeBoText, validateBoPayload, type BoPayload } from "./boTypes";

const validPayload: BoPayload = {
  numero_bo: "00573168/2026",
  infracao_penal: "Dano e ameaça",
  diligencias_pendentes: null,
  responsavel_nome: null,
  observacao: null,
  status: "Pendente",
  inquerito_id: null,
  representacao_id: null,
};

describe("boTypes", () => {
  it("normaliza acentos e espaços para pesquisa", () => {
    expect(normalizeBoText("  Violência   Doméstica ")).toBe("violencia domestica");
  });

  it("mantém rótulos com acentuação correta", () => {
    expect(getBoStatusLabel("Concluida")).toBe("Concluída");
  });

  it("exige número e infração", () => {
    expect(validateBoPayload({ ...validPayload, numero_bo: "" })).toBe("Informe o número do B.O.");
    expect(validateBoPayload({ ...validPayload, infracao_penal: "" })).toBe(
      "Informe a infração penal.",
    );
  });

  it("permite vincular Inquérito e Representação simultaneamente", () => {
    expect(
      validateBoPayload({
        ...validPayload,
        inquerito_id: "11111111-1111-4111-8111-111111111111",
        representacao_id: "22222222-2222-4222-8222-222222222222",
      }),
    ).toBeNull();
  });
});
