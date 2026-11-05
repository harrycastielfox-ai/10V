import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isNexoOrganogramLeadershipRole } from "../nexoOrganogram";
import type { NexoOrganizacao, NexoPessoa, NexoVinculo } from "../nexoTypes";
import { getNexoOrganogramViewportInteraction } from "../nexoOrganogramInteraction";
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

function organogramMember(
  id: string,
  nome: string,
  funcao = "Integrante",
): { person: NexoPessoa; link: NexoVinculo } {
  const link = {
    id: `v-${id}`,
    pessoa_id: id,
    organizacao_id: organization.id,
    status: "confirmado",
    funcao,
    confianca: 80,
    fonte_resumo: "Fonte sintética",
    desde: null,
    ate: null,
    superior_vinculo_id: null,
    nucleo_id: null,
  } as NexoVinculo;
  const person = {
    id,
    nome,
    apelido: null,
    vinculos: [link],
    fotos: [],
    foto_perfil_path: null,
    foto_relatorio_path: null,
  } as unknown as NexoPessoa;
  return { person, link };
}

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

  it("explica que conexões tracejadas agrupam visualmente integrantes sem chefia", () => {
    const html = renderToStaticMarkup(
      createElement(NexoOrganogram, {
        ...baseProps,
        members: [
          organogramMember("principal", "Raiz Principal"),
          organogramMember("isolado", "Integrante Isolado"),
        ],
      }),
    );

    expect(html).toContain("Conexões tracejadas organizam integrantes sem chefia cadastrada.");
  });

  it("aplica a cor da facção e contraste legível no rodapé das lideranças", () => {
    const html = renderToStaticMarkup(
      createElement(NexoOrganogram, {
        ...baseProps,
        organization: { ...organization, cor: "#f59e0b" },
        members: [organogramMember("lider", "Liderança Sintética", "Líder")],
      }),
    );

    expect(html).toContain("--nexo-org-accent:#f59e0b");
    expect(html).toContain("--nexo-org-accent-foreground:#102b3d");
  });

  it("reserva roda, gesto de pinça e captura da rolagem para a tela cheia", () => {
    expect(getNexoOrganogramViewportInteraction(false)).toEqual({
      zoomOnScroll: false,
      zoomOnPinch: false,
      preventScrolling: false,
      zoomActivationKeyCode: null,
    });
    expect(getNexoOrganogramViewportInteraction(true)).toEqual({
      zoomOnScroll: true,
      zoomOnPinch: true,
      preventScrolling: true,
      zoomActivationKeyCode: null,
    });
  });
});
