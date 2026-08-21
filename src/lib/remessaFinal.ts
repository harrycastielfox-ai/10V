import type { InqueritoRecord } from "@/lib/repositories/inqueritosRepository";

export const REMESSA_FINAL_STATUS_OPTIONS = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "remetido", label: "Remetido" },
] as const;

export type RemessaFinalStatus = (typeof REMESSA_FINAL_STATUS_OPTIONS)[number]["value"];

export function normalizeRemessaFinalStatus(value: unknown): RemessaFinalStatus {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "remetido"
    ? "remetido"
    : "em_andamento";
}

export function getInqueritoRemessaFinalStatus(record: InqueritoRecord): RemessaFinalStatus {
  const explicitStatus = String(record.remessa_final_status ?? "").trim();
  if (explicitStatus) return normalizeRemessaFinalStatus(explicitStatus);

  const legacyStatus = `${record.situacao ?? ""} ${record.relatorio_status ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  return legacyStatus.includes("remetido") || legacyStatus.includes("enviado")
    ? "remetido"
    : "em_andamento";
}

export function isRemessaFinalRemetida(record: InqueritoRecord) {
  return getInqueritoRemessaFinalStatus(record) === "remetido";
}

export function getRemessaFinalDate(record: InqueritoRecord) {
  if (!isRemessaFinalRemetida(record) || !record.data_remessa_final) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(record.data_remessa_final);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;

  return new Date(Date.UTC(year, monthIndex, day, 12));
}
