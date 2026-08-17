import { describe, expect, it } from "vitest";
import {
  createInquiryPerson,
  deriveInquiryAutoria,
  deriveInquiryReuPreso,
  type InquiryPersonFormValue,
  type InquiryPersonRole,
} from "./operationalContracts";

function pessoa(
  papel: InquiryPersonRole,
  nome: string,
  extra: Partial<InquiryPersonFormValue> = {},
): InquiryPersonFormValue {
  return { ...createInquiryPerson(papel, nome), ...extra };
}

describe("deriveInquiryAutoria", () => {
  it("basta um investigado com autoria determinada", () => {
    const pessoas = [
      pessoa("autor_investigado", "Fulano", { autoriaDeterminada: false }),
      pessoa("autor_investigado", "Beltrano", { autoriaDeterminada: true }),
    ];

    expect(deriveInquiryAutoria(pessoas)).toBe("Determinada");
  });

  it("marca desconhecida quando alguém informou que não sabe", () => {
    const pessoas = [pessoa("autor_investigado", "Desconhecido", { autoriaDeterminada: false })];

    expect(deriveInquiryAutoria(pessoas)).toBe("Desconhecida");
  });

  it("é sem autoria quando há pessoas mas nenhum investigado", () => {
    const pessoas = [pessoa("vitima", "Maria"), pessoa("testemunha", "João")];

    expect(deriveInquiryAutoria(pessoas)).toBe("Sem Autoria");
  });

  it("não afirma nada sobre investigado sem situação informada", () => {
    // Procedimento antigo: a pessoa existe, mas foi cadastrada antes de o campo
    // existir. A tela de edição depende do vazio para preservar o valor salvo.
    const pessoas = [pessoa("autor_investigado", "Fulano")];

    expect(deriveInquiryAutoria(pessoas)).toBe("");
  });

  it("ignora linha sem nome", () => {
    expect(deriveInquiryAutoria([pessoa("autor_investigado", "  ")])).toBe("");
  });
});

describe("deriveInquiryReuPreso", () => {
  it("um investigado preso já torna o procedimento com réu preso", () => {
    const pessoas = [
      pessoa("autor_investigado", "Fulano", { preso: false }),
      pessoa("autor_investigado", "Beltrano", { preso: true }),
    ];

    expect(deriveInquiryReuPreso(pessoas)).toBe("Sim");
  });

  it("responde não quando todos os informados estão soltos", () => {
    const pessoas = [pessoa("autor_investigado", "Fulano", { preso: false })];

    expect(deriveInquiryReuPreso(pessoas)).toBe("Não");
  });

  it("fica em branco quando ninguém informou a situação", () => {
    const pessoas = [pessoa("autor_investigado", "Fulano"), pessoa("vitima", "Maria")];

    expect(deriveInquiryReuPreso(pessoas)).toBe("");
  });
});
