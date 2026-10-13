import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: state.rpc,
    storage: { from: () => ({ upload: state.upload }) },
  },
}));

vi.mock("@/lib/repositories/vehiclesRepository", () => ({
  uploadVehiclePhotos: vi.fn(),
}));

const {
  attachVehicleInspectionPdf,
  createVehicleInspection,
  uploadVehicleInspectionPdf,
} = await import("./vistoriasRepository");

function mutationResult(data: unknown) {
  return { abortSignal: async () => ({ data, error: null }) };
}

describe("vistoriasRepository", () => {
  beforeEach(() => {
    state.rpc.mockReset();
    state.upload.mockReset();
  });

  it("cria vistoria e primeira versão por uma única RPC transacional", async () => {
    const inspection = { id: "vistoria-1", vehicle_id: "veiculo-1", current_version: 1 };
    state.rpc.mockReturnValue(mutationResult(inspection));

    await expect(
      createVehicleInspection({
        vehicle_id: "veiculo-1",
        inspection_date: "2026-10-13",
        location: "Pátio",
        inspector_notes: "Sem alteração",
        presentation_reason: "verificacao",
        checklist: { estepe: "presente" },
      }),
    ).resolves.toEqual(inspection);

    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith(
      "create_vehicle_inspection",
      expect.objectContaining({
        p_vehicle_id: "veiculo-1",
        p_inspection_date: "2026-10-13",
        p_presentation_reason: "verificacao",
        p_checklist: { estepe: "presente" },
      }),
    );
  });

  it("vincula PDF ao cabeçalho e à versão por uma única RPC", async () => {
    const inspection = { id: "vistoria-1", status: "emitido", current_version: 2 };
    state.rpc.mockReturnValue(mutationResult(inspection));

    await expect(
      attachVehicleInspectionPdf("vistoria-1", 2, "vistoria-1/v2/arq.pdf", "a".repeat(64)),
    ).resolves.toEqual(inspection);

    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith("attach_vehicle_inspection_pdf", {
      p_inspection_id: "vistoria-1",
      p_version: 2,
      p_storage_path: "vistoria-1/v2/arq.pdf",
      p_pdf_sha256: "a".repeat(64),
    });
  });

  it("envia PDF para um caminho imutável sem permitir sobrescrita", async () => {
    state.upload.mockResolvedValue({ error: null });
    const file = new File(["conteúdo"], "laudo final.pdf", { type: "application/pdf" });

    const uploaded = await uploadVehicleInspectionPdf("vistoria-1", 2, file);

    expect(uploaded.path).toMatch(/^vistoria-1\/v2\/[\w-]+-laudo_final\.pdf$/);
    expect(uploaded.pdfSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(state.upload).toHaveBeenCalledWith(
      uploaded.path,
      file,
      expect.objectContaining({ upsert: false, contentType: "application/pdf" }),
    );
  });
});
