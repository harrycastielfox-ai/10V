import { describe, expect, it } from "vitest";
import type { NexoOrganizacao, NexoPessoa } from "./nexoTypes";
import { buildIntelligenceNetwork } from "./nexoIntelligenceNetwork";

const organizations = [
  { id: "a", nome: "Grupo Águia", sigla: "GA" },
  { id: "b", nome: "Núcleo Norte" },
] as NexoOrganizacao[];
const people = [
  {
    id: "p1",
    nome: "Ana",
    apelido: "Alfa",
    vinculos: [
      { id: "l1", organizacao_id: "a", status: "confirmado", funcao: "Liderança" },
      { id: "l2", organizacao_id: "b", status: "desvinculado" },
    ],
  },
  { id: "p2", nome: "Bruno", vinculos: [{ id: "l3", organizacao_id: "a", status: "suspeito" }] },
] as NexoPessoa[];
const defaults = { query: "", faction: "", status: "active" as const, focus: null };

describe("intelligence network exploration", () => {
  it("excludes detached relationships by default and shows them only when requested", () => {
    const graph = buildIntelligenceNetwork(organizations, people, defaults);
    expect(graph.flatMap((item) => item.members).map((item) => item.link.id)).toEqual(["l1", "l3"]);
    expect(
      buildIntelligenceNetwork(organizations, people, { ...defaults, status: "desvinculado" })
        .flatMap((item) => item.members)
        .map((item) => item.link.id),
    ).toEqual(["l2"]);
  });
  it("finds a faction without accents and keeps its matching members available", () => {
    expect(
      buildIntelligenceNetwork(organizations, people, { ...defaults, query: "aguia" }).map(
        (item) => [item.organization.id, item.members.length],
      ),
    ).toEqual([["a", 2]]);
    expect(
      buildIntelligenceNetwork(organizations, people, { ...defaults, query: "alfa" })
        .flatMap((item) => item.members)
        .map((item) => item.person.id),
    ).toEqual(["p1"]);
  });
  it("focuses a selected person while retaining only allowed relationship statuses", () => {
    const graph = buildIntelligenceNetwork(organizations, people, {
      ...defaults,
      focus: { kind: "person", id: "p1" },
    });
    expect(graph.map((item) => item.organization.id)).toEqual(["a"]);
    expect(graph[0].members.map((item) => item.person.id)).toEqual(["p1"]);
  });
});
