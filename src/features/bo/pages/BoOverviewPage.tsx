import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useAppProfile } from "@/components/AppProfileContext";
import { canManageBos } from "@/lib/authz";
import { getErrorMessage } from "@/lib/errorMessage";
import { listBos } from "@/lib/repositories/boRepository";
import { BO_STATUS_OPTIONS, getBoStatusLabel, type BoRecord } from "../boTypes";
import { BoStatusBadge } from "../components/BoStatusBadge";

export default function BoOverviewPage() {
  const profile = useAppProfile();
  const [records, setRecords] = useState<BoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (forceRefresh = false) => {
    setLoading(true);
    setError("");
    void listBos({ forceRefresh })
      .then(setRecords)
      .catch((cause) => setError(getBoLoadError(cause)))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const stats = useMemo(() => {
    const count = (status: string) => records.filter((record) => record.status === status).length;
    return [
      {
        label: "Total de B.O.",
        value: records.length,
        note: "Registros ativos",
        icon: ClipboardList,
        tone: "total",
      },
      {
        label: "Pendentes",
        value: count("Pendente"),
        note: "Aguardando início",
        icon: AlertTriangle,
        tone: "pending",
      },
      {
        label: "Em andamento",
        value: count("Em Andamento"),
        note: "Em processamento",
        icon: Clock3,
        tone: "progress",
      },
      {
        label: "Aguardando",
        value: count("Aguardando Terceiros") + count("Aguardando Aprovacao/Revisao"),
        note: "Dependem de retorno",
        icon: Clock3,
        tone: "waiting",
      },
      {
        label: "Concluídos",
        value: count("Concluida"),
        note: "Finalizados",
        icon: CheckCircle2,
        tone: "done",
      },
    ];
  }, [records]);

  const distribution = useMemo(
    () =>
      BO_STATUS_OPTIONS.map((option) => ({
        ...option,
        total: records.filter((record) => record.status === option.value).length,
      })).filter((item) => item.total > 0),
    [records],
  );

  const distributionGradient = useMemo(() => {
    if (!records.length || !distribution.length) return "var(--bo-progress-track)";
    let accumulated = 0;
    const segments = distribution.map((item, index) => {
      const start = accumulated;
      accumulated += (item.total / records.length) * 100;
      return `${getStatusVisualColor(item.value, index)} ${start}% ${accumulated}%`;
    });
    return `conic-gradient(${segments.join(", ")})`;
  }, [distribution, records.length]);

  return (
    <div>
      <header className="flex min-h-12 items-center justify-between gap-4 border-b border-[var(--bo-border)] pb-4">
        <div className="text-[10px] font-black uppercase tracking-[0.15em]">
          <span className="bo-muted">SIPI-B.O / </span>
          <span className="bo-strong">Visão geral</span>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          className="bo-control inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold"
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </header>

      <section className="bo-overview-hero bo-surface mt-5 overflow-hidden rounded-2xl p-5 md:p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="bo-hero-icon flex size-16 shrink-0 items-center justify-center rounded-2xl text-violet-300">
              <ClipboardList className="h-8 w-8" />
            </span>
            <div>
              <p className="bo-kicker !text-violet-400">Módulo operacional</p>
              <h1 className="bo-title mt-1 text-2xl font-black tracking-tight">
                Boletins de Ocorrência
              </h1>
              <p className="bo-muted mt-1 text-sm">
                Cadastro, acompanhamento e vínculos com procedimentos do SIPI.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="bo-hero-count inline-flex h-11 items-center rounded-xl px-4 text-xs font-bold">
              <strong className="mr-1.5 text-base">{loading ? "—" : records.length}</strong>
              registros ativos
            </span>
            {canManageBos(profile) ? (
              <Link
                to="/bo/novo"
                className="bo-primary-button inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black"
              >
                <Plus className="h-4 w-4" /> Novo boletim
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <section className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-5 text-sm text-amber-200">
          <strong className="block">Não foi possível carregar os boletins.</strong>
          <span className="mt-1 block opacity-80">{error}</span>
        </section>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article
              key={stat.label}
              className={`bo-stat-card bo-stat-card--${stat.tone} bo-surface rounded-2xl p-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="bo-kicker">{stat.label}</p>
                  <strong className="bo-strong mt-2 block text-3xl font-black">
                    {loading ? "—" : stat.value.toLocaleString("pt-BR")}
                  </strong>
                  <span className="bo-muted mt-1 block text-[11px]">{stat.note}</span>
                </div>
                <span className="bo-stat-icon rounded-xl p-2">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="bo-surface min-w-0 overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-4 px-5 pb-4 pt-5">
            <div>
              <h2 className="bo-section-title text-sm font-black">Últimos boletins</h2>
              <p className="bo-faint mt-1 text-[10px]">Atualizados mais recentemente</p>
            </div>
            <Link to="/bo/boletins" className="text-xs font-bold text-[var(--bo-accent-strong)]">
              Ver todos ›
            </Link>
          </div>

          {loading ? (
            <div className="bo-muted px-5 py-12 text-center text-sm">Carregando boletins...</div>
          ) : records.length === 0 ? (
            <div className="bo-muted px-5 py-12 text-center text-sm">
              Nenhum boletim cadastrado no SIPI.
            </div>
          ) : (
            <div className="overflow-x-auto px-2 pb-2">
              <div className="min-w-[680px]">
                <div className="bo-table-head grid grid-cols-[1fr_2.1fr_1.2fr_1.1fr_auto] gap-3 px-3 py-2">
                  <span>Nº do B.O.</span>
                  <span>Infração penal</span>
                  <span>Responsável</span>
                  <span>Status</span>
                  <span />
                </div>
                {records.slice(0, 8).map((record) => (
                  <Link
                    key={record.id}
                    to="/bo/$boId"
                    params={{ boId: record.id }}
                    className="bo-row grid grid-cols-[1fr_2.1fr_1.2fr_1.1fr_auto] items-center gap-3 px-3 py-3"
                  >
                    <strong className="bo-strong text-sm font-black">{record.numero_bo}</strong>
                    <span className="bo-muted truncate text-xs" title={record.infracao_penal}>
                      {record.infracao_penal}
                    </span>
                    <span className="bo-muted truncate text-xs">
                      {record.responsavel_nome || "Não informado"}
                    </span>
                    <BoStatusBadge status={record.status} />
                    <ChevronRight className="bo-faint h-4 w-4" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="bo-status-panel bo-surface self-start rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="bo-kicker">Panorama</p>
              <h2 className="bo-section-title mt-1 text-sm font-black">Distribuição por status</h2>
            </div>
            <span className="bo-status-total rounded-lg px-2.5 py-1 text-[10px] font-black">
              {records.length} ativos
            </span>
          </div>

          <div className="bo-donut-wrap mx-auto my-6">
            <div
              className="bo-donut"
              style={{ "--bo-donut-background": distributionGradient } as CSSProperties}
              aria-hidden="true"
            >
              <div className="bo-donut-center">
                <strong>{loading ? "—" : records.length}</strong>
                <span>boletins</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {distribution.length === 0 ? (
              <p className="bo-muted text-xs">Sem dados para consolidar.</p>
            ) : (
              distribution.map((item, index) => {
                const percentage = records.length
                  ? Math.round((item.total / records.length) * 100)
                  : 0;
                return (
                  <div
                    key={item.value}
                    className="bo-status-line flex items-center gap-3 rounded-xl px-3 py-2.5"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: getStatusVisualColor(item.value, index) }}
                    />
                    <span className="bo-muted min-w-0 flex-1 truncate text-xs">
                      {getBoStatusLabel(item.value)}
                    </span>
                    <strong className="bo-strong text-xs">{item.total}</strong>
                    <span className="bo-faint w-8 text-right text-[10px]">{percentage}%</span>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function getStatusVisualColor(status: string, fallbackIndex = 0) {
  const colors: Record<string, string> = {
    Pendente: "#f59e0b",
    "Em Andamento": "#3b82f6",
    Agendada: "#8b5cf6",
    "Aguardando Terceiros": "#f97316",
    Concluida: "#22c55e",
    Cancelada: "#ef4444",
    Suspensa: "#94a3b8",
    "Aguardando Aprovacao/Revisao": "#a855f7",
  };
  return colors[status] ?? ["#6366f1", "#06b6d4", "#ec4899"][fallbackIndex % 3];
}

function getBoLoadError(cause: unknown) {
  const message = getErrorMessage(cause, "");
  if (message.includes("boletins_ocorrencia") || message.includes("PGRST205")) {
    return "A estrutura do módulo ainda precisa ser aplicada ao banco de dados.";
  }
  return message || "Tente novamente em alguns instantes.";
}
