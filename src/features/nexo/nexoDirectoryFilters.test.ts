import { describe, expect, it } from "vitest";
import {
  directoryPersonLocation,
  EMPTY_ORGANIZATION_DIRECTORY_FILTERS,
  EMPTY_PEOPLE_DIRECTORY_FILTERS,
  filterDirectoryOrganizations,
  filterDirectoryPeople,
  organizationDirectoryStats,
  uniqueDirectoryProcedureCount,
} from "./nexoDirectoryFilters";
import type {
  NexoEndereco,
  NexoOrganizacao,
  NexoPessoa,
  NexoRegistroVinculado,
  NexoTerritorio,
  NexoVinculo,
} from "./nexoTypes";

function link(organizationId: string, overrides: Partial<NexoVinculo> = {}) {
  return {
    id: `${organizationId}-link`,
    organizacao_id: organizationId,
    status: "confirmado",
    funcao: "Integrante",
    ...overrides,
  } as NexoVinculo;
}

function person(id: string, overrides: Partial<NexoPessoa> = {}) {
  return {
    id,
    nome: id,
    apelido: null,
    nome_social: null,
    cpf: null,
    rg: null,
    documentos_extras: [],
    fotos: [],
    vinculos: [],
    usar_local_faccao: false,
    endereco: null,
    created_at: "2026-10-16T12:00:00Z",
    ...overrides,
  } as NexoPessoa;
}

function record(id: string, overrides: Partial<NexoRegistroVinculado> = {}) {
  return {
    id,
    pessoa_id: null,
    organizacao_id: null,
    inquerito_id: null,
    bo_id: null,
    ...overrides,
  } as NexoRegistroVinculado;
}

function address(overrides: Partial<NexoEndereco> = {}): NexoEndereco {
  return {
    id: "address",
    logradouro: "",
    numero: null,
    bairro: null,
    municipio: "",
    uf: "",
    ponto_referencia: null,
    como_chegar: null,
    link_navegacao: null,
    latitude: null,
    longitude: null,
    ...overrides,
  };
}

describe("NEXO directory filters", () => {
  it("searches accented names, aliases and document numbers without punctuation", () => {
    const people = [
      person("one", { nome: "João da Conceição", apelido: "Águia", cpf: "123.456.789-00" }),
    ];
    for (const query of ["joao", "conceicao", "aguia", "12345678900"]) {
      expect(
        filterDirectoryPeople(people, [], { ...EMPTY_PEOPLE_DIRECTORY_FILTERS, query }),
      ).toHaveLength(1);
    }
  });

  it("does not treat a former faction link as an active member or leader", () => {
    const people = [
      person("former", { vinculos: [link("org-a", { status: "desvinculado", funcao: "Líder" })] }),
      person("current", {
        vinculos: [link("org-a", { status: "provavel", funcao: "Vice-líder" })],
      }),
    ];
    expect(
      filterDirectoryPeople(people, [], {
        ...EMPTY_PEOPLE_DIRECTORY_FILTERS,
        organizationId: "org-a",
      }).map((item) => item.id),
    ).toEqual(["current"]);
    expect(
      filterDirectoryPeople(people, [], {
        ...EMPTY_PEOPLE_DIRECTORY_FILTERS,
        leadership: true,
      }).map((item) => item.id),
    ).toEqual(["current"]);
    expect(
      filterDirectoryPeople(people, [], {
        ...EMPTY_PEOPLE_DIRECTORY_FILTERS,
        link: "unlinked",
      }).map((item) => item.id),
    ).toEqual(["former"]);
  });

  it("applies leadership to the selected faction rather than another active link", () => {
    const people = [
      person("one", { vinculos: [link("org-a"), link("org-b", { funcao: "Líder" })] }),
    ];
    expect(
      filterDirectoryPeople(people, [], {
        ...EMPTY_PEOPLE_DIRECTORY_FILTERS,
        organizationId: "org-a",
        leadership: true,
      }),
    ).toHaveLength(0);
  });

  it("counts unique procedure identities across direct and active member links", () => {
    const people = [
      person("one", { vinculos: [link("org-a"), link("org-a", { id: "second" })] }),
      person("former", { vinculos: [link("org-a", { status: "desvinculado" })] }),
    ];
    const records = [
      record("direct", { organizacao_id: "org-a", inquerito_id: "ip-one" }),
      record("same", { pessoa_id: "one", inquerito_id: "ip-one" }),
      record("bo", { pessoa_id: "one", bo_id: "bo-one" }),
      record("former", { pessoa_id: "former", bo_id: "bo-two" }),
    ];
    expect(uniqueDirectoryProcedureCount(records)).toBe(3);
    expect(organizationDirectoryStats("org-a", people, [], records)).toMatchObject({
      members: 1,
      procedures: 2,
    });
  });

  it("does not inherit a faction location through a removed or historical association", () => {
    const territory = {
      id: "one",
      organizacao_id: "org-a",
      classificacao: "confirmado",
    } as NexoTerritorio;
    expect(
      directoryPersonLocation(
        person("one", {
          usar_local_faccao: true,
          vinculos: [link("org-a", { status: "desvinculado" })],
        }),
        [territory],
      ),
    ).toBe("missing");
    expect(
      directoryPersonLocation(
        person("one", { usar_local_faccao: true, vinculos: [link("org-a")] }),
        [territory],
      ),
    ).toBe("organization");
    expect(
      directoryPersonLocation(
        person("one", { usar_local_faccao: true, vinculos: [link("org-a")] }),
        [{ ...territory, classificacao: "historico" }],
      ),
    ).toBe("missing");
  });

  it("filters by recorded organization risk and sorts by current membership", () => {
    const organizations = [
      { id: "a", nome: "Ágata", status: "ativa", nivel_risco: "alto" },
      { id: "b", nome: "Beta", status: "monitoramento", nivel_risco: "baixo" },
    ] as NexoOrganizacao[];
    const people = [
      person("one", { vinculos: [link("b"), link("a", { status: "desvinculado" })] }),
    ];
    expect(
      filterDirectoryOrganizations(organizations, people, {
        ...EMPTY_ORGANIZATION_DIRECTORY_FILTERS,
        sort: "members",
      }).map((item) => item.id),
    ).toEqual(["b", "a"]);
    expect(
      filterDirectoryOrganizations(organizations, people, {
        ...EMPTY_ORGANIZATION_DIRECTORY_FILTERS,
        risk: "alto",
        query: "agata",
      }).map((item) => item.id),
    ).toEqual(["a"]);
  });

  it("does not consider invalid coordinates or executable links a usable address", () => {
    for (const endereco of [
      { latitude: 0, longitude: 0 },
      { latitude: 91, longitude: -39 },
      { link_navegacao: "javascript:alert(1)" },
    ]) {
      expect(directoryPersonLocation(person("one", { endereco: address(endereco) }), [])).toBe(
        "missing",
      );
    }
    expect(
      directoryPersonLocation(
        person("one", {
          em_situacao_rua: true,
          endereco: address({ latitude: -16, longitude: -39 }),
        }),
        [],
      ),
    ).toBe("missing");
  });
});
