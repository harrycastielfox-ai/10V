import { runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import { supabase } from "@/lib/supabaseClient";
import type { StoredColumnPreference } from "@/lib/repositories/tablePreferencesRepository";

export type SavedFilterRecord = {
  id: string;
  scope: string;
  name: string;
  filters: Record<string, unknown>;
  columns: StoredColumnPreference[] | null;
  created_at: string;
  updated_at: string;
};

export type SavedFilterInput = {
  scope: string;
  name: string;
  filters: Record<string, unknown>;
  columns?: StoredColumnPreference[] | null;
};

const SELECT_FIELDS = "id,scope,name,filters,columns,created_at,updated_at";

export async function listSavedFilters(scope: string) {
  const rows = await runSupabaseQuery<SavedFilterRecord[]>("filtros salvos", (signal) =>
    supabase
      .from("user_saved_filters")
      .select(SELECT_FIELDS)
      .eq("scope", scope)
      .order("name")
      .abortSignal(signal),
  );
  return rows ?? [];
}

export async function createSavedFilter(input: SavedFilterInput) {
  return runSupabaseQuery<SavedFilterRecord>("criação do filtro salvo", (signal) =>
    supabase
      .from("user_saved_filters")
      .insert({ ...input, name: input.name.trim(), columns: input.columns ?? null })
      .select(SELECT_FIELDS)
      .abortSignal(signal)
      .single(),
  );
}

export async function renameSavedFilter(id: string, name: string) {
  return runSupabaseQuery<SavedFilterRecord>("renomeação do filtro salvo", (signal) =>
    supabase
      .from("user_saved_filters")
      .update({ name: name.trim() })
      .eq("id", id)
      .select(SELECT_FIELDS)
      .abortSignal(signal)
      .single(),
  );
}

export async function updateSavedFilter(
  id: string,
  input: Pick<SavedFilterInput, "filters" | "columns">,
) {
  return runSupabaseQuery<SavedFilterRecord>("atualização do filtro salvo", (signal) =>
    supabase
      .from("user_saved_filters")
      .update({ filters: input.filters, columns: input.columns ?? null })
      .eq("id", id)
      .select(SELECT_FIELDS)
      .abortSignal(signal)
      .single(),
  );
}

export async function deleteSavedFilter(id: string) {
  await runSupabaseQuery<null>("exclusão do filtro salvo", (signal) =>
    supabase.from("user_saved_filters").delete().eq("id", id).abortSignal(signal),
  );
}
