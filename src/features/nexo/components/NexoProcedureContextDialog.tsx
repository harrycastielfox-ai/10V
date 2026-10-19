import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, MapPin, Pencil, X } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { validProcedureCoordinates, type NexoProcedureRow } from "../nexoProcedureAnalytics";
import { NexoProcedureGeoMap } from "./NexoProcedureGeoMap";

const fieldClass =
  "h-11 w-full rounded-xl border border-[#d7e4ec] bg-white px-3 text-sm font-semibold text-[#274a60] outline-none transition focus:border-[#34a8bc] focus:ring-2 focus:ring-[#34a8bc]/15 disabled:bg-[#f4f7f9]";

type ContextInput = {
  data_fato: string | null;
  hora_fato: string | null;
  bairro: string | null;
  latitude: number | null;
  longitude: number | null;
  fonte: string;
};

type ContextRow = NexoProcedureRow & {
  sourceFactDate?: string | null;
  sourceNeighborhood?: string | null;
};

function displayDate(value: string | null | undefined) {
  if (!value) return "Sem data informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function parseCoordinate(value: string) {
  return Number(value.trim().replace(",", "."));
}

export function NexoProcedureContextDialog({
  row,
  onClose,
  onSave,
  returnFocusElement,
}: {
  row: ContextRow;
  onClose: () => void;
  onSave: (input: ContextInput) => Promise<void>;
  returnFocusElement?: HTMLElement | null;
}) {
  const [date, setDate] = useState(row.context?.data_fato || "");
  const [time, setTime] = useState(row.context?.hora_fato?.slice(0, 5) || "");
  const [neighborhood, setNeighborhood] = useState(row.context?.bairro || "");
  const [latitude, setLatitude] = useState(row.context?.latitude?.toString() || "");
  const [longitude, setLongitude] = useState(row.context?.longitude?.toString() || "");
  const [source, setSource] = useState(row.context?.fonte || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const returnFocusRef = useRef<HTMLElement | null>(
    returnFocusElement ||
      (typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null),
  );
  const sourceDate =
    row.sourceFactDate === undefined ? (row.context ? null : row.factDate) : row.sourceFactDate;
  const sourceNeighborhood =
    row.sourceNeighborhood === undefined
      ? row.context
        ? null
        : row.neighborhood
      : row.sourceNeighborhood;
  const coordinates = useMemo(
    () =>
      latitude.trim() && longitude.trim()
        ? validProcedureCoordinates(parseCoordinate(latitude), parseCoordinate(longitude))
        : null,
    [latitude, longitude],
  );
  const inheritedPoint =
    !coordinates &&
    row.context?.latitude == null &&
    row.context?.longitude == null &&
    validProcedureCoordinates(row.latitude, row.longitude);

  function requestClose() {
    if (!saving) onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const hasCoordinates = Boolean(latitude.trim() || longitude.trim());
    if (hasCoordinates && !coordinates) {
      setError("Informe latitude e longitude válidas para marcar o local do fato.");
      return;
    }
    if (!date && !time && !neighborhood.trim() && !coordinates) {
      setError(
        row.context
          ? "Mantenha pelo menos um dado no complemento. A remoção completa ainda não está disponível."
          : "Informe pelo menos um dado do fato para salvar o complemento.",
      );
      return;
    }
    if (source.trim().length < 3) {
      setError("Informe a fonte ou justificativa do complemento.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        data_fato: date || null,
        hora_fato: time || null,
        bairro: neighborhood.trim() || null,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        fonte: source.trim(),
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o complemento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && requestClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-[#081c2a]/70 backdrop-blur-sm" />
        <Dialog.Content
          asChild
          onEscapeKeyDown={(event) => saving && event.preventDefault()}
          onInteractOutside={(event) => saving && event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
          }}
        >
          <form
            onSubmit={(event) => void submit(event)}
            aria-busy={saving}
            className="fixed left-1/2 top-1/2 z-[1101] flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl outline-none"
          >
            <div className="flex shrink-0 items-start gap-3 border-b border-[#e1eaf0] p-5 sm:p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e8f5f8] text-[#19869e]">
                <Pencil className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-[.17em] text-[#3696aa]">
                  Complemento analítico
                </span>
                <Dialog.Title className="mt-1 text-lg font-black text-[#193c56]">
                  Dados do fato
                </Dialog.Title>
                <Dialog.Description className="mt-1 truncate text-xs text-[#7c92a1]">
                  {row.number} · {row.kind === "bo" ? "B.O." : "Inquérito"}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={saving}
                  aria-label="Fechar complemento"
                  className="rounded-lg p-2 text-[#849aaa] hover:bg-[#f2f6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34a8bc] disabled:opacity-40"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
              <fieldset disabled={saving} className="space-y-4">
                <p className="rounded-xl border border-[#cce5eb] bg-[#f2f9fb] p-3 text-xs leading-relaxed text-[#52798a]">
                  Preencha os dados que deseja acrescentar ou corrigir e registre a fonte. Campos
                  deixados em branco continuam usando as informações do procedimento de origem.
                </p>
                <div className="rounded-xl border border-[#e0e9ef] bg-[#f8fafc] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[.1em] text-[#7791a1]">
                    Dados de origem
                  </p>
                  <div className="mt-2 grid gap-2 text-xs text-[#55778b] sm:grid-cols-2">
                    <span className="flex items-start gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      {displayDate(sourceDate)}
                    </span>
                    <span className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {sourceNeighborhood || "Sem bairro informado"}
                    </span>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-bold text-[#587488]">
                    Data do fato no complemento
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className={`mt-1 ${fieldClass}`}
                    />
                    <span className="mt-1.5 block text-[10px] font-normal text-[#8b9eaa]">
                      Em branco: usar a data de origem.
                    </span>
                  </label>
                  <label className="text-xs font-bold text-[#587488]">
                    Horário do fato
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                      className={`mt-1 ${fieldClass}`}
                    />
                    {row.factTime && !row.context?.hora_fato ? (
                      <span className="mt-1.5 block text-[10px] font-normal text-[#8b9eaa]">
                        Horário do fato vinculado: {row.factTime}.
                      </span>
                    ) : null}
                  </label>
                </div>
                <label className="block text-xs font-bold text-[#587488]">
                  Bairro no complemento
                  <input
                    value={neighborhood}
                    maxLength={160}
                    onChange={(event) => setNeighborhood(event.target.value)}
                    placeholder={
                      sourceNeighborhood
                        ? `Usar bairro original: ${sourceNeighborhood}`
                        : "Acrescentar bairro do fato"
                    }
                    className={`mt-1 ${fieldClass}`}
                  />
                  <span className="mt-1.5 block text-[10px] font-normal text-[#8b9eaa]">
                    Em branco: usar o bairro de origem.
                  </span>
                </label>
                <div className="overflow-hidden rounded-2xl border border-[#d7e4ec]">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f3f8fa] px-4 py-3">
                    <div>
                      <p className="text-xs font-black text-[#234c65]">
                        Ponto próprio do complemento
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#7893a3]">
                        Clique no mapa ou informe as coordenadas abaixo.
                      </p>
                    </div>
                    {latitude || longitude ? (
                      <button
                        type="button"
                        onClick={() => {
                          setLatitude("");
                          setLongitude("");
                        }}
                        className="rounded text-[11px] font-bold text-[#287d94] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34a8bc]"
                      >
                        Limpar ponto próprio
                      </button>
                    ) : null}
                  </div>
                  <NexoProcedureGeoMap
                    compact
                    points={
                      coordinates
                        ? [
                            {
                              id: row.id,
                              number: row.number,
                              ...coordinates,
                              cvli: row.cvli,
                            },
                          ]
                        : []
                    }
                    onPick={(lat, lng) => {
                      if (saving) return;
                      setLatitude(lat.toString());
                      setLongitude(lng.toString());
                    }}
                  />
                  {inheritedPoint ? (
                    <p className="border-t border-[#d7e4ec] bg-[#f8fbfc] px-4 py-2.5 text-[11px] leading-relaxed text-[#7893a3]">
                      Este procedimento já utiliza um ponto associado ao mesmo fato. Deixe as
                      coordenadas em branco para manter esse local ou marque um ponto próprio.
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-[#587488]">
                    Latitude
                    <input
                      inputMode="decimal"
                      value={latitude}
                      onChange={(event) => setLatitude(event.target.value)}
                      placeholder="Ex.: -16,5702"
                      className={`mt-1 ${fieldClass}`}
                    />
                  </label>
                  <label className="text-xs font-bold text-[#587488]">
                    Longitude
                    <input
                      inputMode="decimal"
                      value={longitude}
                      onChange={(event) => setLongitude(event.target.value)}
                      placeholder="Ex.: -39,5635"
                      className={`mt-1 ${fieldClass}`}
                    />
                  </label>
                </div>
                <label className="block text-xs font-bold text-[#587488]">
                  Fonte ou justificativa
                  <textarea
                    required
                    minLength={3}
                    maxLength={1000}
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    placeholder="Ex.: informação conferida no relatório de investigação"
                    className="mt-1 min-h-24 w-full rounded-xl border border-[#d7e4ec] bg-white px-3 py-2.5 text-sm font-medium text-[#274a60] outline-none focus:border-[#34a8bc] focus:ring-2 focus:ring-[#34a8bc]/15 disabled:bg-[#f4f7f9]"
                  />
                </label>
              </fieldset>
              {error ? (
                <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-[#e1eaf0] bg-white p-4 sm:p-5">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-xl border border-[#d9e5eb] px-4 py-2.5 text-xs font-bold text-[#607a8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34a8bc] disabled:opacity-40"
                >
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#173d5b] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#205573] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34a8bc] focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {saving ? "Salvando…" : "Salvar complemento"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
