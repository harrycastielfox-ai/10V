import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Plus,
  RefreshCw,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Panel } from "@/components/Panel";
import { useAppProfile } from "@/components/AppProfileContext";
import { canManageBos } from "@/lib/authz";
import { getErrorMessage } from "@/lib/errorMessage";
import { listBos } from "@/lib/repositories/boRepository";
import { BO_STATUS_OPTIONS, getBoStatusLabel, type BoRecord } from "../boTypes";
import { BoStatusBadge } from "../components/BoStatusBadge";

const panelFxClass =
  "rounded-xl transition-all duration-300 border border-border/70 hover:border-purple/55 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_14px_28px_-22px_rgba(139,92,246,0.75)]";
const kpiFxClass = "h-full rounded-xl";

export default function BoOverviewPage() {
  const profile = useAppProfile();
  const navigate = useNavigate();
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

  const count = (status: string) => records.filter((record) => record.status === status).length;
  const pendentes = count("Pendente");
  const emAndamento = count("Em Andamento");
  const aguardando = count("Aguardando Terceiros") + count("Aguardando Aprovacao/Revisao");
  const concluidos = count("Concluida");

  const distribution = useMemo(
    () =>
      BO_STATUS_OPTIONS.map((option) => ({
        ...option,
        total: records.filter((record) => record.status === option.value).length,
      })).filter((item) => item.total > 0),
    [records],
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-1 items-start gap-3">
          <ClipboardList className="mt-1 h-7 w-7 text-purple" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              Boletins de Ocorrência
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastro, acompanhamento e vínculos com procedimentos do SIPI.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManageBos(profile) ? (
            <Link
              to="/bo/novo"
              className="inline-flex items-center gap-2 rounded-lg bg-purple px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple/20 transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Novo boletim
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition hover:bg-accent"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
      </div>

      {error ? <p className="mb-3 text-xs text-muted-foreground">{error}</p> : null}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <div className={kpiFxClass}>
          <StatCard
            label="TOTAL"
            value={loading ? "—" : records.length}
            hint="Registros ativos"
            icon={ClipboardList}
            tone="purple"
            onClick={() => navigate({ to: "/bo/boletins" })}
          />
        </div>
        <div className={kpiFxClass}>
          <StatCard
            label="PENDENTES"
            value={loading ? "—" : pendentes}
            hint="Aguardando início"
            icon={AlertTriangle}
            tone="warning"
            onClick={() => navigate({ to: "/bo/boletins" })}
          />
        </div>
        <div className={kpiFxClass}>
          <StatCard
            label="EM ANDAMENTO"
            value={loading ? "—" : emAndamento}
            hint="Em processamento"
            icon={Clock3}
            tone="info"
            onClick={() => navigate({ to: "/bo/boletins" })}
          />
        </div>
        <div className={kpiFxClass}>
          <StatCard
            label="AGUARDANDO"
            value={loading ? "—" : aguardando}
            hint="Dependem de retorno"
            icon={Clock3}
            tone="muted"
            onClick={() => navigate({ to: "/bo/boletins" })}
          />
        </div>
        <div className={kpiFxClass}>
          <StatCard
            label="CONCLUÍDOS"
            value={loading ? "—" : concluidos}
            hint="Finalizados"
            icon={CheckCircle2}
            tone="success"
            onClick={() => navigate({ to: "/bo/boletins" })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
        <div className={`${panelFxClass} lg:col-span-2`}>
          <Panel
            title="ÚLTIMOS BOLETINS"
            icon={<ClipboardList className="h-4 w-4 text-purple" />}
            accent="purple"
            action={
              <Link to="/bo/boletins" className="text-xs font-bold text-purple">
                Ver todos ›
              </Link>
            }
          >
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Carregando boletins...
              </p>
            ) : records.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum boletim cadastrado no SIPI.
              </p>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <div className="min-w-[560px] px-2">
                  {records.slice(0, 8).map((record) => (
                    <Link
                      key={record.id}
                      to="/bo/$boId"
                      params={{ boId: record.id }}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition hover:bg-purple/[0.06] sm:grid-cols-[100px_1fr_auto_auto]"
                    >
                      <strong className="font-bold">{record.numero_bo}</strong>
                      <span
                        className="hidden truncate text-xs text-muted-foreground sm:block"
                        title={record.infracao_penal}
                      >
                        {record.infracao_penal}
                      </span>
                      <BoStatusBadge status={record.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        <div className={panelFxClass}>
          <Panel title="DISTRIBUIÇÃO POR STATUS" icon={<ClipboardList className="h-4 w-4 text-purple" />} accent="purple">
            {distribution.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados para consolidar.</p>
            ) : (
              <div className="space-y-2.5">
                {distribution.map((item, index) => {
                  const percentage = records.length
                    ? Math.round((item.total / records.length) * 100)
                    : 0;
                  return (
                    <div key={item.value} className="flex items-center gap-3 text-xs">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getStatusVisualColor(item.value, index) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {getBoStatusLabel(item.value)}
                      </span>
                      <strong>{item.total}</strong>
                      <span className="w-9 text-right text-muted-foreground">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
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
