import { supabase } from "@/lib/supabaseClient";
import { runSupabaseMutation, runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import { compressVehicleImage } from "@/features/vehicles/imageCompression";
import type {
  VehicleListFilters,
  VehicleListRecord,
  VehicleIdentifierConflict,
  VehicleMovementRecord,
  VehicleOverviewStats,
  VehiclePayload,
  VehiclePhotoRecord,
  VehicleRecord,
  VehicleTimelineEvent,
} from "@/features/vehicles/vehicleTypes";

const VEHICLE_PHOTOS_BUCKET = "vehicle-photos";

export async function listVehiclesPage(filters: VehicleListFilters = {}) {
  const data = await runSupabaseQuery<VehicleListRecord[]>("veículos", (signal) =>
    supabase
      .rpc("list_vehicles_page", {
        p_limit: filters.limit ?? 21,
        p_cursor_updated_at: filters.cursor?.updatedAt ?? null,
        p_cursor_id: filters.cursor?.id ?? null,
        p_search: filters.search?.trim() || null,
        p_vehicle_type: filters.vehicleType ?? null,
        p_situation: filters.situation ?? null,
        p_occurrence_type: filters.occurrenceType || null,
        p_status: filters.status || null,
        p_custody_location: filters.custodyLocation || null,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_pending_identification: filters.pendingIdentification ?? null,
      })
      .abortSignal(signal),
  );
  return (data ?? []) as VehicleListRecord[];
}

export async function getVehicleById(id: string) {
  return runSupabaseQuery<VehicleRecord | null>("detalhes do veículo", (signal) =>
    supabase
      .from("vehicles")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .abortSignal(signal)
      .maybeSingle(),
  );
}

export async function getVehicleOverviewStats() {
  const data = await runSupabaseQuery<VehicleOverviewStats>("visão geral de veículos", (signal) =>
    supabase.rpc("vehicle_overview_stats").abortSignal(signal),
  );
  return data as VehicleOverviewStats;
}

export async function findVehicleIdentifierConflicts(input: {
  plate?: string | null;
  renavam?: string | null;
  engineNumber?: string | null;
  chassis?: string | null;
  excludeVehicleId?: string | null;
}) {
  const data = await runSupabaseQuery<VehicleIdentifierConflict[]>(
    "verificação de identificadores do veículo",
    (signal) =>
      supabase
        .rpc("find_vehicle_identifier_conflicts", {
          p_plate: input.plate || null,
          p_renavam: input.renavam || null,
          p_engine_number: input.engineNumber || null,
          p_chassis: input.chassis || null,
          p_exclude_vehicle_id: input.excludeVehicleId || null,
        })
        .abortSignal(signal),
  );
  return (data ?? []) as VehicleIdentifierConflict[];
}

export async function createVehicle(payload: VehiclePayload) {
  return runSupabaseMutation<VehicleRecord>("cadastro do veículo", (signal) =>
    supabase.from("vehicles").insert(payload).select("*").abortSignal(signal).single(),
  );
}

export async function updateVehicle(id: string, payload: VehiclePayload) {
  return runSupabaseMutation<VehicleRecord>("atualização do veículo", (signal) =>
    supabase
      .from("vehicles")
      .update(payload)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .abortSignal(signal)
      .single(),
  );
}

export async function softDeleteVehicle(id: string) {
  const deleted = await runSupabaseMutation<boolean>("exclusão de veículo", (signal) =>
    supabase.rpc("soft_delete_vehicle", { p_vehicle_id: id }).abortSignal(signal),
  );

  if (!deleted) {
    throw {
      code: "PGRST116",
      message: "Veículo não encontrado ou já excluído.",
    };
  }

  return true;
}

async function listVehiclePhotos(vehicleId: string) {
  const photos = await runSupabaseQuery<VehiclePhotoRecord[]>("fotografias do veículo", (signal) =>
    supabase
      .from("vehicle_photos")
      .select(
        "id,vehicle_id,storage_path,thumbnail_path,caption,sort_order,original_size_bytes,thumbnail_size_bytes,mime_type,created_at",
      )
      .eq("vehicle_id", vehicleId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .abortSignal(signal),
  );

  return Promise.all(
    (photos ?? []).map(async (photo) => {
      const [original, thumbnail] = await Promise.all([
        supabase.storage.from(VEHICLE_PHOTOS_BUCKET).createSignedUrl(photo.storage_path, 3600),
        supabase.storage.from(VEHICLE_PHOTOS_BUCKET).createSignedUrl(photo.thumbnail_path, 3600),
      ]);
      return {
        ...photo,
        original_url: original.data?.signedUrl,
        thumbnail_url: thumbnail.data?.signedUrl,
      } as VehiclePhotoRecord;
    }),
  );
}

async function listVehicleTimeline(vehicleId: string) {
  const data = await runSupabaseQuery<VehicleTimelineEvent[]>("histórico do veículo", (signal) =>
    supabase
      .rpc("list_vehicle_timeline", {
        p_vehicle_id: vehicleId,
        p_limit: 100,
      })
      .abortSignal(signal),
  );
  return (data ?? []) as VehicleTimelineEvent[];
}

export async function getVehicleDetailBundle(vehicleId: string) {
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle) return null;
  const [photos, timeline] = await Promise.all([
    listVehiclePhotos(vehicleId),
    listVehicleTimeline(vehicleId),
  ]);
  return { vehicle, photos, timeline };
}

// O veículo já está salvo quando as fotos sobem. Uma falha aqui não pode
// derrubar o lote inteiro nem ser tratada como falha do cadastro: cada foto é
// tentada isoladamente e as que não passarem voltam para o formulário reenviar.
export type VehiclePhotoUploadResult = {
  created: VehiclePhotoRecord[];
  failed: File[];
};

export async function uploadVehiclePhotos(
  vehicleId: string,
  files: File[],
): Promise<VehiclePhotoUploadResult> {
  const created: VehiclePhotoRecord[] = [];
  const failed: File[] = [];

  for (const [index, source] of files.entries()) {
    const uploadedPaths: string[] = [];
    try {
      const token = crypto.randomUUID();
      const originalPath = `${vehicleId}/${token}.webp`;
      const thumbnailPath = `${vehicleId}/thumbs/${token}.webp`;
      const [original, thumbnail] = await Promise.all([
        compressVehicleImage(source, { maxDimension: 1920, quality: 0.82 }),
        compressVehicleImage(source, { maxDimension: 480, quality: 0.7 }),
      ]);

      const originalUpload = await supabase.storage
        .from(VEHICLE_PHOTOS_BUCKET)
        .upload(originalPath, original, { contentType: "image/webp", upsert: false });
      if (originalUpload.error) throw originalUpload.error;
      uploadedPaths.push(originalPath);

      const thumbnailUpload = await supabase.storage
        .from(VEHICLE_PHOTOS_BUCKET)
        .upload(thumbnailPath, thumbnail, { contentType: "image/webp", upsert: false });
      if (thumbnailUpload.error) throw thumbnailUpload.error;
      uploadedPaths.push(thumbnailPath);

      const photo = await runSupabaseMutation<VehiclePhotoRecord>(
        "registro da fotografia",
        (signal) =>
          supabase
            .from("vehicle_photos")
            .insert({
              vehicle_id: vehicleId,
              storage_path: originalPath,
              thumbnail_path: thumbnailPath,
              sort_order: index,
              original_size_bytes: original.size,
              thumbnail_size_bytes: thumbnail.size,
              mime_type: "image/webp",
            })
            .select("*")
            .abortSignal(signal)
            .single(),
      );
      created.push(photo);
    } catch (error) {
      console.error("[vehicles] Falha ao enviar fotografia", error);
      if (uploadedPaths.length) {
        await supabase.storage
          .from(VEHICLE_PHOTOS_BUCKET)
          .remove(uploadedPaths)
          .catch(() => undefined);
      }
      failed.push(source);
    }
  }

  return { created, failed };
}

export async function registerVehicleMovement(input: {
  vehicleId: string;
  movementType: VehicleMovementRecord["movement_type"];
  fromLocation?: string;
  toLocation?: string;
  notes?: string;
  occurredAt?: string;
  details?: Record<string, unknown>;
}) {
  return runSupabaseMutation<VehicleMovementRecord>("movimentação do veículo", (signal) =>
    supabase
      .rpc("register_vehicle_movement", {
        p_vehicle_id: input.vehicleId,
        p_movement_type: input.movementType,
        p_from_location: input.fromLocation || null,
        p_to_location: input.toLocation || null,
        p_notes: input.notes || null,
        p_details: input.details ?? {},
        p_occurred_at: input.occurredAt || new Date().toISOString(),
      })
      .abortSignal(signal),
  );
}
