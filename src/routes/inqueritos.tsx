import { Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { InqueritoQuickPreview } from "@/components/RecordQuickPreview";
import {
  TableColumnSettings,
  useTableColumnPreferences,
  type TableColumnDefinition,
} from "@/components/TableColumnSettings";
import { Search, Filter, Plus } from "lucide-react";
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

function normalizeInqueritoForList(caso: InqueritoRecord): InqueritoListRow {
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
  const [showFilters, setShowFilters] = useState(false);
  const columnController = useTableColumnPreferences(
    "sipi:inqueritos:table-columns:v3",
    INQUIRY_COLUMNS,
  );
  const [situacaoFilter, setSituacaoFilter] = useState("todos");
  const [prioridadeFilter, setPrioridadeFilter] = useState("todos");
  const [gravidadeFilter, setGravidadeFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
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
        const [inqueritos, linkedRepresentacoes] = await Promise.all([
          listInqueritos(),
          canViewRepresentacoes(currentProfile)
            ? listRepresentacoes().catch(() => [] as RepresentacaoRecord[])
            : Promise.resolve([] as RepresentacaoRecord[]),
        ]);
        setRows(inqueritos);
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
    const assign = (key: string, setter: (v: string) => void, allowed?: Set<string>) => {
      const v = params.get(key);
      if (!v) return;
      const n = normalizeText(v);
      if (!n) return;
      if (allowed && !allowed.has(n)) return;
      setter(v);
    };
    setSearchTerm("");
    setSituacaoFilter("todos");
    setPrioridadeFilter("todos");
    setGravidadeFilter("todos");
    setTipoFilter("todos");
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
    assign("prioridade", setPrioridadeFilter);
    assign("situacao", setSituacaoFilter);
    assign("gravidade", setGravidadeFilter);
    const tipoParam = params.get("tipo");
    if (tipoParam?.trim()) setTipoFilter(getProcedureType(tipoParam) || tipoParam);
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
  const normalizedRows = useMemo(
    () => visibleRows.map((r) => normalizeInqueritoForList(r)),
    [visibleRows],
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
        const situacao = isConcluidoAlias(situacaoFilter)
          ? ([r.situacao, r.statusDiligencias].find(
              (v) => !isEmpty(v) && matchesSituacaoAlias(v, situacaoFilter),
            ) ?? (r.situacao !== FALLBACK ? r.situacao : r.statusDiligencias))
          : r.situacao !== FALLBACK
            ? r.situacao
            : r.statusDiligencias;
        if (
          normalizeText(situacaoFilter) !== "todos" &&
          !(situacaoFilter === EMPTY_FILTER
            ? isEmpty(situacao)
            : matchesSituacaoAlias(situacao, situacaoFilter))
        )
          return false;
        if (normalizeText(prioridadeFilter) !== "todos") {
          const prioridadeOperacional = calculateOperationalPriority(r);
          if (
            !(prioridadeFilter === EMPTY_FILTER
              ? isEmpty(prioridadeOperacional)
              : normalizeText(prioridadeOperacional) === normalizeText(prioridadeFilter))
          )
            return false;
        }
        if (
          normalizeText(gravidadeFilter) !== "todos" &&
          !(gravidadeFilter === EMPTY_FILTER
            ? isEmpty(r.gravidade)
            : normalizeText(r.gravidade) === normalizeText(gravidadeFilter))
        )
          return false;
        if (
          normalizeText(tipoFilter) !== "todos" &&
          !(tipoFilter === EMPTY_FILTER
            ? isEmpty(r.tipoProcedimento)
            : getProcedureType(r.tipoProcedimento) === getProcedureType(tipoFilter))
        )
          return false;
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
    [
      situacaoFilter,
      prioridadeFilter,
      gravidadeFilter,
      tipoFilter,
      autoriaFilter,
      prazoFilter,
      relatorioFilter,
      categoriaFilter,
      statusQueryFilter,
    ].some((f) => normalizeText(f) !== "todos") ||
    dataInicial ||
    dataFinal ||
    elucidadoFilter ||
    naoElucidadoFilter ||
    reuPresoFilter ||
    medidaProtetivaFilter ||
    diligenciasPendentesFilter,
  );
  const visibleInquiryColumns = columnController.visibleColumns;
  const tableGridTemplate = visibleInquiryColumns.map((column) => `${column.width}px`).join(" ");
  const tableMinWidth = visibleInquiryColumns.reduce((sum, column) => sum + column.width, 0);
  const getInquiryColumnStyle = (id: string) => {
    const index = visibleInquiryColumns.findIndex((column) => column.id === id);
    return index < 0 ? ({ display: "none" } as const) : ({ order: index } as const);
  };
  if (!isInqueritosIndex) return <Outlet />;

  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.015)] lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black tracking-tight">Procedimentos Policiais</h1>
            <p className="text-sm text-muted-foreground">
              {filtered.length} de {visibleRows.length} caso(s) encontrado(s)
            </p>
          </div>
          {canCreateCases(profile) ? (
            <button
              className="hidden items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 md:inline-flex"
              onClick={() => navigate({ to: "/novo-caso" })}
            >
              <Plus className="h-4 w-4" /> Novo procedimento
            </button>
          ) : null}
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
              <select
                value={situacaoFilter}
                onChange={(e) => setSituacaoFilter(e.target.value)}
                className="h-11 rounded-xl border border-border/90 bg-background/70 px-3 text-sm"
              >
                <option value="todos">Situação: todas</option>
                <option value={EMPTY_FILTER}>Situação: não informada</option>
                {situacaoOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={prioridadeFilter}
                onChange={(e) => setPrioridadeFilter(e.target.value)}
                className="h-11 rounded-xl border border-border/90 bg-background/70 px-3 text-sm"
              >
                <option value="todos">Prioridade: todas</option>
                <option value={EMPTY_FILTER}>Prioridade: não informada</option>
                {prioridadeOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={gravidadeFilter}
                onChange={(e) => setGravidadeFilter(e.target.value)}
                className="h-11 rounded-xl border border-border/90 bg-background/70 px-3 text-sm"
              >
                <option value="todos">Gravidade: todas</option>
                <option value={EMPTY_FILTER}>Gravidade: não informada</option>
                {gravidadeOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value)}
                className="h-11 rounded-xl border border-border/90 bg-background/70 px-3 text-sm"
              >
                <option value="todos">Tipo: todos</option>
                <option value={EMPTY_FILTER}>Tipo: não informado</option>
                {tipoOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
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
                    setSituacaoFilter("todos");
                    setPrioridadeFilter("todos");
                    setGravidadeFilter("todos");
                    setTipoFilter("todos");
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
                          setPrioridadeFilter(prioridadeOperacional || EMPTY_FILTER);
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
                          setGravidadeFilter(isEmpty(row.gravidade) ? EMPTY_FILTER : row.gravidade);
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
                          setSituacaoFilter(situacao || EMPTY_FILTER);
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
