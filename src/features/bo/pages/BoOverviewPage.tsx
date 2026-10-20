import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileWarning,
  FlaskConical,
  UserRoundX,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getErrorMessage } from "@/lib/errorMessage";
import { listBos } from "@/lib/repositories/boRepository";
import type { BoRecord, BoStatus } from "../boTypes";

const STATUS_COLORS = {
  analysis: "#3b82f6",
  pending: "#f59e0b",
  completed: "#22c55e",
  waiting: "#8b5cf6",
  others: "#94a3b8",
};

const KPI_TONES = {
  purple: {
    shell: "border-purple/30 bg-gradient-to-br from-purple/[0.08] to-card",
    icon: "bg-purple/10 text-purple",
    accent: "text-purple",
  },
  blue: {
    shell: "border-blue-400/35 bg-gradient-to-br from-blue-500/[0.08] to-card",
    icon: "bg-blue-500/10 text-blue-500",
    accent: "text-blue-500",
  },
  amber: {
    shell: "border-amber-400/35 bg-gradient-to-br from-amber-500/[0.08] to-card",
    icon: "bg-amber-500/12 text-amber-500",
    accent: "text-amber-500",
  },
  red: {
    shell: "border-red-400/35 bg-gradient-to-br from-red-500/[0.08] to-card",
    icon: "bg-red-500/10 text-red-500",
    accent: "text-red-500",
  },
  green: {
    shell: "border-emerald-400/35 bg-gradient-to-br from-emerald-500/[0.08] to-card",
    icon: "bg-emerald-500/10 text-emerald-500",
    accent: "text-emerald-500",
  },
} as const;

