import { describe, expect, it } from "vitest";
import { parseTipificacoes } from "@/lib/tipificacaoParser";

const longSingle =
  "20264: MORTE POR INTERVENÇÃO DE AGENTE DE SEGURANÇA PÚBLICA, DO SISTEMA PRISIONAL OU DE OUTROS ÓRGÃOS PÚBLICOS NO EXERCÍCIO DA FUNÇÃO POLICIAL, EM SERVIÇO OU EM RAZÃO DELE, DESDE QUE A AÇÃO TENHA SIDO PRATICADA SOB QUAISQUER DAS HIPÓTESES DE EXCLUSÃO DE ILICITUDE";
const combined =
  "23021: LESIONAR MULHER (VIOLÊNCIA DOMÉSTICA CONTRA A MULHER), 23024: AMEAÇAR MULHER (VIOLÊNCIA DOMÉSTICA CONTRA A MULHER)";

describe("parseTipificacoes", () => {
  it.each([null, undefined, "", "   "])("retorna vazio para %s", (value) => {
    expect(parseTipificacoes(value)).toEqual([]);
  });

  it("preserva as vírgulas internas de uma única tipificação", () => {
    const result = parseTipificacoes(longSingle);
    expect(result).toHaveLength(1);
    expect(result[0].codigo).toBe("20264");
    expect(result[0].rotulo.length).toBeLessThanOrEqual(300);
  });

  it("separa somente quando a vírgula é seguida por outro código", () => {
    expect(parseTipificacoes(combined).map((item) => item.codigo)).toEqual(["23021", "23024"]);
  });

  it("preserva texto livre antigo", () => {
    expect(parseTipificacoes("ROUBO")).toMatchObject([{ codigo: null, descricao: "ROUBO" }]);
  });

  it("deduplica pelo código e mantém a ordem", () => {
    const result = parseTipificacoes("57: AMEAÇA, 21: LESÃO, 57: AMEAÇA REPETIDA");
    expect(result.map((item) => item.slug)).toEqual(["tip-57", "tip-21"]);
  });

  it("reconhece duas descrições coladas quando ambas existem no catálogo", () => {
    const labels = [
      "PORTE ILEGAL DE ARMA DE FOGO - ESTATUTO DO DESARMAMENTO",
      "AMEAÇAR MULHER, POR RAZÕES DA CONDIÇÃO DO SEXO FEMININO",
    ];
    const raw = `${labels[0]}${labels[1]}`;
    expect(parseTipificacoes(raw, labels).map((item) => item.descricao)).toEqual(labels);
  });

  it("mantém todos os rótulos dentro do limite do banco", () => {
    for (const item of [...parseTipificacoes(longSingle), ...parseTipificacoes(combined)]) {
      expect(item.rotulo.length).toBeGreaterThanOrEqual(2);
      expect(item.rotulo.length).toBeLessThanOrEqual(300);
    }
  });
});
