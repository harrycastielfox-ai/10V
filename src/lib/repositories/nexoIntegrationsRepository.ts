import { supabase } from "@/lib/supabaseClient";
import { runSupabaseMutation, runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import type { NexoObservacao, NexoRegistroVinculado } from "@/features/nexo/nexoTypes";

const PAGE_SIZE = 1000;

export async function listNexoRegistrosVinculados(pessoaId?: string, organizacaoId?: string) {
  const all: NexoRegistroVinculado[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from("nexo_registros_vinculados")
      .select(
        "*,inquerito:inqueritos(numero_ppe,tipo,situacao),bo:boletins_ocorrencia(numero_bo,infracao_penal,status)",
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (pessoaId) query = query.eq("pessoa_id", pessoaId);
    if (organizacaoId) query = query.eq("organizacao_id", organizacaoId);
    const data = await runSupabaseQuery<NexoRegistroVinculado[]>(
      "vínculos procedimentais do NEXO",
      (signal) => query.abortSignal(signal),
    );
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return all;
  }
}

export async function listNexoObservacoesForReport(): Promise<NexoObservacao[]> {
  const all: NexoObservacao[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const data = await runSupabaseQuery<
      (Omit<NexoObservacao, "autor"> & {
        autor: { nome: string | null }[] | { nome: string | null } | null;
      })[]
    >("observações para o relatório NEXO", (signal) =>
      supabase
        .from("nexo_observacoes")
        .select(
          "id,pessoa_id,organizacao_id,conteudo,created_at,created_by,autor:profiles!nexo_observacoes_created_by_fkey(nome)",
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1)
        .abortSignal(signal),
    );
    all.push(
      ...(data ?? []).map((note) => ({
        ...note,
        autor: Array.isArray(note.autor) ? note.autor[0] || null : note.autor,
      })),
    );
    if (!data || data.length < PAGE_SIZE) return all;
  }
}

export async function createNexoRegistroVinculado(input: {
  pessoa_id?: string;
  organizacao_id?: string;
  inquerito_id?: string;
  bo_id?: string;
  observacao?: string;
}) {
  const data = await runSupabaseMutation<NexoRegistroVinculado>(
    "vínculo procedimental do NEXO",
    (signal) =>
      supabase
        .from("nexo_registros_vinculados")
        .insert(input)
        .select("*")
        .abortSignal(signal)
        .single(),
  );
  return data as NexoRegistroVinculado;
}

export async function deleteNexoRegistroVinculado(id: string) {
  await runSupabaseMutation("remoção do vínculo procedimental do NEXO", (signal) =>
    supabase.from("nexo_registros_vinculados").delete().eq("id", id).abortSignal(signal),
  );
}
