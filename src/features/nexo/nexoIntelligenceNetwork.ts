import type { NexoOrganizacao, NexoPessoa, NexoVinculoStatus } from "./nexoTypes";

export type IntelligenceFocus = { kind: "person" | "organization"; id: string } | null;
export type IntelligenceStatusFilter = "active" | "all" | NexoVinculoStatus;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function buildIntelligenceNetwork(
  organizations: NexoOrganizacao[],
  people: NexoPessoa[],
  filters: {
    query: string;
    faction: string;
    status: IntelligenceStatusFilter;
    focus: IntelligenceFocus;
  },
) {
  const query = normalize(filters.query);
  return organizations.flatMap((organization) => {
    if (filters.faction && filters.faction !== organization.id) return [];
    if (filters.focus?.kind === "organization" && filters.focus.id !== organization.id) return [];
    const organizationMatches =
      query && normalize(`${organization.nome} ${organization.sigla || ""}`).includes(query);
    const members = people.flatMap((person) => {
      if (filters.focus?.kind === "person" && filters.focus.id !== person.id) return [];
      return person.vinculos
        .filter(
          (link) =>
            link.organizacao_id === organization.id &&
            (filters.status === "all" ||
              (filters.status === "active"
                ? link.status !== "desvinculado"
                : link.status === filters.status)) &&
            (!query ||
              organizationMatches ||
              normalize(
                [person.nome, person.apelido, link.funcao, link.fonte_resumo].join(" "),
              ).includes(query)),
        )
        .map((link) => ({ person, link }));
    });
    if (
      !members.length &&
      (filters.focus?.kind === "person" ||
        (query && !organizationMatches) ||
        !["active", "all"].includes(filters.status))
    )
      return [];
    return [{ organization, members }];
  });
}
