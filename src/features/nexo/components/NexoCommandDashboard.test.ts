import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NEXO_DEMO_ORGANIZACOES, NEXO_DEMO_PESSOAS, NEXO_DEMO_REGISTROS } from "../nexoDemoData";
import type { NexoWorkspaceSearchData } from "../nexoWorkspaceSearch";
import { NexoCommandDashboard } from "./NexoCommandDashboard";

const empty: NexoWorkspaceSearchData = {
  organizations: [],
  people: [],
  territories: [],
  records: [],
};
const noop = () => undefined;

function render(data: NexoWorkspaceSearchData = empty) {
  return renderToStaticMarkup(
    createElement(NexoCommandDashboard, {
      data,
      onCreatePerson: noop,
      onCreateOrganization: noop,
      onNavigate: noop,
      onOpen: noop,
      onSearch: noop,
    }),
  );
}

function indicator(html: string, label: string) {
  const pattern = new RegExp(`<strong[^>]*>(\\d+)</strong><span[^>]*>${label}</span>`);
  const match = html.match(pattern);
  if (!match) throw new Error(`Indicador não encontrado: ${label}`);
  return Number(match[1]);
}

describe("panorama da Central NEXO", () => {
  it("explica o estado vazio e oferece cadastro sem inventar contagens", () => {
    const html = render();
    expect(html).toContain("Nenhum cadastro ainda. Comece por uma pessoa ou facção.");
    expect(html).toContain("Cadastrar pessoa");
    expect(html).toContain("Cadastrar facção");
    for (const label of ["Pessoas", "Facções", "Áreas", "Procedimentos"])
      expect(indicator(html, label)).toBe(0);
    expect(html).toContain("0 vínculos atuais registrados");
  });

  it("conta o mesmo B.O. uma vez mesmo vinculado a vários alvos", () => {
    const bo = NEXO_DEMO_REGISTROS.find((record) => record.bo_id)!;
    const html = render({
      ...empty,
      records: [
        bo,
        { ...bo, id: "duplicate-link", pessoa_id: "other-person", organizacao_id: null },
      ],
    });
    expect(indicator(html, "Procedimentos")).toBe(1);
    expect(html).toContain("não representam o total de crimes");
  });

  it("conta B.O. e inquérito separadamente, mesmo com o mesmo identificador de texto", () => {
    const bo = NEXO_DEMO_REGISTROS.find((record) => record.bo_id)!;
    const html = render({
      ...empty,
      records: [
        { ...bo, bo_id: "shared-id", inquerito_id: null },
        { ...bo, id: "ip-link", bo_id: null, inquerito_id: "shared-id" },
        { ...bo, id: "ip-duplicate", bo_id: null, inquerito_id: "shared-id" },
        { ...bo, id: "invalid-target", bo_id: null, inquerito_id: null },
      ],
    });
    expect(indicator(html, "Procedimentos")).toBe(2);
  });

  it("exclui desvinculados das conexões atuais e da revisão de fontes", () => {
    const person = NEXO_DEMO_PESSOAS[0];
    const link = person.vinculos[0];
    const html = render({
      ...empty,
      people: [
        {
          ...person,
          vinculos: [
            { ...link, id: "confirmed", status: "confirmado", fonte_resumo: " " },
            { ...link, id: "probable", status: "provavel", fonte_resumo: "Fonte registrada" },
            { ...link, id: "historical", status: "desvinculado", fonte_resumo: null },
          ],
        },
      ],
    });
    expect(html).toContain("2 vínculos atuais registrados");
    expect(html).toMatch(/<strong[^>]*>1<\/strong><span[^>]*>Fonte do vínculo<\/span>/);
    expect(html).not.toContain("3 vínculos atuais registrados");
  });

  it("ordena cadastros mistos por criação e exibe a data de Brasília", () => {
    const person = {
      ...NEXO_DEMO_PESSOAS[0],
      nome: "Pessoa recente",
      apelido: "Alcunha recente",
      created_at: "2026-10-18T01:00:00Z",
    };
    const organization = {
      ...NEXO_DEMO_ORGANIZACOES[0],
      nome: "Organização anterior",
      sigla: "ANT",
      created_at: "2026-10-16T15:00:00Z",
    };
    const invalid = { ...person, id: "invalid", nome: "Sem data válida", created_at: "invalid" };
    const html = render({ ...empty, people: [invalid, person], organizations: [organization] });
    expect(html.indexOf("Pessoa recente")).toBeLessThan(html.indexOf("Organização anterior"));
    expect(html.indexOf("Organização anterior")).toBeLessThan(html.indexOf("Sem data válida"));
    expect(html).toContain("Alcunha recente");
    expect(html).toContain('dateTime="2026-10-18T01:00:00Z"');
    expect(html).toContain("17 de out.");
    expect(html).not.toContain('dateTime="invalid"');
    expect(html).toContain("Por data de criação");
  });

  it("limita recentes aos seis últimos, sem alterar a lista fornecida", () => {
    const people = Array.from({ length: 8 }, (_, index) => ({
      ...NEXO_DEMO_PESSOAS[0],
      id: `recent-${index}`,
      nome: `Cadastro ${index}`,
      created_at: `2026-10-${String(index + 10).padStart(2, "0")}T15:00:00Z`,
    }));
    const html = render({ ...empty, people });
    expect(html).toContain("Cadastro 7");
    expect(html).toContain("Cadastro 2");
    expect(html).not.toContain("Cadastro 1");
    expect(html).not.toContain("Cadastro 0");
    expect(html.match(/<time /g)).toHaveLength(6);
    expect(people[0].nome).toBe("Cadastro 0");
    expect(indicator(html, "Pessoas")).toBe(8);
  });

  it("escapa nomes e alcunhas no HTML, inclusive em cadastros recentes", () => {
    const html = render({
      ...empty,
      people: [
        {
          ...NEXO_DEMO_PESSOAS[0],
          nome: '<script>alert("nome")</script>',
          apelido: "<b>alcunha</b>",
        },
      ],
    });
    expect(html).toContain("&lt;script&gt;alert(&quot;nome&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;alcunha&lt;/b&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>alcunha</b>");
  });
});
