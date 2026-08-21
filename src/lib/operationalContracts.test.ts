import { describe, expect, it } from "vitest";
import {
  getInquiryRegistrationChecks,
  getRepresentationRegistrationChecks,
  isYesValue,
  normalizeCriminalCategory,
  normalizePriority,
  normalizeProcedureType,
  normalizeRepresentationType,
  representationRequiresCompliance,
  representationRequiresDecision,
  representationRequiresDecisionNotes,
  representationRequiresDeadline,
  representationRequiresJudicialSubmission,
  type InquiryRegistrationInput,
  type RepresentationRegistrationInput,
} from "./operationalContracts";

function baseInquiry(overrides: Partial<InquiryRegistrationInput> = {}): InquiryRegistrationInput {
  return {
    ppe: "PPE-1",
    origemRegistro: "novo",
    visibilidade: "publico",
    tipoProcedimento: "IP",
    situacao: "em andamento",
    dataFato: "2026-01-01",
    dataInstauracao: "2026-01-02",
    prazo: "2026-02-01",
    tipificacao: "furto",
    gravidade: "Outro",
    vitima: "Fulano",
    autoria: "conhecida",
    reuPreso: "nao",
    bairro: "Centro",
    distrito: "1",
    delegado: "Dr. Fulano",
    equipe: "Equipe A",
    escrivao: "Escrivão A",
    houveArmaDeFogo: "nao",
    vinculadoFaccao: "nao",
    medidaProtetiva: "nao",
    statusDiligencias: "em andamento",
    elucidado: "nao",
    relatorioStatus: "pendente",
    ...overrides,
  };
}

function baseRepresentation(
  overrides: Partial<RepresentationRegistrationInput> = {},
): RepresentationRegistrationInput {
  return {
    vinculoInquerito: "nao",
    justificativaSemInquerito: "sem inquerito vinculado ainda",
    ppe: "PPE-1",
    tipoRepresentacao: "Prisão Preventiva",
    status: "Em elaboração",
    dataRepresentacao: "2026-01-01",
    vitima: "Fulano",
    resumoFatos: "resumo",
    prioridadeOperacional: "alta",
    cumprimentoStatus: "pendente",
    ...overrides,
  };
}

describe("normalizeProcedureType", () => {
  it("maps known aliases to the right code", () => {
    expect(normalizeProcedureType("ip")).toBe("IP");
    expect(normalizeProcedureType("Inquérito Policial")).toBe("IP");
    expect(normalizeProcedureType("APF")).toBe("APF");
    expect(normalizeProcedureType("Auto de prisão em flagrante")).toBe("APF");
    expect(normalizeProcedureType("TCO")).toBe("TCO");
    expect(normalizeProcedureType("AIAI")).toBe("AIAI");
  });

  it("falls back to OUTROS for unknown values", () => {
    expect(normalizeProcedureType("qualquer coisa")).toBe("OUTROS");
    expect(normalizeProcedureType(null)).toBe("OUTROS");
  });
});

describe("normalizePriority", () => {
  it("recognizes urgente, alta and baixa", () => {
    expect(normalizePriority("urgente")).toBe("urgente");
    expect(normalizePriority("Alta")).toBe("alta");
    expect(normalizePriority("baixa")).toBe("baixa");
  });

  it("defaults to media otherwise", () => {
    expect(normalizePriority("qualquer coisa")).toBe("media");
    expect(normalizePriority(undefined)).toBe("media");
  });
});

describe("normalizeCriminalCategory", () => {
  it("maps common categories", () => {
    expect(normalizeCriminalCategory("CVLI")).toBe("CVLI");
    expect(normalizeCriminalCategory("morte violenta")).toBe("CVLI");
    expect(normalizeCriminalCategory("violência doméstica")).toBe("VIOLENCIA_DOMESTICA");
    expect(normalizeCriminalCategory("crimes contra o patrimônio")).toBe("PATRIMONIAL");
  });

  it("defaults to OUTROS", () => {
    expect(normalizeCriminalCategory("categoria desconhecida")).toBe("OUTROS");
  });
});

describe("normalizeRepresentationType", () => {
  it("distinguishes prisão preventiva from prisão temporária", () => {
    expect(normalizeRepresentationType("Prisão Preventiva")).toBe("prisao_preventiva");
    expect(normalizeRepresentationType("Prisão Temporária")).toBe("prisao_temporaria");
  });

  it("maps medida protetiva and busca e apreensão", () => {
    expect(normalizeRepresentationType("Medida Protetiva")).toBe("medida_protetiva");
    expect(normalizeRepresentationType("Busca e Apreensão Domiciliar")).toBe("busca_apreensao");
  });

  it("defaults to outros", () => {
    expect(normalizeRepresentationType("algo nao mapeado")).toBe("outros");
  });
});

