import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { MissingInfoPopover } from "@/components/MissingInfoPopover";
import { SipiPrintSheet, type SipiPrintSection } from "@/components/SipiPrintSheet";
import {
  getInqueritoById,
  listInqueritoPessoas,
  softDeleteInquerito,
  type InqueritoPessoaRecord,
  type InqueritoRecord,
} from "@/lib/repositories/inqueritosRepository";
import {
  listRepresentacaoPessoasByRepresentacaoIds,
  listRepresentacoesByInquerito,
  type RepresentacaoPessoaRecord,
  type RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";
import { getCurrentProfile } from "@/lib/auth";
import { InquiryNexoSummaryButton } from "@/components/InquiryNexoSummaryButton";
import { isMobileViewport } from "@/lib/mobileExperience";
import {
  formatSeizedWeaponObservationsForDisplay,
  formatSeizedWeaponsForDisplay,
} from "@/lib/seizedWeapons";
import { parseTipificacoes } from "@/lib/tipificacaoParser";
import {
  canDeleteCases,
  canEditCases,
  canOnlyViewPublicCases,
  canViewNexo,
  type UserProfile,
} from "@/lib/authz";
import type {
  NexoInquiryOrganizationOption,
  NexoInquiryPersonOption,
} from "@/features/nexo/nexoTypes";
import {
  calculateInqueritoOperationalPriorityDetails,
  normalizeCaseCategory,
} from "@/lib/inqueritosPriority";
import { isCvliElucidado } from "@/lib/cvliMetrics";
import {
  getInquiryRegistrationChecks,
  getOccurrenceOriginLabel,
  isYesValue,
  REPORT_STATUS_OPTIONS,
  type ReportStatus,
} from "@/lib/operationalContracts";
import { getInqueritoRemessaFinalStatus } from "@/lib/remessaFinal";
import { isRequisicaoMovement } from "@/lib/requisicoes";
import { ProcedureOperationsPanel } from "@/features/inqueritos/components/ProcedureOperationsPanel";
import {
  BookOpen,
  CalendarDays,
  Check,
  Copy,
  FileSearch,
  FileText,
  FolderOpen,
  Gavel,
  Lock,
  MoreVertical,
  Pencil,
  Printer,
  Scale,
  ShieldAlert,
  UserRound,
  ShieldCheck,
  NotebookPen,
  CalendarClock,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/inqueritos/$caseId")({ component: InqueritoDetalhes });

type InqueritoDetalheUI = {
  id: string;
  numeroPpe: string;
  idInterno: string;
  tipificacao: string;
  numeroFisico: string;
  numeroBo: string;
  origemRegistro: string;
  visibilidade: string;
  tipo: string;
  situacao: string;
  prioridade: string;
  prioridadeMotivo: string;
  gravidade: string;
  dataFato: string;
  dataInstauracao: string;
  prazo: string;
  prazoDias: string;
  diasDecorridos: string;
  ultimaEdicao: string;
  delegadoResponsavel: string;
  bairro: string;
  distrito: string;
  cidade: string;
  vitima: string;
  investigado: string;
  autoriaDeterminada: string;
  reuPreso: string;
  elucidado: string;
  houveArmaFogo: string;
  armaUtilizada: string;
  observacoesArmas: string;
  equipe: string;
  escrivao: string;
  vinculadoFaccao: string;
  nomeFaccao: string;
  statusDiligencias: string;
  relatorioEnviado: string;
  relatorioStatus: string;
  dataRelatorio: string;
  dataEnvioRelatorio: string;
  remessaFinalStatus: string;
  dataRemessaFinal: string;
  medidaProtetiva: string;
  numeroProcessoMedida: string;
  motivacao: string;
  resumoFato: string;
  observacoes: string;
  diligenciasPendentes: string;
  representacoesLegais: string;
  historicoAlteracoes: string;
  dataCadastro: string;
};

type PersonDetailItem = {
  label: string;
  name: string;
  authorship?: "Autoria determinada" | "Autoria desconhecida";
  custody?: "Preso" | "Solto";
  nexoPessoaId?: string | null;
  nexoOrganizacaoId?: string | null;
  nexoVinculoId?: string | null;
  faccaoNomeInformada?: string | null;
  faccaoSiglaInformada?: string | null;
  funcaoFaccaoInformada?: string | null;
  faccaoFonteInformada?: string | null;
  nexoPessoa?: NexoInquiryPersonOption | null;
  nexoOrganizacao?: NexoInquiryOrganizationOption | null;
};

const FALLBACK = "—";

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function pick(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const text = String(record[key] ?? "").trim();
    if (text && normalizeText(text) !== "selecione") {
      return text;
    }
  }
  return FALLBACK;
}

function pickBoolean(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value ? "Sim" : "Não";
  }
  return FALLBACK;
}

function pickTextOrBoolean(
  record: Record<string, unknown>,
  textKeys: string[],
  booleanKeys: string[],
) {
  const text = pick(record, ...textKeys);
  return text !== FALLBACK ? text : pickBoolean(record, ...booleanKeys);
}

function getOptionLabel(value: string, options: ReadonlyArray<{ value: string; label: string }>) {
  if (!value || value === FALLBACK) return FALLBACK;
  return options.find((option) => option.value === value)?.label ?? value;
}

function pickCaseCategory(record: Record<string, unknown>) {
  for (const key of ["categoria_criminal", "categoria_caso", "categoriaCaso", "gravidade"]) {
    const normalized = normalizeCaseCategory(String(record[key] ?? ""));
    if (normalized !== FALLBACK) return normalized;
  }
  return FALLBACK;
}

function isInqueritoSigiloso(record: InqueritoRecord) {
  const raw = record as unknown as Record<string, unknown>;
  const visibility = normalizeText(
    String(raw.visibilidade ?? raw.visibility ?? raw.publico_privado ?? ""),
  );
  const sigiloso = normalizeText(String(raw.sigiloso ?? raw.sigiloso_normalizado ?? ""));
  return (
    visibility.includes("sig") ||
    raw.sigiloso === true ||
    raw.sigiloso_normalizado === true ||
    sigiloso === "sim"
  );
}

function parsePrazoToUtc(value: string) {
  if (!value || value === FALLBACK) return null;
  const raw = value.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(raw);
  if (br) return Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 12, 0, 0, 0);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/u.exec(raw);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12, 0, 0, 0);
}

function formatDatePtBr(ts: number) {
  const date = new Date(ts);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function formatPrazoDisplay(value: string) {
  const ts = parsePrazoToUtc(value);
  if (ts === null) return FALLBACK;
  const dateText = formatDatePtBr(ts);
  const now = new Date();
  const todayTs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0);
  return ts < todayTs ? `Vencido — ${dateText}` : dateText;
}

function pluralize(value: number, singular: string, plural: string) {
  return value === 1 ? singular : plural;
}

