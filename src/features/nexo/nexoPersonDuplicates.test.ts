import { describe, expect, it } from "vitest";
import type { NexoPessoa, NexoPessoaInput } from "./nexoTypes";
import { findPossibleNexoPersonDuplicates } from "./nexoPersonDuplicates";

const person = {
  id: "person-1",
  nome: "João da Silva",
  cpf: "123.456.789-00",
  rg: "12.345-6",
  data_nascimento: "1990-02-03",
  nome_mae: "Maria da Silva",
  nome_pai: null,
} as NexoPessoa;

const input = {
  nome: "Outra pessoa",
  cpf: "",
  rg: "",
  data_nascimento: "",
  nome_mae: "",
  nome_pai: "",
} as NexoPessoaInput;

describe("findPossibleNexoPersonDuplicates", () => {
  it("encontra documento igual mesmo com formatação diferente", () => {
    const [match] = findPossibleNexoPersonDuplicates({ ...input, cpf: "12345678900" }, [person]);
    expect(match.reasons).toEqual(["mesmo CPF"]);
  });

  it("encontra identidade pelo nome, nascimento ou filiação", () => {
    const matches = findPossibleNexoPersonDuplicates(
      { ...input, nome: "Joao da Silva", data_nascimento: "1990-02-03" },
      [person],
    );
    expect(matches[0].reasons).toContain("mesmo nome e nascimento");
  });

  it("não sinaliza apenas nomes iguais sem outro dado forte", () => {
    expect(findPossibleNexoPersonDuplicates({ ...input, nome: person.nome }, [person])).toEqual([]);
  });
});
