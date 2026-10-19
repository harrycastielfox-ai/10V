import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, FileText, Pencil, Scale, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { calculateInqueritoOperationalPriority } from "@/lib/inqueritosPriority";
import {
  VEHICLE_SITUATION_LABELS,
  VEHICLE_TYPE_LABELS,
} from "@/features/vehicles/vehicleConstants";
import type { VehicleListRecord, VehicleRecord } from "@/features/vehicles/vehicleTypes";
import { formatVehicleInvolvedPeople } from "@/features/vehicles/vehiclePeople";
import type { InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import type { RepresentacaoRecord } from "@/lib/repositories/representacoesRepository";
import { isCvliElucidado } from "@/lib/cvliMetrics";
import { getBoStatusLabel, type BoRecord } from "@/features/bo/boTypes";
import type { VehicleInspection } from "@/features/vistorias/vistoriaTypes";

const FALLBACK = "—";

type BadgeTone = "emerald" | "sky" | "amber" | "rose" | "violet" | "slate";

type PreviewBadge = {
  label: string;
  tone?: BadgeTone;
};

type SummaryItem = {
  label: string;
  value: ReactNode;
};

type RecordQuickPreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow: string;
  identifier: string;
  title: string;
  badges: PreviewBadge[];
  onOpenFull?: () => void;
  footer?: ReactNode;
  children: ReactNode;
};

const badgeToneClasses: Record<BadgeTone, string> = {
  emerald: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  sky: "border-sky-400/35 bg-sky-400/10 text-sky-300",
  amber: "border-amber-400/35 bg-amber-400/10 text-amber-300",
  rose: "border-rose-400/35 bg-rose-400/10 text-rose-300",
  violet: "border-violet-400/35 bg-violet-400/10 text-violet-300",
  slate: "border-slate-400/25 bg-slate-400/10 text-slate-300",
};

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function displayValue(value?: string | number | null) {
  if (value == null) return FALLBACK;
  const text = String(value).trim();
  return text || FALLBACK;
}

function firstValue(...values: Array<string | number | null | undefined>) {
  for (const value of values) {
    const displayed = displayValue(value);
    if (displayed !== FALLBACK) return displayed;
  }
  return FALLBACK;
}

function pickUnknown(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const displayed = displayValue(value);
      if (displayed !== FALLBACK) return displayed;
    }
    if (typeof value === "boolean") return value ? "Sim" : "Não";
  }
  return FALLBACK;
}

function formatDate(value?: string | null) {
  if (!value?.trim()) return FALLBACK;
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/u.exec(value);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR").format(parsed);
}

function formatBooleanText(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return displayValue(value);
}

function priorityTone(value?: string | null): BadgeTone {
  const normalized = normalizeText(value);
  if (normalized.includes("alta") || normalized.includes("urgente")) return "rose";
  if (normalized.includes("media")) return "amber";
  if (normalized.includes("baixa")) return "emerald";
  return "slate";
}

function statusTone(value?: string | null): BadgeTone {
  const normalized = normalizeText(value);
  if (
    normalized.includes("conclu") ||
    normalized.includes("cumprid") ||
    normalized.includes("deferid")
  ) {
    return "emerald";
  }
  if (
    normalized.includes("vencid") ||
    normalized.includes("indeferid") ||
    normalized.includes("cancel")
  ) {
    return "rose";
  }
  if (
    normalized.includes("pend") ||
    normalized.includes("aguard") ||
    normalized.includes("andamento")
  ) {
    return "amber";
  }
  return "sky";
}

