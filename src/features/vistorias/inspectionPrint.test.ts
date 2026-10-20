import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VehicleInspectionPrintSheet } from "@/components/VehicleInspectionPrintSheet";
import type { VehicleInspection } from "./vistoriaTypes";

const inspection: VehicleInspection = {
  id: "vistoria-1",
  vehicle_id: "veiculo-1",
  status: "emitido",
  inspection_date: "2026-10-19",
  current_version: 2,
  findings: {},
  checklist: {},
  linked_people: [],
  original_vehicle_data: {},
  location: null,
  inspector_notes: null,
  bo_id: null,
  police_report_number: null,
  presentation_reason: null,
  presenting_institution: null,
  yard_type: null,
  yard_location: null,
  delivery_restricted: false,
  pdf_storage_path: null,
  pdf_sha256: null,
  created_at: "2026-10-19T12:00:00Z",
  updated_at: "2026-10-19T12:00:00Z",
  created_by: null,
  updated_by: null,
};

describe("relatório de vistoria para impressão", () => {
  it.each([
    ["emitido", "Relatório emitido"],
    ["cancelado", "Cancelado"],
  ] as const)("apresenta um rótulo legível para a situação %s", (status, label) => {
    const html = renderToStaticMarkup(
      createElement(VehicleInspectionPrintSheet, {
        inspection: { ...inspection, status },
        photos: [],
      }),
    );
    expect(html).toContain(`<strong>${label}</strong>`);
  });

  it("mantém o relatório renderizável quando a data legada está vazia", () => {
    const html = renderToStaticMarkup(
      createElement(VehicleInspectionPrintSheet, {
        inspection: { ...inspection, inspection_date: "" },
        photos: [],
      }),
    );
    expect(html).toContain("Não informada");
  });
});
