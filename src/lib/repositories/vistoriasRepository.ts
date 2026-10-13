import { supabase } from "@/lib/supabaseClient";
import { runSupabaseMutation, runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import type {
  CreateVehicleInspectionInput,
  VehicleInspection,
  VehicleInspectionFindings,
} from "@/features/vistorias/vistoriaTypes";

type InspectionVehicle = {
  id: string;
  internal_id: string;
  brand_model: string | null;
  plate: string | null;
};

type RawVehicleInspection = Omit<VehicleInspection, "vehicle"> & {
  vehicle?: InspectionVehicle[] | null;
};

const INSPECTION_PDF_BUCKET = "vehicle-inspection-pdfs";

const INSPECTION_SELECT =
  "id,vehicle_id,status,inspection_date,location,inspector_notes,findings,current_version,pdf_storage_path,pdf_sha256,created_at,updated_at,created_by,updated_by,vehicle:vehicles(id,internal_id,brand_model,plate)";

export async function listVehicleInspections(limit = 50) {
  const data = await runSupabaseQuery<RawVehicleInspection[]>("relatórios de vistoria", (signal) =>
    supabase
      .from("vehicle_inspections")
      .select(INSPECTION_SELECT)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit)
      .abortSignal(signal),
  );

  return (data ?? []).map((inspection) => ({
    ...inspection,
    vehicle: inspection.vehicle?.[0] ?? null,
  })) as VehicleInspection[];
}

export async function listVehiclesForInspection(search = "") {
  const query = supabase
    .from("vehicles")
    .select("id,internal_id,brand_model,plate")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(40);

  const normalized = search.trim();
  const data = await runSupabaseQuery<InspectionVehicle[]>("veículos para vistoria", (signal) =>
    (normalized
      ? query.or(
          `internal_id.ilike.%${normalized}%,brand_model.ilike.%${normalized}%,plate.ilike.%${normalized}%`,
        )
      : query
    ).abortSignal(signal),
  );

  return data ?? [];
}

export async function createVehicleInspection(input: CreateVehicleInspectionInput) {
  const data = await runSupabaseMutation<VehicleInspection>(
    "criação do relatório de vistoria",
    (signal) =>
      supabase
        .from("vehicle_inspections")
        .insert({
          vehicle_id: input.vehicle_id,
          inspection_date: input.inspection_date,
          location: input.location?.trim() || null,
          inspector_notes: input.inspector_notes?.trim() || null,
          findings: input.findings ?? {},
        })
        .select(INSPECTION_SELECT)
        .abortSignal(signal)
        .single(),
  );

  if (!data) throw new Error("Não foi possível criar o relatório de vistoria.");

  await runSupabaseMutation("registro da primeira versão da vistoria", (signal) =>
    supabase
      .from("vehicle_inspection_versions")
      .insert({
        inspection_id: data.id,
        version: 1,
        snapshot: {
          vehicle_id: data.vehicle_id,
          inspection_date: data.inspection_date,
          location: data.location,
          inspector_notes: data.inspector_notes,
          findings: data.findings,
        },
        change_reason: "Criação do relatório",
      })
      .abortSignal(signal),
  );

  return data;
}

export async function uploadVehicleInspectionPdf(
  inspectionId: string,
  version: number,
  file: File,
) {
  const path = `${inspectionId}/v${version}.pdf`;
  const { error } = await supabase.storage
    .from(INSPECTION_PDF_BUCKET)
    .upload(path, file, { upsert: true, contentType: "application/pdf" });
  if (error) throw error;
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const pdfSha256 = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return { path, pdfSha256 };
}

export async function attachVehicleInspectionPdf(
  inspectionId: string,
  version: number,
  storagePath: string,
  pdfSha256: string,
) {
  const data = await runSupabaseMutation<VehicleInspection>(
    "vinculação do PDF da vistoria",
    (signal) =>
      supabase
        .from("vehicle_inspections")
        .update({ pdf_storage_path: storagePath, pdf_sha256: pdfSha256, status: "emitido" })
        .eq("id", inspectionId)
        .select(INSPECTION_SELECT)
        .abortSignal(signal)
        .single(),
  );

  await runSupabaseMutation("atualização da versão PDF da vistoria", (signal) =>
    supabase
      .from("vehicle_inspection_versions")
      .update({ pdf_storage_path: storagePath, pdf_sha256: pdfSha256 })
      .eq("inspection_id", inspectionId)
      .eq("version", version)
      .abortSignal(signal),
  );

  return data;
}

export function inspectionFindingsToText(findings: VehicleInspectionFindings) {
  return Object.entries(findings)
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}
