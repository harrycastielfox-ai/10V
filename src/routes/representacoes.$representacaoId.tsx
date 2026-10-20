import {
  Outlet,
  createFileRoute,
  Link,
  useLocation,
  useMatchRoute,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";
import { SipiPrintSheet, type SipiPrintSection } from "@/components/SipiPrintSheet";
import {
  getRepresentacaoById,
  softDeleteRepresentacao,
  type RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";
import { getCurrentProfile } from "@/lib/auth";
import {
  canDeleteRepresentacoes,
  canEditRepresentacoes,
  canViewRepresentacoes,
  type UserProfile,
} from "@/lib/authz";
import { isMobileViewport } from "@/lib/mobileExperience";
import {
  listMovimentacaoStatusHistory,
  listProceduralTags,
} from "@/lib/repositories/proceduralTagsRepository";
import type { ProceduralStatusHistory, ProceduralTag } from "@/lib/proceduralTags";
import { canAccessSigilosa, isRepresentacaoSigilosa } from "@/lib/representacoesSigilo";
import {
  ArrowLeft,
  BellRing,
  Check,
  Clock3,
  Copy,
  Gavel,
  Lock,
  MoreVertical,
  Pencil,
  Printer,
  Scale,
  ShieldCheck,
  Trash2,
} from "lucide-react";

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
    return "border-primary/35 bg-primary/10 text-primary";
  }
  if (normalized.includes("indeferida")) {
    return "border-destructive/35 bg-destructive/10 text-destructive";
  }
  if (normalized.includes("aguardando") || normalized.includes("pendente")) {
    return "border-warning/40 bg-warning/10 text-warning";
  }
  if (normalized.includes("enviada") || normalized.includes("analise")) {
    return "border-info/35 bg-info/10 text-info";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}

function getPrioridadeBadgeClass(prioridade?: string | null) {
  const normalized = normalizeText(prioridade);
  if (normalized.includes("urgente"))
    return "border-destructive/35 bg-destructive/10 text-destructive";
  if (normalized.includes("alta")) return "border-warning/40 bg-warning/10 text-warning";
  if (normalized.includes("media")) return "border-warning/40 bg-warning/10 text-warning";
  if (normalized.includes("baixa") || normalized.includes("normal"))
    return "border-primary/35 bg-primary/10 text-primary";
  return "border-border bg-muted/40 text-muted-foreground";
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
  if (tone === "success") return "border-primary/35 bg-primary/10 text-primary";
  if (tone === "warning") return "border-warning/40 bg-warning/10 text-warning";
  if (tone === "danger") return "border-destructive/35 bg-destructive/10 text-destructive";
  return "border-border bg-muted/40 text-muted-foreground";
}
function getTimelineIconCircleClass(event: TimelineEvent) {
  if (event.key === "created") return "border-info/35 bg-info/10 text-info";
  if (event.key === "sent-judiciary") return "border-info/35 bg-info/10 text-info";
  if (event.key === "deadline") {
    if (event.tone === "danger") return "border-destructive/40 bg-destructive/10 text-destructive";
    if (event.tone === "success") return "border-primary/35 bg-primary/10 text-primary";
    return "border-warning/40 bg-warning/10 text-warning";
  }
  if (event.key === "judicial-decision") return "border-border bg-muted/40 text-foreground";
  if (event.key === "special-tracking")
    return "border-violet-400/35 bg-violet-500/10 text-violet-500";
  if (event.tone === "success") return "border-primary/35 bg-primary/10 text-primary";
  if (event.tone === "danger") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (event.tone === "warning") return "border-warning/40 bg-warning/10 text-warning";
  return "border-border bg-muted/40 text-muted-foreground";
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

function getOperationalTone(
  label: "Status" | "Prazo" | "Prioridade" | "Sigilo",
  item: RepresentacaoRecord,
): keyof typeof OPERATIONAL_TONES {
  if (label === "Status") {
    const n = normalizeText(item.status);
    if (n.includes("indefer")) return "red";
    if (n.includes("defer") || n.includes("cumpr")) return "emerald";
    return "amber";
  }
  if (label === "Prazo") {
    if (item.data_cumprimento) return "emerald";
    if (!item.data_vencimento) return "slate";
    const due = new Date(item.data_vencimento);
    const today = new Date();
    return due.getTime() <
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
      ? "red"
      : "amber";
  }
  if (label === "Prioridade") {
    const n = normalizeText(item.prioridade_operacional);
    if (n.includes("urgente")) return "red";
    if (n.includes("alta") || n.includes("media")) return "amber";
    return "slate";
  }
  return isRepresentacaoSigilosa(item) ? "violet" : "slate";
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
      if (active) setProfile(currentProfile);
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

  const sigiloso = isRepresentacaoSigilosa(item);
  const headerIdentifier = item.numero_ppe || item.processo_judicial || "Sem identificação";
  const statusAlias = getStatusAlias(item.status);
  const situacaoOperacional = getSituacaoOperacional(item.status);
  const prioridadeText = withFallback(item.prioridade_operacional);
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
        ],
      },
    ];
  const visibleCardSections = cardSections
    .map((section) => ({ ...section, items: onlyPopulatedItems(section.items) }))
    .filter((section) => section.items.length > 0);
  const observacoesTexto =
    item.observacoes_movimentacao ?? item.observacoes_decisao ?? item.observacoes_cumprimento;
  const classificacaoItems = onlyPopulatedItems([
    ["Prioridade", item.prioridade_operacional],
    ["Sigilo", item.pedido_sigiloso],
  ]);

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
      title: "Classificação e observações",
      fields: [
        ...classificacaoItems.map(([label, value]) => ({ label, value })),
        { label: "Observações", value: observacoesTexto, wide: true },
      ],
    },
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
      <div className="sipi-print-document mx-auto w-full max-w-[1480px] space-y-3 px-1 lg:px-2">
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
              value: sigiloso ? "Movimentação sigilosa" : null,
            },
          ]}
          sections={printSections}
        />

        <header className="sipi-print-hidden flex flex-col gap-3 rounded-lg border border-border/70 bg-card/80 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="h-10 w-1 shrink-0 rounded-full bg-primary shadow-[0_0_14px_rgba(52,211,153,0.45)]" />
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Link
                to="/representacoes"
                aria-label="Voltar para movimentações processuais"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 text-xs font-bold text-primary transition-colors hover:border-primary/45 hover:bg-primary/10"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Link>
              <span className="hidden h-9 w-px shrink-0 bg-border/70 sm:block" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-extrabold text-muted-foreground sm:text-base">
                    Movimentação Nº:
                  </span>
                  <h1 className="min-w-0 max-w-full font-mono text-base font-black tracking-tight text-foreground sm:max-w-[min(42vw,34rem)] sm:text-lg">
                    <CopyableDetailValue value={headerIdentifier} />
                  </h1>
                </div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-muted-foreground">
                  <span className="truncate">{withFallback(item.tipo)}</span>
                  <span className="text-border">•</span>
                  <span className="truncate">{statusAlias}</span>
                  {sigiloso ? (
                    <>
                      <span className="text-border">•</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/40 bg-purple-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-purple-500">
                        <Lock className="h-3 w-3" />
                        Sigiloso
                      </span>
                    </>
                  ) : null}
                </div>
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
            {canEditRepresentacoes(profile) ? (
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/representacoes/$representacaoId/editar",
                    params: { representacaoId: item.id },
                  })
                }
                className="hidden h-10 items-center gap-2 rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 md:inline-flex"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
            ) : null}
            {canDeleteRepresentacoes(profile) ? (
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
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isDeleting}
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />{" "}
                    {isDeleting ? "Excluindo..." : "Excluir movimentação"}
                  </button>
                </div>
              </details>
            ) : null}
          </div>
        </header>

        {summaryItems.length > 0 ? (
          <section className="sipi-print-hidden grid overflow-hidden rounded-lg border border-border/65 bg-card/55 sm:grid-cols-2 xl:grid-cols-4">
            <OperationalMetric
              icon={<Scale className="h-5 w-5" />}
              label="Status"
              value={statusAlias}
              tone={getOperationalTone("Status", item)}
            />
            <OperationalMetric
              icon={<Clock3 className="h-5 w-5" />}
              label="Prazo"
              value={formatPrazoStatus(item)}
              tone={getOperationalTone("Prazo", item)}
            />
            <OperationalMetric
              icon={<BellRing className="h-5 w-5" />}
              label="Prioridade"
              value={prioridadeText}
              tone={getOperationalTone("Prioridade", item)}
            />
            <OperationalMetric
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Sigilo"
              value={sigiloso ? "Sigilosa" : "Não"}
              tone={getOperationalTone("Sigilo", item)}
            />
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="grid items-start gap-3">
            {visibleCardSections.map(({ title, items }) => (
              <DetailSection
                key={title}
                title={title}
                icon={
                  title === "Identificação Judicial" ? (
                    <Scale className="h-4 w-4" />
                  ) : (
                    <Gavel className="h-4 w-4" />
                  )
                }
                contentClassName="p-0"
                className={hasPrintableRepresentacaoSection(items) ? "" : "sipi-print-empty-card"}
              >
                <ProcedureDataGrid
                  columns={3}
                  items={items
                    .filter(([label]) => !isPrintHiddenRepresentacaoLabel(label))
                    .map(([label, value]) => ({
                      label,
                      value: withFallback(value),
                      tone:
                        title === "Tramitação Judicial" && label === "Status"
                          ? getStatusTone(item.status)
                          : "slate",
                    }))}
                />
              </DetailSection>
            ))}
          </div>

          <DetailSection
            title="Classificação e observações"
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            {classificacaoItems.length > 0 ? (
              <div className="mb-3 border-b border-border/55 pb-3">
                <ProcedureDataGrid
                  columns={2}
                  items={classificacaoItems.map(([label, value]) => ({
                    label,
                    value: withFallback(value),
                  }))}
                />
              </div>
            ) : null}
            {hasPrintableRepresentacaoValue(observacoesTexto) ? (
              <p className="max-w-[110ch] whitespace-pre-wrap break-words text-sm font-medium leading-7 text-foreground [overflow-wrap:anywhere]">
                {observacoesTexto}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma observação informada.</p>
            )}
          </DetailSection>

          {hasOperationalAlerts ? (
            <DetailSection title="Pendências e Alertas" icon={<BellRing className="h-4 w-4" />}>
              <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Prazo operacional
                </p>
                <p className="mt-1 text-sm text-foreground">{formatPrazoStatus(item)}</p>
              </div>
            </DetailSection>
          ) : null}

          <DetailSection
            title="Histórico de status"
            icon={<Clock3 className="h-4 w-4" />}
            className="sipi-print-hidden"
          >
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
          </DetailSection>

          <DetailSection title="Linha do Tempo Operacional" icon={<Clock3 className="h-4 w-4" />}>
            {timelineEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
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
                        className={`absolute -left-[1.64rem] top-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm ${getTimelineIconCircleClass(event)}`}
                      >
                        {event.icon}
                      </span>
                      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                        <p className="text-sm font-semibold text-foreground">{event.title}</p>
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
                      <p
                        className={`mt-1 text-xs ${isCritical ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {dateLabel ?? "Data não informada"}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </DetailSection>
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

function getStatusTone(status?: string | null): "emerald" | "amber" | "slate" {
  const n = normalizeText(status);
  if (n.includes("defer") || n.includes("cumpr")) return "emerald";
  if (n.includes("aguard") || n.includes("pendente") || n.includes("indefer")) return "amber";
  return "slate";
}

const OPERATIONAL_TONES = {
  emerald: "text-primary",
  red: "text-destructive",
  amber: "text-warning",
  violet: "text-violet-500",
  slate: "text-foreground",
} as const;

function OperationalMetric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: keyof typeof OPERATIONAL_TONES;
}) {
  return (
    <div className="grid min-h-[6.5rem] min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 border-b border-border/60 px-4 py-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-current/20 bg-current/5 ${OPERATIONAL_TONES[tone]}`}
      >
        {icon}
      </span>
      <div className="grid min-h-[3.75rem] min-w-0 grid-rows-[1rem_minmax(1.5rem,auto)_1rem] content-center">
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

function ProcedureDataGrid({
  items,
  columns = 3,
}: {
  items: ProcedureDataItem[];
  columns?: 2 | 3;
}) {
  return (
    <dl className={`grid ${columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
      {items.map(({ label, value, copyValue, tone = "slate" }) => (
        <div
          key={label}
          className="min-w-0 border-b border-border/50 px-4 py-3 sm:border-r sm:last:border-r-0"
        >
          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </dt>
          <dd
            className={`mt-1 min-w-0 text-sm font-semibold leading-5 ${PROCEDURE_VALUE_TONES[tone]}`}
          >
            {copyValue ? (
              <CopyableDetailValue value={copyValue} />
            ) : (
              <span className="whitespace-pre-line [overflow-wrap:anywhere]">{value}</span>
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
  icon: ReactNode;
  children: ReactNode;
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
    </button>
  );
}
