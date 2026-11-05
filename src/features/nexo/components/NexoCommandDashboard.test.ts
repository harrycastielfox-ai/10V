import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  NEXO_DEMO_ORGANIZACOES,
  NEXO_DEMO_PESSOAS,
  NEXO_DEMO_REGISTROS,
  NEXO_DEMO_TERRITORIOS,
} from "../nexoDemoData";
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
    expect(html).toContain("Cadastrar pessoa");
    expect(html).toContain("Cadastrar facção");
    for (const label of ["Pessoas", "Facções", "Áreas", "Procedimentos"])
      expect(indicator(html, label)).toBe(0);
    expect(html).toContain("0 vínculos atuais registrados");
    expect(html).toContain("Mapa territorial");
    expect(html).toContain("Mapa territorial da Central NEXO");
    expect(html).toContain("0 áreas registradas");
    expect(html).toContain("As áreas registradas nos dossiês aparecem aqui");
    expect(html).not.toContain("Pendências cadastrais");
    expect(html).not.toContain("Configurar relatório");
    expect(html).not.toContain("Acesso rápido");
    expect(html).not.toContain("Cadastros recentes");
  });

  it("apresenta no mapa as facções com áreas registradas e suas cores", () => {
    const html = render({
      ...empty,
      organizations: NEXO_DEMO_ORGANIZACOES,
      territories: NEXO_DEMO_TERRITORIOS,
    });
    expect(html).toContain("Áreas registradas por facção");
    expect(html).toContain("Grupo Atlas");
    expect(html).toContain("GAT");
    expect(html).toContain("Núcleo Norte");
    expect(html).toContain("NN");
    expect(html).toContain("#ef4444");
    expect(html).toContain("#f59e0b");
    expect(indicator(html, "Áreas")).toBe(NEXO_DEMO_TERRITORIOS.length);
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

  it("exclui desvinculados da contagem de conexões atuais", () => {
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
    expect(html).not.toContain("3 vínculos atuais registrados");
  });
});
