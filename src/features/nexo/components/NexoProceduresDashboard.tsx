import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Clock3,
  Crosshair,
  Download,
  Eye,
  FileText,
  FilterX,
  MapPin,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppProfileContext } from "@/components/AppProfileContext";
import type { BoRecord } from "@/features/bo/boTypes";
import type { InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import type { NexoOrganizacao, NexoPessoa, NexoRegistroVinculado } from "../nexoTypes";
import {
  buildNexoProcedureRows,
  EMPTY_PROCEDURE_FILTERS,
  geocodedProcedureIncidents,
  normalizeProcedureText,
  summarizeNexoProcedures,
  type NexoProcedureContext,
  type NexoProcedureFilters,
  type NexoProcedureRow,
  type RankedValue,
} from "../nexoProcedureAnalytics";
import { NexoProcedureGeoMap, type ProcedureMapBounds } from "./NexoProcedureGeoMap";
import { NexoProcedureContextDialog } from "./NexoProcedureContextDialog";
import { NexoProcedureIncidentDialog } from "./NexoProcedureIncidentDialog";
import { NexoProcedureSavedViews } from "./NexoProcedureSavedViews";
import { NexoProcedureTrendPanel, type ProcedureTrendSelection } from "./NexoProcedureTrendPanel";
import type { ProcedureViewState } from "../nexoProcedureViews";
import {
  NexoProcedureAnalysisPanel,
  type ProcedureTimeSelection,
} from "./NexoProcedureAnalysisPanel";
import {
  procedureDataCoverage,
  procedureMissingFields,
  resolveProcedureScope,
  type ProcedureMissingField,
} from "../nexoProcedureInsights";

type RankKind = "neighborhood" | "date" | "hour";
type RankSelection = { kind: RankKind; key: string } | null;

const fieldClass =
  "h-11 w-full rounded-xl border border-[#d7e4ec] bg-white px-3 text-sm font-semibold text-[#274a60] outline-none transition focus:border-[#34a8bc] focus:ring-2 focus:ring-[#34a8bc]/15";

const DEMO_PROCEDURES: NexoProcedureRow[] = [
  ["demo-01", "IP DEMO 001/2026", "Centro", "2026-10-12", "21:35", "Grupo Atlas", true],
  ["demo-02", "IP DEMO 002/2026", "Centro", "2026-10-12", "22:10", "Grupo Atlas", true],
  ["demo-03", "IP DEMO 003/2026", "Bandeirantes", "2026-10-11", "20:15", "Núcleo Norte", true],
  ["demo-04", "IP DEMO 004/2026", "Ouro Verde", "2026-10-10", "21:50", "Grupo Atlas", true],
  ["demo-05", "IP DEMO 005/2026", "Centro", "2026-10-09", "19:05", "Grupo Atlas", true],
  ["demo-06", "IP DEMO 006/2026", "Bandeirantes", "2026-10-09", "22:40", "Núcleo Norte", true],
  ["demo-07", "IP DEMO 007/2026", "São José", "2026-10-08", null, "Grupo Atlas", true],
  ["demo-08", "IP DEMO 008/2026", "Ouro Verde", "2026-10-07", "20:55", "Grupo Atlas", true],
  ["demo-09", "IP DEMO 009/2026", "Centro", "2026-10-06", "21:10", "Núcleo Norte", true],
  ["demo-10", "IP DEMO 010/2026", "Zona rural", "2026-10-04", null, "Célula Leste", true],
  ["demo-11", "IP DEMO 011/2026", "Bandeirantes", "2026-10-02", "15:25", "Núcleo Norte", false],
  ["demo-12", "IP DEMO 012/2026", "Centro", "2026-09-28", "17:40", "Grupo Atlas", false],
  ["demo-13", "IP DEMO 013/2026", "Ouro Verde", "2026-09-25", null, "Grupo Atlas", false],
]
  .map<NexoProcedureRow>(
    ([id, number, neighborhood, factDate, factTime, faction, cvli], index) => ({
      id: `inquerito:${id}`,
      kind: "inquerito" as const,
      procedureId: String(id),
      incidentId: String(id),
      number: String(number),
      nature: cvli ? "Homicídio doloso (dado fictício)" : "Investigação não CVLI (dado fictício)",
      status: "Em andamento",
      neighborhood: String(neighborhood),
      factDate: String(factDate),
      factTime: factTime ? String(factTime) : null,
      latitude: index < 10 ? Number((-16.5702 - (index % 4) * 0.0018).toFixed(6)) : null,
      longitude: index < 10 ? Number((-39.5635 - (index % 3) * 0.0021).toFixed(6)) : null,
      factions: [String(faction)],
      cvli: Boolean(cvli),
      linkedToNexo: true,
      context: null,
    }),
  )
  .concat([
    {
      id: "bo:demo-bo-01",
      kind: "bo" as const,
      procedureId: "demo-bo-01",
      incidentId: "demo-01",
      number: "BO DEMO 014/2026",
      nature: "Homicídio doloso (dado fictício)",
      status: "Registrado",
      neighborhood: "Centro",
      factDate: "2026-10-12",
      factTime: "21:35",
      latitude: -16.5702,
      longitude: -39.5635,
      factions: ["Grupo Atlas"],
      cvli: true,
      linkedToNexo: true,
      context: null,
    },
    {
      id: "bo:demo-bo-02",
      kind: "bo" as const,
      procedureId: "demo-bo-02",
      incidentId: "demo-bo-02",
      number: "BO DEMO 015/2026",
      nature: "Investigação não CVLI (dado fictício)",
      status: "Registrado",
      neighborhood: "Bandeirantes",
      factDate: "2026-10-03",
      factTime: "16:20",
      latitude: -16.5764,
      longitude: -39.5708,
      factions: ["Núcleo Norte"],
      cvli: false,
      linkedToNexo: true,
      context: null,
    },
  ])
  .map((row) => ({
    ...row,
    sourceFactDate: row.factDate,
    sourceNeighborhood: row.neighborhood,
    context:
      row.factTime || row.latitude !== null
        ? {
            id: `context-${row.id}`,
            inquerito_id: row.kind === "inquerito" ? row.procedureId : null,
            bo_id: row.kind === "bo" ? row.procedureId : null,
            data_fato: null,
            hora_fato: row.factTime,
            bairro: null,
            latitude: row.latitude,
            longitude: row.longitude,
            fonte: "Informação fictícia para demonstração do painel.",
            updated_at: "2026-10-17T12:00:00Z",
          }
        : null,
  }));

function matchesRank(row: NexoProcedureRow, rank: RankSelection) {
  if (!rank) return true;
  if (!row.cvli) return false;
  if (rank.kind === "neighborhood") return normalizeProcedureText(row.neighborhood) === rank.key;
  if (rank.kind === "date") return row.factDate === rank.key;
  return row.factTime?.slice(0, 2) === rank.key;
}

function matchesTimeCell(row: NexoProcedureRow, selection: ProcedureTimeSelection) {
  if (!selection) return true;
  return Boolean(
    row.cvli &&
    row.factDate &&
    row.factTime &&
    new Date(`${row.factDate}T12:00:00Z`).getUTCDay() === selection.weekday &&
    Number(row.factTime.slice(0, 2)) === selection.hour,
  );
}

function csvCell(value: string) {
  const safe = /^\s*[-=+@]|^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function displayDate(value: string | null) {
  if (!value) return "Sem data do fato";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border p-5 ${accent ? "border-[#173f58] bg-[#153d56] text-white shadow-[0_16px_30px_-22px_#113047]" : "border-[#dce8ef] bg-white text-[#173a53]"}`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent ? "bg-white/10 text-[#8be5ed]" : "bg-[#eaf5f8] text-[#2389a1]"}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-4 text-[30px] font-black leading-none tracking-[-.06em]">{value}</div>
      <p
        className={`mt-2 text-[11px] font-black uppercase tracking-[.1em] ${accent ? "text-[#d7f0f3]" : "text-[#31556e]"}`}
      >
        {label}
      </p>
      <p className={`mt-1 text-[11px] ${accent ? "text-[#93b8c7]" : "text-[#567184]"}`}>{detail}</p>
      {accent ? (
        <div className="pointer-events-none absolute -bottom-12 -right-8 h-40 w-40 rounded-full border border-white/10" />
      ) : null}
    </div>
  );
}

function RankCard({
  title,
  subtitle,
  icon: Icon,
  values,
  kind,
  selected,
  onSelect,
  emptyText,
}: {
  title: string;
  subtitle: string;
  icon: typeof Activity;
  values: RankedValue[];
  kind: RankKind;
  selected: RankSelection;
  onSelect: (selection: RankSelection) => void;
  emptyText: string;
}) {
  const max = values[0]?.count || 1;
  return (
    <section className="rounded-[24px] border border-[#dce8ef] bg-white p-5 shadow-[0_16px_32px_-30px_#213d51] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf5f8] text-[#2488a0]">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-sm font-black text-[#1b3d56]">{title}</h3>
          <p className="mt-1 text-[11px] text-[#567184]">{subtitle}</p>
        </div>
        <span className="ml-auto rounded-full bg-[#f0f5f7] px-2.5 py-1 text-[11px] font-black text-[#6d8b9a]">
          TOP 10
        </span>
      </div>
      {values.length ? (
        <div className="mt-5 space-y-2.5">
          {values.map((item, index) => {
            const active = selected?.kind === kind && selected.key === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(active ? null : { kind, key: item.key })}
                aria-pressed={active}
                className={`group flex w-full items-center gap-2.5 rounded-xl border px-2 py-2 text-left transition ${active ? "border-[#69b9c8] bg-[#edf8fa]" : "border-transparent hover:border-[#d6eaf0] hover:bg-[#f8fbfc]"}`}
              >
                <span
                  className={`w-5 shrink-0 text-center text-[11px] font-black ${index < 3 ? "text-[#258fa5]" : "text-[#567184]"}`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2 text-[11px] font-bold text-[#33536a]">
                    <span className="truncate" title={item.label}>
                      {item.label}
                    </span>
                    <span className="shrink-0 tabular-nums">{item.count}</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#edf3f5]">
                    <span
                      className={`block h-full rounded-full ${active ? "bg-[#166b84]" : "bg-gradient-to-r from-[#25a3b7] to-[#7ed8e1]"}`}
                      style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }}
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-[#d9e5eb] bg-[#f8fbfc] px-5 text-center">
          <Icon className="h-6 w-6 text-[#a4bcc7]" />
          <p className="mt-2 max-w-[240px] text-xs leading-relaxed text-[#567184]">{emptyText}</p>
        </div>
      )}
    </section>
  );
}

export function NexoProceduresDashboard({
  organizations,
  people,
  preview,
  previewRows,
}: {
  organizations: NexoOrganizacao[];
  people: NexoPessoa[];
  preview: boolean;
  previewRows?: NexoProcedureRow[];
}) {
  const profile = useContext(AppProfileContext);
  const dialogReturnFocus = useRef<HTMLElement | null>(null);
  const [inquiries, setInquiries] = useState<InqueritoRecord[]>([]);
  const [reports, setReports] = useState<BoRecord[]>([]);
  const [links, setLinks] = useState<NexoRegistroVinculado[]>([]);
  const [contexts, setContexts] = useState<NexoProcedureContext[]>([]);
  const [demoRows, setDemoRows] = useState(previewRows || DEMO_PROCEDURES);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [filters, setFilters] = useState<NexoProcedureFilters>({ ...EMPTY_PROCEDURE_FILTERS });
  const [rankSelection, setRankSelection] = useState<RankSelection>(null);
  const [showCount, setShowCount] = useState(12);
  const [editing, setEditing] = useState<NexoProcedureRow | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedMapIds, setSelectedMapIds] = useState<string[]>([]);
  const [focusMapId, setFocusMapId] = useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState(0);
  const [mapBounds, setMapBounds] = useState<ProcedureMapBounds | null>(null);
  const [mapRestore, setMapRestore] = useState<{
    bounds: ProcedureMapBounds;
    request: number;
  } | null>(null);
  const mapRestoreCounter = useRef(0);
  const [visibleAreaOnly, setVisibleAreaOnly] = useState(false);
  const [timeSelection, setTimeSelection] = useState<ProcedureTimeSelection>(null);
  const [trendSelection, setTrendSelection] = useState<ProcedureTrendSelection | null>(null);
  const [inspectingIncidentId, setInspectingIncidentId] = useState<string | null>(null);
  const [missingField, setMissingField] = useState<ProcedureMissingField | "all">("all");
  const [sortOrder, setSortOrder] = useState<ProcedureViewState["sortOrder"]>("recent");
  const [exportedCount, setExportedCount] = useState<number | null>(null);

  useEffect(() => {
    if (preview && previewRows) setDemoRows(previewRows);
  }, [preview, previewRows]);

  useEffect(() => {
    if (preview) return;
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([
      import("@/lib/repositories/nexoProcedureContextRepository").then((repo) =>
        repo.listNexoProcedureSources(),
      ),
      import("@/lib/repositories/nexoProcedureContextRepository").then((repo) =>
        repo.listNexoProcedureContexts(),
      ),
    ])
      .then(([sources, foundContexts]) => {
        if (!active) return;
        setInquiries(sources.inquiries);
        setReports(sources.reports);
        setLinks(sources.links);
        setContexts(foundContexts);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Não foi possível carregar os procedimentos.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [preview, refreshToken]);

  const rows = useMemo(
    () =>
      preview
        ? demoRows
        : buildNexoProcedureRows({ inquiries, reports, links, contexts, organizations, people }),
    [preview, demoRows, inquiries, reports, links, contexts, organizations, people],
  );
  const factions = useMemo(
    () =>
      [...new Set(rows.flatMap((row) => row.factions))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows],
  );
  const scope = useMemo(() => resolveProcedureScope(rows, filters), [rows, filters]);
  const filtered = scope.procedures;
  const canonicalFiltered = scope.incidents;
  const rankSummary = useMemo(
    () => summarizeNexoProcedures(canonicalFiltered),
    [canonicalFiltered],
  );
  const rankedIncidents = useMemo(
    () => canonicalFiltered.filter((row) => matchesRank(row, rankSelection)),
    [canonicalFiltered, rankSelection],
  );
  const activeIncidents = useMemo(
    () =>
      rankedIncidents.filter(
        (row) =>
          matchesTimeCell(row, timeSelection) &&
          (!trendSelection ||
            Boolean(
              row.factDate &&
              row.factDate >= trendSelection.from &&
              row.factDate <= trendSelection.to,
            )),
      ),
    [rankedIncidents, timeSelection, trendSelection],
  );
  const drilledRows = useMemo(() => {
    const ids = new Set(activeIncidents.map((row) => row.incidentId));
    return filtered.filter((row) => ids.has(row.incidentId));
  }, [filtered, activeIncidents]);
  const summary = useMemo(
    () => ({
      ...summarizeNexoProcedures(activeIncidents),
      total: drilledRows.length,
      inquiries: drilledRows.filter((row) => row.kind === "inquerito").length,
      reports: drilledRows.filter((row) => row.kind === "bo").length,
    }),
    [activeIncidents, drilledRows],
  );
  const coverage = useMemo(() => procedureDataCoverage(activeIncidents), [activeIncidents]);
  const comparisonRows = useMemo(
    () =>
      scope.comparisonIncidents.filter(
        (row) =>
          matchesRank(row, rankSelection?.kind === "date" ? null : rankSelection) &&
          matchesTimeCell(row, timeSelection),
      ),
    [scope.comparisonIncidents, rankSelection, timeSelection],
  );
  const rankLabel = rankSelection
    ? (rankSelection.kind === "neighborhood"
        ? rankSummary.neighborhoods
        : rankSelection.kind === "date"
          ? rankSummary.dates
          : rankSummary.hours
      ).find((item) => item.key === rankSelection.key)?.label
    : null;
  const mappedRows = useMemo(() => geocodedProcedureIncidents(activeIncidents), [activeIncidents]);
  const mapPoints = useMemo(
    () =>
      mappedRows.map((row) => ({
        id: row.id,
        number: row.number,
        latitude: row.latitude!,
        longitude: row.longitude!,
        cvli: row.cvli,
      })),
    [mappedRows],
  );
  const selectedMapRow = mappedRows.find((row) => row.id === selectedMapId) || null;
  const unmappedCount = activeIncidents.length - mappedRows.length;
  const workRows = useMemo(() => {
    const canonical = new Map(activeIncidents.map((row) => [row.incidentId, row]));
    const selectedIncidents = new Set(
      mappedRows.filter((row) => selectedMapIds.includes(row.id)).map((row) => row.incidentId),
    );
    return drilledRows
      .filter((row) => {
        const incident = canonical.get(row.incidentId)!;
        if (selectedMapIds.length && !selectedIncidents.has(row.incidentId)) return false;
        if (missingField !== "all" && !procedureMissingFields(incident).includes(missingField))
          return false;
        if (visibleAreaOnly && mapBounds) {
          const { latitude, longitude } = incident;
          if (
            latitude === null ||
            longitude === null ||
            latitude < mapBounds.south ||
            latitude > mapBounds.north ||
            (mapBounds.west <= mapBounds.east
              ? longitude < mapBounds.west || longitude > mapBounds.east
              : longitude < mapBounds.west && longitude > mapBounds.east)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === "number")
          return a.number.localeCompare(b.number, "pt-BR", { numeric: true });
        if (sortOrder === "pending")
          return (
            procedureMissingFields(canonical.get(b.incidentId)!).length -
              procedureMissingFields(canonical.get(a.incidentId)!).length ||
            a.number.localeCompare(b.number, "pt-BR")
          );
        return sortOrder === "oldest"
          ? (a.factDate || "9999").localeCompare(b.factDate || "9999")
          : (b.factDate || "").localeCompare(a.factDate || "");
      });
  }, [
    drilledRows,
    activeIncidents,
    mappedRows,
    selectedMapIds,
    missingField,
    visibleAreaOnly,
    mapBounds,
    sortOrder,
  ]);

  function resetExploration() {
    setRankSelection(null);
    setSelectedMapId(null);
    setSelectedMapIds([]);
    setFocusMapId(null);
    setMapRestore(null);
    setTimeSelection(null);
    setTrendSelection(null);
    setVisibleAreaOnly(false);
    setMissingField("all");
    setShowCount(12);
    setExportedCount(null);
  }

  function updateFilter<K extends keyof NexoProcedureFilters>(
    key: K,
    value: NexoProcedureFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    resetExploration();
  }

  function selectRank(selection: RankSelection) {
    resetExploration();
    setRankSelection(selection);
  }

  function focusIncidentOnMap(incidentId: string) {
    const point = mappedRows.find((item) => item.incidentId === incidentId);
    if (!point) return;
    setSelectedMapId(point.id);
    setFocusMapId(point.id);
    setMapFocusRequest((value) => value + 1);
    window.requestAnimationFrame(() => {
      const map = document.getElementById("nexo-procedure-map");
      map?.focus({ preventScroll: true });
      map?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function openIncident(incidentId: string) {
    dialogReturnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setInspectingIncidentId(incidentId);
  }

  function openContext(row: NexoProcedureRow) {
    dialogReturnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(row);
  }

  function applySavedView(state: ProcedureViewState) {
    resetExploration();
    setFilters(state.filters);
    setRankSelection(state.rank);
    setTimeSelection(state.time);
    setTrendSelection(state.range);
    setMissingField(state.missingField);
    setSortOrder(state.sortOrder);
    if (state.map) {
      setSelectedMapIds(state.map.selectionIds);
      setSelectedMapId(state.map.selectionIds[0] || null);
      if (state.map.bounds) {
        setVisibleAreaOnly(true);
        setMapBounds(state.map.bounds);
        setMapRestore({ bounds: state.map.bounds, request: ++mapRestoreCounter.current });
      }
    }
  }

  function applyPeriod(days: number | null) {
    resetExploration();
    if (!days) {
      setFilters((current) => ({ ...current, from: "", to: "" }));
      return;
    }
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const to = preview
      ? rows
          .map((row) => row.factDate || "")
          .sort()
          .at(-1) || today
      : today;
    const start = new Date(`${to}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - days + 1);
    setFilters((current) => ({ ...current, from: start.toISOString().slice(0, 10), to }));
  }

  function exportCsv() {
    const headers = [
      "Procedimento",
      "Tipo",
      "Natureza",
      "Facções",
      "CVLI",
      "Bairro",
      "Data do fato",
      "Hora do fato",
      "Latitude",
      "Longitude",
      "Fontes dos complementos vinculados ao fato",
    ];
    const csv = [
      headers,
      ...workRows.map((row) => [
        row.number,
        row.kind === "bo" ? "B.O." : "Inquérito",
        row.nature,
        row.factions.join(" | "),
        row.cvli ? "Sim" : "Não",
        row.neighborhood || "",
        row.factDate || "",
        row.factTime || "",
        row.latitude?.toString() || "",
        row.longitude?.toString() || "",
        row.analysisSources.join(" | "),
      ]),
    ]
      .map((line) => line.map(csvCell).join(";"))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nexo-procedimentos-${filters.from || "inicio"}-${filters.to || "atual"}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportedCount(workRows.length);
  }

  async function saveContext(input: {
    data_fato: string | null;
    hora_fato: string | null;
    bairro: string | null;
    latitude: number | null;
    longitude: number | null;
    fonte: string;
  }) {
    if (!editing) return;
    if (preview) {
      const context: NexoProcedureContext = {
        id: editing.context?.id || crypto.randomUUID(),
        inquerito_id: editing.kind === "inquerito" ? editing.procedureId : null,
        bo_id: editing.kind === "bo" ? editing.procedureId : null,
        ...input,
        updated_at: new Date().toISOString(),
      };
      setDemoRows((current) =>
        current.map((row) =>
          row.id === editing.id
            ? {
                ...row,
                context,
                factDate: input.data_fato || row.sourceFactDate || null,
                factTime: input.hora_fato || null,
                latitude: input.latitude,
                longitude: input.longitude,
                neighborhood: input.bairro || row.sourceNeighborhood || null,
              }
            : row,
        ),
      );
      return;
    }
    const repo = await import("@/lib/repositories/nexoProcedureContextRepository");
    const saved = await repo.saveNexoProcedureContext({
      kind: editing.kind,
      procedureId: editing.procedureId,
      ...input,
    });
    setContexts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
  }

  return (
    <section className="nexo-procedures-view pb-20 pt-8 sm:pt-10">
      <div className="relative overflow-hidden rounded-[24px] border border-[#254d63] bg-gradient-to-br from-[#102f48] via-[#173f58] to-[#1a5365] px-6 py-7 text-white shadow-[0_18px_45px_-28px_#0b3045] sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-20 -top-40 h-96 w-96 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-6 -top-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.24em] text-[#7edce8]">
              NEXO / Leitura criminal
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-[-.04em] sm:text-3xl">
              Procedimentos faccionados
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#b7d1db]">
              B.O.s e inquéritos marcados como faccionados ou relacionados a pessoas e organizações
              do NEXO. Rankings de CVLI usam a data do fato, nunca a data de cadastro.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-[#d7edf0]">
                <ShieldCheck className="h-3.5 w-3.5" /> Leitura analítica
              </span>
              {preview ? (
                <span className="rounded-full border border-amber-200/30 bg-amber-100/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-amber-100">
                  Dados fictícios
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (preview) {
                setDemoRows(previewRows || DEMO_PROCEDURES);
                setFilters({ ...EMPTY_PROCEDURE_FILTERS });
                resetExploration();
              } else {
                resetExploration();
                setRefreshToken((value) => value + 1);
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{" "}
            {preview ? "Restaurar demonstração" : "Atualizar dados"}
          </button>
        </div>
      </div>

      <div className="nexo-filter-panel mt-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-[#258fa5]" />
            <h2 className="text-xs font-black uppercase tracking-[.12em] text-[#315a70]">
              Explorar registros
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setFilters({ ...EMPTY_PROCEDURE_FILTERS });
              resetExploration();
            }}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#59829a] hover:text-[#157a92]"
          >
            <FilterX className="h-3.5 w-3.5" /> Limpar filtros
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.6fr)_minmax(150px,1fr)_minmax(130px,.7fr)_minmax(150px,.8fr)_minmax(145px,.8fr)_minmax(145px,.8fr)]">
          <label className="text-[11px] font-black uppercase tracking-wide text-[#567184]">
            Busca
            <input
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Número, natureza, bairro..."
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="text-[11px] font-black uppercase tracking-wide text-[#567184]">
            Facção
            <select
              value={filters.faction}
              onChange={(event) => updateFilter("faction", event.target.value)}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="">Todas</option>
              {factions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-black uppercase tracking-wide text-[#567184]">
            Tipo
            <select
              value={filters.kind}
              onChange={(event) =>
                updateFilter("kind", event.target.value as NexoProcedureFilters["kind"])
              }
              className={`mt-1 ${fieldClass}`}
            >
              <option value="todos">Todos</option>
              <option value="inquerito">Inquéritos</option>
              <option value="bo">B.O.s</option>
            </select>
          </label>
          <label className="text-[11px] font-black uppercase tracking-wide text-[#567184]">
            Natureza
            <select
              value={filters.classification}
              onChange={(event) =>
                updateFilter(
                  "classification",
                  event.target.value as NexoProcedureFilters["classification"],
                )
              }
              className={`mt-1 ${fieldClass}`}
            >
              <option value="todos">Todas</option>
              <option value="cvli">Somente CVLI</option>
              <option value="outros">Outras</option>
            </select>
          </label>
          <label className="text-[11px] font-black uppercase tracking-wide text-[#567184]">
            De
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="text-[11px] font-black uppercase tracking-wide text-[#567184]">
            Até
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#edf2f5] pt-3">
          <span className="mr-1 text-[11px] font-bold text-[#567184]">Período rápido</span>
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => applyPeriod(days)}
              className="rounded-lg border border-[#d9e7ed] px-3 py-1.5 text-[11px] font-bold text-[#537d93] hover:bg-[#eef8fa]"
            >
              {days} dias
            </button>
          ))}
          <button
            type="button"
            onClick={() => applyPeriod(null)}
            className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-[#567184] hover:bg-[#f2f7f9]"
          >
            Todo o histórico
          </button>
          {preview ? (
            <span className="ml-auto text-[11px] text-[#567184]">
              Atalhos até o último fato da demonstração
            </span>
          ) : null}
        </div>
        {filters.from && filters.to && filters.from > filters.to ? (
          <p role="alert" className="mt-3 text-xs text-[#b25749]">
            A data inicial precisa ser anterior ou igual à data final.
          </p>
        ) : null}
      </div>

      <NexoProcedureSavedViews
        key={preview ? "preview" : profile?.id || "session"}
        preview={preview}
        ownerKey={profile?.id || null}
        current={{
          filters,
          rank: rankSelection,
          time: timeSelection,
          range: trendSelection,
          map:
            selectedMapIds.length || visibleAreaOnly
              ? { selectionIds: selectedMapIds, bounds: visibleAreaOnly ? mapBounds : null }
              : null,
          missingField,
          sortOrder,
        }}
        onApply={applySavedView}
      />

      <nav
        aria-label="Atalhos da análise de procedimentos"
        className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-[#65889d]"
      >
        {[
          ["nexo-procedure-indicators", "Indicadores"],
          ["nexo-procedure-trend", "Evolução"],
          ["nexo-procedure-map", "Mapa"],
          ["nexo-procedure-rankings", "Rankings"],
          ["nexo-procedure-list", "Procedimentos e fontes"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="rounded-lg border border-[#dde8ee] bg-white/80 px-3 py-1.5 hover:border-[#9bc9d6] hover:bg-[#edf8fa]"
          >
            {label}
            <ArrowRight className="ml-1.5 inline h-3 w-3 opacity-50" />
          </button>
        ))}
      </nav>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          {error}
          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            className="ml-2 font-bold underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}
      {loading ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-[22px] bg-[#e8f1f5]" />
          ))}
        </div>
      ) : null}
      {!loading && !error ? (
        <>
          {rankSelection || timeSelection || trendSelection ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-[#c8e5ec] bg-[#f1f9fb] px-4 py-2.5">
              <span className="mr-1 text-[11px] font-black uppercase tracking-wide text-[#5d8c9e]">
                Recorte ativo
              </span>
              {rankSelection ? (
                <button
                  type="button"
                  onClick={() => selectRank(null)}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#287c93]"
                >
                  <X className="h-3 w-3" />
                  {rankLabel}
                </button>
              ) : null}
              {timeSelection ? (
                <button
                  type="button"
                  onClick={() => setTimeSelection(null)}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#287c93]"
                >
                  <X className="h-3 w-3" />
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][timeSelection.weekday]} ·{" "}
                  {timeSelection.hour}h–{timeSelection.hour}h59
                </button>
              ) : null}
              {trendSelection ? (
                <button
                  type="button"
                  onClick={() => setTrendSelection(null)}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#287c93]"
                >
                  <X className="h-3 w-3" />
                  {displayDate(trendSelection.from)}–{displayDate(trendSelection.to)}
                </button>
              ) : null}
              <span className="ml-auto text-[11px] text-[#567184]">
                Indicadores, mapa e lista sincronizados
              </span>
            </div>
          ) : null}
          <div
            id="nexo-procedure-indicators"
            className="mt-5 grid scroll-mt-28 gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <MetricCard
              icon={FileText}
              label="Procedimentos"
              value={summary.total}
              detail="B.O.s e inquéritos no recorte"
            />
            <MetricCard
              icon={Activity}
              label="Ocorrências CVLI"
              value={summary.cvli}
              detail="Sem duplicar B.O. e inquérito do mesmo fato"
              accent
            />
            <MetricCard
              icon={BarChart3}
              label="Inquéritos"
              value={summary.inquiries}
              detail="Marcados na origem ou vinculados"
            />
            <MetricCard
              icon={ShieldCheck}
              label="B.O.s"
              value={summary.reports}
              detail="Vinculados ou associados a inquéritos"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[#d9e8ee] bg-[#eef6f8] px-4 py-3 text-[11px] text-[#52778a]">
            <span className="font-black text-[#315d73]">Cobertura dos {summary.cvli} CVLI:</span>
            <span>
              <strong className="text-[#1d6f86]">{summary.knownNeighborhoods}</strong> com bairro
            </span>
            <span>
              <strong className="text-[#1d6f86]">{summary.knownDates}</strong> com data do fato
            </span>
            <span>
              <strong className="text-[#1d6f86]">{summary.knownTimes}</strong> com horário do fato
            </span>
            <span className="ml-auto text-[#7695a4]">
              {activeIncidents.length} fatos distintos no recorte
            </span>
          </div>

          <NexoProcedureTrendPanel
            rows={rankedIncidents.filter((row) => matchesTimeCell(row, timeSelection))}
            from={filters.from}
            to={filters.to}
            selected={trendSelection}
            onSelectRange={(from, to) => {
              setTrendSelection((current) =>
                current?.from === from && current.to === to ? null : { from, to },
              );
              setSelectedMapIds([]);
              setSelectedMapId(null);
              setShowCount(12);
              setExportedCount(null);
            }}
          />

          <NexoProcedureAnalysisPanel
            rows={
              trendSelection
                ? rankedIncidents.filter((row) =>
                    Boolean(
                      row.factDate &&
                      row.factDate >= trendSelection.from &&
                      row.factDate <= trendSelection.to,
                    ),
                  )
                : rankedIncidents
            }
            comparisonRows={comparisonRows}
            from={
              trendSelection?.from ||
              (rankSelection?.kind === "date" ? rankSelection.key : filters.from)
            }
            to={
              trendSelection?.to ||
              (rankSelection?.kind === "date" ? rankSelection.key : filters.to)
            }
            selected={timeSelection}
            onSelect={(selection) => {
              setTimeSelection(selection);
              setSelectedMapIds([]);
              setSelectedMapId(null);
              setShowCount(12);
            }}
          />

          <section className="mt-5 overflow-hidden rounded-[24px] border border-[#dce8ef] bg-white shadow-[0_16px_32px_-30px_#213d51]">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-5 sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#258fa5]" />
                  <h2 className="text-sm font-black text-[#1b3d56]">Mapa geográfico dos fatos</h2>
                </div>
                <p className="mt-1 text-[11px] text-[#567184]">
                  Pontos marcados a partir de coordenadas registradas com fonte; acompanha os
                  filtros do painel.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="rounded-full bg-[#e9f7f8] px-3 py-1.5 text-[#17748b]">
                  {mappedRows.length} no mapa
                </span>
                <span className="rounded-full bg-[#f2f5f7] px-3 py-1.5 text-[#718a99]">
                  {unmappedCount} sem coordenadas
                </span>
              </div>
            </div>
            <div
              id="nexo-procedure-map"
              tabIndex={-1}
              className="relative scroll-mt-28 border-y border-[#e4edf1]"
            >
              <NexoProcedureGeoMap
                points={mapPoints}
                selectedId={selectedMapId}
                onSelect={setSelectedMapId}
                onSelectGroup={(ids) => {
                  setSelectedMapIds(ids);
                  setShowCount(12);
                  setExportedCount(null);
                }}
                onBoundsChange={setMapBounds}
                focusId={focusMapId}
                focusRequest={mapFocusRequest}
                requestedView={mapRestore}
              />
              {!mappedRows.length ? (
                <div className="pointer-events-none absolute left-1/2 top-1/2 w-[min(90%,360px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#d8e6ec] bg-white/95 p-5 text-center shadow-xl">
                  <MapPin className="mx-auto h-6 w-6 text-[#5aa8ba]" />
                  <p className="mt-2 text-xs font-black text-[#234b63]">
                    Nenhum fato georreferenciado neste recorte
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#567184]">
                    Abra “Completar” em um procedimento e marque no mapa o local confirmado do fato.
                    O bairro sozinho não define um ponto exato.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-[11px] text-[#6b8797] sm:px-6">
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-[#d35c4f]" /> CVLI
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-[#2395a8]" /> Outros procedimentos
              </span>
              <button
                type="button"
                aria-pressed={visibleAreaOnly}
                disabled={!mapPoints.length}
                onClick={() => {
                  setVisibleAreaOnly((value) => !value);
                  setShowCount(12);
                }}
                className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-40 ${visibleAreaOnly ? "border-[#85c2d0] bg-[#ecf8fa] text-[#21758e]" : "border-[#d8e5ec] text-[#718f9f] hover:bg-[#f1f7f9]"}`}
              >
                <Crosshair className="h-3.5 w-3.5" />
                Filtrar lista pela área visível
              </button>
            </div>
            {selectedMapRow ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5edf2] bg-[#f7fbfc] px-5 py-4 sm:px-6">
                <div>
                  <strong className="text-xs text-[#214962]">
                    {selectedMapIds.length > 1
                      ? `${selectedMapIds.length} fatos selecionados neste grupo`
                      : selectedMapRow.number}
                  </strong>
                  <p className="mt-1 text-[11px] text-[#6e8999]">
                    {selectedMapRow.neighborhood || "Bairro não informado"} ·{" "}
                    {displayDate(selectedMapRow.factDate)} ·{" "}
                    {selectedMapRow.cvli ? "CVLI" : "Outro procedimento"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMapIds([]);
                      setSelectedMapId(null);
                    }}
                    className="rounded-lg px-3 py-2 text-[11px] font-bold text-[#7392a3]"
                  >
                    Limpar seleção
                  </button>
                  {selectedMapIds.length <= 1 ? (
                    <button
                      type="button"
                      onClick={() => openIncident(selectedMapRow.incidentId)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#bddce4] bg-white px-3 py-2 text-[11px] font-bold text-[#277e94] hover:bg-[#eef8fa]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver fato e fontes
                    </button>
                  ) : null}
                  {selectedMapIds.length <= 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        openContext(
                          rows.find(
                            (row) =>
                              row.incidentId === selectedMapRow.incidentId &&
                              row.latitude === selectedMapRow.latitude &&
                              row.longitude === selectedMapRow.longitude,
                          ) || selectedMapRow,
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#bddce4] bg-white px-3 py-2 text-[11px] font-bold text-[#277e94] hover:bg-[#eef8fa]"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Conferir ponto
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <div id="nexo-procedure-rankings" className="mt-5 grid scroll-mt-28 gap-4 xl:grid-cols-3">
            <RankCard
              title="Bairros com mais CVLI"
              subtitle="Top 10 por local do fato"
              icon={MapPin}
              values={rankSummary.neighborhoods}
              kind="neighborhood"
              selected={rankSelection}
              onSelect={selectRank}
              emptyText="Nenhum CVLI com bairro informado neste recorte."
            />
            <RankCard
              title="Datas com mais CVLI"
              subtitle="Top 10 datas do fato"
              icon={CalendarDays}
              values={rankSummary.dates}
              kind="date"
              selected={rankSelection}
              onSelect={selectRank}
              emptyText="Nenhum CVLI com data do fato informada neste recorte."
            />
            <RankCard
              title="Horários mais recorrentes"
              subtitle="Top 10 faixas de uma hora"
              icon={Clock3}
              values={rankSummary.hours}
              kind="hour"
              selected={rankSelection}
              onSelect={selectRank}
              emptyText="Horário do fato ainda não informado. Complete os dados de um procedimento para ativar este ranking."
            />
          </div>

          <section
            id="nexo-procedure-list"
            className="mt-5 scroll-mt-28 overflow-hidden rounded-[24px] border border-[#dce8ef] bg-white shadow-[0_16px_32px_-30px_#213d51]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5edf2] px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-sm font-black text-[#1b3d56]">Procedimentos no recorte</h2>
                <p className="mt-1 text-[11px] text-[#567184]">
                  {workRows.length} de {drilledRows.length} procedimento(s) ·{" "}
                  {new Set(workRows.map((row) => row.incidentId)).size} fatos distintos
                </p>
                <p className="mt-1 text-[11px] text-[#567184]">
                  Data, hora e local consolidados. Clique no número para consultar as fontes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="procedure-sort">
                  Ordenar procedimentos
                </label>
                <select
                  id="procedure-sort"
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(event.target.value as ProcedureViewState["sortOrder"])
                  }
                  className="h-9 rounded-xl border border-[#d6e4ec] bg-white px-3 text-[11px] font-bold text-[#567b91]"
                >
                  <option value="recent">Fatos mais recentes</option>
                  <option value="oldest">Fatos mais antigos</option>
                  <option value="pending">Mais pendências</option>
                  <option value="number">Número do procedimento</option>
                </select>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={!workRows.length}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#173f58] px-3 text-[11px] font-bold text-white hover:bg-[#225875] disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" /> Exportar recorte
                </button>
              </div>
            </div>
            <div className="border-b border-[#e5edf2] bg-[#f8fbfc] px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-black uppercase tracking-wide text-[#567184]">
                  Preenchimento por fato
                </span>
                {(
                  [
                    { key: "all", label: "Todos", count: coverage.total },
                    { key: "coordinates", label: "Sem ponto", count: coverage.missingCoordinates },
                    { key: "time", label: "Sem horário", count: coverage.missingTime },
                    { key: "date", label: "Sem data", count: coverage.missingDate },
                    {
                      key: "neighborhood",
                      label: "Sem bairro",
                      count: coverage.missingNeighborhood,
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={missingField === item.key}
                    onClick={() => {
                      setMissingField(item.key);
                      setShowCount(12);
                      setExportedCount(null);
                    }}
                    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${missingField === item.key ? "border-[#80c0cf] bg-[#edf9fb] text-[#236e88]" : "border-[#e0e9ee] bg-white text-[#567184] hover:border-[#b9d9e3]"}`}
                  >
                    {item.label}
                    <span className="tabular-nums opacity-75">{item.count}</span>
                  </button>
                ))}
                <span className="ml-auto text-[11px] text-[#567184]">
                  {coverage.complete}/{coverage.total} com os quatro campos
                </span>
              </div>
              {selectedMapIds.length || visibleAreaOnly ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedMapIds.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMapIds([]);
                        setSelectedMapId(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-[#eaf5f8] px-2.5 py-1 text-[11px] font-bold text-[#347b91]"
                    >
                      <X className="h-3 w-3" />
                      Seleção do mapa · {selectedMapIds.length} fato(s)
                    </button>
                  ) : null}
                  {visibleAreaOnly ? (
                    <button
                      type="button"
                      onClick={() => setVisibleAreaOnly(false)}
                      className="inline-flex items-center gap-1 rounded-full bg-[#eaf5f8] px-2.5 py-1 text-[11px] font-bold text-[#347b91]"
                    >
                      <X className="h-3 w-3" />
                      Área visível do mapa
                    </button>
                  ) : null}
                </div>
              ) : null}
              {exportedCount !== null ? (
                <p role="status" className="mt-2 text-[11px] text-[#56899a]">
                  CSV gerado com {exportedCount} procedimento(s) do recorte atual.
                </p>
              ) : null}
            </div>
            {workRows.length ? (
              <div className="divide-y divide-[#eaf0f4]">
                {workRows.slice(0, showCount).map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-3 px-5 py-4 transition hover:bg-[#fbfdfe] sm:px-6 lg:grid-cols-[minmax(230px,1.7fr)_minmax(145px,1fr)_minmax(180px,1fr)_minmax(150px,.9fr)_auto] lg:items-center"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${row.cvli ? "bg-[#fff1ef] text-[#c65b4e]" : "bg-[#edf5f8] text-[#39849a]"}`}
                      >
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openIncident(row.incidentId)}
                            title="Consultar fato, fontes e procedimentos vinculados"
                            className="inline-flex min-w-0 items-center gap-1.5 truncate text-left text-xs font-black text-[#1c4059] underline-offset-4 hover:text-[#1d8399] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4d9fb5]"
                          >
                            {row.number}
                            <Eye className="h-3.5 w-3.5 shrink-0 text-[#567184]" />
                          </button>
                          <span className="rounded-full bg-[#edf3f6] px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#617e91]">
                            {row.kind === "bo" ? "B.O." : "Inquérito"}
                          </span>
                          {row.cvli ? (
                            <span className="rounded-full bg-[#fff0ed] px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#b95347]">
                              CVLI
                            </span>
                          ) : null}
                        </span>
                        <small
                          className="mt-1 block truncate text-[11px] text-[#567184]"
                          title={row.nature}
                        >
                          {row.nature}
                        </small>
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span
                        className="block truncate text-[11px] font-bold text-[#365a70]"
                        title={row.factions.join(", ")}
                      >
                        {row.factions.join(", ")}
                      </span>
                      <small className="mt-1 block text-[11px] text-[#567184]">
                        {row.linkedToNexo ? "Vínculo NEXO" : "Marcado no procedimento"}
                      </small>
                    </div>
                    <div className="min-w-0 text-[11px] text-[#627e8f]">
                      <span className="block truncate">
                        <MapPin className="mr-1 inline h-3.5 w-3.5" />
                        {row.neighborhood || "Bairro não informado"}
                      </span>
                      <span className="mt-1 block">
                        <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                        {displayDate(row.factDate)}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#627e8f]">
                      <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                      {row.factTime ? `${row.factTime} · hora do fato` : "Horário não informado"}
                    </div>
                    <div className="flex items-center gap-1.5 lg:justify-end">
                      {mappedRows.some((point) => point.incidentId === row.incidentId) ? (
                        <button
                          type="button"
                          title={`Localizar ${row.number} no mapa`}
                          aria-label={`Localizar ${row.number} no mapa`}
                          onClick={() => {
                            focusIncidentOnMap(row.incidentId);
                          }}
                          className="rounded-lg border border-[#d7e6ec] p-2 text-[#498397] hover:bg-[#eef8fa]"
                        >
                          <Crosshair className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openContext(rows.find((item) => item.id === row.id) || row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#d7e6ec] px-2.5 py-2 text-[11px] font-bold text-[#2a7b91] hover:bg-[#eef8fa]"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Completar
                      </button>
                      {!preview ? (
                        <a
                          href={
                            row.kind === "bo"
                              ? `/bo/${row.procedureId}`
                              : `/inqueritos/${row.procedureId}`
                          }
                          aria-label={`Abrir ${row.number}`}
                          title="Abrir procedimento"
                          className="rounded-lg border border-[#d7e6ec] p-2 text-[#6a90a2] hover:bg-[#eef8fa]"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <Search className="mx-auto h-6 w-6 text-[#567184]" />
                <p className="mt-2 text-sm font-bold text-[#607f91]">
                  Nenhum procedimento neste recorte
                </p>
                <p className="mt-1 text-xs text-[#567184]">
                  Ajuste os filtros de preenchimento, a seleção do mapa ou o período consultado.
                </p>
              </div>
            )}
            {workRows.length > showCount ? (
              <div className="border-t border-[#eaf0f4] p-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowCount((value) => value + 20)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#257e95] hover:text-[#15566c]"
                >
                  Mostrar mais {Math.min(20, workRows.length - showCount)}{" "}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </section>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-[#567184]">
            Contagens baseadas nos procedimentos acessíveis e classificados como faccionados. B.O. e
            inquérito do mesmo fato contam uma vez nos rankings de CVLI. Campos ausentes não são
            estimados.
          </p>
        </>
      ) : null}
      {editing ? (
        <NexoProcedureContextDialog
          row={editing}
          returnFocusElement={dialogReturnFocus.current}
          onClose={() => setEditing(null)}
          onSave={saveContext}
        />
      ) : null}
      {inspectingIncidentId ? (
        <NexoProcedureIncidentDialog
          rows={rows}
          incidentId={inspectingIncidentId}
          preview={preview}
          onClose={() => setInspectingIncidentId(null)}
          onEdit={(row) => setEditing(row)}
          onLocate={focusIncidentOnMap}
        />
      ) : null}
    </section>
  );
}
