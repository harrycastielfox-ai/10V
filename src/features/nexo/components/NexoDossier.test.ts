import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NEXO_DEMO_ORGANIZACOES, NEXO_DEMO_PESSOAS, NEXO_DEMO_REGISTROS } from "../nexoDemoData";
import { NexoDossier } from "./NexoDossier";

const noop = () => {};
const save = async () => {};
const props: ComponentProps<typeof NexoDossier> = {
  target: { kind: "organization", id: NEXO_DEMO_ORGANIZACOES[0].id },
  organizations: NEXO_DEMO_ORGANIZACOES,
  people: NEXO_DEMO_PESSOAS,
  territories: [],
  records: NEXO_DEMO_REGISTROS,
  preview: true,
  onClose: noop,
  onOpen: noop,
  onReport: noop,
  onEdit: noop,
  onUploadPhoto: save,
  onDeletePhoto: save,
  onUploadResource: save,
  onDeleteResource: save,
  onDeletePerson: save,
  onUploadOrganizationPhoto: save,
  onDeleteOrganizationPhoto: save,
  onDeleteOrganization: save,
  onCreateLink: save,
  onManageLink: save,
  onCreatePersonForOrganization: noop,
  onCreateTerritoryForOrganization: noop,
  onDeleteTerritory: save,
};

describe("apresentação do dossiê NEXO", () => {
  it("preserva a cor da facção e uma única ação de relatório no cabeçalho", () => {
    const html = renderToStaticMarkup(createElement(NexoDossier, props));
    expect(html).toContain('data-organization-theme="true"');
    expect(html).toContain(NEXO_DEMO_ORGANIZACOES[0].cor);
    expect(html.match(/Gerar relatório/g)).toHaveLength(1);
    expect(html).toContain("Editar cadastro");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Seções do dossiê"');
  });

  it("mantém fotografia e ação de abertura na prévia da pessoa", () => {
    const person = { ...NEXO_DEMO_PESSOAS[0], foto_perfil_url: "/foto-visual.jpg" };
    const html = renderToStaticMarkup(
      createElement(NexoDossier, {
        ...props,
        target: { kind: "person", id: person.id },
        people: [person],
      }),
    );
    expect(html).toContain('src="/foto-visual.jpg"');
    expect(html).toContain("Mostrar Informações Sigilosas");
    expect(html).toContain(`Resumo de ${person.nome}`);
  });
});
