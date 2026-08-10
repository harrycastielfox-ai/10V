import { Outlet, createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { RepresentacaoQuickPreview } from "@/components/RecordQuickPreview";
import {
  TableColumnSettings,
  useTableColumnPreferences,
  type TableColumnDefinition,
} from "@/components/TableColumnSettings";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  Landmark,
  Lock,
  Plus,
  Scale,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  listRepresentacoes,
  type RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";
import { getCurrentProfile } from "@/lib/auth";
import { canViewRepresentacoes } from "@/lib/authz";
import { canAccessSigilosa, isRepresentacaoSigilosa } from "@/lib/representacoesSigilo";
import {
  isRepresentacaoCumprida,
  isRepresentacaoDeferida,
  isRepresentacaoIndeferida,
  isRepresentacaoSigilosaValue,
} from "@/lib/operationalMetrics";

export const Route = createFileRoute("/representacoes")({ component: Representacoes });

const normalizeText = (v?: string | null) =>
  (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const STATUS_FILTER_CUMPRIDAS = "__status_cumpridas__";
const STATUS_FILTER_PENDENTES = "__status_pendentes__";
const TIPO_FILTER_NAO_INFORMADO = "__tipo_nao_informado__";
const TIPO_FILTER_MEDIDA_PROTETIVA = "__tipo_medida_protetiva__";
const PAGE_SIZE = 25;
const MOVEMENT_COLUMNS: readonly TableColumnDefinition[] = [
  { id: "movimentacao", label: "Movimentação", defaultWidth: 340, required: true },
  { id: "protocolo", label: "Protocolo", defaultWidth: 145 },
  { id: "processo", label: "Processo / vara", defaultWidth: 250 },
  { id: "status", label: "Status", defaultWidth: 135 },
  { id: "prazo", label: "Prazo", defaultWidth: 160 },
  { id: "prioridade", label: "Prioridade", defaultWidth: 130 },
  { id: "acao", label: "Ação", defaultWidth: 44, required: true },
];
const isMedidaProtetivaAlias = (value: string) =>
  normalizeText(value).replace(/-/g, " ").includes("protetiv");

const ALLOWED_OPERATIONAL_FILTERS = new Set([
  "todas",
  "pendentes",
  "deferidas",
  "indeferidas",
  "cumpridas",
  "sigilosas",
  "vencidas",
  "vencendo",
  "especial",
]);

const parseDateUtc = (value?: string | null) => {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(v);
  if (br) return Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 12, 0, 0, 0);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/u.exec(v);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0);
  const d = new Date(v);
  if (!Number.isNaN(d.getTime()))
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0);
  return null;
};

function buildOperationalStatus(r: RepresentacaoRecord) {
  if (isRepresentacaoCumprida(r)) return "Cumprida/finalizada";
  if (isRepresentacaoDeferida(r)) return "Aguardando equipe cumprir";
  if (isRepresentacaoIndeferida(r)) return "Sem cumprimento (indeferida)";

  const statusN = normalizeText(r.status);
  const hasJudicialDecision = statusN.includes("defer") || statusN.includes("indefer");
  const isCumprida = statusN.includes("cumprid") || Boolean(r.data_cumprimento);
  if (isCumprida) return "Cumprida/finalizada";
  if (statusN.includes("defer") && !statusN.includes("indefer")) return "Aguardando equipe cumprir";
  if (
    !hasJudicialDecision ||
    statusN.includes("pend") ||
    statusN.includes("aguard") ||
    statusN.includes("analis")
  )
    return "Pendente judicial";
  if (statusN.includes("indefer")) return "Sem cumprimento (indeferida)";
  return "Em acompanhamento";
}

function getRepresentacaoState(r: RepresentacaoRecord) {
  const now = Date.now();
  const due = parseDateUtc(r.data_vencimento);
  const isCumprida = isRepresentacaoCumprida(r);
  const isSpecial = Boolean(r.acompanhamento_especial);
  const isSigilosa = isRepresentacaoSigilosaValue(
    r.pedido_sigiloso_normalizado ?? r.pedido_sigiloso,
  );
  const pendingJudicial = buildOperationalStatus(r) === "Pendente judicial";
  const incomplete =
    !normalizeText(r.tipo) ||
    !normalizeText(r.status) ||
    !normalizeText(r.data_protocolo ?? r.data_representacao);
  const daysToDue = due === null ? null : Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  const isOverdue = !isCumprida && daysToDue !== null && daysToDue < 0;
  const isDueSoon = !isCumprida && daysToDue !== null && daysToDue >= 0 && daysToDue <= 7;

  const priority = isOverdue
    ? 0
    : isDueSoon
      ? 1
      : isSpecial
        ? 2
        : pendingJudicial
          ? 3
          : incomplete
            ? 4
            : 5;

  return {
    isCumprida,
    isSpecial,
    isSigilosa,
    pendingJudicial,
    incomplete,
    daysToDue,
    isOverdue,
    isDueSoon,
    priority,
  };
}

