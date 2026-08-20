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
  listInqueritoStatusHistory,
  listProceduralTags,
} from "@/lib/repositories/proceduralTagsRepository";
import type { ProceduralStatusHistory, ProceduralTag } from "@/lib/proceduralTags";
import {
  listRepresentacoesByInquerito,
  type RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";
import { getCurrentProfile } from "@/lib/auth";
import { isMobileViewport } from "@/lib/mobileExperience";
import { formatSeizedWeaponsForDisplay } from "@/lib/seizedWeapons";
import {
  canDeleteCases,
  canEditCases,
  canOnlyViewPublicCases,
  type UserProfile,
} from "@/lib/authz";
import {
  calculateInqueritoOperationalPriorityDetails,
  normalizeCaseCategory,
} from "@/lib/inqueritosPriority";
import {
  getInquiryRegistrationChecks,
  getOccurrenceOriginLabel,
  isYesValue,
  REPORT_STATUS_OPTIONS,
  type ReportStatus,
} from "@/lib/operationalContracts";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  FileSearch,
  FileText,
  Flag,
  FolderOpen,
  Gavel,
  Link2,
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
  dataElucidacao: string;
  houveArmaFogo: string;
  armaUtilizada: string;
  equipe: string;
  escrivao: string;
  vinculadoFaccao: string;
  nomeFaccao: string;
  statusDiligencias: string;
  relatorioEnviado: string;
  relatorioStatus: string;
  dataRelatorio: string;
  dataEnvioRelatorio: string;
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
  return visibility.includes("sig") || raw.sigiloso === true || raw.sigiloso_normalizado === true || sigiloso === "sim";
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

function renderCrimeCode(value: string) {
  const match = value.match(/^(\s*\d+)(\s*:\s*)(.*)$/);
  if (!match) return value;

  const [, code, separator, description] = match;
  return (
    <>
      <strong className="font-extrabold">{code}</strong>
      {separator}
      {description}
    </>
  );
}

function normalizeInqueritoForDetail(caso: InqueritoRecord): InqueritoDetalheUI {
  const raw = caso as unknown as Record<string, unknown>;
  const priorityDetails = calculateInqueritoOperationalPriorityDetails(raw);
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
    elucidado: pickTextOrBoolean(raw, ["elucidado"], ["cvli_elucidado"]),
    dataElucidacao: pick(raw, "data_elucidacao"),
    houveArmaFogo: pick(raw, "houve_arma_fogo", "houveArmaFogo"),
    armaUtilizada: formatSeizedWeaponsForDisplay(pick(raw, "arma_utilizada", "armaUtilizada")),
    equipe: pick(raw, "equipe_responsavel", "equipe", "equipeResponsavel"),
    escrivao: pick(raw, "escrivao"),
    vinculadoFaccao: pick(raw, "vinculado_faccao", "vinculadoFaccao", "faccao"),
    nomeFaccao: pick(raw, "nome_faccao", "nomeFaccao"),
    statusDiligencias: pick(raw, "status_diligencias", "situacao", "statusDiligencias"),
    relatorioEnviado: pick(raw, "relatorio_enviado", "relatorioEnviado"),
    relatorioStatus: getOptionLabel(pick(raw, "relatorio_status"), REPORT_STATUS_OPTIONS),
    dataRelatorio: pick(raw, "data_relatorio"),
    dataEnvioRelatorio: pick(raw, "data_envio_relatorio", "dataEnvioRelatorio"),
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
  const [expandedNarratives, setExpandedNarratives] = useState({
    diligencias: false,
    observacoes: false,
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [statusHistory, setStatusHistory] = useState<ProceduralStatusHistory[]>([]);
  const [statusTags, setStatusTags] = useState<ProceduralTag[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<RepresentacaoRecord[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setErro("");
        setPessoasLoadWarning(false);
        const [
          currentProfile,
          inquerito,
          pessoasResult,
          historyResult,
          tagsResult,
          movementsResult,
        ] = await Promise.all([
          getCurrentProfile(),
          getInqueritoById(caseId),
          listInqueritoPessoas(caseId)
            .then((pessoasSalvas) => ({ pessoasSalvas, failed: false }))
            .catch((peopleError: unknown) => {
              console.warn("[inqueritos:detalhe] pessoas adicionais indisponiveis", peopleError);
              return { pessoasSalvas: [], failed: true };
            }),
          listInqueritoStatusHistory(caseId).catch(() => []),
          listProceduralTags(["inquerito_status"]).catch(() => []),
          listRepresentacoesByInquerito(caseId).catch(() => []),
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
        setStatusHistory(historyResult);
        setStatusTags(tagsResult);
        setMovimentacoes(movementsResult);
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

  const detalhe = useMemo(() => (caso ? normalizeInqueritoForDetail(caso) : null), [caso]);
  const movimentacoesCount = movimentacoes.length;
  const statusTagNames = useMemo(
    () => new Map(statusTags.map((tag) => [tag.id, tag.name])),
    [statusTags],
  );
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
      elucidado: String(raw.elucidado ?? ""),
      dataElucidacao: String(raw.data_elucidacao ?? ""),
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
  const peopleRows: Array<[string, string]> =
    pessoas.length > 0
      ? pessoas.map((pessoa) => [
          pessoa.papel === "vitima"
            ? "Vítima"
            : pessoa.papel === "autor_investigado"
              ? "Autor / Investigado"
              : pessoa.papel === "testemunha"
                ? "Testemunha"
                : "Outro envolvido",
          // Só entra o que foi informado: nada de "não informado" enchendo a linha.
          [
            pessoa.observacao ? `${pessoa.nome} — (Alcunha: ${pessoa.observacao})` : pessoa.nome,
            pessoa.autoria_determinada === true
              ? "Autoria determinada"
              : pessoa.autoria_determinada === false
                ? "Autoria desconhecida"
                : "",
            pessoa.preso === true ? "Preso" : pessoa.preso === false ? "Solto" : "",
          ]
            .filter(Boolean)
            .join(" · "),
        ])
      : [
          ["Vítima", detalhe.vitima],
          ["Autor / Investigado", detalhe.investigado],
        ];
  const hasAdditionalClassification = [detalhe.houveArmaFogo, detalhe.armaUtilizada].some(
    hasPrintableFieldValue,
  );
  const printSections: SipiPrintSection[] = [
    {
      title: "Identificação do procedimento",
      fields: [
        { label: "Nº PPE", value: detalhe.numeroPpe },
        { label: "Origem do registro", value: detalhe.origemRegistro },
        { label: "Tipo de procedimento", value: detalhe.tipo },
        { label: "Status", value: detalhe.situacao },
        { label: "Tipificações", value: detalhe.tipificacao, wide: true },
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
      fields: [
        ...peopleRows.map(([label, value]) => ({ label, value, wide: true })),
        { label: "Autoria", value: detalhe.autoriaDeterminada },
        { label: "Réu preso", value: detalhe.reuPreso },
      ],
    },
    {
      title: "Controle do procedimento",
      fields: [
        { label: "Bairro", value: detalhe.bairro },
        { label: "Cidade", value: detalhe.cidade },
        { label: "Movimentações", value: String(movimentacoesCount) },
        { label: "Visibilidade", value: detalhe.visibilidade },
        { label: "Cadastrado em", value: formatDateTime(detalhe.dataCadastro) },
        { label: "Última atualização", value: formatDateTime(detalhe.ultimaEdicao) },
      ],
    },
    {
      title: "Classificação complementar",
      fields: [
        { label: "Prioridade operacional", value: detalhe.prioridade },
        { label: "Motivo da prioridade", value: detalhe.prioridadeMotivo, wide: true },
        { label: "Houve arma de fogo", value: detalhe.houveArmaFogo },
        { label: "Arma utilizada", value: detalhe.armaUtilizada },
        { label: "Vinculado à facção", value: detalhe.vinculadoFaccao },
        { label: "Nome da facção", value: detalhe.nomeFaccao },
      ],
    },
    {
      title: "Relatório final",
      fields: [
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
          label: "Registro",
          value:
            detalhe.diligenciasPendentes !== FALLBACK
              ? detalhe.diligenciasPendentes
              : detalhe.observacoes,
          wide: true,
        },
      ],
    },
  ];

  return (
    <AppLayout>
      <div className="sipi-print-document mx-auto w-full max-w-[1480px] space-y-4 px-1 lg:px-2">
        <SipiPrintSheet
          variant="inquiry"
          documentTitle="Ficha de Procedimento Policial"
          documentSubtitle="Conferência, acompanhamento e arquivamento operacional"
          identifierLabel={detalhe.numeroPpe !== FALLBACK ? "PPE" : "Identificação"}
          identifier={headerIdentifier}
          summary={[
            { label: "Situação", value: detalhe.situacao },
            { label: "Procedimento", value: detalhe.tipo },
            { label: "Categoria", value: detalhe.gravidade },
            { label: "Movimentações", value: String(movimentacoesCount) },
            { label: "Prazo", value: prazoSummary.detail },
          ]}
          sections={printSections}
        />
        <header className="sipi-print-hidden flex flex-col gap-3 border-b border-border/65 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border/70 bg-gradient-to-r from-card/90 via-card/55 to-card/20 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
            <span className="h-10 w-1 shrink-0 rounded-full bg-primary shadow-[0_0_14px_rgba(52,211,153,0.45)]" />
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Link
                to="/inqueritos"
                aria-label="Voltar para procedimentos"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 text-xs font-bold text-primary transition-colors hover:border-primary/45 hover:bg-primary/10"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Link>
              <span className="hidden h-9 w-px shrink-0 bg-border/70 sm:block" />
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-extrabold text-muted-foreground sm:text-base">
                    Procedimento N°:
                  </span>
                  <h1 className="truncate font-mono text-base font-black tracking-tight text-foreground sm:text-lg">
                    {headerIdentifier}
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
              <MissingInfoPopover items={pendingChecks} />
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

        <section className="sipi-print-hidden grid overflow-hidden rounded-lg border border-border/65 bg-card/55 sm:grid-cols-2 xl:grid-cols-5">
          <OperationalMetric
            icon={<FileText className="h-5 w-5" />}
            label="Situação"
            value={displayValue(detalhe.situacao)}
            tone="emerald"
          />
          <OperationalMetric
            icon={<CalendarDays className="h-5 w-5" />}
            label="Prazo"
            value={prazoSummary.label}
            detail={prazoSummary.detail}
            tone={prazoSummary.overdue ? "red" : "amber"}
          />
          <OperationalMetric
            icon={<Flag className="h-5 w-5" />}
            label="Prioridade"
            value={displayValue(detalhe.prioridade)}
            detail={
              hasPrintableFieldValue(detalhe.prioridadeMotivo)
                ? detalhe.prioridadeMotivo
                : undefined
            }
            tone="amber"
          />
          <OperationalMetric
            icon={<FolderOpen className="h-5 w-5" />}
            label="Categoria"
            value={displayValue(detalhe.gravidade)}
            tone="violet"
          />
          <OperationalMetric
            icon={<FileSearch className="h-5 w-5" />}
            label="Movimentações"
            value={String(movimentacoesCount)}
            detail={movimentacoesCount === 1 ? "registro vinculado" : "registros vinculados"}
            tone="slate"
          />
        </section>

        {deleteError && (
          <p className="sipi-print-hidden rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {deleteError}
          </p>
        )}

        <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            <DetailSection title="Resumo do fato" icon={<BookOpen className="h-4 w-4" />}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <p
                  className={`max-w-5xl break-words text-sm font-medium leading-7 text-foreground ${showFullClassification ? "" : "max-h-[5.25rem] overflow-hidden"}`}
                >
                  {detalhe.resumoFato}
                </p>
                {detalhe.resumoFato.length > 180 ? (
                  <button
                    type="button"
                    onClick={() => setShowFullClassification((current) => !current)}
                    className="sipi-print-hidden shrink-0 self-start rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {showFullClassification ? "Recolher texto" : "Ver texto completo"}
                  </button>
                ) : null}
              </div>
              {hasPrintableFieldValue(detalhe.tipificacao) ? (
                <div className="mt-4 border-t border-border/55 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Tipificações
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {renderCrimeCode(detalhe.tipificacao)}
                  </p>
                </div>
              ) : null}
              {hasPrintableFieldValue(detalhe.motivacao) ? (
                <div className="mt-3 border-t border-border/55 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Motivação
                  </p>
                  <p className="mt-1 text-sm leading-6 text-foreground">
                    {displayValue(detalhe.motivacao)}
                  </p>
                </div>
              ) : null}
            </DetailSection>

            <DetailSection title="Pessoas envolvidas" icon={<UserRound className="h-4 w-4" />}>
              {pessoasLoadWarning ? (
                <div className="sipi-print-hidden mb-3 rounded-lg border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                  Os dados do inquerito foram carregados, mas as pessoas adicionais estao
                  temporariamente indisponiveis.
                </div>
              ) : null}
              <DetailRows
                items={[
                  ...peopleRows,
                  ["Autoria", detalhe.autoriaDeterminada],
                  ["Réu preso", detalhe.reuPreso],
                ]}
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
                  ["Data limite", prazoSummary.detail, prazoSummary.overdue ? "danger" : "default"],
                  ["Última atualização", formatDateTime(detalhe.ultimaEdicao)],
                ]}
              />
            </DetailSection>

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
                    className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-primary/35 bg-primary/10 px-3 text-[11px] font-bold text-primary transition-colors hover:bg-primary/15"
                  >
                    <Gavel className="h-3.5 w-3.5" /> Registrar movimentação
                  </a>
                ) : null}
              </div>
              {movimentacoes.length > 0 ? (
                <ol className="relative space-y-3 border-l border-primary/25 pl-5">
                  {movimentacoes.map((movimentacao) => {
                    const movementDate =
                      movimentacao.data_protocolo ??
                      movimentacao.data_representacao ??
                      movimentacao.updated_at ??
                      movimentacao.created_at;
                    const observation =
                      movimentacao.observacoes_movimentacao ??
                      movimentacao.observacoes_internas ??
                      movimentacao.resumo_fatos;
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
                                {displayValue(
                                  movimentacao.numero_ppe ?? movimentacao.codigo_interno ?? "",
                                )}
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
          </div>

          <aside className="space-y-4 xl:col-span-4">
            <DetailSection title="Dados do procedimento" icon={<FileText className="h-4 w-4" />}>
              <DetailRows
                compact
                items={[
                  ["Nº PPE", detalhe.numeroPpe],
                  ["Origem do registro", detalhe.origemRegistro],
                  ["Categoria", detalhe.gravidade],
                  ["Tipo de procedimento", detalhe.tipo],
                  ["Bairro", detalhe.bairro],
                  ["Cidade", detalhe.cidade],
                  ["Movimentações", String(movimentacoesCount)],
                  ["Vinculado à facção", detalhe.vinculadoFaccao],
                  ["Nome da facção", detalhe.nomeFaccao],
                ]}
              />
            </DetailSection>

            {hasAdditionalClassification ? (
              <DetailSection
                title="Classificação complementar"
                icon={<ShieldAlert className="h-4 w-4" />}
              >
                <DetailRows
                  compact
                  items={[
                    ["Houve arma de fogo", detalhe.houveArmaFogo],
                    ["Arma utilizada", detalhe.armaUtilizada],
                  ]}
                />
              </DetailSection>
            ) : null}

            <DetailSection title="Relatório final" icon={<FileSearch className="h-4 w-4" />}>
              <DetailRows
                compact
                items={[
                  ["Status", detalhe.relatorioStatus],
                  ["Relatório enviado", detalhe.relatorioEnviado],
                  ["Data do relatório", formatDateValue(detalhe.dataRelatorio)],
                  ["Data de envio", formatDateValue(detalhe.dataEnvioRelatorio)],
                ]}
              />
              {canEditCases(profile) ? (
                <a
                  href={`/nova-representacao?inqueritoId=${encodeURIComponent(caso.id)}&ppe=${encodeURIComponent(detalhe.numeroPpe === FALLBACK ? "" : detalhe.numeroPpe)}&tipo=relatorio-final`}
                  className="sipi-print-hidden mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-primary/35 bg-primary/10 px-3 text-[11px] font-bold text-primary transition-colors hover:bg-primary/15"
                >
                  <FileText className="h-3.5 w-3.5" /> Registrar relatório final
                </a>
              ) : null}
            </DetailSection>

            <DetailSection
              title="Histórico de status"
              icon={<CalendarClock className="h-4 w-4" />}
              className="sipi-print-hidden"
            >
              {statusHistory.length > 0 ? (
                <div className="space-y-2">
                  {statusHistory.slice(0, 8).map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-border/60 bg-background/45 px-3 py-2"
                    >
                      <p className="text-xs font-semibold text-foreground">
                        {event.previous_status_tag_id
                          ? `${statusTagNames.get(event.previous_status_tag_id) ?? "Status anterior"} → `
                          : ""}
                        {statusTagNames.get(event.status_tag_id) ?? "Status atualizado"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDateTime(event.changed_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  O histórico será formado automaticamente nas próximas mudanças de status.
                </p>
              )}
            </DetailSection>

            <DetailSection
              title="Atalhos"
              icon={<Link2 className="h-4 w-4" />}
              className="sipi-print-hidden"
            >
              <div className="space-y-2">
                <ShortcutLink
                  to="/auditoria"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Abrir auditoria"
                />
                <ShortcutLink
                  to="/representacoes"
                  icon={<Scale className="h-4 w-4" />}
                  label="Ver movimentações processuais"
                />
              </div>
            </DetailSection>
          </aside>
        </section>
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

const OPERATIONAL_TONES = {
  emerald: "text-emerald-400",
  red: "text-red-400",
  amber: "text-amber-400",
  violet: "text-violet-400",
  slate: "text-slate-300",
} as const;

function OperationalMetric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: keyof typeof OPERATIONAL_TONES;
}) {
  return (
    <div className="grid min-h-[6.5rem] min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3 border-b border-border/60 px-4 py-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-current/20 bg-current/5 ${OPERATIONAL_TONES[tone]}`}
      >
        {icon}
      </span>
      <div className="grid min-h-[4.5rem] min-w-0 grid-rows-[1rem_minmax(1.5rem,auto)_1rem] content-start">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p
          className={`self-center break-words text-sm font-bold leading-5 ${OPERATIONAL_TONES[tone]}`}
        >
          {value}
        </p>
        <p
          aria-hidden={!detail}
          className={`truncate text-[10px] leading-4 text-muted-foreground ${detail ? "" : "invisible"}`}
        >
          {detail || "Sem detalhe"}
        </p>
      </div>
    </div>
  );
}

function DetailSection({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`self-start overflow-hidden rounded-lg border border-border/60 bg-card/70 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-border/55 px-4 py-3 text-primary">
        {icon}
        <h2 className="text-xs font-extrabold uppercase tracking-[0.16em]">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </article>
  );
}

function DetailRows({ items, compact = false }: { items: [string, string][]; compact?: boolean }) {
  const visibleItems = items.filter(([, value]) => hasPrintableFieldValue(value));

  if (visibleItems.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma informação registrada.</p>;
  }

  return (
    <dl className="divide-y divide-border/50">
      {visibleItems.map(([label, value]) => (
        <div
          key={label}
          className={`${compact ? "grid gap-1 py-2.5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-4" : "grid gap-1 py-3 sm:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] sm:gap-5"}`}
        >
          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </dt>
          <dd className="min-w-0 break-words text-sm font-medium leading-5 text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OperationalTimeline({ items }: { items: [string, string, ("danger" | "default")?][] }) {
  return (
    <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value, tone = "default"], index) => (
        <li key={label} className="relative min-w-0 lg:pr-4">
          {index < items.length - 1 ? (
            <span className="absolute left-5 top-5 hidden h-px w-[calc(100%+0.5rem)] bg-primary/35 lg:block" />
          ) : null}
          <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-primary/50 bg-background text-primary">
            {index === 0 ? <CalendarDays className="h-4 w-4" /> : null}
            {index === 1 ? <FileText className="h-4 w-4" /> : null}
            {index === 2 ? <CalendarClock className="h-4 w-4" /> : null}
            {index === 3 ? <ShieldCheck className="h-4 w-4" /> : null}
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p
            className={`mt-1 text-sm font-semibold ${tone === "danger" ? "text-red-400" : "text-foreground"}`}
          >
            {displayValue(value)}
          </p>
        </li>
      ))}
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

function ShortcutLink({
  to,
  icon,
  label,
}: {
  to: "/auditoria" | "/representacoes";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border/50 bg-background/25 px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="flex items-center gap-2 text-primary">
        {icon}
        <span className="text-foreground">{label}</span>
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        →
      </span>
    </Link>
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
