import type { NexoPessoa, NexoPessoaInput } from "./nexoTypes";

export interface NexoPossibleDuplicate {
  person: NexoPessoa;
  reasons: string[];
}

function normalizedText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function normalizedDocument(value: string | null | undefined) {
  return normalizedText(value);
}

export function findPossibleNexoPersonDuplicates(
  input: NexoPessoaInput,
  people: NexoPessoa[],
): NexoPossibleDuplicate[] {
  const cpf = normalizedDocument(input.cpf);
  const rg = normalizedDocument(input.rg);
  const name = normalizedText(input.nome);
  const mother = normalizedText(input.nome_mae);
  const father = normalizedText(input.nome_pai);

  return people.flatMap((person) => {
    const reasons: string[] = [];
    if (cpf && cpf === normalizedDocument(person.cpf)) reasons.push("mesmo CPF");
    if (rg && rg === normalizedDocument(person.rg)) reasons.push("mesmo RG");

    if (name && name === normalizedText(person.nome)) {
      if (
        input.data_nascimento &&
        person.data_nascimento &&
        input.data_nascimento === person.data_nascimento
      )
        reasons.push("mesmo nome e nascimento");
      else if (mother && mother === normalizedText(person.nome_mae))
        reasons.push("mesmo nome e filiação materna");
      else if (father && father === normalizedText(person.nome_pai))
        reasons.push("mesmo nome e filiação paterna");
    }

    return reasons.length ? [{ person, reasons }] : [];
  });
}
