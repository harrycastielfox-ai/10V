import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: state.rpc,
    from: state.from,
    storage: {
      from: () => ({ upload: state.upload, createSignedUrl: state.createSignedUrl }),
    },
  },
}));

vi.mock("@/lib/repositories/vehiclesRepository", () => ({
  uploadVehiclePhotos: vi.fn(),
}));

const {
  attachVehicleInspectionPdf,
  createVehicleInspection,
  getVehicleInspection,
  getVehicleInspectionPdfUrl,
  inspectionFindingsToText,
  listVehicleInspections,
  uploadVehicleInspectionPdf,
} = await import("./vistoriasRepository");

function mutationResult(data: unknown) {
  return { abortSignal: async () => ({ data, error: null }) };
}

function inspectionQueryResult(data: unknown) {
  const builder = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    abortSignal: vi.fn(async () => ({ data, error: null })),
  };
  builder.select.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  state.from.mockReturnValue(builder);
  return builder;
}

function inspectionDetailQueryResult(data: unknown) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    abortSignal: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.abortSignal.mockReturnValue(builder);
  state.from.mockReturnValue(builder);
  return builder;
}

describe("vistoriasRepository", () => {
  beforeEach(() => {
    state.rpc.mockReset();
    state.from.mockReset();
    state.upload.mockReset();
    state.createSignedUrl.mockReset();
  });

  it("busca uma vistoria pelo id e normaliza o veículo relacionado", async () => {
    inspectionDetailQueryResult({
      id: "vistoria-1",
      vehicle_id: "veiculo-1",
      current_version: 2,
      vehicle: [
        {
          id: "veiculo-1",
          internal_id: "VEI-2026-000001",
          plate: "JOV8032",
        },
      ],
    });

    const inspection = await getVehicleInspection("vistoria-1");

    expect(inspection?.vehicle?.internal_id).toBe("VEI-2026-000001");
    expect(inspection?.vehicle?.plate).toBe("JOV8032");
    expect(state.from).toHaveBeenCalledWith("vehicle_inspections");
  });

  it("preserva o veículo relacionado quando o Supabase retorna um objeto", async () => {
    const vehicle = {
      id: "veiculo-1",
      internal_id: "VEI-001",
      brand: "Toyota",
      model: "Corolla",
      brand_model: "Toyota Corolla",
      color: "Prata",
      plate: "ABC1D23",
      engine_number: "MOTOR-1",
      chassis: "CHASSI-1",
      manufacture_year: 2024,
      model_year: 2025,
      conservation_state: "Bom",
    };
    inspectionQueryResult([
      {
        id: "vistoria-1",
        vehicle_id: vehicle.id,
        vehicle,
        current_version: 1,
      },
    ]);

    const [inspection] = await listVehicleInspections();

    expect(inspection.vehicle).toEqual(vehicle);
    expect(inspection.vehicle?.plate).toBe("ABC1D23");
    expect(state.from).toHaveBeenCalledWith("vehicle_inspections");
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
        findings: {
          result: "Há indícios de adulteração nos sinais identificadores.",
          measures_taken: "Veículo encaminhado para exame pericial.",
        },
        checklist: {
          estepe: "presente",
          technical: {
            oil_level: "adequado",
            wheel_brand: "Michelin",
            wheel_rim: "17",
            mileage_km: 42876,
            assessment: {
              expert_examined: "sim",
              tampering_confirmed: "sim",
              divergence_indicators: ["visible_identifier_tampering"],
              questionnaire: {
                early_disposal_requested: "nao",
              },
            },
          },
        },
      }),
    ).resolves.toEqual(inspection);

    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith(
      "create_vehicle_inspection",
      expect.objectContaining({
        p_vehicle_id: "veiculo-1",
        p_inspection_date: "2026-10-13",
        p_presentation_reason: "verificacao",
        p_findings: {
          result: "Há indícios de adulteração nos sinais identificadores.",
          measures_taken: "Veículo encaminhado para exame pericial.",
        },
        p_checklist: {
          estepe: "presente",
          technical: {
            oil_level: "adequado",
            wheel_brand: "Michelin",
            wheel_rim: "17",
            mileage_km: 42876,
            assessment: {
              expert_examined: "sim",
              tampering_confirmed: "sim",
              divergence_indicators: ["visible_identifier_tampering"],
              questionnaire: {
                early_disposal_requested: "nao",
              },
            },
          },
        },
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

  it("gera uma URL temporária para visualizar o PDF assinado", async () => {
    state.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/vistoria-assinada.pdf" },
      error: null,
    });

    await expect(getVehicleInspectionPdfUrl("vistoria-1/v2/laudo.pdf")).resolves.toBe(
      "https://storage.example/vistoria-assinada.pdf",
    );
    expect(state.createSignedUrl).toHaveBeenCalledWith("vistoria-1/v2/laudo.pdf", 3600);
  });

  it("mantém os dados ostentados estruturados fora da narrativa textual", () => {
    expect(
      inspectionFindingsToText({
        identification: "Chassi com sinais de remarcação.",
        ostensible_vehicle: {
          brand: "Honda",
          model: "XRE 190",
          plate: "TOG1G13",
        },
      }),
    ).toBe("identification: Chassi com sinais de remarcação.");
  });
});
