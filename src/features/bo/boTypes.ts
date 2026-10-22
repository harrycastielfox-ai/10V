export const BO_STATUS_OPTIONS = [
  { value: "Pendente", label: "Pendente" },
  { value: "Em Andamento", label: "Em andamento" },
  { value: "Agendada", label: "Agendada" },
  { value: "Aguardando Terceiros", label: "Aguardando terceiros" },
  { value: "Concluida", label: "Concluída" },
  { value: "Cancelada", label: "Cancelada" },
  { value: "Suspensa", label: "Suspensa" },
  { value: "Aguardando Aprovacao/Revisao", label: "Aguardando aprovação/revisão" },
] as const;

export type BoStatus = (typeof BO_STATUS_OPTIONS)[number]["value"];
export type BoLinkType = "none" | "inquerito" | "representacao";
export type BoLocationCategory =
  | "area_influencia"
  | "ponto_venda"
  | "ponto_encontro"
  | "esconderijo"
  | "deposito"
  | "rota_operacional"
  | "outro";

export interface BoResponsavelOption {
  id: string;
  nome: string;
  funcao_institucional: string | null;
}

export interface BoRecord {
  id: string;
  numero_bo: string;
  infracao_penal: string;
  diligencias_pendentes: string | null;
  responsavel_nome: string | null;
  observacao: string | null;
  status: BoStatus;
  inquerito_id: string | null;
  representacao_id: string | null;
  local_categoria?: BoLocationCategory | null;
  local_logradouro?: string | null;
  local_numero?: string | null;
  local_bairro?: string | null;
  local_municipio?: string | null;
  local_uf?: string | null;
  local_ponto_referencia?: string | null;
  local_link_navegacao?: string | null;
  origem_registro: "sipi" | "google_sheets" | "migrado";
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

export type BoPayload = Pick<
  BoRecord,
  | "numero_bo"
  | "infracao_penal"
  | "diligencias_pendentes"
  | "responsavel_nome"
  | "observacao"
  | "status"
  | "inquerito_id"
  | "representacao_id"
  | "local_categoria"
  | "local_logradouro"
  | "local_numero"
  | "local_bairro"
  | "local_municipio"
  | "local_uf"
  | "local_ponto_referencia"
  | "local_link_navegacao"
>;

export function getBoStatusLabel(status: string | null | undefined) {
  return BO_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status ?? "Pendente";
}

export function normalizeBoText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function validateBoPayload(payload: BoPayload) {
  if (!payload.numero_bo.trim()) return "Informe o número do B.O.";
  if (!payload.infracao_penal.trim()) return "Informe a infração penal.";
  return null;
}

export function getBoStatusTone(status: string | null | undefined) {
  if (status === "Pendente") return "amber";
  if (status === "Em Andamento") return "blue";
  if (status === "Agendada") return "cyan";
  if (status === "Aguardando Terceiros" || status === "Aguardando Aprovacao/Revisao") {
    return "purple";
  }
  if (status === "Concluida") return "green";
  if (status === "Cancelada") return "red";
  return "slate";
}
