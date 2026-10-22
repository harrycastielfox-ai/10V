import { describe, expect, it } from "vitest";
import { NEXO_DEMO_ORGANIZACOES, NEXO_DEMO_PESSOAS } from "../nexoDemoData";
import type { NexoPessoaInput } from "../nexoTypes";
import { previewPersonFromInput } from "./previewPersonFromInput";

const input: NexoPessoaInput = {
  nome: "Pessoa editada",
  apelido: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  naturalidade: "",
  nome_mae: "",
  nome_pai: "",
  nome_social: "",
  sexo: "",
  raca_cor: "",
  estado_civil: "",
  nacionalidade: "Brasileira",
  escolaridade: "",
  profissao: "",
  profissao_desatualizada: true,
  idade_aproximada: false,
  idade_aproximada_valor: null,
  em_situacao_rua: false,
  usa_tornozeleira: false,
  altura_cm: null,
  tipo_fisico: "",
  estado_aparente: "",
  sinais_particulares: "",
  documentos_extras: [],
  contatos: [
    {
      id: "contato-antigo",
      tipo: "Telefone celular",
      valor: "71999990000",
      whatsapp: false,
      desatualizado: true,
    },
  ],
  telefone: "71999990000",
  observacoes: "",
  endereco: {
    logradouro: "",
    numero: "",
    bairro: "",
    municipio: "Itabela",
    uf: "BA",
    ponto_referencia: "",
    como_chegar: "",
    link_navegacao: "",
    latitude: null,
    longitude: null,
  },
  organizacao_id: "",
  usar_local_faccao: false,
  vinculo_status: "confirmado",
  vinculo_funcao: "Membro",
  vinculo_confianca: 70,
  fonte_resumo: "Fonte de demonstração",
  foto_perfil: null,
  foto_relatorio: null,
  pdf_fonte: null,
};

describe("edição da pessoa no modo de demonstração", () => {
  const person = NEXO_DEMO_PESSOAS[2];
  const historical = person.vinculos[0];
  const active = person.vinculos[1];
  const organization = NEXO_DEMO_ORGANIZACOES.find((item) => item.id === active.organizacao_id)!;

  it("edita o vínculo atual sem substituir o histórico anterior", () => {
    const updated = previewPersonFromInput(
      { ...input, organizacao_id: organization.id },
      person.id,
      organization,
      person,
    );

    expect(updated.vinculos).toHaveLength(2);
    expect(updated.vinculos[0]).toEqual(historical);
    expect(updated.vinculos[1]).toMatchObject({
      id: active.id,
      status: "confirmado",
      funcao: "Membro",
      superior_vinculo_id: active.superior_vinculo_id,
    });
    expect(person.vinculos[1].status).toBe("suspeito");
  });

  it("preserva o vínculo encerrado ao transferir para outra facção", () => {
    const destination = NEXO_DEMO_ORGANIZACOES.find(
      (item) => item.id !== active.organizacao_id && item.id !== historical.organizacao_id,
    )!;
    const updated = previewPersonFromInput(
      { ...input, organizacao_id: destination.id },
      person.id,
      destination,
      person,
    );

    expect(updated.vinculos).toHaveLength(3);
    expect(updated.vinculos[0]).toEqual(historical);
    expect(updated.vinculos[1]).toMatchObject({
      id: active.id,
      status: "desvinculado",
      superior_vinculo_id: null,
    });
    expect(updated.vinculos[1].ate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(updated.vinculos[2]).toMatchObject({
      organizacao_id: destination.id,
      status: "confirmado",
    });
    expect(updated.vinculos[2].id).not.toBe(active.id);
  });

  it("mantém históricos quando a edição remove a facção atual", () => {
    const updated = previewPersonFromInput(input, person.id, undefined, person);
    expect(updated.vinculos).toHaveLength(2);
    expect(updated.vinculos[0]).toEqual(historical);
    expect(updated.vinculos[1].status).toBe("desvinculado");
  });

  it("editar uma pessoa sem vínculo ativo não reativa históricos nem muda a foto do relatório", () => {
    const existing = {
      ...person,
      vinculos: [historical],
      foto_perfil_url: "/perfil.jpg",
      foto_relatorio_url: "/relatorio.jpg",
    };
    const updated = previewPersonFromInput(input, person.id, undefined, existing);
    expect(updated.vinculos).toEqual(existing.vinculos);
    expect(updated.foto_relatorio_url).toBe("/relatorio.jpg");
    expect(updated.telefone).toBe(input.telefone);
    expect(updated.profissao_desatualizada).toBe(true);
    expect(updated.contatos[0].desatualizado).toBe(true);
  });

  it("reativa o vínculo histórico somente ao escolher explicitamente a mesma facção", () => {
    const existing = { ...person, vinculos: [historical] };
    const destination = NEXO_DEMO_ORGANIZACOES.find(
      (item) => item.id === historical.organizacao_id,
    )!;
    const updated = previewPersonFromInput(
      { ...input, organizacao_id: destination.id },
      person.id,
      destination,
      existing,
    );
    expect(updated.vinculos).toHaveLength(1);
    expect(updated.vinculos[0].id).toBe(historical.id);
    expect(updated.vinculos[0].status).toBe("confirmado");
    expect(updated.vinculos[0].ate).toBeNull();
  });
});
