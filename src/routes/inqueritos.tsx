import { Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { InqueritoQuickPreview } from "@/components/RecordQuickPreview";
import {
  TableColumnSettings,
  useTableColumnPreferences,
  type TableColumnDefinition,
} from "@/components/TableColumnSettings";
import {
  Check,
  ChevronDown,
  FileDown,
  Filter,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { listInqueritos, type InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import {
  listRepresentacoes,
  type RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";
import { getCurrentProfile } from "@/lib/auth";
import {
  canCreateCases,
  canOnlyViewPublicCases,
  canViewRepresentacoes,
  type UserProfile,
} from "@/lib/authz";
import { canAccessSigilosa, isRepresentacaoSigilosa } from "@/lib/representacoesSigilo";
import { classifyAuthorship, getAuthorshipLabel } from "@/lib/authorship";
import {
  listInqueritoTagLinks,
  listProceduralTags,
} from "@/lib/repositories/proceduralTagsRepository";
import { tagsByScope, type ProceduralTag } from "@/lib/proceduralTags";
import { parseTipificacoes } from "@/lib/tipificacaoParser";
import {
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
  renameSavedFilter,
  updateSavedFilter,
  type SavedFilterRecord,
} from "@/lib/repositories/savedFiltersRepository";
import { SipiPrintList } from "@/components/SipiPrintList";
import {
  calculateInqueritoOperationalPriority,
  isTruthyLike,
  normalizeCaseCategory,
  normalizeText,
  pick,
} from "@/lib/inqueritosPriority";
import { getCvliReferenceDate, isCvliElucidado, isCvliRecord } from "@/lib/cvliMetrics";
import {
  hasRelatorioEnviado,
  isInqueritoEmAndamento,
  isOperationalDateDueWithin,
  isOperationalDateOverdue,
  isRelatadoNaoEnviado,
} from "@/lib/operationalMetrics";

export const Route = createFileRoute("/inqueritos")({ component: Inqueritos });
const priorTone: Record<string, string> = {
  ALTA: "bg-destructive/15 text-destructive border-destructive/30",
  MÉDIA: "bg-warning/15 text-warning border-warning/30",
  BAIXA: "bg-info/15 text-info border-info/30",
};
const statusTone: Record<string, string> = {
  "Em Andamento": "bg-info/15 text-info border-info/30",
  Concluída: "bg-success/15 text-success border-success/30",
  Pendente: "bg-warning/15 text-warning border-warning/30",
};
const FALLBACK = "—";
const EMPTY_FILTER = "__vazio__";
const INQUIRY_COLUMNS: readonly TableColumnDefinition[] = [
  { id: "ppe", label: "Nº PPE", defaultWidth: 160, required: true },
  { id: "prioridade", label: "Prioridade", defaultWidth: 112 },
  { id: "tipificacao", label: "Tipificação", defaultWidth: 376 },
  { id: "gravidade", label: "Gravidade", defaultWidth: 160, align: "center" },
  { id: "tipo", label: "Tipo", defaultWidth: 116, align: "center" },
  { id: "data_fato", label: "Data do fato", defaultWidth: 124, align: "center" },
  { id: "autoria", label: "Autoria", defaultWidth: 144, align: "center" },
  { id: "bairro", label: "Bairro", defaultWidth: 164 },
  { id: "reu_preso", label: "Réu preso", defaultWidth: 124, align: "center" },
  { id: "status", label: "Status", defaultWidth: 180, align: "center" },
  { id: "prazo", label: "Prazo", defaultWidth: 108, align: "center" },
  { id: "acao", label: "Ação", defaultWidth: 84, required: true, align: "center" },
];

type FilterOption = { value: string; label: string };

function MultiSelectFilter({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: FilterOption[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary =
    values.length === 0
      ? `${label}: todos`
      : values.length === 1
        ? `${label}: ${options.find((option) => option.value === values[0])?.label ?? values[0]}`
        : `${label}: ${values.length} selecionados`;

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border/90 bg-background/70 px-3 text-left text-sm"
        aria-expanded={open}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-50 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl">
          {options.map((option) => {
            const checked = values.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onChange(
                    checked
                      ? values.filter((value) => value !== option.value)
                      : [...values, option.value],
                  )
                }
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-accent"
              >
                <span
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {checked ? <Check className="h-3 w-3" /> : null}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type InquiryFilterPayload = {
  busca: string;
  situacao: string[];
  prioridade: string[];
  gravidade: string[];
  tipo: string[];
  equipe: string[];
  tipificacao: string[];
  autoria: string;
  prazo: string;
  dataInicial: string;
  dataFinal: string;
  dataCampo: string;
  relatorio: string;
  categoria: string;
  status: string;
  elucidado: boolean;
  naoElucidado: boolean;
  reuPreso: boolean;
  reuPresoStrict: boolean;
  medidaProtetiva: boolean;
  diligenciasPendentes: boolean;
};

function deserializeInquiryFilters(raw: Record<string, unknown>): InquiryFilterPayload {
  const multi = (key: string) => {
    const value = raw[key];
    const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    return [
      ...new Set(
        values.map((item) => String(item).trim()).filter((item) => item && item !== "todos"),
      ),
    ];
  };
  const text = (key: string, fallback = "todos") =>
    typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : fallback;
  const flag = (key: string) => raw[key] === true;

  return {
    busca: text("busca", ""),
    situacao: multi("situacao"),
    prioridade: multi("prioridade"),
    gravidade: multi("gravidade"),
    tipo: multi("tipo"),
    equipe: multi("equipe"),
    tipificacao: multi("tipificacao"),
    autoria: text("autoria"),
    prazo: text("prazo"),
    dataInicial: text("dataInicial", ""),
    dataFinal: text("dataFinal", ""),
    dataCampo: text("dataCampo", "entrada"),
    relatorio: text("relatorio"),
    categoria: text("categoria"),
    status: text("status"),
    elucidado: flag("elucidado"),
    naoElucidado: flag("naoElucidado"),
    reuPreso: flag("reuPreso"),
    reuPresoStrict: flag("reuPresoStrict"),
    medidaProtetiva: flag("medidaProtetiva"),
    diligenciasPendentes: flag("diligenciasPendentes"),
  };
}

type InqueritoListRow = {
  source: InqueritoRecord;
  id: string;
  numeroPpe: string;
  tipificacao: string;
  vitima: string;
  prioridade: string;
  gravidade: string;
  tipoProcedimento: string;
  bairro: string;
  situacao: string;
  statusDiligencias: string;
  equipe: string;
  escrivao: string;
  prazo: string;
  investigado: string;
  reuPreso: string;
  custodia: string;
  medidaProtetiva: string;
  diligenciasPendentes: string;
  protetivaTexto: string;
  dataFato: string;
  autoria: string;
  dataInstauracao: string;
  dataEnvioRelatorio: string;
  createdAt: string;
  relatorioEnviado: string;
  elucidado: string;
  motivacao: string;
  fullText: string;
  tagIds: string[];
};

function parseDateToUtc(value: string, endDay: boolean) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d, endDay ? 23 : 0, endDay ? 59 : 0, endDay ? 59 : 0, endDay ? 999 : 0);
}
function parseAnyDate(value?: string) {
  if (!value || value === FALLBACK) return null;
  const raw = value.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(raw);
  if (br) return Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 12, 0, 0, 0);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/u.exec(raw);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0);
}
function isPrazoVencido(prazo: string) {
  return isOperationalDateOverdue(prazo);
}
function isPrazoCritico(prazo: string) {
  return isOperationalDateDueWithin(prazo, 3);
}
function isPrazoVencendo(prazo: string) {
  return isOperationalDateDueWithin(prazo, 7);
}
function isEmpty(value: string) {
  return !value || value === FALLBACK;
}
function isConcluidoAlias(value: string) {
  const n = normalizeText(value).replace(/-/g, " ");
  return [
    "concluido",
    "concluidos",
    "concluida",
    "concluidas",
    "finalizado",
    "finalizada",
    "encerrado",
    "relatado",
  ].includes(n);
}
function isAndamentoAlias(value: string) {
  const n = normalizeText(value).replace(/-/g, " ");
  return ["em andamento", "andamento", "aberto", "aguardando", "pendente"].includes(n);
}
function matchesSituacaoAlias(situacao: string, filter: string) {
  const s = normalizeText(situacao);
  if (isConcluidoAlias(filter))
    return (
      s.includes("conclu") || s.includes("finaliz") || s.includes("encerr") || s.includes("relat")
    );
  if (isAndamentoAlias(filter))
    return (
      s.includes("andamento") || s.includes("abert") || s.includes("aguard") || s.includes("pend")
    );
  return s === normalizeText(filter);
}
function isFalseyLike(value: unknown) {
  const n = normalizeText(String(value ?? "")).replace(/[-_]/g, " ");
  return ["false", "f", "0", "nao", "n", "no", "pendente", "nao elucidado"].includes(n);
}
function hasReuPreso(row: InqueritoListRow) {
  if (typeof row.source.reu_preso_normalizado === "boolean")
    return row.source.reu_preso_normalizado;
  const preso = normalizeText(row.reuPreso);
  const custodia = normalizeText(row.custodia);
  return (
    isTruthyLike(preso) ||
    ["preso", "reu preso", "réu preso", "custodiado"].includes(preso) ||
    custodia.includes("pres")
  );
}
function hasMedidaProtetiva(row: InqueritoListRow) {
  if (typeof row.source.medida_protetiva_normalizada === "boolean")
    return row.source.medida_protetiva_normalizada;
  const direct = normalizeText(row.medidaProtetiva);
  if (isTruthyLike(direct) || ["ativa", "ativo"].includes(direct)) return true;
  return row.protetivaTexto.includes("protetiv");
}
function hasDiligenciasPendentes(value: string) {
  const t = normalizeText(value);
  return Boolean(t) && !["nao", "não", "nenhuma", "sem", "n/a", "na", "false", "0"].includes(t);
}
function getProcedureType(value: string) {
  const text = normalizeText(value);
  if (!text) return "";
  if (text === "ip" || text.includes("inquerito policial")) return "IP";
  if (text === "apf" || text.includes("flagrante")) return "APF";
  if (text === "tco" || text.includes("termo circunstanciado")) return "TCO";
  if (text === "boc" || text.includes("boletim de ocorrencia")) return "BOC";
  if (text === "aiai" || text.includes("ato infracional")) return "AIAI";
  return value.trim();
}
function isSemRelatorio(row: InqueritoListRow) {
  return !hasRelatorioEnviado(row.source);
}
function isConcluidoCentral(row: InqueritoListRow) {
  return hasRelatorioEnviado(row.source);
}
function isEmAndamentoCentral(row: InqueritoListRow) {
  return isInqueritoEmAndamento(row.source);
}
function getCategoryText(row: InqueritoListRow) {
  return normalizeText(
    `${row.source.categoria_criminal ?? ""} ${row.gravidade} ${row.tipificacao} ${row.tipoProcedimento} ${row.motivacao}`,
  );
}
function isCvli(row: InqueritoListRow) {
  return isCvliRecord(row.source);
}
function isPatrimonial(row: InqueritoListRow) {
  return ["patrimonio", "furto", "roubo", "receptacao", "estelionato", "dano"].some((term) =>
    getCategoryText(row).includes(term),
  );
}
function isViolenciaDomestica(row: InqueritoListRow) {
  return ["violencia domestica", "maria da penha"].some((term) =>
    getCategoryText(row).includes(term),
  );
}
function isDrogas(row: InqueritoListRow) {
  return ["drogas", "trafico", "entorpecente"].some((term) => getCategoryText(row).includes(term));
}
function isSexual(row: InqueritoListRow) {
  return ["sexual", "estupro", "importunacao"].some((term) => getCategoryText(row).includes(term));
}
function isMiae(row: InqueritoListRow) {
  return ["miae", "morte por intervencao"].some((term) => getCategoryText(row).includes(term));
}
function isViolento(row: InqueritoListRow) {
  return ["violento", "lesao corporal", "ameaca"].some((term) =>
    getCategoryText(row).includes(term),
  );
}
function isCriancaAdolescente(row: InqueritoListRow) {
  return ["crianca", "adolescente", "eca"].some((term) => getCategoryText(row).includes(term));
}
function isTransito(row: InqueritoListRow) {
  return ["transito", "ctb", "direcao perigosa", "embriaguez"].some((term) =>
    getCategoryText(row).includes(term),
  );
}
function getEntryDate(row: InqueritoListRow) {
  return (
    parseAnyDate(row.dataInstauracao) ?? parseAnyDate(row.createdAt) ?? parseAnyDate(row.dataFato)
  );
}
function getReportDate(row: InqueritoListRow) {
  return parseAnyDate(row.dataEnvioRelatorio);
}
function dateToUtcDay(value: Date | null) {
  if (!value) return null;
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12, 0, 0, 0);
}
function getCvliDate(row: InqueritoListRow) {
  return dateToUtcDay(getCvliReferenceDate(row.source));
}
function getDateByField(row: InqueritoListRow, field: string) {
  const normalized = normalizeText(field);
  if (normalized === "relatorio") return getReportDate(row);
  if (normalized === "cvli") return getCvliDate(row);
  return getEntryDate(row);
}
function matchesCategory(row: InqueritoListRow, category: string) {
  const normalized = normalizeText(category);
  if (normalized === "cvli") return isCvli(row);
  if (normalized === "patrimonial" || normalized === "patrimoniais") return isPatrimonial(row);
  if (normalized === "violencia_domestica" || normalized === "violencia domestica")
    return isViolenciaDomestica(row);
  if (normalized === "drogas") return isDrogas(row);
  if (normalized === "sexual" || normalized === "sexuais") return isSexual(row);
  if (normalized === "miae") return isMiae(row);
  if (normalized === "violento") return isViolento(row);
  if (normalized === "crianca_adolescente" || normalized === "crianca adolescente")
    return isCriancaAdolescente(row);
  if (normalized === "transito") return isTransito(row);
  if (normalized === "outros")
    return (
      !isCvli(row) &&
      !isPatrimonial(row) &&
      !isViolenciaDomestica(row) &&
      !isDrogas(row) &&
      !isSexual(row) &&
      !isMiae(row) &&
      !isViolento(row) &&
      !isCriancaAdolescente(row) &&
      !isTransito(row)
    );
  return true;
}
function priorityToneClass(value: string) {
  const normalized = normalizeText(value);
  if (["alta", "urgente"].includes(normalized)) return priorTone.ALTA;
  if (["media", "média"].includes(normalized)) return priorTone.MÉDIA;
  if (normalized === "baixa") return priorTone.BAIXA;
  return "border-border/70 bg-muted/20 text-muted-foreground";
}
function calculateOperationalPriority(row: InqueritoListRow) {
  return calculateInqueritoOperationalPriority(row as unknown as Record<string, unknown>);
}
function getProcedureShortLabel(value: string) {
  const n = normalizeText(value);
  if (n === "inquerito policial" || n === "ip") return "IP";
  if (n === "tco") return "TCO";
  if (n === "verificacao preliminar" || n === "vp") return "VP";
  if (n === "outros" || n === "outro") return "Outros";
  return value || FALLBACK;
}
function statusToneClass(value: string) {
  if (statusTone[value]) return statusTone[value];
  if (isConcluidoAlias(value)) return statusTone.Concluída;
  if (isAndamentoAlias(value)) return statusTone["Em Andamento"];
  return "border-warning/30 bg-warning/10 text-warning";
}
function formatDatePtBr(ts: number) {
  const date = new Date(ts);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
function formatOptionalDate(value: string) {
  const ts = parseAnyDate(value);
  return ts === null ? FALLBACK : formatDatePtBr(ts);
}
function pluralizeDays(value: number) {
  return value === 1 ? "dia" : "dias";
}
function getPrazoDisplay(prazo: string) {
  const ts = parseAnyDate(prazo);
  if (ts === null)
    return { text: FALLBACK, title: "Prazo não informado", tone: "text-muted-foreground" };
  const dateText = formatDatePtBr(ts);
  const now = new Date();
  const todayTs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0);
  const diffDays = Math.round((ts - todayTs) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    const daysOverdue = Math.abs(diffDays);
    return {
      text: dateText,
      title: `Vencido há ${daysOverdue} ${pluralizeDays(daysOverdue)}. Prazo: ${dateText}`,
      tone: "text-foreground/70",
    };
  }
  const title =
    diffDays === 0
      ? `Vence hoje. Prazo: ${dateText}`
      : `Prazo em ${diffDays} ${pluralizeDays(diffDays)}. Prazo: ${dateText}`;
  return { text: dateText, title, tone: "text-emerald-400/80" };
}

function normalizeInqueritoForList(caso: InqueritoRecord, tagIds: string[] = []): InqueritoListRow {
  const raw = caso as unknown as Record<string, unknown>;
  const fields = Object.values(raw).map((v) => normalizeText(v == null ? "" : String(v)));
  return {
    source: caso,
    id: caso.id,
    numeroPpe: pick(raw, "numero_ppe", "numeroPpe", "ppe"),
    tipificacao: pick(raw, "tipificacao", "classificacao", "tipo_penal"),
    vitima: pick(raw, "vitima", "vítima"),
    prioridade: pick(raw, "prioridade_operacional", "prioridade"),
    gravidade: normalizeCaseCategory(
      pick(raw, "categoria_criminal", "categoria_caso", "categoriaCaso", "gravidade"),
    ),
    tipoProcedimento: pick(
      raw,
      "tipo_procedimento_normalizado",
      "tipo",
      "tipo_procedimento",
      "tipoProcedimento",
      "procedimento",
    ),
    bairro: pick(raw, "bairro", "localidade", "local", "comunidade"),
    situacao: pick(raw, "situacao", "situação", "status"),
    statusDiligencias: pick(raw, "status_diligencias", "statusDiligencias"),
    equipe: pick(raw, "equipe_responsavel", "equipe"),
    escrivao: pick(raw, "escrivao", "escrivao_responsavel", "responsavel", "responsavel_escrivao"),
    prazo: pick(raw, "prazo", "data_prazo"),
    investigado: pick(raw, "investigado", "suspeito", "autor_investigado", "autorInvestigado"),
    reuPreso: pick(raw, "reu_preso", "reuPreso"),
    custodia: pick(raw, "custodia", "situacao_custodia"),
    medidaProtetiva: pick(
      raw,
      "medida_protetiva",
      "medidaProtetiva",
      "medidas_protetivas",
      "medidasProtetivas",
      "protetiva",
    ),
    diligenciasPendentes: pick(raw, "diligencias_pendentes", "diligenciasPendentes"),
    protetivaTexto: [
      pick(raw, "tipo", "tipificacao", "classificacao", "tipo_penal"),
      pick(
        raw,
        "medida_protetiva",
        "medidaProtetiva",
        "medidas_protetivas",
        "medidasProtetivas",
        "protetiva",
      ),
    ]
      .map(normalizeText)
      .join(" "),
    dataFato: pick(raw, "data_fato", "dataFato"),
    autoria: pick(raw, "autoria_determinada", "autoriaDeterminada", "autoria"),
    dataInstauracao: pick(raw, "data_instauracao", "dataInstauracao"),
    dataEnvioRelatorio: pick(raw, "data_relatorio", "data_envio_relatorio", "dataEnvioRelatorio"),
    createdAt: pick(raw, "created_at", "createdAt"),
    relatorioEnviado: pick(raw, "relatorio_status", "relatorio_enviado", "relatorioEnviado"),
    elucidado: pick(raw, "cvli_elucidado", "elucidado"),
    motivacao: pick(raw, "motivacao", "motivação"),
    fullText: fields.join(" "),
    tagIds,
  };
}

function Inqueritos() {
  const navigate = useNavigate();
  const location = useLocation();
  const isInqueritosIndex = location.pathname === "/inqueritos";
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<InqueritoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedInquerito, setSelectedInquerito] = useState<InqueritoRecord | null>(null);
  const [representacoes, setRepresentacoes] = useState<RepresentacaoRecord[]>([]);
  const [proceduralTags, setProceduralTags] = useState<ProceduralTag[]>([]);
  const [tagLinks, setTagLinks] = useState<Array<{ inquerito_id: string; tag_id: string }>>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilterRecord[]>([]);
  const [activeSavedFilterId, setActiveSavedFilterId] = useState("");
  const [activeSavedFilterSnapshot, setActiveSavedFilterSnapshot] = useState("");
  const [showSaveFilterForm, setShowSaveFilterForm] = useState(false);
  const [savedFilterName, setSavedFilterName] = useState("");
  const [saveColumnLayout, setSaveColumnLayout] = useState(false);
  const [savedFilterBusy, setSavedFilterBusy] = useState(false);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const columnController = useTableColumnPreferences(
    "sipi:inqueritos:table-columns:v3",
    INQUIRY_COLUMNS,
    "inqueritos",
  );
  const [situacaoFilter, setSituacaoFilter] = useState<string[]>([]);
  const [prioridadeFilter, setPrioridadeFilter] = useState<string[]>([]);
  const [gravidadeFilter, setGravidadeFilter] = useState<string[]>([]);
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [equipeFilter, setEquipeFilter] = useState<string[]>([]);
  const [tipificacaoFilter, setTipificacaoFilter] = useState<string[]>([]);
  const [autoriaFilter, setAutoriaFilter] = useState("todos");
  const [prazoFilter, setPrazoFilter] = useState("todos");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [dataFieldFilter, setDataFieldFilter] = useState("entrada");
  const [relatorioFilter, setRelatorioFilter] = useState("todos");
  const [categoriaFilter, setCategoriaFilter] = useState("todos");
  const [statusQueryFilter, setStatusQueryFilter] = useState("todos");
  const [elucidadoFilter, setElucidadoFilter] = useState(false);
  const [naoElucidadoFilter, setNaoElucidadoFilter] = useState(false);
  const [reuPresoFilter, setReuPresoFilter] = useState(false);
  const [reuPresoStrictFilter, setReuPresoStrictFilter] = useState(false);
  const [medidaProtetivaFilter, setMedidaProtetivaFilter] = useState(false);
  const [diligenciasPendentesFilter, setDiligenciasPendentesFilter] = useState(false);

  useEffect(() => {
    if (!isInqueritosIndex) return;
    (async () => {
      try {
        setLoading(true);
        const currentProfile = await getCurrentProfile();
        setProfile(currentProfile);
        const [inqueritos, linkedRepresentacoes, loadedTags, loadedTagLinks, loadedSavedFilters] =
          await Promise.all([
            listInqueritos(),
            canViewRepresentacoes(currentProfile)
              ? listRepresentacoes().catch(() => [] as RepresentacaoRecord[])
              : Promise.resolve([] as RepresentacaoRecord[]),
            listProceduralTags(["tipificacao"]).catch(() => [] as ProceduralTag[]),
            listInqueritoTagLinks().catch(
              () => [] as Array<{ inquerito_id: string; tag_id: string }>,
            ),
            listSavedFilters("inqueritos").catch(() => [] as SavedFilterRecord[]),
          ]);
        setRows(inqueritos);
        setProceduralTags(loadedTags);
        setTagLinks(loadedTagLinks);
        setSavedFilters(loadedSavedFilters);
        setRepresentacoes(
          canAccessSigilosa(currentProfile)
            ? linkedRepresentacoes
            : linkedRepresentacoes.filter((item) => !isRepresentacaoSigilosa(item)),
        );
        setError("");
      } catch {
        setError("Não foi possível carregar os procedimentos agora.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isInqueritosIndex]);
  useEffect(() => {
    if (!isInqueritosIndex) return;
    // location.search do roteador e o objeto ja interpretado; aqui queremos a
    // query crua da URL.
    const params = new URLSearchParams(window.location.search);
    const assignMultiple = (key: string, setter: (values: string[]) => void) => {
      const raw = params.get(key);
      if (!raw?.trim()) return;
      setter([
        ...new Set(
          raw
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ]);
    };
    setSearchTerm("");
    setSituacaoFilter([]);
    setPrioridadeFilter([]);
    setGravidadeFilter([]);
    setTipoFilter([]);
    setEquipeFilter([]);
    setTipificacaoFilter([]);
    setAutoriaFilter("todos");
    setPrazoFilter("todos");
    setDataInicial("");
    setDataFinal("");
    setDataFieldFilter("entrada");
    setRelatorioFilter("todos");
    setCategoriaFilter("todos");
    setStatusQueryFilter("todos");
    setElucidadoFilter(false);
    setNaoElucidadoFilter(false);
    setReuPresoFilter(false);
    setReuPresoStrictFilter(false);
    setMedidaProtetivaFilter(false);
    setDiligenciasPendentesFilter(false);
    assignMultiple("prioridade", setPrioridadeFilter);
    assignMultiple("situacao", setSituacaoFilter);
    assignMultiple("gravidade", setGravidadeFilter);
    assignMultiple("equipe", setEquipeFilter);
    assignMultiple("tipificacao", setTipificacaoFilter);
    const tipoParam = params.get("tipo");
    if (tipoParam?.trim())
      setTipoFilter([
        ...new Set(tipoParam.split(",").map((value) => getProcedureType(value) || value)),
      ]);
    const autoria = normalizeText(params.get("autoria") ?? "todos").replace(/-/g, "_");
    if (["todos", "determinada", "desconhecida", "sem_autoria"].includes(autoria))
      setAutoriaFilter(autoria);
    const relatorio = normalizeText(params.get("relatorio") ?? "todos").replace(/-/g, "_");
    if (["todos", "sem_relatar", "enviado", "relatado_nao_enviado"].includes(relatorio))
      setRelatorioFilter(relatorio);
    const categoria = normalizeText(params.get("categoria") ?? "todos").replace(/-/g, "_");
    if (
      [
        "todos",
        "cvli",
        "patrimonial",
        "patrimoniais",
        "violencia_domestica",
        "drogas",
        "sexual",
        "sexuais",
        "miae",
        "violento",
        "crianca_adolescente",
        "transito",
        "outros",
      ].includes(categoria)
    )
      setCategoriaFilter(categoria);
    const dataCampo = normalizeText(params.get("dataCampo") ?? "entrada").replace(/-/g, "_");
    if (["entrada", "relatorio", "cvli"].includes(dataCampo)) setDataFieldFilter(dataCampo);
    const status = normalizeText(params.get("status") ?? "").replace(/-/g, "_");
    if (["em_andamento"].includes(status)) setStatusQueryFilter(status);
    const elucidadoParam = params.get("elucidado") ?? "";
    setElucidadoFilter(isTruthyLike(elucidadoParam));
    setNaoElucidadoFilter(isFalseyLike(elucidadoParam));
    const prazo = normalizeText(params.get("prazo") ?? "");
    if (["critico", "vencido", "vencendo", "7dias", "sem-prazo", "todos"].includes(prazo))
      setPrazoFilter(prazo === "sem-prazo" ? EMPTY_FILTER : prazo === "7dias" ? "vencendo" : prazo);
    const busca = params.get("busca");
    if (busca) setSearchTerm(busca);
    const reuPresoStrict = isTruthyLike(params.get("reu_preso") ?? "");
    setReuPresoStrictFilter(reuPresoStrict);
    setReuPresoFilter(
      reuPresoStrict ||
        isTruthyLike(params.get("reuPreso") ?? "") ||
        isTruthyLike(params.get("custodia") ?? ""),
    );
    setMedidaProtetivaFilter(isTruthyLike(params.get("medidaProtetiva") ?? ""));
    setDiligenciasPendentesFilter(isTruthyLike(params.get("diligenciasPendentes") ?? ""));
    const di = params.get("dataInicial");
    const df = params.get("dataFinal");
    if (di && /^\d{4}-\d{2}-\d{2}$/u.test(di)) setDataInicial(di);
    if (df && /^\d{4}-\d{2}-\d{2}$/u.test(df)) setDataFinal(df);
    setShowFilters(params.size > 0);
    setFiltersInitialized(true);
  }, [isInqueritosIndex, location.search]);

  const visibleRows = useMemo(
    () =>
      !canOnlyViewPublicCases(profile)
        ? rows
        : rows.filter((item) => {
            const raw = item as unknown as Record<string, unknown>;
            const visibility = String(
              raw.visibilidade ?? raw.visibility ?? raw.publico_privado ?? "publico",
            ).toLowerCase();
            return !(visibility.includes("priv") || visibility.includes("sig"));
          }),
    [profile, rows],
  );
  const tagIdsByInquerito = useMemo(() => {
    const mapped = new Map<string, string[]>();
    for (const link of tagLinks) {
      mapped.set(link.inquerito_id, [...(mapped.get(link.inquerito_id) ?? []), link.tag_id]);
    }
    return mapped;
  }, [tagLinks]);
  const normalizedRows = useMemo(
    () =>
      visibleRows.map((record) =>
        normalizeInqueritoForList(record, tagIdsByInquerito.get(record.id) ?? []),
      ),
    [tagIdsByInquerito, visibleRows],
  );
  const linkedRepresentacoes = useMemo(
    () =>
      selectedInquerito
        ? representacoes.filter((item) => item.inquerito_id === selectedInquerito.id)
        : [],
    [representacoes, selectedInquerito],
  );
  const options = (items: string[]) =>
    Array.from(new Set(items.filter((v) => !isEmpty(v)))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  const situacaoOptions = useMemo(
    () =>
      options(
        normalizedRows.map((r) => (r.situacao !== FALLBACK ? r.situacao : r.statusDiligencias)),
      ),
    [normalizedRows],
  );
  const prioridadeOptions = useMemo(
    () => options(normalizedRows.map((r) => calculateOperationalPriority(r))),
    [normalizedRows],
  );
  const gravidadeOptions = useMemo(
    () => options(normalizedRows.map((r) => r.gravidade)),
    [normalizedRows],
  );
  const tipoOptions = useMemo(
    () => options(normalizedRows.map((r) => r.tipoProcedimento)),
    [normalizedRows],
  );
  const equipeOptions = useMemo(
    () => options(normalizedRows.map((r) => r.equipe)),
    [normalizedRows],
  );
  const tipificacaoOptions = useMemo(
    () => tagsByScope(proceduralTags, "tipificacao"),
    [proceduralTags],
  );
  const selectedTipificacaoSlugs = useMemo(
    () =>
      new Set(
        tipificacaoOptions
          .filter((tag) => tipificacaoFilter.includes(tag.id))
          .map((tag) => tag.slug),
      ),
    [tipificacaoFilter, tipificacaoOptions],
  );

  const filtered = useMemo(
    () =>
      normalizedRows.filter((r) => {
        const query = normalizeText(searchTerm);
        const isFallbackSearch = [
          "nao informado",
          "nao informados",
          "vazio",
          "sem informacao",
          "sem valor",
        ].includes(query);
        if (
          query &&
          !(
            r.fullText.includes(query) ||
            (isFallbackSearch &&
              [
                r.numeroPpe,
                r.tipificacao,
                r.vitima,
                r.investigado,
                r.prioridade,
                r.gravidade,
                r.situacao,
                r.statusDiligencias,
                r.prazo,
              ].some(isEmpty))
          )
        )
          return false;
        const situacao = r.situacao !== FALLBACK ? r.situacao : r.statusDiligencias;
        if (
          situacaoFilter.length > 0 &&
          !situacaoFilter.some((filter) =>
            filter === EMPTY_FILTER
              ? isEmpty(situacao)
              : [r.situacao, r.statusDiligencias].some(
                  (value) => !isEmpty(value) && matchesSituacaoAlias(value, filter),
                ),
          )
        )
          return false;
        if (prioridadeFilter.length > 0) {
          const prioridadeOperacional = calculateOperationalPriority(r);
          if (
            !prioridadeFilter.some((filter) =>
              filter === EMPTY_FILTER
                ? isEmpty(prioridadeOperacional)
                : normalizeText(prioridadeOperacional) === normalizeText(filter),
            )
          )
            return false;
        }
        if (
          gravidadeFilter.length > 0 &&
          !gravidadeFilter.some((filter) =>
            filter === EMPTY_FILTER
              ? isEmpty(r.gravidade)
              : normalizeText(r.gravidade) === normalizeText(filter),
          )
        )
          return false;
        if (
          tipoFilter.length > 0 &&
          !tipoFilter.some((filter) =>
            filter === EMPTY_FILTER
              ? isEmpty(r.tipoProcedimento)
              : getProcedureType(r.tipoProcedimento) === getProcedureType(filter),
          )
        )
          return false;
        if (
          equipeFilter.length > 0 &&
          !equipeFilter.some((filter) =>
            filter === EMPTY_FILTER
              ? isEmpty(r.equipe)
              : normalizeText(r.equipe) === normalizeText(filter),
          )
        )
          return false;
        if (tipificacaoFilter.length > 0) {
          const linkedMatch = tipificacaoFilter.some((tagId) => r.tagIds.includes(tagId));
          const parsedSlugs = new Set(
            parseTipificacoes(
              r.tipificacao,
              tipificacaoOptions.map((tag) => tag.name),
            ).map((item) => item.slug),
          );
          const textMatch = [...selectedTipificacaoSlugs].some((slug) => parsedSlugs.has(slug));
          if (!linkedMatch && !textMatch) return false;
        }
        if (
          normalizeText(autoriaFilter) !== "todos" &&
          classifyAuthorship(r.autoria) !== autoriaFilter
        )
          return false;
        if (normalizeText(categoriaFilter) !== "todos" && !matchesCategory(r, categoriaFilter))
          return false;
        if (normalizeText(relatorioFilter) === "sem_relatar" && !isSemRelatorio(r)) return false;
        if (normalizeText(relatorioFilter) === "enviado" && !isConcluidoCentral(r)) return false;
        if (
          normalizeText(relatorioFilter) === "relatado_nao_enviado" &&
          !isRelatadoNaoEnviado(r.source)
        )
          return false;
        if (normalizeText(statusQueryFilter) === "em_andamento" && !isEmAndamentoCentral(r))
          return false;
        if (elucidadoFilter && !isCvliElucidado(r.source)) return false;
        if (naoElucidadoFilter && isCvliElucidado(r.source)) return false;
        if (normalizeText(prazoFilter) !== "todos") {
          if (prazoFilter === EMPTY_FILTER && !isEmpty(r.prazo)) return false;
          if (prazoFilter === "vencido" && !isPrazoVencido(r.prazo)) return false;
          if (prazoFilter === "critico" && !isPrazoCritico(r.prazo)) return false;
          if (prazoFilter === "vencendo" && !isPrazoVencendo(r.prazo)) return false;
        }
        if (reuPresoFilter && !(reuPresoStrictFilter ? isTruthyLike(r.reuPreso) : hasReuPreso(r)))
          return false;
        if (medidaProtetivaFilter && !hasMedidaProtetiva(r)) return false;
        if (diligenciasPendentesFilter && !hasDiligenciasPendentes(r.diligenciasPendentes))
          return false;
        const hasDateFilter = Boolean(dataInicial || dataFinal);
        if (hasDateFilter) {
          const ts = getDateByField(r, dataFieldFilter);
          if (ts === null) return false;
          const start = parseDateToUtc(dataInicial, false);
          const end = parseDateToUtc(dataFinal, true);
          if (start !== null && ts < start) return false;
          if (end !== null && ts > end) return false;
        }
        return true;
      }),
    [
      normalizedRows,
      searchTerm,
      situacaoFilter,
      prioridadeFilter,
      gravidadeFilter,
      tipoFilter,
      equipeFilter,
      tipificacaoFilter,
      tipificacaoOptions,
      selectedTipificacaoSlugs,
      autoriaFilter,
      prazoFilter,
      dataInicial,
      dataFinal,
      dataFieldFilter,
      relatorioFilter,
      categoriaFilter,
      statusQueryFilter,
      elucidadoFilter,
      naoElucidadoFilter,
      reuPresoFilter,
      reuPresoStrictFilter,
      medidaProtetivaFilter,
      diligenciasPendentesFilter,
    ],
  );

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    situacaoFilter.length ||
    prioridadeFilter.length ||
    gravidadeFilter.length ||
    tipoFilter.length ||
    equipeFilter.length ||
    tipificacaoFilter.length ||
    [autoriaFilter, prazoFilter, relatorioFilter, categoriaFilter, statusQueryFilter].some(
      (filter) => normalizeText(filter) !== "todos",
    ) ||
    dataInicial ||
    dataFinal ||
    elucidadoFilter ||
    naoElucidadoFilter ||
    reuPresoFilter ||
    medidaProtetivaFilter ||
    diligenciasPendentesFilter,
  );
  const currentFilterPayload = useMemo<InquiryFilterPayload>(
    () => ({
      busca: searchTerm,
      situacao: situacaoFilter,
      prioridade: prioridadeFilter,
      gravidade: gravidadeFilter,
      tipo: tipoFilter,
      equipe: equipeFilter,
      tipificacao: tipificacaoFilter,
      autoria: autoriaFilter,
      prazo: prazoFilter,
      dataInicial,
      dataFinal,
      dataCampo: dataFieldFilter,
      relatorio: relatorioFilter,
      categoria: categoriaFilter,
      status: statusQueryFilter,
      elucidado: elucidadoFilter,
      naoElucidado: naoElucidadoFilter,
      reuPreso: reuPresoFilter,
      reuPresoStrict: reuPresoStrictFilter,
      medidaProtetiva: medidaProtetivaFilter,
      diligenciasPendentes: diligenciasPendentesFilter,
    }),
    [
      autoriaFilter,
      categoriaFilter,
      dataFieldFilter,
      dataFinal,
      dataInicial,
      diligenciasPendentesFilter,
      elucidadoFilter,
      equipeFilter,
      gravidadeFilter,
      medidaProtetivaFilter,
      naoElucidadoFilter,
      prazoFilter,
      prioridadeFilter,
      relatorioFilter,
      reuPresoFilter,
      reuPresoStrictFilter,
      searchTerm,
      situacaoFilter,
      statusQueryFilter,
      tipoFilter,
      tipificacaoFilter,
    ],
  );

  const applyInquiryFilterPayload = (raw: Record<string, unknown>) => {
    const next = deserializeInquiryFilters(raw);
    setSearchTerm(next.busca);
    setSituacaoFilter(next.situacao);
    setPrioridadeFilter(next.prioridade);
    setGravidadeFilter(next.gravidade);
    setTipoFilter(next.tipo);
    setEquipeFilter(next.equipe);
    setTipificacaoFilter(next.tipificacao);
    setAutoriaFilter(next.autoria);
    setPrazoFilter(next.prazo);
    setDataInicial(next.dataInicial);
    setDataFinal(next.dataFinal);
    setDataFieldFilter(next.dataCampo);
    setRelatorioFilter(next.relatorio);
    setCategoriaFilter(next.categoria);
    setStatusQueryFilter(next.status);
    setElucidadoFilter(next.elucidado);
    setNaoElucidadoFilter(next.naoElucidado);
    setReuPresoFilter(next.reuPreso);
    setReuPresoStrictFilter(next.reuPresoStrict);
    setMedidaProtetivaFilter(next.medidaProtetiva);
    setDiligenciasPendentesFilter(next.diligenciasPendentes);
    setShowFilters(true);
    return next;
  };

  useEffect(() => {
    if (!filtersInitialized || !isInqueritosIndex) return;
    const params = new URLSearchParams();
    const setText = (key: string, value: string, defaultValue = "") => {
      if (value && value !== defaultValue && value !== "todos") params.set(key, value);
    };
    const setMulti = (key: string, values: string[]) => {
      if (values.length) params.set(key, values.join(","));
    };
    setText("busca", currentFilterPayload.busca);
    setMulti("situacao", currentFilterPayload.situacao);
    setMulti("prioridade", currentFilterPayload.prioridade);
    setMulti("gravidade", currentFilterPayload.gravidade);
    setMulti("tipo", currentFilterPayload.tipo);
    setMulti("equipe", currentFilterPayload.equipe);
    setMulti("tipificacao", currentFilterPayload.tipificacao);
    setText("autoria", currentFilterPayload.autoria, "todos");
    setText("prazo", currentFilterPayload.prazo, "todos");
    setText("dataInicial", currentFilterPayload.dataInicial);
    setText("dataFinal", currentFilterPayload.dataFinal);
    setText("dataCampo", currentFilterPayload.dataCampo, "entrada");
    setText("relatorio", currentFilterPayload.relatorio, "todos");
    setText("categoria", currentFilterPayload.categoria, "todos");
    setText("status", currentFilterPayload.status, "todos");
    if (currentFilterPayload.elucidado) params.set("elucidado", "1");
    if (currentFilterPayload.naoElucidado) params.set("elucidado", "0");
    if (currentFilterPayload.reuPreso) params.set("reuPreso", "1");
    if (currentFilterPayload.reuPresoStrict) params.set("reu_preso", "1");
    if (currentFilterPayload.medidaProtetiva) params.set("medidaProtetiva", "1");
    if (currentFilterPayload.diligenciasPendentes) params.set("diligenciasPendentes", "1");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [currentFilterPayload, filtersInitialized, isInqueritosIndex]);

  const activeSavedFilter = savedFilters.find((item) => item.id === activeSavedFilterId) ?? null;
  const activeSavedFilterDirty = Boolean(
    activeSavedFilterId &&
    activeSavedFilterSnapshot &&
    JSON.stringify(currentFilterPayload) !== activeSavedFilterSnapshot,
  );

  const applySavedFilter = (record: SavedFilterRecord) => {
    const normalized = applyInquiryFilterPayload(record.filters);
    if (record.columns?.length) columnController.apply(record.columns);
    setActiveSavedFilterId(record.id);
    setActiveSavedFilterSnapshot(JSON.stringify(normalized));
  };

  const handleSaveCurrentFilter = async () => {
    const name = savedFilterName.trim();
    if (name.length < 2) {
      setError("Informe um nome com pelo menos 2 caracteres para o filtro.");
      return;
    }
    setSavedFilterBusy(true);
    setError("");
    try {
      const existing = savedFilters.find(
        (item) => normalizeText(item.name) === normalizeText(name),
      );
      const columns = saveColumnLayout ? columnController.preferences : null;
      let saved: SavedFilterRecord;
      if (existing) {
        if (!window.confirm(`O filtro “${existing.name}” já existe. Deseja substituí-lo?`)) return;
        saved = await updateSavedFilter(existing.id, { filters: currentFilterPayload, columns });
      } else {
        saved = await createSavedFilter({
          scope: "inqueritos",
          name,
          filters: currentFilterPayload,
          columns,
        });
      }
      setSavedFilters((current) =>
        [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR"),
        ),
      );
      setActiveSavedFilterId(saved.id);
      setActiveSavedFilterSnapshot(JSON.stringify(currentFilterPayload));
      setShowSaveFilterForm(false);
      setSavedFilterName("");
      setSaveColumnLayout(false);
    } catch {
      setError("Não foi possível salvar o filtro. Verifique se o nome já está em uso.");
    } finally {
      setSavedFilterBusy(false);
    }
  };

  const handleUpdateActiveFilter = async () => {
    if (!activeSavedFilter) return;
    setSavedFilterBusy(true);
    try {
      const updated = await updateSavedFilter(activeSavedFilter.id, {
        filters: currentFilterPayload,
        columns: activeSavedFilter.columns === null ? null : columnController.preferences,
      });
      setSavedFilters((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setActiveSavedFilterSnapshot(JSON.stringify(currentFilterPayload));
    } catch {
      setError("Não foi possível atualizar o filtro salvo.");
    } finally {
      setSavedFilterBusy(false);
    }
  };

  const handleRenameActiveFilter = async () => {
    if (!activeSavedFilter) return;
    const name = window.prompt("Novo nome do filtro:", activeSavedFilter.name)?.trim();
    if (!name || name.length < 2 || name === activeSavedFilter.name) return;
    try {
      const updated = await renameSavedFilter(activeSavedFilter.id, name);
      setSavedFilters((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
    } catch {
      setError("Não foi possível renomear. Talvez esse nome já esteja em uso.");
    }
  };

  const handleDeleteActiveFilter = async () => {
    if (
      !activeSavedFilter ||
      !window.confirm(`Excluir definitivamente o filtro “${activeSavedFilter.name}”?`)
    )
      return;
    try {
      await deleteSavedFilter(activeSavedFilter.id);
      setSavedFilters((current) => current.filter((item) => item.id !== activeSavedFilter.id));
      setActiveSavedFilterId("");
      setActiveSavedFilterSnapshot("");
    } catch {
      setError("Não foi possível excluir o filtro salvo.");
    }
  };
  const visibleInquiryColumns = columnController.visibleColumns;
  const printGeneratedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(new Date()),
    [],
  );
  const printFilters = useMemo(() => {
    const result: Array<{ label: string; value: string }> = [];
    const pushMulti = (label: string, values: string[], resolve?: (value: string) => string) => {
      if (values.length)
        result.push({ label, value: values.map((value) => resolve?.(value) ?? value).join("; ") });
    };
    if (searchTerm.trim()) result.push({ label: "Busca", value: searchTerm.trim() });
    pushMulti("Status", situacaoFilter);
    pushMulti("Prioridade", prioridadeFilter);
    pushMulti("Gravidade", gravidadeFilter);
    pushMulti("Tipo", tipoFilter);
    pushMulti("Equipe", equipeFilter);
    pushMulti("Tipificação", tipificacaoFilter, (id) => {
      if (id === EMPTY_FILTER) return "Não informada";
      return tipificacaoOptions.find((tag) => tag.id === id)?.name ?? id;
    });
    if (autoriaFilter !== "todos")
      result.push({ label: "Autoria", value: autoriaFilter.replaceAll("_", " ") });
    if (prazoFilter !== "todos") result.push({ label: "Prazo", value: prazoFilter });
    if (dataInicial || dataFinal)
      result.push({
        label: "Período",
        value: `${dataInicial || "início"} a ${dataFinal || "hoje"}`,
      });
    if (relatorioFilter !== "todos")
      result.push({ label: "Relatório", value: relatorioFilter.replaceAll("_", " ") });
    if (categoriaFilter !== "todos") result.push({ label: "Categoria", value: categoriaFilter });
    if (statusQueryFilter !== "todos")
      result.push({ label: "Estágio", value: statusQueryFilter.replaceAll("_", " ") });
    if (elucidadoFilter) result.push({ label: "Elucidação", value: "Elucidado" });
    if (naoElucidadoFilter) result.push({ label: "Elucidação", value: "Não elucidado" });
    if (reuPresoFilter) result.push({ label: "Réu preso", value: "Sim" });
    if (medidaProtetivaFilter) result.push({ label: "Medida protetiva", value: "Sim" });
    if (diligenciasPendentesFilter) result.push({ label: "Diligências pendentes", value: "Sim" });
    return result;
  }, [
    autoriaFilter,
    categoriaFilter,
    dataFinal,
    dataInicial,
    diligenciasPendentesFilter,
    elucidadoFilter,
    equipeFilter,
    gravidadeFilter,
    medidaProtetivaFilter,
    naoElucidadoFilter,
    prazoFilter,
    prioridadeFilter,
    relatorioFilter,
    reuPresoFilter,
    searchTerm,
    situacaoFilter,
    statusQueryFilter,
    tipoFilter,
    tipificacaoFilter,
    tipificacaoOptions,
  ]);
  const printRows = useMemo(
    () =>
      filtered.map((row) =>
        visibleInquiryColumns.map((column) => {
          const situation = row.situacao !== FALLBACK ? row.situacao : row.statusDiligencias;
          const values: Record<string, string> = {
            ppe: row.numeroPpe || FALLBACK,
            prioridade: calculateOperationalPriority(row) || FALLBACK,
            tipificacao: row.tipificacao || FALLBACK,
            gravidade: row.gravidade || FALLBACK,
            tipo: getProcedureType(row.tipoProcedimento) || FALLBACK,
            data_fato: formatOptionalDate(row.dataFato),
            autoria: getAuthorshipLabel(row.autoria),
            bairro: row.bairro || FALLBACK,
            reu_preso: hasReuPreso(row) ? "Sim" : "Não",
            status: situation || FALLBACK,
            prazo: getPrazoDisplay(row.prazo).text,
            acao: "Abrir",
          };
          return values[column.id] ?? FALLBACK;
        }),
      ),
    [filtered, visibleInquiryColumns],
  );
  // Treat the saved widths as proportions while there is enough horizontal
  // room. This keeps every selected column inside the panel instead of making
  // the right side of the table disappear when optional columns are enabled.
  const tableGridTemplate = visibleInquiryColumns
    .map((column) => `minmax(0, ${column.width}fr)`)
    .join(" ");
  const tableMinWidth = Math.max(840, visibleInquiryColumns.length * 76);
  const getInquiryColumnStyle = (id: string) => {
    const index = visibleInquiryColumns.findIndex((column) => column.id === id);
    return index < 0 ? ({ display: "none" } as const) : ({ order: index } as const);
  };
  if (!isInqueritosIndex) return <Outlet />;

  return (
    <AppLayout>
      <div className="sipi-print-document space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.015)] lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black tracking-tight">Procedimentos Policiais</h1>
            <p className="text-sm text-muted-foreground">
              {filtered.length} de {visibleRows.length} caso(s) encontrado(s)
            </p>
          </div>
          <div className="sipi-print-hidden flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/15"
              onClick={() => window.setTimeout(() => window.print(), 0)}
            >
              <FileDown className="h-4 w-4" /> Exportar PDF
            </button>
            {canCreateCases(profile) ? (
              <button
                className="hidden items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 md:inline-flex"
                onClick={() => navigate({ to: "/novo-caso" })}
              >
                <Plus className="h-4 w-4" /> Novo procedimento
              </button>
            ) : null}
          </div>
        </header>
        <section className="rounded-2xl border border-border/80 bg-card/70 p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Buscar por PPE, vítima, suspeito, observações, diligências, relatório..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 w-full rounded-xl border border-border/90 bg-background/70 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground/80 focus:border-primary/50"
              />
            </div>
            <button
              onClick={() => setShowFilters((p) => !p)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-4 text-sm font-medium transition hover:bg-accent"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? "Ocultar filtros" : "Filtros"}
            </button>
            <TableColumnSettings definitions={INQUIRY_COLUMNS} controller={columnController} />
          </div>
          {showFilters && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 md:col-span-4 md:flex-row md:items-center">
                <select
                  value={activeSavedFilterId}
                  onChange={(event) => {
                    const selected = savedFilters.find((item) => item.id === event.target.value);
                    if (selected) applySavedFilter(selected);
                    else {
                      setActiveSavedFilterId("");
                      setActiveSavedFilterSnapshot("");
                    }
                  }}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm md:max-w-sm"
                >
                  <option value="">Filtros salvos</option>
                  {savedFilters.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowSaveFilterForm((current) => !current)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary/40 px-3 text-xs font-bold text-primary hover:bg-primary/10"
                >
                  <Save className="h-4 w-4" /> Salvar filtro atual
                </button>
                {activeSavedFilter ? (
                  <>
                    {activeSavedFilterDirty ? (
                      <button
                        type="button"
                        disabled={savedFilterBusy}
                        onClick={() => void handleUpdateActiveFilter()}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-500/15 px-3 text-xs font-bold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                      >
                        Atualizar filtro salvo
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleRenameActiveFilter()}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:text-primary"
                      title="Renomear filtro"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteActiveFilter()}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10"
                      title="Excluir filtro"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
              </div>
              {activeSavedFilterDirty ? (
                <p className="text-xs font-medium text-amber-300 md:col-span-4">
                  Esta consulta foi alterada depois de carregar o filtro salvo.
                </p>
              ) : null}
              {showSaveFilterForm ? (
                <div className="grid gap-3 rounded-xl border border-border bg-background/60 p-3 md:col-span-4 md:grid-cols-[minmax(220px,1fr)_auto_auto] md:items-center">
                  <input
                    value={savedFilterName}
                    onChange={(event) => setSavedFilterName(event.target.value)}
                    maxLength={80}
                    placeholder="Nome do filtro — ex.: APF pendente de laudo"
                    className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={saveColumnLayout}
                      onChange={(event) => setSaveColumnLayout(event.target.checked)}
                    />
                    Salvar também a organização das colunas
                  </label>
                  <button
                    type="button"
                    disabled={savedFilterBusy}
                    onClick={() => void handleSaveCurrentFilter()}
                    className="h-10 rounded-lg bg-primary px-4 text-xs font-black text-primary-foreground disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                </div>
              ) : null}
              <MultiSelectFilter
                label="Status"
                values={situacaoFilter}
                onChange={setSituacaoFilter}
                options={[
                  { value: EMPTY_FILTER, label: "Não informado" },
                  ...situacaoOptions.map((value) => ({ value, label: value })),
                ]}
              />
              <MultiSelectFilter
                label="Prioridade"
                values={prioridadeFilter}
                onChange={setPrioridadeFilter}
                options={[
                  { value: EMPTY_FILTER, label: "Não informada" },
                  ...prioridadeOptions.map((value) => ({ value, label: value })),
                ]}
              />
              <MultiSelectFilter
                label="Gravidade"
                values={gravidadeFilter}
                onChange={setGravidadeFilter}
                options={[
                  { value: EMPTY_FILTER, label: "Não informada" },
                  ...gravidadeOptions.map((value) => ({ value, label: value })),
                ]}
              />
              <MultiSelectFilter
                label="Tipo"
                values={tipoFilter}
                onChange={setTipoFilter}
                options={[
                  { value: EMPTY_FILTER, label: "Não informado" },
                  ...tipoOptions.map((value) => ({ value, label: value })),
                ]}
              />
              <MultiSelectFilter
                label="Equipe"
                values={equipeFilter}
                onChange={setEquipeFilter}
                options={[
                  { value: EMPTY_FILTER, label: "Não informada" },
                  ...equipeOptions.map((value) => ({ value, label: value })),
                ]}
              />
              <MultiSelectFilter
                label="Tipificação"
                values={tipificacaoFilter}
                onChange={setTipificacaoFilter}
                options={tipificacaoOptions.map((tag) => ({ value: tag.id, label: tag.name }))}
              />
              <select
                value={prazoFilter}
                onChange={(e) => setPrazoFilter(e.target.value)}
                className="h-11 rounded-xl border border-border/90 bg-background/70 px-3 text-sm"
              >
                <option value="todos">Prazo: todos</option>
                <option value="critico">Prazo crítico</option>
                <option value="vencido">Vencidos</option>
                <option value="vencendo">Vencendo em até 7 dias</option>
                <option value={EMPTY_FILTER}>Sem prazo</option>
              </select>
              <select
                value={autoriaFilter}
                onChange={(e) => setAutoriaFilter(e.target.value)}
                className="h-11 rounded-xl border border-border/90 bg-background/70 px-3 text-sm"
              >
                <option value="todos">Autoria: todas</option>
                <option value="determinada">Autoria determinada</option>
                <option value="desconhecida">Autoria desconhecida</option>
                <option value="sem_autoria">Sem autoria</option>
              </select>
              <input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="h-11 rounded-xl border border-border/90 bg-background/70 px-3 text-sm"
              />
              <input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="h-11 rounded-xl border border-border/90 bg-background/70 px-3 text-sm"
              />
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSituacaoFilter([]);
                    setPrioridadeFilter([]);
                    setGravidadeFilter([]);
                    setTipoFilter([]);
                    setEquipeFilter([]);
                    setTipificacaoFilter([]);
                    setAutoriaFilter("todos");
                    setPrazoFilter("todos");
                    setDataInicial("");
                    setDataFinal("");
                    setDataFieldFilter("entrada");
                    setRelatorioFilter("todos");
                    setCategoriaFilter("todos");
                    setStatusQueryFilter("todos");
                    setElucidadoFilter(false);
                    setNaoElucidadoFilter(false);
                    setReuPresoFilter(false);
                    setReuPresoStrictFilter(false);
                    setMedidaProtetivaFilter(false);
                    setDiligenciasPendentesFilter(false);
                    navigate({ to: "/inqueritos" });
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background/70 px-3 text-sm font-medium transition hover:bg-accent md:col-span-4"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </section>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/90 shadow-[0_10px_40px_rgba(0,0,0,0.22)]">
          <table className="w-full table-fixed text-sm" style={{ minWidth: tableMinWidth }}>
            <thead className="bg-muted/25 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr className="grid" style={{ gridTemplateColumns: tableGridTemplate }}>
                {columnController.visibleColumns.map((column) => (
                  <th
                    key={column.id}
                    className={`px-3 py-2.5 font-bold align-middle ${
                      column.align === "center"
                        ? "text-center"
                        : column.align === "right"
                          ? "text-right"
                          : "text-left"
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr className="grid" style={{ gridTemplateColumns: tableGridTemplate }}>
                  <td
                    colSpan={columnController.visibleColumns.length}
                    className="px-4 py-8 text-center text-muted-foreground"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    Nenhum procedimento encontrado para os filtros informados.
                  </td>
                </tr>
              )}
              {filtered.map((row) => {
                const situacao = row.situacao !== FALLBACK ? row.situacao : row.statusDiligencias;
                const prazoVencido = isPrazoVencido(row.prazo);
                const prazoDisplay = getPrazoDisplay(row.prazo);
                const reuPreso = hasReuPreso(row);
                const numeroPpe = row.numeroPpe || FALLBACK;
                const tipificacao = row.tipificacao || FALLBACK;
                const gravidade = row.gravidade || FALLBACK;
                const tipoProcedimento = row.tipoProcedimento || FALLBACK;
                const tipoProcedimentoLabel = getProcedureShortLabel(tipoProcedimento);
                const prioridadeOperacional = calculateOperationalPriority(row);
                const bairro = row.bairro || FALLBACK;
                const statusTexto = situacao || FALLBACK;
                return (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Visualizar resumo do procedimento ${numeroPpe}`}
                    onClick={() => setSelectedInquerito(row.source)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedInquerito(row.source);
                      }
                    }}
                    className="grid cursor-pointer border-t border-border/70 align-middle transition hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
                    style={{ gridTemplateColumns: tableGridTemplate }}
                  >
                    <td className="px-3 py-2.5 align-middle" style={getInquiryColumnStyle("ppe")}>
                      <p
                        className="truncate font-mono text-[14px] font-bold leading-5 text-primary drop-shadow-[0_0_8px_rgba(34,197,94,0.16)]"
                        title={numeroPpe}
                      >
                        {numeroPpe}
                      </p>
                    </td>
                    <td
                      className="px-2.5 py-2.5 align-middle"
                      style={getInquiryColumnStyle("prioridade")}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPrioridadeFilter([prioridadeOperacional || EMPTY_FILTER]);
                        }}
                        className={`inline-flex min-h-6 max-w-full items-center justify-center rounded border px-2 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide ${priorityToneClass(prioridadeOperacional)}`}
                        title="Prioridade operacional calculada para exibição"
                      >
                        {prioridadeOperacional}
                      </button>
                    </td>
                    <td
                      className="px-2.5 py-2.5 align-middle"
                      style={getInquiryColumnStyle("tipificacao")}
                    >
                      <button
                        type="button"
                        className="block max-w-full truncate text-left text-[13px] font-semibold leading-5 text-foreground/95"
                        title={tipificacao}
                      >
                        {tipificacao}
                      </button>
                    </td>
                    <td
                      className="px-2 py-2.5 text-center align-middle"
                      style={getInquiryColumnStyle("gravidade")}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setGravidadeFilter([
                            isEmpty(row.gravidade) ? EMPTY_FILTER : row.gravidade,
                          ]);
                        }}
                        className="mx-auto block max-w-full truncate text-center text-xs font-medium leading-5 text-muted-foreground hover:text-foreground/80"
                        title={gravidade}
                      >
                        {gravidade}
                      </button>
                    </td>
                    <td
                      className="px-2 py-2.5 text-center align-middle"
                      style={getInquiryColumnStyle("tipo")}
                    >
                      <span
                        className="mx-auto block max-w-full truncate text-center font-mono text-[12px] font-semibold text-foreground/90"
                        title={tipoProcedimento}
                      >
                        {tipoProcedimentoLabel}
                      </span>
                    </td>
                    <td
                      className="px-2 py-2.5 text-center align-middle"
                      style={getInquiryColumnStyle("data_fato")}
                    >
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatOptionalDate(row.dataFato)}
                      </span>
                    </td>
                    <td
                      className="px-2 py-2.5 text-center align-middle"
                      style={getInquiryColumnStyle("autoria")}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const category = classifyAuthorship(row.autoria);
                          if (category !== "nao_informada") setAutoriaFilter(category);
                        }}
                        className="mx-auto block max-w-full truncate text-center text-xs font-medium text-muted-foreground hover:text-foreground"
                        title={getAuthorshipLabel(row.autoria)}
                      >
                        {getAuthorshipLabel(row.autoria)}
                      </button>
                    </td>
                    <td
                      className="px-2.5 py-2.5 align-middle"
                      style={getInquiryColumnStyle("bairro")}
                    >
                      <span
                        className="block w-full truncate text-left text-xs leading-5 text-muted-foreground"
                        title={bairro}
                      >
                        {bairro}
                      </span>
                    </td>
                    <td
                      className="px-2.5 py-2.5 text-center align-middle"
                      style={getInquiryColumnStyle("reu_preso")}
                    >
                      {reuPreso ? (
                        <span className="inline-flex min-h-6 items-center justify-center rounded border border-destructive/35 bg-destructive/15 px-2 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide text-destructive">
                          SIM
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{FALLBACK}</span>
                      )}
                    </td>
                    <td
                      className="px-2.5 py-2.5 text-center align-middle"
                      style={getInquiryColumnStyle("status")}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSituacaoFilter([situacao || EMPTY_FILTER]);
                        }}
                        className={`inline-flex min-h-6 max-w-full items-center justify-center overflow-hidden rounded border px-2 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide ${statusToneClass(situacao)}`}
                        title={statusTexto}
                      >
                        <span className="block max-w-full truncate whitespace-nowrap">
                          {statusTexto}
                        </span>
                      </button>
                    </td>
                    <td
                      className="px-2.5 py-2.5 text-right align-middle"
                      style={getInquiryColumnStyle("prazo")}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPrazoFilter(prazoVencido ? "vencido" : "critico");
                        }}
                        className={`inline-flex max-w-full items-center justify-center truncate whitespace-nowrap rounded px-1 py-0.5 text-[13px] font-medium tabular-nums ${prazoDisplay.tone}`}
                        title={prazoDisplay.title}
                      >
                        {prazoDisplay.text}
                      </button>
                    </td>
                    <td
                      className="px-3 py-2.5 text-center align-middle"
                      style={getInquiryColumnStyle("acao")}
                    >
                      <button
                        className="inline-flex min-h-8 items-center justify-center rounded-lg border border-info/40 bg-info/15 px-3 py-1.5 text-xs font-semibold text-info transition hover:bg-info/25 hover:text-info/90"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedInquerito(row.source);
                        }}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <SipiPrintList
          documentTitle="Procedimentos Policiais"
          documentSubtitle="Consulta filtrada da relação de procedimentos"
          filtrosAplicados={printFilters}
          columns={visibleInquiryColumns.map((column) => ({
            id: column.id,
            label: column.label,
            align: column.align,
          }))}
          rows={printRows}
          total={filtered.length}
          geradoEm={printGeneratedAt}
          geradoPor={profile?.nome || profile?.email || "Usuário autenticado"}
        />
      </div>
      <InqueritoQuickPreview
        record={selectedInquerito}
        linkedRepresentations={linkedRepresentacoes}
        onClose={() => setSelectedInquerito(null)}
        onOpenFull={() => {
          if (!selectedInquerito) return;
          navigate({
            to: "/inqueritos/$caseId",
            params: { caseId: selectedInquerito.id },
          });
        }}
      />
    </AppLayout>
  );
}
