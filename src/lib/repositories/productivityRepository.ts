import { supabase } from "@/lib/supabaseClient";
import { runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import {
  currentSessionGeneration,
  isSessionGenerationCurrent,
  registerSessionCache,
} from "@/lib/sessionCache";

export type EscrivaoProductivityRow = {
  user_id: string;
  nome: string;
  avatar_path: string | null;
  pontos: number;
  cadastros: number;
  atualizacoes: number;
  relatorios_enviados: number;
  conclusoes: number;
  ultima_atividade: string | null;
};

const LIST_CACHE_TTL_MS = 10000;

const productivityCache = new Map<number, { data: EscrivaoProductivityRow[]; fetchedAt: number }>();
const productivityPending = new Map<number, Promise<EscrivaoProductivityRow[]>>();

registerSessionCache(() => {
  productivityCache.clear();
  productivityPending.clear();
});

export async function listEscrivaoProductivity(
  days = 30,
  options: { forceRefresh?: boolean } = {},
): Promise<EscrivaoProductivityRow[]> {
  const safeDays = Math.max(1, Math.min(365, Math.trunc(days)));
  const pending = productivityPending.get(safeDays);
  if (pending) return pending;

  const cached = productivityCache.get(safeDays);
  if (!options.forceRefresh && cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS) {
    return cached.data;
  }

  const generation = currentSessionGeneration();
  const request = runSupabaseQuery<EscrivaoProductivityRow[]>(
    "produtividade dos escrivães",
    (signal) =>
      supabase.rpc("list_escrivao_productivity", { p_days: safeDays }).abortSignal(signal),
  )
    .then((data) =>
      (data ?? []).map((row) => ({
        ...row,
        pontos: Number(row.pontos ?? 0),
        cadastros: Number(row.cadastros ?? 0),
        atualizacoes: Number(row.atualizacoes ?? 0),
        relatorios_enviados: Number(row.relatorios_enviados ?? 0),
        conclusoes: Number(row.conclusoes ?? 0),
      })),
    )
    .then((rows) => {
      if (isSessionGenerationCurrent(generation)) {
        productivityCache.set(safeDays, { data: rows, fetchedAt: Date.now() });
      }
      return rows;
    })
    .finally(() => {
      if (isSessionGenerationCurrent(generation)) productivityPending.delete(safeDays);
    });

  productivityPending.set(safeDays, request);
  return request;
}
