import { CalendarClock, Minus, MoveDownRight, MoveUpRight, Waves } from "lucide-react";
import { useMemo } from "react";
import type { NexoProcedureRow } from "../nexoProcedureAnalytics";
import { buildProcedureHeatmap, compareProcedurePeriods } from "../nexoProcedureInsights";

export type ProcedureTimeSelection = { weekday: number; hour: number } | null;

const weekdays = [
  { key: 1, short: "Seg", name: "segunda-feira" },
  { key: 2, short: "Ter", name: "terça-feira" },
  { key: 3, short: "Qua", name: "quarta-feira" },
  { key: 4, short: "Qui", name: "quinta-feira" },
  { key: 5, short: "Sex", name: "sexta-feira" },
  { key: 6, short: "Sáb", name: "sábado" },
  { key: 0, short: "Dom", name: "domingo" },
];

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function NexoProcedureAnalysisPanel({
  rows,
  comparisonRows,
  from,
  to,
  selected,
  onSelect,
}: {
  rows: NexoProcedureRow[];
  comparisonRows: NexoProcedureRow[];
  from: string;
  to: string;
  selected: ProcedureTimeSelection;
  onSelect: (selection: ProcedureTimeSelection) => void;
}) {
  const heatmap = useMemo(() => buildProcedureHeatmap(rows), [rows]);
  const comparison = useMemo(
    () => compareProcedurePeriods(comparisonRows, from, to),
    [comparisonRows, from, to],
  );
  const cells = new Map(heatmap.cells.map((cell) => [`${cell.weekday}:${cell.hour}`, cell]));
  const DeltaIcon = comparison?.delta
    ? comparison.delta > 0
      ? MoveUpRight
      : MoveDownRight
    : Minus;

  return (
    <section className="mt-5 grid overflow-hidden rounded-[24px] border border-[#dce8ef] bg-white shadow-[0_16px_32px_-30px_#213d51] xl:grid-cols-[minmax(0,1fr)_290px]">
      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf5f8] text-[#2488a0]">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-black text-[#1b3d56]">Ritmo dos fatos</h2>
              <p className="mt-1 text-[11px] text-[#567184]">
                CVLI por dia da semana e hora. Selecione uma célula para explorar os casos.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-[#f0f6f8] px-3 py-1.5 text-[11px] font-bold text-[#5b8093]">
            {heatmap.knownTimes}/{heatmap.total} com data e hora
          </span>
        </div>
        <div className="mt-5 overflow-x-auto pb-2">
          <div className="min-w-[580px]">
            <div className="mb-1.5 grid grid-cols-[34px_repeat(24,minmax(0,1fr))] gap-1 text-center text-[11px] font-bold text-[#567184]">
              <span />
              {Array.from({ length: 24 }, (_, hour) => (
                <span key={hour}>{String(hour).padStart(2, "0")}</span>
              ))}
            </div>
            {weekdays.map((day) => (
              <div
                key={day.key}
                className="mb-1 grid grid-cols-[34px_repeat(24,minmax(0,1fr))] items-center gap-1"
              >
                <span className="text-[11px] font-bold text-[#6d899b]">{day.short}</span>
                {Array.from({ length: 24 }, (_, hour) => {
                  const count = cells.get(`${day.key}:${hour}`)?.count || 0;
                  const active = selected?.weekday === day.key && selected.hour === hour;
                  const intensity = count && heatmap.maxCount ? count / heatmap.maxCount : 0;
                  return (
                    <button
                      type="button"
                      key={hour}
                      disabled={!count}
                      aria-pressed={active}
                      aria-label={`${day.name}, ${hour}h a ${hour}h59: ${count} CVLI`}
                      title={`${day.name} · ${hour}h–${hour}h59 · ${count} CVLI`}
                      onClick={() => onSelect(active ? null : { weekday: day.key, hour })}
                      style={{
                        backgroundColor: count
                          ? `rgba(23, 136, 158, ${0.22 + intensity * 0.78})`
                          : "#f0f5f7",
                      }}
                      className={`h-6 rounded-[5px] text-[11px] font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f58] ${active ? "ring-2 ring-[#173f58] ring-offset-1" : "enabled:hover:ring-2 enabled:hover:ring-[#6bb6c5]"} ${intensity > 0.5 ? "text-white" : "text-[#2b647b]"}`}
                    >
                      {count || ""}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8ca2af]">
          <span>
            {heatmap.peak
              ? `Maior concentração: ${weekdays.find((day) => day.key === heatmap.peak!.weekday)?.short}, ${heatmap.peak.hour}h–${heatmap.peak.hour}h59 (${heatmap.peak.count} fato${heatmap.peak.count === 1 ? "" : "s"}).`
              : "Complete data e horário para visualizar a distribuição temporal."}
          </span>
          <span className="inline-flex items-center gap-1.5">
            Menos
            {[0.15, 0.4, 0.7, 1].map((opacity) => (
              <i
                key={opacity}
                className="h-2.5 w-2.5 rounded-sm bg-[#17889e]"
                style={{ opacity }}
              />
            ))}
            Mais
          </span>
        </div>
      </div>
      <div className="border-t border-[#e1ecf1] bg-[#f5f9fb] p-5 sm:p-6 xl:border-l xl:border-t-0">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.14em] text-[#578093]">
          <Waves className="h-4 w-4" /> Evolução de CVLI
        </div>
        {comparison ? (
          <>
            <div className="mt-4 flex items-end gap-3">
              <strong className="text-4xl font-black tracking-[-.06em] text-[#193f58]">
                {comparison.current.cvli}
              </strong>
              <span className="pb-1 text-xs text-[#8aa1af]">
                vs. {comparison.previous.cvli} anteriores
              </span>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#d4e3eb] bg-white px-2.5 py-1.5 text-xs font-bold text-[#3d657b]">
              <DeltaIcon className="h-4 w-4" />
              {comparison.deltaPercent === null
                ? comparison.delta > 0
                  ? `+${comparison.delta} fato(s) · base anterior zero`
                  : "Sem variação"
                : `${comparison.delta > 0 ? "+" : ""}${comparison.deltaPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-[#658497]">
              {dateLabel(comparison.current.from)} a {dateLabel(comparison.current.to)}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#95a8b4]">
              Comparado a {dateLabel(comparison.previous.from)}–{dateLabel(comparison.previous.to)}{" "}
              · períodos de {comparison.days} dia(s).
            </p>
            {comparison.undated ? (
              <p className="mt-3 text-[11px] text-[#8aa0ad]">
                {comparison.undated} fato(s) sem data fora da comparação.
              </p>
            ) : null}
          </>
        ) : (
          <div className="mt-5">
            <CalendarClock className="h-7 w-7 text-[#a0bac8]" />
            <p className="mt-3 text-xs font-bold text-[#658497]">Compare períodos equivalentes</p>
            <p className="mt-2 text-[11px] leading-relaxed text-[#567184]">
              Use um atalho de período ou preencha “De” e “Até” para comparar com o intervalo
              anterior de mesma duração.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
