import { getNexoPersonPhotoUrl } from "./nexoSelectors";
import { routeCoordinates, safeNexoNavigationUrl } from "./nexoRouteEligibility";
import type {
  NexoOrganizacao,
  NexoPessoa,
  NexoRegistroVinculado,
  NexoTerritorio,
  NexoVinculo,
} from "./nexoTypes";

export interface NexoPeopleDirectoryFilters {
  query: string;
  organizationId: string;
  link: "all" | "linked" | "unlinked";
  leadership: boolean;
  photo: "all" | "with" | "without";
  location: "all" | "own" | "organization" | "missing";
  sort: "name" | "recent";
}

export interface NexoOrganizationDirectoryFilters {
  query: string;
  status: NexoOrganizacao["status"] | "all";
  risk: NexoOrganizacao["nivel_risco"] | "all";
  sort: "name" | "members" | "recent";
}

export const EMPTY_PEOPLE_DIRECTORY_FILTERS: NexoPeopleDirectoryFilters = {
  query: "",
  organizationId: "",
  link: "all",
  leadership: false,
  photo: "all",
  location: "all",
  sort: "name",
};

export const EMPTY_ORGANIZATION_DIRECTORY_FILTERS: NexoOrganizationDirectoryFilters = {
  query: "",
  status: "all",
  risk: "all",
  sort: "name",
};

export function normalizeDirectoryText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function activeDirectoryLinks(person: NexoPessoa) {
  return person.vinculos.filter((link) => link.status !== "desvinculado");
}

export function isDirectoryLeadershipLink(link: NexoVinculo) {
  return (
    link.status !== "desvinculado" &&
    /\b(lider|lideranca|chefe|comando|comandante|gerente|disciplina|tesoureir[oa]?|responsavel|frente)\b/.test(
      normalizeDirectoryText(link.funcao),
    )
  );
}

export function hasDirectoryPhoto(person: NexoPessoa) {
  return Boolean(
    getNexoPersonPhotoUrl(person) ||
    person.foto_perfil_path ||
    person.foto_relatorio_path ||
    person.fotos.some((photo) => photo.storage_path),
  );
}

export function directoryPersonLocation(
  person: NexoPessoa,
  territories: NexoTerritorio[],
): Exclude<NexoPeopleDirectoryFilters["location"], "all"> {
  if (person.em_situacao_rua) return "missing";
  if (person.usar_local_faccao) {
    const organizationIds = new Set(
      activeDirectoryLinks(person).map((link) => link.organizacao_id),
    );
    return territories.some(
      (territory) =>
        organizationIds.has(territory.organizacao_id) && territory.classificacao !== "historico",
    )
      ? "organization"
      : "missing";
  }
  const address = person.endereco;
  const coordinates = Boolean(routeCoordinates(person));
  return address &&
    (coordinates ||
      safeNexoNavigationUrl(address.link_navegacao) ||
      (address.logradouro?.trim() && address.municipio?.trim()))
    ? "own"
    : "missing";
}

export function uniqueDirectoryProcedureCount(records: NexoRegistroVinculado[]) {
  return new Set(
    records.flatMap((record) => [
      ...(record.inquerito_id ? [`inquerito:${record.inquerito_id}`] : []),
      ...(record.bo_id ? [`bo:${record.bo_id}`] : []),
    ]),
  ).size;
}

export function organizationDirectoryStats(
  organizationId: string,
  people: NexoPessoa[],
  territories: NexoTerritorio[],
  records: NexoRegistroVinculado[],
) {
  const members = people.filter((person) =>
    activeDirectoryLinks(person).some((link) => link.organizacao_id === organizationId),
  );
  const memberIds = new Set(members.map((person) => person.id));
  return {
    members: memberIds.size,
    leaders: members.filter((person) =>
      activeDirectoryLinks(person).some(
        (link) => link.organizacao_id === organizationId && isDirectoryLeadershipLink(link),
      ),
    ).length,
    territories: new Set(
      territories
        .filter((territory) => territory.organizacao_id === organizationId)
        .map((territory) => territory.id),
    ).size,
    procedures: uniqueDirectoryProcedureCount(
      records.filter(
        (record) =>
          record.organizacao_id === organizationId ||
          Boolean(record.pessoa_id && memberIds.has(record.pessoa_id)),
      ),
    ),
  };
}

export function filterDirectoryPeople(
  people: NexoPessoa[],
  territories: NexoTerritorio[],
  filters: NexoPeopleDirectoryFilters,
) {
  const query = normalizeDirectoryText(filters.query);
  const documentQuery = query.replace(/\D/g, "");
  return people
    .filter((person) => {
      const links = activeDirectoryLinks(person);
      const scopedLinks = filters.organizationId
        ? links.filter((link) => link.organizacao_id === filters.organizationId)
        : links;
      if (filters.organizationId && !scopedLinks.length) return false;
      if (filters.link === "linked" && !links.length) return false;
      if (filters.link === "unlinked" && links.length) return false;
      if (filters.leadership && !scopedLinks.some(isDirectoryLeadershipLink)) return false;
      if (filters.photo === "with" && !hasDirectoryPhoto(person)) return false;
      if (filters.photo === "without" && hasDirectoryPhoto(person)) return false;
      if (
        filters.location !== "all" &&
        directoryPersonLocation(person, territories) !== filters.location
      )
        return false;
      if (!query) return true;
      const documents = [
        person.cpf,
        person.rg,
        ...person.documentos_extras.map((item) => item.numero),
      ];
      const haystack = normalizeDirectoryText(
        [person.nome, person.apelido, person.nome_social, ...documents].join(" "),
      );
      return (
        haystack.includes(query) ||
        (/^[\d\s./-]+$/.test(query) &&
          documentQuery.length > 0 &&
          documents.some((value) => value?.replace(/\D/g, "").includes(documentQuery)))
      );
    })
    .sort((a, b) =>
      filters.sort === "recent"
        ? b.created_at.localeCompare(a.created_at) || a.nome.localeCompare(b.nome, "pt-BR")
        : a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

export function filterDirectoryOrganizations(
  organizations: NexoOrganizacao[],
  people: NexoPessoa[],
  filters: NexoOrganizationDirectoryFilters,
) {
  const query = normalizeDirectoryText(filters.query);
  return organizations
    .filter(
      (organization) =>
        (filters.status === "all" || organization.status === filters.status) &&
        (filters.risk === "all" || organization.nivel_risco === filters.risk) &&
        (!query ||
          normalizeDirectoryText(
            [
              organization.nome,
              organization.sigla,
              organization.area_atuacao,
              organization.descricao,
            ].join(" "),
          ).includes(query)),
    )
    .sort((a, b) => {
      if (filters.sort === "recent")
        return b.created_at.localeCompare(a.created_at) || a.nome.localeCompare(b.nome, "pt-BR");
      if (filters.sort === "members") {
        const count = (id: string) =>
          people.filter((person) =>
            activeDirectoryLinks(person).some((link) => link.organizacao_id === id),
          ).length;
        return count(b.id) - count(a.id) || a.nome.localeCompare(b.nome, "pt-BR");
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}
