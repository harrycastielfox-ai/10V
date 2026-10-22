import type { NexoPessoa } from "./nexoTypes";

export interface NexoSourceAlternative {
  document: string;
  page: number;
  value: string;
  source: string;
  confidence: "alta" | "revisar";
}

export interface NexoSourceComparison {
  field: string;
  label: string;
  alternatives: NexoSourceAlternative[];
}

/** Returns only explicit conflicts between accepted source claims; it never chooses a winner. */
export function findNexoSourceComparisons(person: NexoPessoa): NexoSourceComparison[] {
  const groups = new Map<string, { label: string; alternatives: NexoSourceAlternative[] }>();
  for (const document of person.documentos_fontes ?? []) {
    for (const claim of document.alegacoes ?? []) {
      if (claim.estado === "rejeitado") continue;
      const normalized = (claim.valor_normalizado || claim.valor_original)
        .trim()
        .toLocaleLowerCase();
      if (!normalized) continue;
      const group = groups.get(claim.campo) ?? { label: claim.rotulo, alternatives: [] };
      const duplicate = group.alternatives.some(
        (alternative) =>
          alternative.document === document.original_filename &&
          alternative.page === claim.pagina &&
          alternative.value.trim().toLocaleLowerCase() === normalized,
      );
      if (!duplicate) {
        group.alternatives.push({
          document: document.original_filename,
          page: claim.pagina,
          value: claim.valor_original,
          source: claim.fonte,
          confidence: claim.confianca,
        });
      }
      groups.set(claim.campo, group);
    }
  }
  return [...groups.entries()]
    .filter(([, group]) => {
      const distinct = new Set(
        group.alternatives.map((alternative) => alternative.value.trim().toLocaleLowerCase()),
      );
      return distinct.size > 1;
    })
    .map(([field, group]) => ({ field, label: group.label, alternatives: group.alternatives }));
}
