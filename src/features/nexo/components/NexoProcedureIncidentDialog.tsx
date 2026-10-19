import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  Focus,
  GitCompareArrows,
  Layers3,
  MapPin,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMemo, useRef, type ReactNode } from "react";
import { validProcedureCoordinates, type NexoProcedureRow } from "../nexoProcedureAnalytics";
import {
  describeProcedureIncident,
  type ProcedureCoordinates,
  type ProcedureFieldProvenance,
} from "../nexoProcedureProvenance";

const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#d4e5ec] bg-white px-3 py-2.5 text-[11px] font-bold text-[#2b7389] transition hover:bg-[#eef8fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34a8bc] focus-visible:ring-offset-2";

function displayDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function displayUpdatedAt(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function displayCoordinates(value: ProcedureCoordinates | null) {
  return value ? `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}` : "Não informadas";
}

function SourceLabel({ origin, number }: { origin: "original" | "complement"; number: string }) {
  return (
    <span>
      {origin === "complement" ? "Complemento" : "Original"} · {number}
    </span>
  );
}

function FieldCard<T>({
  field,
  format,
  icon,
}: {
  field: ProcedureFieldProvenance<T>;
  format: (value: T | null) => string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#dce9ee] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[#2993a8]">{icon}</span>
        {field.hasDisagreement ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4df] px-2 py-1 text-[9px] font-black text-[#9a671b]">
            <AlertTriangle className="h-3 w-3" /> Divergência
          </span>
        ) : null}
      </div>
      <dt className="mt-3 text-[10px] font-black uppercase tracking-[.09em] text-[#879da9]">
        {field.label}
      </dt>
      <dd
        className={`mt-1 break-words text-sm font-black leading-relaxed ${field.value == null ? "text-[#9badb8]" : "text-[#21475f]"}`}
      >
        {format(field.value)}
      </dd>
      <p className="mt-2 break-words text-[10px] leading-relaxed text-[#7894a4]">
        {field.chosenSource ? (
          <SourceLabel origin={field.chosenSource.origin} number={field.chosenSource.number} />
        ) : (
          "Sem fonte disponível para este campo"
        )}
      </p>
    </div>
  );
}

