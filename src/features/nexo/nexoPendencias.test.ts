import { describe, expect, it } from "vitest";
import { NEXO_DEMO_PESSOAS, NEXO_DEMO_TERRITORIOS } from "./nexoDemoData";
import { filterNexoPendingItems, listNexoPendingCategories } from "./nexoPendencias";

describe("pendências cadastrais do NEXO", () => {
  it("calcula categorias por registro sem transformar ausência em fato negativo", () => {
    const person = {
      ...NEXO_DEMO_PESSOAS[0],
      id: "pending-1",
      nome: "Pessoa sem pendências",
      cpf: null,
      rg: null,
      foto_perfil_url: null,
      foto_perfil_path: null,
      foto_relatorio_path: null,
      fotos: [],
      endereco: null,
      vinculos: [],
    };
    const categories = listNexoPendingCategories([person], NEXO_DEMO_TERRITORIOS);
    const photo = categories.find((item) => item.category === "foto_perfil")!;
    const identification = categories.find((item) => item.category === "identificacao")!;
    expect(photo.items).toHaveLength(1);
    expect(photo.items[0].severity).toBe("recomendacao");
    expect(identification.items).toHaveLength(1);
    expect(identification.items[0].detail).toContain("não informados");
  });

  it("não conta vínculos encerrados como pendências atuais", () => {
    const person = {
      ...NEXO_DEMO_PESSOAS[0],
      id: "historical-only",
      vinculos: personLinks("desvinculado"),
    };
    const categories = listNexoPendingCategories([person], []);
    expect(categories.find((item) => item.category === "fonte_vinculo")?.items).toEqual([]);
    expect(categories.find((item) => item.category === "confirmacao_vinculo")?.items).toEqual([]);
  });

  it("identifica duplicidade somente com documento forte ou nome e nascimento", () => {
    const first = { ...NEXO_DEMO_PESSOAS[0], id: "first", cpf: "123.456.789-00" };
    const second = { ...NEXO_DEMO_PESSOAS[1], id: "second", cpf: "12345678900" };
    const categories = listNexoPendingCategories([first, second], []);
    const duplicates = categories.find((item) => item.category === "duplicidade")!.items;
    expect(duplicates).toHaveLength(2);
    expect(duplicates[0].detail).toContain("mesmo CPF");
  });

  it("filtra pela pessoa e pelo contexto da pendência", () => {
    const categories = listNexoPendingCategories([NEXO_DEMO_PESSOAS[0]], []);
    const items = categories.flatMap((item) => item.items);
    expect(filterNexoPendingItems(items, NEXO_DEMO_PESSOAS[0].nome)).not.toHaveLength(0);
    expect(filterNexoPendingItems(items, "texto que não existe")).toEqual([]);
  });
});

function personLinks(status: "desvinculado") {
  return NEXO_DEMO_PESSOAS[0].vinculos.map((link) => ({
    ...link,
    status,
    fonte_resumo: null,
  }));
}
