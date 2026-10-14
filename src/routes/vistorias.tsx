import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CarFront,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  ListChecks,
  LoaderCircle,
  MapPin,
  Plus,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SipiPrintSheet } from "@/components/SipiPrintSheet";
import {
  attachVehicleInspectionPdf,
  createVehicleInspection,
  listVehicleInspections,
  listVehicleInspectionVersions,
  listVehicleInspectionPhotos,
  listVehiclesForInspection,
  updateVehicleInspection,
  uploadVehicleInspectionPhotos,
  uploadVehicleInspectionPdf,
} from "@/lib/repositories/vistoriasRepository";
import type { VehicleInspection } from "@/features/vistorias/vistoriaTypes";
import {
  INSPECTION_PRESENTATION_REASONS,
  INSPECTION_PRESENTING_INSTITUTIONS,
  INSPECTION_PHOTO_CATEGORIES,
  INSPECTION_YARD_TYPES,
  type InspectionPresentationReason,
  type InspectionPresentingInstitution,
  type InspectionPhotoCategory,
  type InspectionYardType,
  type VehicleInspectionChecklist,
} from "@/features/vistorias/vistoriaTypes";

const PRESENTATION_REASON_LABELS: Record<string, string> = {
  suspeita_adulteracao_sinais: "Suspeita de adulteração de sinais",
  suspeita_clonagem: "Suspeita de clonagem",
  recuperacao_furto_roubo: "Recuperação (furto/roubo)",
  trafico_drogas: "Tráfico de drogas",
  acidente: "Acidente",
  local_crime: "Local de crime",
  verificacao: "Verificação",
  condutor_nao_habilitado: "Condutor não habilitado",
  instrumento_crime: "Instrumento de crime",
  veiculo_abandonado: "Veículo abandonado",
  outros: "Outros",
};
const INSTITUTION_LABELS: Record<string, string> = {
  policia_militar: "Polícia Militar",
  policia_civil: "Polícia Civil",
  policia_rodoviaria_federal: "Polícia Rodoviária Federal",
  policia_federal: "Polícia Federal",
  guarda_municipal: "Guarda Municipal",
  outros: "Outros",
};
const YARD_LABELS: Record<string, string> = {
  pericia: "Perícia",
  guincho: "Guincho",
  prf: "PRF",
  detran: "DETRAN",
  delegacia: "Delegacia",
  disep: "DISEP",
  outros: "Outros",
};
const PHOTO_CATEGORY_LABELS: Record<InspectionPhotoCategory, string> = {
  veiculo: "Veículo",
  chassi: "Chassi",
  motor: "Motor",
  etiqueta_seguranca: "Etiqueta de segurança",
  placa: "Placa",
  sinal_identificador: "Outro sinal identificador",
  outros: "Outros",
};
const CHECKLIST_ITEMS = [
  ["estepe", "Estepe"],
  ["chave_de_rodas", "Chave de rodas"],
  ["triangulo", "Triângulo"],
  ["macaco", "Macaco"],
  ["tapetes", "Tapetes"],
  ["chave_crv_crlv", "Chave/CRV/CRLV"],
  ["nivel_oleo", "Nível/óleo"],
  ["rodas_aro", "Rodas/aro"],
  ["quilometragem", "Quilometragem"],
] as const;

const CHECKLIST_STATUS_LABELS: Record<VehicleInspectionChecklist[string], string> = {
  presente: "Presente",
  ausente: "Ausente",
  nao_informado: "Não informado",
};

const INSPECTION_STATUS_LABELS: Record<VehicleInspection["status"], string> = {
  rascunho: "Em elaboração",
  emitido: "Relatório emitido",
  cancelado: "Cancelado",
};

const FORM_STEPS = [
  { id: 1, label: "Veículo", description: "Identificação e data", icon: CarFront },
  { id: 2, label: "Apresentação", description: "Origem e custódia", icon: Building2 },
  { id: 3, label: "Checklist", description: "Itens observados", icon: ListChecks },
  { id: 4, label: "Revisão", description: "Pessoas e observações", icon: UsersRound },
] as const;

