import { describe, expect, it } from "vitest";
import { buildRequisicaoRepresentacaoPayload, isRequisicaoMovement } from "./requisicoes";

describe("requisicoes", () => {
  it("monta uma movimentação vinculada sem alterar a situação do inquérito", () => {
    const payload = buildRequisicaoRepresentacaoPayload({
      inqueritoId: "case-1",
      numeroPpe: "PPE-123",
      origem: "Poder Judiciário",
      numeroDocumento: "OF-456",
      recebidaEm: "2026-10-23",
      prazoDias: 15,
      conteudo: " Oitiva de testemunha e envio de laudo. ",
    });

    expect(payload).toMatchObject({
      inquerito_id: "case-1",
      numero_ppe: "PPE-123",
      tipo_normalizado: "Requisição judicial/ministerial",
      status: "Pendente de cumprimento",
      prioridade_operacional: "Alta",
      requisicao_origem: "Poder Judiciário",
      requisicao_numero_documento: "OF-456",
      requisicao_data_recebimento: "2026-10-23",
      requisicao_prazo_dias: 15,
      requisicao_conteudo: "Oitiva de testemunha e envio de laudo.",
      data_vencimento: null,
    });
  });

  it("não inventa documento ou prazo quando não foram informados", () => {
    const payload = buildRequisicaoRepresentacaoPayload({
      inqueritoId: "case-1",
      origem: "Ministério Público",
      recebidaEm: "2026-10-23",
      prazoDias: null,
      conteudo: "Cópia integral dos autos.",
    });

    expect(payload.requisicao_numero_documento).toBeNull();
    expect(payload.requisicao_prazo_dias).toBeNull();
    expect(payload.numero_ppe).toBeNull();
  });

  it("identifica apenas movimentações de requisição", () => {
    expect(
      isRequisicaoMovement({
        tipo_normalizado: "Requisição judicial/ministerial",
        requisicao_conteudo: null,
      }),
    ).toBe(true);
    expect(
      isRequisicaoMovement({
        tipo_normalizado: "Prisão preventiva",
        requisicao_conteudo: "Oitiva de testemunha",
      }),
    ).toBe(true);
    expect(
      isRequisicaoMovement({ tipo_normalizado: "Prisão preventiva", requisicao_conteudo: null }),
    ).toBe(false);
  });
});
