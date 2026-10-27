import { supabase } from "@/lib/supabaseClient";
import { runSupabaseMutation, runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import { compressObjectImage } from "@/features/objects/imageCompression";
import type {
  ObjectDetailBundle,
  ObjectListFilters,
  ObjectListRecord,
  ObjectMovementRecord,
  ObjectOverviewStats,
  ObjectPayload,
  ObjectPhotoRecord,
  ObjectRecord,
} from "@/features/objects/objectTypes";

const OBJECT_PHOTOS_BUCKET = "object-photos";

export async function listObjectsPage(filters: ObjectListFilters = {}) {
  const data = await runSupabaseQuery<ObjectListRecord[]>("objetos apreendidos", (signal) =>
    supabase
      .rpc("list_objects_page", {
        p_limit: filters.limit ?? 21,
        p_cursor_updated_at: filters.cursor?.updatedAt ?? null,
        p_cursor_id: filters.cursor?.id ?? null,
        p_search: filters.search?.trim() || null,
        p_object_type: filters.objectType ?? null,
        p_situation: filters.situation ?? null,
        p_occurrence_type: filters.occurrenceType || null,
        p_status: filters.status || null,
        p_custody_location: filters.custodyLocation || null,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_pending_identification: filters.pendingIdentification ?? null,
        p_without_procedure: filters.withoutProcedure ?? null,
      })
      .abortSignal(signal),
  );
  return (data ?? []) as ObjectListRecord[];
}

export async function getObjectById(id: string) {
  return runSupabaseQuery<ObjectRecord | null>("detalhes do objeto", (signal) =>
    supabase
      .from("objects")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .abortSignal(signal)
      .maybeSingle(),
  );
}

export async function getObjectOverviewStats() {
  const data = await runSupabaseQuery<ObjectOverviewStats>("visão geral de objetos", (signal) =>
    supabase.rpc("object_overview_stats").abortSignal(signal),
  );
  return data as ObjectOverviewStats;
}

export async function createObject(payload: ObjectPayload) {
  return runSupabaseMutation<ObjectRecord>("cadastro do objeto", (signal) =>
    supabase.from("objects").insert(payload).select("*").abortSignal(signal).single(),
  );
}

export class ObjectUpdateConflictError extends Error {
  constructor() {
    super(
      "A versão aberta deste objeto não está mais disponível ou foi alterada. Recarregue antes de salvar.",
    );
    this.name = "ObjectUpdateConflictError";
  }
}

export async function updateObject(id: string, payload: ObjectPayload, expectedUpdatedAt: string) {
  if (!expectedUpdatedAt?.trim()) throw new ObjectUpdateConflictError();

  const data = await runSupabaseMutation<ObjectRecord | null>("atualização do objeto", (signal) =>
    supabase
      .from("objects")
      .update(payload)
      .eq("id", id)
      .eq("updated_at", expectedUpdatedAt)
      .is("deleted_at", null)
      .select("*")
      .abortSignal(signal)
      .maybeSingle(),
  );
  if (data === null) throw new ObjectUpdateConflictError();
  return data;
}

export async function softDeleteObject(id: string) {
  const deleted = await runSupabaseMutation<boolean>("exclusão de objeto", (signal) =>
    supabase.rpc("soft_delete_object", { p_object_id: id }).abortSignal(signal),
  );

  if (!deleted) {
    throw {
      code: "PGRST116",
      message: "Objeto não encontrado ou já excluído.",
    };
  }

  return true;
}

async function listObjectPhotos(objectId: string) {
  const photos = await runSupabaseQuery<ObjectPhotoRecord[]>("fotografias do objeto", (signal) =>
    supabase
      .from("object_photos")
      .select(
        "id,object_id,storage_path,thumbnail_path,caption,sort_order,original_size_bytes,thumbnail_size_bytes,mime_type,created_at",
      )
      .eq("object_id", objectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .abortSignal(signal),
  );

  return Promise.all(
    (photos ?? []).map(async (photo) => {
      const [original, thumbnail] = await Promise.all([
        supabase.storage.from(OBJECT_PHOTOS_BUCKET).createSignedUrl(photo.storage_path, 3600),
        supabase.storage.from(OBJECT_PHOTOS_BUCKET).createSignedUrl(photo.thumbnail_path, 3600),
      ]);
      return {
        ...photo,
        original_url: original.data?.signedUrl,
        thumbnail_url: thumbnail.data?.signedUrl,
      } as ObjectPhotoRecord;
    }),
  );
}

async function listObjectMovements(objectId: string) {
  const data = await runSupabaseQuery<ObjectMovementRecord[]>("histórico do objeto", (signal) =>
    supabase
      .from("object_movements")
      .select("*")
      .eq("object_id", objectId)
      .order("occurred_at", { ascending: false })
      .limit(100)
      .abortSignal(signal),
  );
  return (data ?? []) as ObjectMovementRecord[];
}

export async function getObjectDetailBundle(objectId: string): Promise<ObjectDetailBundle | null> {
  const object = await getObjectById(objectId);
  if (!object) return null;
  const [photos, movements] = await Promise.all([
    listObjectPhotos(objectId),
    listObjectMovements(objectId),
  ]);
  return { object, photos, movements };
}

// O objeto já está salvo quando as fotos sobem. Uma falha aqui não pode derrubar
// o lote inteiro nem ser tratada como falha do cadastro: cada foto é tentada
// isoladamente e as que não passarem voltam para o formulário reenviar.
export type ObjectPhotoUploadResult = {
  created: ObjectPhotoRecord[];
  failed: File[];
};

export async function uploadObjectPhotos(
  objectId: string,
  files: File[],
): Promise<ObjectPhotoUploadResult> {
  const created: ObjectPhotoRecord[] = [];
  const failed: File[] = [];

  for (const [index, source] of files.entries()) {
    const uploadedPaths: string[] = [];
    try {
      const token = crypto.randomUUID();
      const originalPath = `${objectId}/${token}.webp`;
      const thumbnailPath = `${objectId}/thumbs/${token}.webp`;
      const [original, thumbnail] = await Promise.all([
        compressObjectImage(source, { maxDimension: 1920, quality: 0.82 }),
        compressObjectImage(source, { maxDimension: 480, quality: 0.7 }),
      ]);

      const originalUpload = await supabase.storage
        .from(OBJECT_PHOTOS_BUCKET)
        .upload(originalPath, original, { contentType: "image/webp", upsert: false });
      if (originalUpload.error) throw originalUpload.error;
      uploadedPaths.push(originalPath);

      const thumbnailUpload = await supabase.storage
        .from(OBJECT_PHOTOS_BUCKET)
        .upload(thumbnailPath, thumbnail, { contentType: "image/webp", upsert: false });
      if (thumbnailUpload.error) throw thumbnailUpload.error;
      uploadedPaths.push(thumbnailPath);

      const photo = await runSupabaseMutation<ObjectPhotoRecord>(
        "registro da fotografia",
        (signal) =>
          supabase
            .from("object_photos")
            .insert({
              object_id: objectId,
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
      console.error("[objects] Falha ao enviar fotografia", error);
      if (uploadedPaths.length) {
        await supabase.storage
          .from(OBJECT_PHOTOS_BUCKET)
          .remove(uploadedPaths)
          .catch(() => undefined);
      }
      failed.push(source);
    }
  }

  return { created, failed };
}

export async function registerObjectMovement(input: {
  objectId: string;
  movementType: ObjectMovementRecord["movement_type"];
  fromLocation?: string;
  toLocation?: string;
  notes?: string;
  occurredAt?: string;
  details?: Record<string, unknown>;
}) {
  return runSupabaseMutation<ObjectMovementRecord>("movimentação do objeto", (signal) =>
    supabase
      .rpc("register_object_movement", {
        p_object_id: input.objectId,
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
