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
  vehicle_type: string | null;
  brand: string | null;
  model: string | null;
  brand_model: string | null;
  color: string | null;
  plate: string | null;
  renavam: string | null;
  engine_number: string | null;
  chassis: string | null;
  manufacture_year: number | null;
  model_year: number | null;
  conservation_state: string | null;
};

type RawVehicleInspection = Omit<VehicleInspection, "vehicle"> & {
  vehicle?: InspectionVehicle | InspectionVehicle[] | null;
};

const INSPECTION_PDF_BUCKET = "vehicle-inspection-pdfs";

const INSPECTION_SELECT =
  "id,vehicle_id,status,inspection_date,location,inspector_notes,police_report_number,presentation_reason,presenting_institution,yard_type,yard_location,delivery_restricted,checklist,linked_people,original_vehicle_data,findings,current_version,pdf_storage_path,pdf_sha256,created_at,updated_at,created_by,updated_by,vehicle:vehicles(id,internal_id,vehicle_type,brand,model,brand_model,color,plate,renavam,engine_number,chassis,manufacture_year,model_year,conservation_state)";

function normalizeVehicleInspection(inspection: RawVehicleInspection): VehicleInspection {
  return {
    ...inspection,
    vehicle: Array.isArray(inspection.vehicle)
      ? (inspection.vehicle[0] ?? null)
      : (inspection.vehicle ?? null),
  } as VehicleInspection;
}

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

  return (data ?? []).map(normalizeVehicleInspection);
}

export async function getVehicleInspection(inspectionId: string) {
  const data = await runSupabaseQuery<RawVehicleInspection | null>(
    "detalhes da vistoria",
    (signal) =>
      supabase
        .from("vehicle_inspections")
        .select(INSPECTION_SELECT)
        .eq("id", inspectionId)
        .abortSignal(signal)
        .maybeSingle(),
  );

  return data ? normalizeVehicleInspection(data) : null;
}

export async function listVehiclesForInspection(search = "") {
  const query = supabase
    .from("vehicles")
    .select(
      "id,internal_id,vehicle_type,brand,model,brand_model,color,plate,renavam,engine_number,chassis,manufacture_year,model_year,conservation_state",
    )
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
        .rpc("create_vehicle_inspection", {
          p_vehicle_id: input.vehicle_id,
          p_inspection_date: input.inspection_date,
          p_location: input.location?.trim() || null,
          p_inspector_notes: input.inspector_notes?.trim() || null,
          p_findings: input.findings ?? {},
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

  if (!data) throw new Error("Não foi possível criar o relatório de vistoria.");
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
  caption?: string | null;
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
            caption: input.caption?.trim() || null,
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
  const path = `${inspectionId}/v${version}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage
    .from(INSPECTION_PDF_BUCKET)
    .upload(path, file, { upsert: false, contentType: "application/pdf" });
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
        .rpc("attach_vehicle_inspection_pdf", {
          p_inspection_id: inspectionId,
          p_version: version,
          p_storage_path: storagePath,
          p_pdf_sha256: pdfSha256,
        })
        .abortSignal(signal),
  );

  return data;
}

export async function getVehicleInspectionPdfUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(INSPECTION_PDF_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Não foi possível abrir o PDF da vistoria.");
  }
  return data.signedUrl;
}

export function inspectionFindingsToText(findings: VehicleInspectionFindings) {
  return Object.entries(findings)
    .filter(([, value]) => typeof value === "string" && Boolean(value.trim()))
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}
