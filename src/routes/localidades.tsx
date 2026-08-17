import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, FileText, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { isCvliRecord } from "@/lib/cvliMetrics";
import { calculateInqueritoOperationalPriority } from "@/lib/inqueritosPriority";
import { hasRelatorioEnviado } from "@/lib/operationalMetrics";
import { listInqueritos, type InqueritoRecord } from "@/lib/repositories/inqueritosRepository";

export const Route = createFileRoute("/localidades")({
  head: () => ({
    meta: [
      { title: "Análise por Localidade — SIPI" },
      {
        name: "description",
        content: "Lista operacional de procedimentos agrupados por bairro e localidade.",
      },
    ],
  }),
  component: LocalidadesPage,
});

type LocalidadeStats = {
  localidade: string;
  total: number;
  cvli: number;
  alta: number;
};

type LocalidadeGroup = {
  stats: LocalidadeStats;
  inqueritos: InqueritoRecord[];
  searchableRecords: string[];
};

type LocalidadeIndex = {
  stats: LocalidadeStats[];
  byLocalidade: Map<string, LocalidadeGroup>;
  totals: Omit<LocalidadeStats, "localidade">;
};

const PAGE_SIZE = 20;

function LocalidadesPage() {
  const navigate = Route.useNavigate();
  const [inqueritos, setInqueritos] = useState<InqueritoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocalidade, setSelectedLocalidade] = useState("todas");
  const [openLocalidade, setOpenLocalidade] = useState<string | null>(null);
  const [localidadePage, setLocalidadePage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await listInqueritos();
        if (!cancelled) setInqueritos(data);
      } catch {
        if (!cancelled) setError("Não foi possível carregar a análise por localidade.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const localidadeIndex = useMemo(() => buildLocalidadeIndex(inqueritos), [inqueritos]);
  const stats = localidadeIndex.stats;
  const visibleStats = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return stats.filter((item) => {
      const matchesLocalidade =
        selectedLocalidade === "todas" || item.localidade === selectedLocalidade;
      if (!matchesLocalidade) return false;
      if (!normalizedSearch) return true;

      return (
        localidadeIndex.byLocalidade
          .get(item.localidade)
          ?.searchableRecords.some((record) => record.includes(normalizedSearch)) ?? false
      );
    });
  }, [localidadeIndex, searchTerm, selectedLocalidade, stats]);
  useEffect(() => {
    setLocalidadePage(1);
  }, [searchTerm, selectedLocalidade]);
  const totalLocalidadePages = Math.max(1, Math.ceil(visibleStats.length / PAGE_SIZE));
  const safeLocalidadePage = Math.min(localidadePage, totalLocalidadePages);
  const paginatedStats = useMemo(() => {
    const start = (safeLocalidadePage - 1) * PAGE_SIZE;
    return visibleStats.slice(start, start + PAGE_SIZE);
  }, [safeLocalidadePage, visibleStats]);
  const modalInqueritos = useMemo(() => {
    if (!openLocalidade) return [];
    return localidadeIndex.byLocalidade.get(openLocalidade)?.inqueritos ?? [];
  }, [localidadeIndex, openLocalidade]);
  const selectedStats = useMemo(() => {
    if (selectedLocalidade === "todas") {
      return localidadeIndex.totals;
    }

    return (
      localidadeIndex.byLocalidade.get(selectedLocalidade)?.stats ?? {
        total: 0,
        cvli: 0,
        alta: 0,
      }
    );
  }, [localidadeIndex, selectedLocalidade]);

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1600px]">
        <header className="mb-5 border-b border-border/70 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-warning/45 bg-warning/10 text-warning shadow-[0_0_18px_rgba(245,158,11,0.12)]">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-warning">
                  Mapa operacional
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-normal text-foreground">
                  Análise por Localidade
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Encontre rapidamente os procedimentos por bairro, distrito e equipe.
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[360px]">
              <SummaryBadge label="Total" value={selectedStats.total} tone="info" />
              <SummaryBadge label="CVLI" value={selectedStats.cvli} tone="destructive" />
              <SummaryBadge label="Alta" value={selectedStats.alta} tone="warning" />
            </div>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <label className="relative block">
            <Search className="sipi-search-neon pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-warning" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por PPE, bairro, vítima, investigado, equipe ou status..."
              className="sipi-field-neon sipi-field-neon-warning h-12 w-full rounded-lg border bg-card pl-11 pr-4 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          <select
            value={selectedLocalidade}
            onChange={(event) => setSelectedLocalidade(event.target.value)}
            className="sipi-field-neon sipi-field-neon-warning h-12 rounded-lg border bg-card px-4 text-sm font-semibold text-foreground outline-none"
          >
            <option value="todas">Todas as localidades</option>
            {stats.map((item) => (
              <option key={item.localidade} value={item.localidade}>
                {item.localidade}
              </option>
            ))}
          </select>
        </section>

        <section className="mb-5 overflow-hidden rounded-xl border border-warning/25 bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.16em] text-warning">
                Localidades
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Clique em uma localidade para ver os B.O. vinculados em uma janela operacional.
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {visibleStats.length} localidade(s)
              {visibleStats.length > PAGE_SIZE
                ? ` - pagina ${safeLocalidadePage}/${totalLocalidadePages}`
                : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-background/35 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left">Bairro / Distrito</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">CVLI</th>
                  <th className="px-5 py-3 text-right">Alta</th>
                </tr>
              </thead>
              <tbody>
                {visibleStats.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-10 text-center text-sm text-muted-foreground"
                    >
                      Nenhuma localidade encontrada.
                    </td>
                  </tr>
                ) : (
                  paginatedStats.map((item) => (
                    <tr
                      key={item.localidade}
                      onClick={() => setOpenLocalidade(item.localidade)}
                      className="cursor-pointer border-b border-border/60 transition hover:bg-warning/[0.06]"
                    >
                      <td className="px-5 py-3 font-black text-foreground">
                        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-warning shadow-[0_0_8px_rgba(245,158,11,0.85)]" />
                        {item.localidade}
                      </td>
                      <td className="px-5 py-3 text-right font-black tabular-nums">{item.total}</td>
                      <td className="px-5 py-3 text-right font-black tabular-nums text-destructive">
                        {item.cvli}
                      </td>
                      <td className="px-5 py-3 text-right font-black tabular-nums text-warning">
                        {item.alta}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {visibleStats.length > PAGE_SIZE ? (
            <Pagination
              page={safeLocalidadePage}
              totalPages={totalLocalidadePages}
              onPageChange={setLocalidadePage}
            />
          ) : null}
        </section>

        {openLocalidade ? (
          <LocalidadeModal
            localidade={openLocalidade}
            inqueritos={modalInqueritos}
            loading={loading}
            error={error}
            onClose={() => setOpenLocalidade(null)}
            onOpenInquerito={(caseId) =>
              navigate({
                to: "/inqueritos/$caseId",
                params: { caseId },
              })
            }
          />
        ) : null}
      </div>
    </AppLayout>
  );
}

function buildLocalidadeIndex(inqueritos: InqueritoRecord[]): LocalidadeIndex {
  const byLocalidade = new Map<string, LocalidadeGroup>();
  const totals = {
    total: 0,
    cvli: 0,
    alta: 0,
  };

  inqueritos.forEach((inquerito) => {
    const localidade = getLocalidade(inquerito);
    const current = byLocalidade.get(localidade) ?? {
      stats: {
        localidade,
        total: 0,
        cvli: 0,
        alta: 0,
      },
      inqueritos: [],
      searchableRecords: [],
    };
    const isCvli = isCvliRecord(inquerito);
    const isAlta = isHighPriority(inquerito);

    current.stats.total += 1;
    totals.total += 1;
    if (isCvli) {
      current.stats.cvli += 1;
      totals.cvli += 1;
    }
    if (isAlta) {
      current.stats.alta += 1;
      totals.alta += 1;
    }
    current.inqueritos.push(inquerito);
    current.searchableRecords.push(
      normalizeText(
        [
          localidade,
          inquerito.numero_ppe,
          inquerito.tipo,
          inquerito.situacao,
          inquerito.gravidade,
          inquerito.bairro,
          inquerito.distrito,
          inquerito.vitima,
          inquerito.investigado,
          inquerito.equipe,
        ].join(" "),
      ),
    );
    byLocalidade.set(localidade, current);
  });

  const stats = Array.from(byLocalidade.values())
    .map((group) => group.stats)
    .sort(
      (a, b) =>
        b.total - a.total || b.cvli - a.cvli || a.localidade.localeCompare(b.localidade, "pt-BR"),
    );

  return { stats, byLocalidade, totals };
}

function getLocalidade(inquerito: InqueritoRecord) {
  return inquerito.bairro?.trim() || inquerito.distrito?.trim() || "Não informado";
}

function isHighPriority(inquerito: InqueritoRecord) {
  return calculateInqueritoOperationalPriority(inquerito) === "ALTA";
}

function isConcluidoInquerito(inquerito: InqueritoRecord) {
  return hasRelatorioEnviado(inquerito);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function SummaryBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "destructive" | "warning";
}) {
  const toneClass = {
    info: "border-info/30 bg-info/[0.055] text-info",
    destructive: "border-destructive/30 bg-destructive/[0.055] text-destructive",
    warning: "border-warning/30 bg-warning/[0.055] text-warning",
  };

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass[tone]}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.14em]">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function ListField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/10 px-5 py-3">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground transition hover:border-warning/40 hover:text-warning disabled:cursor-not-allowed disabled:opacity-40"
      >
        Anterior
      </button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onPageChange(item)}
          className={`h-8 min-w-8 rounded-lg border px-2 text-xs font-black tabular-nums transition ${
            item === page
              ? "border-warning/55 bg-warning/15 text-warning shadow-[0_0_14px_rgba(245,158,11,0.16)]"
              : "border-border text-muted-foreground hover:border-warning/35 hover:text-warning"
          }`}
        >
          {item}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground transition hover:border-warning/40 hover:text-warning disabled:cursor-not-allowed disabled:opacity-40"
      >
        Proxima
      </button>
    </div>
  );
}

