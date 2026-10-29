import { describe, expect, it } from "vitest";
import type { NexoPessoa, NexoVinculo } from "./nexoTypes";
import {
  buildNexoOrganogram,
  getNexoOrganogramAncestors,
  getVisibleNexoOrganogram,
  searchNexoOrganogram,
} from "./nexoOrganogram";

const ORGANIZATION_ID = "org-sintetica";

function link(
  id: string,
  pessoaId: string,
  superiorId: string | null = null,
  overrides: Partial<NexoVinculo> = {},
): NexoVinculo {
  return {
    id,
    pessoa_id: pessoaId,
    organizacao_id: ORGANIZATION_ID,
    status: "confirmado",
    funcao: "Integrante",
    confianca: 70,
    fonte_resumo: "Fonte sintética revisada",
    desde: "2026-01-01",
    ate: null,
    superior_vinculo_id: superiorId,
    ...overrides,
  };
}

function person(
  id: string,
  nome: string,
  apelido: string | null,
  vinculos: NexoVinculo[],
): NexoPessoa {
  return {
    id,
    nome,
    apelido,
    cpf: null,
    rg: null,
    data_nascimento: null,
    naturalidade: null,
    nome_mae: null,
    nome_pai: null,
    nome_social: null,
    sexo: null,
    raca_cor: null,
    estado_civil: null,
    nacionalidade: "Brasileira",
    escolaridade: null,
    profissao: null,
    idade_aproximada: false,
    idade_aproximada_valor: null,
    em_situacao_rua: false,
    usa_tornozeleira: false,
    altura_cm: null,
    tipo_fisico: null,
    estado_aparente: null,
    sinais_particulares: null,
    documentos_extras: [],
    contatos: [],
    telefone: null,
    observacoes: null,
    foto_perfil_path: null,
    foto_relatorio_path: null,
    endereco_id: null,
    usar_local_faccao: false,
    endereco: null,
    vinculos,
    fotos: [],
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("projeção do organograma NEXO", () => {
  it("centraliza a raiz sobre ramificações de tamanhos diferentes", () => {
    const people = [
      person("r", "Raiz", null, [link("r", "r")]),
      person("a", "A", null, [link("a", "a", "r")]),
      person("b", "B", null, [link("b", "b", "r")]),
      ...["c", "d", "e"].map((id) => person(id, id, null, [link(id, id, "a")])),
    ];
    const model = buildNexoOrganogram(ORGANIZATION_ID, people);
    expect(model.membersById.get("r")?.position.x).toBe(540);
    expect(model.membersById.get("a")?.position.x).toBe(360);
    expect(model.membersById.get("b")?.position.x).toBe(1080);
  });

  it("inclui integrantes comuns, múltiplas ramificações e exclui vínculos encerrados", () => {
    const people = [
      person("p-raiz", "Pessoa Raiz", "Raiz", [link("v-raiz", "p-raiz")]),
      person("p-a", "Pessoa A", null, [link("v-a", "p-a", "v-raiz")]),
      person("p-b", "Pessoa B", null, [link("v-b", "p-b", "v-raiz")]),
      person("p-c", "Pessoa C", null, [link("v-c", "p-c", "v-a")]),
      person("p-fim", "Pessoa Encerrada", null, [
        link("v-fim", "p-fim", null, { status: "desvinculado" }),
      ]),
    ];

    const model = buildNexoOrganogram(ORGANIZATION_ID, people);

    expect(model.members.map((member) => member.id)).toEqual(["v-a", "v-b", "v-c", "v-raiz"]);
    expect(model.rootIds).toEqual(["v-raiz"]);
    expect(model.membersById.get("v-raiz")?.childIds).toEqual(["v-a", "v-b"]);
    expect(model.membersById.get("v-c")?.depth).toBe(3);
    expect(model.membersById.get("v-c")?.position.y).toBeGreaterThan(
      model.membersById.get("v-a")?.position.y ?? 0,
    );
    expect(model.membersById.get("v-a")?.position.x).not.toBe(
      model.membersById.get("v-b")?.position.x,
    );
    expect(model.membersById.has("v-fim")).toBe(false);
  });

  it("agrupa como posição não determinada quem não tem superior válido sem inferir liderança", () => {
    const people = [
      person("p-cargo", "Pessoa com Cargo", "Coordenação", [
        link("v-cargo", "p-cargo", null, { funcao: "Liderança local" }),
      ]),
      person("p-invalida", "Pessoa Referência Inválida", null, [
        link("v-invalida", "p-invalida", "v-inexistente"),
      ]),
      person("p-outra", "Pessoa Outra Org", null, [
        link("v-outra", "p-outra", "v-fora"),
        link("v-fora", "p-outra", null, { organizacao_id: "org-outra" }),
      ]),
    ];

    const model = buildNexoOrganogram(ORGANIZATION_ID, people);

    expect(model.rootIds).toEqual(["v-cargo", "v-invalida", "v-outra"]);
    expect(model.membersById.get("v-cargo")?.positionKind).toBe("undetermined");
    expect(model.membersById.get("v-invalida")?.positionKind).toBe("undetermined");
    expect(model.membersById.get("v-cargo")?.isLeadership).toBe(false);
  });

  it("mantém todos os registros visíveis quando encontra ciclo legado", () => {
    const people = [
      person("p-a", "Pessoa A", null, [link("v-a", "p-a", "v-b")]),
      person("p-b", "Pessoa B", null, [link("v-b", "p-b", "v-a")]),
    ];

    const model = buildNexoOrganogram(ORGANIZATION_ID, people);

    expect(model.members).toHaveLength(2);
    expect(model.rootIds).toEqual(["v-a", "v-b"]);
    expect(model.members.every((member) => member.positionKind === "undetermined")).toBe(true);
  });

  it("usa o vínculo como identidade quando a mesma pessoa possui dois registros atuais", () => {
    const people = [
      person("p-duplicada", "Pessoa Duplicada", null, [
        link("v-1", "p-duplicada"),
        link("v-2", "p-duplicada"),
      ]),
    ];

    const model = buildNexoOrganogram(ORGANIZATION_ID, people);

    expect(model.members.map((member) => member.id)).toEqual(["v-1", "v-2"]);
    expect(model.rootIds).toEqual(["v-1", "v-2"]);
  });

  it("preserva o vínculo atual quando um registro anterior da mesma organização foi encerrado", () => {
    const people = [
      person("p-retorno", "Pessoa Retornada", null, [
        link("v-antigo", "p-retorno", null, { status: "desvinculado" }),
        link("v-atual", "p-retorno"),
      ]),
    ];

    const model = buildNexoOrganogram(ORGANIZATION_ID, people);

    expect(model.members.map((member) => member.id)).toEqual(["v-atual"]);
  });

  it("busca nome ou alcunha sem depender de caixa ou acentos e informa ancestrais", () => {
    const people = [
      person("p-raiz", "Álvaro Sintético", "Comando Um", [link("v-raiz", "p-raiz")]),
      person("p-filha", "Bia Sintética", "Falcão", [link("v-filha", "p-filha", "v-raiz")]),
      person("p-neta", "Célia Sintética", "Eco", [link("v-neta", "p-neta", "v-filha")]),
    ];
    const model = buildNexoOrganogram(ORGANIZATION_ID, people);

    expect(searchNexoOrganogram(model, "falcao")).toEqual(["v-filha"]);
    expect(searchNexoOrganogram(model, "ALVARO")).toEqual(["v-raiz"]);
    expect(getNexoOrganogramAncestors(model, "v-neta")).toEqual(["v-raiz", "v-filha"]);
  });

  it("recolhe somente os descendentes da ramificação escolhida", () => {
    const people = [
      person("p-raiz", "Pessoa Raiz", null, [link("v-raiz", "p-raiz")]),
      person("p-a", "Pessoa A", null, [link("v-a", "p-a", "v-raiz")]),
      person("p-b", "Pessoa B", null, [link("v-b", "p-b", "v-raiz")]),
      person("p-c", "Pessoa C", null, [link("v-c", "p-c", "v-a")]),
    ];
    const model = buildNexoOrganogram(ORGANIZATION_ID, people);

    expect(getVisibleNexoOrganogram(model, new Set(["v-a"]))).toEqual(["v-raiz", "v-a", "v-b"]);
    expect(getVisibleNexoOrganogram(model, new Set(["v-raiz"]))).toEqual(["v-raiz"]);
  });
});