function buildPrazoLabel(state: ReturnType<typeof getRepresentacaoState>) {
  if (state.isCumprida) return "Cumprida";
  if (state.isOverdue) return `Vencida há ${Math.abs(state.daysToDue ?? 0)} dia(s)`;
  if (state.daysToDue === 0) return "Vence hoje";
  if (state.daysToDue === 1) return "Vence amanhã";
  if (state.isDueSoon) return `Vence em ${state.daysToDue} dia(s)`;
  return "Sem prazo crítico";
}

function formatDate(value?: string | null) {
  const timestamp = parseDateUtc(value);
  if (timestamp === null) return null;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(timestamp);
}

function Representacoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const isRepresentacoesIndex = location.pathname === "/representacoes";

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [operationalFilter, setOperationalFilter] = useState("todas");
  const [currentPage, setCurrentPage] = useState(1);
  const [representacoes, setRepresentacoes] = useState<RepresentacaoRecord[]>([]);
  const [selectedRepresentacao, setSelectedRepresentacao] = useState<RepresentacaoRecord | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [canOpenSigilosas, setCanOpenSigilosas] = useState(false);
  const columnController = useTableColumnPreferences(
    "sipi:movimentacoes:table-columns:v2",
    MOVEMENT_COLUMNS,
    "representacoes",
  );

  useEffect(() => {
    if (!isRepresentacoesIndex) return;
    (async () => {
      try {
        const currentProfile = await getCurrentProfile();
        if (!canViewRepresentacoes(currentProfile)) {
          setRestricted(true);
          return;
        }
        setRestricted(false);
        setCanOpenSigilosas(canAccessSigilosa(currentProfile));
        setLoading(true);
        setError("");
        setRepresentacoes(await listRepresentacoes());
      } catch {
        setError("Não foi possível carregar representações agora.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isRepresentacoesIndex]);

  useEffect(() => {
    if (!isRepresentacoesIndex) return;
    // location.search do roteador e o objeto ja interpretado; aqui queremos a
    // query crua da URL.
    const params = new URLSearchParams(window.location.search);
    const operational = normalizeText(params.get("operationalFilter") ?? "todas");
    setOperationalFilter(ALLOWED_OPERATIONAL_FILTERS.has(operational) ? operational : "todas");
    setSearchTerm(params.get("busca") ?? "");

    const status = params.get("status");
    setStatusFilter(status?.trim() ? status : "todos");

    const tipo = params.get("tipo");
    if (tipo?.trim()) {
      setTipoFilter(isMedidaProtetivaAlias(tipo) ? TIPO_FILTER_MEDIDA_PROTETIVA : tipo);
    } else {
      setTipoFilter("todos");
    }

    const dataInicialParam = params.get("dataInicial");
    const dataFinalParam = params.get("dataFinal");
    setDataInicial(
      dataInicialParam && /^\d{4}-\d{2}-\d{2}$/u.test(dataInicialParam) ? dataInicialParam : "",
    );
    setDataFinal(
      dataFinalParam && /^\d{4}-\d{2}-\d{2}$/u.test(dataFinalParam) ? dataFinalParam : "",
    );
    setShowFilters(Boolean(status || tipo || dataInicialParam || dataFinalParam));
  }, [isRepresentacoesIndex, location.search]);

  const filtered = useMemo(() => {
    const s = normalizeText(searchTerm);
    const isFallbackSearch = [
      "nao informado",
      "nao informados",
      "vazio",
      "sem informacao",
      "sem valor",
    ].includes(s);
    const normalizeDateInput = (value: string, asEndOfDay: boolean) => {
      if (!value) return null;
      const [year, month, day] = value.split("-").map(Number);
      if (!year || !month || !day) return null;
      return asEndOfDay
        ? Date.UTC(year, month - 1, day, 23, 59, 59, 999)
        : Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    };
    const startDate = normalizeDateInput(dataInicial, false);
    const endDate = normalizeDateInput(dataFinal, true);

    return representacoes
      .filter((r) => {
        const state = getRepresentacaoState(r);
        const fields = [
          r.numero_ppe,
          r.vitima,
          r.investigado,
          r.processo_judicial,
          r.vara_juizo,
          r.tipo_normalizado,
          r.tipo,
          r.status,
          r.equipe_responsavel,
          r.observacoes_internas,
          r.observacoes_cumprimento,
          r.resumo_fatos,
        ].map((v) => normalizeText(String(v ?? "")));
        const matchesSearch =
          !s || fields.some((f) => f.includes(s)) || (isFallbackSearch && fields.some((f) => !f));
        if (!matchesSearch) return false;

        if (statusFilter === STATUS_FILTER_CUMPRIDAS && !state.isCumprida) return false;
        if (statusFilter === STATUS_FILTER_PENDENTES && state.isCumprida) return false;
        if (
          !["todos", STATUS_FILTER_CUMPRIDAS, STATUS_FILTER_PENDENTES].includes(statusFilter) &&
          normalizeText(r.status) !== normalizeText(statusFilter)
        )
          return false;
        const tipoAtual = normalizeText(r.tipo_normalizado || r.tipo);
        const tipoTextoCompleto = normalizeText(`${r.tipo_normalizado ?? ""} ${r.tipo ?? ""}`);
        if (tipoFilter === TIPO_FILTER_NAO_INFORMADO && tipoAtual) return false;
        if (
          tipoFilter === TIPO_FILTER_MEDIDA_PROTETIVA &&
          r.medida_protetiva_normalizada !== true &&
          !tipoTextoCompleto.includes("protetiv")
        )
          return false;
        if (
          !["todos", TIPO_FILTER_NAO_INFORMADO, TIPO_FILTER_MEDIDA_PROTETIVA].includes(
            tipoFilter,
          ) &&
          tipoAtual !== normalizeText(tipoFilter)
        )
          return false;

        const recordDate =
          parseDateUtc(r.data_representacao) ??
          parseDateUtc(r.created_at) ??
          parseDateUtc(r.data_envio_judiciario);
        if (startDate !== null && (recordDate === null || recordDate < startDate)) return false;
        if (endDate !== null && (recordDate === null || recordDate > endDate)) return false;

        if (operationalFilter === "pendentes" && !state.pendingJudicial) return false;
        if (
          operationalFilter === "deferidas" &&
          !(
            normalizeText(r.status).includes("defer") &&
            !normalizeText(r.status).includes("indefer")
          )
        )
          return false;
        if (operationalFilter === "indeferidas" && !normalizeText(r.status).includes("indefer"))
          return false;
        if (operationalFilter === "cumpridas" && !state.isCumprida) return false;
        if (operationalFilter === "vencendo" && !state.isDueSoon) return false;
        if (operationalFilter === "vencidas" && !state.isOverdue) return false;
        if (operationalFilter === "sigilosas" && !state.isSigilosa) return false;
        if (operationalFilter === "especial" && !state.isSpecial) return false;
        return true;
      })
      .sort((a, b) => {
        const as = getRepresentacaoState(a);
        const bs = getRepresentacaoState(b);
        if (as.priority !== bs.priority) return as.priority - bs.priority;
        return (parseDateUtc(b.created_at) ?? 0) - (parseDateUtc(a.created_at) ?? 0);
      });
  }, [
    representacoes,
    searchTerm,
    statusFilter,
    tipoFilter,
    dataInicial,
    dataFinal,
    operationalFilter,
  ]);

  const kpis = useMemo(() => {
    const base = representacoes.map((r) => getRepresentacaoState(r));
    return {
      vencidas: base.filter((s) => s.isOverdue).length,
      vencendo: base.filter((s) => s.isDueSoon).length,
      pendentesJudiciais: base.filter((s) => s.pendingJudicial).length,
      sigilosas: base.filter((s) => s.isSigilosa).length,
      acompanhamentoEspecial: base.filter((s) => s.isSpecial).length,
      cumpridas: base.filter((s) => s.isCumprida).length,
    };
  }, [representacoes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, tipoFilter, dataInicial, dataFinal, operationalFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRepresentacoes = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filtered],
  );
  const visibleMovementColumns = columnController.visibleColumns;
  const movementGridTemplate = visibleMovementColumns
    .map((column) =>
      column.id === "acao" ? `${column.width}px` : `minmax(${column.width}px, ${column.width}fr)`,
    )
    .join(" ");
  const movementMinWidth = visibleMovementColumns.reduce((sum, column) => sum + column.width, 0);
  const getMovementColumnStyle = (id: string) => {
    const index = visibleMovementColumns.findIndex((column) => column.id === id);
    return index < 0 ? ({ display: "none" } as const) : ({ order: index } as const);
  };

  if (!isRepresentacoesIndex) return <Outlet />;
  if (restricted)
    return (
      <AppLayout>
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Seu perfil não possui permissão para acessar Movimentações Processuais.
          </p>
          <Link to="/modulos" className="px-4 py-2 border border-border rounded-lg inline-block">
            Voltar
          </Link>
        </div>
      </AppLayout>
    );

  const quickFilters = [
    { key: "todas", label: "Todas" },
    { key: "pendentes", label: "Pendentes" },
    { key: "deferidas", label: "Deferidas" },
    { key: "cumpridas", label: "Cumpridas" },
    { key: "vencendo", label: "Vencendo" },
    { key: "vencidas", label: "Vencidas" },
    { key: "sigilosas", label: "Sigilosas" },
    { key: "especial", label: "Acomp. Especial" },
  ];

  const summaryCards = [
    {
      key: "pendentes",
      label: "Pendentes",
      value: kpis.pendentesJudiciais,
      helper: "Aguardando decisão",
      icon: FileText,
      className: "border-amber-500/25 bg-amber-500/[0.04] text-amber-300",
    },
    {
      key: "vencendo",
      label: "Vencendo",
      value: kpis.vencendo,
      helper: "Próximos 7 dias",
      icon: Clock3,
      className: "border-red-500/25 bg-red-500/[0.04] text-red-300",
    },
    {
      key: "vencidas",
      label: "Vencidas",
      value: kpis.vencidas,
      helper: "Prazo ultrapassado",
      icon: AlertTriangle,
      className: "border-white/25 bg-white/[0.04] text-white",
    },
    {
      key: "sigilosas",
      label: "Sigilosas",
      value: kpis.sigilosas,
      helper: "Acesso restrito",
      icon: Lock,
      className: "border-purple-500/25 bg-purple-500/[0.04] text-purple-300",
    },
    {
      key: "cumpridas",
      label: "Cumpridas",
      value: kpis.cumpridas,
      helper: "Finalizadas",
      icon: ShieldCheck,
      className: "border-emerald-500/25 bg-emerald-500/[0.04] text-emerald-300",
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-5 pb-6">
        <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/[0.06] text-primary">
              <Scale className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">Movimentações Processuais</h1>
              <p className="text-sm text-muted-foreground">
                <span className="md:hidden">Consulta de medidas e pedidos judiciais</span>
                <span className="hidden md:inline">Gestão de medidas e pedidos judiciais</span>
              </p>
            </div>
          </div>
          <Link
            to="/nova-representacao"
            className="hidden h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_0_18px_rgba(52,211,153,0.12)] transition hover:bg-primary/90 md:inline-flex"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova movimentação
          </Link>
        </header>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <section className="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-5">
          {summaryCards.map(({ key, label, value, helper, icon: Icon, className }) => (
            <button
              key={key}
              type="button"
              onClick={() => setOperationalFilter(key)}
              className={`group min-h-[108px] rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:border-current/40 ${className} ${operationalFilter === key ? "ring-1 ring-current/40" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground/80">{label}</p>
                  <p className="mt-1 text-3xl font-bold text-current">{value}</p>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-current/20 bg-current/10">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
            </button>
          ))}
        </section>

        <section className="rounded-lg border border-border/80 bg-card/45 p-3">
          <div className="flex flex-wrap gap-1.5">
            {quickFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setOperationalFilter(f.key)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${operationalFilter === f.key ? "border-primary/50 bg-primary/10 text-primary" : "border-border/80 text-muted-foreground hover:border-border hover:text-foreground"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Buscar por PPE, vítima, investigado, processo, vara, tipo, status, equipe ou observações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-lg border border-border/90 bg-background/60 py-2 pl-10 pr-4 text-sm outline-none transition focus:border-primary/45"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition ${showFilters ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background/60 hover:border-border/90"}`}
            >
              <Filter className="h-4 w-4" />
              Filtros
            </button>
            <TableColumnSettings definitions={MOVEMENT_COLUMNS} controller={columnController} />
          </div>
          {showFilters && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-lg border border-border/90 bg-background/70 px-3 text-sm"
              >
                <option value="todos">Status: todos</option>
                <option value={STATUS_FILTER_CUMPRIDAS}>Status: cumpridas</option>
                <option value={STATUS_FILTER_PENDENTES}>Status: pendentes</option>
              </select>
              <select
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value)}
                className="h-10 rounded-lg border border-border/90 bg-background/70 px-3 text-sm"
              >
                <option value="todos">Tipo: todos</option>
                <option value={TIPO_FILTER_NAO_INFORMADO}>Tipo: não informado</option>
                <option value={TIPO_FILTER_MEDIDA_PROTETIVA}>Tipo: medida protetiva</option>
              </select>
              <input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                aria-label="Data inicial"
                className="h-10 rounded-lg border border-border/90 bg-background/70 px-3 text-sm"
              />
              <input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                aria-label="Data final"
                className="h-10 rounded-lg border border-border/90 bg-background/70 px-3 text-sm"
              />
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {filtered.length} de {representacoes.length} movimentações
          </p>
        </section>

        <section
          className="overflow-x-auto rounded-lg border border-border/80 bg-card/35"
          style={{ minWidth: Math.min(movementMinWidth, 1180) }}
        >
          <div
            className="hidden items-center gap-0 border-b border-border/80 bg-muted/[0.08] text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:grid"
            style={{ gridTemplateColumns: movementGridTemplate, minWidth: movementMinWidth }}
          >
            {visibleMovementColumns.map((column) => (
              <span key={column.id} className="px-4 py-2.5">
                {column.id === "acao" ? "" : column.label}
              </span>
            ))}
          </div>
          {pagedRepresentacoes.map((r) => {
            const state = getRepresentacaoState(r);
            const isSigilosa = isRepresentacaoSigilosa(r) || state.isSigilosa;
            const canOpenThisRecord = !isSigilosa || canOpenSigilosas;
            const blockedSigilosaTitle = "Movimentação sigilosa — acesso restrito";
            const prazo = buildPrazoLabel(state);
            const dueDate = formatDate(r.data_vencimento);
            const statusLabel = isSigilosa
              ? "Sigilosa"
              : state.isOverdue
                ? "Vencida"
                : state.isDueSoon
                  ? "Vencendo"
                  : state.isCumprida
                    ? "Cumprida"
                    : state.pendingJudicial
                      ? "Pendente"
                      : state.isSpecial
                        ? "Especial"
                        : "Acompanhamento";
            const statusTone = isSigilosa
              ? "border-purple-500/35 bg-purple-500/10 text-purple-300"
              : state.isOverdue
                ? "border-white/35 bg-white/10 text-white"
                : state.isDueSoon
                  ? "border-red-500/35 bg-red-500/10 text-red-400"
                  : state.isCumprida
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                    : state.pendingJudicial
                      ? "border-amber-500/35 bg-amber-500/10 text-amber-300"
                      : "border-sky-500/30 bg-sky-500/10 text-sky-300";
            const rowTone = isSigilosa
              ? "border-l-purple-400"
              : state.isOverdue
                ? "border-l-white"
                : state.isDueSoon
                  ? "border-l-red-500"
                  : state.isCumprida
                    ? "border-l-emerald-400"
                    : state.pendingJudicial
                      ? "border-l-amber-400"
                      : "border-l-sky-400/60";

            return (
              <div
                key={r.id}
                role="button"
                tabIndex={canOpenThisRecord ? 0 : -1}
                title={
                  canOpenThisRecord
                    ? `Abrir movimentação ${r.numero_ppe || r.id}`
                    : blockedSigilosaTitle
                }
                aria-label={
                  canOpenThisRecord
                    ? `Abrir movimentação ${r.numero_ppe || r.id}`
                    : blockedSigilosaTitle
                }
                onClick={() =>
                  canOpenThisRecord ? setSelectedRepresentacao(r) : alert(blockedSigilosaTitle)
                }
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  if (canOpenThisRecord) {
                    setSelectedRepresentacao(r);
                  } else {
                    alert(blockedSigilosaTitle);
                  }
                }}
                className={`group grid min-h-[76px] grid-cols-1 gap-3 border-b border-l-[3px] border-b-border/70 text-left transition-colors last:border-b-0 lg:items-center lg:gap-0 ${canOpenThisRecord ? "cursor-pointer hover:bg-accent/20" : "cursor-not-allowed opacity-75"} ${rowTone}`}
                style={{ gridTemplateColumns: movementGridTemplate, minWidth: movementMinWidth }}
              >
                <div
                  className="flex min-w-0 items-start gap-3 px-4 py-3"
                  style={getMovementColumnStyle("movimentacao")}
                >
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-current opacity-80" />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                      PPE {r.numero_ppe || "—"} · {r.tipo || "Não informado"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {buildOperationalStatus(r)}
                    </p>
                    {(isSigilosa || state.incomplete || state.isSpecial) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {isSigilosa && (
                          <span className="inline-flex items-center gap-1 rounded border border-purple-400/30 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-purple-300">
                            <Lock className="h-2.5 w-2.5" /> Sigilosa
                          </span>
                        )}
                        {state.incomplete && (
                          <span className="rounded border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-300">
                            Incompleta
                          </span>
                        )}
                        {state.isSpecial && (
                          <span className="rounded border border-blue-400/30 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-300">
                            Acomp. especial
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0 px-4 py-3" style={getMovementColumnStyle("protocolo")}>
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                    Protocolo
                  </span>
                  <p className="flex items-start gap-2 text-xs text-foreground/85">
                    <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      {formatDate(r.data_protocolo ?? r.data_representacao) || "Não informado"}
                    </span>
                  </p>
                </div>

                <div className="min-w-0 px-4 py-3" style={getMovementColumnStyle("processo")}>
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                    Processo / vara
                  </span>
                  <div className="flex items-start gap-2 text-xs text-foreground/85">
                    <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 leading-relaxed">
                      <p className="truncate font-medium">
                        {r.processo_judicial || "Não informado"}
                      </p>
                      {r.vara_juizo ? (
                        <p className="truncate text-muted-foreground">{r.vara_juizo}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3" style={getMovementColumnStyle("status")}>
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                    Status
                  </span>
                  <span
                    className={`inline-flex rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${statusTone}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="px-4 py-3" style={getMovementColumnStyle("prazo")}>
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                    Prazo
                  </span>
                  <p className="flex items-center gap-2 text-xs text-foreground/85">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {dueDate || prazo}
                  </p>
                  {dueDate && (
                    <p
                      className={`mt-1 text-[10px] ${state.isOverdue ? "text-white" : state.isDueSoon ? "text-red-400" : state.isCumprida ? "text-emerald-300" : "text-muted-foreground"}`}
                    >
                      {prazo}
                    </p>
                  )}
                </div>

                <div className="min-w-0 px-4 py-3" style={getMovementColumnStyle("prioridade")}>
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                    Prioridade
                  </span>
                  <span className="inline-flex rounded border border-primary/25 bg-primary/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-primary">
                    {r.prioridade_operacional || "Normal"}
                  </span>
                </div>

                <span className="hidden px-3 py-3 lg:block" style={getMovementColumnStyle("acao")}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            );
          })}
          {!loading && filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum resultado para a busca informada.
            </div>
          )}
          {loading && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Carregando movimentações...
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <footer className="flex flex-col gap-3 border-t border-border/80 bg-muted/[0.04] px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Exibindo {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}{" "}
                movimentações
              </span>
              <div className="flex items-center gap-2">
                <span className="mr-2 hidden sm:inline">{PAGE_SIZE} por página</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="grid h-8 w-8 place-items-center rounded-md border border-border transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="grid h-8 min-w-8 place-items-center rounded-md border border-primary/50 bg-primary/10 px-2 font-semibold text-primary">
                  {currentPage}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="grid h-8 w-8 place-items-center rounded-md border border-border transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </footer>
          )}
        </section>
      </div>
      <RepresentacaoQuickPreview
        record={selectedRepresentacao}
        onClose={() => setSelectedRepresentacao(null)}
        onOpenFull={() => {
          if (!selectedRepresentacao) return;
          navigate({
            to: "/representacoes/$representacaoId",
            params: { representacaoId: selectedRepresentacao.id },
          });
        }}
      />
    </AppLayout>
  );
}
