import { describe, expect, it } from "vitest";
import { NEXO_DEMO_PESSOAS, NEXO_DEMO_REGISTROS } from "./nexoDemoData";
import {
  filterNexoOrganizationMembers,
  hasActiveMemberFilters,
  type NexoMemberFilters,
} from "./nexoMemberFilters";

const emptyFilters: NexoMemberFilters = {
  busca: "",
  funcao: "",
  status: "",
  bairro: "",
  confiancaMinima: 0,
  procedimento: "todos",
};

const members = NEXO_DEMO_PESSOAS.map((person) => ({
  person,
  link: person.vinculos[0],
}));

describe("filterNexoOrganizationMembers", () => {
  it("busca sem diferenciar acentos ou maiúsculas", () => {
    const result = filterNexoOrganizationMembers(members, NEXO_DEMO_REGISTROS, {
      ...emptyFilters,
      busca: "lideranca",
    });

    expect(result.map(({ person }) => person.id)).toContain("pessoa-1");
  });

  it("combina confiança, bairro e existência de procedimento", () => {
    const result = filterNexoOrganizationMembers(members, NEXO_DEMO_REGISTROS, {
      ...emptyFilters,
      bairro: "Centro",
      confiancaMinima: 70,
      procedimento: "com_procedimento",
    });

    expect(result.map(({ person }) => person.id)).toEqual(["pessoa-1"]);
  });

  it("localiza CPF e RG mesmo quando a busca e o cadastro usam pontuação diferente", () => {
    const documents = [
      {
        person: { ...members[0].person, cpf: "123.456.789-00", rg: "12345678" },
        link: members[0].link,
      },
    ];
    for (const busca of ["12345678900", "123.456.789-00", "12.345.678", "12345678"]) {
      expect(
        filterNexoOrganizationMembers(documents, [], { ...emptyFilters, busca }),
        busca,
      ).toHaveLength(1);
    }
    expect(
      filterNexoOrganizationMembers(documents, [], {
        ...emptyFilters,
        busca: "outro 12345678",
      }),
    ).toEqual([]);
  });

  it("informa quando há algum filtro ativo", () => {
    expect(hasActiveMemberFilters(emptyFilters)).toBe(false);
    expect(hasActiveMemberFilters({ ...emptyFilters, status: "provavel" })).toBe(true);
  });
});
