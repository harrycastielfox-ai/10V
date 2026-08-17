import { supabase } from "@/lib/supabaseClient";
import { runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import {
  repairUtf8Mojibake,
  slugifyProceduralTag,
  type ProceduralStatusHistory,
  type ProceduralTag,
  type ProceduralTagColor,
  type ProceduralTagScope,
} from "@/lib/proceduralTags";

const TAG_SELECT = "id,scope,name,slug,color,is_system,active,created_at,updated_at";

export async function listProceduralTags(scopes?: ProceduralTagScope[]) {
  const rows = await runSupabaseQuery<ProceduralTag[]>("catálogo de tags", (signal) => {
    let query = supabase
      .from("procedural_tags")
      .select(TAG_SELECT)
      .eq("active", true)
      .order("scope")
      .order("name")
      .abortSignal(signal);
    if (scopes?.length) query = query.in("scope", scopes);
    return query;
  });
  return (rows ?? []).map((tag) => ({
    ...tag,
    name: repairUtf8Mojibake(tag.name),
  })) as ProceduralTag[];
}

export async function createProceduralTag(input: {
  scope: ProceduralTagScope;
  name: string;
  color?: ProceduralTagColor;
}) {
  const name = repairUtf8Mojibake(input.name).trim().replace(/\s+/g, " ");
  const slug = slugifyProceduralTag(name);
  if (name.length < 2 || !slug) throw new Error("TAG_INVALID_NAME");

  const { data, error } = await supabase
    .from("procedural_tags")
    .insert({
      scope: input.scope,
      name,
      slug,
      color: input.color ?? "cyan",
    })
    .select(TAG_SELECT)
    .single();

  if (!error) return data as ProceduralTag;
  if (error.code !== "23505") throw error;

  const existing = await runSupabaseQuery<ProceduralTag | null>("tag existente", (signal) =>
    supabase
      .from("procedural_tags")
      .select(TAG_SELECT)
      .eq("scope", input.scope)
      .eq("slug", slug)
      .abortSignal(signal)
      .maybeSingle(),
  );
  if (existing) return existing as ProceduralTag;

  const existingByName = await runSupabaseQuery<ProceduralTag | null>(
    "tag existente pelo nome",
    (signal) =>
      supabase
        .from("procedural_tags")
        .select(TAG_SELECT)
        .eq("scope", input.scope)
        .eq("name", name)
        .abortSignal(signal)
        .maybeSingle(),
  );
  if (!existingByName) throw error;
  return existingByName as ProceduralTag;
}

export async function listInqueritoTagIds(inqueritoId: string) {
  const rows = await runSupabaseQuery<Array<{ tag_id: string }>>("tags do procedimento", (signal) =>
    supabase
      .from("inquerito_tag_links")
      .select("tag_id")
      .eq("inquerito_id", inqueritoId)
      .abortSignal(signal),
  );
  return (rows ?? []).map((row) => row.tag_id);
}

export async function listInqueritoTagLinks() {
  const rows = await runSupabaseQuery<Array<{ inquerito_id: string; tag_id: string }>>(
    "vínculos de tags dos procedimentos",
    (signal) =>
      supabase.from("inquerito_tag_links").select("inquerito_id,tag_id").abortSignal(signal),
  );
  return rows ?? [];
}

export async function replaceInqueritoTags(inqueritoId: string, tagIds: string[]) {
  await runSupabaseQuery<null>("atualização das tags do procedimento", (signal) =>
    supabase
      .rpc("replace_inquerito_tags", {
        p_inquerito_id: inqueritoId,
        p_tag_ids: [...new Set(tagIds)],
      })
      .abortSignal(signal),
  );
}

export async function listMovimentacaoTagIds(representacaoId: string) {
  const rows = await runSupabaseQuery<Array<{ tag_id: string }>>("tags da movimentação", (signal) =>
    supabase
      .from("movimentacao_tag_links")
      .select("tag_id")
      .eq("representacao_id", representacaoId)
      .abortSignal(signal),
  );
  return (rows ?? []).map((row) => row.tag_id);
}

export async function replaceMovimentacaoTags(representacaoId: string, tagIds: string[]) {
  await runSupabaseQuery<null>("atualização das tags da movimentação", (signal) =>
    supabase
      .rpc("replace_movimentacao_tags", {
        p_representacao_id: representacaoId,
        p_tag_ids: [...new Set(tagIds)],
      })
      .abortSignal(signal),
  );
}

export async function listInqueritoStatusHistory(inqueritoId: string) {
  const rows = await runSupabaseQuery<ProceduralStatusHistory[]>(
    "histórico de status do procedimento",
    (signal) =>
      supabase
        .from("procedural_status_history")
        .select(
          "id,entity_type,inquerito_id,representacao_id,previous_status_tag_id,status_tag_id,changed_by,changed_at,note",
        )
        .eq("inquerito_id", inqueritoId)
        .order("changed_at", { ascending: false })
        .abortSignal(signal),
  );
  return (rows ?? []) as ProceduralStatusHistory[];
}

export async function listMovimentacaoStatusHistory(representacaoId: string) {
  const rows = await runSupabaseQuery<ProceduralStatusHistory[]>(
    "histórico de status da movimentação",
    (signal) =>
      supabase
        .from("procedural_status_history")
        .select(
          "id,entity_type,inquerito_id,representacao_id,previous_status_tag_id,status_tag_id,changed_by,changed_at,note",
        )
        .eq("representacao_id", representacaoId)
        .order("changed_at", { ascending: false })
        .abortSignal(signal),
  );
  return (rows ?? []) as ProceduralStatusHistory[];
}