function formatElapsedDuration(value: string) {
  if (!value || value === FALLBACK) return FALLBACK;

  const match = value.match(/-?\d+/u);
  if (!match) return value;

  const totalDays = Math.abs(Number(match[0]));
  if (!Number.isFinite(totalDays)) return value;

  if (totalDays <= 30) {
    return `${totalDays} ${pluralize(totalDays, "dia", "dias")}`;
  }

  const years = Math.floor(totalDays / 365);
  const remainingAfterYears = totalDays % 365;
  const months = Math.floor(remainingAfterYears / 30);
  const days = remainingAfterYears % 30;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${pluralize(years, "ano", "anos")}`);
  if (months > 0) parts.push(`${months} ${pluralize(months, "mês", "meses")}`);
  if (days > 0) parts.push(`${days} ${pluralize(days, "dia", "dias")}`);

  return parts.join(", ").replace(/, ([^,]*)$/u, " e $1");
}

function formatDateValue(value: string) {
  const timestamp = parsePrazoToUtc(value);
  return timestamp === null ? FALLBACK : formatDatePtBr(timestamp);
}

function getPrazoSummary(value: string) {
  const timestamp = parsePrazoToUtc(value.replace("Vencido — ", ""));
  if (timestamp === null) {
    return { label: "Não informado", detail: "Sem data limite", overdue: false };
  }

  const now = new Date();
  const todayTimestamp = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    12,
    0,
    0,
    0,
  );
  const differenceInDays = Math.round((timestamp - todayTimestamp) / 86_400_000);
  const date = formatDatePtBr(timestamp);

  if (differenceInDays < 0) {
    return {
      label: `Vencido há ${formatElapsedDuration(String(Math.abs(differenceInDays)))}`,
      detail: date,
      overdue: true,
    };
  }

  if (differenceInDays === 0) {
    return { label: "Vence hoje", detail: date, overdue: false };
  }

  return {
    label: `Vence em ${formatElapsedDuration(String(differenceInDays))}`,
    detail: date,
    overdue: false,
  };
}

function displayValue(value: string) {
  return hasPrintableFieldValue(value) ? value : "Não informado";
}

function normalizePrintableValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function hasPrintableFieldValue(value: string) {
  const normalized = normalizePrintableValue(value);
  return (
    Boolean(normalized) &&
    !["-", "—", "selecione", "sem informacao", "nao informado"].includes(normalized)
  );
}

function TipificacoesDisplay({ value }: { value: string }) {
  const items = parseTipificacoes(value);
  if (items.length === 0) return null;

  const renderDescription = (item: (typeof items)[number]) => (
    <span className="[overflow-wrap:anywhere]">
      {item.codigo ? `${item.codigo}: ` : ""}
      {item.descricao}
    </span>
  );

  if (items.length === 1) {
    return <p className="mt-1 text-sm font-bold text-foreground">{renderDescription(items[0])}</p>;
  }

  return (
    <ol className="mt-2 space-y-2">
      {items.map((item, index) => (
        <li key={`${item.slug}-${index}`} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2">
          <span className="font-mono text-sm font-black text-slate-500/65">{index + 1} -</span>
          <p className="text-sm font-bold leading-6 text-foreground">{renderDescription(item)}</p>
        </li>
      ))}
    </ol>
  );
}

function formatTipificacoesForPrint(value: string) {
  const items = parseTipificacoes(value);
  if (items.length === 0) return value;

  return items
    .map((item, index) => {
      const description = `${item.codigo ? `${item.codigo}: ` : ""}${item.descricao}`;
      return items.length > 1 ? `${index + 1} - ${description}` : description;
    })
    .join("\n");
}

const REPRESENTATION_PERSON_LABELS: Record<RepresentacaoPessoaRecord["papel"], string> = {
  vitima: "Vítima",
  investigado_representado: "Investigado / representado",
  testemunha: "Testemunha",
  outro: "Outro envolvido",
};

function representationPeopleFields(
  representation: RepresentacaoRecord,
  people: RepresentacaoPessoaRecord[],
) {
  if (people.length > 0) {
    return people.map((person, index) => ({
      id: `${representation.id}-person-${person.id}`,
      label: `${index + 1} - ${REPRESENTATION_PERSON_LABELS[person.papel]}`,
      value: person.observacao ? `${person.nome} | Observação: ${person.observacao}` : person.nome,
      wide: true,
    }));
  }

  return [
    {
      id: `${representation.id}-legacy-victim`,
      label: "Vítima",
      value: representation.vitima,
      wide: true,
    },
    {
      id: `${representation.id}-legacy-investigated`,
      label: "Investigado / representado",
      value: representation.investigado,
      wide: true,
    },
  ];
}

function buildRepresentationPrintSections(
  representation: RepresentacaoRecord,
  index: number,
  total: number,
  people: RepresentacaoPessoaRecord[],
): SipiPrintSection[] {
  const position = `${index + 1} de ${total}`;
  const type = representation.tipo_normalizado ?? representation.tipo ?? "Movimentação processual";
  const prefix = `Representação ${position}`;

  return [
    {
      id: `${representation.id}-identification`,
      title: `${prefix} | ${type}`,
      wide: true,
      pageBreakBefore: true,
      fields: [
        { label: "Tipo", value: type },
        { label: "Status", value: representation.status },
        { label: "Código interno", value: representation.codigo_interno },
        { label: "Processo judicial", value: representation.processo_judicial },
        {
          label: "Data da representação",
          value: formatDateValue(representation.data_representacao ?? ""),
        },
        {
          label: "Data do protocolo",
          value: formatDateValue(representation.data_protocolo ?? ""),
        },
        {
          label: "Envio ao Judiciário",
          value: formatDateValue(representation.data_envio_judiciario ?? ""),
        },
        { label: "Responsável", value: representation.responsavel },
        { label: "Equipe responsável", value: representation.equipe_responsavel },
        { label: "Prioridade", value: representation.prioridade_operacional },
        {
          label: "Pedido sigiloso",
          value:
            representation.pedido_sigiloso ??
            (representation.pedido_sigiloso_normalizado === null
              ? null
              : representation.pedido_sigiloso_normalizado
                ? "Sim"
                : "Não"),
        },
        {
          label: "Acompanhamento especial",
          value:
            representation.acompanhamento_especial === null
              ? null
              : representation.acompanhamento_especial
                ? "Sim"
                : "Não",
        },
        {
          label: "Medida protetiva",
          value:
            representation.medida_protetiva_normalizada === null
              ? null
              : representation.medida_protetiva_normalizada
                ? "Sim"
                : "Não",
        },
      ],
    },
    {
      id: `${representation.id}-content`,
      title: `${prefix} | Pessoas e fundamentação`,
      wide: true,
      breakable: true,
      fields: [
        ...representationPeopleFields(representation, people),
        { label: "Autor preso", value: representation.autor_preso },
        {
          label: "Resumo dos fatos",
          value: representation.resumo_fatos,
          wide: true,
        },
        {
          label: "Fundamentação",
          value: representation.fundamentacao,
          wide: true,
        },
        { label: "Objetivo", value: representation.objetivo, wide: true },
        {
          label: "Diligências relacionadas",
          value: representation.diligencias_relacionadas,
          wide: true,
        },
      ],
    },
    {
      id: `${representation.id}-progress`,
      title: `${prefix} | Tramitação e cumprimento`,
      wide: true,
      breakable: true,
      fields: [
        { label: "Vara / Juízo", value: representation.vara_juizo },
        {
          label: "Prazo concedido",
          value:
            representation.prazo_concedido_dias && representation.prazo_concedido_dias > 0
              ? `${representation.prazo_concedido_dias} dias`
              : null,
        },
        {
          label: "Data de vencimento",
          value: formatDateValue(representation.data_vencimento ?? ""),
        },
        {
          label: "Data da decisão",
          value: formatDateValue(representation.data_decisao_judicial ?? ""),
        },
        {
          label: "Situação do cumprimento",
          value: representation.cumprimento_status,
        },
        {
          label: "Data do cumprimento",
          value: formatDateValue(representation.data_cumprimento ?? ""),
        },
        { label: "Equipe de cumprimento", value: representation.equipe_cumprimento },
        {
          label: "Resultado do cumprimento",
          value: representation.resultado_cumprimento,
          wide: true,
        },
        {
          label: "Observações da decisão",
          value: representation.observacoes_decisao,
          wide: true,
        },
        {
          label: "Observações do cumprimento",
          value: representation.observacoes_cumprimento,
          wide: true,
        },
        {
          label: "Observações da movimentação",
          value: representation.observacoes_movimentacao ?? representation.observacoes_internas,
          wide: true,
        },
      ],
    },
  ];
}

function normalizeInqueritoForDetail(caso: InqueritoRecord): InqueritoDetalheUI {
  const raw = caso as unknown as Record<string, unknown>;
  const priorityDetails = calculateInqueritoOperationalPriorityDetails(raw);
  const rawWeaponValue = pick(raw, "arma_utilizada", "armaUtilizada");
  return {
    id: caso.id,
    idInterno: caso.id,
    numeroPpe: pick(raw, "numero_ppe", "numeroPpe", "ppe"),
    tipificacao: pick(raw, "tipificacao"),
    numeroFisico: pick(raw, "numero_fisico", "numeroFisico"),
    numeroBo: pick(raw, "numero_bo", "numeroBo"),
    origemRegistro: getOccurrenceOriginLabel(pick(raw, "origem_registro")) || FALLBACK,
    visibilidade: pick(raw, "visibilidade"),
    tipo: pick(
      raw,
      "tipo",
      "tipo_procedimento_normalizado",
      "tipo_procedimento",
      "tipoProcedimento",
      "procedimento",
    ),
    situacao: pick(raw, "situacao", "status_diligencias"),
    prioridade: priorityDetails.priority,
    prioridadeMotivo: priorityDetails.reason,
    gravidade: pickCaseCategory(raw),
    dataFato: pick(raw, "data_fato", "dataFato"),
    dataInstauracao: pick(raw, "data_instauracao", "dataInstauracao"),
    prazo: formatPrazoDisplay(pick(raw, "prazo_data_final", "prazo")),
    prazoDias: pick(raw, "prazo_dias"),
    diasDecorridos: formatElapsedDuration(pick(raw, "dias_decorridos", "diasDecorridos")),
    ultimaEdicao: pick(raw, "updated_at", "updatedAt", "ultima_edicao", "ultimaEdicao"),
    delegadoResponsavel: pick(raw, "delegado_responsavel", "delegadoResponsavel"),
    bairro: pick(raw, "bairro", "bairroDistrito"),
    distrito: pick(raw, "distrito"),
    cidade: pick(raw, "cidade", "distrito"),
    vitima: pick(raw, "vitima"),
    investigado: pick(raw, "investigado", "suspeito", "autor_investigado", "autorInvestigado"),
    autoriaDeterminada: pick(raw, "autoria_determinada", "autoriaDeterminada"),
    reuPreso: pickTextOrBoolean(raw, ["reu_preso", "reuPreso"], ["reu_preso_normalizado"]),
    elucidado: isCvliElucidado(caso) ? "Sim" : "Não",
    houveArmaFogo: pick(raw, "houve_arma_fogo", "houveArmaFogo"),
    armaUtilizada:
      rawWeaponValue === FALLBACK ? FALLBACK : formatSeizedWeaponsForDisplay(rawWeaponValue),
    observacoesArmas:
      rawWeaponValue === FALLBACK
        ? FALLBACK
        : formatSeizedWeaponObservationsForDisplay(rawWeaponValue) || FALLBACK,
    equipe: pick(raw, "equipe_responsavel", "equipe", "equipeResponsavel"),
    escrivao: pick(raw, "escrivao"),
    vinculadoFaccao: pick(raw, "vinculado_faccao", "vinculadoFaccao", "faccao"),
    nomeFaccao: pick(raw, "nome_faccao", "nomeFaccao"),
    statusDiligencias: pick(raw, "status_diligencias", "situacao", "statusDiligencias"),
    relatorioEnviado: pick(raw, "relatorio_enviado", "relatorioEnviado"),
    relatorioStatus: getOptionLabel(pick(raw, "relatorio_status"), REPORT_STATUS_OPTIONS),
    dataRelatorio: pick(raw, "data_relatorio"),
    dataEnvioRelatorio: pick(raw, "data_envio_relatorio", "dataEnvioRelatorio"),
    remessaFinalStatus:
      getInqueritoRemessaFinalStatus(caso) === "remetido" ? "Remetido" : "Em andamento",
    dataRemessaFinal: pick(raw, "data_remessa_final"),
    medidaProtetiva: pickTextOrBoolean(
      raw,
      ["medida_protetiva", "medidaProtetiva"],
      ["medida_protetiva_normalizada"],
    ),
    numeroProcessoMedida: pick(raw, "numero_processo_medida", "numeroProcessoMedida"),
    motivacao: pick(raw, "motivacao"),
    resumoFato: pick(raw, "resumo_fato", "motivacao"),
    observacoes: pick(raw, "observacoes"),
    diligenciasPendentes: pick(raw, "diligencias_pendentes", "diligenciasPendentes"),
    representacoesLegais: pick(raw, "representacoes_legais", "representacoesLegais"),
    historicoAlteracoes: pick(raw, "historico_alteracoes", "historicoAlteracoes"),
    dataCadastro: pick(raw, "created_at"),
  };
}

function InqueritoDetalhes() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [caso, setCaso] = useState<InqueritoRecord | null>(null);
  const [pessoas, setPessoas] = useState<InqueritoPessoaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [pessoasLoadWarning, setPessoasLoadWarning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showFullClassification, setShowFullClassification] = useState(false);
  const [identifierCopied, setIdentifierCopied] = useState(false);
  const [expandedNarratives, setExpandedNarratives] = useState({
    diligencias: false,
    observacoes: false,
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState<RepresentacaoRecord[]>([]);
  const [movimentacaoPessoas, setMovimentacaoPessoas] = useState<
    Record<string, RepresentacaoPessoaRecord[]>
  >({});
  const [nexoPeople, setNexoPeople] = useState<NexoInquiryPersonOption[]>([]);
  const [nexoOrganizations, setNexoOrganizations] = useState<NexoInquiryOrganizationOption[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setErro("");
        setPessoasLoadWarning(false);
        setNexoPeople([]);
        setNexoOrganizations([]);
        const [currentProfile, inquerito, pessoasResult, movementsResult] = await Promise.all([
          getCurrentProfile(),
          getInqueritoById(caseId),
          listInqueritoPessoas(caseId)
            .then((pessoasSalvas) => ({ pessoasSalvas, failed: false }))
            .catch((peopleError: unknown) => {
              console.warn("[inqueritos:detalhe] pessoas adicionais indisponiveis", peopleError);
              return { pessoasSalvas: [], failed: true };
            }),
          listRepresentacoesByInquerito(caseId)
            .then(async (linkedMovements) => ({
              linkedMovements,
              linkedPeople: await listRepresentacaoPessoasByRepresentacaoIds(
                linkedMovements.map((movement) => movement.id),
              ).catch(() => []),
            }))
            .catch(() => ({ linkedMovements: [], linkedPeople: [] })),
        ]);
        setProfile(currentProfile);
        if (!inquerito) {
          setRestricted(false);
          setCaso(null);
          return;
        }
        const raw = inquerito as unknown as Record<string, unknown>;
        const visibility = String(
          raw.visibilidade ?? raw.visibility ?? raw.publico_privado ?? "publico",
        ).toLowerCase();
        const isPrivate = visibility.includes("priv") || visibility.includes("sig");
        if (isPrivate && canOnlyViewPublicCases(currentProfile)) {
          setRestricted(true);
          setCaso(null);
          return;
        }
        setRestricted(false);
        setCaso(inquerito);
        setPessoas(pessoasResult.pessoasSalvas);
        setPessoasLoadWarning(pessoasResult.failed);
        setMovimentacoes(movementsResult.linkedMovements);
        setMovimentacaoPessoas(
          movementsResult.linkedPeople.reduce<Record<string, RepresentacaoPessoaRecord[]>>(
            (grouped, person) => {
              (grouped[person.representacao_id] ??= []).push(person);
              return grouped;
            },
            {},
          ),
        );
      } catch (error) {
        const message =
          typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
            ? error.message
            : "Erro desconhecido";
        setErro(`Falha ao carregar detalhe do procedimento (${message})`);
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId, location.pathname]);

  useEffect(() => {
    const nexoPersonIds = [
      ...new Set(
        pessoas.map((person) => person.nexo_pessoa_id).filter((id): id is string => Boolean(id)),
      ),
    ];
    const nexoOrganizationIds = [
      ...new Set(
        pessoas
          .map((person) => person.nexo_organizacao_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (!canViewNexo(profile) || (nexoPersonIds.length === 0 && nexoOrganizationIds.length === 0)) {
      setNexoPeople([]);
      setNexoOrganizations([]);
      return;
    }

    let active = true;
    void import("@/lib/repositories/nexoRepository")
      .then((repository) =>
        Promise.all([
          repository.getNexoInquiryPeopleByIds(nexoPersonIds),
          repository.getNexoInquiryOrganizationsByIds(nexoOrganizationIds),
        ]),
      )
      .then(([linkedPeople, linkedOrganizations]) => {
        if (active) {
          setNexoPeople(linkedPeople);
          setNexoOrganizations(linkedOrganizations);
        }
      })
      .catch((lookupError: unknown) => {
        if (active) {
          setNexoPeople([]);
          setNexoOrganizations([]);
          console.warn("[inqueritos:detalhe] resumo NEXO indisponível", lookupError);
        }
      });
    return () => {
      active = false;
    };
  }, [caseId, pessoas, profile]);

  const detalhe = useMemo(() => (caso ? normalizeInqueritoForDetail(caso) : null), [caso]);
  const movimentacoesProcessuais = useMemo(
    () => movimentacoes.filter((movement) => !isRequisicaoMovement(movement)),
    [movimentacoes],
  );
  const movimentacoesCount = movimentacoesProcessuais.length;
  const registrationChecks = useMemo(() => {
    if (!caso) return [];
    const raw = caso as unknown as Record<string, unknown>;
    const savedReportStatus = String(raw.relatorio_status ?? "");
    const relatorioStatus: ReportStatus = ["pendente", "relatado", "enviado"].includes(
      savedReportStatus,
    )
      ? (savedReportStatus as ReportStatus)
      : isYesValue(raw.relatorio_enviado)
        ? "enviado"
        : raw.data_relatorio
          ? "relatado"
          : "pendente";

    return getInquiryRegistrationChecks({
      ppe: String(raw.numero_ppe ?? ""),
      numeroBo: String(raw.numero_bo ?? ""),
      origemRegistro: String(raw.origem_registro ?? ""),
      visibilidade: String(raw.visibilidade ?? ""),
      tipoProcedimento: String(raw.tipo ?? raw.tipo_procedimento_normalizado ?? ""),
      situacao: String(raw.situacao ?? ""),
      dataFato: String(raw.data_fato ?? ""),
      dataInstauracao: String(raw.data_instauracao ?? ""),
      prazo: String(raw.prazo ?? ""),
      tipificacao: String(raw.tipificacao ?? ""),
      resumoFato: String(raw.resumo_fato ?? ""),
      gravidade: String(raw.categoria_criminal ?? raw.gravidade ?? ""),
      vitima: String(raw.vitima ?? ""),
      investigado: String(raw.investigado ?? ""),
      autoria: String(raw.autoria_determinada ?? ""),
      reuPreso: String(raw.reu_preso ?? raw.reu_preso_normalizado ?? ""),
      bairro: String(raw.bairro ?? ""),
      distrito: String(raw.distrito ?? ""),
      cidade: String(raw.cidade ?? raw.distrito ?? ""),
      delegado: String(raw.delegado_responsavel ?? ""),
      equipe: String(raw.equipe_responsavel ?? raw.equipe ?? ""),
      escrivao: String(raw.escrivao ?? ""),
      statusDiligencias: String(raw.status_diligencias ?? ""),
      elucidado: isCvliElucidado(caso) ? "Sim" : "Não",
      remessaFinalStatus: getInqueritoRemessaFinalStatus(caso),
      houveArmaDeFogo: String(raw.houve_arma_fogo ?? ""),
      armaUtilizada: String(raw.arma_utilizada ?? ""),
      vinculadoFaccao: String(raw.faccao ?? ""),
      nomeFaccao: String(raw.nome_faccao ?? ""),
      medidaProtetiva: String(raw.medida_protetiva ?? ""),
      numeroProcessoMedida: String(raw.numero_processo_medida ?? ""),
      relatorioStatus,
      dataRelatorio: String(raw.data_relatorio ?? ""),
      dataEnvioRelatorio: String(raw.data_envio_relatorio ?? ""),
    });
  }, [caso]);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isEditingChildRoute = pathname.endsWith("/editar");

  if (isEditingChildRoute) return <Outlet />;

  if (loading)
    return (
      <AppLayout>
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </AppLayout>
    );
  if (erro)
    return (
      <AppLayout>
        <div className="space-y-4">
          <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {erro}
          </p>
          <Link to="/inqueritos" className="px-4 py-2 border border-border rounded-lg inline-block">
            Voltar
          </Link>
        </div>
      </AppLayout>
    );
  if (restricted)
    return (
      <AppLayout>
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para visualizar este procedimento.
          </p>
          <Link to="/inqueritos" className="px-4 py-2 border border-border rounded-lg inline-block">
            Voltar
          </Link>
        </div>
      </AppLayout>
    );
  if (!caso || !detalhe)
    return (
      <AppLayout>
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Procedimento não encontrado ou removido</h1>
          <p className="text-sm text-muted-foreground">
            Este procedimento não está mais disponível para visualização.
          </p>
          <Link to="/inqueritos" className="px-4 py-2 border border-border rounded-lg inline-block">
            Voltar
          </Link>
        </div>
      </AppLayout>
    );

  const remove = async () => {
    if (!caso || deleting || !canDeleteCases(profile) || isMobileViewport()) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await softDeleteInquerito(caso.id);
      setShowDeleteModal(false);
      navigate({ to: "/inqueritos" });
    } catch (error) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Erro desconhecido";
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "";
      const details =
        typeof error === "object" &&
        error !== null &&
        "details" in error &&
        typeof error.details === "string"
          ? error.details
          : "";
      const hint =
        typeof error === "object" &&
        error !== null &&
        "hint" in error &&
        typeof error.hint === "string"
          ? error.hint
          : "";
      if (code === "42501") {
        setDeleteError(
          "Sem permissão para excluir este procedimento. Verifique a policy de UPDATE/DELETE (soft delete) no Supabase.",
        );
      } else {
        setDeleteError(
          `Falha ao excluir procedimento (${message}${code ? ` | code: ${code}` : ""}${details ? ` | details: ${details}` : ""}${hint ? ` | hint: ${hint}` : ""})`,
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  const prazoSummary = getPrazoSummary(detalhe.prazo);
  const pendingChecks = registrationChecks.filter((item) => !item.complete);
  const headerIdentifier = detalhe.numeroPpe !== FALLBACK ? detalhe.numeroPpe : "sem identificação";
  const sigiloso = isInqueritoSigiloso(caso);
  const remessaStatusNormalized = normalizeText(detalhe.remessaFinalStatus);
  const remessaTone = remessaStatusNormalized.includes("remet")
    ? "emerald"
    : remessaStatusNormalized.includes("andamento")
      ? "amber"
      : "slate";
  const nexoPeopleById = new Map(nexoPeople.map((person) => [person.id, person]));
  const nexoOrganizationsById = new Map(
    nexoOrganizations.map((organization) => [organization.id, organization]),
  );
  const peopleDetailItems: PersonDetailItem[] =
    pessoas.length > 0
      ? pessoas.map((pessoa) => ({
          label:
            pessoa.papel === "vitima"
              ? "Vítima"
              : pessoa.papel === "autor_investigado"
                ? "Autor / Investigado"
                : pessoa.papel === "testemunha"
                  ? "Testemunha"
                  : "Outro envolvido",
          name: pessoa.observacao
            ? `${pessoa.nome} — (Alcunha: ${pessoa.observacao})`
            : pessoa.nome,
          authorship:
            pessoa.autoria_determinada === true
              ? "Autoria determinada"
              : pessoa.autoria_determinada === false
                ? "Autoria desconhecida"
                : undefined,
          custody: pessoa.preso === true ? "Preso" : pessoa.preso === false ? "Solto" : undefined,
          nexoPessoaId: pessoa.nexo_pessoa_id,
          nexoOrganizacaoId: pessoa.nexo_organizacao_id,
          nexoVinculoId: pessoa.nexo_vinculo_id,
          faccaoNomeInformada: pessoa.faccao_nome_informada,
          faccaoSiglaInformada: pessoa.faccao_sigla_informada,
          funcaoFaccaoInformada: pessoa.funcao_faccao_informada,
          faccaoFonteInformada: pessoa.faccao_fonte_informada,
          nexoPessoa: nexoPeopleById.get(pessoa.nexo_pessoa_id ?? "") ?? null,
          nexoOrganizacao: nexoOrganizationsById.get(pessoa.nexo_organizacao_id ?? "") ?? null,
        }))
      : [
          { label: "Vítima", name: detalhe.vitima },
          {
            label: "Autor / Investigado",
            name: detalhe.investigado,
            authorship: normalizeText(detalhe.autoriaDeterminada).includes("determinada")
              ? "Autoria determinada"
              : normalizeText(detalhe.autoriaDeterminada).includes("desconhecida")
                ? "Autoria desconhecida"
                : undefined,
            custody: isYesValue(detalhe.reuPreso)
              ? "Preso"
              : normalizeText(detalhe.reuPreso) === "nao"
                ? "Solto"
                : undefined,
          },
        ];
  const peopleRows: Array<[string, string]> = peopleDetailItems.map((person) => [
    person.label,
    [person.name, person.authorship, person.custody].filter(Boolean).join(" · "),
  ]);
  const hasComplementaryProcedureData = [
    detalhe.bairro,
    detalhe.vinculadoFaccao,
    detalhe.nomeFaccao,
    detalhe.houveArmaFogo,
    detalhe.armaUtilizada,
    detalhe.observacoesArmas,
  ].some(hasPrintableFieldValue);

  const copyHeaderIdentifier = async () => {
    if (detalhe.numeroPpe === FALLBACK) return;
    try {
      await navigator.clipboard.writeText(detalhe.numeroPpe);
      setIdentifierCopied(true);
      window.setTimeout(() => setIdentifierCopied(false), 1800);
    } catch {
      setIdentifierCopied(false);
    }
  };
  const linkedRepresentationPrintSections = movimentacoesProcessuais.flatMap((movement, index) =>
    buildRepresentationPrintSections(
      movement,
      index,
      movimentacoesProcessuais.length,
      movimentacaoPessoas[movement.id] ?? [],
    ),
  );
  const printSections: SipiPrintSection[] = [
    {
      title: "Identificação do procedimento",
      fields: [
        { label: "Nº PPE", value: detalhe.numeroPpe },
        { label: "Nº do B.O.", value: detalhe.numeroBo },
        { label: "Nº físico", value: detalhe.numeroFisico },
        { label: "Origem do registro", value: detalhe.origemRegistro },
        { label: "Tipo de procedimento", value: detalhe.tipo },
        { label: "Status", value: detalhe.situacao },
        {
          label: "Tipificações",
          value: formatTipificacoesForPrint(detalhe.tipificacao),
          wide: true,
        },
        { label: "Motivação", value: detalhe.motivacao, wide: true },
        { label: "Data do fato", value: formatDateValue(detalhe.dataFato) },
        { label: "Data de instauração", value: formatDateValue(detalhe.dataInstauracao) },
        { label: "Prazo em dias", value: detalhe.prazoDias },
        { label: "Data limite", value: prazoSummary.detail },
      ],
    },
    {
      title: "Resumo do fato",
      wide: true,
      narrative: true,
      fields: [{ label: "Registro", value: detalhe.resumoFato, wide: true }],
    },
    {
      title: "Pessoas envolvidas",
      fields: peopleRows.map(([label, value], index) => ({
        id: `procedure-person-${index}`,
        label,
        value,
        wide: true,
      })),
    },
    {
      title: "Controle do procedimento",
      fields: [
        { label: "Bairro", value: detalhe.bairro },
        { label: "Distrito", value: detalhe.distrito },
        { label: "Cidade", value: detalhe.cidade },
        { label: "Delegado responsável", value: detalhe.delegadoResponsavel },
        { label: "Equipe responsável", value: detalhe.equipe },
        { label: "Escrivão", value: detalhe.escrivao },
        { label: "Status das diligências", value: detalhe.statusDiligencias },
        { label: "Representações / movimentações", value: String(movimentacoesCount) },
        { label: "Visibilidade", value: detalhe.visibilidade },
        { label: "Dias decorridos", value: detalhe.diasDecorridos },
        { label: "Cadastrado em", value: formatDateTime(detalhe.dataCadastro) },
        { label: "Última atualização", value: formatDateTime(detalhe.ultimaEdicao) },
      ],
    },
    {
      title: "Classificação complementar",
      fields: [
        { label: "Gravidade / categoria", value: detalhe.gravidade },
        { label: "Prioridade operacional", value: detalhe.prioridade },
        { label: "Motivo da prioridade", value: detalhe.prioridadeMotivo, wide: true },
        { label: "Elucidado", value: detalhe.elucidado },
        { label: "Medida protetiva", value: detalhe.medidaProtetiva },
        {
          label: "Processo da medida protetiva",
          value: detalhe.numeroProcessoMedida,
        },
        { label: "Vinculado à facção", value: detalhe.vinculadoFaccao },
        { label: "Nome da facção", value: detalhe.nomeFaccao },
        { label: "Houve arma de fogo", value: detalhe.houveArmaFogo },
        { label: "Arma utilizada", value: detalhe.armaUtilizada },
        { label: "Observações das armas", value: detalhe.observacoesArmas },
        { label: "Representações legais", value: detalhe.representacoesLegais },
      ],
    },
    {
      title: "Remessa final",
      fields: [
        { label: "Situação da remessa", value: detalhe.remessaFinalStatus },
        { label: "Data da remessa", value: formatDateValue(detalhe.dataRemessaFinal) },
        { label: "Status", value: detalhe.relatorioStatus },
        { label: "Relatório enviado", value: detalhe.relatorioEnviado },
        { label: "Data do relatório", value: formatDateValue(detalhe.dataRelatorio) },
        { label: "Data de envio", value: formatDateValue(detalhe.dataEnvioRelatorio) },
      ],
    },
    {
      title: "Observações e diligências",
      wide: true,
      narrative: true,
      fields: [
        {
          label: "Diligências pendentes",
          value: detalhe.diligenciasPendentes,
          wide: true,
        },
        {
          label: "Observações",
          value: detalhe.observacoes,
          wide: true,
        },
      ],
    },
    ...(movimentacoesProcessuais.length > 0
      ? [
          {
            id: "linked-representations-index",
            title: "Representações e movimentações vinculadas",
            wide: true,
            fields: movimentacoesProcessuais.map((movement, index) => ({
              id: `linked-representation-${movement.id}`,
              label: `${index + 1} - ${movement.tipo_normalizado ?? movement.tipo ?? "Movimentação processual"}`,
              value: [
                movement.status ? `Status: ${movement.status}` : "",
                movement.processo_judicial ? `Processo: ${movement.processo_judicial}` : "",
                (movement.data_protocolo ?? movement.data_representacao)
                  ? `Data: ${formatDateValue(movement.data_protocolo ?? movement.data_representacao ?? "")}`
                  : "",
              ]
                .filter(Boolean)
                .join(" | "),
              wide: true,
            })),
          } satisfies SipiPrintSection,
        ]
      : []),
    ...linkedRepresentationPrintSections,
  ];

  return (
    <AppLayout>
      <div className="sipi-print-document mx-auto w-full max-w-[1480px] space-y-4 px-1 lg:px-2">
        <SipiPrintSheet
          variant="dossier"
          documentTitle="Relatório de Procedimento Policial"
          documentSubtitle="Procedimento, pessoas, remessa e movimentações vinculadas em documento único"
          identifierLabel={detalhe.numeroPpe !== FALLBACK ? "PPE" : "Identificação"}
          identifier={headerIdentifier}
          summary={[
            { label: "Situação", value: detalhe.situacao },
            { label: "Procedimento", value: detalhe.tipo },
            { label: "Categoria", value: detalhe.gravidade },
            { label: "Movimentações", value: String(movimentacoesCount) },
            { label: "Prazo", value: prazoSummary.detail },
            { label: "Visibilidade", value: detalhe.visibilidade },
          ]}
          sections={printSections}
        />
        <header className="sipi-print-hidden flex flex-col gap-3 rounded-lg border border-border/70 bg-card/80 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="h-10 w-1 shrink-0 rounded-full bg-primary shadow-[0_0_14px_rgba(52,211,153,0.45)]" />
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-extrabold text-muted-foreground sm:text-base">
                    Procedimento Nº:
                  </span>
                  <h1 className="min-w-0 max-w-full font-mono text-base font-black tracking-tight text-foreground sm:max-w-[min(42vw,34rem)] sm:text-lg">
                    <button
                      type="button"
                      onClick={copyHeaderIdentifier}
                      disabled={detalhe.numeroPpe === FALLBACK}
                      title={
                        detalhe.numeroPpe === FALLBACK
                          ? "Procedimento sem identificação"
                          : `${headerIdentifier} — clique para copiar`
                      }
                      className="group inline-flex min-w-0 max-w-full items-center gap-1.5 text-left disabled:cursor-default"
                    >
                      <span className="truncate">{headerIdentifier}</span>
                      {detalhe.numeroPpe !== FALLBACK ? (
                        identifierCopied ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60 transition group-hover:opacity-100" />
                        )
                      ) : null}
                      <span className="sr-only" aria-live="polite">
                        {identifierCopied ? "Número copiado" : ""}
                      </span>
                    </button>
                  </h1>
                </div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-muted-foreground">
                  <span className="truncate">{displayValue(detalhe.tipo)}</span>
                  <span className="text-border">•</span>
                  <span className="truncate">{displayValue(detalhe.gravidade)}</span>
                  {sigiloso ? (
                    <>
                      <span className="text-border">•</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/40 bg-purple-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-purple-500">
                        <Lock className="h-3 w-3" />
                        Sigiloso
                      </span>
                    </>
                  ) : null}
                  {detalhe.ultimaEdicao !== FALLBACK && (
                    <>
                      <span className="hidden text-border sm:inline">•</span>
                      <span className="hidden items-center gap-1 sm:inline-flex">
                        <CalendarClock className="h-3 w-3 text-primary/75" />
                        {formatDateTime(detalhe.ultimaEdicao)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0 lg:mr-12 xl:mr-16">
                <MissingInfoPopover items={pendingChecks} />
              </div>
            </div>
          </div>

          <div className="sipi-print-actions flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-accent"
            >
              <Printer className="h-4 w-4" /> Gerar PDF
            </button>
            {canEditCases(profile) ? (
              <>
                <a
                  href={`/nova-representacao?inqueritoId=${encodeURIComponent(caso.id)}&ppe=${encodeURIComponent(detalhe.numeroPpe === FALLBACK ? "" : detalhe.numeroPpe)}`}
                  className="hidden h-10 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 text-xs font-bold text-primary transition-colors hover:bg-primary/15 md:inline-flex"
                >
                  <Gavel className="h-4 w-4" /> Nova movimentação
                </a>
                <button
                  type="button"
                  onClick={() =>
                    navigate({ to: "/inqueritos/$caseId/editar", params: { caseId: caso.id } })
                  }
                  className="hidden h-10 items-center gap-2 rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 md:inline-flex"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
              </>
            ) : null}
            {canDeleteCases(profile) ? (
              <details className="group relative hidden md:block">
                <summary
                  aria-label="Mais ações"
                  title="Mais ações"
                  className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&::-webkit-details-marker]:hidden"
                >
                  <MoreVertical className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 top-12 z-20 min-w-40 rounded-md border border-border bg-popover p-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setShowDeleteModal(true);
                    }}
                    disabled={deleting}
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />{" "}
                    {deleting ? "Excluindo..." : "Excluir procedimento"}
                  </button>
                </div>
              </details>
            ) : null}
          </div>
        </header>

        {deleteError && (
          <p className="sipi-print-hidden rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {deleteError}
          </p>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0 space-y-3">
            <DetailSection
              title="Dados do procedimento"
              icon={<FileText className="h-4 w-4" />}
              contentClassName="p-0"
            >
              <ProcedureDataGrid
                items={[
                  {
                    label: "Nº PPE",
                    value: detalhe.numeroPpe,
                    copyValue: hasPrintableFieldValue(detalhe.numeroPpe)
                      ? detalhe.numeroPpe
                      : undefined,
                  },
                  { label: "Origem do registro", value: detalhe.origemRegistro },
                  { label: "Categoria", value: detalhe.gravidade },
                  { label: "Tipo de procedimento", value: detalhe.tipo },
                  { label: "Cidade", value: detalhe.cidade },
                  { label: "Situação", value: displayValue(detalhe.situacao) },
                ]}
              />
            </DetailSection>

            <DetailSection title="Dados do Fato" icon={<BookOpen className="h-4 w-4" />}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Tipificações
                </p>
                {hasPrintableFieldValue(detalhe.tipificacao) ? (
                  <TipificacoesDisplay value={detalhe.tipificacao} />
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Não informado.</p>
                )}
              </div>
              <div className="mt-3 border-t border-border/55 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Motivação
                </p>
                <p className="mt-1 text-sm leading-6 text-foreground">
                  {displayValue(detalhe.motivacao)}
                </p>
              </div>
              <div className="mt-3 border-t border-border/55 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Resumo do fato
                </p>
                <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  {hasPrintableFieldValue(detalhe.resumoFato) ? (
                    <p
                      className={`max-w-[110ch] break-words text-sm font-medium leading-7 text-foreground ${showFullClassification ? "" : "max-h-[5.25rem] overflow-hidden"}`}
                    >
                      {detalhe.resumoFato}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Não informado.</p>
                  )}
                  {hasPrintableFieldValue(detalhe.resumoFato) && detalhe.resumoFato.length > 180 ? (
                    <button
                      type="button"
                      onClick={() => setShowFullClassification((current) => !current)}
                      className="sipi-print-hidden shrink-0 self-start rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {showFullClassification ? "Recolher texto" : "Ver texto completo"}
                    </button>
                  ) : null}
                </div>
              </div>
            </DetailSection>

            <DetailSection title="Pessoas envolvidas" icon={<UserRound className="h-4 w-4" />}>
              {pessoasLoadWarning ? (
                <div className="sipi-print-hidden mb-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                  Os dados do inquérito foram carregados, mas as pessoas adicionais estão
                  temporariamente indisponíveis.
                </div>
              ) : null}
              <PeopleDetailRows
                maxVisible={6}
                items={peopleDetailItems}
                canAccessNexo={canViewNexo(profile)}
              />
            </DetailSection>

            <DetailSection
              title="Andamento operacional"
              icon={<CalendarClock className="h-4 w-4" />}
            >
              <OperationalTimeline
                items={[
                  ["Data do fato", formatDateValue(detalhe.dataFato)],
                  ["Instauração", formatDateValue(detalhe.dataInstauracao)],
                  [
                    "Data limite",
                    hasPrintableFieldValue(detalhe.prazo) ? prazoSummary.detail : FALLBACK,
                    prazoSummary.overdue ? "danger" : "default",
                  ],
                  ["Prazo", prazoSummary.label, prazoSummary.overdue ? "danger" : "default"],
                ]}
              />
            </DetailSection>

            {hasComplementaryProcedureData ? (
              <DetailSection
                title="Informações complementares"
                icon={<ShieldAlert className="h-4 w-4" />}
                contentClassName="p-0"
              >
                <ProcedureDataGrid
                  items={[
                    { label: "Bairro", value: detalhe.bairro },
                    { label: "Vinculado à facção", value: detalhe.vinculadoFaccao },
                    { label: "Nome da facção", value: detalhe.nomeFaccao },
                    { label: "Houve arma de fogo", value: detalhe.houveArmaFogo },
                    { label: "Arma utilizada", value: detalhe.armaUtilizada },
                    { label: "Observações das armas", value: detalhe.observacoesArmas },
                  ]}
                />
              </DetailSection>
            ) : null}

            <DetailSection
              title="Histórico de movimentações processuais"
              icon={<Gavel className="h-4 w-4" />}
              className="sipi-print-hidden"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {movimentacoesCount === 1
                    ? "1 movimentação vinculada a este procedimento."
                    : `${movimentacoesCount} movimentações vinculadas a este procedimento.`}
                </p>
                {canEditCases(profile) ? (
                  <a
                    href={`/nova-representacao?inqueritoId=${encodeURIComponent(caso.id)}&ppe=${encodeURIComponent(detalhe.numeroPpe === FALLBACK ? "" : detalhe.numeroPpe)}`}
                    className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-primary/35 bg-primary/10 px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
                  >
                    <Gavel className="h-3.5 w-3.5" /> Registrar movimentação
                  </a>
                ) : null}
              </div>
              {movimentacoesProcessuais.length > 0 ? (
                <ol className="relative space-y-3 border-l border-primary/25 pl-5">
                  {movimentacoesProcessuais.map((movimentacao) => {
                    const movementDate =
                      movimentacao.data_protocolo ??
                      movimentacao.data_representacao ??
                      movimentacao.updated_at ??
                      movimentacao.created_at;
                    const observation =
                      movimentacao.observacoes_movimentacao ??
                      movimentacao.observacoes_internas ??
                      movimentacao.resumo_fatos;
                    const movementIdentifier =
                      movimentacao.numero_ppe ?? movimentacao.codigo_interno;
                    return (
                      <li key={movimentacao.id} className="relative">
                        <span className="absolute -left-[1.55rem] top-3 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        <Link
                          to="/representacoes/$representacaoId"
                          params={{ representacaoId: movimentacao.id }}
                          className="block rounded-lg border border-border/60 bg-background/45 px-3 py-3 transition-colors hover:border-primary/35 hover:bg-primary/[0.04]"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground">
                                {displayValue(
                                  movimentacao.tipo_normalizado ?? movimentacao.tipo ?? "",
                                )}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {displayValue(movementIdentifier ?? "")}
                              </p>
                            </div>
                            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-primary">
                              {displayValue(movimentacao.status ?? "")}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 border-t border-border/45 pt-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                            <span>
                              <strong className="text-foreground">Data:</strong>{" "}
                              {formatDateTime(movementDate ?? "")}
                            </span>
                            <span>
                              <strong className="text-foreground">Responsável:</strong>{" "}
                              {displayValue(
                                movimentacao.responsavel ?? movimentacao.equipe_responsavel ?? "",
                              )}
                            </span>
                          </div>
                          {hasPrintableFieldValue(observation ?? "") ? (
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {String(observation)}
                            </p>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 bg-background/25 px-4 py-5 text-center text-xs text-muted-foreground">
                  Nenhuma movimentação processual registrada neste procedimento.
                </div>
              )}
            </DetailSection>

            <DetailSection
              title="Diligências e observações"
              icon={<NotebookPen className="h-4 w-4" />}
            >
              <div className="sipi-print-hidden mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const expandAll = !(
                      expandedNarratives.diligencias && expandedNarratives.observacoes
                    );
                    setExpandedNarratives({
                      diligencias: expandAll,
                      observacoes: expandAll,
                    });
                  }}
                  className="rounded-md border border-border/70 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/45 hover:bg-primary/5 hover:text-primary"
                >
                  {expandedNarratives.diligencias && expandedNarratives.observacoes
                    ? "Recolher tudo"
                    : "Mostrar tudo"}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <TextPanel
                  label="Observações e diligências"
                  value={
                    detalhe.diligenciasPendentes !== FALLBACK
                      ? detalhe.diligenciasPendentes
                      : detalhe.observacoes
                  }
                  expanded={expandedNarratives.diligencias}
                  onToggle={() =>
                    setExpandedNarratives((current) => ({
                      ...current,
                      diligencias: !current.diligencias,
                    }))
                  }
                />
              </div>
            </DetailSection>
          </section>

          <aside className="order-first lg:order-none print:order-none">
            <div className="sipi-print-hidden">
              <ProcedureOperationsPanel
                caseId={caso.id}
                canEdit={canEditCases(profile)}
                numeroPpe={detalhe.numeroPpe === FALLBACK ? null : detalhe.numeroPpe}
                movimentacoes={movimentacoes}
                onRequisitionCreated={(movement) =>
                  setMovimentacoes((current) => [
                    movement,
                    ...current.filter((item) => item.id !== movement.id),
                  ])
                }
                onRequisitionChanged={(movement, deletedId) =>
                  setMovimentacoes((current) =>
                    movement
                      ? [movement, ...current.filter((item) => item.id !== movement.id)]
                      : current.filter((item) => item.id !== deletedId),
                  )
                }
              />
            </div>
            <DetailSection
              title="Remessa final"
              icon={<FileSearch className="h-4 w-4" />}
              className={`mt-4 ${
                remessaTone === "emerald"
                  ? "border-l-[3px] border-l-emerald-500"
                  : remessaTone === "amber"
                    ? "border-l-[3px] border-l-amber-500"
                    : "border-l-[3px] border-l-border"
              }`}
              contentClassName="p-0"
            >
              <ProcedureDataGrid
                columns={1}
                items={[
                  {
                    label: "Situação da remessa",
                    value: detalhe.remessaFinalStatus,
                    tone: remessaTone,
                  },
                  { label: "Status", value: detalhe.relatorioStatus },
                  { label: "Data da remessa", value: formatDateValue(detalhe.dataRemessaFinal) },
                  { label: "Relatório enviado", value: detalhe.relatorioEnviado },
                  { label: "Data do relatório", value: formatDateValue(detalhe.dataRelatorio) },
                  { label: "Data de envio", value: formatDateValue(detalhe.dataEnvioRelatorio) },
                ]}
              />
            </DetailSection>
          </aside>
        </div>
        {showDeleteModal && canDeleteCases(profile) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 max-md:hidden">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-foreground">Excluir procedimento</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Deseja remover este procedimento? Esta ação utiliza exclusão lógica e poderá ser
                auditada no sistema.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={deleting}
                  className="rounded-md border border-destructive/30 bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

type ProcedureDataItem = {
  label: string;
  value: string;
  copyValue?: string;
  tone?: "emerald" | "amber" | "slate";
};

const PROCEDURE_VALUE_TONES = {
  emerald: "text-primary",
  amber: "text-warning",
  slate: "text-foreground",
} as const;

function CopyableDetailValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copyValue}
      title={`${value} — clique para copiar`}
      className="group inline-flex min-w-0 max-w-full items-start gap-2 text-left"
    >
      <span className="[overflow-wrap:anywhere]">{value}</span>
      {copied ? (
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      ) : (
        <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60 transition group-hover:opacity-100" />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Valor copiado" : ""}
      </span>
    </button>
  );
}

function ProcedureDataGrid({
  items,
  columns = 3,
}: {
  items: ProcedureDataItem[];
  columns?: 1 | 2 | 3;
}) {
  const gridColumns =
    columns === 1 ? "" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3";
  const cellBorder = columns === 1 ? "" : "sm:border-r sm:last:border-r-0";

  return (
    <dl className={`grid ${gridColumns}`}>
      {items.map(({ label, value, copyValue, tone = "slate" }) => (
        <div key={label} className={`min-w-0 border-b border-border/50 px-4 py-3 ${cellBorder}`}>
          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </dt>
          <dd
            className={`mt-1 min-w-0 text-sm font-semibold leading-5 ${PROCEDURE_VALUE_TONES[tone]}`}
          >
            {copyValue ? (
              <CopyableDetailValue value={copyValue} />
            ) : (
              <span className="whitespace-pre-line [overflow-wrap:anywhere]">
                {displayValue(value)}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DetailSection({
  title,
  icon,
  children,
  className = "",
  contentClassName = "p-3",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <article
      className={`self-start overflow-hidden rounded-lg border border-border/60 bg-card/70 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-border/55 px-4 py-2.5 text-primary">
        {icon}
        <h2 className="text-xs font-extrabold uppercase tracking-[0.16em]">{title}</h2>
      </div>
      <div className={contentClassName}>{children}</div>
    </article>
  );
}

