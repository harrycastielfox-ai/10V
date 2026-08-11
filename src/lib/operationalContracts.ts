export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

export const INQUIRY_PERSON_ROLE_OPTIONS = [
  { value: "vitima", label: "Vítima" },
  { value: "autor_investigado", label: "Autor / Investigado" },
  { value: "testemunha", label: "Testemunha" },
  { value: "outro", label: "Outro envolvido" },
] as const;

export type InquiryPersonRole = (typeof INQUIRY_PERSON_ROLE_OPTIONS)[number]["value"];

export type InquiryPersonFormValue = {
  id: string;
  papel: InquiryPersonRole;
  nome: string;
  observacao: string;
};

export function createInquiryPerson(
  papel: InquiryPersonRole = "vitima",
  nome = "",
): InquiryPersonFormValue {
  return {
    id: crypto.randomUUID(),
    papel,
    nome,
    observacao: "",
  };
}

export const PROCEDURE_TYPE_OPTIONS = [
  { value: "IP", label: "Inquérito Policial (IP)" },
  { value: "APF", label: "Auto de Prisão em Flagrante (APF)" },
  { value: "TCO", label: "Termo Circunstanciado (TCO)" },
  { value: "BOC", label: "Boletim de Ocorrência Circunstanciado (BOC)" },
  {
    value: "AAFAI",
    label: "Auto de Apreensão em Flagrante de Ato Infracional (AAFAI)",
  },
  { value: "AIAI", label: "Ato de Investigação de Ato Infracional (AIAI)" },
  { value: "OUTROS", label: "Outro procedimento" },
] as const;

export type ProcedureTypeCode = (typeof PROCEDURE_TYPE_OPTIONS)[number]["value"];

export const OCCURRENCE_ORIGIN_OPTIONS = [
  { value: "novo", label: "Novo registro" },
  { value: "migrado", label: "Procedimento migrado" },
] as const;

export type OccurrenceOrigin = (typeof OCCURRENCE_ORIGIN_OPTIONS)[number]["value"];

export const REPORT_STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente de relatório" },
  { value: "relatado", label: "Relatado, ainda não enviado" },
  { value: "enviado", label: "Relatório enviado" },
] as const;

export type ReportStatus = (typeof REPORT_STATUS_OPTIONS)[number]["value"];

export const COMPLIANCE_STATUS_OPTIONS = [
  { value: "pendente", label: "Aguardando cumprimento" },
  { value: "parcial", label: "Cumprida parcialmente" },
  { value: "cumprido", label: "Cumprida" },
  { value: "indeferido", label: "Indeferida / não aplicável" },
  { value: "cancelado", label: "Cancelada" },
] as const;

export type ComplianceStatus = (typeof COMPLIANCE_STATUS_OPTIONS)[number]["value"];

export const COMPLIANCE_RESULT_OPTIONS = [
  { value: "Positivo", label: "Positivo" },
  { value: "Negativo", label: "Negativo" },
  { value: "Parcial", label: "Parcial" },
  { value: "Inconclusivo", label: "Inconclusivo" },
  { value: "Não se aplica", label: "Não se aplica" },
] as const;

export type ComplianceResult = (typeof COMPLIANCE_RESULT_OPTIONS)[number]["value"];

export const COMPLIANCE_RESULT_DESCRIPTIONS: Record<ComplianceResult, string> = {
  Positivo: "A medida atingiu integralmente o objetivo definido.",
  Negativo: "A diligência foi concluída, mas o objetivo não foi alcançado.",
  Parcial: "A medida foi cumprida apenas em parte.",
  Inconclusivo: "O cumprimento não produziu elementos suficientes para uma conclusão.",
  "Não se aplica": "O caso não exige classificação de resultado operacional.",
};

export const REPRESENTATION_TYPE_OPTIONS = [
  { value: "Prisão Preventiva", code: "prisao_preventiva" },
  { value: "Prisão Temporária", code: "prisao_temporaria" },
  { value: "Busca e Apreensão Domiciliar", code: "busca_apreensao" },
  { value: "Medida Protetiva", code: "medida_protetiva" },
  { value: "Interceptação Telefônica", code: "interceptacao" },
  { value: "Quebra de Sigilo / Interceptação", code: "quebra_sigilo" },
  { value: "Representação", code: "representacao" },
  { value: "Relatório Final", code: "relatorio_final" },
  { value: "Outra", code: "outros" },
] as const;

export type RepresentationTypeCode = (typeof REPRESENTATION_TYPE_OPTIONS)[number]["code"];