function RecordQuickPreview({
  open,
  onOpenChange,
  eyebrow,
  identifier,
  title,
  badges,
  onOpenFull,
  footer,
  children,
}: RecordQuickPreviewProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="record-quick-preview fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/10 bg-[#090b0d] text-white shadow-[-24px_0_70px_rgba(0,0,0,0.55)] outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right sm:max-w-[480px]">
          <header className="record-quick-preview-header shrink-0 border-b border-white/10 px-5 pb-5 pt-6 sm:px-6">
            <div className="pr-12">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
                {eyebrow}
              </p>
              <Dialog.Title className="record-quick-preview-title mt-2 break-words font-mono text-xl font-black tracking-tight text-white">
                {identifier}
              </Dialog.Title>
              <Dialog.Description className="record-quick-preview-description mt-1 line-clamp-2 text-sm leading-6 text-zinc-400">
                {title}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar visualização rápida"
                className="record-quick-preview-close absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
            <div className="mt-4 flex flex-wrap gap-2">
              {badges.map((badge, index) => (
                <span
                  key={`${badge.label}-${index}`}
                  className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${badgeToneClasses[badge.tone ?? "slate"]}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="space-y-4">{children}</div>
          </div>

          <footer className="record-quick-preview-footer shrink-0 border-t border-white/10 bg-[#090b0d]/95 p-4 backdrop-blur sm:px-6">
            {footer ?? (
              <button
                type="button"
                onClick={onOpenFull}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-xs font-black uppercase tracking-[0.12em] text-emerald-950 shadow-[0_0_24px_rgba(52,211,153,0.2)] transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-[#090b0d]"
              >
                Abrir detalhe completo
                <ArrowUpRight className="h-4 w-4" />
              </button>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PreviewSection({
  title,
  items,
  children,
}: {
  title: string;
  items?: SummaryItem[];
  children?: ReactNode;
}) {
  return (
    <section>
      <h3 className="record-quick-preview-section-title mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-500">
        {title}
      </h3>
      <div className="record-quick-preview-section border-y border-white/10">
        {items?.map((item) => (
          <div
            key={item.label}
            className="record-quick-preview-row grid min-h-11 grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-center gap-4 border-b border-white/[0.07] py-2 last:border-b-0"
          >
            <p className="record-quick-preview-label text-[10px] font-bold uppercase leading-5 tracking-[0.12em] text-zinc-500">
              {item.label}
            </p>
            <p className="record-quick-preview-value line-clamp-2 min-w-0 break-words text-right text-sm font-medium leading-5 text-zinc-100">
              {item.value ?? FALLBACK}
            </p>
          </div>
        ))}
        {children}
      </div>
    </section>
  );
}

export function InqueritoQuickPreview({
  record,
  linkedRepresentations,
  onClose,
  onOpenFull,
}: {
  record: InqueritoRecord | null;
  linkedRepresentations: RepresentacaoRecord[];
  onClose: () => void;
  onOpenFull: () => void;
}) {
  if (!record) return null;

  const raw = record as unknown as Record<string, unknown>;
  const procedureType = firstValue(record.tipo_procedimento_normalizado, record.tipo);
  const situation = firstValue(record.situacao, record.status_diligencias);
  const priority = calculateInqueritoOperationalPriority(raw);
  const category = firstValue(record.categoria_criminal);
  const isPrisoner =
    record.reu_preso_normalizado === true ||
    ["sim", "preso", "reu preso"].includes(normalizeText(record.reu_preso));
  const identifier = firstValue(record.numero_ppe, record.codigo_interno);
  const factSummary = pickUnknown(raw, "resumo_fato", "resumo_fatos", "resumoDoFato");
  const dueDate = firstValue(pickUnknown(raw, "data_limite", "dataLimite"), record.prazo);
  const linkedRepresentationsLabel =
    linkedRepresentations.length > 0 ? `${linkedRepresentations.length} vinculada(s)` : FALLBACK;

  const badges: PreviewBadge[] = [];
  if (procedureType !== FALLBACK) badges.push({ label: procedureType, tone: "emerald" });
  if (situation !== FALLBACK) badges.push({ label: situation, tone: statusTone(situation) });
  badges.push({ label: priority, tone: priorityTone(priority) });
  if (category !== FALLBACK) badges.push({ label: category, tone: "violet" });

  if (isPrisoner) badges.push({ label: "Réu preso", tone: "rose" });

  const mainItems: SummaryItem[] = [
    { label: "Vítima", value: displayValue(record.vitima) },
    { label: "Autor / investigado", value: displayValue(record.investigado) },
    { label: "Autoria", value: displayValue(record.autoria_determinada) },
    {
      label: "Bairro / cidade",
      value: firstValue(record.bairro, record.cidade, record.distrito),
    },
    { label: "Facção", value: firstValue(record.nome_faccao, record.faccao) },
    {
      label: "Elucidado",
      value: formatBooleanText(isCvliElucidado(record)),
    },
    { label: "Movimentações processuais", value: linkedRepresentationsLabel },
    {
      label: "Observações e diligências",
      value: firstValue(record.diligencias_pendentes, record.observacoes),
    },
    { label: "Resumo do fato", value: factSummary },
  ]
    .filter((item) => item.value !== FALLBACK)
    .slice(0, 11);

  if (mainItems.length < 11 && dueDate !== FALLBACK) {
    mainItems.push({ label: "Data limite", value: formatDate(dueDate) });
  }

  return (
    <RecordQuickPreview
      open
      onOpenChange={(open) => !open && onClose()}
      eyebrow="Visualização rápida · Procedimento policial"
      identifier={identifier}
      title={displayValue(record.tipificacao)}
      badges={badges}
      onOpenFull={onOpenFull}
    >
      <PreviewSection title="Informações principais" items={mainItems} />
    </RecordQuickPreview>
  );
}

const INSPECTION_STATUS_PREVIEW_LABELS: Record<VehicleInspection["status"], string> = {
  rascunho: "Em elaboração",
  emitido: "Relatório emitido",
  cancelado: "Cancelado",
};

const INSPECTION_REASON_PREVIEW_LABELS: Record<string, string> = {
  suspeita_adulteracao_sinais: "Suspeita de adulteração de sinais",
  suspeita_clonagem: "Suspeita de clonagem",
  recuperacao_furto_roubo: "Recuperação de furto/roubo",
  trafico_drogas: "Tráfico de drogas",
  acidente: "Acidente",
  local_crime: "Local de crime",
  verificacao: "Verificação",
  condutor_nao_habilitado: "Condutor não habilitado",
  instrumento_crime: "Instrumento de crime",
  veiculo_abandonado: "Veículo abandonado",
  outros: "Outros",
};

const INSPECTION_INSTITUTION_PREVIEW_LABELS: Record<string, string> = {
  policia_militar: "Polícia Militar",
  policia_civil: "Polícia Civil",
  policia_rodoviaria_federal: "Polícia Rodoviária Federal",
  policia_federal: "Polícia Federal",
  guarda_municipal: "Guarda Municipal",
  outros: "Outros",
};

export function VehicleInspectionQuickPreview({
  record,
  onClose,
  onOpenDetails,
  onViewPdf,
  onEdit,
  busy = false,
}: {
  record: VehicleInspection | null;
  onClose: () => void;
  onOpenDetails: () => void;
  onViewPdf: () => void;
  onEdit: () => void;
  busy?: boolean;
}) {
  if (!record) return null;

  const status = INSPECTION_STATUS_PREVIEW_LABELS[record.status];
  const vehicleTitle = [record.vehicle?.brand_model, record.vehicle?.plate]
    .filter(Boolean)
    .join(" · ");
  const identifier = firstValue(
    record.vehicle?.internal_id,
    record.police_report_number,
    `Vistoria ${record.current_version}`,
  );
  const badges: PreviewBadge[] = [
    { label: status, tone: statusTone(status) },
    { label: `Versão ${record.current_version}`, tone: "violet" },
    {
      label: record.pdf_sha256 ? "PDF assinado" : "PDF pendente",
      tone: record.pdf_sha256 ? "emerald" : "amber",
    },
  ];

  const mainItems: SummaryItem[] = [
    { label: "B.O. / ocorrência", value: displayValue(record.police_report_number) },
    { label: "Data da vistoria", value: formatDate(record.inspection_date) },
    {
      label: "Motivo",
      value: record.presentation_reason
        ? INSPECTION_REASON_PREVIEW_LABELS[record.presentation_reason]
        : FALLBACK,
    },
    {
      label: "Instituição",
      value: record.presenting_institution
        ? INSPECTION_INSTITUTION_PREVIEW_LABELS[record.presenting_institution]
        : FALLBACK,
    },
    { label: "Local da vistoria", value: displayValue(record.location) },
    { label: "Local do pátio", value: displayValue(record.yard_location) },
    { label: "Restrição de entrega", value: record.delivery_restricted ? "Sim" : "Não" },
    {
      label: "Pessoas vinculadas",
      value: record.linked_people?.length ? `${record.linked_people.length} pessoa(s)` : FALLBACK,
    },
  ].filter((item) => item.value !== FALLBACK);

  const findingItems: SummaryItem[] = [
    { label: "Identificação e sinais", value: displayValue(record.findings?.identification) },
    { label: "Estrutura e integridade", value: displayValue(record.findings?.structure) },
    { label: "Conservação", value: displayValue(record.findings?.conservation) },
    { label: "Acessórios", value: displayValue(record.findings?.accessories) },
  ].filter((item) => item.value !== FALLBACK);

  return (
    <RecordQuickPreview
      open
      onOpenChange={(open) => !open && onClose()}
      eyebrow="Visualização rápida · Vistoria veicular"
      identifier={identifier}
      title={vehicleTitle || "Veículo não informado"}
      badges={badges}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenDetails}
            className="inspection-preview-details col-span-2 flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-black uppercase tracking-[0.1em] text-primary-foreground shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_20%,transparent)] transition hover:bg-primary/90"
          >
            <ArrowUpRight className="h-4 w-4" /> Abrir detalhes
          </button>
          <button
            type="button"
            onClick={onViewPdf}
            disabled={busy}
            className="inspection-preview-pdf flex h-12 items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-4 text-xs font-black uppercase tracking-[0.1em] text-primary transition hover:bg-primary/15 disabled:cursor-wait disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            {busy ? "Abrindo..." : "Ver PDF"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inspection-preview-edit flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-xs font-black uppercase tracking-[0.1em] text-foreground shadow-sm transition hover:border-primary/45 hover:bg-primary/10 hover:text-primary"
          >
            <Pencil className="h-4 w-4" /> Editar
          </button>
        </div>
      }
    >
      <PreviewSection title="Informações principais" items={mainItems} />
      {findingItems.length ? <PreviewSection title="Constatações" items={findingItems} /> : null}
      {record.inspector_notes ? (
        <PreviewSection title="Observações">
          <p className="py-3 text-sm leading-6 text-zinc-300">{record.inspector_notes}</p>
        </PreviewSection>
      ) : null}
    </RecordQuickPreview>
  );
}

export function RepresentacaoQuickPreview({
  record,
  onClose,
  onOpenFull,
}: {
  record: RepresentacaoRecord | null;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  if (!record) return null;

  const identifier = firstValue(record.codigo_interno, record.processo_judicial, record.numero_ppe);
  const representationType = firstValue(record.tipo, record.tipo_normalizado);
  const situation = displayValue(record.status);
  const priority = displayValue(record.prioridade_operacional);
  const badges: PreviewBadge[] = [];
  if (representationType !== FALLBACK) {
    badges.push({ label: representationType, tone: "violet" });
  }
  if (situation !== FALLBACK) badges.push({ label: situation, tone: statusTone(situation) });
  if (priority !== FALLBACK) badges.push({ label: priority, tone: priorityTone(priority) });

  const mainItems: SummaryItem[] = [
    { label: "Procedimento vinculado", value: displayValue(record.numero_ppe) },
    { label: "Número do processo", value: displayValue(record.processo_judicial) },
    { label: "Data do protocolo", value: formatDate(record.data_protocolo) },
    { label: "Vara / juízo", value: displayValue(record.vara_juizo) },
    { label: "Cumprimento", value: displayValue(record.cumprimento_status) },
    { label: "Resultado", value: displayValue(record.resultado_cumprimento) },
    {
      label: "Observações",
      value: firstValue(record.observacoes_movimentacao, record.observacoes_decisao),
    },
    { label: "Sigilo", value: displayValue(record.pedido_sigiloso) },
  ]
    .filter((item) => item.value !== FALLBACK)
    .slice(0, 11);

  if (mainItems.length < 11 && record.data_vencimento?.trim()) {
    mainItems.push({ label: "Data limite", value: formatDate(record.data_vencimento) });
  }

  return (
    <RecordQuickPreview
      open
      onOpenChange={(open) => !open && onClose()}
      eyebrow="Visualização rápida · Movimentação processual"
      identifier={identifier}
      title={displayValue(record.tipo)}
      badges={badges}
      onOpenFull={onOpenFull}
    >
      <PreviewSection title="Informações principais" items={mainItems} />
    </RecordQuickPreview>
  );
}

export function VehicleQuickPreview({
  record,
  loading = false,
  error,
  onClose,
  onOpenFull,
}: {
  record: VehicleRecord | VehicleListRecord | null;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  if (!record) return null;

  const vehicle = record as Partial<VehicleRecord>;
  const brandModel = firstValue(
    vehicle.brand_model,
    [vehicle.brand, vehicle.model].filter(Boolean).join(" "),
  );
  const procedure = firstValue(
    [vehicle.procedure_type, vehicle.procedure_number].filter(Boolean).join(" "),
  );
  const years = firstValue(
    vehicle.manufacture_year && vehicle.model_year
      ? `${vehicle.manufacture_year}/${vehicle.model_year}`
      : (vehicle.manufacture_year ?? vehicle.model_year),
  );
  const identifier = vehicle.police_report_number?.trim()
    ? `B.O. ${vehicle.police_report_number.trim()}`
    : firstValue(vehicle.plate, "Veículo sem B.O. informado");

  const badges: PreviewBadge[] = [{ label: VEHICLE_TYPE_LABELS[record.vehicle_type], tone: "sky" }];
  if (vehicle.situation) {
    const situation = VEHICLE_SITUATION_LABELS[vehicle.situation];
    badges.push({ label: situation, tone: statusTone(situation) });
  }
  if (vehicle.occurrence_type?.trim()) {
    badges.push({ label: vehicle.occurrence_type, tone: "violet" });
  }
  if (vehicle.pending_identification) {
    badges.push({ label: "Identificação pendente", tone: "amber" });
  }

  const mainItems: SummaryItem[] = [
    { label: "Número do B.O.", value: displayValue(vehicle.police_report_number) },
    { label: "Placa", value: displayValue(vehicle.plate) },
    { label: "Renavam", value: displayValue(vehicle.renavam) },
    { label: "Chassi", value: displayValue(vehicle.chassis) },
    { label: "Número do motor", value: displayValue(vehicle.engine_number) },
    { label: "Cor", value: displayValue(vehicle.color) },
    { label: "Ano fabricação/modelo", value: years },
    { label: "Procedimento", value: procedure },
    { label: "Processo judicial", value: displayValue(vehicle.court_process_number) },
    { label: "Data da apreensão", value: formatDate(vehicle.seizure_date) },
    { label: "Local da apreensão", value: displayValue(vehicle.seizure_location) },
    {
      label: "Custódia / depósito",
      value: firstValue(vehicle.custody_location, vehicle.storage_location),
    },
    { label: "Responsável", value: displayValue(vehicle.custody_responsible) },
    { label: "Conservação", value: displayValue(vehicle.conservation_state) },
    {
      label: "Envolvidos",
      value: displayValue(formatVehicleInvolvedPeople(vehicle.involved_people)),
    },
    { label: "Observações", value: displayValue(vehicle.observations) },
  ]
    .filter((item) => item.value !== FALLBACK)
    .slice(0, 11);

  return (
    <RecordQuickPreview
      open
      onOpenChange={(open) => !open && onClose()}
      eyebrow="Visualização rápida · Veículo"
      identifier={identifier}
      title={brandModel}
      badges={badges}
      onOpenFull={onOpenFull}
    >
      <PreviewSection title="Informações preenchidas" items={mainItems} />
      {loading ? (
        <p className="text-xs font-medium text-zinc-500">
          Carregando informações complementares...
        </p>
      ) : null}
      {error ? <p className="text-xs font-medium text-amber-300">{error}</p> : null}
    </RecordQuickPreview>
  );
}

export type BoQuickPreviewLink = {
  type: "inquerito" | "representacao" | "none";
  label: string;
};

export function BoQuickPreview({
  record,
  link,
  canManage,
  deleting = false,
  onClose,
  onOpenFull,
  onDelete,
}: {
  record: BoRecord | null;
  link: BoQuickPreviewLink;
  canManage: boolean;
  deleting?: boolean;
  onClose: () => void;
  onOpenFull: () => void;
  onDelete: () => void;
}) {
  if (!record) return null;

  const statusLabel = getBoStatusLabel(record.status);
  const badges: PreviewBadge[] = [{ label: statusLabel, tone: statusTone(statusLabel) }];
  if (link.type !== "none") {
    badges.push({ label: link.label, tone: link.type === "representacao" ? "violet" : "emerald" });
  }

  const mainItems: SummaryItem[] = [
    { label: "Responsável", value: displayValue(record.responsavel_nome) },
    { label: "Infração penal", value: displayValue(record.infracao_penal) },
    { label: "Diligências pendentes", value: displayValue(record.diligencias_pendentes) },
    { label: "Observação", value: displayValue(record.observacao) },
    { label: "Cadastrado em", value: formatDate(record.created_at) },
  ].filter((item) => item.value !== FALLBACK);

  const LinkIcon = link.type === "representacao" ? Scale : FileText;

  return (
    <RecordQuickPreview
      open
      onOpenChange={(open) => !open && onClose()}
      eyebrow="Visualização rápida · Boletim de Ocorrência"
      identifier={record.numero_bo}
      title={displayValue(record.infracao_penal)}
      badges={badges}
      footer={
        <div
          className={`grid gap-2 ${canManage ? "grid-cols-[minmax(0,1fr)_120px]" : "grid-cols-1"}`}
        >
          <button
            type="button"
            onClick={onOpenFull}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-xs font-black uppercase tracking-[0.12em] text-emerald-950 shadow-[0_0_24px_rgba(52,211,153,0.2)] transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-[#090b0d]"
          >
            Ver ficha completa <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="flex h-13 items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-rose-300 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
          ) : null}
        </div>
      }
    >
      <PreviewSection title="Informações principais" items={mainItems} />
      <section>
        <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-500">
          Vínculo com procedimento
        </h3>
        {link.type === "none" ? (
          <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
            Este B.O. não possui procedimento vinculado.
          </p>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-400/10 text-violet-300">
              <LinkIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-zinc-100">
                {link.label}
              </span>
              <span className="block text-[10px] uppercase tracking-[0.1em] text-zinc-500">
                {link.type === "representacao" ? "Representação" : "Inquérito"}
              </span>
            </span>
          </div>
        )}
      </section>
    </RecordQuickPreview>
  );
}
