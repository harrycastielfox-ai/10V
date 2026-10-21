import {
  activeDirectoryLinks,
  directoryPersonLocation,
  hasDirectoryPhoto,
  normalizeDirectoryText,
} from "./nexoDirectoryFilters";
import type { NexoPessoa, NexoTerritorio } from "./nexoTypes";

export type NexoPendingCategory =
  | "foto_perfil"
  | "identificacao"
  | "localizacao"
  | "fonte_vinculo"
  | "confirmacao_vinculo"
  | "documento"
  | "duplicidade";

export type NexoPendingSeverity = "obrigatoria" | "recomendacao";

export interface NexoPendingItem {
  id: string;
  category: NexoPendingCategory;
  severity: NexoPendingSeverity;
  personId: string;
  title: string;
  detail: string;
  searchText: string;
}

export interface NexoPendingCategorySummary {
  category: NexoPendingCategory;
  label: string;
  description: string;
  items: NexoPendingItem[];
}

const CATEGORY_META: Record<NexoPendingCategory, { label: string; description: string }> = {
  foto_perfil: {
    label: "Fotografia de perfil",
    description: "Pessoas sem foto disponível no cadastro ou álbum.",
  },
  identificacao: {
    label: "Identificação documental",
    description: "Pessoas sem CPF e RG informados para conferência.",
  },
  localizacao: {
    label: "Localização",
    description: "Pessoas sem endereço próprio ou área vinculada disponível.",
  },
  fonte_vinculo: {
    label: "Fonte do vínculo",
    description: "Vínculos atuais sem fonte resumida registrada.",
  },
  confirmacao_vinculo: {
    label: "Confirmação do vínculo",
    description: "Vínculos atuais ainda não confirmados.",
  },
  documento: {
    label: "Documento para conferir",
    description: "Documentos cuja leitura exige conferência ou tratamento adicional.",
  },
  duplicidade: {
    label: "Possível duplicidade",
    description: "Pessoas com documento forte ou identidade coincidente para análise.",
  },
};

function addItem(
  items: NexoPendingItem[],
  person: NexoPessoa,
  category: NexoPendingCategory,
  severity: NexoPendingSeverity,
  title: string,
  detail: string,
  suffix: string,
) {
  items.push({
    id: `${category}:${person.id}:${suffix}`,
    category,
    severity,
    personId: person.id,
    title,
    detail,
    searchText: normalizeDirectoryText(`${person.nome} ${person.apelido || ""} ${title} ${detail}`),
  });
}

function normalized(value: string | null | undefined) {
  return normalizeDirectoryText(value).replace(/[^a-z0-9]/g, "");
}

function duplicateReasons(person: NexoPessoa, other: NexoPessoa) {
  const reasons: string[] = [];
  if (normalized(person.cpf) && normalized(person.cpf) === normalized(other.cpf))
    reasons.push("mesmo CPF");
  if (normalized(person.rg) && normalized(person.rg) === normalized(other.rg))
    reasons.push("mesmo RG");
  if (
    normalized(person.nome) &&
    normalized(person.nome) === normalized(other.nome) &&
    person.data_nascimento &&
    person.data_nascimento === other.data_nascimento
  )
    reasons.push("mesmo nome e nascimento");
  return reasons;
}

function buildDuplicateItems(people: NexoPessoa[]) {
  const items: NexoPendingItem[] = [];
  for (let index = 0; index < people.length; index++) {
    for (let otherIndex = index + 1; otherIndex < people.length; otherIndex++) {
      const person = people[index];
      const other = people[otherIndex];
      const reasons = duplicateReasons(person, other);
      if (!reasons.length) continue;
      addItem(
        items,
        person,
        "duplicidade",
        "obrigatoria",
        `Possível duplicidade com ${other.nome}`,
        reasons.join(", "),
        other.id,
      );
      addItem(
        items,
        other,
        "duplicidade",
        "obrigatoria",
        `Possível duplicidade com ${person.nome}`,
        reasons.join(", "),
        person.id,
      );
    }
  }
  return items;
}

export function listNexoPendingCategories(
  people: NexoPessoa[],
  territories: NexoTerritorio[],
): NexoPendingCategorySummary[] {
  const items: NexoPendingItem[] = [];
  for (const person of people) {
    if (!hasDirectoryPhoto(person))
      addItem(
        items,
        person,
        "foto_perfil",
        "recomendacao",
        "Adicionar fotografia de perfil",
        "Nenhuma fotografia está disponível para identificação visual.",
        "foto",
      );

    if (!person.cpf?.trim() && !person.rg?.trim())
      addItem(
        items,
        person,
        "identificacao",
        "recomendacao",
        "Completar identificação documental",
        "CPF e RG não informados; confirme se existe alguma fonte disponível.",
        "documentos",
      );

    if (directoryPersonLocation(person, territories) === "missing")
      addItem(
        items,
        person,
        "localizacao",
        "recomendacao",
        "Conferir localização",
        "Não há endereço próprio ou área vinculada disponível para consulta.",
        "local",
      );

    for (const link of activeDirectoryLinks(person)) {
      if (!link.fonte_resumo?.trim())
        addItem(
          items,
          person,
          "fonte_vinculo",
          "obrigatoria",
          "Registrar fonte do vínculo",
          `Vínculo com ${link.organizacao?.nome || "organização não identificada"} sem fonte resumida.`,
          link.id,
        );
      if (link.status !== "confirmado")
        addItem(
          items,
          person,
          "confirmacao_vinculo",
          "recomendacao",
          "Conferir estado do vínculo",
          `Status atual: ${link.status.replace("_", " ")}.`,
          link.id,
        );
    }

    for (const document of person.documentos_fontes || []) {
      if (document.ocr_status === "pendente" || document.ocr_status === "indisponivel")
        addItem(
          items,
          person,
          "documento",
          "obrigatoria",
          "Conferir documento-fonte",
          `${document.original_filename} exige ${document.ocr_status === "pendente" ? "OCR ou revisão" : "revisão manual"}.`,
          document.id,
        );
    }
  }

  items.push(...buildDuplicateItems(people));
  return (Object.keys(CATEGORY_META) as NexoPendingCategory[]).map((category) => ({
    category,
    ...CATEGORY_META[category],
    items: items.filter((item) => item.category === category),
  }));
}

export function filterNexoPendingItems(items: NexoPendingItem[], query: string) {
  const needle = normalizeDirectoryText(query);
  return needle ? items.filter((item) => item.searchText.includes(needle)) : items;
}

export const NEXO_PENDING_CATEGORY_META = CATEGORY_META;