function LocalidadeModal({
  localidade,
  inqueritos,
  loading,
  error,
  onClose,
  onOpenInquerito,
}: {
  localidade: string;
  inqueritos: InqueritoRecord[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onOpenInquerito: (caseId: string) => void;
}) {
  const [modalSearch, setModalSearch] = useState("");
  const [modalFilter, setModalFilter] = useState("todos");
  const [modalPage, setModalPage] = useState(1);
  const filteredInqueritos = useMemo(() => {
    const query = normalizeText(modalSearch);

    return inqueritos.filter((inquerito) => {
      if (modalFilter === "cvli" && !isCvliRecord(inquerito)) return false;
      if (modalFilter === "alta" && !isHighPriority(inquerito)) return false;
      if (modalFilter === "andamento" && isConcluidoInquerito(inquerito)) return false;
      if (modalFilter === "concluidos" && !isConcluidoInquerito(inquerito)) return false;
      if (!query) return true;

      return normalizeText(
        [
          inquerito.numero_ppe,
          inquerito.codigo_interno,
          inquerito.tipo,
          inquerito.situacao,
          inquerito.gravidade,
          inquerito.vitima,
          inquerito.investigado,
          inquerito.equipe,
        ].join(" "),
      ).includes(query);
    });
  }, [inqueritos, modalFilter, modalSearch]);
  useEffect(() => {
    setModalPage(1);
  }, [modalFilter, modalSearch, localidade]);
  const totalModalPages = Math.max(1, Math.ceil(filteredInqueritos.length / PAGE_SIZE));
  const safeModalPage = Math.min(modalPage, totalModalPages);
  const paginatedInqueritos = useMemo(() => {
    const start = (safeModalPage - 1) * PAGE_SIZE;
    return filteredInqueritos.slice(start, start + PAGE_SIZE);
  }, [filteredInqueritos, safeModalPage]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`B.O. da localidade ${localidade}`}
    >
      <div className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-warning/35 bg-card shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-warning">
              Localidade selecionada
            </p>
            <h3 className="mt-1 text-xl font-black text-foreground">{localidade}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredInqueritos.length} de {inqueritos.length} B.O./procedimento(s) nesta
              localidade.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition hover:border-warning/45 hover:text-warning"
            aria-label="Fechar janela"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 border-b border-border bg-background/25 px-5 py-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={modalSearch}
              onChange={(event) => setModalSearch(event.target.value)}
              placeholder="Buscar nesta localidade por PPE, vitima, investigado, tipo ou equipe..."
              className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted-foreground focus:border-warning/60 focus:ring-2 focus:ring-warning/15"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              ["todos", "Todos"],
              ["cvli", "CVLI"],
              ["alta", "Alta"],
              ["andamento", "Em andamento"],
              ["concluidos", "Concluidos"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setModalFilter(key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] transition ${
                  modalFilter === key
                    ? "border-warning/55 bg-warning/15 text-warning"
                    : "border-border text-muted-foreground hover:border-warning/35 hover:text-warning"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando procedimentos...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-sm text-destructive">{error}</div>
        ) : filteredInqueritos.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhum procedimento encontrado para os filtros atuais.
          </div>
        ) : (
          <div className="max-h-[62vh] divide-y divide-border/60 overflow-y-auto">
            {paginatedInqueritos.map((inquerito) => (
              <button
                key={inquerito.id}
                type="button"
                onClick={() => onOpenInquerito(inquerito.id)}
                className="grid w-full grid-cols-1 gap-3 px-5 py-4 text-left transition hover:bg-warning/[0.055] md:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto]"
              >
                <div>
                  <div className="flex items-center gap-2 font-black text-foreground">
                    <FileText className="h-4 w-4 text-warning" />
                    {inquerito.numero_ppe || inquerito.codigo_interno || "Sem PPE"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{localidade}</div>
                </div>
                <ListField label="Tipo" value={inquerito.tipo || "Nao informado"} />
                <ListField label="Status" value={inquerito.situacao || "Sem status"} />
                <ListField label="Equipe" value={inquerito.equipe || "Sem equipe"} />
                <div className="flex items-center justify-end text-warning">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        )}
        {filteredInqueritos.length > PAGE_SIZE ? (
          <Pagination
            page={safeModalPage}
            totalPages={totalModalPages}
            onPageChange={setModalPage}
          />
        ) : null}
      </div>
    </div>
  );
}