export default function BoOverviewPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<BoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDemoData, setShowDemoData] = useState(true);

  const load = () => {
    setLoading(true);
    setError("");
    void listBos()
      .then(setRecords)
      .catch((cause) => setError(getBoLoadError(cause)))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const demoRecords = useMemo(() => createDemoBoRecords(), []);
  const dashboardRecords = showDemoData ? demoRecords : records;
  const dashboardLoading = loading && !showDemoData;
  const metrics = useMemo(() => buildDashboardMetrics(dashboardRecords), [dashboardRecords]);

  return (
    <div className="w-full">
      <header className="mb-4">
        <div className="flex flex-1 items-start gap-4">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple/10 text-purple">
            <BarChart3 className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              SIED — Boletim de Ocorrência
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Visão operacional dos boletins de ocorrência
              </p>
              <button
                type="button"
                aria-pressed={showDemoData}
                onClick={() => setShowDemoData((current) => !current)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition-colors ${
                  showDemoData
                    ? "border-[#c6adf0] bg-[#f1eafa] text-[#6f36bb]"
                    : "border-[#cbd7e6] bg-white text-[#435675] hover:border-[#8a57c6] hover:text-[#6f36bb]"
                }`}
                title="Os registros fictícios não são gravados no banco de dados"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                {showDemoData ? "Simulação: 30 B.O.s fictícios" : "Exibir simulação"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {!showDemoData && error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section
        aria-label="Indicadores dos boletins"
        className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <DashboardKpi
          label="Total de B.O."
          value={dashboardLoading ? "—" : dashboardRecords.length}
          hint="Registros ativos"
          icon={ClipboardList}
          tone="purple"
          onClick={() => navigate({ to: "/bo/boletins" })}
        />
        <DashboardKpi
          label="Registrados hoje"
          value={dashboardLoading ? "—" : metrics.registeredToday}
          hint="Novos registros do dia"
          icon={CalendarDays}
          tone="blue"
          onClick={() => navigate({ to: "/bo/boletins" })}
        />
        <DashboardKpi
          label="Em análise"
          value={dashboardLoading ? "—" : metrics.inAnalysis}
          hint="Em processamento"
          icon={Clock3}
          tone="amber"
          onClick={() => navigate({ to: "/bo/boletins" })}
        />
        <DashboardKpi
          label="Com pendências"
          value={dashboardLoading ? "—" : metrics.withPendingIssues}
          hint="Exigem atenção"
          icon={AlertTriangle}
          tone="red"
          onClick={() => navigate({ to: "/bo/boletins" })}
        />
        <DashboardKpi
          label="Concluídos"
          value={dashboardLoading ? "—" : metrics.completed}
          hint="Finalizados"
          icon={CheckCircle2}
          tone="green"
          onClick={() => navigate({ to: "/bo/boletins" })}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <DashboardPanel
          title="Boletins registrados"
          icon={<BarChart3 className="h-5 w-5" />}
          action={<PanelPeriod label="Últimos 7 dias" />}
          className="xl:col-span-8"
        >
          <div className="h-[240px] px-1 pb-1 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={metrics.dailyRegistrations}
                margin={{ top: 14, right: 12, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="boRegistrationsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical
                  stroke="var(--border)"
                  opacity={0.65}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ stroke: "#8b5cf6", strokeDasharray: "4 4", opacity: 0.45 }}
                  contentStyle={{
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    background: "var(--card)",
                    color: "var(--foreground)",
                    fontSize: "12px",
                    boxShadow: "0 12px 30px rgba(0,0,0,.14)",
                  }}
                  formatter={(value) => [`${value} boletim(ns)`, "Registros"]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#7c3aed"
                  strokeWidth={3}
                  fill="url(#boRegistrationsGradient)"
                  activeDot={{ r: 6, fill: "#7c3aed", stroke: "var(--card)", strokeWidth: 2 }}
                  dot={{ r: 4, fill: "#7c3aed", stroke: "var(--card)", strokeWidth: 2 }}
                >
                  <LabelList
                    dataKey="total"
                    position="top"
                    fill="var(--foreground)"
                    fontSize={12}
                    fontWeight={800}
                    formatter={(value) => (Number(value) > 0 ? value : "")}
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Status dos boletins"
          icon={<ChartDonutIcon />}
          className="xl:col-span-4"
        >
          {dashboardRecords.length === 0 && !dashboardLoading ? (
            <EmptyPanel message="Sem dados para consolidar." />
          ) : (
            <div className="grid min-h-[240px] grid-cols-1 items-center gap-3 py-3 sm:grid-cols-[minmax(180px,0.9fr)_minmax(210px,1.1fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(170px,0.9fr)_minmax(190px,1.1fr)]">
              <div className="relative mx-auto h-48 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.statusDistribution}
                      dataKey="total"
                      nameKey="label"
                      innerRadius={56}
                      outerRadius={92}
                      paddingAngle={1}
                      stroke="var(--card)"
                      strokeWidth={2}
                    >
                      {metrics.statusDistribution.map((item) => (
                        <Cell key={item.key} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        background: "var(--card)",
                        color: "var(--foreground)",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <strong className="text-2xl font-black">
                    {dashboardLoading ? "—" : dashboardRecords.length}
                  </strong>
                  <span className="text-xs text-muted-foreground">B.O.</span>
                </div>
              </div>

              <div className="space-y-3 px-2">
                {metrics.statusDistribution.map((item) => {
                  const percentage = dashboardRecords.length
                    ? (item.total / dashboardRecords.length) * 100
                    : 0;
                  return (
                    <div
                      key={item.key}
                      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 text-sm"
                    >
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
                      <strong>{item.total}</strong>
                      <span className="w-12 text-right text-xs text-muted-foreground">
                        {formatPercentage(percentage)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Ocorrências por natureza"
          icon={<BarChart3 className="h-5 w-5" />}
          action={<PanelPeriod label="Este mês" />}
          className="xl:col-span-8"
        >
          {metrics.natures.length === 0 && !dashboardLoading ? (
            <EmptyPanel message="Nenhuma ocorrência registrada neste mês." />
          ) : (
            <div className="space-y-3.5 px-5 py-4">
              {metrics.natures.map((nature) => (
                <div
                  key={nature.label}
                  className="grid grid-cols-[minmax(105px,1fr)_minmax(130px,4fr)_auto] items-center gap-3 text-sm"
                >
                  <span className="truncate text-muted-foreground" title={nature.label}>
                    {nature.label}
                  </span>
                  <span className="h-5 overflow-hidden rounded bg-muted/80">
                    <span
                      className="block h-full rounded bg-gradient-to-r from-purple to-violet-400 transition-[width] duration-500"
                      style={{ width: `${nature.percentage}%` }}
                    />
                  </span>
                  <strong className="w-7 text-right">{nature.total}</strong>
                </div>
              ))}
              {metrics.leadingNature ? (
                <div className="mt-5 flex items-center gap-2 rounded-lg border border-purple/20 bg-purple/[0.07] px-4 py-3 text-sm text-purple">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-black">
                    i
                  </span>
                  <span className="min-w-0 truncate">
                    <strong>{metrics.leadingNature.label}</strong> representa{" "}
                    {formatPercentage(metrics.leadingNature.share)} dos registros do mês
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Atenção operacional"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="purple"
          className="xl:col-span-4"
        >
          <div className="divide-y divide-border px-4">
            <AttentionItem
              count={metrics.withoutResponsible}
              title="boletins sem responsável vinculado"
              description="Necessitam de definição para continuidade"
              icon={UserRoundX}
              tone="purple"
            />
            <AttentionItem
              count={metrics.withDiligences}
              title="cadastros com diligências pendentes"
              description="Há providências registradas para acompanhamento"
              icon={UsersRound}
              tone="amber"
            />
            <AttentionItem
              count={metrics.waitingReturn}
              title="boletins aguardando retorno"
              description="Dependem de terceiros ou de aprovação"
              icon={Clock3}
              tone="purple"
            />
          </div>
          <div className="border-t border-border p-2">
            <Link
              to="/bo/boletins"
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-purple/25 bg-purple/[0.06] text-sm font-bold text-purple transition hover:bg-purple/10"
            >
              Ver boletins <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </DashboardPanel>
      </section>
    </div>
  );
}

function DashboardKpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone: keyof typeof KPI_TONES;
  onClick: () => void;
}) {
  const palette = KPI_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group min-h-[132px] rounded-xl border p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${palette.shell}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-12 shrink-0 items-center justify-center rounded-full ${palette.icon}`}
        >
          <Icon className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className={`text-xs font-black uppercase tracking-wide ${palette.accent}`}>{label}</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-foreground">{value}</p>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ArrowUpRight
          className={`h-4 w-4 transition group-hover:-translate-y-0.5 ${palette.accent}`}
        />
        {hint}
      </p>
    </button>
  );
}

