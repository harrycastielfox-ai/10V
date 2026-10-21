import { describe, expect, it } from "vitest";
import type { NexoPessoaInput } from "./nexoTypes";
import {
  applyNexoPdfCandidates,
  applyNexoPdfPhotoSelection,
  defaultNexoPdfSelections,
  suggestNexoPdfFields,
  type NexoPdfTextCell,
} from "./nexoPdfImport";

function cell(text: string, x: number, y: number): NexoPdfTextCell {
  return { text, x, y, width: Math.max(text.length * 4, 10) };
}

describe("sugestões de cadastro a partir de PDF", () => {
  it("lê identidade em fontes distintas e mantém a origem e a página de cada valor", () => {
    const found = suggestNexoPdfFields([
      {
        page: 1,
        cells: [
          cell("NIMBA", 10, 750),
          cell("Nome", 10, 700),
          cell("CPF", 260, 700),
          cell("Pessoa Fictícia", 10, 682),
          cell("123.456.789-00", 260, 682),
          cell("Data de Nascimento", 10, 650),
          cell("01/02/1990", 10, 632),
        ],
      },
      {
        page: 2,
        cells: [
          cell("Receita Federal", 10, 750),
          cell("Nome", 10, 700),
          cell("Pessoa Fictícia", 10, 682),
        ],
      },
    ]);
    expect(found.filter((item) => item.field === "nome")).toEqual([
      expect.objectContaining({ value: "Pessoa Fictícia", source: "NIMBA", page: 1 }),
      expect.objectContaining({ value: "Pessoa Fictícia", source: "Receita Federal", page: 2 }),
    ]);
    expect(found).toContainEqual(
      expect.objectContaining({ field: "data_nascimento", value: "1990-02-01" }),
    );
    expect(found).toContainEqual(
      expect.objectContaining({ field: "cpf", value: "123.456.789-00" }),
    );
  });

  it("não mistura páginas de ocorrência ou veículo à ficha da pessoa", () => {
    const found = suggestNexoPdfFields([
      {
        page: 1,
        cells: [cell("SIGIP", 10, 750), cell("Nome", 10, 700), cell("Outra Pessoa", 10, 682)],
      },
      {
        page: 2,
        cells: [
          cell("RENAVAM", 10, 750),
          cell("Nome", 10, 700),
          cell("Proprietário Teste", 10, 682),
        ],
      },
    ]);
    expect(found).toEqual([]);
  });

  it("não pré-seleciona fontes contraditórias para o mesmo campo", () => {
    const candidates = [
      {
        id: "1",
        field: "nome" as const,
        label: "Nome",
        value: "Pessoa Fictícia",
        page: 1,
        source: "NIMBA",
        confidence: "alta" as const,
      },
      {
        id: "2",
        field: "nome" as const,
        label: "Nome",
        value: "Outra Pessoa",
        page: 2,
        source: "Receita Federal",
        confidence: "alta" as const,
      },
      {
        id: "3",
        field: "cpf" as const,
        label: "CPF",
        value: "123.456.789-00",
        page: 1,
        source: "NIMBA",
        confidence: "alta" as const,
      },
      {
        id: "4",
        field: "rg" as const,
        label: "RG",
        value: "12.345-6",
        page: 1,
        source: "NIMBA",
        confidence: "revisar" as const,
      },
    ];
    expect(defaultNexoPdfSelections(candidates)).toEqual({ cpf: "3" });
  });

  it("descarta campos colados ou inválidos, sem preencher automaticamente um RG duvidoso", () => {
    const found = suggestNexoPdfFields([
      {
        page: 1,
        cells: [
          cell("NIMBA", 10, 750),
          cell("RG", 10, 700),
          cell("Sexo", 260, 700),
          cell("123456789012345678", 10, 682),
          cell("Masculino Outros dados", 260, 682),
          cell("Telefone", 10, 650),
          cell("(73) 99999-0000", 10, 632),
        ],
      },
    ]);
    expect(found.map((item) => item.field)).toEqual(["telefone"]);
    expect(found[0].confidence).toBe("revisar");
  });

  it("aplica somente valores selecionados e deixa a procedência para auditoria", () => {
    const person = {
      nome: "",
      cpf: "",
      observacoes: "",
      fonte_resumo: "",
      documentos_extras: [],
      endereco: { logradouro: "", numero: "", bairro: "", municipio: "Itabela", uf: "BA" },
    } as unknown as NexoPessoaInput;
    const result = applyNexoPdfCandidates(
      person,
      [
        {
          id: "1",
          field: "nome",
          label: "Nome completo",
          value: "Pessoa Fictícia",
          page: 1,
          source: "NIMBA",
          confidence: "alta",
        },
        {
          id: "2",
          field: "endereco.municipio",
          label: "Município",
          value: "Cidade Teste",
          page: 1,
          source: "NIMBA",
          confidence: "revisar",
        },
      ],
      "modelo.pdf",
    );
    expect(result.nome).toBe("Pessoa Fictícia");
    expect(result.endereco.municipio).toBe("Cidade Teste");
    expect(result.fonte_resumo).toContain("modelo.pdf");
    expect(result.fonte_resumo).toContain("O original será preservado com hash");
    expect(result.observacoes).toContain(
      'Importação revisada do PDF "modelo.pdf": 2 campo(s) confirmado(s); fonte(s): NIMBA; página(s): 1.',
    );
    expect(result.observacoes).not.toContain("Nome completo (NIMBA, p. 1)");
  });

  it("aplica uma foto de perfil revisada também ao relatório", () => {
    const file = new File(["imagem"], "retrato.png", { type: "image/png" });
    const person = {
      nome: "Pessoa Fictícia",
      observacoes: "Observação anterior",
      foto_perfil: null,
      foto_relatorio: null,
    } as unknown as NexoPessoaInput;

    const result = applyNexoPdfPhotoSelection(person, {
      candidate: {
        id: "1:img-1",
        page: 2,
        width: 320,
        height: 420,
        file,
        previewUrl: "blob:preview",
      },
      target: "perfil",
    });

    expect(result.foto_perfil).toBe(file);
    expect(result.foto_relatorio).toBe(file);
    expect(result.observacoes).toContain("página 2");
    expect(result.observacoes).toContain("foto de perfil");
  });

  it("mantém a foto de perfil vazia quando a finalidade revisada é somente relatório", () => {
    const file = new File(["imagem"], "anexo.png", { type: "image/png" });
    const person = {
      nome: "Pessoa Fictícia",
      observacoes: "",
      foto_perfil: null,
      foto_relatorio: null,
    } as unknown as NexoPessoaInput;

    const result = applyNexoPdfPhotoSelection(person, {
      candidate: {
        id: "1:img-2",
        page: 3,
        width: 640,
        height: 480,
        file,
        previewUrl: "blob:preview",
      },
      target: "relatorio",
    });

    expect(result.foto_perfil).toBeNull();
    expect(result.foto_relatorio).toBe(file);
  });

  it("não altera fotos quando o operador escolhe não importar", () => {
    const profile = new File(["perfil"], "perfil.jpg", { type: "image/jpeg" });
    const person = {
      nome: "Pessoa Fictícia",
      observacoes: "",
      foto_perfil: profile,
      foto_relatorio: profile,
    } as unknown as NexoPessoaInput;

    const result = applyNexoPdfPhotoSelection(person, null);

    expect(result).toBe(person);
    expect(result.foto_perfil).toBe(profile);
    expect(result.foto_relatorio).toBe(profile);
  });
});
