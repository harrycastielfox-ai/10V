import { describe, expect, it } from "vitest";
import { NEXO_DEMO_ORGANIZACOES, NEXO_DEMO_PESSOAS, NEXO_DEMO_TERRITORIOS } from "./nexoDemoData";
import type { NexoPessoa, NexoRegistroVinculado } from "./nexoTypes";
import {
  normalizeNexoSearch,
  searchNexoWorkspace,
  uniqueNexoProcedureRecords,
  type NexoWorkspaceSearchData,
} from "./nexoWorkspaceSearch";

function person(overrides: Partial<NexoPessoa> = {}): NexoPessoa {
  return {
    ...NEXO_DEMO_PESSOAS[0],
    id: "person-a",
    nome: "João da Conceição",
    apelido: "Farol",
    cpf: "123.456.789-00",
    rg: "42.810.271-2",
    nome_social: "José Alves",
    documentos_extras: [{ id: "cnh", tipo: "CNH", numero: "98765432101" }],
    vinculos: [],
    ...overrides,
  };
}

function record(overrides: Partial<NexoRegistroVinculado> = {}): NexoRegistroVinculado {
  return {
    id: "record-a",
    pessoa_id: "person-a",
    organizacao_id: null,
    inquerito_id: null,
    bo_id: "bo-a",
    observacao: null,
    created_at: "2026-10-18T12:00:00Z",
    bo: { numero_bo: "BO 0187/2026", infracao_penal: "Homicídio", status: "Em andamento" },
    ...overrides,
  };
}

function data(overrides: Partial<NexoWorkspaceSearchData> = {}): NexoWorkspaceSearchData {
  return { organizations: [], people: [], territories: [], records: [], ...overrides };
}

describe("NEXO workspace search", () => {
  it("normalizes accents, case, whitespace and missing values", () => {
    expect(normalizeNexoSearch("  CONCEIÇÃO  ")).toBe("conceicao");
    expect(normalizeNexoSearch(null)).toBe("");
  });

  it("finds people by accented name, alias and social name", () => {
    const workspace = data({ people: [person()] });
    expect(searchNexoWorkspace("joao da conceicao", workspace)[0].target).toEqual({
      kind: "person",
      id: "person-a",
    });
    expect(searchNexoWorkspace("FAROL", workspace)[0].target.kind).toBe("person");
    expect(searchNexoWorkspace("jose alves", workspace)[0].target.kind).toBe("person");
  });

  it("matches formatted and unformatted CPF, RG and additional document numbers", () => {
    const workspace = data({ people: [person()] });
    for (const query of ["12345678900", "123.456.789-00", "428102712", "98765432101"]) {
      expect(searchNexoWorkspace(query, workspace).map((result) => result.id)).toContain(
        "person:person-a",
      );
    }
    expect(searchNexoWorkspace("CNH", workspace).map((result) => result.id)).toContain(
      "person:person-a",
    );
    expect(searchNexoWorkspace("qualquer12345678900", workspace)).toEqual([]);
  });

  it("searches active affiliations and roles without treating removed links as active", () => {
    const organization = {
      ...NEXO_DEMO_ORGANIZACOES[0],
      id: "active",
      nome: "União Exemplo",
      sigla: "UE",
    };
    const previous = { ...organization, id: "previous", nome: "Antiga Aliança", sigla: "AA" };
    const baseLink = {
      id: "active-link",
      pessoa_id: "person-a",
      organizacao_id: organization.id,
      status: "suspeito" as const,
      funcao: "Tesouraria",
      confianca: 40,
      fonte_resumo: null,
      desde: null,
      ate: null,
      superior_vinculo_id: null,
    };
    const workspace = data({
      organizations: [organization, previous],
      people: [
        person({
          vinculos: [
            baseLink,
            {
              ...baseLink,
              id: "past-link",
              organizacao_id: previous.id,
              status: "desvinculado",
              funcao: "Ex-liderança",
            },
          ],
        }),
      ],
    });
    expect(
      searchNexoWorkspace("uniao exemplo", workspace).some(
        (result) => result.id === "person:person-a",
      ),
    ).toBe(true);
    expect(searchNexoWorkspace("tesouraria", workspace)[0].id).toBe("person:person-a");
    expect(
      searchNexoWorkspace("antiga alianca", workspace).some(
        (result) => result.target.kind === "person",
      ),
    ).toBe(false);
    expect(searchNexoWorkspace("ex-lideranca", workspace)).toEqual([]);
  });

  it("deduplicates shared linked procedures but preserves distinct BO and inquiry identities", () => {
    const bo = record();
    const inquiry = record({
      id: "ip-link",
      bo_id: null,
      inquerito_id: "bo-a",
      inquerito: { numero_ppe: "IP 300/2026", situacao: "Em andamento", tipo: "Portaria" },
      bo: null,
    });
    const records = [
      bo,
      { ...bo, id: "another-link", pessoa_id: null, organizacao_id: "org" },
      inquiry,
      { ...bo, id: "orphan", bo_id: null },
    ];
    expect(uniqueNexoProcedureRecords(records)).toEqual([bo, inquiry]);
    const results = searchNexoWorkspace("2026", data({ records }));
    expect(results.filter((result) => result.target.kind === "procedure")).toHaveLength(2);
    expect(results.map((result) => result.target)).toContainEqual({
      kind: "procedure",
      id: "bo-a",
      type: "inquerito",
    });
  });

  it("finds territory context and returns its faction dossier target", () => {
    const territory = {
      ...NEXO_DEMO_TERRITORIOS[0],
      id: "area-a",
      bairro: "São Cristóvão",
      logradouro: "Rua das Flores",
    };
    const workspace = data({ territories: [territory], organizations: NEXO_DEMO_ORGANIZACOES });
    for (const query of ["sao cristovao", "rua das flores"]) {
      const result = searchNexoWorkspace(query, workspace)[0];
      expect(result.target).toEqual({
        kind: "territory",
        id: territory.id,
        organizationId: territory.organizacao_id,
      });
      expect(result.color).toBe(NEXO_DEMO_ORGANIZACOES[0].cor);
    }
  });

  it("offers all seven sections with empty records and supports accent-insensitive section search", () => {
    expect(searchNexoWorkspace("", data())).toHaveLength(7);
    expect(searchNexoWorkspace("inteligencia", data())[0].target).toEqual({
      kind: "view",
      view: "inteligencia",
    });
  });

  it("ranks exact and prefix names before descriptive matches, with deterministic limits", () => {
    const workspace = data({
      people: [
        person({ id: "contains", nome: "Fulano", apelido: "Farol" }),
        person({ id: "prefix", nome: "Farol da Silva" }),
        person({ id: "exact", nome: "Farol" }),
      ],
    });
    expect(searchNexoWorkspace("farol", workspace, 2).map((result) => result.target)).toEqual([
      { kind: "person", id: "exact" },
      { kind: "person", id: "prefix" },
    ]);
    expect(searchNexoWorkspace("inexistente", workspace)).toEqual([]);
  });
});
