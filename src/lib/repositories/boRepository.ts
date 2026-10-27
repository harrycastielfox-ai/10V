import { supabase } from "@/lib/supabaseClient";
import { runSupabaseMutation, runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import {
  currentSessionGeneration,
  isSessionGenerationCurrent,
  registerSessionCache,
} from "@/lib/sessionCache";
import type { BoPayload, BoRecord, BoResponsavelOption } from "@/features/bo/boTypes";

const LIST_CACHE_TTL_MS = 10_000;
const LIST_PAGE_SIZE = 1000;
let boCache: { data: BoRecord[]; fetchedAt: number } | null = null;
let boPending: Promise<BoRecord[]> | null = null;

function invalidateBoCache() {
  boCache = null;
}

registerSessionCache(() => {
  boCache = null;
  boPending = null;
});

export async function listBos(options: { forceRefresh?: boolean } = {}) {
  if (boPending) return boPending;
  const now = Date.now();
  if (!options.forceRefresh && boCache && now - boCache.fetchedAt < LIST_CACHE_TTL_MS) {
    return boCache.data;
  }

  const generation = currentSessionGeneration();
  boPending = (async () => {
    const rows: BoRecord[] = [];
    let cursor: Pick<BoRecord, "updated_at" | "id"> | null = null;
    for (;;) {
      const page = await runSupabaseQuery<BoRecord[]>("boletins de ocorrência", (signal) => {
        let query = supabase
          .from("boletins_ocorrencia")
          .select("*")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(LIST_PAGE_SIZE);
        if (cursor) {
          query = query.or(
            `updated_at.lt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.lt.${cursor.id})`,
          );
        }
        return query.abortSignal(signal);
      });
      rows.push(...(page ?? []));
      if (!page || page.length < LIST_PAGE_SIZE) break;
      cursor = page[page.length - 1];
    }
    if (isSessionGenerationCurrent(generation)) {
      boCache = { data: rows, fetchedAt: Date.now() };
    }
    return rows;
  })().finally(() => {
    if (isSessionGenerationCurrent(generation)) boPending = null;
  });

  return boPending;
}

/**
 * Busca por número, infração ou responsável direto no banco.
 * A lista completa é cacheada e filtrada no cliente, o que serve às telas do
 * módulo; para a busca global o filtro precisa ser do servidor.
 */
export async function searchBos(query: string, limit = 5) {
  const safe = query.trim().replace(/[%_,()]/g, "");
  if (safe.length < 2) return [];

  const data = await runSupabaseQuery<BoRecord[]>("busca de boletins", (signal) =>
    supabase
      .from("boletins_ocorrencia")
      .select("*")
      .is("deleted_at", null)
      .or(
        [
          `numero_bo.ilike.%${safe}%`,
          `infracao_penal.ilike.%${safe}%`,
          `responsavel_nome.ilike.%${safe}%`,
        ].join(","),
      )
      .order("updated_at", { ascending: false })
      .limit(limit)
      .abortSignal(signal),
  );

  return (data ?? []) as BoRecord[];
}

export async function listBoResponsaveis() {
  const data = await runSupabaseQuery<BoResponsavelOption[]>(
    "servidores responsáveis por B.O.",
    (signal) => supabase.rpc("list_bo_responsaveis").abortSignal(signal),
  );
  return (data ?? []) as BoResponsavelOption[];
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
