import { supabase } from "@/lib/supabaseClient";
import { runSupabaseMutation, runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import { uploadVehiclePhotos } from "@/lib/repositories/vehiclesRepository";
import type {
  CreateVehicleInspectionInput,
  InspectionPhotoCategory,
  VehicleInspection,
  VehicleInspectionFindings,
  VehicleInspectionPhoto,
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
  "id,vehicle_id,status,inspection_date,location,inspector_notes,police_report_number,presentation_reason,presenting_institution,yard_type,yard_location,delivery_restricted,checklist,linked_people,original_vehicle_data,findings,current_version,pdf_storage_path,pdf_sha256,created_at,updated_at,created_by,updated_by,vehicle:vehicles(id,internal_id,brand_model,plate)";

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
          police_report_number: input.police_report_number?.trim() || null,
          presentation_reason: input.presentation_reason || null,
          presenting_institution: input.presenting_institution || null,
          yard_type: input.yard_type || null,
          yard_location: input.yard_location?.trim() || null,
          delivery_restricted: input.delivery_restricted ?? false,
          checklist: input.checklist ?? {},
          linked_people: input.linked_people ?? [],
          original_vehicle_data: input.original_vehicle_data ?? {},
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
          police_report_number: data.police_report_number,
          presentation_reason: data.presentation_reason,
          presenting_institution: data.presenting_institution,
          yard_type: data.yard_type,
          yard_location: data.yard_location,
          delivery_restricted: data.delivery_restricted,
          checklist: data.checklist,
          linked_people: data.linked_people,
          original_vehicle_data: data.original_vehicle_data,
          findings: data.findings,
        },
        change_reason: "Criação do relatório",
      })
      .abortSignal(signal),
  );

  return data;
}

export async function updateVehicleInspection(
  inspectionId: string,
  input: CreateVehicleInspectionInput,
  changeReason: string,
) {
  const data = await runSupabaseMutation<VehicleInspection>("nova versão da vistoria", (signal) =>
    supabase
      .rpc("update_vehicle_inspection", {
        p_inspection_id: inspectionId,
        p_inspection_date: input.inspection_date,
        p_location: input.location?.trim() || null,
        p_inspector_notes: input.inspector_notes?.trim() || null,
        p_findings: input.findings ?? {},
        p_change_reason: changeReason.trim() || "Revisão do relatório",
        p_police_report_number: input.police_report_number?.trim() || null,
        p_presentation_reason: input.presentation_reason || null,
        p_presenting_institution: input.presenting_institution || null,
        p_yard_type: input.yard_type || null,
        p_yard_location: input.yard_location?.trim() || null,
        p_delivery_restricted: input.delivery_restricted ?? false,
        p_checklist: input.checklist ?? {},
        p_linked_people: input.linked_people ?? [],
        p_original_vehicle_data: input.original_vehicle_data ?? {},
      })
      .abortSignal(signal),
  );

  return data as VehicleInspection;
}

export type VehicleInspectionVersion = {
  id: string;
  inspection_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  change_reason: string | null;
  pdf_storage_path: string | null;
  pdf_sha256: string | null;
  created_at: string;
  created_by: string | null;
};

export async function listVehicleInspectionVersions(inspectionId: string) {
  const data = await runSupabaseQuery<VehicleInspectionVersion[]>(
    "histórico da vistoria",
    (signal) =>
      supabase
        .from("vehicle_inspection_versions")
        .select(
          "id,inspection_id,version,snapshot,change_reason,pdf_storage_path,pdf_sha256,created_at,created_by",
        )
        .eq("inspection_id", inspectionId)
        .order("version", { ascending: false })
        .abortSignal(signal),
  );

  return data ?? [];
}

type RawVehicleInspectionPhoto = Omit<VehicleInspectionPhoto, "vehicle_photo"> & {
  vehicle_photo:
    | {
        id: string;
        storage_path: string;
        thumbnail_path: string;
      }
    | {
        id: string;
        storage_path: string;
        thumbnail_path: string;
      }[]
    | null;
};

export async function listVehicleInspectionPhotos(inspectionId: string) {
  const data = await runSupabaseQuery<RawVehicleInspectionPhoto[]>(
    "fotografias técnicas da vistoria",
    (signal) =>
      supabase
        .from("vehicle_inspection_photos")
        .select(
          "id,inspection_id,vehicle_photo_id,category,caption,created_at,vehicle_photo:vehicle_photos(id,storage_path,thumbnail_path)",
        )
        .eq("inspection_id", inspectionId)
        .order("created_at", { ascending: true })
        .abortSignal(signal),
  );

  return Promise.all(
    (data ?? []).map(async (entry) => {
      const rawPhoto = Array.isArray(entry.vehicle_photo)
        ? entry.vehicle_photo[0]
        : entry.vehicle_photo;
      if (!rawPhoto) return { ...entry, vehicle_photo: null } as VehicleInspectionPhoto;
      const [original, thumbnail] = await Promise.all([
        supabase.storage.from("vehicle-photos").createSignedUrl(rawPhoto.storage_path, 3600),
        supabase.storage.from("vehicle-photos").createSignedUrl(rawPhoto.thumbnail_path, 3600),
      ]);
      return {
        ...entry,
        vehicle_photo: {
          id: rawPhoto.id,
          original_url: original.data?.signedUrl ?? null,
          thumbnail_url: thumbnail.data?.signedUrl ?? null,
        },
      } as VehicleInspectionPhoto;
    }),
  );
}

export async function uploadVehicleInspectionPhotos(input: {
  inspectionId: string;
  vehicleId: string;
  category: InspectionPhotoCategory;
  files: File[];
}) {
  const { created, failed } = await uploadVehiclePhotos(input.vehicleId, input.files);
  if (created.length) {
    await runSupabaseMutation("vínculo das fotografias técnicas", (signal) =>
      supabase
        .from("vehicle_inspection_photos")
        .insert(
          created.map((photo) => ({
            inspection_id: input.inspectionId,
            vehicle_photo_id: photo.id,
            category: input.category,
          })),
        )
        .abortSignal(signal),
    );
  }
  return { created, failed };
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
