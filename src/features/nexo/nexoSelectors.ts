import type { NexoPessoa, NexoRegistroVinculado, NexoReportScope } from "./nexoTypes";

export function getNexoPersonPhotoUrl(person: NexoPessoa) {
  return (
    person.foto_perfil_url ||
    person.foto_relatorio_url ||
    person.fotos.find((photo) => photo.url)?.url ||
    null
  );
}

export function selectNexoPeople(scope: NexoReportScope, people: NexoPessoa[]) {
  if (scope.kind === "pessoa") return people.filter((person) => person.id === scope.pessoaId);
  if (scope.kind === "organizacao") {
    return people.filter((person) =>
      person.vinculos.some((link) => link.organizacao_id === scope.organizacaoId),
    );
  }
  return people;
}

export function selectNexoRecords(
  scope: NexoReportScope,
  people: NexoPessoa[],
  records: NexoRegistroVinculado[],
) {
  if (scope.kind === "geral") return records;
  if (scope.kind === "pessoa") {
    return records.filter((record) => record.pessoa_id === scope.pessoaId);
  }
  const memberIds = new Set(selectNexoPeople(scope, people).map((person) => person.id));
  return records.filter(
    (record) =>
      record.organizacao_id === scope.organizacaoId ||
      (record.pessoa_id !== null && memberIds.has(record.pessoa_id)),
  );
}
