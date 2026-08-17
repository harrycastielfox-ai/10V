import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ChevronRight,
  Clock3,
  Database,
  FileSearch,
  Filter,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getCurrentProfile, getProfileAvatarPublicUrl } from "@/lib/auth";
import { canViewAuditoria } from "@/lib/authz";
import { listAuditoria, type AuditoriaEvent } from "@/lib/repositories/auditoriaRepository";

export const Route = createFileRoute("/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — SIPI" }] }),
  component: Auditoria,
});

type ModuleFilter = "todos" | "inqueritos" | "representacoes" | "usuarios_admin" | "outros";
type ModuleCategory = Exclude<ModuleFilter, "todos">;

const FALLBACK = "—";
const MODULE_FILTERS: Array<{ id: ModuleFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "inqueritos", label: "Inquéritos" },
  { id: "representacoes", label: "Representações" },
  { id: "usuarios_admin", label: "Usuários/Admin" },
  { id: "outros", label: "Outros" },
];

function Auditoria() {
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<AuditoriaEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("todos");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const currentProfile = await getCurrentProfile();
      const blocked = !canViewAuditoria(currentProfile);
      if (cancelled) return;
      setRestricted(blocked);
      if (blocked) {
        setLoading(false);
        return;
      }

      const result = await listAuditoria({ limit: 100 });
      if (cancelled) return;
      if (result.error) {
        const msg = result.error.message.toLowerCase();
        const code = (result.error.code ?? "").toLowerCase();
        const isPermissionError =
          msg.includes("insufficient_privilege") || msg.includes("permission") || code === "42501";
        const isRpcMissing = code === "pgrst202" || msg.includes("function") || msg.includes("rpc");
        if (import.meta.env.DEV) {
          console.warn("[auditoria][visual] Falha ao listar auditoria", {
            message: result.error.message,
            details: result.error.details,
            hint: result.error.hint,
            code: result.error.code,
          });
        }
        setError(
          isPermissionError
            ? "Você não possui permissão para visualizar os eventos de auditoria."
            : isRpcMissing
              ? "Função RPC não encontrada no Supabase."
              : "Falha ao carregar auditoria.",
        );
      } else {
        setEvents(result.data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEvents = useMemo(
    () => filterAuditEvents(events, searchTerm, moduleFilter),
    [events, moduleFilter, searchTerm],
  );
  const loadedEvents = events;
  const summaryCards = useMemo(() => getSummaryCards(loadedEvents), [loadedEvents]);
  const loadedEventCount = summaryCards[0]?.value ?? loadedEvents.length;
  const visibleEventCount = filteredEvents.length;

  if (restricted) {
    return (
      <AppLayout>
        <div className="space-y-4 rounded-2xl border border-destructive/25 bg-card/70 p-5">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Seu perfil não possui permissão para acessar Auditoria.
          </p>
          <Link
            to="/modulos"
            className="inline-block rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-muted/20"
          >
            Voltar
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <header className="flex flex-col gap-4 rounded-2xl border border-border/55 bg-card/50 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_24px_rgba(34,197,94,0.08)]">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="text-3xl font-black tracking-tight">Auditoria</h1>
              <p className="text-sm text-muted-foreground">Registro completo de ações no sistema</p>
            </div>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/65 bg-background/45 px-3 py-2 text-xs font-medium text-muted-foreground">
            <Clock3 className="h-4 w-4 text-primary/80" aria-hidden="true" />
            Últimos {loadedEventCount} evento(s) carregados
          </div>
        </header>

        <section
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
          aria-label="Resumo da auditoria carregada"
        >
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.label}
                className="rounded-xl border border-border/55 bg-card/45 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {card.label}
                    </p>
                    <p className={`text-2xl font-black tabular-nums ${card.valueClassName}`}>
                      {card.value}
                    </p>
                  </div>
                  <div className={`rounded-xl border p-2 ${card.iconClassName}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{card.caption}</p>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-border/55 bg-card/45 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.1)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por executor, email, ação, módulo, entidade, descrição ou data..."
                className="h-11 w-full rounded-xl border border-border/70 bg-background/55 py-2 pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/45 focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Filter className="h-3.5 w-3.5" aria-hidden="true" /> Módulo
              </span>
              {MODULE_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setModuleFilter(filter.id)}
                  className={`rounded-full border px-3 py-2 text-xs font-bold transition ${moduleFilter === filter.id ? "border-primary/45 bg-primary/15 text-primary" : "border-border/65 bg-background/35 text-muted-foreground hover:border-primary/25 hover:text-foreground"}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          {!loading && !error ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Exibindo <span className="font-semibold text-foreground">{visibleEventCount}</span> de{" "}
              <span className="font-semibold text-foreground">{loadedEventCount}</span> evento(s)
              carregados.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border/50 bg-[#070b0e]/55 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] sm:p-3">
          {loading ? (
            <AuditState
              icon={Activity}
              title="Carregando eventos..."
              description="Consultando a listagem atual de auditoria."
            />
          ) : null}
          {!loading && error ? (
            <AuditState
              icon={ShieldCheck}
              title="Não foi possível carregar auditoria"
              description={error}
              tone="warning"
            />
          ) : null}
          {!loading && !error && loadedEventCount === 0 ? (
            <AuditState
              icon={Database}
              title="Nenhum evento de auditoria encontrado."
              description="Não há registros carregados para exibir neste momento."
            />
          ) : null}
          {!loading && !error && loadedEventCount > 0 && visibleEventCount === 0 ? (
            <AuditState
              icon={Search}
              title="Nenhum evento de auditoria encontrado."
              description="Ajuste a busca ou os filtros locais para ver outros eventos carregados."
            />
          ) : null}
          {!loading && !error && visibleEventCount > 0 ? (
            <div className="divide-y divide-border/45">
              {filteredEvents.map((event) => (
                <AuditEventCard key={event.id} event={event} />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </AppLayout>
  );
}

function AuditEventCard({ event }: { event: AuditoriaEvent }) {
  const eventHref = getAuditEventHref(event);
  const isDeleteEvent = isDeleteAction(event.acao);
  const executorName = getExecutorName(event);
  const executorEmail = getExecutorEmail(event);
  const executorAvatarUrl = getExecutorAvatarUrl(event);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const shouldShowAvatar = Boolean(executorAvatarUrl) && !avatarFailed;
  const executorRole =
    "executor_cargo" in event && typeof event.executor_cargo === "string"
      ? event.executor_cargo
      : null;
  const action = getFriendlyAction(event.acao);
  const moduleInfo = getModuleInfo(event);
  const target = getReadableTarget(event);
  const metadata = getMetadataPreview(event.metadata, target.metadataKeys);
  const changeSummary = getChangeSummary(event.metadata);
  const avatarInitials = getInitials(executorName === FALLBACK ? executorEmail : executorName);
  const timestamp = formatDateTime(event.created_at);
  const description = String(event.descricao || "").trim() || "Sem descrição";
  const eventTitle = getAuditEventTitle(event, action, target, changeSummary);
  const shouldShowDescription = normalizeText(description) !== normalizeText(eventTitle);
  const isNavigable = Boolean(eventHref) && !isDeleteEvent;
  const destinationLabel = getAuditEventDestinationLabel(event);

  const cardBaseClassName =
    "group relative block overflow-hidden rounded-xl border border-transparent bg-transparent transition-[background-color,border-color,box-shadow]";

  // O executor abre o perfil dele; o restante do card abre o registro. São dois
  // destinos diferentes, então não dá para envolver o card inteiro num link só.
  const executorHref = String(event.executor_user_id ?? "").trim();
  const executorBlock = (
    <div className="flex h-full min-w-0 items-center gap-3 border-b border-border/35 pb-3 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
      <div className="relative shrink-0">
        <span
          className="absolute -left-3 top-1/2 hidden h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-primary/55 bg-[#070b0e] shadow-[0_0_0_5px_rgba(34,197,94,0.1)] sm:block"
          aria-hidden="true"
        />
        {shouldShowAvatar ? (
          <img
            src={executorAvatarUrl ?? undefined}
            alt={`Avatar de ${executorName}`}
            className="h-12 w-12 rounded-full border border-primary/25 object-cover shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-sm font-black text-primary/90 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
            {avatarInitials || "?"}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground" title={executorName}>
          {executorName}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={executorEmail}>
          {executorEmail}
        </p>
        {executorRole ? (
          <p
            className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-primary/70"
            title={executorRole}
          >
            {executorRole}
          </p>
        ) : null}
      </div>
    </div>
  );

  const eventBlock = (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${moduleInfo.className}`}
          >
            {moduleInfo.label}
          </span>
          {isNavigable ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.11em] text-primary/75">
              Registro vinculado <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground sm:justify-end">
          <time
            className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums"
            dateTime={event.created_at}
          >
            <Clock3 className="h-3.5 w-3.5 text-primary/70" aria-hidden="true" /> {timestamp}
          </time>
          {isNavigable ? (
            <ChevronRight
              className="h-4 w-4 text-muted-foreground/55 transition group-hover:translate-x-0.5 group-hover:text-primary"
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>

      {changeSummary ? (
        <div className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-primary/65 bg-primary/[0.045] px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-bold uppercase tracking-[0.12em] text-primary/80">
            Alteração registrada
          </span>
          <span className="font-semibold text-foreground/90">{changeSummary.field}</span>
          <span aria-hidden="true">→</span>
          <span className="font-semibold text-primary">{changeSummary.value}</span>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="break-words text-sm font-semibold leading-6 text-foreground/90">
          {eventTitle}
        </p>
        {shouldShowDescription ? (
          <p className="break-words text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
          Registro
        </span>
        <span className="font-semibold text-foreground/85" title={target.fullLabel}>
          {target.label}
        </span>
        {target.identifier ? (
          <span
            className={
              target.identifier.isFallback
                ? "font-mono text-muted-foreground"
                : "font-semibold text-primary/85"
            }
            title={target.identifier.fullValue}
          >
            {target.identifier.label} {target.identifier.value}
          </span>
        ) : (
          <span className="text-muted-foreground">ID não informado</span>
        )}
      </div>

      {metadata.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {metadata.map((item) => (
            <span
              key={item.id}
              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-border/45 bg-background/30 px-2.5 py-1 text-[11px] text-muted-foreground sm:max-w-[15rem]"
              title={`${item.key}: ${item.fullValue}`}
            >
              <span className="shrink-0 font-semibold text-foreground/80">{item.key}:</span>
              <span className="min-w-0 truncate">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}

      {isNavigable ? (
        <div className="flex items-center justify-between gap-3 border-t border-border/35 pt-3 text-xs">
          <span className="text-muted-foreground">
            Consulte o registro completo e o histórico relacionado.
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-bold text-primary transition group-hover/evento:translate-x-0.5">
            Abrir {destinationLabel}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      ) : null}
    </div>
  );

  const hoverClassName =
    "cursor-pointer hover:border-primary/25 hover:bg-primary/[0.045] focus-visible:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15";

  return (
    <article className={cardBaseClassName}>
      <div className="relative grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(185px,220px)_minmax(0,1fr)] lg:items-stretch">
        {executorHref ? (
          <Link
            to="/admin/usuarios/$userId"
            params={{ userId: executorHref }}
            className={`block min-w-0 rounded-lg border border-transparent ${hoverClassName}`}
            title={`Abrir o perfil de ${executorName}`}
            aria-label={`Abrir o perfil de ${executorName}`}
          >
            {executorBlock}
          </Link>
        ) : (
          executorBlock
        )}

        {eventHref && !isDeleteEvent ? (
          <Link
            to={eventHref}
            className={`group/evento block min-w-0 rounded-lg border border-transparent p-1 -m-1 ${hoverClassName}`}
            title={`Abrir ${destinationLabel}`}
            aria-label={`Abrir ${destinationLabel}`}
          >
            {eventBlock}
          </Link>
        ) : (
          eventBlock
        )}
      </div>
    </article>
  );
}

function AuditState({
  icon: Icon,
  title,
  description,
  tone = "default",
}: {
  icon: typeof Activity;
  title: string;
  description: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-background/35 px-4 py-10 text-center">
      <div
        className={`rounded-2xl border p-3 ${tone === "warning" ? "border-warning/30 bg-warning/10 text-warning" : "border-primary/25 bg-primary/10 text-primary"}`}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-bold text-foreground">{title}</p>
        <p className={`text-sm ${tone === "warning" ? "text-warning" : "text-muted-foreground"}`}>
          {description}
        </p>
      </div>
    </div>
  );
}

function getSummaryCards(events: AuditoriaEvent[]) {
  const inqueritos = events.filter((event) => getModuleCategory(event) === "inqueritos").length;
  const representacoes = events.filter(
    (event) => getModuleCategory(event) === "representacoes",
  ).length;
  const updates = events.filter((event) => isUpdateAction(event.acao)).length;
  const createDelete = events.filter(
    (event) => isCreateAction(event.acao) || isDeleteAction(event.acao),
  ).length;

  return [
    {
      label: "Total carregado",
      value: events.length,
      caption: "Eventos retornados pela listagem atual",
      icon: Database,
      valueClassName: "text-primary",
      iconClassName: "border-primary/25 bg-primary/10 text-primary",
    },
    {
      label: "Inquéritos",
      value: inqueritos,
      caption: "Ações ligadas a inquéritos",
      icon: FileSearch,
      valueClassName: "text-info",
      iconClassName: "border-info/25 bg-info/10 text-info",
    },
    {
      label: "Representações",
      value: representacoes,
      caption: "Ações ligadas a representações",
      icon: FileSearch,
      valueClassName: "text-purple-300",
      iconClassName: "border-purple-400/25 bg-purple-500/10 text-purple-300",
    },
    {
      label: "Edições",
      value: updates,
      caption: "Atualizações/alterações registradas",
      icon: Activity,
      valueClassName: "text-warning",
      iconClassName: "border-warning/25 bg-warning/10 text-warning",
    },
    {
      label: "Criação/Exclusão",
      value: createDelete,
      caption: "Criações ou exclusões carregadas",
      icon: UserCog,
      valueClassName: "text-foreground",
      iconClassName: "border-border bg-muted/20 text-muted-foreground",
    },
  ];
}

function filterAuditEvents(
  events: AuditoriaEvent[],
  searchTerm: string,
  moduleFilter: ModuleFilter,
) {
  const normalizedSearch = normalizeText(searchTerm);
  return events.filter((event) => {
    const matchesModule = moduleFilter === "todos" || getModuleCategory(event) === moduleFilter;
    if (!matchesModule) return false;
    if (!normalizedSearch) return true;
    return getSearchableText(event).includes(normalizedSearch);
  });
}

function getSearchableText(event: AuditoriaEvent) {
  return normalizeText(
    [
      event.executor_nome,
      event.executor_email,
      event.executor_login,
      event.executor_user_id,
      event.acao,
      getFriendlyAction(event.acao).label,
      event.modulo,
      event.entidade,
      event.entidade_id,
      event.descricao,
      formatDateTime(event.created_at),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getFriendlyAction(action?: string | null) {
  const normalized = normalizeText(action).replace(/\s+/g, "_");
  if (normalized === "create" || normalized === "insert" || normalized === "criar")
    return {
      label: "Criou",
      sentence: "criou",
      className: "border-primary/30 bg-primary/15 text-primary",
    };
  if (
    normalized === "update" ||
    normalized === "edit" ||
    normalized === "editar" ||
    normalized.includes("update")
  )
    return {
      label: "Editou",
      sentence: "editou",
      className: "border-info/30 bg-info/15 text-info",
    };
  if (
    normalized === "delete" ||
    normalized === "soft_delete" ||
    normalized.includes("delete") ||
    normalized.includes("exclu")
  )
    return {
      label: "Excluiu",
      sentence: "excluiu",
      className: "border-destructive/30 bg-destructive/15 text-destructive",
    };
  if (normalized === "login" || normalized.includes("login") || normalized.includes("acesso"))
    return {
      label: "Acessou",
      sentence: "acessou",
      className: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
    };
  const fallback =
    String(action || "")
      .replaceAll("_", " ")
      .trim()
      .toLowerCase() || "ação";
  return {
    label: capitalize(fallback),
    sentence: fallback,
    className: "border-border/80 bg-muted/20 text-muted-foreground",
  };
}

function getAuditEventTitle(
  event: AuditoriaEvent,
  action: ReturnType<typeof getFriendlyAction>,
  target: ReturnType<typeof getReadableTarget>,
  changeSummary: { field: string; value: string } | null,
) {
  if (changeSummary)
    return `${getChangeTitleVerb(changeSummary.field)} ${lowercaseFirst(changeSummary.field)}`;

  const descriptionTitle = getDescriptionTitle(event.descricao);
  if (descriptionTitle) return descriptionTitle;

  return `${action.label} ${target.label.toLowerCase()}`;
}

function getChangeTitleVerb(field: string) {
  const normalized = normalizeText(field);
  if (normalized.includes("observac")) return "Editou";
  if (normalized.includes("anexo")) return "Adicionou";
  return "Alterou";
}

function getDescriptionTitle(description?: string | null) {
  const cleanDescription = String(description ?? "").trim();
  if (!cleanDescription) return null;

  const beforeDetails = cleanDescription.split(":")[0]?.trim() || cleanDescription;
  const normalized = normalizeText(beforeDetails);
  if (normalized.startsWith("atualizou acesso do usuario")) return "Atualizou acesso do usuário";

  return beforeDetails.length <= 72 ? beforeDetails : null;
}

function lowercaseFirst(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return FALLBACK;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function isCreateAction(action?: string | null) {
  const normalized = normalizeText(action);
  return normalized === "create" || normalized === "insert" || normalized.includes("cria");
}

function isUpdateAction(action?: string | null) {
  const normalized = normalizeText(action);
  return (
    normalized === "update" ||
    normalized === "edit" ||
    normalized.includes("update") ||
    normalized.includes("edit")
  );
}

function isDeleteAction(action?: string | null) {
  const normalized = normalizeText(action);
  return (
    normalized === "delete" ||
    normalized === "soft_delete" ||
    normalized.endsWith("_delete") ||
    normalized.includes("exclu")
  );
}

function getModuleCategory(event: AuditoriaEvent): ModuleCategory {
  const target = `${normalizeText(event.modulo)}|${normalizeText(event.entidade)}`;
  if (target.includes("inquerito")) return "inqueritos";
  if (target.includes("representacao")) return "representacoes";
  if (target.includes("usuario") || target.includes("admin") || target.includes("profile"))
    return "usuarios_admin";
  return "outros";
}

function getModuleInfo(event: AuditoriaEvent) {
  const category = getModuleCategory(event);
  const labels: Record<ModuleCategory, { label: string; className: string }> = {
    inqueritos: { label: "Inquéritos", className: "border-info/30 bg-info/15 text-info" },
    representacoes: {
      label: "Representações",
      className: "border-purple-400/30 bg-purple-500/10 text-purple-300",
    },
    usuarios_admin: {
      label: "Usuários/Admin",
      className: "border-warning/30 bg-warning/10 text-warning",
    },
    outros: {
      label: event.modulo ? capitalize(String(event.modulo).replaceAll("_", " ")) : "Outros",
      className: "border-border/80 bg-muted/20 text-muted-foreground",
    },
  };
  return labels[category];
}

const TARGET_IDENTIFIER_CANDIDATES = [
  { label: "PPE", keys: ["ppe", "numero_ppe"] },
  {
    label: "Processo",
    keys: ["numero_processo", "processo_judicial", "numero_processo_medida", "processo"],
  },
  { label: "Número", keys: ["numero_bo", "numero_fisico", "codigo_interno"] },
  { label: "Usuário", keys: ["target_login", "target_email", "target_nome"] },
];

function getReadableTarget(event: AuditoriaEvent) {
  const normalizedEntity = normalizeText(event.entidade);
  const label = getEntityLabel(normalizedEntity, event.entidade);
  const fullId = event.entidade_id ? String(event.entidade_id).trim() : null;
  const identifier = getTargetIdentifier(event.metadata, fullId);
  return {
    label,
    fullId,
    fullLabel: identifier
      ? `${label} ${identifier.label} ${identifier.fullValue}`
      : fullId
        ? `${label} ${fullId}`
        : label,
    identifier,
    metadataKeys: identifier?.metadataKeys ?? [],
    secondaryId: identifier && !identifier.isFallback && fullId ? shortenId(fullId) : null,
    shortId: fullId ? shortenId(fullId) : null,
  };
}

function getTargetIdentifier(
  metadata: Record<string, unknown> | null | undefined,
  fullId: string | null,
) {
  if (metadata && typeof metadata === "object") {
    for (const candidate of TARGET_IDENTIFIER_CANDIDATES) {
      for (const key of candidate.keys) {
        const value = getMetadataDisplayValue(metadata, key);
        if (value) {
          return {
            label: candidate.label,
            value,
            fullValue: value,
            isFallback: false,
            metadataKeys: candidate.keys,
          };
        }
      }
    }
  }

  if (!fullId) return null;
  return {
    label: "ID",
    value: shortenId(fullId),
    fullValue: fullId,
    isFallback: true,
    metadataKeys: [],
  };
}

function getMetadataDisplayValue(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (!isPrimitiveMetadata(value)) return null;
  const formatted = formatMetadataValue(value);
  return formatted === FALLBACK ? null : formatted;
}

function getEntityLabel(normalizedEntity: string, rawEntity?: string | null) {
  if (normalizedEntity.includes("inquerito")) return "Inquérito";
  if (normalizedEntity.includes("representacao")) return "Representação";
  if (normalizedEntity.includes("admin") && normalizedEntity.includes("usuario"))
    return "Usuário/Admin";
  if (normalizedEntity.includes("profile") || normalizedEntity.includes("usuario"))
    return "Usuário";
  return rawEntity ? capitalize(String(rawEntity).replaceAll("_", " ")) : "Alvo não informado";
}

function getAuditEventDestinationLabel(event: AuditoriaEvent) {
  const category = getModuleCategory(event);
  if (category === "inqueritos") return "inquérito";
  if (category === "representacoes") return "representação";
  if (category === "usuarios_admin") return "perfil";
  return "registro";
}

function shortenId(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

const METADATA_PREVIEW_PRIORITY = [
  "ppe",
  "numero_ppe",
  "tipo",
  "status",
  "situacao",
  "status_diligencias",
  "numero_processo",
  "prioridade",
];
const METADATA_LABELS: Record<string, string> = {
  ppe: "PPE",
  numero_ppe: "PPE",
  numero_processo: "Número processo",
  processo_judicial: "Processo judicial",
  numero_processo_medida: "Número processo",
  tipo: "Tipo",
  status: "Status",
  situacao: "Situação",
  status_diligencias: "Status diligências",
  prioridade: "Prioridade",
  numero_bo: "Número BO",
  numero_fisico: "Número físico",
  codigo_interno: "Código interno",
  target_login: "Login",
  target_email: "E-mail",
  target_nome: "Usuário",
};

function getMetadataPreview(
  metadata: Record<string, unknown> | null | undefined,
  excludedKeys: string[] = [],
) {
  if (!metadata || typeof metadata !== "object") return [];
  const excluded = new Set(excludedKeys.map((key) => key.toLowerCase()));
  return Object.entries(metadata)
    .filter(([key]) => !excluded.has(key.toLowerCase()))
    .filter(([, value]) => isPrimitiveMetadata(value))
    .filter(([, value]) => formatMetadataFullValue(value) !== FALLBACK)
    .sort(([leftKey], [rightKey]) => getMetadataPriority(leftKey) - getMetadataPriority(rightKey))
    .slice(0, 3)
    .map(([key, value]) => ({
      id: key,
      key: formatMetadataLabel(key),
      value: formatMetadataValue(value),
      fullValue: formatMetadataFullValue(value),
    }));
}

function getMetadataPriority(key: string) {
  const index = METADATA_PREVIEW_PRIORITY.indexOf(key.toLowerCase());
  return index === -1 ? METADATA_PREVIEW_PRIORITY.length : index;
}

function getChangeSummary(
  metadata: Record<string, unknown> | null | undefined,
): { field: string; value: string } | null {
  if (!metadata || typeof metadata !== "object") return null;

  const explicitField = getFirstMetadataString(metadata, [
    "campo",
    "field",
    "field_name",
    "campo_alterado",
  ]);
  const explicitValue = getFirstMetadataString(metadata, [
    "novo_valor",
    "new_value",
    "valor_novo",
    "value",
  ]);
  if (explicitField && explicitValue)
    return { field: formatMetadataLabel(explicitField), value: explicitValue };

  for (const [oldKey, oldValue] of Object.entries(metadata)) {
    if (!oldKey.startsWith("old_") || !isPrimitiveMetadata(oldValue)) continue;
    const suffix = oldKey.slice(4);
    const newValue = metadata[`new_${suffix}`];
    if (!isPrimitiveMetadata(newValue)) continue;
    const formattedNewValue = formatMetadataValue(newValue);
    if (formattedNewValue === FALLBACK || formatMetadataValue(oldValue) === formattedNewValue)
      continue;
    return { field: formatMetadataLabel(suffix), value: formattedNewValue };
  }

  return null;
}

function getFirstMetadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function formatMetadataLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  return METADATA_LABELS[normalized] ?? capitalize(value.replaceAll("_", " "));
}

function isPrimitiveMetadata(value: unknown) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function formatMetadataFullValue(value: unknown) {
  if (value === null || value === undefined || value === "") return FALLBACK;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

function formatMetadataValue(value: unknown) {
  const text = formatMetadataFullValue(value);
  if (text === FALLBACK) return text;
  return text.length > 42 ? `${text.slice(0, 39)}...` : text;
}

function getExecutorName(event: AuditoriaEvent) {
  return String(
    event.executor_nome ||
      event.executor_login ||
      event.executor_email ||
      event.executor_user_id ||
      FALLBACK,
  ).trim();
}

function getExecutorEmail(event: AuditoriaEvent) {
  return String(event.executor_email || event.executor_login || FALLBACK).trim();
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0))
    .join("")
    .toUpperCase();
}

function formatDateTime(value?: string | null) {
  if (!value) return FALLBACK;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR");
}

function capitalize(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return FALLBACK;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function getExecutorAvatarUrl(event: AuditoriaEvent): string | null {
  const avatarUrl = getSafeImageUrl(event.executor_avatar_url);
  if (avatarUrl) return avatarUrl;

  const avatarPath = String(event.executor_avatar_path ?? "").trim();
  if (!avatarPath) return null;

  return getSafeImageUrl(getProfileAvatarPublicUrl(avatarPath));
}

function getSafeImageUrl(value: string | null | undefined): string | null {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function getAuditEventHref(event: AuditoriaEvent) {
  const entityId = event.entidade_id ? String(event.entidade_id).trim() : "";
  if (!entityId) return null;

  const modulo = normalizeText(event.modulo).replace(/\s+/g, "_");
  const entidade = normalizeText(event.entidade).replace(/\s+/g, "_");
  const target = `${modulo}|${entidade}`;

  if (
    [
      "|inqueritos",
      "|inquerito",
      "inqueritos|",
      "inquerito|",
      "inqueritos|inqueritos",
      "inqueritos|inquerito",
    ].includes(target)
  ) {
    return `/inqueritos/${entityId}`;
  }
  if (
    [
      "|representacoes",
      "|representacao",
      "representacoes|",
      "representacao|",
      "representacoes|representacoes",
      "representacoes|representacao",
    ].includes(target)
  ) {
    return `/representacoes/${entityId}`;
  }
  if (
    [
      "|profiles",
      "|admin_usuarios",
      "admin_usuarios|",
      "usuarios|profiles",
      "administracao|profiles",
    ].includes(target)
  ) {
    return `/admin/usuarios/${entityId}`;
  }

  return null;
}
