import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SipiPrintList } from "@/components/SipiPrintList";

describe("SipiPrintList", () => {
  it("renders a compact filtered operational summary", () => {
    const markup = renderToStaticMarkup(
      createElement(SipiPrintList, {
        documentTitle: "Resumo de Procedimentos Policiais",
        documentSubtitle: "Relação consolidada - APF selecionados",
        filtrosAplicados: [{ label: "Tipo", value: "APF" }],
        columns: [
          { id: "ordem", label: "Nº", width: "7mm" },
          { id: "procedimento", label: "Procedimento" },
          { id: "bo", label: "B.O." },
          { id: "natureza", label: "Natureza do caso" },
          { id: "situacao", label: "Situação" },
        ],
        rows: [
          {
            id: "procedure-1",
            cells: ["01", "APF 72082/2026", "12345/2026", "Furto qualificado", "Em andamento"],
            details: [
              { label: "Data do fato", value: "25/07/2026" },
              { label: "Autoria", value: "Determinada" },
              { label: "Bairro", value: "Centro" },
              { label: "Prioridade", value: "Alta" },
            ],
          },
        ],
        total: 1,
        geradoEm: "10/08/2026 17:30:00",
        geradoPor: "Usuário de teste",
      }),
    );

    expect(markup).toContain("Resumo de Procedimentos Policiais");
    expect(markup).toContain("Tipo:</strong> APF");
    expect(markup).toContain("APF 72082/2026");
    expect(markup).toContain("Furto qualificado");
    expect(markup).toContain("Data do fato");
    expect(markup).toContain("25/07/2026");
    expect(markup).toContain('class="sipi-print-list-record"');
  });
});