export const REPRESENTATION_STATUS_OPTIONS = [
  "Em elaboração",
  "Em análise",
  "Aguardando Análise Judicial",
  "Enviada ao Judiciário",
  "Aguardando decisão",
  "Deferida",
  "Deferida parcialmente",
  "Deferida Aguardando Cumprimento",
  "Cumprida",
  "Cumprida parcialmente",
  "Cumprida (Positiva)",
  "Cumprida (Negativa)",
  "Indeferida",
  "Arquivada",
  "Finalizada",
] as const;

export type RegistrationCheck = {
  id: string;
  label: string;
  complete: boolean;
  blocking: boolean;
};

export type InquiryRegistrationInput = {
  ppe?: string;
  numeroBo?: string;
  origemRegistro?: string;
  visibilidade?: string;
  tipoProcedimento?: string;
  situacao?: string;
  dataFato?: string;
  dataInstauracao?: string;
  prazo?: string;
  tipificacao?: string;
  resumoFato?: string;
  gravidade?: string;
  vitima?: string;
  investigado?: string;
  autoria?: string;
  reuPreso?: string;
  bairro?: string;
  distrito?: string;
  cidade?: string;
  delegado?: string;
  equipe?: string;
  escrivao?: string;
  statusDiligencias?: string;
  elucidado?: string;
  dataElucidacao?: string;
  houveArmaDeFogo?: string;
  armaUtilizada?: string;
  vinculadoFaccao?: string;
  nomeFaccao?: string;
  medidaProtetiva?: string;
  numeroProcessoMedida?: string;
  relatorioStatus: ReportStatus;
  dataRelatorio?: string;
  dataEnvioRelatorio?: string;
};

export type RepresentationRegistrationInput = {
  vinculoInquerito?: "sim" | "nao" | "";
  inqueritoId?: string | null;
  justificativaSemInquerito?: string;
  ppe?: string;
  processo?: string;
  tipoRepresentacao?: string;
  tipoOutra?: string;
  dataRepresentacao?: string;
  vitima?: string;
  investigado?: string;
  resumoFatos?: string;
  status?: string;
  dataEnvioJudiciario?: string;
  dataDecisaoJudicial?: string;
  varaJuizo?: string;
  prazoConcedidoDias?: string;
  dataVencimento?: string;
  cumprimentoStatus: ComplianceStatus;
  dataCumprimento?: string;
  equipeCumprimento?: string;
  resultadoCumprimento?: string;
  prioridadeOperacional?: string;
};