function DashboardPanel({
  title,
  icon,
  action,
  children,
  className = "",
  tone = "default",
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "default" | "purple";
}) {
  const highlighted = tone === "purple";
  return (
    <article
      className={`overflow-hidden rounded-xl border bg-card shadow-sm ${highlighted ? "border-purple/45" : "border-purple/20"} ${className}`}
    >
      <header
        className={`flex min-h-13 items-center justify-between gap-3 border-b px-5 ${highlighted ? "border-purple/35 bg-purple/[0.08] text-purple" : "border-border text-purple"}`}
      >
        <h2 className="flex min-w-0 items-center gap-3 text-sm font-black uppercase tracking-[0.06em]">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        {action}
      </header>
      {children}
    </article>
  );
}

function PanelPeriod({ label }: { label: string }) {
  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground">
      <CalendarDays className="h-4 w-4" /> {label}
    </span>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FileWarning className="h-5 w-5" />
      </span>
      {message}
    </div>
  );
}

const ATTENTION_TONES = {
  purple: "bg-purple/12 text-purple",
  amber: "bg-amber-500/12 text-amber-500",
} as const;

function AttentionItem({
  count,
  title,
  description,
  icon: Icon,
  tone,
}: {
  count: number;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: keyof typeof ATTENTION_TONES;
}) {
  return (
    <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 py-3">
      <span
        className={`flex size-11 items-center justify-center rounded-full ${ATTENTION_TONES[tone]}`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <strong className="min-w-7 text-center text-xl font-black text-foreground">{count}</strong>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function ChartDonutIcon() {
  return (
    <span
      className="relative block size-5 rounded-full border-[5px] border-purple border-r-purple/20"
      aria-hidden="true"
    />
  );
}

const DEMO_DAY_OFFSETS = [
  6, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0,
] as const;

const DEMO_NATURES = [
  "Violência doméstica",
  "Ameaça",
  "Lesão corporal",
  "Furto",
  "Sinistro de trânsito",
  "Violência doméstica",
  "Ameaça",
  "Estelionato",
  "Lesão corporal",
  "Violência doméstica",
  "Dano",
  "Furto",
  "Ameaça",
  "Violência doméstica",
  "Lesão corporal",
  "Sinistro de trânsito",
  "Ameaça",
  "Violência doméstica",
  "Furto",
  "Lesão corporal",
  "Violência doméstica",
  "Ameaça",
  "Estelionato",
  "Violência doméstica",
  "Furto",
  "Lesão corporal",
  "Ameaça",
  "Sinistro de trânsito",
  "Violência doméstica",
  "Dano",
] as const;

const DEMO_STATUSES: BoStatus[] = [
  ...Array.from({ length: 20 }, () => "Concluida" as const),
  ...Array.from({ length: 4 }, () => "Em Andamento" as const),
  "Pendente",
  "Pendente",
  "Agendada",
  "Aguardando Terceiros",
  "Aguardando Aprovacao/Revisao",
  "Suspensa",
];

function createDemoBoRecords(): BoRecord[] {
  const now = new Date();
  const teams = ["Equipe Alfa", "Equipe Bravo", "Equipe Charlie", "Plantão Operacional"];

  return DEMO_DAY_OFFSETS.map((dayOffset, index) => {
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - dayOffset);
    createdAt.setHours(8 + (index % 10), (index * 7) % 60, 0, 0);

    return {
      id: `demo-bo-${String(index + 1).padStart(2, "0")}`,
      numero_bo: `DEMO-BO-${String(index + 1).padStart(4, "0")}`,
      infracao_penal: DEMO_NATURES[index],
      diligencias_pendentes:
        index % 7 === 0 ? "Providência fictícia para demonstração do painel." : null,
      responsavel_nome:
        index === 0 || index === 11 || index === 22 ? null : teams[index % teams.length],
      observacao: "Registro fictício, criado somente para visualizar o dashboard.",
      status: DEMO_STATUSES[index],
      inquerito_id: null,
      representacao_id: null,
      origem_registro: "sipi",
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
      created_by: null,
      updated_by: null,
      deleted_at: null,
    };
  });
}

function buildDashboardMetrics(records: BoRecord[]) {
  const now = new Date();
  const registeredToday = records.filter((record) => isSameLocalDay(record.created_at, now)).length;
  const inAnalysis = records.filter(
    (record) => record.status === "Em Andamento" || record.status === "Agendada",
  ).length;
  const completed = records.filter((record) => record.status === "Concluida").length;
  const withPendingIssues = records.filter(
    (record) => record.status === "Pendente" || Boolean(record.diligencias_pendentes?.trim()),
  ).length;
  const withoutResponsible = records.filter((record) => !record.responsavel_nome?.trim()).length;
  const withDiligences = records.filter((record) =>
    Boolean(record.diligencias_pendentes?.trim()),
  ).length;
  const waitingReturn = records.filter(
    (record) =>
      record.status === "Aguardando Terceiros" || record.status === "Aguardando Aprovacao/Revisao",
  ).length;

  const dailyRegistrations = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = getLocalDateKey(date);
    return {
      key,
      label: formatShortDate(date),
      total: records.filter((record) => getLocalDateKey(new Date(record.created_at)) === key)
        .length,
    };
  });

  const statusDistribution = [
    {
      key: "analysis",
      label: "Em análise",
      color: STATUS_COLORS.analysis,
      total: records.filter(
        (record) => record.status === "Em Andamento" || record.status === "Agendada",
      ).length,
    },
    {
      key: "pending",
      label: "Pendentes",
      color: STATUS_COLORS.pending,
      total: records.filter((record) => record.status === "Pendente").length,
    },
    { key: "completed", label: "Concluídos", color: STATUS_COLORS.completed, total: completed },
    { key: "waiting", label: "Aguardando", color: STATUS_COLORS.waiting, total: waitingReturn },
    {
      key: "others",
      label: "Outros status",
      color: STATUS_COLORS.others,
      total: records.filter(
        (record) => record.status === "Cancelada" || record.status === "Suspensa",
      ).length,
    },
  ].filter((item) => item.total > 0);

  const currentMonthRecords = records.filter((record) => isSameLocalMonth(record.created_at, now));
  const natureCounts = currentMonthRecords.reduce<Map<string, number>>((accumulator, record) => {
    const label = record.infracao_penal.trim() || "Não informada";
    accumulator.set(label, (accumulator.get(label) ?? 0) + 1);
    return accumulator;
  }, new Map());
  const rankedNatures = [...natureCounts.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort(
      (first, second) =>
        second.total - first.total || first.label.localeCompare(second.label, "pt-BR"),
    )
    .slice(0, 5);
  const highestNatureTotal = rankedNatures[0]?.total ?? 1;
  const natures = rankedNatures.map((nature) => ({
    ...nature,
    percentage: Math.max(4, (nature.total / highestNatureTotal) * 100),
  }));
  const leadingNature = rankedNatures[0]
    ? {
        ...rankedNatures[0],
        share: currentMonthRecords.length
          ? (rankedNatures[0].total / currentMonthRecords.length) * 100
          : 0,
      }
    : null;

  return {
    registeredToday,
    inAnalysis,
    completed,
    withPendingIssues,
    withoutResponsible,
    withDiligences,
    waitingReturn,
    dailyRegistrations,
    statusDistribution,
    natures,
    leadingNature,
  };
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(date)
    .replace(".", "");
}

function formatPercentage(value: number) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}

function getLocalDateKey(date: Date) {
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameLocalDay(value: string, date: Date) {
  return getLocalDateKey(new Date(value)) === getLocalDateKey(date);
}

function isSameLocalMonth(value: string, date: Date) {
  const parsed = new Date(value);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === date.getFullYear() &&
    parsed.getMonth() === date.getMonth()
  );
}

function getBoLoadError(cause: unknown) {
  const message = getErrorMessage(cause, "");
  if (message.includes("boletins_ocorrencia") || message.includes("PGRST205"))
    return "A estrutura do módulo ainda precisa ser aplicada ao banco de dados.";
  return message || "Tente novamente em alguns instantes.";
}
