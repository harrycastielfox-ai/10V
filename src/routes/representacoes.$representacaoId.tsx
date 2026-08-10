import {
  Outlet,
  createFileRoute,
  Link,
  useLocation,
  useMatchRoute,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { SipiPrintSheet, type SipiPrintSection } from "@/components/SipiPrintSheet";
import {
  getRepresentacaoById,
  softDeleteRepresentacao,
  type RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";
import { getCurrentProfile } from "@/lib/auth";
import { canViewRepresentacoes } from "@/lib/authz";
import { isMobileViewport } from "@/lib/mobileExperience";
import {
  listMovimentacaoStatusHistory,
  listProceduralTags,
} from "@/lib/repositories/proceduralTagsRepository";
import type { ProceduralStatusHistory, ProceduralTag } from "@/lib/proceduralTags";
import { canAccessSigilosa, isRepresentacaoSigilosa } from "@/lib/representacoesSigilo";
import { Scale, BellRing, Gavel, ShieldCheck, Clock3 } from "lucide-react";

export const Route = createFileRoute("/representacoes/$representacaoId")({
  component: DetalheRepresentacao,
});

function withFallback(value?: string | null) {
  return value?.trim() ? value : "—";
}
function normalizeText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function getStatusAlias(status?: string | null) {
  const n = normalizeText(status);
  if (!n) return "Sem status definido";
  if (n.includes("indefer")) return "Indeferida";
  if (n.includes("cumprida parcialmente")) return "Cumprida parcialmente";
  if (n.includes("cumprid")) return "Cumprida";
  if (n.includes("deferida parcial")) return "Deferida parcialmente";
  if (n.includes("defer")) return "Deferida";
  if (n.includes("aguard")) return "Aguardando decisão judicial";
  if (n.includes("enviad")) return "Enviada ao Judiciário";
  if (n.includes("analis")) return "Em análise";
  if (n.includes("elabor")) return "Em elaboração";
  return status ?? "Sem status definido";
}
function getSituacaoOperacional(status?: string | null) {
  const n = normalizeText(status);
  if (n.includes("indefer")) return "Situação: indeferida";
  if (n.includes("cumprid")) return "Situação: cumprida";
  if (n.includes("defer")) return "Situação: deferida";
  return "Situação: pendente";
}

function getStatusBadgeClass(status?: string | null) {
  const normalized = normalizeText(status);
  if (normalized.includes("deferida") || normalized.includes("cumprida")) {
    return "border-emerald-300/55 bg-emerald-400/20 text-emerald-50";
  }
  if (normalized.includes("indeferida")) {
    return "border-rose-300/55 bg-rose-400/20 text-rose-50";
  }
  if (normalized.includes("aguardando") || normalized.includes("pendente")) {
    return "border-amber-300/60 bg-amber-400/22 text-amber-50";
  }
  if (normalized.includes("enviada") || normalized.includes("analise")) {
    return "border-sky-300/55 bg-sky-400/18 text-sky-50";
  }
  return "border-zinc-300/45 bg-zinc-500/16 text-zinc-50";
}

function getPrioridadeBadgeClass(prioridade?: string | null) {
  const normalized =
    prioridade
      ?.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") ?? "";
  if (normalized.includes("urgente")) return "border-rose-300/60 bg-rose-400/22 text-rose-50";
  if (normalized.includes("alta")) return "border-amber-300/60 bg-amber-400/22 text-amber-50";
  if (normalized.includes("media")) return "border-amber-300/60 bg-amber-400/22 text-amber-50";
  if (normalized.includes("baixa") || normalized.includes("normal"))
    return "border-emerald-300/55 bg-emerald-400/20 text-emerald-50";
  return "border-zinc-300/45 bg-zinc-600/30 text-zinc-50";
}
function isEmptyValue(value?: string | null) {
  return !value?.trim();
}

function hasPrintableRepresentacaoValue(value?: string | null) {
  const normalized = normalizeText(value);
  return (
    Boolean(normalized) &&
    !["-", "—", "selecione", "sem informacao", "nao informado"].includes(normalized)
  );
}

function onlyPopulatedItems(items: Array<[string, string | null | undefined]>) {
  return items.filter(([, value]) => hasPrintableRepresentacaoValue(value));
}

function isPrintHiddenRepresentacaoLabel(label: string) {
  return label === "PPE vinculado / Procedimento relacionado";
}

function getPrintRepresentacaoFieldClass(label: string, value?: string | null) {
  return isPrintHiddenRepresentacaoLabel(label) || !hasPrintableRepresentacaoValue(value)
    ? "sipi-print-empty-field "
    : "";
}

function hasPrintableRepresentacaoSection(items: Array<[string, string | null | undefined]>) {
  return items.some(
    ([label, value]) =>
      !isPrintHiddenRepresentacaoLabel(label) && hasPrintableRepresentacaoValue(value),
  );
}

function formatPrazoStatus(item: RepresentacaoRecord) {
  if (item.data_cumprimento) return "Cumprida";
  if (!item.data_vencimento) return "Sem vencimento";
  const due = new Date(item.data_vencimento);
  const now = new Date();
  const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueDate.getTime() - nowDate.getTime()) / 86400000);
  if (diffDays > 0) return `Vence em ${diffDays} dia${diffDays === 1 ? "" : "s"}`;
  if (diffDays < 0) {
    const late = Math.abs(diffDays);
    return `Vencida há ${late} dia${late === 1 ? "" : "s"}`;
  }
  return "Vence hoje";
}

