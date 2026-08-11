import { supabase } from "@/lib/supabaseClient";
import { runSupabaseQuery } from "@/lib/repositories/supabaseQuery";

export type InqueritoRecord = {
  id: string;
  codigo_interno: string | null;
  numero_ppe: string | null;
  numero_fisico: string | null;
  numero_bo: string | null;
  origem_registro: string | null;
  visibilidade: string | null;
  tipo: string | null;
  tipo_procedimento_normalizado: string | null;
  tipificacao: string | null;
  gravidade: string | null;
  categoria_criminal: string | null;
  prioridade: string | null;
  prioridade_operacional: string | null;
  situacao: string | null;
  status_tag_id?: string | null;
  status_diligencias: string | null;
  data_fato: string | null;
  data_instauracao: string | null;
  prazo: string | null;
  prazo_dias?: number | null;
  prazo_data_final?: string | null;
  prazo_manual?: boolean;
  dias_decorridos: string | null;
  bairro: string | null;
  distrito: string | null;
  cidade?: string | null;
  vitima: string | null;
  investigado: string | null;
  reu_preso: string | null;
  reu_preso_normalizado: boolean | null;
  elucidado: string | null;
  autoria_determinada: string | null;
  cvli_elucidado: boolean | null;
  data_elucidacao: string | null;
  houve_arma_fogo: string | null;
  arma_utilizada: string | null;
  faccao: string | null;
  nome_faccao: string | null;
  equipe: string | null;
  equipe_responsavel: string | null;
  escrivao: string | null;
  escrivao_responsavel_id: string | null;
  relatorio_enviado: string | null;
  relatorio_status: string | null;
  data_envio_relatorio: string | null;
  data_relatorio: string | null;
  medida_protetiva: string | null;
  medida_protetiva_normalizada: boolean | null;
  numero_processo_medida: string | null;
  representacoes_legais: string | null;
  diligencias_pendentes: string | null;
  delegado_responsavel: string | null;
  motivacao: string | null;
  resumo_fato?: string | null;
  observacoes: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

export type InqueritoPayload = Partial<
  Omit<InqueritoRecord, "id" | "created_at" | "updated_at" | "deleted_at">
>;

export type InqueritoLinkOption = Pick<
  InqueritoRecord,
  "id" | "numero_ppe" | "tipo" | "tipo_procedimento_normalizado" | "data_instauracao" | "situacao"
>;

export type InqueritoPessoaPapel = "vitima" | "autor_investigado" | "testemunha" | "outro";

export type InqueritoPessoaRecord = {
  id: string;
  inquerito_id: string;
  papel: InqueritoPessoaPapel;
  nome: string;
  observacao: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type InqueritoPessoaInput = Pick<
  InqueritoPessoaRecord,
  "papel" | "nome" | "observacao" | "ordem"
>;

const LIST_CACHE_TTL_MS = 10000;

let inqueritosCache: { data: InqueritoRecord[]; fetchedAt: number } | null = null;
let inqueritosPending: Promise<InqueritoRecord[]> | null = null;

function invalidateInqueritosCache() {
  inqueritosCache = null;
}

export async function listInqueritos(options: { forceRefresh?: boolean } = {}) {
  if (inqueritosPending) {
    return inqueritosPending;
  }

  const now = Date.now();
  if (
    !options.forceRefresh &&
    inqueritosCache &&
    now - inqueritosCache.fetchedAt < LIST_CACHE_TTL_MS
  ) {
    return inqueritosCache.data;
  }

  inqueritosPending = runSupabaseQuery<InqueritoRecord[]>("inquéritos", (signal) =>
    supabase
      .from("inqueritos")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .abortSignal(signal),
  )
    .then((data) => {
      const rows = (data ?? []) as InqueritoRecord[];
      inqueritosCache = { data: rows, fetchedAt: Date.now() };
      return rows;
    })
    .finally(() => {
      inqueritosPending = null;
    });

  return inqueritosPending;
}

export async function getInqueritoById(id: string) {
  const data = await runSupabaseQuery<InqueritoRecord | null>("inquérito", (signal) =>
    supabase
      .from("inqueritos")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .abortSignal(signal)
      .maybeSingle(),
  );
  return data as InqueritoRecord | null;
}

export async function listInqueritoPessoas(inqueritoId: string) {
  const data = await runSupabaseQuery<InqueritoPessoaRecord[]>(
    "pessoas envolvidas no inquérito",
    (signal) =>
      supabase
        .from("inquerito_pessoas")
        .select("id,inquerito_id,papel,nome,observacao,ordem,created_at,updated_at")
        .eq("inquerito_id", inqueritoId)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true })
        .abortSignal(signal),
  );

  return (data ?? []) as InqueritoPessoaRecord[];
}

