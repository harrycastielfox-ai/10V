import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isNexoOrganogramLeadershipRole } from "../nexoOrganogram";
import type { NexoOrganizacao } from "../nexoTypes";
import { NexoOrganogram } from "./NexoOrganogram";

const organization: NexoOrganizacao = {
  id: "org-sintetica",
  nome: "Organização Sintética",
  sigla: "OS",
  status: "monitoramento",
  cor: "#168aa1",
  descricao: null,
  area_atuacao: null,
  nivel_risco: "moderado",
  simbolo_path: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

const baseProps = {
  organization,
  members: [],
  onOpen: () => {},
};

describe("estados do organograma NEXO", () => {
  it("expõe estado de carregamento sem montar o canvas vazio", () => {
    const html = renderToStaticMarkup(
      createElement(NexoOrganogram, { ...baseProps, loading: true }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Carregando estrutura organizacional");
  });

  it("expõe falha de carregamento como alerta", () => {
    const html = renderToStaticMarkup(
      createElement(NexoOrganogram, {
        ...baseProps,
        error: "Não foi possível carregar os vínculos.",
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Não foi possível carregar os vínculos.");
  });

  it("diferencia estrutura vazia de erro", () => {
    const html = renderToStaticMarkup(createElement(NexoOrganogram, baseProps));

    expect(html).toContain("Nenhum integrante elegível para o organograma");
    expect(html).toContain("Cadastre ou reative um vínculo para exibir a estrutura.");
    expect(html).not.toContain('role="alert"');
  });

  it("destaca com a barra de liderança somente cargos explicitamente registrados", () => {
    expect(isNexoOrganogramLeadershipRole("Líder · Eunápolis")).toBe(true);
    expect(isNexoOrganogramLeadershipRole("Vice-líder")).toBe(true);
    expect(isNexoOrganogramLeadershipRole("Liderança local")).toBe(true);
    expect(isNexoOrganogramLeadershipRole("Coordenador de núcleo")).toBe(false);
    expect(isNexoOrganogramLeadershipRole(null)).toBe(false);
  });

  it("oferece gestão explícita de núcleos sem depender da existência de integrantes", () => {
    const html = renderToStaticMarkup(
      createElement(NexoOrganogram, {
        ...baseProps,
        nuclei: [],
        onManageNuclei: () => {},
      }),
    );

    expect(html).toContain("Núcleos e setores");
    expect(html).toContain('aria-label="Gerenciar núcleos e setores"');
  });
});
