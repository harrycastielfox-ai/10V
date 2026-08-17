import { supabase } from "@/lib/supabaseClient";
import { runSupabaseMutation, runSupabaseQuery } from "@/lib/repositories/supabaseQuery";
import type {
  AgendaConflito,
  AgendaOverviewStats,
  AgendaPeriodoFilters,
  AgendamentoPayload,
  AgendamentoRecord,
  ResponsavelOption,
} from "@/features/agenda/agendaTypes";

export async function listAgendamentosPeriodo(filters: AgendaPeriodoFilters) {
  const data = await runSupabaseQuery<AgendamentoRecord[]>("agenda do período", (signal) =>
    supabase
      .rpc("list_agendamentos_periodo", {
        p_inicio: filters.inicio,
        p_fim: filters.fim,
        p_responsavel_user_id: filters.responsavelUserId ?? null,
        p_status: filters.status ?? null,
        p_search: filters.search?.trim() || null,
        p_limit: filters.limit ?? 300,
      })
      .abortSignal(signal),
  );
  return (data ?? []) as AgendamentoRecord[];
}

export async function getAgendamentoById(id: string) {
  return runSupabaseQuery<AgendamentoRecord | null>("detalhes do agendamento", (signal) =>
    supabase
      .from("agendamentos")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .abortSignal(signal)
      .maybeSingle(),
  );
}

export async function getAgendaOverviewStats() {
  const data = await runSupabaseQuery<AgendaOverviewStats>("indicadores da agenda", (signal) =>
    supabase.rpc("agenda_overview_stats").abortSignal(signal),
  );
  return data as AgendaOverviewStats;
}

export async function listResponsaveis() {
  const data = await runSupabaseQuery<ResponsavelOption[]>("servidores da unidade", (signal) =>
    supabase.rpc("list_agenda_responsaveis").abortSignal(signal),
  );
  return (data ?? []) as ResponsavelOption[];
}

export async function checarConflitos(input: {
  dataHora: string;
  duracaoMinutos: number;
  responsavelUserId?: string | null;
  numeroBo?: string | null;
  inqueritoId?: string | null;
  qualificacao?: string | null;
  ignorarId?: string | null;
}) {
  const data = await runSupabaseQuery<AgendaConflito[]>("verificação de conflitos", (signal) =>
    supabase
      .rpc("agenda_conflitos", {
        p_data_hora: input.dataHora,
        p_duracao_minutos: input.duracaoMinutos,
        p_responsavel_user_id: input.responsavelUserId ?? null,
        p_numero_bo: input.numeroBo || null,
        p_inquerito_id: input.inqueritoId ?? null,
        p_qualificacao: input.qualificacao ?? null,
        p_ignorar_id: input.ignorarId ?? null,
      })
      .abortSignal(signal),
  );
  return (data ?? []) as AgendaConflito[];
}

export async function createAgendamento(payload: AgendamentoPayload) {
  return runSupabaseMutation<AgendamentoRecord>("cadastro do agendamento", (signal) =>
    supabase.from("agendamentos").insert(payload).select("*").abortSignal(signal).single(),
  );
}

export async function updateAgendamento(id: string, payload: Partial<AgendamentoPayload>) {
  return runSupabaseMutation<AgendamentoRecord>("atualização do agendamento", (signal) =>
    supabase
      .from("agendamentos")
      .update(payload)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .abortSignal(signal)
      .single(),
  );
}

export async function softDeleteAgendamento(id: string) {
  const deleted = await runSupabaseMutation<boolean>("exclusão do agendamento", (signal) =>
    supabase.rpc("soft_delete_agendamento", { p_agendamento_id: id }).abortSignal(signal),
  );

  if (!deleted) {
    throw { code: "PGRST116", message: "Agendamento não encontrado ou já excluído." };
  }

  return true;
}
