import { supabase } from "@/lib/supabaseClient";
import { runSupabaseMutation, runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import type { BoPayload, BoRecord } from "@/features/bo/boTypes";

const LIST_CACHE_TTL_MS = 10_000;
let boCache: { data: BoRecord[]; fetchedAt: number } | null = null;
let boPending: Promise<BoRecord[]> | null = null;

function invalidateBoCache() {
  boCache = null;
}

export async function listBos(options: { forceRefresh?: boolean } = {}) {
  if (boPending) return boPending;
  const now = Date.now();
  if (!options.forceRefresh && boCache && now - boCache.fetchedAt < LIST_CACHE_TTL_MS) {
    return boCache.data;
  }

  boPending = runSupabaseQuery<BoRecord[]>("boletins de ocorrência", (signal) =>
    supabase
      .from("boletins_ocorrencia")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1000)
      .abortSignal(signal),
  )
    .then((data) => {
      const rows = (data ?? []) as BoRecord[];
      boCache = { data: rows, fetchedAt: Date.now() };
      return rows;
    })
    .finally(() => {
      boPending = null;
    });

  return boPending;
}

export async function getBoById(id: string) {
  return runSupabaseQuery<BoRecord | null>("boletim de ocorrência", (signal) =>
    supabase
      .from("boletins_ocorrencia")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .abortSignal(signal)
      .maybeSingle(),
  );
}

export async function createBo(payload: BoPayload) {
  const data = await runSupabaseMutation<BoRecord>("cadastro do B.O.", (signal) =>
    supabase.from("boletins_ocorrencia").insert(payload).select("*").abortSignal(signal).single(),
  );
  invalidateBoCache();
  return data as BoRecord;
}

export async function updateBo(id: string, payload: BoPayload, expectedUpdatedAt: string) {
  const data = await runSupabaseMutation<BoRecord | null>("atualização do B.O.", (signal) =>
    supabase
      .from("boletins_ocorrencia")
      .update(payload)
      .eq("id", id)
      .eq("updated_at", expectedUpdatedAt)
      .is("deleted_at", null)
      .select("*")
      .abortSignal(signal)
      .maybeSingle(),
  );
  if (!data) {
    throw new Error(
      "Este B.O. foi alterado depois que a tela foi aberta. Recarregue antes de salvar.",
    );
  }
  invalidateBoCache();
  return data as BoRecord;
}

export async function softDeleteBo(id: string) {
  const deleted = await runSupabaseMutation<boolean>("exclusão do B.O.", (signal) =>
    supabase.rpc("soft_delete_bo", { p_bo_id: id }).abortSignal(signal),
  );
  if (!deleted) throw new Error("B.O. não encontrado ou já excluído.");
  invalidateBoCache();
  return true;
}
