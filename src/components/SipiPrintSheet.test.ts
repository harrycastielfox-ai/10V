import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SipiPrintSheet } from "@/components/SipiPrintSheet";

describe("SipiPrintSheet", () => {
  it("renders linked records as a single paginated dossier", () => {
    const markup = renderToStaticMarkup(
      createElement(SipiPrintSheet, {
        variant: "dossier",
        documentTitle: "Dossiê de Procedimento Policial",
        documentSubtitle: "Procedimento e representações",
        identifierLabel: "PPE",
        identifier: "123/2026",
        sections: [
          {
            id: "procedure",
            title: "Procedimento",
            fields: [{ label: "Tipificações", value: "1 - Homicídio\n2 - Furto" }],
          },
          {
            id: "representation-1",
            title: "Representação 1 de 1",
            pageBreakBefore: true,
            breakable: true,
            fields: [
              { id: "weapon-1", label: "Arma utilizada", value: "1 - Revólver" },
              { id: "weapon-note-1", label: "Observação", value: "1 - Cabo de madeira" },
            ],
          },
        ],
      }),
    );

    expect(markup).toContain("sipi-print-sheet-dossier");
    expect(markup).toContain("sipi-print-section-page-break");
    expect(markup).toContain("sipi-print-section-breakable");
    expect(markup).toContain("1 - Homicídio\n2 - Furto");
    expect(markup).toContain("Representação 1 de 1");
    expect(markup.match(/sipi-print-sheet-dossier/g)).toHaveLength(1);
  });
});