type TimelineTone = "neutral" | "success" | "warning" | "danger";
type TimelineEvent = {
  key: string;
  title: string;
  description?: string;
  date?: string;
  badge?: string;
  tone: TimelineTone;
  icon: string;
};

function formatDateBR(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR");
}

function getTimelineToneClass(tone: TimelineTone) {
  if (tone === "success") return "border-emerald-400/30 bg-emerald-400/12 text-emerald-200";
  if (tone === "warning") return "border-amber-300/35 bg-amber-300/12 text-amber-100";
  if (tone === "danger") return "border-rose-400/35 bg-rose-400/12 text-rose-200";
  return "border-zinc-500/45 bg-zinc-700/25 text-zinc-200";
}
function getTimelineIconCircleClass(event: TimelineEvent) {
  if (event.key === "created") return "border-blue-400/35 bg-blue-500/15 text-blue-200";
  if (event.key === "sent-judiciary")
    return "border-indigo-400/35 bg-indigo-500/15 text-indigo-200";
  if (event.key === "deadline") {
    if (event.tone === "danger") return "border-rose-400/40 bg-rose-500/15 text-rose-200";
    if (event.tone === "success") return "border-emerald-400/35 bg-emerald-500/15 text-emerald-200";
    return "border-amber-300/45 bg-amber-400/15 text-amber-100";
  }
  if (event.key === "judicial-decision") return "border-zinc-400/45 bg-zinc-700/35 text-zinc-100";
  if (event.key === "special-tracking")
    return "border-violet-400/35 bg-violet-500/15 text-violet-200";
  if (event.tone === "success") return "border-emerald-400/35 bg-emerald-500/15 text-emerald-200";
  if (event.tone === "danger") return "border-rose-400/40 bg-rose-500/15 text-rose-200";
  if (event.tone === "warning") return "border-amber-300/45 bg-amber-400/15 text-amber-100";
  return "border-zinc-500/45 bg-zinc-700/35 text-zinc-100";
}

