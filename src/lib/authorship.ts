import { normalizeText } from "@/lib/inqueritosPriority";

export type AuthorshipCategory = "determinada" | "desconhecida" | "sem_autoria" | "nao_informada";

export function classifyAuthorship(value: unknown): AuthorshipCategory {
  const normalized = normalizeText(String(value ?? ""))
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "nao_informada";
  if (normalized.includes("sem autoria") || normalized === "sem autor") return "sem_autoria";
  if (
    normalized.includes("desconhecid") ||
    normalized.includes("indeterminad") ||
    normalized.includes("nao determinad")
  )
    return "desconhecida";
  if (
    normalized.includes("determinad") ||
    normalized.includes("identificad") ||
    normalized === "sim"
  )
    return "determinada";

  return "nao_informada";
}

export function getAuthorshipLabel(value: unknown) {
  const category = classifyAuthorship(value);
  if (category === "determinada") return "Determinada";
  if (category === "desconhecida") return "Desconhecida";
  if (category === "sem_autoria") return "Sem autoria";
  return "Não informada";
}
