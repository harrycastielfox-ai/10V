import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, X } from "lucide-react";
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
  onOpenFull: () => void;
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
            <button
              type="button"
              onClick={onOpenFull}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-xs font-black uppercase tracking-[0.12em] text-emerald-950 shadow-[0_0_24px_rgba(52,211,153,0.2)] transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-[#090b0d]"
            >
              Abrir detalhe completo
              <ArrowUpRight className="h-4 w-4" />
            </button>
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
      value: formatBooleanText(record.cvli_elucidado ?? record.elucidado),
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
