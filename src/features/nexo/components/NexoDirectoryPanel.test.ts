import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  NEXO_DEMO_ORGANIZACOES,
  NEXO_DEMO_PESSOAS,
  NEXO_DEMO_REGISTROS,
  NEXO_DEMO_TERRITORIOS,
} from "../nexoDemoData";
import { NexoDirectoryPanel, type NexoDirectoryPanelProps } from "./NexoDirectoryPanel";

function renderDirectory(kind: NexoDirectoryPanelProps["kind"]) {
  return renderToStaticMarkup(
    createElement(NexoDirectoryPanel, {
      kind,
      organizations: NEXO_DEMO_ORGANIZACOES,
      people: NEXO_DEMO_PESSOAS,
      territories: NEXO_DEMO_TERRITORIOS,
      records: NEXO_DEMO_REGISTROS,
      onOpen: () => undefined,
      onCreatePerson: () => undefined,
      onCreateOrganization: () => undefined,
    }),
  );
}

describe("busca e filtros do diretório NEXO", () => {
  it("remove o painel de filtros apenas de Facções, preservando os cartões", () => {
    const html = renderDirectory("organizations");

    expect(html).not.toContain("Busca e filtros");
    expect(html).not.toContain("Busca no diretório");
    expect(html).not.toContain("Nome, sigla ou área de atuação...");
    expect(html).not.toContain("Situação registrada");
    expect(html).not.toContain("Risco informado no cadastro");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<input");
    expect(html).toContain("Grupo Atlas");
    expect(html).toContain("Abrir dossiê de Grupo Atlas");
    expect(html).toContain("Integrantes atuais");
    expect(html).not.toContain("data-people-appearance");
    expect(html).not.toContain("Visual em teste");
  });

  it("mantém a busca e os filtros próprios no diretório de Pessoas", () => {
    const html = renderDirectory("people");

    expect(html).toContain("Busca e filtros");
    expect(html).toContain("Busca no diretório");
    expect(html).toContain("Nome, alcunha, CPF, RG...");
    expect(html).toContain("Facção do vínculo atual");
    expect(html).toContain("Vínculo com facção");
    expect(html).toContain("Fotografia");
    expect(html).toContain("Local cadastrado");
    expect(html).toContain("Ordenação");
    expect(html.match(/<select\b/g)).toHaveLength(5);
    expect(html).toContain("Pessoa Demonstrativa A");
    expect(html).toContain("Abrir ficha de Pessoa Demonstrativa A");
    expect(html).not.toContain("Visual em teste");
  });
});
