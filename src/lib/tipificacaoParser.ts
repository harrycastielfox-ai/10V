import { slugifyProceduralTag } from "@/lib/proceduralTags";

export type TipificacaoItem = {
  codigo: string | null;
  descricao: string;
  rotulo: string;
  slug: string;
};

const NUMBERED_SEPARATOR = /,\s*(?=\+?\s*\d{1,5}\s*:\s*)/gu;
const FORM_SEPARATOR = /\s*;\s*/gu;
const NUMBERED_ITEM = /^\s*\+?\s*(\d{1,5})\s*:\s*([\s\S]+)$/u;

function normalizeDescription(value: string) {
  return value
    .replace(/\s+/gu, " ")
    .replace(/^:\s*/u, "")
    .replace(/[;.,\s]+$/gu, "")
    .trim();
}

// O banco aceita até 300 caracteres no nome da tag. Tipificação de trânsito e
// de violência doméstica passa fácil de 120, e cortar cedo esconde o essencial.
function truncateLabel(value: string) {
  if (value.length <= 300) return value;
  const candidate = value.slice(0, 299);
  const lastSpace = candidate.lastIndexOf(" ");
  const truncated = (lastSpace >= 2 ? candidate.slice(0, lastSpace) : candidate).trimEnd();
  return `${truncated}…`;
}

function toItem(value: string): TipificacaoItem | null {
  const normalizedPart = normalizeDescription(value);
  if (!normalizedPart) return null;
  const match = NUMBERED_ITEM.exec(normalizedPart);
  const codigo = match?.[1] ?? null;
  const descricao = normalizeDescription(match?.[2] ?? normalizedPart);
  if (!descricao) return null;
  const rotulo = truncateLabel(codigo ? `${codigo}: ${descricao}` : descricao);
  const textSlug = slugifyProceduralTag(descricao);
  const slug = codigo
    ? `tip-${codigo}`
    : textSlug.length >= 2
      ? textSlug
      : `tag-${textSlug || "item"}`;
  return { codigo, descricao, rotulo, slug };
}

function normalizeCatalogMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/gu, "");
}

function matchKnownCatalog(raw: string, knownLabels: readonly string[]) {
  if (knownLabels.length < 2) return [];
  const compactRaw = normalizeCatalogMatch(raw);
  const matches = knownLabels
    .map((label) => ({ label, compact: normalizeCatalogMatch(label) }))
    .filter((item) => item.compact.length >= 12)
    .map((item) => ({ ...item, index: compactRaw.indexOf(item.compact) }))
    .filter((item) => item.index >= 0)
    .sort((left, right) => left.index - right.index || right.compact.length - left.compact.length);

  const selected: typeof matches = [];
  let occupiedUntil = -1;
  for (const match of matches) {
    if (match.index < occupiedUntil) continue;
    selected.push(match);
    occupiedUntil = match.index + match.compact.length;
  }
  return selected.length >= 2 ? selected.map((item) => item.label) : [];
}

export function parseTipificacoes(
  raw: string | null | undefined,
  knownLabels: readonly string[] = [],
): TipificacaoItem[] {
  if (!raw?.trim()) return [];
  const numberedParts = raw.split(FORM_SEPARATOR).flatMap((part) => part.split(NUMBERED_SEPARATOR));
  const catalogParts =
    numberedParts.length === 1 && !NUMBERED_ITEM.test(numberedParts[0])
      ? matchKnownCatalog(raw, knownLabels)
      : [];
  const parts = catalogParts.length > 1 ? catalogParts : numberedParts;
  const seen = new Set<string>();
  const items: TipificacaoItem[] = [];

  for (const part of parts) {
    const item = toItem(part);
    if (!item || seen.has(item.slug)) continue;
    seen.add(item.slug);
    items.push(item);
  }
  return items;
}