function FieldTrace<T>({
  field,
  format,
}: {
  field: ProcedureFieldProvenance<T>;
  format: (value: T | null) => string;
}) {
  return (
    <details className="group rounded-xl border border-[#e0eaf0] bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34a8bc] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-xs font-bold text-[#3c647a]">{field.label}</span>
        {field.hasDisagreement ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#a47225]">
            <AlertTriangle className="h-3 w-3" /> Valores diferentes
          </span>
        ) : (
          <span className="text-[10px] text-[#91a5b0]">
            {field.sources.length} fonte{field.sources.length === 1 ? "" : "s"}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#90a8b5] transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-[#eaf0f4] px-4 py-3">
        {field.sources.length ? (
          <ul className="space-y-2">
            {field.sources.map((source, index) => (
              <li
                key={`${source.recordId}:${source.origin}:${index}`}
                className={`rounded-xl border p-3 ${source.selected ? "border-[#b6dfe6] bg-[#f0fafb]" : "border-[#e6edf1] bg-[#f9fbfc]"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-[#6f8b9d]">
                    <SourceLabel origin={source.origin} number={source.number} />
                  </span>
                  {source.selected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#d9f1f4] px-2 py-0.5 text-[9px] font-black text-[#227d90]">
                      <Check className="h-3 w-3" /> Usado na análise
                    </span>
                  ) : !source.effective ? (
                    <span className="text-[9px] text-[#94a7b2]">Substituído pelo complemento</span>
                  ) : null}
                </div>
                <p className="mt-1 break-words text-xs font-bold text-[#315970]">
                  {format(source.value)}
                </p>
                {source.sourceText ? (
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[10px] leading-relaxed text-[#7893a3]">
                    Fonte: {source.sourceText}
                  </p>
                ) : null}
                {displayUpdatedAt(source.updatedAt) ? (
                  <p className="mt-1 text-[9px] text-[#8ca1af]">
                    Atualizado em {displayUpdatedAt(source.updatedAt)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-[#91a5b0]">Nenhum valor registrado para este campo.</p>
        )}
      </div>
    </details>
  );
}

function RecordDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[9px] font-black uppercase tracking-[.08em] text-[#8ca1af]">{label}</dt>
      <dd className="mt-1 break-words text-[11px] font-semibold leading-relaxed text-[#55788d]">
        {children}
      </dd>
    </div>
  );
}

export function NexoProcedureIncidentDialog({
  rows,
  incidentId,
  onClose,
  onEdit,
  onLocate,
  preview,
}: {
  rows: NexoProcedureRow[];
  incidentId: string;
  onClose: () => void;
  onEdit: (row: NexoProcedureRow) => void;
  onLocate: (id: string) => void;
  preview: boolean;
}) {
  const description = useMemo(
    () => describeProcedureIncident(rows, incidentId),
    [rows, incidentId],
  );
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const transitioningRef = useRef(false);

  function edit(row: NexoProcedureRow) {
    transitioningRef.current = true;
    onClose();
    onEdit(row);
  }

  function locate() {
    if (!description) return;
    transitioningRef.current = true;
    onClose();
    onLocate(incidentId);
  }

  const point = description
    ? validProcedureCoordinates(description.incident.latitude, description.incident.longitude)
    : null;

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-[#081c2a]/70 backdrop-blur-sm" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!transitioningRef.current && returnFocusRef.current?.isConnected)
              returnFocusRef.current.focus();
          }}
          className="fixed left-1/2 top-1/2 z-[1101] flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-[#f6fafc] shadow-2xl outline-none"
        >
          <div className="relative shrink-0 overflow-hidden border-b border-[#cde4eb] bg-gradient-to-br from-[#15394f] to-[#1d5967] px-5 py-5 text-white sm:px-7 sm:py-6">
            <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/10" />
            <div className="relative flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#89e0e9]">
                <Layers3 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[.21em] text-[#8ed7df]">
                  Inspeção do fato
                </p>
                <Dialog.Title className="mt-1 text-lg font-black tracking-[-.02em] sm:text-xl">
                  {description ? description.incident.number : "Fato indisponível"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[11px] leading-relaxed text-[#bed5df]">
                  {description
                    ? `${description.records.length} procedimento${description.records.length === 1 ? "" : "s"} associado${description.records.length === 1 ? "" : "s"} · uma ocorrência na análise`
                    : "Este fato não está disponível nos registros carregados."}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fechar inspeção do fato"
                  className="rounded-xl border border-white/15 bg-white/5 p-2 text-[#c3dce5] transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ed7df]"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            {description ? (
              <div className="relative mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${description.incident.cvli ? "bg-[#ffe5df] text-[#a94938]" : "bg-white/10 text-[#d0ebf0]"}`}
                >
                  {description.incident.cvli ? "CVLI" : "Outra natureza"}
                </span>
                {description.disagreementCount ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1d6] px-2.5 py-1 text-[9px] font-black text-[#99661e]">
                    <AlertTriangle className="h-3 w-3" /> {description.disagreementCount} campo
                    {description.disagreementCount === 1 ? "" : "s"} com divergência
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold text-[#c6e7ea]">
                    <ShieldCheck className="h-3 w-3" /> Sem valores divergentes
                  </span>
                )}
                {preview ? (
                  <span className="text-[9px] font-bold text-[#bad1d9]">Dados fictícios</span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-7">
            {description ? (
              <>
                <section aria-label="Dados usados na análise">
                  <div className="mb-3 flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#2f99ac]" />
                    <h2 className="text-xs font-black text-[#315b73]">Dados usados na análise</h2>
                  </div>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <FieldCard
                      field={description.fields.date}
                      format={displayDate}
                      icon={<CalendarDays className="h-4 w-4" />}
                    />
                    <FieldCard
                      field={description.fields.time}
                      format={(value) => value || "Não informado"}
                      icon={<Clock3 className="h-4 w-4" />}
                    />
                    <FieldCard
                      field={description.fields.neighborhood}
                      format={(value) => value || "Não informado"}
                      icon={<MapPin className="h-4 w-4" />}
                    />
                    <FieldCard
                      field={description.fields.coordinates}
                      format={displayCoordinates}
                      icon={<Focus className="h-4 w-4" />}
                    />
                  </dl>
                  {description.incident.factions.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {description.incident.factions.map((faction) => (
                        <span
                          key={faction}
                          className="rounded-full border border-[#d6e8ed] bg-white px-2.5 py-1 text-[10px] font-bold text-[#618396]"
                        >
                          {faction}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </section>
                <section aria-label="Rastreabilidade dos campos">
                  <div className="mb-3 flex items-center gap-2">
                    <GitCompareArrows className="h-4 w-4 text-[#2f99ac]" />
                    <h2 className="text-xs font-black text-[#315b73]">
                      Rastreabilidade dos campos
                    </h2>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-[#819aa9]">
                    Abra um campo para conferir os valores registrados e a fonte escolhida para a
                    análise deste fato.
                  </p>
                  <div className="space-y-2">
                    <FieldTrace field={description.fields.date} format={displayDate} />
                    <FieldTrace
                      field={description.fields.time}
                      format={(value) => value || "Não informado"}
                    />
                    <FieldTrace
                      field={description.fields.neighborhood}
                      format={(value) => value || "Não informado"}
                    />
                    <FieldTrace
                      field={description.fields.coordinates}
                      format={displayCoordinates}
                    />
                  </div>
                </section>
                <section aria-label="Procedimentos associados ao fato">
                  <div className="mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#2f99ac]" />
                    <h2 className="text-xs font-black text-[#315b73]">Procedimentos associados</h2>
                    <span className="rounded-full bg-[#e7f2f6] px-2 py-0.5 text-[10px] font-black text-[#4c8a9e]">
                      {description.records.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {description.records.map((record) => {
                      const originalDate = description.fields.date.sources.find(
                        (source) => source.recordId === record.id && source.origin === "original",
                      )?.value;
                      const originalNeighborhood = description.fields.neighborhood.sources.find(
                        (source) => source.recordId === record.id && source.origin === "original",
                      )?.value;
                      const ownPoint = validProcedureCoordinates(
                        record.context?.latitude,
                        record.context?.longitude,
                      );
                      const updatedAt = displayUpdatedAt(record.context?.updated_at);
                      return (
                        <article
                          key={record.id}
                          className="overflow-hidden rounded-2xl border border-[#dce8ef] bg-white"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="break-words text-xs font-black text-[#244c65]">
                                  {record.number}
                                </h3>
                                <span className="rounded-full bg-[#edf4f7] px-2 py-0.5 text-[9px] font-black uppercase text-[#68899a]">
                                  {record.kind === "bo" ? "B.O." : "Inquérito"}
                                </span>
                              </div>
                              <p className="mt-1 break-words text-[11px] leading-relaxed text-[#7d97a7]">
                                {record.nature}
                              </p>
                            </div>
                            {!preview ? (
                              <a
                                href={
                                  record.kind === "bo"
                                    ? `/bo/${record.procedureId}`
                                    : `/inqueritos/${record.procedureId}`
                                }
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-[#2a849b] hover:bg-[#f0f8fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34a8bc]"
                                aria-label={`Abrir procedimento original ${record.number}`}
                              >
                                Abrir original <ArrowUpRight className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                          <div className="px-4 pb-4 sm:px-5">
                            <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                              <RecordDetail label="Situação">{record.status}</RecordDetail>
                              <RecordDetail label="Facção">
                                {record.factions.join(", ") || "Não informada"}
                              </RecordDetail>
                              <RecordDetail label="Data no original">
                                {originalDate
                                  ? displayDate(originalDate)
                                  : "Não informada neste registro"}
                              </RecordDetail>
                              <RecordDetail label="Bairro no original">
                                {originalNeighborhood || "Não informado neste registro"}
                              </RecordDetail>
                            </dl>
                            {record.context ? (
                              <div className="mt-4 rounded-xl border border-[#d4e9ed] bg-[#f4fafb] p-3">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                  <p className="text-[10px] font-black text-[#3b7a8e]">
                                    Complemento próprio deste registro
                                  </p>
                                  {updatedAt ? (
                                    <span className="text-[9px] text-[#8aa1ae]">{updatedAt}</span>
                                  ) : null}
                                </div>
                                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                                  <RecordDetail label="Data">
                                    {record.context.data_fato
                                      ? displayDate(record.context.data_fato)
                                      : "Sem substituição"}
                                  </RecordDetail>
                                  <RecordDetail label="Horário">
                                    {record.context.hora_fato?.slice(0, 5) || "Sem acréscimo"}
                                  </RecordDetail>
                                  <RecordDetail label="Bairro">
                                    {record.context.bairro || "Sem substituição"}
                                  </RecordDetail>
                                  <RecordDetail label="Coordenadas">
                                    {ownPoint ? displayCoordinates(ownPoint) : "Sem ponto próprio"}
                                  </RecordDetail>
                                </dl>
                                <div className="mt-3 border-t border-[#deedf1] pt-2.5">
                                  <p className="text-[9px] font-black uppercase tracking-wide text-[#88a1ae]">
                                    Fonte registrada
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[#5d8295]">
                                    {record.context.fonte}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-3 rounded-xl bg-[#f7fafc] px-3 py-2.5 text-[10px] text-[#8ca3b1]">
                                Este procedimento ainda não tem complemento próprio.
                              </p>
                            )}
                          </div>
                          <div className="flex justify-end border-t border-[#eaf0f4] bg-[#fbfdfe] px-4 py-3 sm:px-5">
                            <button
                              type="button"
                              onClick={() => edit(record)}
                              className={buttonClass}
                            >
                              <Pencil className="h-3.5 w-3.5" />{" "}
                              {record.context ? "Editar complemento" : "Completar dados"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#dce8ee] bg-white px-5 py-12 text-center">
                <FileText className="mx-auto h-7 w-7 text-[#a7bdc9]" />
                <p className="mt-3 text-sm font-bold text-[#628294]">Fato não encontrado</p>
                <p className="mt-1 text-xs text-[#91a6b2]">
                  Atualize os dados do painel para consultar os procedimentos disponíveis.
                </p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#dce8ef] bg-white p-4 sm:px-7 sm:py-4">
            <p className="max-w-sm text-[10px] leading-relaxed text-[#8aa1af]">
              Valores de origem e complementos ficam disponíveis para conferência.
            </p>
            <div className="flex items-center gap-2">
              <Dialog.Close asChild>
                <button type="button" className={buttonClass}>
                  Fechar
                </button>
              </Dialog.Close>
              {point ? (
                <button
                  type="button"
                  onClick={locate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#173d5b] px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-[#225b75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34a8bc] focus-visible:ring-offset-2"
                >
                  <Focus className="h-3.5 w-3.5" /> Localizar no mapa
                </button>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