function buildTimelineEvents(item: RepresentacaoRecord): TimelineEvent[] {
  const events: Array<TimelineEvent & { sortTime: number }> = [];
  const addEvent = (event: TimelineEvent) => {
    const sortTime = event.date ? new Date(event.date).getTime() : Number.POSITIVE_INFINITY;
    events.push({
      ...event,
      sortTime: Number.isNaN(sortTime) ? Number.POSITIVE_INFINITY : sortTime,
    });
  };

  if (item.created_at)
    addEvent({
      key: "created",
      title: "Movimentação cadastrada",
      description: "Registro inicial da movimentação processual no sistema.",
      date: item.created_at,
      tone: "neutral",
      icon: "◦",
    });
  if (item.data_protocolo ?? item.data_representacao)
    addEvent({
      key: "protocol",
      title: "Protocolo registrado",
      description: "Data única de protocolo da movimentação.",
      date: item.data_protocolo ?? item.data_representacao ?? undefined,
      tone: "neutral",
      icon: "↗",
    });
  if (item.data_decisao_judicial)
    addEvent({
      key: "judicial-decision",
      title: "Decisão judicial registrada",
      description: isEmptyValue(item.observacoes_decisao)
        ? undefined
        : (item.observacoes_decisao ?? undefined),
      date: item.data_decisao_judicial,
      tone: "neutral",
      icon: "⚖",
    });

  if ((item.prazo_concedido_dias ?? 0) > 0 || item.data_vencimento) {
    const due = item.data_vencimento ? new Date(item.data_vencimento) : null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const isOverdue = due ? due.getTime() < today : false;
    addEvent({
      key: "deadline",
      title: "Prazo definido",
      description:
        item.prazo_concedido_dias != null
          ? `Prazo concedido: ${item.prazo_concedido_dias} dia(s).`
          : undefined,
      date: item.data_vencimento ?? undefined,
      badge: formatPrazoStatus(item),
      tone: item.data_cumprimento ? "success" : isOverdue ? "danger" : "warning",
      icon: "⏱",
    });
  }

  const statusNormalized = normalizeText(item.status);
  if (statusNormalized.includes("deferida"))
    addEvent({
      key: "status-deferida",
      title: "Representação deferida",
      date: item.data_decisao_judicial ?? undefined,
      tone: "success",
      icon: "✓",
    });
  if (statusNormalized.includes("indeferida"))
    addEvent({
      key: "status-indeferida",
      title: "Representação indeferida",
      date: item.data_decisao_judicial ?? undefined,
      tone: "danger",
      icon: "✕",
    });
  if (statusNormalized.includes("cumprida"))
    addEvent({
      key: "status-cumprida",
      title: "Cumprimento informado",
      description: isEmptyValue(item.resultado_cumprimento)
        ? undefined
        : (item.resultado_cumprimento ?? undefined),
      date: item.data_cumprimento ?? undefined,
      tone: "success",
      icon: "✔",
    });
  if (item.acompanhamento_especial)
    addEvent({
      key: "special-tracking",
      title: "Marcada como acompanhamento especial",
      description: "Sinalização interna de acompanhamento prioritário.",
      tone: "warning",
      icon: "⚑",
    });

  return events.sort((a, b) => a.sortTime - b.sortTime).map(({ sortTime, ...event }) => event);
}

function getTopIndicatorBadgeClass(label: string, value?: string | null) {
  const normalized = normalizeText(value);
  if (label === "Situação") {
    if (normalized.includes("indefer")) return "border-rose-300/55 bg-rose-400/20 text-rose-50";
    if (normalized.includes("defer") || normalized.includes("cumpr"))
      return "border-emerald-300/55 bg-emerald-400/20 text-emerald-50";
    return "border-amber-300/60 bg-amber-400/22 text-amber-50";
  }
  if (label === "Prazo") {
    if (normalized.includes("vencida")) return "border-rose-300/60 bg-rose-400/22 text-rose-50";
    if (normalized.includes("cumprida"))
      return "border-emerald-300/55 bg-emerald-400/20 text-emerald-50";
    return "border-sky-300/55 bg-sky-400/18 text-sky-50";
  }
  if (label === "Acomp. especial") {
    if (normalized === "sim") return "border-violet-300/55 bg-violet-400/20 text-violet-50";
    if (normalized === "nao") return "border-zinc-300/45 bg-zinc-500/14 text-zinc-100";
  }
  if (label === "Sigilosa") {
    if (normalized.includes("sim") || normalized.includes("sigil"))
      return "border-amber-300/55 bg-amber-400/18 text-amber-50";
    if (normalized.includes("nao") || normalized.includes("não"))
      return "border-zinc-300/45 bg-zinc-500/14 text-zinc-100";
  }
  return "border-zinc-300/45 bg-zinc-600/24 text-zinc-50";
}

