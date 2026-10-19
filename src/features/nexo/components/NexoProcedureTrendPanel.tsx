import { BarChart3, CalendarRange, MousePointer2, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import type { NexoProcedureRow } from "../nexoProcedureAnalytics";
import { buildProcedureTrend } from "../nexoProcedureTrend";

export type ProcedureTrendSelection = { from: string; to: string } | null;

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function NexoProcedureTrendPanel({
  rows,
  from,
  to,
  onSelectRange,
  selected = null,
}: {
  rows: NexoProcedureRow[];
  from: string;
  to: string;
  onSelectRange: (from: string, to: string) => void;
  selected?: ProcedureTrendSelection;
}) {
  const trend = useMemo(() => buildProcedureTrend(rows, from, to), [rows, from, to]);
  const peak = trend.buckets.find((bucket) => bucket.count === trend.maxCount && bucket.count > 0);
  const grouping =
    trend.granularity === "day"
      ? "Diário"
      : trend.granularity === "week"
        ? "Semanal · seg–dom"
        : trend.step === 1
          ? "Mensal"
          : `A cada ${trend.step} meses`;
  const labelEvery = Math.max(1, Math.ceil(trend.buckets.length / 8));

  return (
    <section
      id="nexo-procedure-trend"
      className="mt-5 scroll-mt-28 overflow-hidden rounded-[24px] border border-[#dce8ef] bg-white shadow-[0_16px_32px_-30px_#213d51]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf5f8] text-[#2488a0]">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-black text-[#1b3d56]">Histórico de CVLI</h2>
            <p className="mt-1 text-[11px] text-[#567184]">
              Evolução pela data do fato, com intervalos sem registro preservados.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dbeaf0] bg-[#f3f9fb] px-3 py-1.5 text-[11px] font-bold text-[#4a8094]">
          <CalendarRange className="h-3.5 w-3.5" /> {grouping}
        </span>
      </div>
      {trend.invalidRange || !trend.buckets.length ? (
        <div className="m-5 flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dbe7ed] bg-[#f8fbfc] px-5 text-center sm:m-6">
          <BarChart3 className="h-7 w-7 text-[#9cb8c5]" />
          <p className="mt-3 text-xs font-bold text-[#5d7f91]">
            {trend.invalidRange
              ? "Ajuste o intervalo de datas"
              : "Ainda não há datas válidas para a série"}
          </p>
          <p className="mt-1 max-w-md text-[11px] leading-relaxed text-[#567184]">
            {trend.invalidRange
              ? "Preencha datas válidas e mantenha a data inicial anterior ou igual à final."
              : `${trend.missingDates} CVLI sem data do fato válida. Complete os dados ou escolha um período para visualizar a série.`}
          </p>
        </div>
      ) : (
        <>
          <div className="mx-5 mt-5 grid gap-4 rounded-2xl border border-[#e1edf2] bg-[#f8fbfc] px-4 py-3 sm:mx-6 sm:grid-cols-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#567184]">
                CVLI no período
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <strong className="text-2xl font-black tracking-[-.05em] text-[#173f58]">
                  {trend.total}
                </strong>
                <span className="text-[11px] text-[#567184]">fatos distintos</span>
              </div>
            </div>
            <div className="sm:border-l sm:border-[#deeaef] sm:pl-4">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#567184]">
                Pico por intervalo
              </span>
              <p className="mt-2 text-[11px] font-bold text-[#3e7187]">
                {peak ? `${peak.count} CVLI · ${peak.label}` : "Sem registros no período"}
              </p>
            </div>
            <div className="sm:border-l sm:border-[#deeaef] sm:pl-4">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#567184]">
                Intervalo analisado
              </span>
              <p className="mt-2 text-[11px] font-bold text-[#3e7187]">
                {dateLabel(trend.from!)} – {dateLabel(trend.to!)}
              </p>
            </div>
          </div>
          <div className="mx-5 mt-6 overflow-x-auto pb-2 sm:mx-6">
            <div
              className="relative pl-7"
              style={{ minWidth: Math.max(420, trend.buckets.length * 17) }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-7 left-0 top-0 w-6 text-[11px] font-semibold text-[#567184]"
              >
                <span className="absolute -top-1 right-1">{trend.maxCount || 1}</span>
                <span className="absolute bottom-0 right-1">0</span>
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-7 left-7 right-0 top-0 flex flex-col justify-between"
              >
                {[0, 1, 2].map((line) => (
                  <span key={line} className="border-t border-dashed border-[#e5edf2]" />
                ))}
              </div>
              <div
                className="relative grid gap-1"
                style={{ gridTemplateColumns: `repeat(${trend.buckets.length}, minmax(0, 1fr))` }}
              >
                {trend.buckets.map((bucket, index) => {
                  const active = selected?.from === bucket.from && selected.to === bucket.to;
                  const period =
                    bucket.from === bucket.to
                      ? dateLabel(bucket.from)
                      : `${dateLabel(bucket.from)} a ${dateLabel(bucket.to)}`;
                  const label = `${period}: ${bucket.count} CVLI. ${bucket.count ? "Selecionar período." : "Nenhum registro nesta base."}`;
                  return (
                    <div key={bucket.from} className="min-w-0">
                      <button
                        type="button"
                        disabled={!bucket.count}
                        onClick={() => onSelectRange(bucket.from, bucket.to)}
                        title={label}
                        aria-label={label}
                        aria-pressed={active}
                        className={`group relative flex h-40 w-full flex-col justify-end rounded-t-lg outline-none focus-visible:ring-2 focus-visible:ring-[#173f58] focus-visible:ring-offset-2 sm:h-44 ${bucket.count ? "cursor-pointer" : "cursor-default"}`}
                      >
                        <span
                          className={`mb-1 text-[11px] font-black tabular-nums ${bucket.count ? "text-[#44859a]" : "text-transparent"}`}
                        >
                          {bucket.count || "0"}
                        </span>
                        <span
                          className={`block w-full rounded-t-md transition ${active ? "bg-[#173f58] ring-2 ring-[#7eb9c9] ring-offset-1" : bucket.count ? "bg-gradient-to-t from-[#20899f] to-[#7bd0da] group-hover:from-[#166b84] group-hover:to-[#48b0c2]" : "bg-[#dfe9ee]"}`}
                          style={{
                            height: bucket.count
                              ? `${Math.max(5, (bucket.count / trend.maxCount) * 82)}%`
                              : 3,
                          }}
                        />
                      </button>
                      <div className="relative mt-2 h-5 text-[11px] text-[#567184]">
                        {index % labelEvery === 0 || index === trend.buckets.length - 1 ? (
                          <span
                            className={`absolute whitespace-nowrap ${index === trend.buckets.length - 1 ? "right-0" : "left-0"}`}
                          >
                            {bucket.label}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e7eff3] bg-[#fbfdfe] px-5 py-3 text-[11px] leading-relaxed text-[#8aa1af] sm:px-6">
            <span>
              {trend.knownDates}/{trend.sourceTotal} CVLI com data válida · {trend.missingDates} sem
              data válida{trend.outsideRange ? ` · ${trend.outsideRange} fora do período` : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#558b9e]">
              <MousePointer2 className="h-3 w-3" /> Selecione uma barra para explorar
            </span>
          </div>
        </>
      )}
    </section>
  );
}