describe("isYesValue", () => {
  it("accepts sim/s/true/1", () => {
    for (const value of ["sim", "S", "true", "1"]) {
      expect(isYesValue(value)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const value of ["nao", "0", "false", "", null, undefined]) {
      expect(isYesValue(value)).toBe(false);
    }
  });
});

describe("representation status helpers", () => {
  it("requires judicial submission only for the right statuses", () => {
    expect(representationRequiresJudicialSubmission("Enviada ao Judiciário")).toBe(true);
    expect(representationRequiresJudicialSubmission("Aguardando Análise Judicial")).toBe(true);
    expect(representationRequiresJudicialSubmission("Em elaboração")).toBe(false);
  });

  it("requires a decision date for deferred/indeferida/arquivada/finalizada", () => {
    expect(representationRequiresDecision("Deferida")).toBe(true);
    expect(representationRequiresDecision("Indeferida")).toBe(true);
    expect(representationRequiresDecision("Arquivada")).toBe(true);
    expect(representationRequiresDecision("Finalizada")).toBe(true);
    expect(representationRequiresDecision("Em análise")).toBe(false);
  });

  it("requires a deadline only for deferred-family statuses", () => {
    expect(representationRequiresDeadline("Deferida")).toBe(true);
    expect(representationRequiresDeadline("Deferida parcialmente")).toBe(true);
    expect(representationRequiresDeadline("Indeferida")).toBe(false);
  });

  it("requires decision notes for indeferida/arquivada/finalizada", () => {
    expect(representationRequiresDecisionNotes("Indeferida")).toBe(true);
    expect(representationRequiresDecisionNotes("Arquivada")).toBe(true);
    expect(representationRequiresDecisionNotes("Deferida")).toBe(false);
  });

  it("requires compliance data for cumprida-family statuses or partial/complete compliance", () => {
    expect(representationRequiresCompliance("Cumprida", "pendente")).toBe(true);
    expect(representationRequiresCompliance("Deferida", "parcial")).toBe(true);
    expect(representationRequiresCompliance("Em elaboração", "pendente")).toBe(false);
  });
});

describe("getInquiryRegistrationChecks", () => {
  it("has no blocking failures for a fully valid, non-conditional case", () => {
    const checks = getInquiryRegistrationChecks(baseInquiry());
    const blockingFailures = checks.filter((c) => c.blocking && !c.complete);
    expect(blockingFailures).toEqual([]);
  });

  it("requires final remittance only for elucidated CVLI cases", () => {
    const withoutRemittance = getInquiryRegistrationChecks(
      baseInquiry({ gravidade: "CVLI", elucidado: "sim" }),
    );
    expect(withoutRemittance.some((c) => c.id === "remessa-final")).toBe(true);
    expect(withoutRemittance.find((c) => c.id === "remessa-final")?.complete).toBe(false);

    const remitted = getInquiryRegistrationChecks(
      baseInquiry({ gravidade: "CVLI", elucidado: "sim", remessaFinalStatus: "remetido" }),
    );
    expect(remitted.find((c) => c.id === "remessa-final")?.complete).toBe(true);

    const nonCvliElucidado = getInquiryRegistrationChecks(
      baseInquiry({ gravidade: "Outro", elucidado: "sim" }),
    );
    expect(nonCvliElucidado.some((c) => c.id === "remessa-final")).toBe(false);
  });

  it("requires arma utilizada only when houve arma de fogo", () => {
    const withArma = getInquiryRegistrationChecks(baseInquiry({ houveArmaDeFogo: "sim" }));
    const armaCheck = withArma.find((c) => c.id === "arma-utilizada");
    expect(armaCheck?.complete).toBe(false);

    const resolved = getInquiryRegistrationChecks(
      baseInquiry({ houveArmaDeFogo: "sim", armaUtilizada: "pistola" }),
    );
    expect(resolved.find((c) => c.id === "arma-utilizada")?.complete).toBe(true);
  });

  it("requires nome da facção only when vinculado à facção", () => {
    const withFaccao = getInquiryRegistrationChecks(baseInquiry({ vinculadoFaccao: "sim" }));
    expect(withFaccao.find((c) => c.id === "nome-faccao")?.complete).toBe(false);
  });

  it("não inclui mais controles removidos de relatório e medida protetiva", () => {
    const checks = getInquiryRegistrationChecks(
      baseInquiry({ medidaProtetiva: "sim", relatorioStatus: "enviado" }),
    );
    expect(checks.some((c) => c.id === "processo-medida")).toBe(false);
    expect(checks.some((c) => c.id === "data-relatorio")).toBe(false);
    expect(checks.some((c) => c.id === "data-envio-relatorio")).toBe(false);
  });

  it("acompanha resumo do fato e cidade no novo cadastro", () => {
    const checks = getInquiryRegistrationChecks(
      baseInquiry({ resumoFato: "", cidade: "", distrito: "" }),
    );
    expect(checks.find((c) => c.id === "resumo-fato")?.complete).toBe(false);
    expect(checks.find((c) => c.id === "cidade")?.complete).toBe(false);
  });
});

describe("getRepresentationRegistrationChecks", () => {
  it("has no blocking failures for a fully valid base case", () => {
    const checks = getRepresentationRegistrationChecks(baseRepresentation());
    const blockingFailures = checks.filter((c) => c.blocking && !c.complete);
    expect(blockingFailures).toEqual([]);
  });

  it("requires a linked inquérito or a justification depending on vinculoInquerito", () => {
    const semEscolha = getRepresentationRegistrationChecks(
      baseRepresentation({ vinculoInquerito: "", justificativaSemInquerito: "" }),
    );
    expect(semEscolha.find((c) => c.id === "tipo-vinculo")?.complete).toBe(false);

    const simSemInquerito = getRepresentationRegistrationChecks(
      baseRepresentation({ vinculoInquerito: "sim", inqueritoId: null, ppe: "" }),
    );
    expect(simSemInquerito.find((c) => c.id === "vinculo-formal")?.complete).toBe(false);
  });

  it("requires tipoOutra when tipoRepresentacao is Outra", () => {
    const semDetalhe = getRepresentationRegistrationChecks(
      baseRepresentation({ tipoRepresentacao: "Outra", tipoOutra: "" }),
    );
    expect(semDetalhe.find((c) => c.id === "tipo")?.complete).toBe(false);
  });

  it("requires envio ao judiciário data once status enters submission", () => {
    const checks = getRepresentationRegistrationChecks(
      baseRepresentation({ status: "Enviada ao Judiciário" }),
    );
    expect(checks.find((c) => c.id === "data-envio-judiciario")?.complete).toBe(false);
    expect(checks.find((c) => c.id === "vara-juizo")?.complete).toBe(false);
  });

  it("requires decision date and deadline once deferida", () => {
    const checks = getRepresentationRegistrationChecks(baseRepresentation({ status: "Deferida" }));
    expect(checks.find((c) => c.id === "data-decisao")?.complete).toBe(false);
    expect(checks.find((c) => c.id === "prazo-decisao")?.complete).toBe(false);
  });

  it("does not require a deadline for indeferida, only the decision date", () => {
    const checks = getRepresentationRegistrationChecks(
      baseRepresentation({ status: "Indeferida" }),
    );
    expect(checks.some((c) => c.id === "prazo-decisao")).toBe(false);
    expect(checks.find((c) => c.id === "data-decisao")?.complete).toBe(false);
  });

  it("requires compliance data once cumprida", () => {
    const checks = getRepresentationRegistrationChecks(
      baseRepresentation({ status: "Cumprida (Positiva)" }),
    );
    expect(checks.find((c) => c.id === "data-cumprimento")?.complete).toBe(false);
    expect(checks.find((c) => c.id === "resultado-cumprimento")?.complete).toBe(false);
  });

  it("rejects a judicial decision dated before the submission date", () => {
    const checks = getRepresentationRegistrationChecks(
      baseRepresentation({
        status: "Deferida",
        dataEnvioJudiciario: "2026-03-10",
        dataDecisaoJudicial: "2026-03-01",
        prazoConcedidoDias: "10",
      }),
    );
    expect(checks.find((c) => c.id === "ordem-datas-decisao")?.complete).toBe(false);
  });

  it("rejects a compliance date before the judicial decision date", () => {
    const checks = getRepresentationRegistrationChecks(
      baseRepresentation({
        status: "Cumprida",
        dataDecisaoJudicial: "2026-03-10",
        dataCumprimento: "2026-03-01",
      }),
    );
    expect(checks.find((c) => c.id === "ordem-datas-cumprimento")?.complete).toBe(false);
  });
});
