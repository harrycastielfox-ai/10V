import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PersonWizardProgress } from "./NexoPersonWizard";

describe("indicação visual das etapas de cadastro", () => {
  it("identifica somente a etapa atual sem transformar as demais em botões", () => {
    const html = renderToStaticMarkup(createElement(PersonWizardProgress, { step: 2 }));
    expect(html).toContain("Etapa 3 de 6");
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Etapas do cadastro de pessoa"');
    expect(html).toContain("Aparência");
    expect(html).not.toContain("<button");
  });

  it("preserva as seis etapas até a revisão", () => {
    const html = renderToStaticMarkup(createElement(PersonWizardProgress, { step: 5 }));
    expect(html).toContain("Etapa 6 de 6");
    expect(html.match(/<li /g)).toHaveLength(6);
    expect(html).toContain("Revisão");
  });
});
