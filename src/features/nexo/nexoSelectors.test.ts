import { describe, expect, it } from "vitest";
import { selectNexoPeople, selectNexoRecords } from "./nexoSelectors";
import type { NexoPessoa, NexoRegistroVinculado } from "./nexoTypes";

const people = [
  { id: "person-a", vinculos: [{ organizacao_id: "group-a" }] },
  { id: "person-b", vinculos: [{ organizacao_id: "group-b" }] },
  { id: "person-c", vinculos: [] },
] as NexoPessoa[];
const records = [
  { id: "a-bo", pessoa_id: "person-a", organizacao_id: null },
  { id: "b-ip", pessoa_id: "person-b", organizacao_id: null },
  { id: "a-group-ip", pessoa_id: null, organizacao_id: "group-a" },
  { id: "b-group-bo", pessoa_id: null, organizacao_id: "group-b" },
] as NexoRegistroVinculado[];

describe("recortes de relatórios do NEXO", () => {
  it("inclui somente procedimentos ligados diretamente à pessoa no PDF individual", () => {
    expect(
      selectNexoRecords({ kind: "pessoa", pessoaId: "person-a" }, people, records).map(
        (item) => item.id,
      ),
    ).toEqual(["a-bo"]);
  });

  it("inclui membros e seus procedimentos, além dos vinculados ao grupo", () => {
    const scope = { kind: "organizacao" as const, organizacaoId: "group-a" };
    expect(selectNexoPeople(scope, people).map((item) => item.id)).toEqual(["person-a"]);
    expect(selectNexoRecords(scope, people, records).map((item) => item.id)).toEqual([
      "a-bo",
      "a-group-ip",
    ]);
  });

  it("mantém o relatório geral completo", () => {
    expect(selectNexoRecords({ kind: "geral" }, people, records)).toEqual(records);
  });
});
