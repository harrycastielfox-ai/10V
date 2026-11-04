import { describe, expect, it } from "vitest";
import { formatNexoLinkRoleLocation } from "./nexoLinkLocation";
import type { NexoVinculo } from "./nexoTypes";

const baseLink: NexoVinculo = {
  id: "v-sintetico",
  organizacao_id: "o-sintetica",
  pessoa_id: "p-sintetica",
  status: "confirmado",
  funcao: "Líder",
  confianca: 95,
  fonte_resumo: "Fonte sintética",
  desde: null,
  ate: null,
  superior_vinculo_id: null,
  municipio_atuacao: "Eunápolis",
  uf_atuacao: "BA",
};

describe("formatNexoLinkRoleLocation", () => {
  it("combina cargo, município e UF sem usar o endereço residencial", () => {
    expect(formatNexoLinkRoleLocation(baseLink)).toBe("Líder · Eunápolis/BA");
  });

  it("omite separadores vazios em vínculos antigos ou parcialmente preenchidos", () => {
    expect(
      formatNexoLinkRoleLocation({
        ...baseLink,
        municipio_atuacao: null,
        uf_atuacao: null,
      }),
    ).toBe("Líder");
    expect(
      formatNexoLinkRoleLocation({
        ...baseLink,
        funcao: null,
        municipio_atuacao: "Porto Seguro",
        uf_atuacao: null,
      }),
    ).toBe("Função não informada · Porto Seguro");
    expect(
      formatNexoLinkRoleLocation({
        ...baseLink,
        municipio_atuacao: null,
        uf_atuacao: "BA",
      }),
    ).toBe("Líder · BA");
  });
});
