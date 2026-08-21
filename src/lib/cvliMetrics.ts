import { normalizeCaseCategory } from "@/lib/inqueritosPriority";
import { isYesLike } from "@/lib/operationalMetrics";
import type { InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import { getRemessaFinalDate, isRemessaFinalRemetida } from "@/lib/remessaFinal";

export const CVLI_MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export type CvliMetric = {
  registros: number;
  elucidados: number;
};

export type CvliMonthlyRow = {
  monthIndex: number;
  month: string;
  byYear: Record<number, CvliMetric>;
};

export type CvliMonthlyComparison = {
  years: number[];
  rows: CvliMonthlyRow[];
  totals: Record<number, CvliMetric>;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function parseValidDate(value: unknown) {
  if (!value) return null;
  const raw = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/u.exec(raw);
  const date = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12))
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pickRecordText(record: InqueritoRecord, ...keys: string[]) {
  const source = record as unknown as Record<string, unknown>;
  return keys
    .map((key) => source[key])
    .filter(Boolean)
    .join(" ");
}

const CVLI_TERMS = ["CVLI", "HOMICIDIO", "LATROCINIO", "FEMINICIDIO"] as const;

/**
 * CVLI é crime violento letal intencional: doloso e consumado. Tentativa e
 * culposo carregam a mesma palavra na tipificação e não entram na conta.
 */
const NAO_CVLI_TERMS = [
  "TENTATIVA",
  "TENTADO",
  "TENTADA",
  "CULPOSO",
  "CULPOSA",
  "ART. 14",
  "ART 14",
  "14, II",
  "ART. 302",
  "ART 302",
] as const;

export function isCvliRecord(record: InqueritoRecord) {
  if (normalizeText(record.categoria_criminal) === "CVLI") return true;

  const formalCategory = normalizeCaseCategory(
    pickRecordText(record, "categoria_criminal", "categoria_caso", "categoriaCaso", "gravidade"),
    "",
  );
  if (normalizeText(formalCategory) === "CVLI") return true;

  // Sem categoria oficial, só a tipificação classifica o crime. Motivação e
  // observações são texto livre: citar "homicídio" ali não torna o
  // procedimento um CVLI, e era o que inflava o comparativo.
  const tipificacao = normalizeText(
    pickRecordText(record, "tipificacao", "tipo_penal", "classificacao"),
  );
  if (!tipificacao) return false;
  if (NAO_CVLI_TERMS.some((term) => tipificacao.includes(term))) return false;

  return CVLI_TERMS.some((term) => tipificacao.includes(term));
}

export function getCvliReferenceDate(record: InqueritoRecord) {
  return (
    parseValidDate(record.data_fato) ??
    parseValidDate(record.data_instauracao) ??
    parseValidDate(record.created_at)
  );
}

function isDeterminedAuthorship(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (normalized.includes("INDETERMIN")) return false;
  return normalized.includes("DETERMIN") || normalized.includes("ELUCID");
}

export function isCvliElucidado(record: InqueritoRecord) {
  if (isCvliRecord(record) && record.remessa_final_status) return isRemessaFinalRemetida(record);
  if (typeof record.cvli_elucidado === "boolean") return record.cvli_elucidado;

  const source = record as unknown as Record<string, unknown>;
  return (
    isYesLike(record.elucidado) ||
    isDeterminedAuthorship(record.elucidado) ||
    isYesLike(source.autoria_determinada) ||
    isDeterminedAuthorship(source.autoria_determinada)
  );
}

function createEmptyMetric(): CvliMetric {
  return { registros: 0, elucidados: 0 };
}

export function buildCvliMonthlyComparison(inqueritos: InqueritoRecord[]): CvliMonthlyComparison {
  const cvliRecords = inqueritos.filter(isCvliRecord);
  const registrosWithDate = cvliRecords
    .map((record) => ({ record, referenceDate: getCvliReferenceDate(record) }))
    .filter(
      (
        item,
      ): item is {
        record: InqueritoRecord;
        referenceDate: Date;
      } => item.referenceDate !== null,
    );
  const elucidadosWithDate = cvliRecords
    .map((record) => ({ record, referenceDate: getRemessaFinalDate(record) }))
    .filter(
      (
        item,
      ): item is {
        record: InqueritoRecord;
        referenceDate: Date;
      } => item.referenceDate !== null,
    );

  const years = Array.from(
    new Set(
      [...registrosWithDate, ...elucidadosWithDate].map(({ referenceDate }) =>
        referenceDate.getUTCFullYear(),
      ),
    ),
  ).sort((a, b) => a - b);

  const rows = CVLI_MONTHS.map((month, monthIndex) => ({
    month,
    monthIndex,
    byYear: Object.fromEntries(years.map((year) => [year, createEmptyMetric()])) as Record<
      number,
      CvliMetric
    >,
  }));
  const totals = Object.fromEntries(years.map((year) => [year, createEmptyMetric()])) as Record<
    number,
    CvliMetric
  >;

  registrosWithDate.forEach(({ referenceDate }) => {
    const year = referenceDate.getUTCFullYear();
    const monthIndex = referenceDate.getUTCMonth();
    const rowMetric = rows[monthIndex].byYear[year];
    const totalMetric = totals[year];

    rowMetric.registros += 1;
    totalMetric.registros += 1;
  });

  elucidadosWithDate.forEach(({ referenceDate }) => {
    const year = referenceDate.getUTCFullYear();
    const monthIndex = referenceDate.getUTCMonth();
    rows[monthIndex].byYear[year].elucidados += 1;
    totals[year].elucidados += 1;
  });

  return { years, rows, totals };
}
