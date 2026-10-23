import { supabase } from "@/lib/supabaseClient";
import { runSupabaseMutation, runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import {
  currentSessionGeneration,
  isSessionGenerationCurrent,
  registerSessionCache,
} from "@/lib/sessionCache";

export type RepresentacaoRecord = {
  id: string;
  codigo_interno: string | null;
  inquerito_id: string | null;
  justificativa_sem_inquerito: string | null;
  numero_ppe: string | null;
  processo_judicial: string | null;
  tipo: string | null;
  tipo_normalizado: string | null;
  data_representacao: string | null;
  data_protocolo?: string | null;
  responsavel: string | null;
  vitima: string | null;
  investigado: string | null;
  autor_preso: string | null;
  resumo_fatos: string | null;
  fundamentacao: string | null;
  objetivo: string | null;
  diligencias_relacionadas: string | null;
  status: string | null;
  status_tag_id?: string | null;
  data_envio_judiciario: string | null;
  data_decisao_judicial: string | null;
  vara_juizo: string | null;
  prazo_concedido_dias: number | null;
  data_vencimento: string | null;
  observacoes_decisao: string | null;
  data_cumprimento: string | null;
  cumprimento_status: string | null;
  equipe_cumprimento: string | null;
  resultado_cumprimento: string | null;
  observacoes_cumprimento: string | null;
  prioridade_operacional: string | null;
  requisicao_origem?: string | null;
  requisicao_numero_documento?: string | null;
  requisicao_data_recebimento?: string | null;
  requisicao_prazo_dias?: number | null;
  requisicao_conteudo?: string | null;
  equipe_responsavel: string | null;
  acompanhamento_especial: boolean | null;
  pedido_sigiloso: string | null;
  pedido_sigiloso_normalizado: boolean | null;
  medida_protetiva_normalizada: boolean | null;
  observacoes_internas: string | null;
  observacoes_movimentacao?: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

export type RepresentacaoPayload = Partial<
  Omit<RepresentacaoRecord, "id" | "created_at" | "updated_at" | "deleted_at">
>;

export type RepresentacaoLinkOption = Pick<
  RepresentacaoRecord,
  "id" | "numero_ppe" | "processo_judicial" | "tipo" | "data_representacao" | "status"
>;

export type RepresentacaoPessoaPapel =
  "vitima" | "investigado_representado" | "testemunha" | "outro";

export type RepresentacaoPessoaRecord = {
  id: string;
  representacao_id: string;
  papel: RepresentacaoPessoaPapel;
  nome: string;
  observacao: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type RepresentacaoPessoaInput = Pick<
  RepresentacaoPessoaRecord,
  "papel" | "nome" | "observacao"
>;

const LIST_CACHE_TTL_MS = 10000;

let representacoesCache: { data: RepresentacaoRecord[]; fetchedAt: number } | null = null;
let representacoesPending: Promise<RepresentacaoRecord[]> | null = null;

function invalidateRepresentacoesCache() {
  representacoesCache = null;
}

registerSessionCache(() => {
  representacoesCache = null;
  representacoesPending = null;
});

export async function listRepresentacoes(options: { forceRefresh?: boolean } = {}) {
  if (representacoesPending) {
    return representacoesPending;
  }

  const now = Date.now();
  if (
    !options.forceRefresh &&
    representacoesCache &&
    now - representacoesCache.fetchedAt < LIST_CACHE_TTL_MS
  ) {
    return representacoesCache.data;
  }

  const generation = currentSessionGeneration();
  representacoesPending = runSupabaseQuery<RepresentacaoRecord[]>("representações", (signal) =>
    supabase
      .from("representacoes")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .abortSignal(signal),
  )
    .then((data) => {
      const rows = (data ?? []) as RepresentacaoRecord[];
      if (isSessionGenerationCurrent(generation)) {
        representacoesCache = { data: rows, fetchedAt: Date.now() };
      }
      return rows;
    })
    .finally(() => {
      if (isSessionGenerationCurrent(generation)) representacoesPending = null;
    });

  return representacoesPending;
}

export async function getRepresentacaoById(id: string) {
  const data = await runSupabaseQuery<RepresentacaoRecord | null>("representação", (signal) =>
    supabase
      .from("representacoes")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .abortSignal(signal)
      .maybeSingle(),
  );
  return data as RepresentacaoRecord | null;
}

export async function countRepresentacoesByInquerito(inqueritoId: string) {
  const rows = await runSupabaseQuery<Array<{ id: string }>>(
    "quantidade de movimentações do procedimento",
    (signal) =>
      supabase
        .from("representacoes")
        .select("id")
        .eq("inquerito_id", inqueritoId)
        .is("deleted_at", null)
        .limit(1000)
        .abortSignal(signal),
  );
  return (rows ?? []).length;
}

export async function listRepresentacoesByInquerito(inqueritoId: string, limit = 100) {
  const rows = await runSupabaseQuery<RepresentacaoRecord[]>(
    "movimentações do procedimento",
    (signal) =>
      supabase
        .from("representacoes")
        .select("*")
        .eq("inquerito_id", inqueritoId)
        .is("deleted_at", null)
        .order("data_protocolo", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(Math.max(1, Math.min(limit, 500)))
        .abortSignal(signal),
  );
  return (rows ?? []) as RepresentacaoRecord[];
}

export async function searchRepresentacoesForLink(query: string, limit = 20) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];
  const safeQuery = normalizedQuery.replace(/[%_(),]/g, "");
  if (safeQuery.length < 2) return [];

  const data = await runSupabaseQuery<RepresentacaoLinkOption[]>(
    "vínculo com representação",
    (signal) =>
      supabase
        .from("representacoes")
        .select("id,numero_ppe,processo_judicial,tipo,data_representacao,status")
        .or(
          `numero_ppe.ilike.%${safeQuery}%,processo_judicial.ilike.%${safeQuery}%,tipo.ilike.%${safeQuery}%`,
        )
        .is("deleted_at", null)
        .order("data_representacao", { ascending: false, nullsFirst: false })
        .limit(limit)
        .abortSignal(signal),
  );

  return (data ?? []) as RepresentacaoLinkOption[];
}

export async function listRepresentacaoPessoas(representacaoId: string) {
  const data = await runSupabaseQuery<RepresentacaoPessoaRecord[]>(
    "pessoas adicionais da representação",
    (signal) =>
      supabase
        .from("representacao_pessoas")
        .select("id, representacao_id, papel, nome, observacao, ordem, created_at, updated_at")
        .eq("representacao_id", representacaoId)
        .order("ordem", { ascending: true })
        .abortSignal(signal),
  );
  return (data ?? []) as RepresentacaoPessoaRecord[];
}

export async function listRepresentacaoPessoasByRepresentacaoIds(representacaoIds: string[]) {
  const uniqueIds = [...new Set(representacaoIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const data = await runSupabaseQuery<RepresentacaoPessoaRecord[]>(
    "pessoas das representações vinculadas",
    (signal) =>
      supabase
        .from("representacao_pessoas")
        .select("id, representacao_id, papel, nome, observacao, ordem, created_at, updated_at")
        .in("representacao_id", uniqueIds)
        .order("ordem", { ascending: true })
        .abortSignal(signal),
  );
  return (data ?? []) as RepresentacaoPessoaRecord[];
}

export async function replaceRepresentacaoPessoas(
  representacaoId: string,
  pessoas: RepresentacaoPessoaInput[],
) {
  const normalized = pessoas
    .map((person) => ({
      papel: person.papel,
      nome: person.nome.trim(),
      observacao: person.observacao?.trim() || null,
    }))
    .filter((person) => person.nome.length > 0);

  await runSupabaseMutation<null>("atualização das pessoas da representação", (signal) =>
    supabase
      .rpc("replace_representacao_pessoas", {
        p_representacao_id: representacaoId,
        p_pessoas: normalized,
      })
      .abortSignal(signal),
  );
}

export async function createRepresentacao(payload: RepresentacaoPayload) {
  const data = await runSupabaseMutation<RepresentacaoRecord>(
    "criação de representação",
    (signal) =>
      supabase.from("representacoes").insert(payload).select("*").abortSignal(signal).single(),
  );
  invalidateRepresentacoesCache();
  return data as RepresentacaoRecord;
}

export async function updateRepresentacao(id: string, payload: RepresentacaoPayload) {
  const data = await runSupabaseMutation<RepresentacaoRecord | null>(
    "atualização de representação",
    (signal) =>
      supabase
        .from("representacoes")
        .update(payload)
        .eq("id", id)
        .is("deleted_at", null)
        .select("*")
        .abortSignal(signal)
        .maybeSingle(),
  );

  if (import.meta.env.DEV) {
    console.debug("[representacoes:update] request", {
      id,
      payloadKeys: Object.keys(payload),
      rowReturned: Boolean(data),
    });
  }

  if (!data) {
    throw {
      code: "REPRESENTACAO_UPDATE_EMPTY",
      message: "Nenhuma linha retornada no update de representação.",
      details: "Verifique RLS de UPDATE/SELECT e filtros id/deleted_at.",
      status: 406,
    };
  }
  invalidateRepresentacoesCache();
  return data as RepresentacaoRecord;
}

export async function softDeleteRepresentacao(id: string) {
  await runSupabaseMutation<null>("exclusão de representação", (signal) =>
    supabase
      .from("representacoes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .abortSignal(signal),
  );
  invalidateRepresentacoesCache();
}