function hasValue(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function normalizedStatus(value?: string) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function representationRequiresJudicialSubmission(status?: string) {
  const normalized = normalizedStatus(status);
  return (
    normalized === "enviada ao judiciario" ||
    normalized === "aguardando analise judicial" ||
    normalized === "aguardando decisao"
  );
}

export function representationRequiresDecision(status?: string) {
  const normalized = normalizedStatus(status);
  return [
    "deferida",
    "deferida parcialmente",
    "deferida aguardando cumprimento",
    "indeferida",
    "arquivada",
    "finalizada",
  ].includes(normalized);
}

export function representationRequiresDeadline(status?: string) {
  return ["deferida", "deferida parcialmente", "deferida aguardando cumprimento"].includes(
    normalizedStatus(status),
  );
}

export function representationRequiresDecisionNotes(status?: string) {
  const normalized = normalizedStatus(status);
  return (
    normalized.includes("indeferida") ||
    normalized.includes("arquivada") ||
    normalized.includes("finalizada")
  );
}

export function representationRequiresCompliance(
  status?: string,
  complianceStatus?: ComplianceStatus,
) {
  const normalized = normalizedStatus(status);
  return (
    normalized === "deferida" ||
    normalized === "deferida parcialmente" ||
    normalized === "deferida aguardando cumprimento" ||
    normalized.includes("cumprida") ||
    complianceStatus === "parcial" ||
    complianceStatus === "cumprido"
  );
}

function check(id: string, label: string, complete: boolean, blocking = false): RegistrationCheck {
  return { id, label, complete, blocking };
}

export function getInquiryRegistrationChecks(input: InquiryRegistrationInput): RegistrationCheck[] {
  const isCvli = normalizeCriminalCategory(input.gravidade) === "CVLI";
  const hasPeople = hasValue(input.vitima) || hasValue(input.investigado);

  const checks = [
    check("identificacao", "Informe o número do PPE.", hasValue(input.ppe)),
    check("origem", "Defina a origem do registro", hasValue(input.origemRegistro)),
    check("visibilidade", "Defina a visibilidade do inquérito", hasValue(input.visibilidade)),
    check("tipo", "Defina o tipo de procedimento", hasValue(input.tipoProcedimento)),
    check("situacao", "Defina a situação do inquérito", hasValue(input.situacao)),
    check("data-fato", "Informe a data do fato", hasValue(input.dataFato)),
    check("instauracao", "Informe a data de instauração", hasValue(input.dataInstauracao)),
    check("prazo", "Informe o prazo operacional", hasValue(input.prazo)),
    check("tipificacao", "Informe a tipificação", hasValue(input.tipificacao)),
    check("resumo-fato", "Informe o resumo do fato", hasValue(input.resumoFato)),
    check(
      "categoria",
      "Classifique a categoria criminal",
      hasValue(input.gravidade) && normalizeCriminalCategory(input.gravidade) !== "OUTROS",
    ),
    check("envolvidos", "Informe vítima ou investigado", hasPeople),
    check("autoria", "Defina a autoria", hasValue(input.autoria)),
    check("reu-preso", "Informe se há réu preso", hasValue(input.reuPreso)),
    check("bairro", "Informe o bairro", hasValue(input.bairro)),
    check("cidade", "Informe a cidade", hasValue(input.cidade) || hasValue(input.distrito)),
    check("arma-fogo", "Informe se houve arma de fogo", hasValue(input.houveArmaDeFogo)),
    check("faccao", "Informe se há vínculo com facção", hasValue(input.vinculadoFaccao)),
  ];

  if (isCvli && isYesValue(input.elucidado)) {
    checks.push(
      check(
        "data-elucidacao",
        "CVLI elucidado exige data da elucidação",
        hasValue(input.dataElucidacao),
        true,
      ),
    );
  }

  if (isYesValue(input.houveArmaDeFogo)) {
    checks.push(
      check(
        "arma-utilizada",
        "Ocorrência com arma de fogo exige a arma utilizada",
        hasValue(input.armaUtilizada),
        true,
      ),
    );
  }

  if (isYesValue(input.vinculadoFaccao)) {
    checks.push(
      check(
        "nome-faccao",
        "Vínculo com facção exige o nome da facção",
        hasValue(input.nomeFaccao),
        true,
      ),
    );
  }

  return checks;
}

export function getRepresentationRegistrationChecks(
  input: RepresentationRegistrationInput,
): RegistrationCheck[] {
  const selectedLinkMode = input.vinculoInquerito === "sim" || input.vinculoInquerito === "nao";
  const hasFormalLink =
    input.vinculoInquerito === "sim"
      ? hasValue(input.inqueritoId) || hasValue(input.ppe)
      : input.vinculoInquerito === "nao"
        ? hasValue(input.justificativaSemInquerito)
        : false;
  const isOtherType = input.tipoRepresentacao === "Outra";
  const requiresSendingData = representationRequiresJudicialSubmission(input.status);
  const requiresDecisionAndDeadline = representationRequiresDeadline(input.status);
  const requiresDecision = representationRequiresDecision(input.status);
  const hasExecution = representationRequiresCompliance(input.status, input.cumprimentoStatus);

  const checks = [
    check(
      "tipo-vinculo",
      "Informe se a representação possui inquérito vinculado",
      selectedLinkMode,
      true,
    ),
    check(
      "vinculo-formal",
      input.vinculoInquerito === "sim"
        ? "Selecione o inquérito vinculado"
        : "Justifique por que a representação não possui inquérito vinculado",
      hasFormalLink,
      true,
    ),
    check(
      "tipo",
      "Selecione o tipo da representação",
      hasValue(input.tipoRepresentacao) && (!isOtherType || hasValue(input.tipoOutra)),
      true,
    ),
    check("status", "Defina o status da representação", hasValue(input.status), true),
    check(
      "identificacao",
      "Informe PPE ou processo judicial",
      hasValue(input.ppe) || hasValue(input.processo),
    ),
    check(
      "data-representacao",
      "Informe a data da representação",
      hasValue(input.dataRepresentacao),
    ),
    check(
      "envolvidos",
      "Informe vítima ou investigado/representado",
      hasValue(input.vitima) || hasValue(input.investigado),
    ),
    check("resumo", "Registre um resumo dos fatos", hasValue(input.resumoFatos)),
    check("prioridade", "Defina a prioridade operacional", hasValue(input.prioridadeOperacional)),
  ];

  if (requiresSendingData) {
    checks.push(
      check(
        "data-envio-judiciario",
        "Envio ao Judiciário exige a data de envio",
        hasValue(input.dataEnvioJudiciario),
        true,
      ),
      check("vara-juizo", "Envio ao Judiciário exige Vara/Juízo", hasValue(input.varaJuizo), true),
    );
  }

  if (requiresDecisionAndDeadline || requiresDecision) {
    checks.push(
      check(
        "data-decisao",
        "Status com decisão exige a data da decisão judicial",
        hasValue(input.dataDecisaoJudicial),
        true,
      ),
    );
  }

  if (requiresDecisionAndDeadline) {
    checks.push(
      check(
        "prazo-decisao",
        "Decisão deferida exige prazo em dias ou data de vencimento",
        hasValue(input.prazoConcedidoDias) || hasValue(input.dataVencimento),
        true,
      ),
    );
  }

  if (hasExecution) {
    checks.push(
      check(
        "data-cumprimento",
        "Cumprimento exige a data da execução",
        hasValue(input.dataCumprimento),
        true,
      ),
      check(
        "resultado-cumprimento",
        "Cumprimento exige resultado operacional",
        hasValue(input.resultadoCumprimento),
        true,
      ),
      check(
        "equipe-cumprimento",
        "Informe a equipe que cumpriu a medida",
        hasValue(input.equipeCumprimento),
      ),
    );
  }

  if (hasValue(input.dataEnvioJudiciario) && hasValue(input.dataDecisaoJudicial)) {
    checks.push(
      check(
        "ordem-datas-decisao",
        "A decisão judicial não pode ser anterior ao envio",
        input.dataDecisaoJudicial! >= input.dataEnvioJudiciario!,
        true,
      ),
    );
  }

  if (hasValue(input.dataDecisaoJudicial) && hasValue(input.dataCumprimento)) {
    checks.push(
      check(
        "ordem-datas-cumprimento",
        "O cumprimento não pode ser anterior à decisão",
        input.dataCumprimento! >= input.dataDecisaoJudicial!,
        true,
      ),
    );
  }

  return checks;
}

function comparable(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeProcedureType(value: unknown): ProcedureTypeCode {
  const normalized = comparable(value);
  if (normalized === "ip" || normalized.includes("inquerito")) return "IP";
  if (normalized === "apf" || normalized.includes("flagrante")) return "APF";
  if (normalized === "tco" || normalized.includes("circunstanciado")) return "TCO";
  if (normalized === "boc" || normalized.includes("boletim de ocorrencia circunstanciado")) {
    return "BOC";
  }
  if (normalized === "aafai" || normalized.includes("apuracao de fato aparentemente infracional")) {
    return "AAFAI";
  }
  if (normalized === "aiai" || normalized.includes("ato infracional")) return "AIAI";
  return "OUTROS";
}

export function procedureTypeLabel(code: ProcedureTypeCode) {
  return PROCEDURE_TYPE_OPTIONS.find((option) => option.value === code)?.label ?? code;
}

export function normalizePriority(value: unknown) {
  const normalized = comparable(value);
  if (normalized.includes("urgent")) return "urgente";
  if (normalized.includes("alt")) return "alta";
  if (normalized.includes("baix")) return "baixa";
  return "media";
}

export function normalizeCriminalCategory(value: unknown) {
  const normalized = comparable(value);
  if (normalized === "cvli" || normalized.includes("morte violenta")) return "CVLI";
  if (normalized === "cvp") return "CVP";
  if (normalized === "miae" || normalized === "milae" || normalized === "mae") return "MIAE";
  if (normalized.includes("droga")) return "DROGAS";
  if (normalized.includes("patrimon")) return "PATRIMONIAL";
  if (normalized.includes("sexual")) return "SEXUAL";
  if (normalized.includes("domestic")) return "VIOLENCIA_DOMESTICA";
  if (normalized.includes("violent")) return "VIOLENTO";
  if (normalized.includes("crianca") || normalized.includes("adolesc")) {
    return "CRIANCA_ADOLESCENTE";
  }
  if (normalized.includes("idos")) return "PESSOA_IDOSA";
  if (normalized.includes("transito")) return "TRANSITO";
  if (normalized.includes("racial") || normalized.includes("preconceito")) return "OUTROS";
  return "OUTROS";
}

export function normalizeRepresentationType(value: unknown): RepresentationTypeCode {
  const normalized = comparable(value);
  if (normalized.includes("prisao") && normalized.includes("preventiva")) {
    return "prisao_preventiva";
  }
  if (normalized.includes("prisao") && normalized.includes("temporaria")) {
    return "prisao_temporaria";
  }
  if (normalized.includes("busca") && normalized.includes("apreensao")) {
    return "busca_apreensao";
  }
  if (normalized.includes("medida") && normalized.includes("protetiva")) {
    return "medida_protetiva";
  }
  if (normalized.includes("quebra") || normalized.includes("sigilo")) {
    return "quebra_sigilo";
  }
  if (normalized.includes("interceptacao")) return "interceptacao";
  if (normalized.includes("relatorio") && normalized.includes("final")) {
    return "relatorio_final";
  }
  if (normalized.includes("representacao")) return "representacao";
  return "outros";
}

export function representationTypeLabel(code: RepresentationTypeCode) {
  return REPRESENTATION_TYPE_OPTIONS.find((option) => option.code === code)?.value ?? "Outra";
}

export function isYesValue(value: unknown) {
  return ["sim", "s", "true", "1"].includes(comparable(value));
}
