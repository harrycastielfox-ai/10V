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
