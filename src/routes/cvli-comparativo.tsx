import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, CheckCircle2, FileSpreadsheet, Trophy } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";
import { buildCvliMonthlyComparison, type CvliMetric } from "@/lib/cvliMetrics";
import { listInqueritos, type InqueritoRecord } from "@/lib/repositories/inqueritosRepository";

const YEAR_PAGE_SIZE = 6;

export const Route = createFileRoute("/cvli-comparativo")({
  head: () => ({
    meta: [
      { title: "CVLI — Comparativo Mensal — SIED" },
      {
        name: "description",
        content: "Comparativo mensal de registros e elucidações de CVLI por ano.",
      },
    ],
  }),
  component: CvliComparativoPage,
});

function CvliComparativoPage() {
  const navigate = useNavigate();
  const [inqueritos, setInqueritos] = useState<InqueritoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearPage, setYearPage] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await listInqueritos();
        if (!cancelled) setInqueritos(data);
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar o comparativo CVLI.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const comparison = useMemo(() => buildCvliMonthlyComparison(inqueritos), [inqueritos]);
  const selectedYears = comparison.years;
  const totalYearPages = Math.max(1, Math.ceil(selectedYears.length / YEAR_PAGE_SIZE));
  const safeYearPage = Math.min(yearPage ?? totalYearPages, totalYearPages);
  const visibleYears = useMemo(() => {
    const pagesAfterCurrent = totalYearPages - safeYearPage;
    const endIndex = selectedYears.length - pagesAfterCurrent * YEAR_PAGE_SIZE;
    const startIndex = Math.max(0, endIndex - YEAR_PAGE_SIZE);

    return selectedYears.slice(startIndex, endIndex);
  }, [safeYearPage, selectedYears, totalYearPages]);
  const summary = useMemo(() => {
    const metrics = visibleYears
      .map((year) => ({ year, metric: comparison.totals[year] }))
      .filter((item): item is { year: number; metric: CvliMetric } => Boolean(item.metric));
    const registros = metrics.reduce((total, item) => total + item.metric.registros, 0);
    const elucidados = metrics.reduce((total, item) => total + item.metric.elucidados, 0);
    const topYear = metrics.reduce(
      (best, item) =>
        item.metric.registros > best.registros
          ? { year: item.year, registros: item.metric.registros }
          : best,
      { year: visibleYears[0] ?? 0, registros: 0 },
    );
    const bestYear = metrics.reduce(
      (best, item) => {
        if (item.metric.elucidados > best.elucidados) {
          return {
            year: item.year,
            elucidados: item.metric.elucidados,
          };
        }

        if (item.metric.elucidados === best.elucidados && item.year > best.year) {
          return {
            year: item.year,
            elucidados: item.metric.elucidados,
          };
        }

        return best;
      },
      { year: visibleYears[0] ?? 0, elucidados: 0 },
    );

    return { registros, elucidados, topYear, bestYear };
  }, [comparison.totals, visibleYears]);
  const yearRangeLabel =
    visibleYears.length > 1
      ? `${visibleYears[0]} – ${visibleYears[visibleYears.length - 1]}`
      : visibleYears[0]
        ? String(visibleYears[0])
        : "Sem anos";

  const openCvliInqueritos = (
    year: number,
    monthIndex: number | null,
    mode: "registros" | "elucidados",
  ) => {
    const { dataInicial, dataFinal } = getCvliPeriodRange(year, monthIndex);
    navigate({
      to: "/inqueritos",
      search: {
        categoria: "cvli",
        dataCampo: mode === "elucidados" ? "remessa_final" : "cvli",
        dataInicial,
        dataFinal,
        ...(mode === "elucidados" ? { elucidado: "sim" } : {}),
      },
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1600px]">
        <header className="mb-5 flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-normal text-foreground">
              <span className="text-info">CVLI</span> — Comparativo Mensal
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fonte: inquéritos ativos acessíveis ao usuário atual.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {selectedYears.length > YEAR_PAGE_SIZE ? (
              <button
                type="button"
                onClick={() => setYearPage(Math.max(1, safeYearPage - 1))}
                disabled={safeYearPage === 1}
                className="h-9 rounded-md border border-info/70 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground shadow-[0_0_10px_rgba(14,165,233,0.14)] transition hover:border-info hover:text-info disabled:cursor-not-allowed disabled:border-info/45 disabled:opacity-40"
              >
                ← Anos anteriores
              </button>
            ) : null}
            <div className="min-w-36 text-center">
              <div className="text-2xl font-black tabular-nums text-foreground/80">
                {yearRangeLabel}
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/75">
                {visibleYears.length} de {selectedYears.length} ano(s)
              </div>
            </div>
            {selectedYears.length > YEAR_PAGE_SIZE ? (
              <button
                type="button"
                onClick={() => setYearPage(Math.min(totalYearPages, safeYearPage + 1))}
                disabled={safeYearPage === totalYearPages}
                className="h-9 rounded-md border border-info/70 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground shadow-[0_0_10px_rgba(14,165,233,0.14)] transition hover:border-info hover:text-info disabled:cursor-not-allowed disabled:border-info/45 disabled:opacity-40"
              >
                Próximos anos →
              </button>
            ) : null}
          </div>
        </header>

        <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric
            label="Total de registros"
            value={summary.registros}
            hint="No período selecionado"
            icon={<FileSpreadsheet className="h-7 w-7" />}
            tone="info"
          />
          <SummaryMetric
            label="Total elucidados"
            value={summary.elucidados}
            hint="No período selecionado"
            icon={<CheckCircle2 className="h-7 w-7" />}
            tone="success"
          />
          <SummaryMetric
            label="Ano com mais registros"
            value={summary.topYear.year || "—"}
            hint={`${summary.topYear.registros} registros`}
            icon={<BarChart3 className="h-7 w-7" />}
            tone="info"
          />
          <SummaryMetric
            label="Ano com mais elucidações"
            value={summary.bestYear.elucidados > 0 ? summary.bestYear.year : "—"}
            hint={
              summary.bestYear.elucidados > 0
                ? `${summary.bestYear.elucidados} elucidações`
                : "Sem elucidações"
            }
            icon={<Trophy className="h-7 w-7" />}
            tone="success"
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-info/25 bg-[#080d10] shadow-[0_0_28px_rgba(14,165,233,0.06)]">
          <div className="flex justify-end border-b border-border bg-muted/20 px-5 py-3">
            <div className="flex flex-wrap gap-4 rounded-md border border-border bg-background/70 px-4 py-2 text-xs">
              <LegendDot color="bg-info" label="Registros pela data do fato" />
              <LegendDot color="bg-success" label="Elucidações pela data da remessa" />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Carregando dados reais do CVLI...
            </div>
          ) : error ? (
            <div className="p-12 text-center text-sm text-destructive">{error}</div>
          ) : visibleYears.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum registro CVLI com data de referência foi encontrado.
            </div>
          ) : (
            <CvliComparisonTable
              comparison={comparison}
              years={visibleYears}
              onOpenMetric={openCvliInqueritos}
            />
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function CvliComparisonTable({
  comparison,
  years,
  onOpenMetric,
}: {
  comparison: ReturnType<typeof buildCvliMonthlyComparison>;
  years: number[];
  onOpenMetric: (year: number, monthIndex: number | null, mode: "registros" | "elucidados") => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="cvli-comparison-table w-full min-w-[820px] border-collapse bg-[#080d10] text-sm">
        <thead>
          <tr className="border-b border-info/25 bg-[#0a1014]">
            <th
              rowSpan={2}
              className="sticky left-0 z-10 w-44 border-r border-info/20 bg-[#0a1014] px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground"
            >
              Mês
            </th>
            {years.map((year, index) => (
              <th
                key={year}
                colSpan={2}
                className={`bg-[#0a1014] px-4 py-3 text-center text-sm font-black text-foreground ${
                  index > 0
                    ? "cvli-year-divider border-l-2 border-l-slate-100/70"
                    : "border-l border-l-info/20"
                } border-r border-r-info/20`}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.95)]"
                  />
                  {year}
                </span>
              </th>
            ))}
          </tr>
          <tr className="border-b border-info/25 bg-[#080d10]">
            {years.flatMap((year, index) => [
              <th
                key={`${year}-registros`}
                className={`border-r border-info/10 px-3 py-2 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-info ${
                  index > 0 ? "cvli-year-divider border-l-2 border-l-slate-100/70" : ""
                }`}
              >
                Registros
              </th>,
              <th
                key={`${year}-elucidados`}
                className="border-r border-info/10 px-3 py-2 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-success"
              >
                Elucidados
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr
              key={row.monthIndex}
              className="border-b border-info/20 bg-[#080d10] transition-colors hover:bg-[#0b1418]"
            >
              <th className="sticky left-0 z-10 border-r border-info/20 bg-[#080d10] px-4 py-3 text-left font-semibold text-foreground">
                {row.month}
              </th>
              {years.flatMap((year, index) =>
                renderMetricCells(`${row.monthIndex}-${year}`, row.byYear[year], {
                  year,
                  isFirstYear: index === 0,
                  monthIndex: row.monthIndex,
                  monthLabel: row.month,
                  onOpenMetric,
                }),
              )}
            </tr>
          ))}
          <tr className="border-t border-success/70 bg-[#090f12] font-black shadow-[inset_0_1px_0_rgba(34,197,94,0.45)]">
            <th className="sticky left-0 z-10 border-r border-info/20 bg-[#090f12] px-4 py-4 text-left text-success">
              TOTAL
            </th>
            {years.flatMap((year, index) =>
              renderMetricCells(`total-${year}`, comparison.totals[year], {
                year,
                isFirstYear: index === 0,
                monthIndex: null,
                monthLabel: "Todos os meses",
                onOpenMetric,
                emphasized: true,
              }),
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function renderMetricCells(
  key: string,
  metric: CvliMetric,
  options: {
    year: number;
    isFirstYear: boolean;
    monthIndex: number | null;
    monthLabel: string;
    onOpenMetric: (
      year: number,
      monthIndex: number | null,
      mode: "registros" | "elucidados",
    ) => void;
    emphasized?: boolean;
  },
) {
  const { year, isFirstYear, monthIndex, monthLabel, onOpenMetric, emphasized = false } = options;
  const valueClass = emphasized ? "font-black" : "font-semibold";
  const yearDividerClass = isFirstYear ? "" : "cvli-year-divider border-l-2 border-l-slate-100/70";

  return [
    <td
      key={`${key}-registros`}
      className={`${yearDividerClass} border-r border-info/10 px-3 py-3 text-center tabular-nums ${valueClass}`}
    >
      <MetricLink
        value={metric.registros}
        tone="info"
        title={`Abrir registros CVLI de ${monthLabel} de ${year}`}
        onClick={() => onOpenMetric(year, monthIndex, "registros")}
      />
    </td>,
    <td
      key={`${key}-elucidados`}
      className={`border-r border-info/10 px-3 py-3 text-center tabular-nums ${valueClass}`}
    >
      <MetricLink
        value={metric.elucidados}
        tone="success"
        title={`Abrir CVLIs elucidados de ${monthLabel} de ${year}`}
        onClick={() => onOpenMetric(year, monthIndex, "elucidados")}
      />
    </td>,
  ];
}

function MetricLink({
  value,
  tone,
  title,
  onClick,
}: {
  value: number;
  tone: "info" | "success";
  title: string;
  onClick: () => void;
}) {
  const colorClass =
    value === 0 ? "text-muted-foreground/55" : tone === "info" ? "text-info" : "text-success";

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`rounded-md px-2 py-1 font-inherit tabular-nums underline-offset-4 transition hover:bg-success/10 hover:text-success hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/45 ${colorClass}`}
    >
      {value}
    </button>
  );
}

function getCvliPeriodRange(year: number, monthIndex: number | null) {
  if (monthIndex === null) {
    return {
      dataInicial: `${year}-01-01`,
      dataFinal: `${year}-12-31`,
    };
  }

  const month = String(monthIndex + 1).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  return {
    dataInicial: `${year}-${month}-01`,
    dataFinal: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function SummaryMetric({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: ReactNode;
  tone: "success" | "warning" | "destructive" | "info";
}) {
  const tones = {
    success: {
      card: "border-success/25 bg-success/[0.045]",
      icon: "text-success shadow-[0_0_18px_rgba(34,197,94,0.22)]",
      value: "text-success",
    },
    warning: {
      card: "border-warning/25 bg-warning/[0.045]",
      icon: "text-warning shadow-[0_0_18px_rgba(245,158,11,0.22)]",
      value: "text-warning",
    },
    destructive: {
      card: "border-destructive/25 bg-destructive/[0.045]",
      icon: "text-destructive shadow-[0_0_18px_rgba(239,68,68,0.22)]",
      value: "text-destructive",
    },
    info: {
      card: "border-info/25 bg-info/[0.045]",
      icon: "text-info shadow-[0_0_18px_rgba(14,165,233,0.22)]",
      value: "text-info",
    },
  };
  const selectedTone = tones[tone];

  return (
    <div className={`rounded-lg border px-4 py-4 ${selectedTone.card}`}>
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-background/65 ${selectedTone.icon}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          <div className={`mt-1 truncate text-2xl font-black tabular-nums ${selectedTone.value}`}>
            {value}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-muted-foreground">
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full ${color} shadow-[0_0_10px_currentColor]`}
      />
      <span className="font-semibold">{label}</span>
    </span>
  );
}
