import { runSupabaseMutation, runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import { supabase } from "@/lib/supabaseClient";

export type StoredColumnPreference = {
  id: string;
  visible: boolean;
  width: number;
  order: number;
};

export async function getTablePreferences(scope: string) {
  const row = await runSupabaseQuery<{ columns: StoredColumnPreference[] } | null>(
    "preferências da tabela",
    (signal) =>
      supabase
        .from("user_table_preferences")
        .select("columns")
        .eq("scope", scope)
        .abortSignal(signal)
        .maybeSingle(),
  );
  return row?.columns ?? null;
}

export async function saveTablePreferences(scope: string, columns: StoredColumnPreference[]) {
  await runSupabaseMutation<null>("gravação das preferências da tabela", (signal) =>
    supabase
      .from("user_table_preferences")
      .upsert({ scope, columns }, { onConflict: "user_id,scope" })
      .abortSignal(signal),
  );
}
