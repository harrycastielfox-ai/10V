import { supabase } from "@/lib/supabaseClient";
import { runSupabaseMutation, runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import type { BoRecord } from "@/features/bo/boTypes";
import type { InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import type { NexoProcedureContext } from "@/features/nexo/nexoProcedureAnalytics";
import type { NexoRegistroVinculado } from "@/features/nexo/nexoTypes";

const CONTEXT_SELECT =
  "id,inquerito_id,bo_id,data_fato,hora_fato,bairro,latitude,longitude,fonte,updated_at";
const PAGE_SIZE = 1000;

export async function listNexoProcedureSources(): Promise<{
  inquiries: InqueritoRecord[];
  reports: BoRecord[];
  links: NexoRegistroVinculado[];
}> {
  const [inquiries, reports, links] = await Promise.all([
    (async () => {
      const all: InqueritoRecord[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const page = await runSupabaseQuery<Partial<InqueritoRecord>[]>(
          "inquéritos para análise NEXO",
          (signal) =>
            supabase
              .from("inqueritos")
              .select(
                "id,codigo_interno,numero_ppe,numero_fisico,numero_bo,faccao,nome_faccao,categoria_criminal,gravidade,tipificacao,bairro,data_fato,situacao,created_at",
              )
              .is("deleted_at", null)
              .order("id")
              .range(offset, offset + PAGE_SIZE - 1)
              .abortSignal(signal),
        );
        all.push(...((page ?? []) as InqueritoRecord[]));
        if (!page || page.length < PAGE_SIZE) break;
      }
      return all;
    })(),
    (async () => {
      const all: BoRecord[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const page = await runSupabaseQuery<Partial<BoRecord>[]>(
          "B.O.s para análise NEXO",
          (signal) =>
            supabase
              .from("boletins_ocorrencia")
              .select("id,numero_bo,infracao_penal,status,inquerito_id,local_bairro,created_at")
              .is("deleted_at", null)
              .order("id")
              .range(offset, offset + PAGE_SIZE - 1)
              .abortSignal(signal),
        );
        all.push(...((page ?? []) as BoRecord[]));
        if (!page || page.length < PAGE_SIZE) break;
      }
      return all;
    })(),
    (async () => {
      const all: NexoRegistroVinculado[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const page = await runSupabaseQuery<Partial<NexoRegistroVinculado>[]>(
          "vínculos procedimentais NEXO",
          (signal) =>
            supabase
              .from("nexo_registros_vinculados")
              .select("id,pessoa_id,organizacao_id,inquerito_id,bo_id")
              .order("id")
              .range(offset, offset + PAGE_SIZE - 1)
              .abortSignal(signal),
        );
        all.push(...((page ?? []) as NexoRegistroVinculado[]));
        if (!page || page.length < PAGE_SIZE) break;
      }
      return all;
    })(),
  ]);
  return { inquiries, reports, links };
}

export async function listNexoProcedureContexts(): Promise<NexoProcedureContext[]> {
  const all: NexoProcedureContext[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await runSupabaseQuery<NexoProcedureContext[]>(
      "complementos analíticos dos procedimentos",
      (signal) =>
        supabase
          .from("nexo_procedimento_contextos")
          .select(CONTEXT_SELECT)
          .order("id")
          .range(offset, offset + PAGE_SIZE - 1)
          .abortSignal(signal),
    );
    all.push(...(page ?? []));
    if (!page || page.length < PAGE_SIZE) break;
  }
  return all;
}

export async function saveNexoProcedureContext(input: {
  kind: "inquerito" | "bo";
  procedureId: string;
  data_fato: string | null;
  hora_fato: string | null;
  bairro: string | null;
  latitude: number | null;
  longitude: number | null;
  fonte: string;
}): Promise<NexoProcedureContext> {
  const idColumn = input.kind === "inquerito" ? "inquerito_id" : "bo_id";
  const existing = await runSupabaseQuery<{ id: string } | null>(
    "complemento analítico existente",
    (signal) =>
      supabase
        .from("nexo_procedimento_contextos")
        .select("id")
        .eq(idColumn, input.procedureId)
        .abortSignal(signal)
        .maybeSingle(),
  );
  const payload = {
    data_fato: input.data_fato,
    hora_fato: input.hora_fato,
    bairro: input.bairro?.trim() || null,
    latitude: input.latitude,
    longitude: input.longitude,
    fonte: input.fonte.trim(),
  };
  const data = await runSupabaseMutation<NexoProcedureContext>(
    "complemento analítico do procedimento",
    (signal) =>
      existing
        ? supabase
            .from("nexo_procedimento_contextos")
            .update(payload)
            .eq("id", existing.id)
            .select(CONTEXT_SELECT)
            .abortSignal(signal)
            .single()
        : supabase
            .from("nexo_procedimento_contextos")
            .insert({
              ...payload,
              inquerito_id: input.kind === "inquerito" ? input.procedureId : null,
              bo_id: input.kind === "bo" ? input.procedureId : null,
            })
            .select(CONTEXT_SELECT)
            .abortSignal(signal)
            .single(),
  );
  return data as NexoProcedureContext;
}
