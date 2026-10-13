import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FilePlus2,
  History,
  MapPin,
  PencilLine,
  Repeat2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { formatVehicleDate } from "../vehicleConstants";
import type { VehicleTimelineEvent } from "../vehicleTypes";

type TimelineFilter = "all" | "movement" | "audit";

const MOVEMENT_LABELS: Record<string, string> = {
  entrada: "Entrada em custódia",
  apreensao: "Apreensão",
  transferencia: "Transferência",
  pericia: "Perícia",
  liberacao: "Liberação",
  devolucao: "Devolução",
  atualizacao: "Atualização operacional",
};

const FIELD_LABELS: Record<string, string> = {
  brand: "marca",
  model: "modelo",
  brand_model: "marca/modelo",
  color: "cor",
  plate: "placa",
  plate_status: "situação da placa",
  renavam: "Renavam",
  renavam_status: "situação do Renavam",
  engine_number: "número do motor",
  engine_status: "situação do motor",
  chassis: "chassi",
  chassis_status: "situação do chassi",
  situation: "situação",
  custody_location: "local de custódia",
  storage_location: "depósito",
  custody_responsible: "responsável pela custódia",
  release_status: "situação da liberação",
  release_date: "data da liberação",
  released_to: "pessoa que recebeu",
  release_document: "documento de entrega",
  release_authority: "autoridade responsável",
  observations: "observações",
};

function getEventTitle(event: VehicleTimelineEvent) {
  if (event.event_kind === "movement") return MOVEMENT_LABELS[event.event_type] ?? "Movimentação";
  if (event.event_type === "create") return "Veículo cadastrado";
  if (event.event_type === "delete") return "Veículo excluído";
  return "Cadastro atualizado";
}

function getEventStyle(event: VehicleTimelineEvent) {
  if (event.event_type === "liberacao" || event.event_type === "devolucao")
    return {
      Icon: CheckCircle2,
      dot: "border-success/40 bg-success/15 text-success",
      badge: "border-success/30 bg-success/10 text-success",
    };
  if (event.event_type === "create")
    return {
      Icon: FilePlus2,
      dot: "border-info/40 bg-info/15 text-info",
      badge: "border-info/30 bg-info/10 text-info",
    };
  if (event.event_kind === "audit")
    return {
      Icon: PencilLine,
      dot: "border-violet-500/40 bg-violet-500/15 text-violet-400",
      badge: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    };
  return {
    Icon: Repeat2,
    dot: "border-warning/40 bg-warning/15 text-warning",
    badge: "border-warning/30 bg-warning/10 text-warning",
  };
}

function detailValue(event: VehicleTimelineEvent, key: string) {
  const value = event.details?.[key];
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function formatActorRole(value: string | null) {
  if (!value) return "Função não informada";
  const labels: Record<string, string> = {
    admin: "Administrador",
    delegado: "Delegado",
    sipi_access: "Acesso SIED",
    atlas_access: "Acesso Atlas",
    agente_policia: "Agente de Polícia",
    investigador: "Investigador",
    escrivao: "Escrivão",
    administrativo: "Administrativo",
    promotor: "Promotor",
    juiz: "Juiz",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatChangedFields(fields: string[]) {
  return fields.map((field) => FIELD_LABELS[field] ?? field.replaceAll("_", " "));
}

export function VehicleTimeline({ events }: { events: VehicleTimelineEvent[] }) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const movementCount = events.filter((event) => event.event_kind === "movement").length;
  const auditCount = events.length - movementCount;
  const visibleEvents = useMemo(
    () => events.filter((event) => filter === "all" || event.event_kind === filter),
    [events, filter],
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-info/25 bg-info/10 text-info">
            <History className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black">Histórico do veículo</h2>
              <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {events.length} {events.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastro, alterações e movimentações em ordem cronológica.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Filtrar histórico">
          {(
            [
              ["all", "Todos", events.length],
              ["movement", "Movimentações", movementCount],
              ["audit", "Alterações", auditCount],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                filter === value
                  ? "border-info/50 bg-info/10 text-info"
                  : "border-border bg-background/50 text-muted-foreground hover:border-info/25 hover:text-foreground"
              }`}
            >
              {label} <span className="ml-1 font-mono opacity-70">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {visibleEvents.length ? (
        <div className="relative mt-6 space-y-0 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-gradient-to-b before:from-info/45 before:via-border before:to-transparent lg:before:left-6">
          {visibleEvents.map((event) => {
            const style = getEventStyle(event);
            const changedFields = formatChangedFields(event.changed_fields ?? []);
            const releasedTo = detailValue(event, "released_to");
            const releaseDocument = detailValue(event, "release_document");
            const releaseAuthority = detailValue(event, "release_authority");

            return (
              <article
                key={event.id}
                className="relative grid gap-3 pb-6 pl-14 lg:grid-cols-[1fr_240px] lg:pl-16"
              >
                <span
                  className={`absolute left-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-xl border lg:h-12 lg:w-12 ${style.dot}`}
                >
                  <style.Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                </span>

                <div className="rounded-xl border border-border/80 bg-background/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-foreground">{getEventTitle(event)}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <History className="h-3 w-3" /> {formatVehicleDate(event.occurred_at, true)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${style.badge}`}
                    >
                      {event.event_kind === "movement" ? "Movimentação" : "Alteração"}
                    </span>
                  </div>

                  {event.from_location || event.to_location ? (
                    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border/70 bg-card/70 p-3 text-xs sm:flex-row sm:items-center">
                      <span className="flex min-w-0 items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {event.from_location || "Origem não informada"}
                        </span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-info sm:rotate-0" />
                      <span className="min-w-0 truncate font-semibold text-foreground">
                        {event.to_location || "Destino não informado"}
                      </span>
                    </div>
                  ) : null}

                  {event.notes ? (
                    <p className="mt-3 text-xs leading-relaxed text-foreground/90">{event.notes}</p>
                  ) : null}

                  {releasedTo || releaseDocument || releaseAuthority ? (
                    <div className="mt-3 grid gap-2 rounded-lg border border-success/20 bg-success/5 p-3 text-xs sm:grid-cols-3">
                      {releasedTo ? <TimelineDetail label="Recebedor" value={releasedTo} /> : null}
                      {releaseDocument ? (
                        <TimelineDetail label="Documento" value={releaseDocument} />
                      ) : null}
                      {releaseAuthority ? (
                        <TimelineDetail label="Autoridade" value={releaseAuthority} />
                      ) : null}
                    </div>
                  ) : null}

                  {changedFields.length ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Campos alterados
                      </span>
                      {changedFields.map((field) => (
                        <span
                          key={field}
                          className="rounded-md border border-violet-500/20 bg-violet-500/5 px-2 py-1 text-[10px] text-violet-300"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex h-fit items-center gap-3 rounded-xl border border-border/70 bg-background/35 p-3 lg:mt-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">
                      {event.actor_name || "Responsável não identificado"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ShieldCheck className="h-3 w-3" /> {formatActorRole(event.actor_role)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-background/30 px-5 py-10 text-center">
          <History className="mx-auto h-7 w-7 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-bold">Nenhum registro nesta categoria</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Novas alterações e movimentações aparecerão aqui automaticamente.
          </p>
        </div>
      )}
    </section>
  );
}

function TimelineDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <p className="mt-0.5 font-semibold text-foreground">{value}</p>
    </div>
  );
}
