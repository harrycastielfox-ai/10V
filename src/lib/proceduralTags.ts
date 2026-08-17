export const PROCEDURAL_TAG_SCOPES = [
  "inquerito_status",
  "inquerito_gravidade",
  "tipificacao",
  "inquerito_geral",
  "movimentacao_tipo",
  "movimentacao_status",
  "prioridade",
  "movimentacao_geral",
] as const;

export type ProceduralTagScope = (typeof PROCEDURAL_TAG_SCOPES)[number];
export type ProceduralTagColor = "cyan" | "blue" | "green" | "amber" | "red" | "purple" | "slate";

export type ProceduralTag = {
  id: string;
  scope: ProceduralTagScope;
  name: string;
  slug: string;
  color: ProceduralTagColor;
  is_system: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProceduralStatusHistory = {
  id: number;
  entity_type: "inquerito" | "movimentacao";
  inquerito_id: string | null;
  representacao_id: string | null;
  previous_status_tag_id: string | null;
  status_tag_id: string;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
};

// As cores vivem em styles.css (.sipi-tag-*) porque precisam de valores
// diferentes no tema claro e no escuro.
export const TAG_COLOR_CLASS: Record<ProceduralTagColor, string> = {
  cyan: "sipi-tag sipi-tag-cyan",
  blue: "sipi-tag sipi-tag-blue",
  green: "sipi-tag sipi-tag-green",
  amber: "sipi-tag sipi-tag-amber",
  red: "sipi-tag sipi-tag-red",
  purple: "sipi-tag sipi-tag-purple",
  slate: "sipi-tag sipi-tag-slate",
};

export function slugifyProceduralTag(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function normalizeProceduralTagSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function repairUtf8Mojibake(value: string) {
  return value.replace(/[ÃÂ][\u0080-\u00BF]/g, (sequence) => {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from([sequence.charCodeAt(0), sequence.charCodeAt(1)]),
      );
    } catch {
      return sequence;
    }
  });
}

export function matchesProceduralTagQuery(name: string, query: string) {
  const normalizedName = normalizeProceduralTagSearch(name);
  const terms = normalizeProceduralTagSearch(query).split(" ").filter(Boolean);
  return terms.length > 0 && terms.every((term) => normalizedName.includes(term));
}

export function getProceduralTagSearchRank(name: string, query: string) {
  const normalizedName = normalizeProceduralTagSearch(name);
  const normalizedQuery = normalizeProceduralTagSearch(query);
  if (!normalizedQuery) return Number.POSITIVE_INFINITY;
  if (/^\d+$/.test(normalizedQuery)) {
    const code = normalizedName.match(/^\+?\s*(\d+)\s*:/)?.[1];
    if (code === normalizedQuery) return 0;
  }
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (matchesProceduralTagQuery(name, query)) return 2;
  return Number.POSITIVE_INFINITY;
}

export function splitNumberedProceduralTags(value: string) {
  return value
    .split(/,\s*(?=\+?\s*\d+\s*:)/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function tagsByScope(tags: ProceduralTag[], scope: ProceduralTagScope) {
  return tags.filter((tag) => tag.scope === scope && tag.active);
}
