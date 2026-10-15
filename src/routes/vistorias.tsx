import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
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
  ExternalLink,
  Eye,
  FileCheck2,
  FileClock,
  FileText,
  History,
  ListChecks,
  LoaderCircle,
  MapPin,
  Printer,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { VehicleInspectionQuickPreview } from "@/components/RecordQuickPreview";
import { VehicleInspectionPrintSheet } from "@/components/VehicleInspectionPrintSheet";
import {
  attachVehicleInspectionPdf,
  createVehicleInspection,
  getVehicleInspectionPdfUrl,
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
  const navigate = useNavigate();
  const isVistoriasIndex = useRouterState({
    select: (state) => state.location.pathname.replace(/\/$/u, "") === "/vistorias",
  });
  const [inspections, setInspections] = useState<VehicleInspection[]>([]);
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof listVehiclesForInspection>>>(
    [],
  );
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
  const [identificationFindings, setIdentificationFindings] = useState("");
  const [structureFindings, setStructureFindings] = useState("");
  const [conservationFindings, setConservationFindings] = useState("");
  const [accessoriesFindings, setAccessoriesFindings] = useState("");
  const [linkedPeopleText, setLinkedPeopleText] = useState("");
  const [printInspection, setPrintInspection] = useState<VehicleInspection | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | VehicleInspection["status"]>("todos");
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
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
  const filteredInspections = inspections.filter((inspection) => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");
    const matchesStatus = statusFilter === "todos" || inspection.status === statusFilter;
    const matchesSearch =
      !normalizedSearch ||
      [
        inspection.vehicle?.internal_id,
        inspection.vehicle?.brand_model,
        inspection.vehicle?.plate,
        inspection.police_report_number,
        inspection.location,
      ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    return matchesStatus && matchesSearch;
  });
  const selectedInspection =
    inspections.find((inspection) => inspection.id === selectedInspectionId) ?? null;

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
    setIdentificationFindings("");
    setStructureFindings("");
    setConservationFindings("");
    setAccessoriesFindings("");
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
        findings: {
          identification: identificationFindings,
          structure: structureFindings,
          conservation: conservationFindings,
          accessories: accessoriesFindings,
          observations: notes,
        },
        original_vehicle_data:
          editingInspection?.original_vehicle_data ??
          (selectedVehicle
            ? {
                internal_id: selectedVehicle.internal_id,
                brand: selectedVehicle.brand,
                model: selectedVehicle.model,
                brand_model: selectedVehicle.brand_model,
                color: selectedVehicle.color,
                plate: selectedVehicle.plate,
                engine_number: selectedVehicle.engine_number,
                chassis: selectedVehicle.chassis,
                manufacture_year: selectedVehicle.manufacture_year,
                model_year: selectedVehicle.model_year,
                conservation_state: selectedVehicle.conservation_state,
              }
            : {}),
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
      setSelectedInspectionId(saved.id);
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
    setIdentificationFindings(inspection.findings?.identification ?? "");
    setStructureFindings(inspection.findings?.structure ?? "");
    setConservationFindings(inspection.findings?.conservation ?? "");
    setAccessoriesFindings(inspection.findings?.accessories ?? "");
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

  async function handlePrintInspection(inspection: VehicleInspection) {
    setPrintingId(inspection.id);
    setError(null);
    try {
      let photos = inspectionPhotos[inspection.id];
      if (!photos) {
        photos = await listVehicleInspectionPhotos(inspection.id);
        setInspectionPhotos((current) => ({ ...current, [inspection.id]: photos }));
      }
      setPrintInspection(inspection);
      const originalTitle = document.title;
      document.title = `Vistoria-${inspection.vehicle?.internal_id || inspection.id}-v${inspection.current_version}`;
      await new Promise((resolve) => window.setTimeout(resolve, 220));
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(".sipi-vistoria-print-photo"),
      );
      await Promise.all(
        images.map((image) =>
          image.complete ? Promise.resolve() : image.decode().catch(() => undefined),
        ),
      );
      window.addEventListener(
        "afterprint",
        () => {
          document.title = originalTitle;
          setPrintInspection(null);
        },
        { once: true },
      );
      window.print();
    } catch {
      setPrintInspection(null);
      setError("Não foi possível preparar o relatório completo para impressão.");
    } finally {
      setPrintingId(null);
    }
  }

  async function handleOpenSignedPdf(inspection: VehicleInspection) {
    if (!inspection.pdf_storage_path) return;
    const pdfWindow = window.open("about:blank", "_blank");
    if (pdfWindow) pdfWindow.opener = null;
    setOpeningPdfId(inspection.id);
    setError(null);
    try {
      const url = await getVehicleInspectionPdfUrl(inspection.pdf_storage_path);
      if (!pdfWindow) {
        throw new Error("O navegador bloqueou a janela do PDF.");
      }
      pdfWindow.location.href = url;
    } catch {
      pdfWindow?.close();
      setError("Não foi possível abrir o PDF assinado desta vistoria.");
    } finally {
      setOpeningPdfId(null);
    }
  }

  async function handleViewInspectionPdf(inspection: VehicleInspection) {
    if (inspection.pdf_storage_path) {
      await handleOpenSignedPdf(inspection);
      return;
    }
    await handlePrintInspection(inspection);
  }

  function handleEditFromPreview(inspection: VehicleInspection) {
    setSelectedInspectionId(null);
    beginEdit(inspection);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  const completedReports = inspections.filter((inspection) =>
    Boolean(inspection.pdf_sha256),
  ).length;
  const reportsAwaitingPdf = inspections.length - completedReports;
  const recordedVersions = inspections.reduce(
    (total, inspection) => total + inspection.current_version,
    0,
  );

  if (!isVistoriasIndex) return <Outlet />;

  return (
    <AppLayout module="vistorias">
      <div className="sipi-print-document w-full space-y-6">
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
            onClick={() => void navigate({ to: "/vistorias/nova" })}
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
                  <div className="border-t border-border/80 pt-5">
                    <div className="mb-4">
                      <h4 className="font-black">Constatações técnicas</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Descreva os sinais identificadores e as condições efetivamente observadas.
                        Esses registros compõem o relatório e o PDF.
                      </p>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2 text-sm font-semibold">
                        Identificação e sinais
                        <textarea
                          value={identificationFindings}
                          onChange={(event) => setIdentificationFindings(event.target.value)}
                          rows={4}
                          placeholder="Chassi, motor, etiquetas, placas e demais sinais examinados"
                          className={TEXTAREA_CLASS}
                        />
                      </label>
                      <label className="space-y-2 text-sm font-semibold">
                        Estrutura e integridade
                        <textarea
                          value={structureFindings}
                          onChange={(event) => setStructureFindings(event.target.value)}
                          rows={4}
                          placeholder="Carroceria, vidros, fechaduras, lacres e pontos estruturais"
                          className={TEXTAREA_CLASS}
                        />
                      </label>
                      <label className="space-y-2 text-sm font-semibold">
                        Estado de conservação
                        <textarea
                          value={conservationFindings}
                          onChange={(event) => setConservationFindings(event.target.value)}
                          rows={4}
                          placeholder="Condição externa, interna, avarias e funcionamento aparente"
                          className={TEXTAREA_CLASS}
                        />
                      </label>
                      <label className="space-y-2 text-sm font-semibold">
                        Acessórios e itens adicionais
                        <textarea
                          value={accessoriesFindings}
                          onChange={(event) => setAccessoriesFindings(event.target.value)}
                          rows={4}
                          placeholder="Som, ferramentas, objetos, adaptações ou outros acessórios"
                          className={TEXTAREA_CLASS}
                        />
                      </label>
                    </div>
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
                      <ReviewRow
                        label="Constatações"
                        value={`${
                          [
                            identificationFindings,
                            structureFindings,
                            conservationFindings,
                            accessoriesFindings,
                          ].filter((value) => value.trim()).length
                        }/4 preenchida(s)`}
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

        <section className="hidden" aria-hidden="true">
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

        <section className="rounded-2xl border border-border/80 bg-card/70 p-4 md:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black">Vistorias registradas</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {filteredInspections.length} de {inspections.length} registro(s) encontrado(s)
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-[280px]">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar veículo, placa, B.O. ou local"
                  aria-label="Buscar vistorias"
                  className={`${FIELD_CLASS} pl-10`}
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "todos" | VehicleInspection["status"])
                }
                aria-label="Filtrar vistorias por status"
                className={`${FIELD_CLASS} min-w-[190px]`}
              >
                <option value="todos">Todos os status</option>
                <option value="rascunho">Em elaboração</option>
                <option value="emitido">Relatório emitido</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-[0_10px_40px_rgba(0,0,0,0.22)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] table-fixed text-sm">
              <thead className="bg-muted/25 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="w-[20%] px-4 py-3 text-left font-bold">Vistoria</th>
                  <th className="w-[14%] px-3 py-3 text-left font-bold">Veículo</th>
                  <th className="w-[10%] px-3 py-3 text-left font-bold">Placa</th>
                  <th className="w-[13%] px-3 py-3 text-left font-bold">B.O. / ocorrência</th>
                  <th className="w-[11%] px-3 py-3 text-left font-bold">Data</th>
                  <th className="w-[12%] px-3 py-3 text-center font-bold">Status</th>
                  <th className="w-[10%] px-3 py-3 text-center font-bold">Documento</th>
                  <th className="w-[10%] px-3 py-3 text-center font-bold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-muted-foreground">
                      <LoaderCircle className="mx-auto h-6 w-6 animate-spin" />
                      <span className="mt-2 block text-xs">Carregando vistorias...</span>
                    </td>
                  </tr>
                ) : filteredInspections.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-muted-foreground">
                      <ClipboardCheck className="mx-auto h-7 w-7 text-primary" />
                      <strong className="mt-3 block text-sm text-foreground">
                        {inspections.length
                          ? "Nenhuma vistoria encontrada"
                          : "Nenhuma vistoria registrada"}
                      </strong>
                      <span className="mt-1 block text-xs">
                        {inspections.length
                          ? "Ajuste a busca ou o filtro aplicado."
                          : "Clique em Nova vistoria para iniciar o primeiro registro."}
                      </span>
                    </td>
                  </tr>
                ) : (
                  filteredInspections.map((inspection) => (
                    <tr
                      key={inspection.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Abrir vistoria ${inspection.vehicle?.internal_id || inspection.police_report_number || inspection.id}`}
                      onClick={() => setSelectedInspectionId(inspection.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedInspectionId(inspection.id);
                        }
                      }}
                      className="cursor-pointer border-t border-border/70 transition hover:bg-primary/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    >
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                            <ClipboardCheck className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-black">
                              {inspection.vehicle?.internal_id || "Veículo não informado"}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              Vistoria v{inspection.current_version}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <span
                          className="block truncate text-xs font-medium"
                          title={inspection.vehicle?.brand_model || "Não informado"}
                        >
                          {inspection.vehicle?.brand_model || "Não informado"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 align-middle font-mono text-xs font-bold">
                        {inspection.vehicle?.plate || "—"}
                      </td>
                      <td className="px-3 py-3.5 align-middle font-mono text-xs text-muted-foreground">
                        {inspection.police_report_number || "—"}
                      </td>
                      <td className="px-3 py-3.5 align-middle text-xs tabular-nums text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR").format(
                          new Date(`${inspection.inspection_date}T12:00:00`),
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center align-middle">
                        <span
                          className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                            inspection.status === "emitido"
                              ? "border-success/35 bg-success/10 text-success"
                              : inspection.status === "cancelado"
                                ? "border-destructive/35 bg-destructive/10 text-destructive"
                                : "border-primary/35 bg-primary/10 text-primary"
                          }`}
                        >
                          {INSPECTION_STATUS_LABELS[inspection.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center align-middle">
                        <span
                          className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-bold ${
                            inspection.pdf_sha256
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-warning/30 bg-warning/10 text-warning"
                          }`}
                        >
                          {inspection.pdf_sha256 ? "Assinado" : "Pendente"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center align-middle">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedInspectionId(inspection.id);
                          }}
                          className="inline-flex min-h-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="hidden" aria-hidden="true">
          <div className="flex flex-col gap-4 border-b border-border/80 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Central de vistorias
              </p>
              <h2 className="mt-1 text-xl font-black">Consulta e visualização</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Selecione um registro para visualizar o relatório completo e suas evidências.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar veículo, placa, B.O. ou local"
                  aria-label="Buscar vistorias"
                  className={`${FIELD_CLASS} pl-10`}
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "todos" | VehicleInspection["status"])
                }
                aria-label="Filtrar vistorias por status"
                className={`${FIELD_CLASS} min-w-[170px]`}
              >
                <option value="todos">Todos os status</option>
                <option value="rascunho">Em elaboração</option>
                <option value="emitido">Relatório emitido</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-muted-foreground">
              <LoaderCircle className="h-6 w-6 animate-spin" aria-label="Carregando vistorias" />
            </div>
          ) : filteredInspections.length > 0 && selectedInspection ? (
            <div className="grid min-h-[560px] xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.55fr)]">
              <aside className="border-b border-border/80 bg-background/25 xl:border-b-0 xl:border-r">
                <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Registros encontrados
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-black">
                    {filteredInspections.length}
                  </span>
                </div>
                <div className="max-h-[690px] space-y-2 overflow-y-auto p-3">
                  {filteredInspections.map((inspection) => {
                    const active = inspection.id === selectedInspection.id;
                    return (
                      <button
                        key={inspection.id}
                        type="button"
                        onClick={() => setSelectedInspectionId(inspection.id)}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          active
                            ? "border-primary/45 bg-primary/10 shadow-[inset_3px_0_0_var(--primary)]"
                            : "border-border bg-card/60 hover:border-primary/25 hover:bg-muted/35"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black">
                              {inspection.vehicle?.internal_id || "Veículo não informado"}
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {inspection.vehicle?.brand_model || "Modelo não informado"}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                            v{inspection.current_version}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>{inspection.vehicle?.plate || "Sem placa"}</span>
                          <span>
                            {new Intl.DateTimeFormat("pt-BR").format(
                              new Date(`${inspection.inspection_date}T12:00:00`),
                            )}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
                          <span className="text-[10px] font-bold text-primary">
                            {INSPECTION_STATUS_LABELS[inspection.status]}
                          </span>
                          <span
                            className={`h-2 w-2 rounded-full ${
                              inspection.pdf_sha256 ? "bg-success" : "bg-warning"
                            }`}
                            title={inspection.pdf_sha256 ? "PDF assinado anexado" : "PDF pendente"}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <article className="min-w-0 p-5 lg:p-6">
                <div className="flex flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                      <CarFront className="h-6 w-6" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black">
                          {selectedInspection.vehicle?.internal_id || "Veículo não informado"}
                        </h3>
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                          {INSPECTION_STATUS_LABELS[selectedInspection.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedInspection.vehicle?.brand_model || "Modelo não informado"} ·{" "}
                        {selectedInspection.vehicle?.plate || "Sem placa"}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Vistoria de{" "}
                        {new Intl.DateTimeFormat("pt-BR").format(
                          new Date(`${selectedInspection.inspection_date}T12:00:00`),
                        )}{" "}
                        · versão {selectedInspection.current_version}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => beginEdit(selectedInspection)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold transition hover:bg-muted"
                    >
                      <FileText className="h-4 w-4" /> Nova versão
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePrintInspection(selectedInspection)}
                      disabled={printingId === selectedInspection.id}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
                    >
                      {printingId === selectedInspection.id ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4" />
                      )}
                      {printingId === selectedInspection.id ? "Preparando..." : "Gerar PDF"}
                    </button>
                    {selectedInspection.pdf_storage_path ? (
                      <button
                        type="button"
                        onClick={() => void handleOpenSignedPdf(selectedInspection)}
                        disabled={openingPdfId === selectedInspection.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-success/35 bg-success/10 px-3.5 py-2.5 text-xs font-bold text-success transition hover:bg-success/15 disabled:opacity-60"
                      >
                        {openingPdfId === selectedInspection.id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        Abrir assinado
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailField
                    label="B.O. / ocorrência"
                    value={selectedInspection.police_report_number}
                  />
                  <DetailField
                    label="Motivo da apresentação"
                    value={
                      selectedInspection.presentation_reason
                        ? PRESENTATION_REASON_LABELS[selectedInspection.presentation_reason]
                        : null
                    }
                  />
                  <DetailField
                    label="Instituição"
                    value={
                      selectedInspection.presenting_institution
                        ? INSTITUTION_LABELS[selectedInspection.presenting_institution]
                        : null
                    }
                  />
                  <DetailField label="Local da vistoria" value={selectedInspection.location} />
                  <DetailField
                    label="Pátio / destino"
                    value={
                      selectedInspection.yard_type
                        ? YARD_LABELS[selectedInspection.yard_type]
                        : null
                    }
                  />
                  <DetailField label="Local do pátio" value={selectedInspection.yard_location} />
                  <DetailField
                    label="Restrição de entrega"
                    value={selectedInspection.delivery_restricted ? "Sim" : "Não"}
                  />
                  <DetailField
                    label="Documento"
                    value={
                      selectedInspection.pdf_sha256 ? "PDF assinado e verificado" : "PDF pendente"
                    }
                    tone={selectedInspection.pdf_sha256 ? "success" : "warning"}
                  />
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <InspectionNarrative
                    title="Identificação e sinais"
                    value={selectedInspection.findings?.identification}
                  />
                  <InspectionNarrative
                    title="Estrutura e integridade"
                    value={selectedInspection.findings?.structure}
                  />
                  <InspectionNarrative
                    title="Estado de conservação"
                    value={selectedInspection.findings?.conservation}
                  />
                  <InspectionNarrative
                    title="Acessórios e itens adicionais"
                    value={selectedInspection.findings?.accessories}
                  />
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
                  <section className="rounded-xl border border-border bg-background/45 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-black">Checklist observado</h4>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {
                          Object.values(selectedInspection.checklist ?? {}).filter(
                            (value) => value !== "nao_informado",
                          ).length
                        }{" "}
                        item(ns)
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {CHECKLIST_ITEMS.map(([key, label]) => {
                        const value = selectedInspection.checklist?.[key];
                        if (!value || value === "nao_informado") return null;
                        return (
                          <span
                            key={key}
                            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${
                              value === "presente"
                                ? "border-success/25 bg-success/10 text-success"
                                : "border-destructive/25 bg-destructive/10 text-destructive"
                            }`}
                          >
                            {label}: {CHECKLIST_STATUS_LABELS[value]}
                          </span>
                        );
                      })}
                      {!formatChecklist(selectedInspection.checklist) ? (
                        <span className="text-xs text-muted-foreground">
                          Nenhum item informado.
                        </span>
                      ) : null}
                    </div>
                  </section>
                  <section className="rounded-xl border border-border bg-background/45 p-4">
                    <h4 className="text-sm font-black">Pessoas vinculadas</h4>
                    {selectedInspection.linked_people?.length ? (
                      <ul className="mt-3 space-y-2">
                        {selectedInspection.linked_people.map((person) => (
                          <li key={person} className="flex items-start gap-2 text-xs">
                            <UsersRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>{person}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Nenhuma pessoa vinculada.
                      </p>
                    )}
                  </section>
                </div>

                {selectedInspection.inspector_notes ? (
                  <section className="mt-4 rounded-xl border border-border bg-background/45 p-4">
                    <h4 className="text-sm font-black">Observações do vistoriador</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {selectedInspection.inspector_notes}
                    </p>
                  </section>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/80 pt-5">
                  <button
                    type="button"
                    onClick={() => void toggleHistory(selectedInspection.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold transition hover:bg-muted"
                  >
                    <History className="h-4 w-4" />
                    {expandedHistoryId === selectedInspection.id
                      ? "Ocultar histórico"
                      : "Histórico"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void togglePhotos(selectedInspection.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold transition hover:bg-muted"
                  >
                    <Eye className="h-4 w-4" />
                    {expandedPhotosId === selectedInspection.id
                      ? "Ocultar fotos"
                      : "Fotos técnicas"}
                  </button>
                  <select
                    value={photoCategory}
                    onChange={(event) =>
                      setPhotoCategory(event.target.value as InspectionPhotoCategory)
                    }
                    aria-label="Categoria da fotografia técnica"
                    className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold"
                  >
                    {INSPECTION_PHOTO_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {PHOTO_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-xs font-bold text-primary transition hover:bg-primary/15">
                    {uploadingPhotosId === selectedInspection.id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    Adicionar fotos
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      disabled={uploadingPhotosId !== null}
                      onChange={(event) => {
                        void handlePhotoUpload(selectedInspection, event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-xs font-bold text-primary transition hover:bg-primary/15">
                    {uploadingId === selectedInspection.id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileCheck2 className="h-4 w-4" />
                    )}
                    Anexar PDF assinado
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      disabled={uploadingId !== null}
                      onChange={(event) => {
                        void handlePdfUpload(selectedInspection, event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                {expandedHistoryId === selectedInspection.id ? (
                  <section className="mt-4 rounded-xl border border-border bg-background/45 p-4">
                    <h4 className="text-sm font-black">Histórico de versões</h4>
                    <div className="mt-3 space-y-2">
                      {(history[selectedInspection.id] ?? []).map((version) => (
                        <div
                          key={version.id}
                          className="grid gap-1 rounded-lg border border-border/75 bg-card/50 p-3 text-xs sm:grid-cols-[90px_minmax(0,1fr)_auto]"
                        >
                          <strong>Versão {version.version}</strong>
                          <span className="text-muted-foreground">
                            {version.change_reason || "Criação do relatório"} ·{" "}
                            {new Intl.DateTimeFormat("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(version.created_at))}
                          </span>
                          <span className={version.pdf_sha256 ? "text-success" : "text-warning"}>
                            {version.pdf_sha256 ? "PDF verificado" : "PDF pendente"}
                          </span>
                        </div>
                      ))}
                      {(history[selectedInspection.id] ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma versão encontrada.</p>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {expandedPhotosId === selectedInspection.id ? (
                  <section className="mt-4 rounded-xl border border-border bg-background/45 p-4">
                    <h4 className="text-sm font-black">Fotografias técnicas</h4>
                    {(inspectionPhotos[selectedInspection.id] ?? []).length ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {(inspectionPhotos[selectedInspection.id] ?? []).map((photo) => (
                          <figure
                            key={photo.id}
                            className="overflow-hidden rounded-xl border border-border bg-card/60"
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
                            <figcaption className="px-3 py-2 text-xs font-bold">
                              {PHOTO_CATEGORY_LABELS[photo.category]}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Nenhuma fotografia técnica vinculada.
                      </p>
                    )}
                  </section>
                ) : null}
              </article>
            </div>
          ) : (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                <ClipboardCheck className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-black">
                {inspections.length ? "Nenhum registro encontrado" : "Nenhuma vistoria registrada"}
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
                {inspections.length
                  ? "Ajuste a busca ou o filtro para localizar a vistoria."
                  : "Inicie uma nova vistoria para registrar o veículo, as constatações e o relatório."}
              </p>
            </div>
          )}
        </section>

        {printInspection ? (
          <VehicleInspectionPrintSheet
            inspection={printInspection}
            photos={inspectionPhotos[printInspection.id] ?? []}
          />
        ) : null}

        <VehicleInspectionQuickPreview
          record={selectedInspection}
          onClose={() => setSelectedInspectionId(null)}
          onViewPdf={() => {
            if (selectedInspection) void handleViewInspectionPdf(selectedInspection);
          }}
          onEdit={() => {
            if (!selectedInspection) return;
            const inspectionId = selectedInspection.id;
            setSelectedInspectionId(null);
            void navigate({
              to: "/vistorias/$inspectionId/editar",
              params: { inspectionId },
            });
          }}
          busy={
            selectedInspection
              ? printingId === selectedInspection.id || openingPdfId === selectedInspection.id
              : false
          }
        />
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

function DetailField({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value?: string | null;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background/45 p-3.5">
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1.5 truncate text-sm font-bold ${toneClass}`} title={value || undefined}>
        {value || "Não informado"}
      </dd>
    </div>
  );
}

function InspectionNarrative({ title, value }: { title: string; value?: string | null }) {
  return (
    <section className="min-h-28 rounded-xl border border-border bg-background/45 p-4">
      <h4 className="text-xs font-black uppercase tracking-[0.1em] text-primary">{title}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {value?.trim() || "Não informado"}
      </p>
    </section>
  );
}
