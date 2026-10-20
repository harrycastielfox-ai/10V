import type {
  NexoPessoa,
  NexoRegistroVinculado,
  NexoVinculo,
  NexoVinculoStatus,
} from "./nexoTypes";

export type NexoMemberProcedureFilter = "todos" | "com_procedimento" | "sem_procedimento";

export interface NexoMemberFilters {
  busca: string;
  funcao: string;
  status: NexoVinculoStatus | "";
  bairro: string;
  confiancaMinima: number;
  procedimento: NexoMemberProcedureFilter;
}

export interface NexoOrganizationMember {
  person: NexoPessoa;
  link: NexoVinculo | undefined;
}

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function hasActiveMemberFilters(filters: NexoMemberFilters) {
  return Boolean(
    filters.busca.trim() ||
    filters.funcao ||
    filters.status ||
    filters.bairro ||
    filters.confiancaMinima ||
    filters.procedimento !== "todos",
  );
}

export function filterNexoOrganizationMembers(
  members: NexoOrganizationMember[],
  records: NexoRegistroVinculado[],
  filters: NexoMemberFilters,
) {
  const peopleWithRecords = new Set(
    records.flatMap((record) => (record.pessoa_id ? [record.pessoa_id] : [])),
  );
  const query = normalize(filters.busca);
  const documentQuery = /^[\d\s./-]+$/.test(query) ? query.replace(/\D/g, "") : "";

  return members.filter(({ person, link }) => {
    if (query) {
      const searchable = [
        person.nome,
        person.apelido,
        person.cpf,
        person.rg,
        link?.funcao,
        person.endereco?.bairro,
        person.endereco?.logradouro,
      ]
        .map(normalize)
        .join(" ");
      const documentMatch =
        documentQuery &&
        [person.cpf, person.rg].some((value) => value?.replace(/\D/g, "").includes(documentQuery));
      if (!searchable.includes(query) && !documentMatch) return false;
    }
    if (filters.funcao && normalize(link?.funcao) !== normalize(filters.funcao)) return false;
    if (filters.status && link?.status !== filters.status) return false;
    if (filters.bairro && normalize(person.endereco?.bairro) !== normalize(filters.bairro)) {
      return false;
    }
    if ((link?.confianca ?? 0) < filters.confiancaMinima) return false;

    const hasProcedure = peopleWithRecords.has(person.id);
    if (filters.procedimento === "com_procedimento" && !hasProcedure) return false;
    if (filters.procedimento === "sem_procedimento" && hasProcedure) return false;
    return true;
  });
}
