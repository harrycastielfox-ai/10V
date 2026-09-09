import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Clock3,
  FileSearch,
  Gavel,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { classifyAuthorship } from "@/lib/authorship";
import { PageHeader } from "@/components/PageHeader";
import { AlertasModuloPanel } from "@/components/AlertasModuloPanel";
import { isCvliElucidado, isCvliRecord } from "@/lib/cvliMetrics";
import { listInqueritos, type InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import {
  listRepresentacoes,
  type RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";
import { buildOperationalAlerts, moduleMeta, type ModuleKey } from "@/lib/alertasInteligentes";
import {
  hasDiligenciasPendentes,
  hasRelatorioEnviado,
  isInqueritoEmAndamento,
  isRelatadoNaoEnviado as isRelatadoNaoEnviadoMetric,
  isRepresentacaoCumprida,
  isRepresentacaoDeferida,
  isRepresentacaoIndeferida,
  isRepresentacaoPendente,
  isRepresentacaoSigilosaValue,
} from "@/lib/operationalMetrics";

export const Route = createFileRoute("/alertas")({
  component: Alertas,
  head: () => ({ meta: [{ title: "Central Operacional de Pendências - SIPI" }] }),
});

const icons: Record<ModuleKey, typeof AlertTriangle> = {
  criticos: AlertTriangle,
  prazos: Clock3,
  operacionais: Bell,
  judiciais: Gavel,
  "dados-incompletos": FileSearch,
  sigilosas: ShieldAlert,
};

const moduleTone: Record<
  ModuleKey,
  {
    icon: string;
    badge: string;
    cta: string;
    hover: string;
    surface: string;
    glow: string;
    rail: string;
    count: string;
  }
> = {
  criticos: {
    icon: "border-red-500/30 bg-red-500/10 text-red-300/90",
    badge: "border-red-500/30 bg-red-500/10 text-red-200",
    cta: "text-red-300 group-hover:text-red-200 group-focus-visible:text-red-200",
    surface: "from-red-500/[0.055] via-card/55 to-card",
    glow: "bg-red-500/12",
    rail: "bg-red-400/55 shadow-[0_0_10px_rgba(248,113,113,0.24)]",
    count: "text-red-100 drop-shadow-[0_0_8px_rgba(248,113,113,0.16)]",
    hover:
      "hover:border-red-500/45 hover:bg-red-500/[0.06] hover:shadow-[0_0_0_1px_rgba(239,68,68,0.2)] focus-visible:border-red-500/55 focus-visible:bg-red-500/[0.08] focus-visible:shadow-[0_0_0_1px_rgba(239,68,68,0.25)]",
  },
  prazos: {
    icon: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300/90",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    cta: "text-emerald-300 group-hover:text-emerald-200 group-focus-visible:text-emerald-200",
    surface: "from-emerald-500/[0.055] via-card/55 to-card",
    glow: "bg-emerald-500/12",
    rail: "bg-emerald-400/55 shadow-[0_0_10px_rgba(52,211,153,0.24)]",
    count: "text-emerald-100 drop-shadow-[0_0_8px_rgba(52,211,153,0.16)]",
    hover:
      "hover:border-emerald-500/45 hover:bg-emerald-500/[0.06] hover:shadow-[0_0_0_1px_rgba(16,185,129,0.2)] focus-visible:border-emerald-500/55 focus-visible:bg-emerald-500/[0.08] focus-visible:shadow-[0_0_0_1px_rgba(16,185,129,0.25)]",
  },
  operacionais: {
    icon: "border-orange-500/30 bg-orange-500/10 text-orange-300/90",
    badge: "border-orange-500/30 bg-orange-500/10 text-orange-200",
    cta: "text-orange-300 group-hover:text-orange-200 group-focus-visible:text-orange-200",
    surface: "from-orange-500/[0.055] via-card/55 to-card",
    glow: "bg-orange-500/12",
    rail: "bg-orange-400/55 shadow-[0_0_10px_rgba(251,146,60,0.24)]",
    count: "text-orange-100 drop-shadow-[0_0_8px_rgba(251,146,60,0.16)]",
    hover:
      "hover:border-orange-500/45 hover:bg-orange-500/[0.06] hover:shadow-[0_0_0_1px_rgba(249,115,22,0.2)] focus-visible:border-orange-500/55 focus-visible:bg-orange-500/[0.08] focus-visible:shadow-[0_0_0_1px_rgba(249,115,22,0.25)]",
  },
  judiciais: {
    icon: "border-blue-500/30 bg-blue-500/10 text-blue-300/90",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-200",
    cta: "text-blue-300 group-hover:text-blue-200 group-focus-visible:text-blue-200",
    surface: "from-blue-500/[0.055] via-card/55 to-card",
    glow: "bg-blue-500/12",
    rail: "bg-blue-400/55 shadow-[0_0_10px_rgba(96,165,250,0.24)]",
    count: "text-blue-100 drop-shadow-[0_0_8px_rgba(96,165,250,0.16)]",
    hover:
      "hover:border-blue-500/45 hover:bg-blue-500/[0.06] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2)] focus-visible:border-blue-500/55 focus-visible:bg-blue-500/[0.08] focus-visible:shadow-[0_0_0_1px_rgba(59,130,246,0.25)]",
  },
  "dados-incompletos": {
    icon: "border-amber-500/30 bg-amber-500/10 text-amber-300/90",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    cta: "text-amber-300 group-hover:text-amber-200 group-focus-visible:text-amber-200",
    surface: "from-amber-500/[0.055] via-card/55 to-card",
    glow: "bg-amber-500/12",
    rail: "bg-amber-400/55 shadow-[0_0_10px_rgba(251,191,36,0.24)]",
    count: "text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.16)]",
    hover:
      "hover:border-amber-500/45 hover:bg-amber-500/[0.06] hover:shadow-[0_0_0_1px_rgba(245,158,11,0.2)] focus-visible:border-amber-500/55 focus-visible:bg-amber-500/[0.08] focus-visible:shadow-[0_0_0_1px_rgba(245,158,11,0.25)]",
  },
  sigilosas: {
    icon: "border-violet-500/30 bg-violet-500/10 text-violet-300/90",
    badge: "border-violet-500/30 bg-violet-500/10 text-violet-200",
    cta: "text-violet-300 group-hover:text-violet-200 group-focus-visible:text-violet-200",
    surface: "from-violet-500/[0.055] via-card/55 to-card",
    glow: "bg-violet-500/12",
    rail: "bg-violet-400/55 shadow-[0_0_10px_rgba(167,139,250,0.24)]",
    count: "text-violet-100 drop-shadow-[0_0_8px_rgba(167,139,250,0.16)]",
    hover:
      "hover:border-violet-500/45 hover:bg-violet-500/[0.06] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.2)] focus-visible:border-violet-500/55 focus-visible:bg-violet-500/[0.08] focus-visible:shadow-[0_0_0_1px_rgba(139,92,246,0.25)]",
  },
};

type ProcedureRow = {
  entityType: "inquerito" | "representacao";
  referenceDate: Date | null;
  raw: InqueritoRecord | RepresentacaoRecord;
};

type TableTarget =
  | { to: "/inqueritos"; search?: Record<string, string | boolean> }
  | { to: "/representacoes"; search?: Record<string, string | boolean> };

type OperationalRow = {
  label: string;
  value: string | number;
  desc: string;
  target?: TableTarget;
  disabledReason?: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function hasText(value: unknown) {
  return normalizeText(value).length > 0;
}

function isYesLike(value: unknown) {
  return ["sim", "s", "true", "1", "yes", "y", "ok"].includes(normalizeText(value));
}

function parseDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(raw);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 12, 0, 0, 0);

  const iso = /^(\d{4})-(\d{2})-(\d{2})/u.exec(raw);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0);

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodPreset(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

function inDateRange(date: Date | null, start: string, end: string) {
  if (!start && !end) return true;
  if (!date) return false;

  const startDate = start ? parseDate(start) : null;
  const endDate = end ? parseDate(end) : null;

  if (startDate && date < startDate) return false;
  if (endDate) {
    const final = new Date(endDate);
    final.setHours(23, 59, 59, 999);
    if (date > final) return false;
  }

  return true;
}

function getProcedureType(value: unknown) {
  const text = normalizeText(value);
  if (!text) return "";
  if (text === "ip" || text.includes("inquerito policial")) return "IP";
  if (text === "apf" || text.includes("flagrante")) return "APF";
  if (text === "tco" || text.includes("termo circunstanciado")) return "TCO";
  if (text === "boc" || text.includes("boletim de ocorrencia")) return "BOC";
  if (text === "aiai" || text.includes("ato infracional")) return "AIAI";
  return String(value ?? "").trim();
}

function getInqueritoProcedureType(record: InqueritoRecord) {
  return getProcedureType(record.tipo_procedimento_normalizado ?? record.tipo);
}

function isInqueritoSemRelatorio(record: InqueritoRecord) {
  return !hasRelatorioEnviado(record);
}

function isCvli(record: InqueritoRecord) {
  return isCvliRecord(record);
}

function isPatrimonial(record: InqueritoRecord) {
  return ["patrimonio", "furto", "roubo", "receptacao", "estelionato", "dano"].some((term) =>
    normalizeText(`${record.gravidade} ${record.tipificacao} ${record.tipo}`).includes(term),
  );
}

function isViolenciaDomestica(record: InqueritoRecord) {
  return ["violencia domestica", "maria da penha"].some((term) =>
    normalizeText(`${record.gravidade} ${record.tipificacao} ${record.tipo}`).includes(term),
  );
}

function isSexual(record: InqueritoRecord) {
  return ["sexual", "estupro", "importunacao"].some((term) =>
    normalizeText(`${record.gravidade} ${record.tipificacao} ${record.tipo}`).includes(term),
  );
}

function isTransito(record: InqueritoRecord) {
  return ["transito", "ctb", "direcao perigosa", "embriaguez"].some((term) =>
    normalizeText(`${record.gravidade} ${record.tipificacao} ${record.tipo}`).includes(term),
  );
}

function isConcluido(record: InqueritoRecord) {
  return hasRelatorioEnviado(record);
}

function isEmAndamento(record: InqueritoRecord) {
  return isInqueritoEmAndamento(record);
}

function isRelatadoNaoEnviado(record: InqueritoRecord) {
  return isRelatadoNaoEnviadoMetric(record);
}

function getInqueritoDate(record: InqueritoRecord) {
  return (
    parseDate(record.data_instauracao) ??
    parseDate(record.data_fato) ??
    parseDate(record.created_at)
  );
}

function getRepresentacaoDate(record: RepresentacaoRecord) {
  return (
    parseDate(record.data_representacao) ??
    parseDate(record.created_at) ??
    parseDate(record.data_envio_judiciario)
  );
}

function toProcedureRows(
  inqueritos: InqueritoRecord[],
  representacoes: RepresentacaoRecord[],
): ProcedureRow[] {
  const inqueritoRows: ProcedureRow[] = inqueritos.map((record) => ({
    entityType: "inquerito",
    referenceDate: getInqueritoDate(record),
    raw: record,
  }));

  const representacaoRows: ProcedureRow[] = representacoes.map((record) => ({
    entityType: "representacao",
    referenceDate: getRepresentacaoDate(record),
    raw: record,
  }));

  return [...inqueritoRows, ...representacaoRows].sort(
    (a, b) => (b.referenceDate?.getTime() ?? 0) - (a.referenceDate?.getTime() ?? 0),
  );
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function Alertas({ mode = "alertas" }: { mode?: "alertas" | "estatisticas" }) {
  const location = useLocation();
  const isAlertasIndex = location.pathname === "/alertas";
  const navigate = useNavigate();
  const showAlertPanels = mode === "alertas";
  const showStats = mode === "estatisticas";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inqueritos, setInqueritos] = useState<InqueritoRecord[]>([]);
  const [representacoes, setRepresentacoes] = useState<RepresentacaoRecord[]>([]);
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [selectedModule, setSelectedModule] = useState<ModuleKey | null>(null);

  useEffect(() => {
    if (showAlertPanels && !isAlertasIndex) return;

    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        setError("");
        const [inq, rep] = await Promise.all([listInqueritos(), listRepresentacoes()]);
        if (!cancelled) {
          setInqueritos(inq);
          setRepresentacoes(rep);
        }
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar a central operacional de pendências.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAlertasIndex, showAlertPanels]);

  const operationalAlerts = useMemo(
    () => buildOperationalAlerts(inqueritos, representacoes),
    [inqueritos, representacoes],
  );
  const { smartAlerts, moduleAlerts } = operationalAlerts;
  const allRows = useMemo(
    () => toProcedureRows(inqueritos, representacoes),
    [inqueritos, representacoes],
  );
  const filteredRows = useMemo(
    () => allRows.filter((row) => inDateRange(row.referenceDate, dataInicial, dataFinal)),
    [allRows, dataFinal, dataInicial],
  );

  const filteredInqueritos = useMemo(
    () =>
      filteredRows
        .filter((row) => row.entityType === "inquerito")
        .map((row) => row.raw as InqueritoRecord),
    [filteredRows],
  );
  const filteredRepresentacoes = useMemo(
    () =>
      filteredRows
        .filter((row) => row.entityType === "representacao")
        .map((row) => row.raw as RepresentacaoRecord),
    [filteredRows],
  );

  const panorama = useMemo(() => {
    const periodSearch = {
      ...(dataInicial ? { dataInicial } : {}),
      ...(dataFinal ? { dataFinal } : {}),
      ...(dataInicial || dataFinal ? { dataCampo: "entrada" } : {}),
    };
    const ip = filteredInqueritos.filter((item) => getInqueritoProcedureType(item) === "IP");
    const apf = filteredInqueritos.filter((item) => getInqueritoProcedureType(item) === "APF");
    const tco = filteredInqueritos.filter((item) => getInqueritoProcedureType(item) === "TCO");
    const boc = filteredInqueritos.filter((item) => getInqueritoProcedureType(item) === "BOC");
    const aiai = filteredInqueritos.filter((item) => getInqueritoProcedureType(item) === "AIAI");
    const concluidos = filteredInqueritos.filter(isConcluido).length;
    const taxaConclusao =
      filteredInqueritos.length === 0 ? 0 : (concluidos / filteredInqueritos.length) * 100;

    return [
      {
        label: "Total de Procedimentos",
        value: filteredInqueritos.length,
        desc: "Inquéritos cadastrados ativos",
        target: { to: "/inqueritos", search: periodSearch },
      },
      {
        label: "Inquéritos Policiais (IP)",
        value: ip.length,
        desc: "Procedimentos do tipo IP",
        target: { to: "/inqueritos", search: { ...periodSearch, tipo: "IP" } },
      },
      {
        label: "IP sem Relatar",
        value: ip.filter(isInqueritoSemRelatorio).length,
        desc: "IP pendentes de relatório",
        target: {
          to: "/inqueritos",
          search: { ...periodSearch, tipo: "IP", relatorio: "sem_relatar" },
        },
      },
      {
        label: "IP CVLI sem Relatar",
        value: ip.filter((item) => isCvli(item) && isInqueritoSemRelatorio(item)).length,
        desc: "CVLI pendentes de relatório",
        target: {
          to: "/inqueritos",
          search: { ...periodSearch, tipo: "IP", relatorio: "sem_relatar", categoria: "cvli" },
        },
      },
      {
        label: "IP Patrimoniais sem Relatar",
        value: ip.filter((item) => isPatrimonial(item) && isInqueritoSemRelatorio(item)).length,
        desc: "Patrimoniais pendentes",
        target: {
          to: "/inqueritos",
          search: {
            ...periodSearch,
            tipo: "IP",
            relatorio: "sem_relatar",
            categoria: "patrimonial",
          },
        },
      },
      {
        label: "IP Violência Doméstica sem Relatar",
        value: ip.filter((item) => isViolenciaDomestica(item) && isInqueritoSemRelatorio(item))
          .length,
        desc: "Maria da Penha pendentes",
        target: {
          to: "/inqueritos",
          search: {
            ...periodSearch,
            tipo: "IP",
            relatorio: "sem_relatar",
            categoria: "violencia_domestica",
          },
        },
      },
      {
        label: "IP Sexuais sem Relatar",
        value: ip.filter((item) => isSexual(item) && isInqueritoSemRelatorio(item)).length,
        desc: "Crimes sexuais pendentes",
        target: {
          to: "/inqueritos",
          search: { ...periodSearch, tipo: "IP", relatorio: "sem_relatar", categoria: "sexual" },
        },
      },
      {
        label: "Auto de Prisão em Flagrante (APF)",
        value: apf.length,
        desc: "Flagrantes cadastrados",
        target: { to: "/inqueritos", search: { ...periodSearch, tipo: "APF" } },
      },
      {
        label: "APF sem Relatar",
        value: apf.filter(isInqueritoSemRelatorio).length,
        desc: "Flagrantes não relatados",
        target: {
          to: "/inqueritos",
          search: { ...periodSearch, tipo: "APF", relatorio: "sem_relatar" },
        },
      },
      {
        label: "Termo Circunstanciado (TCO)",
        value: tco.length,
        desc: "Termos circunstanciados",
        target: { to: "/inqueritos", search: { ...periodSearch, tipo: "TCO" } },
      },
      {
        label: "Boletim de Ocorrência Circunstanciado (BOC)",
        value: boc.length,
        desc: "Comunicações ao MP",
        target: { to: "/inqueritos", search: { ...periodSearch, tipo: "BOC" } },
      },
      {
        label: "Ato de Investigação de Ato Infracional (AIAI)",
        value: aiai.length,
        desc: "Atos infracionais",
        target: { to: "/inqueritos", search: { ...periodSearch, tipo: "AIAI" } },
      },
      {
        label: "Relatórios Enviados",
        value: concluidos,
        desc: "Procedimentos finalizados",
        target: { to: "/inqueritos", search: { ...periodSearch, relatorio: "enviado" } },
      },
      {
        label: "Taxa de Conclusão",
        value: formatPercent(taxaConclusao),
        desc: "Percentual concluído",
        disabledReason: "Indicador percentual; filtro de registros ainda não disponível.",
      },
      {
        label: "Procedimentos Em Andamento",
        value: filteredInqueritos.filter(isEmAndamento).length,
        desc: "Procedimentos ainda ativos",
        target: { to: "/inqueritos", search: { ...periodSearch, status: "em_andamento" } },
      },
      {
        label: "Relatados e não enviados",
        value: filteredInqueritos.filter(isRelatadoNaoEnviado).length,
        desc: "Revisar envio formal",
        target: {
          to: "/inqueritos",
          search: { ...periodSearch, relatorio: "relatado_nao_enviado" },
        },
      },
    ] satisfies OperationalRow[];
  }, [dataFinal, dataInicial, filteredInqueritos]);

  const periodStats = useMemo(() => {
    const relatoriosEnviados = inqueritos.filter(
      (item) =>
        (hasText(item.data_relatorio) || hasText(item.data_envio_relatorio)) &&
        inDateRange(
          parseDate(item.data_relatorio) ?? parseDate(item.data_envio_relatorio),
          dataInicial,
          dataFinal,
        ),
    ).length;
    const apf = filteredInqueritos.filter(
      (item) => getInqueritoProcedureType(item) === "APF",
    ).length;
    const mpu = filteredRepresentacoes.filter((item) =>
      normalizeText(item.tipo).includes("protetiva"),
    ).length;
    const tco = filteredInqueritos.filter(
      (item) => getInqueritoProcedureType(item) === "TCO",
    ).length;
    const cvli = filteredInqueritos.filter(isCvli);
    const cvliElucidados = cvli.filter(isCvliElucidado).length;
    const autoriaDeterminada = filteredInqueritos.filter(
      (item) => classifyAuthorship(item.autoria_determinada) === "determinada",
    ).length;
    const autoriaDesconhecida = filteredInqueritos.filter(
      (item) => classifyAuthorship(item.autoria_determinada) === "desconhecida",
    ).length;
    const semAutoria = filteredInqueritos.filter(
      (item) => classifyAuthorship(item.autoria_determinada) === "sem_autoria",
    ).length;
    const periodSearch = {
      ...(dataInicial ? { dataInicial } : {}),
      ...(dataFinal ? { dataFinal } : {}),
    };

    return [
      {
        label: "Inquéritos instaurados no período",
        value: filteredInqueritos.length,
        desc: "Data de instauração ou criação dentro do filtro",
        target: { to: "/inqueritos", search: periodSearch },
      },
      {
        label: "Relatórios enviados no período",
        value: relatoriosEnviados,
        desc: "Data de envio entre as datas filtradas",
        target: {
          to: "/inqueritos",
          search: { ...periodSearch, relatorio: "enviado", dataCampo: "relatorio" },
        },
      },
      {
        label: "APF lavrados no período",
        value: apf,
        desc: "Flagrantes cadastrados no período",
        target: { to: "/inqueritos", search: { ...periodSearch, tipo: "APF" } },
      },
      {
        label: "MPU representadas no período",
        value: mpu,
        desc: "Representações de medida protetiva",
        target: {
          to: "/representacoes",
          search: { ...periodSearch, operationalFilter: "todas", tipo: "medida_protetiva" },
        },
      },
      {
        label: "TCO remetidos no período",
        value: tco,
        desc: "TCO cadastrados no período",
        target: { to: "/inqueritos", search: { ...periodSearch, tipo: "TCO" } },
      },
      {
        label: "CVLI no período",
        value: cvli.length,
        desc: "CVLI/Homicídios filtrados",
        target: { to: "/inqueritos", search: { ...periodSearch, categoria: "cvli" } },
      },
      {
        label: "CVLI elucidados",
        value: cvliElucidados,
        desc: "CVLI com elucidação registrada",
        target: {
          to: "/inqueritos",
          search: { ...periodSearch, categoria: "cvli", elucidado: "sim" },
        },
      },
      {
        label: "Autoria determinada",
        value: autoriaDeterminada,
        desc: "Procedimentos com autoria identificada",
        target: { to: "/inqueritos", search: { ...periodSearch, autoria: "determinada" } },
      },
      {
        label: "Autoria desconhecida",
        value: autoriaDesconhecida,
        desc: "Inclui registros antigos como indeterminados",
        target: { to: "/inqueritos", search: { ...periodSearch, autoria: "desconhecida" } },
      },
      {
        label: "Sem autoria",
        value: semAutoria,
        desc: "Procedimentos registrados sem autoria",
        target: { to: "/inqueritos", search: { ...periodSearch, autoria: "sem_autoria" } },
      },
      {
        label: "Violência doméstica no período",
        value: filteredInqueritos.filter(isViolenciaDomestica).length,
        desc: "Casos Maria da Penha",
        target: {
          to: "/inqueritos",
          search: { ...periodSearch, categoria: "violencia_domestica" },
        },
      },
      {
        label: "Crimes sexuais no período",
        value: filteredInqueritos.filter(isSexual).length,
        desc: "Tipificação sexual",
        target: { to: "/inqueritos", search: { ...periodSearch, categoria: "sexual" } },
      },
      {
        label: "Crimes de trânsito no período",
        value: filteredInqueritos.filter(isTransito).length,
        desc: "Casos de trânsito",
        target: { to: "/inqueritos", search: { ...periodSearch, categoria: "transito" } },
      },
      {
        label: "Crimes contra o patrimônio",
        value: filteredInqueritos.filter(isPatrimonial).length,
        desc: "Patrimoniais no período",
        target: { to: "/inqueritos", search: { ...periodSearch, categoria: "patrimonial" } },
      },
      {
        label: "Prisões vinculadas no período",
        value: filteredInqueritos.filter(
          (item) => item.reu_preso_normalizado === true || isYesLike(item.reu_preso),
        ).length,
        desc: "Registros com réu preso",
        target: { to: "/inqueritos", search: { ...periodSearch, reuPreso: "true" } },
      },
    ] satisfies OperationalRow[];
  }, [dataFinal, dataInicial, filteredInqueritos, filteredRepresentacoes, inqueritos]);

  const managementViews = useMemo(() => {
    const inqueritosAtivos = filteredInqueritos.filter(isInqueritoEmAndamento);
    const periodSearch = {
      ...(dataInicial ? { dataInicial } : {}),
      ...(dataFinal ? { dataFinal } : {}),
    };

    const operacional = [
      {
        label: "Em andamento",
        value: inqueritosAtivos.length,
        desc: "Procedimentos ativos no período",
        target: { to: "/inqueritos", search: { ...periodSearch, status: "em_andamento" } },
      },
      {
        label: "Concluídos",
        value: filteredInqueritos.filter(hasRelatorioEnviado).length,
        desc: "Procedimentos com relatório enviado",
        target: { to: "/inqueritos", search: { ...periodSearch, relatorio: "enviado" } },
      },
      {
        label: "Alta prioridade",
        value: inqueritosAtivos.filter(
          (item) => normalizeText(item.prioridade_operacional ?? item.prioridade) === "alta",
        ).length,
        desc: "Procedimentos ativos que requerem atenção",
        target: { to: "/inqueritos", search: { ...periodSearch, prioridade: "alta" } },
      },
      {
        label: "Diligências pendentes",
        value: inqueritosAtivos.filter(hasDiligenciasPendentes).length,
        desc: "Procedimentos com diligências ainda pendentes",
        target: {
          to: "/inqueritos",
          search: { ...periodSearch, diligenciasPendentes: "true" },
        },
      },
      {
        label: "Réu preso",
        value: filteredInqueritos.filter(
          (item) => item.reu_preso_normalizado === true || isYesLike(item.reu_preso),
        ).length,
        desc: "Procedimentos vinculados a réu preso",
        target: { to: "/inqueritos", search: { ...periodSearch, reuPreso: "true" } },
      },
      {
        label: "Medida protetiva",
        value: filteredInqueritos.filter(
          (item) => item.medida_protetiva_normalizada === true || isYesLike(item.medida_protetiva),
        ).length,
        desc: "Procedimentos com medida protetiva",
        target: { to: "/inqueritos", search: { ...periodSearch, medidaProtetiva: "true" } },
      },
    ] satisfies OperationalRow[];

    const judicial = [
      {
        label: "Total de representações",
        value: filteredRepresentacoes.length,
        desc: "Representações acessíveis no período",
        target: {
          to: "/representacoes",
          search: { ...periodSearch, operationalFilter: "todas" },
        },
      },
      {
        label: "Pendentes",
        value: filteredRepresentacoes.filter(isRepresentacaoPendente).length,
        desc: "Representações aguardando decisão ou cumprimento",
        target: {
          to: "/representacoes",
          search: { ...periodSearch, operationalFilter: "pendentes" },
        },
      },
      {
        label: "Deferidas",
        value: filteredRepresentacoes.filter(isRepresentacaoDeferida).length,
        desc: "Representações deferidas",
        target: {
          to: "/representacoes",
          search: { ...periodSearch, operationalFilter: "deferidas" },
        },
      },
      {
        label: "Indeferidas",
        value: filteredRepresentacoes.filter(isRepresentacaoIndeferida).length,
        desc: "Representações indeferidas",
        target: {
          to: "/representacoes",
          search: { ...periodSearch, operationalFilter: "indeferidas" },
        },
      },
      {
        label: "Cumpridas",
        value: filteredRepresentacoes.filter(isRepresentacaoCumprida).length,
        desc: "Representações com cumprimento registrado",
        target: {
          to: "/representacoes",
          search: { ...periodSearch, operationalFilter: "cumpridas" },
        },
      },
      {
        label: "Sigilosas",
        value: filteredRepresentacoes.filter((item) =>
          isRepresentacaoSigilosaValue(item.pedido_sigiloso_normalizado ?? item.pedido_sigiloso),
        ).length,
        desc: "Representações sigilosas acessíveis ao perfil atual",
        target: {
          to: "/representacoes",
          search: { ...periodSearch, operationalFilter: "sigilosas" },
        },
      },
    ] satisfies OperationalRow[];

    return { operacional, judicial };
  }, [dataFinal, dataInicial, filteredInqueritos, filteredRepresentacoes]);

  const hasActiveFilters = Boolean(dataInicial) || Boolean(dataFinal);

  function applyPreset(days: number) {
    const next = getPeriodPreset(days);
    setDataInicial(next.start);
    setDataFinal(next.end);
  }

  function clearFilters() {
    setDataInicial("");
    setDataFinal("");
  }

  function openTableTarget(target?: TableTarget) {
    if (!target) return;
    if (target.to === "/representacoes") {
      navigate({ to: "/representacoes", search: target.search ?? {} });
      return;
    }
    navigate({ to: "/inqueritos", search: target.search ?? {} });
  }

  if (showAlertPanels && !isAlertasIndex) return <Outlet />;

  return (
    <AppLayout>
      <div className="space-y-5">
        <PageHeader
          title={showStats ? "Estatísticas Operacionais" : "Central Operacional de Pendências"}
          subtitle={
            showStats
              ? "Panorama geral e estatísticas por período extraídas dos procedimentos ativos."
              : "Pendências e alertas operacionais extraídos dos procedimentos ativos."
          }
          showActions={false}
        />

        {showAlertPanels ? (
          <section className="rounded-2xl border border-border/70 bg-[#020607] p-4 shadow-[0_18px_52px_rgba(0,0,0,0.18)]">
            <div className="mb-4 flex flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-primary">
                  CENTRAL ODP
                </h2>
              </div>
              <span className="w-fit rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
                {smartAlerts.length} pendência(s) ativas
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(Object.keys(moduleMeta) as ModuleKey[]).map((key) => {
                const meta = moduleMeta[key];
                const Icon = icons[key];
                const count = moduleAlerts[key].length;
                const tone = moduleTone[key];
                const isSelected = selectedModule === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedModule(isSelected ? null : key)}
                    aria-pressed={isSelected}
                    data-alert-tone={key}
                    className={`alert-module-card group relative min-h-[164px] overflow-hidden rounded-2xl border bg-gradient-to-br ${tone.surface} p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_30px_rgba(0,0,0,0.16)] transition-all duration-200 cursor-pointer ${isSelected ? "border-primary/60 ring-2 ring-primary/30" : "border-border/70"} ${tone.hover}`}
                  >
                    <span
                      className={`alert-module-rail absolute left-0 top-5 h-16 w-1 rounded-r-full ${tone.rail}`}
                    />
                    <span
                      className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl ${tone.glow} opacity-45 transition-opacity duration-200 group-hover:opacity-70`}
                    />
                    <span className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    <div className="relative mb-4 flex items-center justify-between">
                      <span
                        className={`alert-module-icon rounded-xl border p-2.5 shadow-[0_0_24px_rgba(0,0,0,0.2)] ${tone.icon}`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span
                        className={`alert-module-badge rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${tone.badge}`}
                      >
                        {meta.badge}
                      </span>
                    </div>
                    <h3 className="relative text-base font-black tracking-tight text-foreground">
                      {meta.title}
                    </h3>
                    <p className="relative mt-1 min-h-[38px] text-xs leading-5 text-muted-foreground">
                      {meta.desc}
                    </p>
                    <div className="relative mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                          Alertas
                        </p>
                        <p
                          className={`alert-module-count mt-0.5 text-3xl font-black leading-none tabular-nums ${tone.count}`}
                        >
                          {count}
                        </p>
                      </div>
                      <span
                        className={`alert-module-cta inline-flex items-center gap-1.5 rounded-full border border-current/25 bg-background/35 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] transition-colors ${tone.cta}`}
                      >
                        {isSelected ? "Fechar" : "Abrir"}{" "}
                        <ArrowRight
                          className={`h-3.5 w-3.5 transition-transform ${isSelected ? "rotate-90" : "group-hover:translate-x-0.5"}`}
                        />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedModule ? (
              <div className="mt-4 border-t border-border/60 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Detalhes — {moduleMeta[selectedModule].title}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedModule(null)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <X className="h-3.5 w-3.5" />
                    Fechar
                  </button>
                </div>
                <AlertasModuloPanel modulo={selectedModule} />
              </div>
            ) : null}
          </section>
        ) : null}

        {showStats ? (
          <section className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-[0_16px_42px_rgba(0,0,0,0.14)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-foreground">
                    Filtro por período
                  </h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Informe uma data única ou um intervalo para atualizar os números abaixo.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset(7)}
                  className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
                >
                  Últimos 7 dias
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(30)}
                  className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
                >
                  Últimos 30 dias
                </button>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
                  >
                    Limpar período
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                type="date"
                value={dataInicial}
                onChange={(event) => setDataInicial(event.target.value)}
                className="date-picker-neon h-11 rounded-xl border border-border/90 bg-background/70 px-3 text-sm outline-none transition focus:border-primary/50"
                aria-label="Data inicial"
              />
              <input
                type="date"
                value={dataFinal}
                onChange={(event) => setDataFinal(event.target.value)}
                className="date-picker-neon h-11 rounded-xl border border-border/90 bg-background/70 px-3 text-sm outline-none transition focus:border-primary/50"
                aria-label="Data final"
              />
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Carregando central operacional...
          </div>
        ) : null}
        {!loading && error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {showStats && !loading && !error ? (
          <>
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <OperationalTable
                title="Panorama System Geral"
                accent="info"
                rows={panorama}
                onOpen={openTableTarget}
              />
              <OperationalTable
                title="Estatísticas do Período"
                accent="warning"
                rows={periodStats}
                onOpen={openTableTarget}
              />
            </div>

            <section className="space-y-4 pt-2">
              <div className="border-b border-border/70 pb-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-primary">
                  Visões gerenciais
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Resumos operacional e judicial conforme o período selecionado.
                </p>
              </div>
              <OperationalTable
                title="Visão Operacional"
                accent="success"
                rows={managementViews.operacional}
                onOpen={openTableTarget}
              />
              <OperationalTable
                title="Visão Judicial"
                accent="info"
                rows={managementViews.judicial}
                onOpen={openTableTarget}
              />
            </section>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}

function OperationalTable({
  title,
  rows,
  accent,
  onOpen,
}: {
  title: string;
  rows: OperationalRow[];
  accent: "info" | "warning" | "success" | "destructive";
  onOpen: (target?: TableTarget) => void;
}) {
  const accentClass = {
    info: "text-sky-300",
    warning: "text-amber-300",
    success: "text-emerald-300",
    destructive: "text-red-300",
  }[accent];

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/65 shadow-[0_16px_42px_rgba(0,0,0,0.14)]">
      <div className="border-b border-border/70 px-4 py-3">
        <h2 className={`text-xs font-black uppercase tracking-[0.16em] ${accentClass}`}>{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="border-b border-border/70 bg-background/35 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-black">Indicador</th>
              <th className="w-28 px-4 py-2.5 text-right font-black">Valor</th>
              <th className="px-4 py-2.5 text-left font-black">Descrição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => {
              const canOpen = Boolean(row.target);
              return (
                <tr
                  key={row.label}
                  role={canOpen ? "button" : undefined}
                  tabIndex={canOpen ? 0 : undefined}
                  title={canOpen ? `Abrir filtro: ${row.label}` : row.disabledReason}
                  className={`transition ${canOpen ? "cursor-pointer hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none" : "hover:bg-primary/5"}`}
                  onClick={() => onOpen(row.target)}
                  onKeyDown={(event) => {
                    if (!canOpen) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpen(row.target);
                    }
                  }}
                >
                  <td className="px-4 py-2.5 font-semibold text-foreground">{row.label}</td>
                  <td className="px-4 py-2.5 text-right text-lg font-black tabular-nums text-primary">
                    {row.value}
                  </td>
                  <td className="px-4 py-2.5 text-xs italic text-muted-foreground">{row.desc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
