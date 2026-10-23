import type {
  RepresentacaoPayload,
  RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";

export type RequisicaoMovementInput = {
  inqueritoId: string;
  numeroPpe?: string | null;
  origem: string;
  numeroDocumento?: string | null;
  recebidaEm: string;
  prazoDias: number | null;
  conteudo: string;
};

export function isRequisicaoMovement(
  movement: Pick<RepresentacaoRecord, "tipo_normalizado" | "requisicao_conteudo">,
) {
  return (
    movement.tipo_normalizado?.toLowerCase().includes("requis") === true ||
    Boolean(movement.requisicao_conteudo)
  );
}

export function buildRequisicaoRepresentacaoPayload(
  input: RequisicaoMovementInput,
): RepresentacaoPayload {
  const content = input.conteudo.trim();
  const origin = input.origem.trim();
  const number = input.numeroDocumento?.trim() || null;

  return {
    inquerito_id: input.inqueritoId,
    numero_ppe: input.numeroPpe?.trim() || null,
    processo_judicial: null,
    tipo: "Requisição judicial/ministerial",
    tipo_normalizado: "Requisição judicial/ministerial",
    data_representacao: input.recebidaEm,
    data_protocolo: input.recebidaEm,
    responsavel: null,
    vitima: null,
    investigado: null,
    autor_preso: null,
    resumo_fatos: null,
    fundamentacao: null,
    objetivo: null,
    diligencias_relacionadas: null,
    status: "Pendente de cumprimento",
    data_envio_judiciario: null,
    data_decisao_judicial: null,
    vara_juizo: null,
    prazo_concedido_dias: input.prazoDias,
    data_vencimento: null,
    observacoes_decisao: null,
    data_cumprimento: null,
    cumprimento_status: null,
    equipe_cumprimento: null,
    resultado_cumprimento: null,
    observacoes_cumprimento: null,
    prioridade_operacional: "Alta",
    equipe_responsavel: null,
    acompanhamento_especial: null,
    pedido_sigiloso: null,
    pedido_sigiloso_normalizado: null,
    medida_protetiva_normalizada: false,
    observacoes_internas: null,
    observacoes_movimentacao: null,
    requisicao_origem: origin,
    requisicao_numero_documento: number,
    requisicao_data_recebimento: input.recebidaEm,
    requisicao_prazo_dias: input.prazoDias,
    requisicao_conteudo: content,
  };
}
