import type { RepresentacaoRecord } from "@/lib/repositories/representacoesRepository";

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isTruthySigiloValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return ["sim", "s", "true", "1", "sigilosa", "sigiloso", "yes"].some((token) =>
    normalized.includes(token),
  );
}

export function isRepresentacaoSigilosa(
  representacao: Partial<RepresentacaoRecord> | null | undefined,
): boolean {
  if (!representacao) return false;
  return isTruthySigiloValue(
    representacao.pedido_sigiloso_normalizado ?? representacao.pedido_sigiloso,
  );
}

export function canAccessSigilosa(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  const source = profile as {
    can_access_sigiloso?: boolean | null;
    status_autorizacao?: string | null;
  };
  return (
    source.can_access_sigiloso === true && normalizeText(source.status_autorizacao) === "autorizado"
  );
}
