import type {
  NexoOrganizacao,
  NexoPessoa,
  NexoRegistroVinculado,
  NexoTerritorio,
} from "./nexoTypes";

export type NexoWorkspaceView =
  "painel" | "organizacoes" | "pessoas" | "inteligencia" | "mapa" | "procedimentos" | "relatorios";
export type NexoSearchTarget =
  | { kind: "view"; view: NexoWorkspaceView }
  | { kind: "person" | "organization"; id: string }
  | { kind: "territory"; id: string; organizationId: string }
  | { kind: "procedure"; id: string; type: "bo" | "inquerito" };

export interface NexoWorkspaceSearchData {
  organizations: NexoOrganizacao[];
  people: NexoPessoa[];
  territories: NexoTerritorio[];
  records: NexoRegistroVinculado[];
}

export interface NexoSearchResult {
  id: string;
  label: string;
  detail: string;
  category: string;
  target: NexoSearchTarget;
  color?: string;
  photo?: string | null;
}

export const NEXO_SEARCH_SECTIONS: {
  view: NexoWorkspaceView;
  label: string;
  description: string;
}[] = [
  { view: "painel", label: "Central", description: "Panorama, registros recentes e cadastros" },
  { view: "organizacoes", label: "Facções", description: "Organizações e integrantes vinculados" },
  { view: "pessoas", label: "Pessoas", description: "Identificação, fotografias e vínculos" },
  {
    view: "inteligencia",
    label: "Inteligência",
    description: "Rede de relações e contexto territorial",
  },
  { view: "mapa", label: "Rotas", description: "Endereços georreferenciados e deslocamentos" },
  {
    view: "procedimentos",
    label: "Procedimentos",
    description: "B.O.s, inquéritos e análise de CVLI",
  },
  {
    view: "relatorios",
    label: "Relatórios",
    description: "Configuração de seções, fotografias e impressão",
  },
];

export function normalizeNexoSearch(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function uniqueNexoProcedureRecords(records: NexoRegistroVinculado[]) {
  const byId = new Map<string, NexoRegistroVinculado>();
  for (const record of records) {
    const key = record.inquerito_id
      ? `ip:${record.inquerito_id}`
      : record.bo_id
        ? `bo:${record.bo_id}`
        : null;
    if (key && !byId.has(key)) byId.set(key, record);
  }
  return [...byId.values()];
}

export function searchNexoWorkspace(
  query: string,
  data: NexoWorkspaceSearchData,
  limit = 24,
): NexoSearchResult[] {
  const needle = normalizeNexoSearch(query);
  const digits = query.replace(/\D/g, "");
  const isDocumentQuery = /^[\d\s./()-]+$/.test(query) && digits.length >= 4;
  const organizationById = new Map(data.organizations.map((item) => [item.id, item]));
  const results: { result: NexoSearchResult; score: number }[] = [];
  function add(result: NexoSearchResult, extra: string[] = [], documentMatch = false) {
    const label = normalizeNexoSearch(result.label);
    const haystack = normalizeNexoSearch([result.label, result.detail, ...extra].join(" "));
    if (needle && !haystack.includes(needle) && !documentMatch) return;
    results.push({
      result,
      score: needle
        ? label === needle
          ? 4
          : label.startsWith(needle)
            ? 3
            : documentMatch
              ? 2
              : 1
        : result.target.kind === "view"
          ? 3
          : 1,
    });
  }
  for (const section of NEXO_SEARCH_SECTIONS)
    add({
      id: `view:${section.view}`,
      label: section.label,
      detail: section.description,
      category: "Área do NEXO",
      target: { kind: "view", view: section.view },
    });
  for (const person of data.people) {
    const links = person.vinculos.filter((link) => link.status !== "desvinculado");
    const affiliations = links.flatMap((link) => {
      const organization = organizationById.get(link.organizacao_id);
      return organization ? [organization.nome, organization.sigla || "", link.funcao || ""] : [];
    });
    const documents = [
      person.cpf,
      person.rg,
      ...person.documentos_extras.map((document) => document.numero),
    ];
    add(
      {
        id: `person:${person.id}`,
        label: person.nome,
        detail:
          [person.apelido, person.endereco?.bairro, affiliations[0]].filter(Boolean).join(" · ") ||
          "Ficha individual",
        category: "Pessoa",
        target: { kind: "person", id: person.id },
        photo: person.foto_perfil_url,
      },
      [
        person.cpf || "",
        person.rg || "",
        person.nome_social || "",
        ...person.documentos_extras.map((document) => `${document.tipo} ${document.numero}`),
        ...affiliations,
      ],
      isDocumentQuery &&
        documents.some((document) => document?.replace(/\D/g, "").includes(digits)),
    );
  }
  for (const organization of data.organizations)
    add({
      id: `organization:${organization.id}`,
      label: organization.nome,
      detail: [organization.sigla, organization.status, organization.area_atuacao]
        .filter(Boolean)
        .join(" · "),
      category: "Facção",
      target: { kind: "organization", id: organization.id },
      color: organization.cor,
    });
  for (const territory of data.territories) {
    const organization = organizationById.get(territory.organizacao_id);
    add(
      {
        id: `territory:${territory.id}`,
        label: territory.bairro,
        detail: [organization?.nome, territory.logradouro, territory.municipio]
          .filter(Boolean)
          .join(" · "),
        category: "Área · abrir dossiê da facção",
        target: { kind: "territory", id: territory.id, organizationId: territory.organizacao_id },
        color: organization?.cor,
      },
      [territory.categoria, territory.classificacao],
    );
  }
  for (const record of uniqueNexoProcedureRecords(data.records))
    add({
      id: `procedure:${record.inquerito_id ? "ip" : "bo"}:${record.inquerito_id || record.bo_id}`,
      label: record.inquerito?.numero_ppe || record.bo?.numero_bo || "Procedimento sem número",
      detail: [record.inquerito?.situacao || record.bo?.status, record.bo?.infracao_penal]
        .filter(Boolean)
        .join(" · "),
      category: record.inquerito_id ? "Inquérito vinculado" : "B.O. vinculado",
      target: {
        kind: "procedure",
        id: record.inquerito_id || record.bo_id!,
        type: record.inquerito_id ? "inquerito" : "bo",
      },
    });
  return results
    .sort((a, b) => b.score - a.score || a.result.label.localeCompare(b.result.label, "pt-BR"))
    .slice(0, Math.max(1, limit))
    .map((item) => item.result);
}