type FormStep = (typeof FORM_STEPS)[number]["id"];

const FIELD_CLASS =
  "h-11 w-full rounded-xl border border-input bg-background/75 px-3 text-sm font-normal outline-none transition focus:border-primary/65 focus:ring-4 focus:ring-primary/10";
const TEXTAREA_CLASS =
  "w-full resize-y rounded-xl border border-input bg-background/75 px-3 py-3 text-sm font-normal outline-none transition focus:border-primary/65 focus:ring-4 focus:ring-primary/10";

function formatChecklist(checklist: VehicleInspectionChecklist): string | null {
  const entries = CHECKLIST_ITEMS.map(([key, label]) => {
    const value = checklist[key];
    return value && value !== "nao_informado"
      ? `${label}: ${CHECKLIST_STATUS_LABELS[value]}`
      : null;
  }).filter((entry): entry is string => Boolean(entry));
  return entries.length ? entries.join(" · ") : null;
}

export const Route = createFileRoute("/vistorias")({
  head: () => ({
    meta: [
      { title: "Relatórios de Vistoria — SIED" },
      {
        name: "description",
        content: "Vistorias de veículos com histórico, versões e rastreabilidade.",
      },
    ],
  }),
  component: VistoriasRoute,
});

function VistoriasRoute() {
  const [inspections, setInspections] = useState<VehicleInspection[]>([]);
  const [vehicles, setVehicles] = useState<
    Array<{ id: string; internal_id: string; brand_model: string | null; plate: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState<FormStep>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [policeReportNumber, setPoliceReportNumber] = useState("");
  const [presentationReason, setPresentationReason] = useState("");
  const [presentingInstitution, setPresentingInstitution] = useState("");
  const [yardType, setYardType] = useState("");
  const [yardLocation, setYardLocation] = useState("");
  const [deliveryRestricted, setDeliveryRestricted] = useState(false);
  const [checklist, setChecklist] = useState<VehicleInspectionChecklist>({});
  const [linkedPeopleText, setLinkedPeopleText] = useState("");
  const [printInspection, setPrintInspection] = useState<VehicleInspection | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editingInspection, setEditingInspection] = useState<VehicleInspection | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Record<string, Awaited<ReturnType<typeof listVehicleInspectionVersions>>>
  >({});
  const [expandedPhotosId, setExpandedPhotosId] = useState<string | null>(null);
  const [inspectionPhotos, setInspectionPhotos] = useState<
    Record<string, Awaited<ReturnType<typeof listVehicleInspectionPhotos>>>
  >({});
  const [photoCategory, setPhotoCategory] = useState<InspectionPhotoCategory>("veiculo");
  const [uploadingPhotosId, setUploadingPhotosId] = useState<string | null>(null);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;
  const informedChecklistItems = CHECKLIST_ITEMS.filter(
    ([key]) => checklist[key] && checklist[key] !== "nao_informado",
  ).length;
  const linkedPeopleCount = linkedPeopleText
    .split("\n")
    .map((person) => person.trim())
    .filter(Boolean).length;

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listVehicleInspections(), listVehiclesForInspection()])
      .then(([inspectionRows, vehicleRows]) => {
        if (cancelled) return;
        setInspections(inspectionRows);
        setVehicles(vehicleRows);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar os dados de vistoria.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function resetInspectionForm() {
    setEditingInspection(null);
    setFormStep(1);
    setVehicleId("");
    setInspectionDate(new Date().toISOString().slice(0, 10));
    setLocation("");
    setNotes("");
    setPoliceReportNumber("");
    setPresentationReason("");
    setPresentingInstitution("");
    setYardType("");
    setYardLocation("");
    setDeliveryRestricted(false);
    setChecklist({});
    setLinkedPeopleText("");
    setChangeReason("");
    setError(null);
  }

  function beginNewInspection() {
    resetInspectionForm();
    setShowForm(true);
  }

  function closeInspectionForm() {
    setShowForm(false);
    resetInspectionForm();
  }

  function goToNextStep() {
    if (formStep === 1 && !vehicleId) {
      setError("Selecione um veículo para continuar.");
      return;
    }
    setError(null);
    setFormStep((current) => Math.min(4, current + 1) as FormStep);
  }

  function goToPreviousStep() {
    setError(null);
    setFormStep((current) => Math.max(1, current - 1) as FormStep);
  }

  async function handleCreateInspection() {
    if (!vehicleId) {
      setError("Selecione um veículo antes de salvar a vistoria.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = {
        vehicle_id: vehicleId,
        inspection_date: inspectionDate,
        location,
        inspector_notes: notes,
        police_report_number: policeReportNumber,
        presentation_reason: (presentationReason || null) as InspectionPresentationReason | null,
        presenting_institution: (presentingInstitution ||
          null) as InspectionPresentingInstitution | null,
        yard_type: (yardType || null) as InspectionYardType | null,
        yard_location: yardLocation,
        delivery_restricted: deliveryRestricted,
        checklist,
        linked_people: linkedPeopleText
          .split("\n")
          .map((person) => person.trim())
          .filter(Boolean),
      };
      const saved = editingInspection
        ? await updateVehicleInspection(editingInspection.id, input, changeReason)
        : await createVehicleInspection(input);
      setInspections((current) =>
        editingInspection
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      setShowForm(false);
      resetInspectionForm();
    } catch {
      setError("Não foi possível salvar a vistoria. Verifique sua autorização e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(inspection: VehicleInspection) {
    setEditingInspection(inspection);
    setShowForm(true);
    setFormStep(1);
    setVehicleId(inspection.vehicle_id);
    setInspectionDate(inspection.inspection_date);
    setLocation(inspection.location ?? "");
    setNotes(inspection.inspector_notes ?? "");
    setPoliceReportNumber(inspection.police_report_number ?? "");
    setPresentationReason(inspection.presentation_reason ?? "");
    setPresentingInstitution(inspection.presenting_institution ?? "");
    setYardType(inspection.yard_type ?? "");
    setYardLocation(inspection.yard_location ?? "");
    setDeliveryRestricted(inspection.delivery_restricted);
    setChecklist(inspection.checklist ?? {});
    setLinkedPeopleText((inspection.linked_people ?? []).join("\n"));
    setChangeReason("");
  }

  async function toggleHistory(inspectionId: string) {
    if (expandedHistoryId === inspectionId) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(inspectionId);
    if (history[inspectionId]) return;
    try {
      const versions = await listVehicleInspectionVersions(inspectionId);
      setHistory((current) => ({ ...current, [inspectionId]: versions }));
    } catch {
      setError("Não foi possível carregar o histórico da vistoria.");
    }
  }

  async function handlePdfUpload(inspection: VehicleInspection, file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Selecione um arquivo PDF para anexar ao relatório.");
      return;
    }
    setUploadingId(inspection.id);
    setError(null);
    try {
      const uploaded = await uploadVehicleInspectionPdf(
        inspection.id,
        inspection.current_version,
        file,
      );
      const updated = await attachVehicleInspectionPdf(
        inspection.id,
        inspection.current_version,
        uploaded.path,
        uploaded.pdfSha256,
      );
      if (updated) {
        setInspections((current) =>
          current.map((item) => (item.id === inspection.id ? updated : item)),
        );
      }
    } catch {
      setError("Não foi possível anexar o PDF da vistoria.");
    } finally {
      setUploadingId(null);
    }
  }

  async function togglePhotos(inspectionId: string) {
    if (expandedPhotosId === inspectionId) {
      setExpandedPhotosId(null);
      return;
    }
    setExpandedPhotosId(inspectionId);
    if (inspectionPhotos[inspectionId]) return;
    try {
      const photos = await listVehicleInspectionPhotos(inspectionId);
      setInspectionPhotos((current) => ({ ...current, [inspectionId]: photos }));
    } catch {
      setError("Não foi possível carregar as fotografias técnicas da vistoria.");
    }
  }

  async function handlePhotoUpload(inspection: VehicleInspection, files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (!selected.length) return;
    setUploadingPhotosId(inspection.id);
    setError(null);
    try {
      const result = await uploadVehicleInspectionPhotos({
        inspectionId: inspection.id,
        vehicleId: inspection.vehicle_id,
        category: photoCategory,
        files: selected,
      });
      const refreshed = await listVehicleInspectionPhotos(inspection.id);
      setInspectionPhotos((current) => ({ ...current, [inspection.id]: refreshed }));
      setExpandedPhotosId(inspection.id);
      if (result.failed.length) {
        setError(`${result.failed.length} fotografia(s) não puderam ser processadas.`);
      }
    } catch {
      setError("Não foi possível vincular as fotografias técnicas à vistoria.");
    } finally {
      setUploadingPhotosId(null);
    }
  }

  const completedReports = inspections.filter((inspection) =>
    Boolean(inspection.pdf_sha256),
  ).length;
  const reportsAwaitingPdf = inspections.length - completedReports;
  const recordedVersions = inspections.reduce(
    (total, inspection) => total + inspection.current_version,
    0,
  );

  return (
    <AppLayout module="vistorias">
      <div className="w-full space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card/80 p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
                Módulo operacional
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight lg:text-3xl">
                Relatório de Vistoria
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Registre a vistoria do veículo e mantenha cada versão do relatório vinculada ao
                cadastro, ao responsável e ao histórico de alterações.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={beginNewInspection}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova vistoria
          </button>
        </header>

        {showForm && (
          <section className="overflow-hidden rounded-2xl border border-primary/30 bg-card/95 shadow-[0_18px_55px_-35px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 px-5 py-5 md:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                    {editingInspection ? "Nova versão" : "Nova vistoria"}
                  </p>
                  {editingInspection ? (
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      versão {editingInspection.current_version + 1}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-1 text-xl font-black tracking-tight">Cadastro guiado</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Preencha uma etapa por vez. Nada é gravado antes da confirmação final.
                </p>
              </div>
              <button
                type="button"
                onClick={closeInspectionForm}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Cancelar
              </button>
            </div>

            <div className="grid border-b border-border/80 bg-background/30 sm:grid-cols-2 xl:grid-cols-4">
              {FORM_STEPS.map((step) => {
                const StepIcon = step.icon;
                const active = step.id === formStep;
                const completed = step.id < formStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setFormStep(step.id)}
                    className={`flex items-center gap-3 border-b border-border/60 px-5 py-4 text-left transition sm:border-r xl:border-b-0 ${
                      active
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                    aria-current={active ? "step" : undefined}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                        active || completed
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border bg-background/60"
                      }`}
                    >
                      {completed ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">
                        {step.id}. {step.label}
                      </span>
                      <span className="block truncate text-[11px] opacity-75">
                        {step.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-5 md:p-6">
              {formStep === 1 ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CarFront className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-black">Identifique o veículo</h3>
                      <p className="text-xs text-muted-foreground">
                        A vistoria ficará vinculada permanentemente a este cadastro.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,0.7fr)]">
                    <label className="space-y-2 text-sm font-semibold">
                      Veículo cadastrado
                      <select
                        value={vehicleId}
                        onChange={(event) => {
                          setVehicleId(event.target.value);
                          setError(null);
                        }}
                        className={FIELD_CLASS}
                      >
                        <option value="">Selecione o veículo</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.internal_id} · {vehicle.plate || "sem placa"} ·{" "}
                            {vehicle.brand_model || "não informado"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm font-semibold">
                      Data da vistoria
                      <span className="relative block">
                        <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                        <input
                          type="date"
                          value={inspectionDate}
                          onChange={(event) => setInspectionDate(event.target.value)}
                          className={`${FIELD_CLASS} pl-10`}
                        />
                      </span>
                    </label>
                  </div>
                  {selectedVehicle ? (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-primary/8 p-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                          Veículo selecionado
                        </p>
                        <p className="mt-1 text-lg font-black">{selectedVehicle.internal_id}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedVehicle.brand_model || "Modelo não informado"} ·{" "}
                          {selectedVehicle.plate || "Sem placa"}
                        </p>
                      </div>
                      <CheckCircle2 className="h-7 w-7 text-primary" />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-background/45 p-4">
                      <div>
                        <p className="text-sm font-bold">O veículo ainda não está cadastrado?</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Cadastre primeiro e depois retorne para iniciar a vistoria.
                        </p>
                      </div>
                      <Link
                        to="/veiculos/novo"
                        className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/15"
                      >
                        <Plus className="h-4 w-4" /> Cadastrar veículo
                      </Link>
                    </div>
                  )}
                </div>
              ) : null}

              {formStep === 2 ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-black">Apresentação e custódia</h3>
                      <p className="text-xs text-muted-foreground">
                        Registre a origem, o motivo e o destino informado.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="space-y-2 text-sm font-semibold">
                      Número do B.O. / ocorrência
                      <input
                        value={policeReportNumber}
                        onChange={(event) => setPoliceReportNumber(event.target.value)}
                        placeholder="Ex.: 26-00705653"
                        className={FIELD_CLASS}
                      />
                    </label>
                    <label className="space-y-2 text-sm font-semibold">
                      Motivo da apresentação
                      <select
                        value={presentationReason}
                        onChange={(event) => setPresentationReason(event.target.value)}
                        className={FIELD_CLASS}
                      >
                        <option value="">Selecione...</option>
                        {INSPECTION_PRESENTATION_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {PRESENTATION_REASON_LABELS[reason]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm font-semibold">
                      Instituição que apresentou
                      <select
                        value={presentingInstitution}
                        onChange={(event) => setPresentingInstitution(event.target.value)}
                        className={FIELD_CLASS}
                      >
                        <option value="">Selecione...</option>
                        {INSPECTION_PRESENTING_INSTITUTIONS.map((institution) => (
                          <option key={institution} value={institution}>
                            {INSTITUTION_LABELS[institution]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm font-semibold">
                      Local da vistoria
                      <span className="relative block">
                        <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                        <input
                          value={location}
                          onChange={(event) => setLocation(event.target.value)}
                          placeholder="Pátio, unidade ou endereço"
                          className={`${FIELD_CLASS} pl-10`}
                        />
                      </span>
                    </label>
                    <label className="space-y-2 text-sm font-semibold">
                      Pátio / destino
                      <select
                        value={yardType}
                        onChange={(event) => setYardType(event.target.value)}
                        className={FIELD_CLASS}
                      >
                        <option value="">Selecione...</option>
                        {INSPECTION_YARD_TYPES.map((yard) => (
                          <option key={yard} value={yard}>
                            {YARD_LABELS[yard]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm font-semibold">
                      Local do pátio
                      <input
                        value={yardLocation}
                        onChange={(event) => setYardLocation(event.target.value)}
                        placeholder="Endereço ou identificação"
                        className={FIELD_CLASS}
                      />
                    </label>
                  </div>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${deliveryRestricted ? "border-warning/45 bg-warning/10" : "border-border bg-background/45"}`}
                  >
                    <input
                      type="checkbox"
                      checked={deliveryRestricted}
                      onChange={(event) => setDeliveryRestricted(event.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-bold">Restrição de entrega</span>
                      <span className="block text-xs text-muted-foreground">
                        Marque quando a liberação depender de autorização específica.
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}

              {formStep === 3 ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <ListChecks className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="font-black">Checklist observado</h3>
                        <p className="text-xs text-muted-foreground">
                          Informe somente o que foi efetivamente verificado.
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      {informedChecklistItems} de {CHECKLIST_ITEMS.length} informados
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {CHECKLIST_ITEMS.map(([key, label]) => {
                      const value = checklist[key] ?? "nao_informado";
                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-border bg-background/45 p-4"
                        >
                          <p className="text-sm font-bold">{label}</p>
                          <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-muted/45 p-1">
                            {(["presente", "ausente", "nao_informado"] as const).map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() =>
                                  setChecklist((current) => ({ ...current, [key]: status }))
                                }
                                className={`rounded-md px-2 py-2 text-[10px] font-bold transition ${
                                  value === status
                                    ? status === "presente"
                                      ? "bg-success/20 text-success"
                                      : status === "ausente"
                                        ? "bg-destructive/20 text-destructive"
                                        : "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {status === "nao_informado"
                                  ? "N/I"
                                  : CHECKLIST_STATUS_LABELS[status]}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {formStep === 4 ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(290px,0.55fr)]">
                  <div className="space-y-4">
                    <label className="space-y-2 text-sm font-semibold">
                      Pessoas vinculadas
                      <textarea
                        value={linkedPeopleText}
                        onChange={(event) => setLinkedPeopleText(event.target.value)}
                        rows={4}
                        placeholder="Uma pessoa por linha. Ex.: João da Silva — proprietário"
                        className={TEXTAREA_CLASS}
                      />
                      <span className="block text-xs font-normal text-muted-foreground">
                        Registre apenas identificação e vínculo informados no atendimento.
                      </span>
                    </label>
                    <label className="space-y-2 text-sm font-semibold">
                      Observações do vistoriador
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={5}
                        placeholder="Descreva somente o que foi observado"
                        className={TEXTAREA_CLASS}
                      />
                    </label>
                    {editingInspection ? (
                      <label className="space-y-2 text-sm font-semibold">
                        Motivo da alteração
                        <input
                          value={changeReason}
                          onChange={(event) => setChangeReason(event.target.value)}
                          placeholder="Ex.: correção da identificação do chassi"
                          className={FIELD_CLASS}
                        />
                      </label>
                    ) : null}
                  </div>
                  <aside className="h-fit rounded-2xl border border-primary/25 bg-primary/8 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                      Resumo antes de salvar
                    </p>
                    <dl className="mt-4 space-y-3 text-sm">
                      <ReviewRow
                        label="Veículo"
                        value={selectedVehicle?.internal_id || "Não selecionado"}
                      />
                      <ReviewRow label="Data" value={inspectionDate || "Não informada"} />
                      <ReviewRow label="B.O." value={policeReportNumber || "Não informado"} />
                      <ReviewRow
                        label="Instituição"
                        value={INSTITUTION_LABELS[presentingInstitution] || "Não informada"}
                      />
                      <ReviewRow label="Pátio" value={YARD_LABELS[yardType] || "Não informado"} />
                      <ReviewRow
                        label="Checklist"
                        value={`${informedChecklistItems}/${CHECKLIST_ITEMS.length} informado(s)`}
                      />
                      <ReviewRow label="Pessoas" value={`${linkedPeopleCount} vinculada(s)`} />
                    </dl>
                    <p className="mt-4 border-t border-primary/15 pt-4 text-xs leading-5 text-muted-foreground">
                      Revise os dados. O salvamento criará{" "}
                      {editingInspection
                        ? "uma nova versão preservando o histórico"
                        : "o primeiro registro da vistoria"}
                      .
                    </p>
                  </aside>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/25 px-5 py-4 md:px-6">
              <button
                type="button"
                onClick={goToPreviousStep}
                disabled={formStep === 1}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" /> Voltar
              </button>
              <span className="text-xs font-semibold text-muted-foreground">
                Etapa {formStep} de {FORM_STEPS.length}
              </span>
              {formStep < 4 ? (
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/15 transition hover:brightness-110"
                >
                  Continuar <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleCreateInspection()}
                  disabled={saving || loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/15 transition hover:brightness-110 disabled:opacity-60"
                >
                  {saving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardCheck className="h-4 w-4" />
                  )}
                  {saving
                    ? "Salvando..."
                    : editingInspection
                      ? "Salvar nova versão"
                      : "Salvar vistoria"}
                </button>
              )}
            </div>
          </section>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3" aria-label="Resumo das vistorias">
          <SummaryCard
            icon={FileCheck2}
            label="Relatórios emitidos"
            value={String(completedReports)}
            hint={
              inspections.length
                ? `${inspections.length} vistoria(s) registrada(s)`
                : "Aguardando o primeiro registro"
            }
            tone="text-primary"
          />
          <SummaryCard
            icon={FileClock}
            label="Em revisão"
            value={String(reportsAwaitingPdf)}
            hint="Aguardando anexo do PDF assinado"
            tone="text-warning"
          />
          <SummaryCard
            icon={ShieldCheck}
            label="Rastreabilidade"
            value={`${recordedVersions} ${recordedVersions === 1 ? "versão" : "versões"}`}
            hint="Autor, data, hash e histórico preservados"
            tone="text-success"
          />
        </section>

        <section className="rounded-2xl border border-border bg-card/50 p-6 shadow-sm">
          {loading ? (
            <div className="flex min-h-32 items-center justify-center text-muted-foreground">
              <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Carregando vistorias" />
            </div>
          ) : inspections.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Vistorias recentes</h2>
                <span className="text-xs text-muted-foreground">
                  {inspections.length} registro(s)
                </span>
              </div>
              {inspections.map((inspection) => (
                <article
                  key={inspection.id}
                  className="rounded-xl border border-border bg-background/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {inspection.vehicle?.internal_id || "Veículo não informado"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {inspection.vehicle?.brand_model || "Modelo não informado"} ·{" "}
                        {inspection.vehicle?.plate || "sem placa"}
                      </p>
                    </div>
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {INSPECTION_STATUS_LABELS[inspection.status]}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Vistoria em{" "}
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(`${inspection.inspection_date}T12:00:00`),
                    )}{" "}
                    · versão {inspection.current_version}
                  </p>
                  {inspection.police_report_number || inspection.presentation_reason ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {inspection.police_report_number
                        ? `B.O. ${inspection.police_report_number}`
                        : "B.O. não informado"}
                      {inspection.presentation_reason
                        ? ` · ${PRESENTATION_REASON_LABELS[inspection.presentation_reason] ?? inspection.presentation_reason}`
                        : ""}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => beginEdit(inspection)}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-accent"
                    >
                      Nova versão
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleHistory(inspection.id)}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-accent"
                    >
                      {expandedHistoryId === inspection.id ? "Ocultar histórico" : "Ver histórico"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrintInspection(inspection);
                        window.setTimeout(() => window.print(), 120);
                      }}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-accent"
                    >
                      Gerar impressão/PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => void togglePhotos(inspection.id)}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-accent"
                    >
                      {expandedPhotosId === inspection.id ? "Ocultar fotos" : "Ver fotos técnicas"}
                    </button>
                    <select
                      value={photoCategory}
                      onChange={(event) =>
                        setPhotoCategory(event.target.value as InspectionPhotoCategory)
                      }
                      aria-label="Categoria da fotografia técnica"
                      className="h-9 rounded-lg border border-input bg-background px-2 text-xs font-semibold"
                    >
                      {INSPECTION_PHOTO_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {PHOTO_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15">
                      {uploadingPhotosId === inspection.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Camera className="h-3.5 w-3.5" />
                      )}
                      Adicionar fotos
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="sr-only"
                        disabled={uploadingPhotosId !== null}
                        onChange={(event) => {
                          void handlePhotoUpload(inspection, event.target.files);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15">
                      {uploadingId === inspection.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Anexar PDF assinado
                      <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        disabled={uploadingId !== null}
                        onChange={(event) => {
                          void handlePdfUpload(inspection, event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {inspection.pdf_sha256 ? (
                      <span className="text-[11px] text-success">
                        PDF anexado · SHA-256 registrado
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        PDF ainda não anexado
                      </span>
                    )}
                  </div>
                  {expandedHistoryId === inspection.id ? (
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      {(history[inspection.id] ?? []).map((version) => (
                        <div
                          key={version.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-semibold">Versão {version.version}</span>
                          <span className="text-muted-foreground">
                            {version.change_reason || "Criação do relatório"} ·{" "}
                            {new Intl.DateTimeFormat("pt-BR").format(new Date(version.created_at))}
                          </span>
                          <span
                            className={
                              version.pdf_sha256 ? "text-success" : "text-muted-foreground"
                            }
                          >
                            {version.pdf_sha256 ? "PDF com hash" : "Sem PDF"}
                          </span>
                        </div>
                      ))}
                      {(history[inspection.id] ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma versão encontrada.</p>
                      ) : null}
                    </div>
                  ) : null}
                  {expandedPhotosId === inspection.id ? (
                    <div className="mt-4 border-t border-border pt-4">
                      {(inspectionPhotos[inspection.id] ?? []).length ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {(inspectionPhotos[inspection.id] ?? []).map((photo) => (
                            <figure
                              key={photo.id}
                              className="overflow-hidden rounded-lg border border-border bg-background"
                            >
                              {photo.vehicle_photo?.thumbnail_url ? (
                                <a
                                  href={
                                    photo.vehicle_photo.original_url ??
                                    photo.vehicle_photo.thumbnail_url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block aspect-video bg-muted"
                                >
                                  <img
                                    src={photo.vehicle_photo.thumbnail_url}
                                    alt={`Fotografia técnica: ${PHOTO_CATEGORY_LABELS[photo.category]}`}
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              ) : (
                                <div className="flex aspect-video items-center justify-center bg-muted text-xs text-muted-foreground">
                                  Prévia indisponível
                                </div>
                              )}
                              <figcaption className="px-3 py-2 text-xs font-semibold">
                                {PHOTO_CATEGORY_LABELS[photo.category]}
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Nenhuma fotografia técnica vinculada a esta vistoria.
                        </p>
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="p-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                <ClipboardCheck className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-lg font-bold">Nenhum relatório de vistoria registrado</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Comece pelo cadastro de veículos. O próximo passo do fluxo cria o relatório, gera o
                PDF e grava a versão com histórico no banco de dados.
              </p>
              <Link
                to="/veiculos"
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-accent"
              >
                Abrir cadastro de veículos
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
        {printInspection ? (
          <SipiPrintSheet
            documentTitle="Relatório de Vistoria Veicular"
            documentSubtitle="Registro operacional de vistoria"
            identifierLabel="ID DA VISTORIA"
            identifier={printInspection.id}
            variant="vehicle"
            summary={[
              { label: "Veículo", value: printInspection.vehicle?.internal_id },
              { label: "Placa", value: printInspection.vehicle?.plate },
              { label: "Data", value: printInspection.inspection_date },
              { label: "Local", value: printInspection.location },
              { label: "B.O./Ocorrência", value: printInspection.police_report_number },
            ]}
            sections={[
              {
                title: "Da apresentação",
                fields: [
                  {
                    label: "Motivo",
                    value: printInspection.presentation_reason
                      ? PRESENTATION_REASON_LABELS[printInspection.presentation_reason]
                      : null,
                  },
                  {
                    label: "Instituição apresentante",
                    value: printInspection.presenting_institution
                      ? INSTITUTION_LABELS[printInspection.presenting_institution]
                      : null,
                  },
                  {
                    label: "Pátio/destino",
                    value: printInspection.yard_type
                      ? YARD_LABELS[printInspection.yard_type]
                      : null,
                  },
                  { label: "Local do pátio", value: printInspection.yard_location },
                  {
                    label: "Restrição de entrega",
                    value: printInspection.delivery_restricted ? "Sim" : "Não",
                  },
                ],
              },
              {
                title: "Checklist observado",
                narrative: true,
                fields: [
                  {
                    label: "Itens",
                    value: formatChecklist(printInspection.checklist),
                    wide: true,
                  },
                ],
              },
              {
                title: "Pessoas vinculadas",
                narrative: true,
                fields: [
                  {
                    label: "Identificação e vínculo",
                    value: printInspection.linked_people?.join("\n"),
                    wide: true,
                  },
                ],
              },
              {
                title: "Observações",
                narrative: true,
                fields: [
                  {
                    label: "Registro do vistoriador",
                    value: printInspection.inspector_notes,
                    wide: true,
                    manualLine: true,
                  },
                ],
              },
            ]}
          />
        ) : null}
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof FileCheck2;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 ${tone}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-2xl font-black tracking-tight">{value}</span>
      </div>
      <p className="mt-4 text-sm font-bold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-primary/10 pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[62%] text-right font-bold text-foreground">{value}</dd>
    </div>
  );
}