function PeopleDetailRows({
  items,
  maxVisible,
  canAccessNexo,
}: {
  items: PersonDetailItem[];
  maxVisible?: number;
  canAccessNexo: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = items.filter((item) => hasPrintableFieldValue(item.name));
  const hasHiddenItems = maxVisible !== undefined && visibleItems.length > maxVisible;
  const displayedItems =
    hasHiddenItems && !expanded ? visibleItems.slice(0, maxVisible) : visibleItems;

  if (visibleItems.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma informação registrada.</p>;
  }

  return (
    <dl className="divide-y divide-border/50">
      {displayedItems.map((item, index) => (
        <div
          key={`${item.label}-${item.name}-${index}`}
          className="grid gap-1 py-3 sm:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] sm:gap-5"
        >
          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {item.label}
          </dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-x-12 gap-y-2 text-sm leading-5 text-foreground">
            <span className="min-w-0 break-words font-semibold">{item.name}</span>
            {item.authorship ? (
              <span
                className={`inline-flex rounded-sm border px-2 py-0.5 text-[11px] font-bold ${item.authorship === "Autoria determinada" ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-muted/35 text-muted-foreground"}`}
              >
                {item.authorship}
              </span>
            ) : null}
            {item.custody ? (
              <span
                className={`inline-flex rounded-sm border px-2 py-0.5 text-[11px] font-bold ${item.custody === "Preso" ? "border-destructive/35 bg-destructive/10 text-destructive" : "border-border bg-muted/35 text-muted-foreground"}`}
              >
                {item.custody}
              </span>
            ) : null}
            <InquiryNexoSummaryButton
              nexoPersonId={item.nexoPessoaId ?? null}
              nexoOrganizationId={item.nexoOrganizacaoId ?? null}
              nexoLinkId={item.nexoVinculoId ?? null}
              factionName={item.faccaoNomeInformada ?? null}
              factionSigla={item.faccaoSiglaInformada ?? null}
              reportedFunction={item.funcaoFaccaoInformada ?? null}
              reportedSource={item.faccaoFonteInformada ?? null}
              person={item.nexoPessoa ?? null}
              organization={item.nexoOrganizacao ?? null}
              canAccessNexo={canAccessNexo}
            />
          </dd>
        </div>
      ))}
      {hasHiddenItems ? (
        <div className="sipi-print-hidden flex justify-end pt-3">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-md border border-border/70 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/45 hover:bg-primary/5 hover:text-primary"
          >
            {expanded ? "Recolher lista" : `Ver todos (${visibleItems.length})`}
          </button>
        </div>
      ) : null}
    </dl>
  );
}

function OperationalTimeline({ items }: { items: [string, string, ("danger" | "default")?][] }) {
  const lastKnownIndex = items.reduce(
    (lastIndex, [, value], index) => (hasPrintableFieldValue(value) ? index : lastIndex),
    -1,
  );
  const statuses = items.map(([, value, tone = "default"], index) => {
    if (!hasPrintableFieldValue(value)) return "pending" as const;
    if (tone === "danger") return "danger" as const;
    const previousItemsAreKnown = items
      .slice(0, index)
      .every(([, previousValue]) => hasPrintableFieldValue(previousValue));
    if (index === lastKnownIndex) return "current" as const;
    return previousItemsAreKnown ? ("complete" as const) : ("pending" as const);
  });

  return (
    <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value], index) => {
        const status = statuses[index];
        const nextStatus = statuses[index + 1];
        const markerClass =
          status === "complete"
            ? "border-primary/55 bg-primary/10 text-primary"
            : status === "current"
              ? "border-warning/65 bg-warning/10 text-warning"
              : status === "danger"
                ? "border-destructive/65 bg-destructive/10 text-destructive"
                : "border-border bg-muted/30 text-muted-foreground";
        const connectorClass =
          status === "complete" && (nextStatus === "complete" || nextStatus === "current")
            ? "bg-primary/55"
            : nextStatus === "danger"
              ? "bg-destructive/45"
              : "bg-border";

        return (
          <li key={label} className="relative min-w-0 lg:pr-4">
            {index < items.length - 1 ? (
              <span
                className={`absolute left-5 top-5 hidden h-px w-[calc(100%+0.5rem)] ${connectorClass} lg:block`}
              />
            ) : null}
            <div
              className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border ${markerClass}`}
            >
              {index === 0 ? <CalendarDays className="h-4 w-4" /> : null}
              {index === 1 ? <FileText className="h-4 w-4" /> : null}
              {index === 2 ? <CalendarClock className="h-4 w-4" /> : null}
              {index === 3 ? <ShieldCheck className="h-4 w-4" /> : null}
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${status === "danger" ? "text-destructive" : status === "pending" ? "text-muted-foreground" : "text-foreground"}`}
            >
              {displayValue(value)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function TextPanel({
  label,
  value,
  expanded,
  onToggle,
}: {
  label: string;
  value: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasValue = hasPrintableFieldValue(value);

  return (
    <div
      className={`${hasValue ? "" : "sipi-print-empty-field "}self-start rounded-md border border-border/50 bg-background/25 p-3`}
    >
      <div className="flex min-h-7 items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        {hasValue ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="sipi-print-hidden shrink-0 text-[10px] font-semibold text-primary transition-colors hover:text-primary/75"
          >
            {expanded ? "Recolher" : "Mostrar tudo"}
          </button>
        ) : null}
      </div>
      {hasValue ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="block w-full text-left"
        >
          <p
            className={`whitespace-pre-wrap text-sm leading-6 text-foreground ${expanded ? "" : "max-h-40 overflow-hidden"}`}
          >
            {value}
          </p>
        </button>
      ) : (
        <div className="flex h-16 items-center gap-2 text-xs text-muted-foreground">
          <FolderOpen className="h-4 w-4 text-primary/70" /> Nenhum registro informado.
        </div>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  if (!value || value === FALLBACK) return FALLBACK;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    parsed,
  );
}
