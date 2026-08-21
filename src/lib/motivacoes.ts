import { normalizeProceduralTagSearch } from "@/lib/proceduralTags";

// Catálogo de apoio para o campo "Motivação". Serve só como sugestão: o campo
// continua livre, e qualquer motivação nova digitada passa a aparecer aqui via
// listKnownInqueritoMotivacoes(), sem precisar editar esta lista.
//
// A primeira parte reproduz as motivações usadas no registro oficial; a segunda
// reúne complementos locais para situações recorrentes na DT.
export const MOTIVACAO_SUGGESTIONS = [
  "Acerto de contas",
  "Acerto de contas (tráfico de drogas)",
  "Alienação Parental",
  "Ambição",
  "Assegurar a execução de outro crime",
  "Assegurar a impunidade ou vantagem de outro crime",
  "Assegurar a ocultação de outro crime",
  "Briga de trânsito",
  "Briga entre vizinhos",
  "Briga outras circunstâncias",
  "Briga por embriaguez/droga",
  "Briga(intra) familiar",
  "Bullying",
  "Conflito agrário e fundiário",
  "Conflito na comunidade",
  "Conotação política",
  "Conotação racista",
  "Crime falimentar",
  "Crime organizado",
  "Crime passional",
  "Crime sexual",
  "Disputa entre gangues",
  "Doença mental",
  "Embriaguez/droga",
  "Envolvimento com corrupção",
  "Grupo de extermínio",
  "Homofobia",
  "Influência de fatores sócios culturais",
  "Influência de uso de drogas ou de álcool",
  "Injusta provocação da vítima",
  "Interesse financeiro",
  "Intervenção policial enfrentamento com criminosos",
  "Intolerância contra a população em situação de rua",
  "Intolerância religiosa",
  "Intolerância xenofóbica (estrangeiros e migrantes)",
  "Ira",
  "Lascívia",
  "Legítima defesa",
  "LGBTFOBIA",
  "Misoginia",
  "Motivo fútil",
  "Motivo torpe",
  "Não definido",
  "Outros",
  "Paga ou promessa de recompensa",
  "Pedofilia",
  "Pistolagem",
  "Queima de arquivo",
  "Reação de cidadão à prática de um delito",
  "Rixa / galera",
  "Sequestro por engano",
  "Tráfico de drogas e entorpecentes",
  "Traição, emboscada, ou dissimulação",
  "Transfobia",
  "Vicaricídio",
  "Vingança",
  "Violência de Gênero Contra a Mulher",
  "Violência doméstica",
  // Complementos locais.
  "Abigeato (furto de animais)",
  "Assédio ou perseguição (stalking)",
  "Ciúme",
  "Cobrança de dívida",
  "Disputa por herança ou bens",
  "Disputa trabalhista",
  "Disputa de ponto de venda de drogas",
  "Divulgação de imagens íntimas",
  "Domínio territorial de facção",
  "Estelionato ou fraude financeira",
  "Fim de relacionamento",
  "Intolerância contra pessoa com deficiência",
  "Retaliação por denúncia",
  "Rivalidade entre torcidas",
  "Subtração de bens (roubo ou furto)",
  "Vandalismo ou dano ao patrimônio",
  "Violência contra criança ou adolescente",
  "Violência contra idoso",
  "Desavença em rede social",
] as const;

