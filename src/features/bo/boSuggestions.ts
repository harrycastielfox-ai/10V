import {
  getProceduralTagSearchRank,
  matchesProceduralTagQuery,
  normalizeProceduralTagSearch,
} from "@/lib/proceduralTags";

export function getActiveBoInfractionQuery(value: string) {
  return value.split("\n").at(-1)?.trim() ?? "";
}

export const getActiveBoDiligenceQuery = getActiveBoInfractionQuery;

export function getBoInfractionSuggestions(value: string, options: string[], limit = 8) {
  const query = getActiveBoInfractionQuery(value);
  if (!query) return [];

  const selected = new Set(
    value.split("\n").slice(0, -1).map(normalizeProceduralTagSearch).filter(Boolean),
  );

  return options
    .filter(
      (option) =>
        !selected.has(normalizeProceduralTagSearch(option)) &&
        matchesProceduralTagQuery(option, query),
    )
    .sort((left, right) => {
      const rankDifference =
        getProceduralTagSearchRank(left, query) - getProceduralTagSearchRank(right, query);
      return rankDifference || left.localeCompare(right, "pt-BR");
    })
    .slice(0, limit);
}

export function applyBoInfractionSuggestion(value: string, suggestion: string) {
  const lines = value.split("\n");
  lines[lines.length - 1] = suggestion;
  return `${lines.join("\n")}\n`;
}

export function getBoDiligenceSuggestions(value: string, options: string[], limit = 8) {
  const query = getActiveBoDiligenceQuery(value);
  if (normalizeProceduralTagSearch(query).length < 2) return [];

  const selected = new Set(
    value.split("\n").slice(0, -1).map(normalizeProceduralTagSearch).filter(Boolean),
  );

  return options
    .filter(
      (option) =>
        !selected.has(normalizeProceduralTagSearch(option)) &&
        matchesProceduralTagQuery(option, query),
    )
    .sort((left, right) => {
      const rankDifference =
        getProceduralTagSearchRank(left, query) - getProceduralTagSearchRank(right, query);
      return rankDifference || left.localeCompare(right, "pt-BR");
    })
    .slice(0, limit);
}

export function applyBoDiligenceSuggestion(value: string, suggestion: string) {
  const lines = value.split("\n");
  lines[lines.length - 1] = suggestion;
  return lines.join("\n");
}

// O responsável é um nome só, não uma lista por linha como infração e
// diligências. Com o campo vazio devolve a lista inteira: no B.O. quem digita
// costuma querer ver quem são os responsáveis, não adivinhar a primeira letra.
export function getBoResponsibleSuggestions(value: string, options: string[], limit = 8) {
  const query = value.trim();
  const unique = [...new Set(options.map((option) => option.trim()).filter(Boolean))];
  const matches = query
    ? unique.filter((option) => matchesProceduralTagQuery(option, query))
    : unique;

  // Nome já escolhido por inteiro: não há mais o que sugerir.
  if (
    matches.length === 1 &&
    normalizeProceduralTagSearch(matches[0]) === normalizeProceduralTagSearch(query)
  ) {
    return [];
  }

  return matches
    .sort((left, right) => {
      if (!query) return left.localeCompare(right, "pt-BR");
      const rankDifference =
        getProceduralTagSearchRank(left, query) - getProceduralTagSearchRank(right, query);
      return rankDifference || left.localeCompare(right, "pt-BR");
    })
    .slice(0, limit);
}