function DetalheRepresentacao() {
  const { representacaoId } = Route.useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const matchRoute = useMatchRoute();
  const isEditingRoute = Boolean(
    matchRoute({ to: "/representacoes/$representacaoId/editar", params: { representacaoId } }),
  );
  const [item, setItem] = useState<RepresentacaoRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [sigiloRestricted, setSigiloRestricted] = useState(false);
  const [statusHistory, setStatusHistory] = useState<ProceduralStatusHistory[]>([]);
  const [statusTags, setStatusTags] = useState<ProceduralTag[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError("");
      setSigiloRestricted(false);

      const currentProfile = await getCurrentProfile();
      if (!canViewRepresentacoes(currentProfile)) {
        if (active) setRestricted(true);
        if (active) setLoading(false);
        return;
      }
      if (active) setRestricted(false);

      try {
        const [data, historyResult, tagsResult] = await Promise.all([
          getRepresentacaoById(representacaoId),
          listMovimentacaoStatusHistory(representacaoId).catch(() => []),
          listProceduralTags(["movimentacao_status"]).catch(() => []),
        ]);
        if (!active) return;
        const isSigilosa = isRepresentacaoSigilosa(data);
        const userCanAccessSigilo = canAccessSigilosa(currentProfile);
        if (isSigilosa && !userCanAccessSigilo) {
          setSigiloRestricted(true);
          setItem(null);
          return;
        }
        setSigiloRestricted(false);
        setItem(data);
        setStatusHistory(historyResult);
        setStatusTags(tagsResult);
      } catch (err: unknown) {
        if (!active) return;
        const maybeError = err as { code?: string; message?: string };
        if (maybeError?.code === "42501") {
          setError(
            "Sem permissão para visualizar esta movimentação. Verifique a policy de SELECT da tabela public.representacoes.",
          );
        } else {
          setError("Não foi possível carregar a movimentação agora.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [representacaoId, location.pathname]);

  const statusTagNames = useMemo(
    () => new Map(statusTags.map((tag) => [tag.id, tag.name])),
    [statusTags],
  );

  if (isEditingRoute) return <Outlet />;
  if (restricted)
    return (
      <AppLayout>
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Seu perfil não possui permissão para acessar Representações.
          </p>
          <Link to="/modulos" className="px-4 py-2 border border-border rounded-lg inline-block">
            Voltar
          </Link>
        </div>
      </AppLayout>
    );
  if (loading) return <AppLayout>Carregando movimentação...</AppLayout>;
  if (error) return <AppLayout>{error}</AppLayout>;
  if (sigiloRestricted)
    return (
      <AppLayout>
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Movimentação sigilosa</h1>
          <p className="text-sm text-muted-foreground">
            Movimentação sigilosa. O acesso depende de autorização individual ativada no perfil.
          </p>
          <Link
            to="/representacoes"
            className="px-4 py-2 border border-border rounded-lg inline-block"
          >
            Voltar para lista
          </Link>
        </div>
      </AppLayout>
    );
  if (!item)
    return (
      <AppLayout>
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Movimentação não encontrada ou removida</h1>
          <p className="text-sm text-muted-foreground">
            Esta movimentação não está mais disponível para visualização.
          </p>
          <Link
            to="/representacoes"
            className="px-4 py-2 border border-border rounded-lg inline-block"
          >
            Voltar
          </Link>
        </div>
      </AppLayout>
    );

  const remove = async () => {
    if (!item || isDeleting || isMobileViewport()) return;

    setIsDeleting(true);
    try {
      await softDeleteRepresentacao(item.id);
      setShowDeleteModal(false);
      navigate({ to: "/representacoes" });
    } catch {
      alert("Não foi possível excluir a movimentação agora.");
    } finally {
      setIsDeleting(false);
    }
  };

  const subtitleParts = [
    item.tipo,
    item.processo_judicial ? `Processo: ${item.processo_judicial}` : "",
  ].filter(Boolean);
  const statusAlias = getStatusAlias(item.status);
  const situacaoOperacional = getSituacaoOperacional(item.status);
  const prioridadeText = withFallback(item.prioridade_operacional);
  const sectionCardClass = "self-start rounded-xl border border-border/60 bg-card/80 p-4 lg:p-5";
  const sectionTitleClass = "text-xs font-extrabold uppercase tracking-[0.16em] text-primary";
  const infoRowClass = "grid gap-1 py-2.5 sm:grid-cols-[190px_1fr] sm:gap-3";
  const summaryCardClass = "self-start rounded-md border border-border/70 bg-card/65 px-3 py-2.5";
  const cardSections: Array<{ title: string; items: Array<[string, string | null | undefined]> }> =
    [
      {
        title: "Identificação Judicial",
        items: [
          ["PPE vinculado / Procedimento relacionado", item.numero_ppe],
          ["Processo judicial", item.processo_judicial],
          ["Tipo de protocolo", item.tipo],
          ["Data do protocolo", item.data_protocolo ?? item.data_representacao],
        ],
      },
      {
        title: "Tramitação Judicial",
        items: [
          ["Status", item.status],
          ["Vara / Juízo", item.vara_juizo],
          [
            "Prazo concedido (dias)",
            item.prazo_concedido_dias && item.prazo_concedido_dias > 0
              ? item.prazo_concedido_dias.toString()
              : null,
          ],
          ["Data de vencimento", item.data_vencimento],
          ["Data da decisão judicial", item.data_decisao_judicial],
          ["Data de cumprimento", item.data_cumprimento],
          ["Situação do cumprimento", item.cumprimento_status],
          ["Resultado do cumprimento", item.resultado_cumprimento],
          ["Observações do cumprimento", item.observacoes_cumprimento],
          ["Observações da decisão", item.observacoes_decisao],
        ],
      },
      {
        title: "Classificação e observações",
        items: [
          ["Prioridade", item.prioridade_operacional],
          ["Sigilo", item.pedido_sigiloso],
          [
            "Observações",
            item.observacoes_movimentacao ??
              item.observacoes_decisao ??
              item.observacoes_cumprimento,
          ],
        ],
      },
    ];
  const visibleCardSections = cardSections
    .map((section) => ({ ...section, items: onlyPopulatedItems(section.items) }))
    .filter((section) => section.items.length > 0);
  const summaryItems: Array<[string, string]> = [];
  if (hasPrintableRepresentacaoValue(item.status)) {
    summaryItems.push(
      ["Status judicial", statusAlias],
      ["Situação", situacaoOperacional.replace("Situação: ", "")],
    );
  }
  if (hasPrintableRepresentacaoValue(item.prioridade_operacional)) {
    summaryItems.push(["Prioridade", prioridadeText]);
  }
  if (item.data_vencimento || item.data_cumprimento) {
    summaryItems.push(["Prazo", formatPrazoStatus(item)]);
  }
  if (hasPrintableRepresentacaoValue(item.pedido_sigiloso)) {
    summaryItems.push(["Sigilosa", item.pedido_sigiloso!]);
  }
  const hasOperationalAlerts = Boolean(item.data_vencimento);
  const timelineEvents = buildTimelineEvents(item);
  const printSections: SipiPrintSection[] = [
    ...visibleCardSections.map((section) => ({
      title: section.title,
      fields: section.items
        .filter(([label]) => label !== "PPE vinculado / Procedimento relacionado")
        .map(([label, value]) => ({ label, value })),
    })),
    {
      title: "Vínculo com o procedimento",
      fields: [
        { label: "PPE / Procedimento relacionado", value: item.numero_ppe },
        {
          label: "Justificativa quando não há inquérito vinculado",
          value: item.justificativa_sem_inquerito,
          wide: true,
        },
      ],
    },
  ];

  return (
    <AppLayout>
      <div className="sipi-print-document mx-auto w-full max-w-[1480px] space-y-4 px-1 lg:px-2">
        <SipiPrintSheet
          documentTitle="Ficha de Movimentação Processual"
          documentSubtitle="Conferência, tramitação e acompanhamento da medida"
          identifierLabel={item.numero_ppe ? "PPE" : "Processo"}
          identifier={item.numero_ppe || item.processo_judicial || "Sem identificação"}
          summary={[
            { label: "Tipo", value: item.tipo },
            { label: "Status judicial", value: statusAlias },
            { label: "Prioridade", value: item.prioridade_operacional },
            { label: "Prazo", value: item.data_vencimento ? formatPrazoStatus(item) : null },
            {
              label: "Sigilo",
              value: isRepresentacaoSigilosa(item) ? "Movimentação sigilosa" : null,
            },
          ]}
          sections={printSections}
        />
        <header className="sipi-print-hidden rounded-xl border border-border/70 bg-card/65 p-4 lg:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold break-words text-zinc-100">
                  {isRepresentacaoSigilosa(item)
                    ? "Movimentação sigilosa"
                    : "Movimentação Processual"}
                </h1>
                {isRepresentacaoSigilosa(item) ? (
                  <span className="inline-flex items-center rounded-full border border-amber-300/55 bg-amber-400/18 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.12)]">
                    Sigilo ativo
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm break-words text-muted-foreground">
                {subtitleParts.length > 0
                  ? subtitleParts.join(" • ")
                  : "Detalhes da movimentação processual cadastrada"}
              </p>
              {item.numero_ppe || item.processo_judicial ? (
                <p className="sipi-print-hidden mt-2 text-sm break-words text-foreground">
                  {item.numero_ppe
                    ? `PPE/Procedimento: ${item.numero_ppe}`
                    : `Processo/PPE: ${item.processo_judicial}`}
                </p>
              ) : null}
            </div>

            <div className="sipi-print-actions flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 text-xs rounded-md border border-border bg-card hover:bg-accent"
              >
                Gerar PDF
              </button>
              <button
                onClick={() =>
                  navigate({
                    to: "/representacoes/$representacaoId/editar",
                    params: { representacaoId: item.id },
                  })
                }
                className="hidden rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground md:inline-flex"
              >
                Editar
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="hidden rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs text-destructive md:inline-flex"
              >
                Excluir
              </button>
            </div>
          </div>
        </header>

        {summaryItems.length > 0 ? (
          <section className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {summaryItems.map(([label, value]) => (
              <article key={label} className={summaryCardClass}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {label}
                </p>
                {label === "Status judicial" ? (
                  <span
                    className={`mt-1 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getStatusBadgeClass(item.status)}`}
                  >
                    {value}
                  </span>
                ) : label === "Prioridade" ? (
                  <span
                    className={`mt-1 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getPrioridadeBadgeClass(item.prioridade_operacional)}`}
                  >
                    {value}
                  </span>
                ) : (
                  <span
                    className={`mt-1 inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getTopIndicatorBadgeClass(label, value)}`}
                  >
                    {value}
                  </span>
                )}
              </article>
            ))}
          </section>
        ) : null}

        <section className="grid items-start gap-4 xl:grid-cols-2">
          <div className="space-y-4 self-start">
            {visibleCardSections
              .filter(({ title }) => title === "Identificação Judicial")
              .map(({ title, items }) => (
                <article
                  key={title}
                  className={`${hasPrintableRepresentacaoSection(items) ? "" : "sipi-print-empty-card "}${sectionCardClass}`}
                >
                  <div className="flex items-center gap-2 pb-2">
                    <Scale className="h-4 w-4 text-primary" />
                    <h2 className={sectionTitleClass}>{title}</h2>
                  </div>
                  <div className="mb-3 h-px w-full bg-border/70" />
                  <div className="divide-y divide-border/60">
                    {items.map(([label, value]) => (
                      <div
                        key={label}
                        className={`${getPrintRepresentacaoFieldClass(label, value)}${infoRowClass}`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                          {label}
                        </p>
                        <p
                          className={`text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${isEmptyValue(value) ? "text-zinc-500" : "text-foreground"}`}
                        >
                          {withFallback(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            {hasOperationalAlerts ? (
              <article className={sectionCardClass}>
                <div className="flex items-center gap-2 pb-2">
                  <BellRing className="h-4 w-4 text-primary" />
                  <h2 className={sectionTitleClass}>Pendências e Alertas</h2>
                </div>
                <div className="mb-3 h-px w-full bg-border/70" />
                <div className="space-y-2">
                  {item.data_vencimento ? (
                    <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Prazo operacional
                      </p>
                      <p className="mt-1 text-sm text-foreground">{formatPrazoStatus(item)}</p>
                    </div>
                  ) : null}
                </div>
              </article>
            ) : null}
          </div>

          <div className="space-y-4 self-start">
            {visibleCardSections
              .filter(
                ({ title }) =>
                  title === "Tramitação Judicial" || title === "Classificação e observações",
              )
              .map(({ title, items }) => (
                <article
                  key={title}
                  className={`${hasPrintableRepresentacaoSection(items) ? "" : "sipi-print-empty-card "}${sectionCardClass}`}
                >
                  <div className="flex items-center gap-2 pb-2">
                    {title === "Tramitação Judicial" ? (
                      <Gavel className="h-4 w-4 text-primary" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    )}
                    <h2 className={sectionTitleClass}>{title}</h2>
                  </div>
                  <div className="mb-3 h-px w-full bg-border/70" />
                  <div className="divide-y divide-border/60">
                    {items.map(([label, value]) => (
                      <div
                        key={label}
                        className={`${getPrintRepresentacaoFieldClass(label, value)}grid gap-1 py-2.5 sm:grid-cols-[170px_1fr] sm:gap-3`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                          {label}
                        </p>
                        {title === "Tramitação Judicial" && label === "Status" ? (
                          <span
                            className={`mt-0.5 inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getStatusBadgeClass(item.status)}`}
                          >
                            {withFallback(value)}
                          </span>
                        ) : (
                          <p
                            className={`text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${isEmptyValue(value) ? "text-zinc-500" : "text-foreground"}`}
                          >
                            {withFallback(value)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
          </div>
        </section>

        <section className={`${sectionCardClass} sipi-print-hidden`}>
          <div className="flex items-center gap-2 pb-2">
            <Clock3 className="h-4 w-4 text-primary" />
            <h2 className={sectionTitleClass}>Histórico de status</h2>
          </div>
          <div className="mb-3 h-px w-full bg-border/70" />
          {statusHistory.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {statusHistory.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg border border-border/60 bg-background/30 px-3 py-2.5"
                >
                  <p className="text-xs font-semibold text-foreground">
                    {event.previous_status_tag_id
                      ? `${statusTagNames.get(event.previous_status_tag_id) ?? "Status anterior"} → `
                      : ""}
                    {statusTagNames.get(event.status_tag_id) ?? "Status atualizado"}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDateBR(event.changed_at) ?? "Data não informada"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              O histórico será formado automaticamente nas próximas mudanças de status.
            </p>
          )}
        </section>

        <section className={sectionCardClass}>
          <div className="flex items-center gap-2 pb-2">
            <Clock3 className="h-4 w-4 text-primary" />
            <h2 className={sectionTitleClass}>Linha do Tempo Operacional</h2>
          </div>
          <div className="mb-3 h-px w-full bg-border/70" />
          {timelineEvents.length === 0 ? (
            <div className="rounded-lg border border-border/40 bg-muted/5 px-4 py-3 text-sm text-zinc-400">
              Sem eventos operacionais automáticos disponíveis para esta representação.
            </div>
          ) : (
            <ol className="relative ml-1 space-y-4 border-l border-border/60 pl-5">
              {timelineEvents.map((event) => {
                const dateLabel = formatDateBR(event.date);
                const isCritical =
                  event.tone === "danger" &&
                  event.key === "deadline" &&
                  Boolean(event.badge?.toLowerCase().includes("vencida"));
                return (
                  <li key={event.key} className="relative pl-6">
                    <span
                      className={`absolute -left-[1.64rem] top-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_8px_18px_rgba(0,0,0,0.35)] ${getTimelineIconCircleClass(event)}`}
                    >
                      {event.icon}
                    </span>
                    <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-zinc-100">{event.title}</p>
                      {event.badge ? (
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getTimelineToneClass(event.tone)}`}
                        >
                          {event.badge}
                        </span>
                      ) : null}
                    </div>
                    {event.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
                    ) : null}
                    <p className={`mt-1 text-xs ${isCritical ? "text-rose-300" : "text-zinc-400"}`}>
                      {dateLabel ?? "Data não informada"}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 max-md:hidden">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground">Excluir movimentação</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Deseja remover esta movimentação? Esta ação poderá ser registrada em auditoria no
              sistema final.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={isDeleting}
                className="rounded-md border border-destructive/30 bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