// Junta o catálogo com as motivações já gravadas em procedimentos, sem repetir
// o que só muda em acento ou caixa.
export function mergeMotivacaoSuggestions(known: readonly string[] = []) {
  const unique = new Map<string, string>();

  for (const suggestion of [...MOTIVACAO_SUGGESTIONS, ...known]) {
    const value = suggestion.trim();
    if (!value) continue;
    const key = normalizeProceduralTagSearch(value);
    if (key && !unique.has(key)) unique.set(key, value);
  }

  return [...unique.values()].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

type MotivacaoRule = {
  terms: string[];
  suggestions: string[];
};

const MOTIVACAO_RULES: MotivacaoRule[] = [
  {
    terms: ["homicidio", "feminicidio", "latrocinio"],
    suggestions: [
      "Vingança",
      "Motivo fútil",
      "Motivo torpe",
      "Acerto de contas",
      "Crime passional",
      "Queima de arquivo",
      "Paga ou promessa de recompensa",
      "Traição, emboscada, ou dissimulação",
    ],
  },
  {
    terms: ["trafico", "entorpecente", "drogas"],
    suggestions: [
      "Acerto de contas (tráfico de drogas)",
      "Disputa de ponto de venda de drogas",
      "Domínio territorial de facção",
      "Tráfico de drogas e entorpecentes",
      "Crime organizado",
      "Cobrança de dívida",
    ],
  },
  {
    terms: ["estupro", "importunacao sexual", "assedio sexual", "violacao sexual", "pedofilia"],
    suggestions: [
      "Crime sexual",
      "Lascívia",
      "Pedofilia",
      "Violência de Gênero Contra a Mulher",
      "Divulgação de imagens íntimas",
    ],
  },
  {
    terms: ["violencia domestica", "maria da penha", "feminicidio", "lesao corporal", "ameaca"],
    suggestions: [
      "Violência doméstica",
      "Violência de Gênero Contra a Mulher",
      "Ciúme",
      "Fim de relacionamento",
      "Briga(intra) familiar",
      "Vicaricídio",
      "Violência contra criança ou adolescente",
      "Violência contra idoso",
    ],
  },
  {
    terms: ["roubo", "furto", "receptacao", "apropriacao", "estelionato", "fraude"],
    suggestions: [
      "Subtração de bens (roubo ou furto)",
      "Interesse financeiro",
      "Cobrança de dívida",
      "Estelionato ou fraude financeira",
      "Crime organizado",
    ],
  },
  {
    terms: ["abigeato", "furto de animais"],
    suggestions: ["Abigeato (furto de animais)", "Interesse financeiro"],
  },
  {
    terms: ["transito", "embriaguez ao volante", "lesao culposa"],
    suggestions: [
      "Briga de trânsito",
      "Embriaguez/droga",
      "Influência de uso de drogas ou de álcool",
    ],
  },
  {
    terms: ["dano", "vandalismo", "depredacao"],
    suggestions: [
      "Vandalismo ou dano ao patrimônio",
      "Desavença em rede social",
      "Conflito na comunidade",
      "Briga entre vizinhos",
    ],
  },
  {
    terms: ["perseguicao", "stalking", "bullying", "injuria", "difamacao"],
    suggestions: [
      "Assédio ou perseguição (stalking)",
      "Bullying",
      "Retaliação por denúncia",
      "Desavença em rede social",
    ],
  },
  {
    terms: ["racismo", "injuria racial", "homofobia", "transfobia", "xenofobia"],
    suggestions: [
      "Conotação racista",
      "Homofobia",
      "Transfobia",
      "Intolerância xenofóbica (estrangeiros e migrantes)",
      "LGBTFOBIA",
    ],
  },
  {
    terms: ["sequestro", "extorsao", "extorsao mediante sequestro"],
    suggestions: [
      "Interesse financeiro",
      "Crime organizado",
      "Disputa entre gangues",
      "Sequestro por engano",
    ],
  },
];

const GENERAL_MOTIVACAO_SUGGESTIONS = [
  "Motivo fútil",
  "Motivo torpe",
  "Interesse financeiro",
  "Vingança",
  "Outros",
  "Não definido",
];

/**
 * Ordena o catálogo conforme as tipificações, sem escolher nada pelo usuário.
 * Quando há busca, as sugestões contextuais continuam aparecendo primeiro entre
 * os resultados compatíveis.
 */
export function getContextualMotivacaoSuggestions(
  options: readonly string[],
  tipificacoes: readonly string[],
  query = "",
  limit = 8,
) {
  const tipificacaoText = normalizeProceduralTagSearch(tipificacoes.join(" "));
  const scores = new Map<string, number>();

  for (const rule of MOTIVACAO_RULES) {
    if (!rule.terms.some((term) => tipificacaoText.includes(normalizeProceduralTagSearch(term)))) {
      continue;
    }
    rule.suggestions.forEach((suggestion, index) => {
      const key = normalizeProceduralTagSearch(suggestion);
      scores.set(key, (scores.get(key) ?? 0) + rule.suggestions.length - index);
    });
  }

  if (scores.size === 0) {
    GENERAL_MOTIVACAO_SUGGESTIONS.forEach((suggestion, index) => {
      scores.set(
        normalizeProceduralTagSearch(suggestion),
        GENERAL_MOTIVACAO_SUGGESTIONS.length - index,
      );
    });
  }

  const normalizedQuery = normalizeProceduralTagSearch(query);
  const queryTerms = normalizedQuery.split(" ").filter(Boolean);

  return options
    .filter((option) => {
      const normalizedOption = normalizeProceduralTagSearch(option);
      if (queryTerms.length > 0) {
        return queryTerms.every((term) => normalizedOption.includes(term));
      }
      return scores.has(normalizedOption);
    })
    .sort((left, right) => {
      const leftKey = normalizeProceduralTagSearch(left);
      const rightKey = normalizeProceduralTagSearch(right);
      if (normalizedQuery) {
        const leftStarts = leftKey.startsWith(normalizedQuery) ? 1 : 0;
        const rightStarts = rightKey.startsWith(normalizedQuery) ? 1 : 0;
        if (leftStarts !== rightStarts) return rightStarts - leftStarts;
      }
      const scoreDifference = (scores.get(rightKey) ?? 0) - (scores.get(leftKey) ?? 0);
      return scoreDifference || left.localeCompare(right, "pt-BR");
    })
    .slice(0, limit);
}