export async function replaceInqueritoPessoas(
  inqueritoId: string,
  pessoas: InqueritoPessoaInput[],
) {
  const normalized = pessoas
    .map((person, index) => ({
      papel: person.papel,
      nome: person.nome.trim(),
      observacao: person.observacao?.trim() || null,
      ordem: index,
    }))
    .filter((person) => person.nome.length > 0);

  await runSupabaseQuery<unknown>("atualização das pessoas envolvidas", (signal) =>
    supabase
      .rpc("replace_inquerito_pessoas", {
        p_inquerito_id: inqueritoId,
        p_pessoas: normalized,
      })
      .abortSignal(signal),
  );
}

export async function findInqueritosByPpe(numeroPpe: string, limit = 8) {
  const normalizedPpe = numeroPpe.trim();
  if (!normalizedPpe) return [];

  const data = await runSupabaseQuery<InqueritoLinkOption[]>("busca por PPE", (signal) =>
    supabase
      .from("inqueritos")
      .select("id,numero_ppe,tipo,tipo_procedimento_normalizado,data_instauracao,situacao")
      .eq("numero_ppe", normalizedPpe)
      .is("deleted_at", null)
      .order("data_instauracao", { ascending: false, nullsFirst: false })
      .limit(limit)
      .abortSignal(signal),
  );

  return (data ?? []) as InqueritoLinkOption[];
}

export async function listKnownInqueritoBairros(limit = 500) {
  const rows = await runSupabaseQuery<Array<{ bairro: string | null }>>(
    "bairros dos procedimentos",
    (signal) =>
      supabase
        .from("inqueritos")
        .select("bairro")
        .is("deleted_at", null)
        .not("bairro", "is", null)
        .order("bairro", { ascending: true })
        .limit(limit)
        .abortSignal(signal),
  );

  return [...new Set((rows ?? []).map((row) => row.bairro?.trim()).filter(Boolean) as string[])];
}

export async function searchInqueritosForLink(query: string, limit = 20) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];
  const safeQuery = normalizedQuery.replace(/[%_]/g, "");

  const data = await runSupabaseQuery<InqueritoLinkOption[]>("vinculo por PPE", (signal) =>
    supabase
      .from("inqueritos")
      .select("id,numero_ppe,tipo,tipo_procedimento_normalizado,data_instauracao,situacao")
      .ilike("numero_ppe", `%${safeQuery}%`)
      .is("deleted_at", null)
      .order("data_instauracao", { ascending: false, nullsFirst: false })
      .limit(limit)
      .abortSignal(signal),
  );

  return (data ?? []) as InqueritoLinkOption[];
}

export async function createInquerito(payload: InqueritoPayload) {
  const data = await runSupabaseQuery<InqueritoRecord>("criação de inquérito", (signal) =>
    supabase.from("inqueritos").insert(payload).select("*").abortSignal(signal).single(),
  );
  invalidateInqueritosCache();
  return data as InqueritoRecord;
}

export async function updateInquerito(id: string, payload: InqueritoPayload) {
  const data = await runSupabaseQuery<InqueritoRecord>("atualização de inquérito", (signal) =>
    supabase
      .from("inqueritos")
      .update(payload)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .abortSignal(signal)
      .single(),
  );
  invalidateInqueritosCache();
  return data as InqueritoRecord;
}

export async function softDeleteInquerito(id: string) {
  const deleted = await runSupabaseQuery<boolean>("exclusão de inquérito", (signal) =>
    supabase.rpc("soft_delete_inquerito", { p_id: id }).abortSignal(signal),
  );

  if (!deleted) {
    throw {
      code: "PGRST116",
      message: "Inquérito não encontrado ou já excluído.",
    };
  }

  invalidateInqueritosCache();
  return true;
}
