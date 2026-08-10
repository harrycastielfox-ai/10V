import { describe, expect, it } from "vitest";
import {
  getProceduralTagSearchRank,
  matchesProceduralTagQuery,
  slugifyProceduralTag,
  splitNumberedProceduralTags,
  tagsByScope,
  type ProceduralTag,
} from "./proceduralTags";

const tags: ProceduralTag[] = [
  {
    id: "1",
    scope: "tipificacao",
    name: "Furto qualificado",
    slug: "furto-qualificado",
    color: "purple",
    is_system: false,
    active: true,
    created_at: "2026-08-10T00:00:00.000Z",
    updated_at: "2026-08-10T00:00:00.000Z",
  },
  {
    id: "2",
    scope: "tipificacao",
    name: "Tag desativada",
    slug: "tag-desativada",
    color: "slate",
    is_system: false,
    active: false,
    created_at: "2026-08-10T00:00:00.000Z",
    updated_at: "2026-08-10T00:00:00.000Z",
  },
  {
    id: "3",
    scope: "inquerito_status",
    name: "Em andamento",
    slug: "em-andamento",
    color: "cyan",
    is_system: true,
    active: true,
    created_at: "2026-08-10T00:00:00.000Z",
    updated_at: "2026-08-10T00:00:00.000Z",
  },
];

describe("proceduralTags", () => {
  it("normaliza nomes para slugs estaveis", () => {
    expect(slugifyProceduralTag("  Prisão em Flagrante / CVLI  ")).toBe("prisao-em-flagrante-cvli");
  });

  it("limita o slug ao tamanho aceito pelo banco", () => {
    expect(slugifyProceduralTag("a".repeat(150))).toHaveLength(120);
  });

  it("retorna somente tags ativas do escopo solicitado", () => {
    expect(tagsByScope(tags, "tipificacao").map((tag) => tag.id)).toEqual(["1"]);
    expect(tagsByScope(tags, "inquerito_status").map((tag) => tag.id)).toEqual(["3"]);
  });

  it("localiza tipificações por número ou palavra sem exigir acentos", () => {
    const name = "4: HOMICÍDIO QUALIFICADO POR MOTIVO FÚTIL";
    expect(matchesProceduralTagQuery(name, "4")).toBe(true);
    expect(matchesProceduralTagQuery(name, "homicidio futil")).toBe(true);
    expect(matchesProceduralTagQuery(name, "latrocinio")).toBe(false);
  });

  it("prioriza o código inicial ao pesquisar somente um número", () => {
    expect(getProceduralTagSearchRank("1: HOMICÍDIO SIMPLES", "1")).toBeLessThan(
      getProceduralTagSearchRank("21: LESÃO CORPORAL (ART. 129)", "1"),
    );
  });

  it("separa somente vírgulas seguidas pelo código numérico de outra tipificação", () => {
    expect(
      splitNumberedProceduralTags(
        "4: HOMICÍDIO QUALIFICADO (ART. 121, § 2º DO CPB), 57: AMEAÇA (ART. 147 DO CPB)",
      ),
    ).toEqual(["4: HOMICÍDIO QUALIFICADO (ART. 121, § 2º DO CPB)", "57: AMEAÇA (ART. 147 DO CPB)"]);
  });
});
