import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Camera,
  CarFront,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Fingerprint,
  Gauge,
  ImagePlus,
  KeyRound,
  ListChecks,
  LockKeyhole,
  LoaderCircle,
  MapPin,
  Minus,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { VehicleInspectionPrintSheet } from "@/components/VehicleInspectionPrintSheet";
import {
  createVehicleInspection,
  listVehicleInspectionPhotos,
  listVehicleInspections,
  listVehiclesForInspection,
  updateVehicleInspection,
  uploadVehicleInspectionPhotos,
} from "@/lib/repositories/vistoriasRepository";
import {
  INSPECTION_PRESENTATION_REASONS,
  INSPECTION_PRESENTING_INSTITUTIONS,
  INSPECTION_YARD_TYPES,
  type InspectionPresentationReason,
  type InspectionPresentingInstitution,
  type InspectionYardType,
  INSPECTION_PHOTO_CATEGORIES,
  type InspectionPhotoCategory,
  type VehicleInspection,
  type VehicleInspectionAnswer,
  type VehicleInspectionChecklist,
  type VehicleInspectionOstensibleData,
  type VehicleInspectionPhoto,
} from "@/features/vistorias/vistoriaTypes";

const PHOTO_CATEGORY_LABELS: Record<InspectionPhotoCategory, string> = {
  veiculo: "Vista geral do veículo",
  chassi: "Chassi",
  motor: "Motor",
  etiqueta_seguranca: "Etiqueta de segurança",
  placa: "Placa",
  sinal_identificador: "Outro sinal identificador",
  outros: "Outro registro",
};

type PhotoCaptureOption = {
  id: string;
  label: string;
  category: InspectionPhotoCategory;
  caption: string;
};

const VEHICLE_PHOTO_OPTIONS: PhotoCaptureOption[] = [
  { id: "frente", label: "Foto - Frente", category: "veiculo", caption: "Frente" },
  { id: "fundo", label: "Foto - Fundo", category: "veiculo", caption: "Fundo" },
  {
    id: "lateral-direita",
    label: "Foto - Lateral direita",
    category: "veiculo",
    caption: "Lateral direita",
  },
  {
    id: "lateral-esquerda",
    label: "Foto - Lateral esquerda",
    category: "veiculo",
    caption: "Lateral esquerda",
  },
  { id: "teto", label: "Foto - Teto", category: "veiculo", caption: "Teto" },
  { id: "outras", label: "Outras fotos", category: "veiculo", caption: "Vista do veículo" },
];

const IDENTIFIER_PHOTO_OPTIONS: PhotoCaptureOption[] = [
  { id: "chassi", label: "Foto - Chassi", category: "chassi", caption: "Chassi" },
  { id: "motor", label: "Foto - Motor", category: "motor", caption: "Motor" },
  { id: "placa", label: "Foto - Placa", category: "placa", caption: "Placa" },
  {
    id: "etiqueta",
    label: "Foto - Etiqueta de segurança",
    category: "etiqueta_seguranca",
    caption: "Etiqueta de segurança",
  },
  {
    id: "outro-sinal",
    label: "Outros sinais",
    category: "sinal_identificador",
    caption: "Outro sinal identificador",
  },
];

type PendingInspectionPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  category: InspectionPhotoCategory;
  caption: string;
};

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

const CHECKLIST_ITEMS = [
  ["estepe", "Estepe"],
  ["chave_de_rodas", "Chave de rodas"],
  ["triangulo", "Triângulo"],
  ["macaco", "Macaco"],
  ["tapetes", "Tapetes"],
  ["chave_crv_crlv", "Chave/CRV/CRLV"],
] as const;

const DIVERGENCE_INDICATORS = [
  ["missing_plate_preserved_identifiers", "Sem placa, com os demais identificadores preservados"],
  [
    "replaced_plate_preserved_identifiers",
    "Placa trocada, com os demais identificadores preservados",
  ],
  ["possible_clone", "Indícios de clonagem por sinais coincidentes com outro veículo"],
  ["obd_vin_mismatch", "VIN lido via OBD diverge do sinal ostentado"],
  ["original_number_recovered", "Numeração original identificada em um ou mais agregados"],
  ["identifier_number_missing", "Ausência completa de numeração em item identificador"],
  ["visible_identifier_tampering", "Adulteração visível por sobreposição, raspagem ou implante"],
  ["parts_date_mismatch", "Datas de fabricação de peças incompatíveis com os sinais ostentados"],
  [
    "original_vin_with_stolen_part",
    "VIN original com agregado proveniente de veículo furtado/roubado",
  ],
] as const;

const CUSTODY_QUESTIONNAIRE = [
  ["registered_before_law_13352", "Veículo cadastrado antes da Lei 13.352/2015"],
  ["related_to_drug_trafficking", "Apreensão relacionada ao tráfico de drogas ou crimes afins"],
  ["proceeding_information_unavailable", "Informação de procedência policial indisponível"],
  ["seizure_date_unavailable", "Data da apreensão não identificada"],
  ["judicial_auction_requested", "Representação judicial para autorização de leilão"],
  ["detran_infraction_requested", "DETRAN/CIRETRAN oficiado para auto de infração"],
  ["public_notice_requested", "COORPIN/DEPIN informado para publicação de edital"],
  ["early_disposal_requested", "Alienação antecipada solicitada judicialmente"],
  ["owner_or_insurer_notified", "Proprietário ou seguradora notificado para retirada"],
  ["awaiting_public_notice", "Aguardando período de notificação em edital"],
  ["under_judicial_restriction", "Objeto de restrição ou sindicância"],
  ["administrative_occurrence_linked", "Ocorrência administrativa vinculada a IP/TCO"],
  ["authorized_to_circulate", "Autorizado judicialmente a circular"],
  ["available_for_auction", "Disponível para leilão"],
] as const;

const STEPS = [
  { id: 1, label: "Veículo", description: "Identificação e data", icon: CarFront },
  { id: 2, label: "Apresentação", description: "Origem e custódia", icon: Building2 },
  { id: 3, label: "Exame", description: "Checklist e constatações", icon: ListChecks },
  { id: 4, label: "Fotografias", description: "Veículo e identificadores", icon: Camera },
  { id: 5, label: "Resultado", description: "Conclusão e providências", icon: FileSearch },
  { id: 6, label: "Revisão", description: "Pessoas e confirmação", icon: UsersRound },
] as const;

type Step = (typeof STEPS)[number]["id"];

const FIELD_CLASS =
  "h-12 w-full rounded-xl border border-border/80 bg-background/65 px-4 text-sm font-semibold outline-none transition duration-200 hover:border-primary/35 focus:border-primary/70 focus:bg-background focus:ring-4 focus:ring-primary/10";
const TEXTAREA_CLASS =
  "w-full resize-y rounded-xl border border-border/80 bg-background/65 px-4 py-3 text-sm font-normal leading-relaxed outline-none transition duration-200 hover:border-primary/35 focus:border-primary/70 focus:bg-background focus:ring-4 focus:ring-primary/10";

export default function VehicleInspectionFormPage({
  inspectionId,
  hideNavigation = false,
}: {
  inspectionId?: string;
  hideNavigation?: boolean;
}) {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof listVehiclesForInspection>>>(
    [],
  );
  const [editingInspection, setEditingInspection] = useState<VehicleInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(1);
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
  const [photoVehicleDescription, setPhotoVehicleDescription] = useState("");
  const [photoIdentifiersDescription, setPhotoIdentifiersDescription] = useState("");
  const [resultFindings, setResultFindings] = useState("");
  const [measuresTaken, setMeasuresTaken] = useState("");
  const [linkedPeopleText, setLinkedPeopleText] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [ostensibleData, setOstensibleData] = useState<VehicleInspectionOstensibleData>({});
  const [savedPhotos, setSavedPhotos] = useState<VehicleInspectionPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingInspectionPhoto[]>([]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;
  const currentStep = STEPS.find((item) => item.id === step) ?? STEPS[0];
  const checklistValues = CHECKLIST_ITEMS.map(([key]) => checklist[key] ?? "nao_informado");
  const checklistSummary = {
    present: checklistValues.filter((value) => value === "presente").length,
    absent: checklistValues.filter((value) => value === "ausente").length,
    uninformed: checklistValues.filter((value) => value === "nao_informado").length,
  };
  const technicalData = checklist.technical ?? {};

  function updateTechnicalData(
    patch: Partial<NonNullable<VehicleInspectionChecklist["technical"]>>,
  ) {
    setChecklist((current) => ({
      ...current,
      technical: { ...current.technical, ...patch },
    }));
  }
  function updateOstensibleData(
    key: keyof VehicleInspectionOstensibleData,
    value: string | number | null,
  ) {
    setOstensibleData((current) => ({ ...current, [key]: value }));
  }

  function addPendingPhotos(
    files: FileList | null,
    category: InspectionPhotoCategory,
    defaultCaption?: string,
  ) {
    const selected = Array.from(files ?? []);
    if (!selected.length) return;
    setPendingPhotos((current) => [
      ...current,
      ...selected.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        category,
        caption:
          defaultCaption ?? (category === "veiculo" ? "Vista do veículo na apresentação" : ""),
      })),
    ]);
  }

  function removePendingPhoto(photoId: string) {
    setPendingPhotos((current) => {
      const removed = current.find((photo) => photo.id === photoId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== photoId);
    });
  }

  function updatePendingPhoto(photoId: string, patch: Partial<PendingInspectionPhoto>) {
    setPendingPhotos((current) =>
      current.map((photo) => (photo.id === photoId ? { ...photo, ...patch } : photo)),
    );
  }
  function updateAssessment(
    patch: Partial<NonNullable<NonNullable<VehicleInspectionChecklist["technical"]>["assessment"]>>,
  ) {
    setChecklist((current) => ({
      ...current,
      technical: {
        ...current.technical,
        assessment: { ...current.technical?.assessment, ...patch },
      },
    }));
  }
  const assessment = technicalData.assessment ?? {};
  const completenessSignals = [
    vehicleId,
    inspectionDate,
    policeReportNumber,
    presentationReason,
    presentingInstitution,
    location,
    yardType,
    identificationFindings || structureFindings || conservationFindings || accessoriesFindings,
  ];
  const completeness = Math.round(
    (completenessSignals.filter((value) => Boolean(value)).length / completenessSignals.length) *
      100,
  );
  const reviewTimestamp = editingInspection?.updated_at ?? new Date().toISOString();
  const reviewInspection: VehicleInspection = {
    id: editingInspection?.id ?? "PREVIA-VISTORIA",
    vehicle_id: vehicleId,
    status: editingInspection?.status ?? "rascunho",
    inspection_date: inspectionDate,
    location: location || null,
    inspector_notes: notes || null,
    police_report_number: policeReportNumber || null,
    presentation_reason: (presentationReason || null) as InspectionPresentationReason | null,
    presenting_institution: (presentingInstitution ||
      null) as InspectionPresentingInstitution | null,
    yard_type: (yardType || null) as InspectionYardType | null,
    yard_location: yardLocation || null,
    delivery_restricted: deliveryRestricted,
    checklist,
    linked_people: linkedPeopleText
      .split("\n")
      .map((person) => person.trim())
      .filter(Boolean),
    original_vehicle_data:
      editingInspection?.original_vehicle_data ??
      (selectedVehicle
        ? {
            internal_id: selectedVehicle.internal_id,
            vehicle_type: selectedVehicle.vehicle_type,
            brand: selectedVehicle.brand,
            model: selectedVehicle.model,
            brand_model: selectedVehicle.brand_model,
            color: selectedVehicle.color,
            plate: selectedVehicle.plate,
            renavam: selectedVehicle.renavam,
            engine_number: selectedVehicle.engine_number,
            chassis: selectedVehicle.chassis,
            manufacture_year: selectedVehicle.manufacture_year,
            model_year: selectedVehicle.model_year,
            conservation_state: selectedVehicle.conservation_state,
          }
        : {}),
    findings: {
      identification: identificationFindings,
      structure: structureFindings,
      conservation: conservationFindings,
      accessories: accessoriesFindings,
      observations: notes,
      result: resultFindings,
      measures_taken: measuresTaken,
      photo_vehicle_description: photoVehicleDescription,
      photo_identifiers_description: photoIdentifiersDescription,
      ostensible_vehicle: ostensibleData,
    },
    current_version: editingInspection ? editingInspection.current_version + 1 : 1,
    pdf_storage_path: editingInspection?.pdf_storage_path ?? null,
    pdf_sha256: editingInspection?.pdf_sha256 ?? null,
    created_at: editingInspection?.created_at ?? reviewTimestamp,
    updated_at: reviewTimestamp,
    created_by: editingInspection?.created_by ?? null,
    updated_by: editingInspection?.updated_by ?? null,
    vehicle: selectedVehicle,
  };
  const reviewPhotos: VehicleInspectionPhoto[] = [
    ...savedPhotos,
    ...pendingPhotos.map((photo) => ({
      id: photo.id,
      inspection_id: editingInspection?.id ?? "PREVIA-VISTORIA",
      vehicle_photo_id: photo.id,
      category: photo.category,
      caption: photo.caption || null,
      created_at: reviewTimestamp,
      vehicle_photo: {
        id: photo.id,
        original_url: photo.previewUrl,
        thumbnail_url: photo.previewUrl,
      },
    })),
  ];

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listVehiclesForInspection(),
      inspectionId ? listVehicleInspections(200) : Promise.resolve([]),
    ])
      .then(([vehicleRows, inspectionRows]) => {
        if (cancelled) return;
        setVehicles(vehicleRows);
        if (!inspectionId) return;
        const inspection = inspectionRows.find((item) => item.id === inspectionId);
        if (!inspection) {
          setError("A vistoria informada não foi encontrada.");
          return;
        }
        setEditingInspection(inspection);
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
        setPhotoVehicleDescription(inspection.findings?.photo_vehicle_description ?? "");
        setPhotoIdentifiersDescription(inspection.findings?.photo_identifiers_description ?? "");
        setResultFindings(inspection.findings?.result ?? "");
        setMeasuresTaken(inspection.findings?.measures_taken ?? "");
        setOstensibleData(inspection.findings?.ostensible_vehicle ?? {});
        setLinkedPeopleText((inspection.linked_people ?? []).join("\n"));
        void listVehicleInspectionPhotos(inspection.id)
          .then((photos) => {
            if (!cancelled) setSavedPhotos(photos);
          })
          .catch(() => {
            if (!cancelled)
              setError("A vistoria foi carregada, mas as fotografias não puderam ser exibidas.");
          });
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o cadastro da vistoria.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inspectionId]);

  function nextStep() {
    if (step === 1 && !vehicleId) {
      setError("Selecione um veículo para continuar.");
      return;
    }
    setError(null);
    setStep((current) => Math.min(STEPS.length, current + 1) as Step);
  }

  function previousStep() {
    setError(null);
    setStep((current) => Math.max(1, current - 1) as Step);
  }

  async function saveInspection() {
    if (!vehicleId) {
      setError("Selecione um veículo antes de salvar a vistoria.");
      setStep(1);
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
          result: resultFindings,
          measures_taken: measuresTaken,
          photo_vehicle_description: photoVehicleDescription,
          photo_identifiers_description: photoIdentifiersDescription,
          ostensible_vehicle: ostensibleData,
        },
        original_vehicle_data:
          editingInspection?.original_vehicle_data ??
          (selectedVehicle
            ? {
                internal_id: selectedVehicle.internal_id,
                vehicle_type: selectedVehicle.vehicle_type,
                brand: selectedVehicle.brand,
                model: selectedVehicle.model,
                brand_model: selectedVehicle.brand_model,
                color: selectedVehicle.color,
                plate: selectedVehicle.plate,
                renavam: selectedVehicle.renavam,
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
      const savedInspection = editingInspection
        ? await updateVehicleInspection(editingInspection.id, input, changeReason)
        : await createVehicleInspection(input);
      const failedPhotoIds = new Set<string>();
      for (const photo of pendingPhotos) {
        try {
          const result = await uploadVehicleInspectionPhotos({
            inspectionId: savedInspection.id,
            vehicleId,
            category: photo.category,
            caption: photo.caption,
            files: [photo.file],
          });
          if (result.failed.length) {
            failedPhotoIds.add(photo.id);
          } else {
            URL.revokeObjectURL(photo.previewUrl);
          }
        } catch {
          failedPhotoIds.add(photo.id);
        }
      }
      if (failedPhotoIds.size) {
        setEditingInspection(savedInspection);
        setPendingPhotos((current) => current.filter((photo) => failedPhotoIds.has(photo.id)));
        setSavedPhotos(await listVehicleInspectionPhotos(savedInspection.id));
        setError(
          `A vistoria foi salva, mas ${failedPhotoIds.size} fotografia(s) não foram enviadas. Revise e tente novamente.`,
        );
        setStep(4);
        return;
      }
      await navigate({ to: "/vistorias" });
    } catch {
      setError("Não foi possível salvar a vistoria. Verifique os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout module="vistorias" hideNavigation={hideNavigation}>
      <div className="mx-auto w-full max-w-[1480px] space-y-5 pb-10">
        <header className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-[radial-gradient(circle_at_85%_15%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_34%),linear-gradient(135deg,color-mix(in_oklab,var(--card)_96%,black),color-mix(in_oklab,var(--background)_92%,var(--primary)_8%))] p-5 shadow-[0_24px_80px_-42px_color-mix(in_oklab,var(--primary)_80%,transparent)] md:p-7">
          <div className="pointer-events-none absolute -right-14 -top-24 h-72 w-72 rounded-full border border-primary/15" />
          <div className="pointer-events-none absolute -right-2 -top-12 h-44 w-44 rounded-full border border-primary/20" />
          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div>
              <Link
                to="/vistorias"
                className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" /> Central de vistorias
              </Link>
              <div className="mt-5 flex items-start gap-4">
                <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/35 bg-primary/12 text-primary shadow-[0_0_32px_-10px_color-mix(in_oklab,var(--primary)_90%,transparent)]">
                  <ScanLine className="h-7 w-7" />
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card bg-emerald-400" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary">
                      Estação de inspeção veicular
                    </p>
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-primary">
                      {inspectionId ? "Nova versão" : "Registro inicial"}
                    </span>
                  </div>
                  <h1 className="mt-2 text-2xl font-black tracking-[-0.035em] md:text-4xl">
                    {inspectionId ? "Atualizar relatório de vistoria" : "Iniciar vistoria técnica"}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Construa o registro técnico em uma sequência controlada. Os dados do veículo são
                    preservados como referência da versão.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-3 xl:min-w-[470px]">
              <HeroMetric
                label="Progresso"
                value={`${completeness}%`}
                detail={`${step} de ${STEPS.length} etapas`}
                icon={Gauge}
              />
              <HeroMetric
                label="Veículo"
                value={selectedVehicle?.plate || "—"}
                detail={selectedVehicle?.internal_id || "Não vinculado"}
                icon={CarFront}
              />
              <HeroMetric
                label="Proteção"
                value={deliveryRestricted ? "Restrita" : "Padrão"}
                detail="Trilha auditável"
                icon={ShieldCheck}
              />
            </div>
          </div>
          <div className="relative mt-6 h-1.5 overflow-hidden rounded-full bg-border/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-cyan-400 shadow-[0_0_16px_color-mix(in_oklab,var(--primary)_80%,transparent)] transition-all duration-500"
              style={{ width: `${(step / STEPS.length) * 100}%` }}
            />
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[1.5rem] border border-border/75 bg-card/80 shadow-sm xl:sticky xl:top-5">
            <div className="border-b border-border/70 px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Fluxo operacional
              </p>
              <p className="mt-1 text-sm font-bold">Etapas do relatório</p>
            </div>
            <nav className="p-3">
              {STEPS.map((item, index) => {
                const Icon = item.icon;
                const active = step === item.id;
                const completed = step > item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStep(item.id)}
                    className={`group relative flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition duration-200 ${
                      active
                        ? "border border-primary/30 bg-primary/10 text-foreground shadow-[0_10px_28px_-22px_color-mix(in_oklab,var(--primary)_80%,transparent)]"
                        : "border border-transparent text-muted-foreground hover:border-border hover:bg-muted/35 hover:text-foreground"
                    }`}
                    aria-current={active ? "step" : undefined}
                  >
                    {index < STEPS.length - 1 ? (
                      <span
                        className={`absolute left-[31px] top-[49px] h-[25px] w-px ${completed ? "bg-primary/55" : "bg-border"}`}
                      />
                    ) : null}
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                        active || completed
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border bg-background/60"
                      }`}
                    >
                      {completed ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[9px] font-black uppercase tracking-[0.16em] opacity-65">
                        Etapa {item.id}
                      </span>
                      <strong className="mt-0.5 block text-sm">{item.label}</strong>
                      <span className="mt-0.5 block truncate text-[11px] opacity-70">
                        {item.description}
                      </span>
                    </span>
                    {active ? (
                      <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
                    ) : null}
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-border/70 bg-background/25 p-4">
              <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/45 p-3">
                <Fingerprint className="h-5 w-5 text-primary" />
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                    Registro
                  </p>
                  <p className="truncate text-xs font-bold">
                    {editingInspection?.id.slice(0, 13) || "Gerado ao salvar"}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <section className="overflow-hidden rounded-[1.75rem] border border-primary/20 bg-card/90 shadow-[0_24px_70px_-45px_color-mix(in_oklab,var(--primary)_75%,transparent)]">
            <div className="inspection-registration-light flex flex-col gap-4 border-b border-border/75 bg-white px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
              <SectionTitle
                icon={currentStep.icon}
                eyebrow={`Etapa ${currentStep.id} de ${STEPS.length}`}
                title={
                  step === 1
                    ? "Identificação do veículo"
                    : step === 2
                      ? "Origem, ocorrência e custódia"
                      : step === 3
                        ? "Exame técnico do veículo"
                        : step === 4
                          ? "Registro fotográfico"
                          : step === 5
                            ? "Resultado e providências"
                            : "Conferência e formalização"
                }
                description={
                  step === 1
                    ? "Selecione o cadastro que será congelado como referência desta vistoria."
                    : step === 2
                      ? "Contextualize a apresentação e defina onde o bem permanecerá custodiado."
                      : step === 3
                        ? "Registre o estado encontrado com critérios objetivos e narrativa técnica."
                        : step === 4
                          ? "Fotografe o veículo por posição e documente separadamente cada sinal identificador."
                          : step === 5
                            ? "Consolide o diagnóstico, a conclusão e as providências administrativas."
                            : "Revise vínculos, observações e os dados que formarão o relatório."
                }
              />
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-primary">
                <ShieldCheck className="h-3.5 w-3.5" /> Salvamento auditado
              </span>
            </div>

            <div
              className={`inspection-registration-light p-5 md:p-7 ${step === 1 && !selectedVehicle && !loading ? "" : "min-h-[590px]"}`}
            >
              {loading ? (
                <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 text-muted-foreground">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                    <LoaderCircle className="h-6 w-6 animate-spin" />
                  </span>
                  <p className="text-sm font-bold">Preparando estação de vistoria...</p>
                </div>
              ) : (
                <>
                  {error ? (
                    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                      <X className="h-4 w-4 shrink-0" /> {error}
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="space-y-5">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(240px,0.7fr)]">
                        <Field label="Veículo cadastrado" hint="Vínculo obrigatório">
                          <select
                            value={vehicleId}
                            onChange={(event) => {
                              setVehicleId(event.target.value);
                              setOstensibleData({});
                            }}
                            disabled={Boolean(editingInspection)}
                            className={FIELD_CLASS}
                          >
                            <option value="">Selecione o veículo...</option>
                            {vehicles.map((vehicle) => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.internal_id} · {vehicle.plate || "sem placa"} ·{" "}
                                {vehicle.brand_model || "não informado"}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Data da vistoria" hint="Data do exame">
                          <span className="relative block">
                            <CalendarDays className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-primary" />
                            <input
                              type="date"
                              value={inspectionDate}
                              onChange={(event) => setInspectionDate(event.target.value)}
                              className={`${FIELD_CLASS} pl-11`}
                            />
                          </span>
                        </Field>
                      </div>

                      {selectedVehicle ? (
                        <div className="overflow-hidden rounded-3xl border border-primary/25 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_12%,var(--background)),var(--background)_72%)]">
                          <div className="flex flex-col gap-5 border-b border-primary/15 p-5 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-4">
                              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/35 bg-primary/15 text-primary">
                                <CarFront className="h-7 w-7" />
                              </span>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                                  Veículo confirmado
                                </p>
                                <h3 className="mt-1 text-xl font-black">
                                  {selectedVehicle.brand_model || "Modelo não informado"}
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Cadastro {selectedVehicle.internal_id}
                                </p>
                              </div>
                            </div>
                            <div className="rounded-xl border border-foreground/15 bg-background/75 px-5 py-3 text-center shadow-sm">
                              <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                Placa
                              </span>
                              <strong className="mt-1 block font-mono text-xl tracking-[0.12em]">
                                {selectedVehicle.plate || "SEM PLACA"}
                              </strong>
                            </div>
                          </div>
                          <div className="grid gap-px bg-border/60 sm:grid-cols-2 xl:grid-cols-4">
                            <VehicleDatum
                              icon={Fingerprint}
                              label="Chassi"
                              value={selectedVehicle.chassis}
                            />
                            <VehicleDatum
                              icon={Wrench}
                              label="Motor"
                              value={selectedVehicle.engine_number}
                            />
                            <VehicleDatum
                              icon={Sparkles}
                              label="Cor"
                              value={selectedVehicle.color}
                            />
                            <VehicleDatum
                              icon={BadgeCheck}
                              label="Ano / modelo"
                              value={[selectedVehicle.manufacture_year, selectedVehicle.model_year]
                                .filter(Boolean)
                                .join(" / ")}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                              <KeyRound className="h-5 w-5" />
                            </span>
                            <div>
                              <h3 className="text-sm font-black">Nenhum veículo vinculado</h3>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Selecione um cadastro acima para abrir os dados da vistoria.
                              </p>
                            </div>
                          </div>
                          <Link
                            to="/veiculos/novo"
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-black text-primary transition hover:bg-primary/15"
                          >
                            <CarFront className="h-4 w-4" /> Cadastrar novo veículo
                          </Link>
                        </div>
                      )}

                      {selectedVehicle ? (
                        <Panel
                          icon={ScanLine}
                          title="Características ostentadas / como chegou"
                          tone="primary"
                        >
                          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-black text-amber-500">
                                Preenchimento manual da condição encontrada
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                Estes dados não alteram o cadastro vinculado. O relatório mostrará
                                separadamente o que foi ostentado e os dados originais preservados.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setOstensibleData({
                                  vehicle_type: selectedVehicle.vehicle_type ?? "",
                                  brand: selectedVehicle.brand ?? "",
                                  model: selectedVehicle.model ?? "",
                                  color: selectedVehicle.color ?? "",
                                  plate: selectedVehicle.plate ?? "",
                                  chassis: selectedVehicle.chassis ?? "",
                                  engine_number: selectedVehicle.engine_number ?? "",
                                  renavam: selectedVehicle.renavam ?? "",
                                  manufacture_year: selectedVehicle.manufacture_year,
                                  model_year: selectedVehicle.model_year,
                                  description: ostensibleData.description ?? "",
                                })
                              }
                              className="shrink-0 rounded-xl border border-amber-500/30 bg-background/70 px-3.5 py-2.5 text-xs font-black text-amber-500 transition hover:bg-amber-500/10"
                            >
                              Copiar dados originais
                            </button>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <Field label="Tipo ostentado">
                              <input
                                value={ostensibleData.vehicle_type ?? ""}
                                onChange={(event) =>
                                  updateOstensibleData("vehicle_type", event.target.value)
                                }
                                className={FIELD_CLASS}
                                placeholder="Ex.: Motocicleta"
                              />
                            </Field>
                            <Field label="Marca ostentada">
                              <input
                                value={ostensibleData.brand ?? ""}
                                onChange={(event) =>
                                  updateOstensibleData("brand", event.target.value)
                                }
                                className={FIELD_CLASS}
                                placeholder="Ex.: Honda"
                              />
                            </Field>
                            <Field label="Modelo ostentado">
                              <input
                                value={ostensibleData.model ?? ""}
                                onChange={(event) =>
                                  updateOstensibleData("model", event.target.value)
                                }
                                className={FIELD_CLASS}
                                placeholder="Ex.: XRE 190"
                              />
                            </Field>
                            <Field label="Cor ostentada">
                              <input
                                value={ostensibleData.color ?? ""}
                                onChange={(event) =>
                                  updateOstensibleData("color", event.target.value)
                                }
                                className={FIELD_CLASS}
                                placeholder="Ex.: Vermelha"
                              />
                            </Field>
                            <Field label="Placa ostentada">
                              <input
                                value={ostensibleData.plate ?? ""}
                                onChange={(event) =>
                                  updateOstensibleData("plate", event.target.value.toUpperCase())
                                }
                                className={FIELD_CLASS}
                                placeholder="Ex.: ABC1D23"
                              />
                            </Field>
                            <Field label="Chassi ostentado">
                              <input
                                value={ostensibleData.chassis ?? ""}
                                onChange={(event) =>
                                  updateOstensibleData("chassis", event.target.value.toUpperCase())
                                }
                                className={FIELD_CLASS}
                                placeholder="Numeração encontrada"
                              />
                            </Field>
                            <Field label="Motor ostentado">
                              <input
                                value={ostensibleData.engine_number ?? ""}
                                onChange={(event) =>
                                  updateOstensibleData(
                                    "engine_number",
                                    event.target.value.toUpperCase(),
                                  )
                                }
                                className={FIELD_CLASS}
                                placeholder="Numeração encontrada"
                              />
                            </Field>
                            <Field label="Renavam ostentado">
                              <input
                                value={ostensibleData.renavam ?? ""}
                                onChange={(event) =>
                                  updateOstensibleData("renavam", event.target.value)
                                }
                                className={FIELD_CLASS}
                                placeholder="Se disponível"
                              />
                            </Field>
                            <Field label="Ano de fabricação">
                              <input
                                type="number"
                                value={ostensibleData.manufacture_year ?? ""}
                                onChange={(event) =>
                                  updateOstensibleData(
                                    "manufacture_year",
                                    event.target.value ? Number(event.target.value) : null,
                                  )
                                }
                                className={FIELD_CLASS}
                                placeholder="AAAA"
                              />
                            </Field>
                            <Field label="Ano do modelo">
                              <input
                                type="number"
                                value={ostensibleData.model_year ?? ""}
                                onChange={(event) =>
                                  updateOstensibleData(
                                    "model_year",
                                    event.target.value ? Number(event.target.value) : null,
                                  )
                                }
                                className={FIELD_CLASS}
                                placeholder="AAAA"
                              />
                            </Field>
                            <div className="sm:col-span-2">
                              <Field label="Descrição de como o veículo chegou">
                                <textarea
                                  value={ostensibleData.description ?? ""}
                                  onChange={(event) =>
                                    updateOstensibleData("description", event.target.value)
                                  }
                                  rows={3}
                                  className={TEXTAREA_CLASS}
                                  placeholder="Ex.: motocicleta sem carenagem lateral, placa fixada, sinais aparentes..."
                                />
                              </Field>
                            </div>
                          </div>
                        </Panel>
                      ) : null}
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-5">
                      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                        <Panel icon={FileSearch} title="Vínculo com a ocorrência" tone="primary">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                              label="Número do B.O. / ocorrência"
                              hint="Referência operacional"
                            >
                              <input
                                value={policeReportNumber}
                                onChange={(event) => setPoliceReportNumber(event.target.value)}
                                className={FIELD_CLASS}
                                placeholder="Ex.: 26-00705653"
                              />
                            </Field>
                            <Field label="Motivo da apresentação">
                              <select
                                value={presentationReason}
                                onChange={(event) => setPresentationReason(event.target.value)}
                                className={FIELD_CLASS}
                              >
                                <option value="">Selecione...</option>
                                {INSPECTION_PRESENTATION_REASONS.map((value) => (
                                  <option key={value} value={value}>
                                    {PRESENTATION_REASON_LABELS[value]}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <div className="mt-4">
                            <Field label="Instituição apresentante">
                              <select
                                value={presentingInstitution}
                                onChange={(event) => setPresentingInstitution(event.target.value)}
                                className={FIELD_CLASS}
                              >
                                <option value="">Selecione...</option>
                                {INSPECTION_PRESENTING_INSTITUTIONS.map((value) => (
                                  <option key={value} value={value}>
                                    {INSTITUTION_LABELS[value]}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                        </Panel>

                        <Panel icon={Warehouse} title="Custódia e destino">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Pátio / destino">
                              <select
                                value={yardType}
                                onChange={(event) => setYardType(event.target.value)}
                                className={FIELD_CLASS}
                              >
                                <option value="">Selecione...</option>
                                {INSPECTION_YARD_TYPES.map((value) => (
                                  <option key={value} value={value}>
                                    {YARD_LABELS[value]}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Local do pátio">
                              <input
                                value={yardLocation}
                                onChange={(event) => setYardLocation(event.target.value)}
                                className={FIELD_CLASS}
                                placeholder="Nome ou endereço"
                              />
                            </Field>
                          </div>
                          <div className="mt-4">
                            <Field label="Local da vistoria">
                              <span className="relative block">
                                <MapPin className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-primary" />
                                <input
                                  value={location}
                                  onChange={(event) => setLocation(event.target.value)}
                                  className={`${FIELD_CLASS} pl-11`}
                                  placeholder="Unidade, pátio ou endereço"
                                />
                              </span>
                            </Field>
                          </div>
                        </Panel>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDeliveryRestricted((value) => !value)}
                        className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition ${
                          deliveryRestricted
                            ? "border-amber-500/35 bg-amber-500/10"
                            : "border-border/80 bg-background/40 hover:border-primary/25"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex h-11 w-11 items-center justify-center rounded-xl ${deliveryRestricted ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}
                          >
                            <LockKeyhole className="h-5 w-5" />
                          </span>
                          <span>
                            <strong className="block text-sm">Restrição de entrega</strong>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              Impede liberação sem autorização formal registrada.
                            </span>
                          </span>
                        </span>
                        <span
                          className={`relative h-7 w-12 shrink-0 rounded-full transition ${deliveryRestricted ? "bg-amber-500" : "bg-muted"}`}
                        >
                          <span
                            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${deliveryRestricted ? "left-6" : "left-1"}`}
                          />
                        </span>
                      </button>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-6">
                      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/35 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                            Leitura do checklist
                          </p>
                          <p className="mt-1 text-sm font-bold">
                            {CHECKLIST_ITEMS.length} itens de presença + 3 medições técnicas
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.1em]">
                          <StatusCount
                            tone="success"
                            value={checklistSummary.present}
                            label="Presentes"
                          />
                          <StatusCount
                            tone="danger"
                            value={checklistSummary.absent}
                            label="Ausentes"
                          />
                          <StatusCount
                            tone="neutral"
                            value={checklistSummary.uninformed}
                            label="Pendentes"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {CHECKLIST_ITEMS.map(([key, label], index) => {
                          const value = checklist[key] ?? "nao_informado";
                          return (
                            <div
                              key={key}
                              className="rounded-2xl border border-border/75 bg-background/40 p-3.5 transition hover:border-primary/25"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2.5 text-xs font-black">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  {label}
                                </span>
                                <Wrench className="h-3.5 w-3.5 text-muted-foreground/60" />
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-background/70 p-1">
                                <ChecklistChoice
                                  active={value === "presente"}
                                  tone="success"
                                  icon={Check}
                                  label="Sim"
                                  onClick={() =>
                                    setChecklist((current) => ({ ...current, [key]: "presente" }))
                                  }
                                />
                                <ChecklistChoice
                                  active={value === "ausente"}
                                  tone="danger"
                                  icon={X}
                                  label="Não"
                                  onClick={() =>
                                    setChecklist((current) => ({ ...current, [key]: "ausente" }))
                                  }
                                />
                                <ChecklistChoice
                                  active={value === "nao_informado"}
                                  tone="neutral"
                                  icon={Minus}
                                  label="N/I"
                                  onClick={() =>
                                    setChecklist((current) => ({
                                      ...current,
                                      [key]: "nao_informado",
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                            Medições técnicas
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Registre a condição observada e os valores do veículo no momento da
                            vistoria.
                          </p>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-3">
                          <div className="rounded-2xl border border-border/75 bg-background/40 p-3.5 transition hover:border-primary/25">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2.5 text-xs font-black">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-[10px] text-primary">
                                  07
                                </span>
                                Nível do óleo
                              </span>
                              <Gauge className="h-3.5 w-3.5 text-primary/70" />
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-background/70 p-1">
                              {(
                                [
                                  ["adequado", "Adequado"],
                                  ["baixo", "Baixo"],
                                  ["critico", "Crítico"],
                                  ["nao_verificado", "Não verificado"],
                                ] as const
                              ).map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => updateTechnicalData({ oil_level: value })}
                                  className={`rounded-lg px-2 py-2 text-[10px] font-black transition ${
                                    technicalData.oil_level === value
                                      ? value === "critico"
                                        ? "bg-destructive/15 text-destructive"
                                        : value === "baixo"
                                          ? "bg-amber-500/15 text-amber-500"
                                          : value === "adequado"
                                            ? "bg-success/15 text-success"
                                            : "bg-muted text-foreground"
                                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/75 bg-background/40 p-3.5 transition hover:border-primary/25">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2.5 text-xs font-black">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-[10px] text-primary">
                                  08
                                </span>
                                Rodas e aro
                              </span>
                              <Wrench className="h-3.5 w-3.5 text-primary/70" />
                            </div>
                            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_5.75rem] gap-2">
                              <label className="space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                                  Marca
                                </span>
                                <input
                                  value={technicalData.wheel_brand ?? ""}
                                  onChange={(event) =>
                                    updateTechnicalData({ wheel_brand: event.target.value })
                                  }
                                  className="h-10 w-full rounded-xl border border-border/80 bg-background/75 px-3 text-xs font-bold outline-none transition focus:border-primary/65 focus:ring-4 focus:ring-primary/10"
                                  placeholder="Ex.: Michelin"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                                  Aro
                                </span>
                                <input
                                  value={technicalData.wheel_rim ?? ""}
                                  onChange={(event) =>
                                    updateTechnicalData({ wheel_rim: event.target.value })
                                  }
                                  className="h-10 w-full rounded-xl border border-border/80 bg-background/75 px-3 text-xs font-bold outline-none transition focus:border-primary/65 focus:ring-4 focus:ring-primary/10"
                                  placeholder="17"
                                />
                              </label>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/75 bg-background/40 p-3.5 transition hover:border-primary/25">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2.5 text-xs font-black">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-[10px] text-primary">
                                  09
                                </span>
                                Quilometragem
                              </span>
                              <Gauge className="h-3.5 w-3.5 text-primary/70" />
                            </div>
                            <label className="relative mt-3 block">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={technicalData.mileage_km ?? ""}
                                onChange={(event) =>
                                  updateTechnicalData({
                                    mileage_km:
                                      event.target.value === "" ? null : Number(event.target.value),
                                  })
                                }
                                className="h-[3.65rem] w-full rounded-xl border border-border/80 bg-background/75 px-4 pr-14 text-lg font-black outline-none transition focus:border-primary/65 focus:ring-4 focus:ring-primary/10"
                                placeholder="0"
                              />
                              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                                km
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <FindingField
                          index="01"
                          title="Identificação e sinais"
                          value={identificationFindings}
                          onChange={setIdentificationFindings}
                          placeholder="Chassi, motor, placas, etiquetas e demais sinais..."
                        />
                        <FindingField
                          index="02"
                          title="Estrutura e integridade"
                          value={structureFindings}
                          onChange={setStructureFindings}
                          placeholder="Estrutura, fixações, vidros e componentes..."
                        />
                        <FindingField
                          index="03"
                          title="Estado de conservação"
                          value={conservationFindings}
                          onChange={setConservationFindings}
                          placeholder="Condições gerais observadas..."
                        />
                        <FindingField
                          index="04"
                          title="Acessórios e itens adicionais"
                          value={accessoriesFindings}
                          onChange={setAccessoriesFindings}
                          placeholder="Itens presentes, ausentes ou divergentes..."
                        />
                      </div>
                    </div>
                  ) : null}

                  {step === 4 ? (
                    <div className="space-y-6">
                      <PhotoCapturePanel
                        title="Registro fotográfico do veículo"
                        description="Fotografe a condição em que o veículo foi apresentado. Selecione a posição antes de adicionar as imagens."
                        allowedCategories={["veiculo"]}
                        options={VEHICLE_PHOTO_OPTIONS}
                        descriptionValue={photoVehicleDescription}
                        onDescriptionChange={setPhotoVehicleDescription}
                        savedPhotos={savedPhotos.filter((photo) => photo.category === "veiculo")}
                        pendingPhotos={pendingPhotos.filter(
                          (photo) => photo.category === "veiculo",
                        )}
                        onAdd={addPendingPhotos}
                        onUpdate={updatePendingPhoto}
                        onRemove={removePendingPhoto}
                      />
                      <PhotoCapturePanel
                        title="Registro fotográfico dos sinais identificadores"
                        description="Registre chassi, motor, placa, etiqueta de segurança e outros sinais examinados."
                        allowedCategories={INSPECTION_PHOTO_CATEGORIES.filter(
                          (category) => category !== "veiculo",
                        )}
                        options={IDENTIFIER_PHOTO_OPTIONS}
                        descriptionValue={photoIdentifiersDescription}
                        onDescriptionChange={setPhotoIdentifiersDescription}
                        savedPhotos={savedPhotos.filter((photo) => photo.category !== "veiculo")}
                        pendingPhotos={pendingPhotos.filter(
                          (photo) => photo.category !== "veiculo",
                        )}
                        onAdd={addPendingPhotos}
                        onUpdate={updatePendingPhoto}
                        onRemove={removePendingPhoto}
                      />
                    </div>
                  ) : null}

                  {step === 5 ? (
                    <div className="space-y-5">
                      <Panel icon={Gauge} title="Condição operacional e diagnóstico" tone="primary">
                        <div className="grid gap-4 lg:grid-cols-3">
                          <Field label="Nível de combustível">
                            <select
                              value={technicalData.fuel_level ?? "nao_verificado"}
                              onChange={(event) =>
                                updateTechnicalData({
                                  fuel_level: event.target.value as NonNullable<
                                    typeof technicalData.fuel_level
                                  >,
                                })
                              }
                              className={FIELD_CLASS}
                            >
                              <option value="nao_verificado">Não verificado</option>
                              <option value="vazio">Vazio</option>
                              <option value="reserva">Reserva</option>
                              <option value="um_quarto">1/4</option>
                              <option value="meio">1/2</option>
                              <option value="tres_quartos">3/4</option>
                              <option value="cheio">Cheio</option>
                            </select>
                          </Field>
                          <Field label="Estado do veículo">
                            <select
                              value={technicalData.vehicle_condition ?? "nao_informado"}
                              onChange={(event) =>
                                updateTechnicalData({
                                  vehicle_condition: event.target.value as NonNullable<
                                    typeof technicalData.vehicle_condition
                                  >,
                                })
                              }
                              className={FIELD_CLASS}
                            >
                              <option value="nao_informado">Não informado</option>
                              <option value="servivel">Servível</option>
                              <option value="inservivel">Inservível</option>
                            </select>
                          </Field>
                          <Field label="Avarias aparentes">
                            <input
                              value={technicalData.damage_notes ?? ""}
                              onChange={(event) =>
                                updateTechnicalData({ damage_notes: event.target.value })
                              }
                              className={FIELD_CLASS}
                              placeholder="Ex.: sem avarias aparentes"
                            />
                          </Field>
                        </div>
                        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <AssessmentQuestion
                            label="Produto de furto ou roubo?"
                            value={assessment.stolen_or_robbed}
                            onChange={(value) => updateAssessment({ stolen_or_robbed: value })}
                          />
                          <AssessmentQuestion
                            label="Possui outras restrições?"
                            value={assessment.other_restrictions}
                            onChange={(value) => updateAssessment({ other_restrictions: value })}
                          />
                          <AssessmentQuestion
                            label="Há divergência em sinais identificadores?"
                            value={assessment.identifier_divergence}
                            onChange={(value) => updateAssessment({ identifier_divergence: value })}
                          />
                          <AssessmentQuestion
                            label="Características originais identificadas?"
                            value={assessment.original_characteristics_identified}
                            onChange={(value) =>
                              updateAssessment({ original_characteristics_identified: value })
                            }
                          />
                          <AssessmentQuestion
                            label="Veículo submetido ao OBD?"
                            value={assessment.obd_examined}
                            onChange={(value) => updateAssessment({ obd_examined: value })}
                          />
                          <AssessmentQuestion
                            label="O veículo foi periciado?"
                            value={assessment.expert_examined}
                            onChange={(value) => updateAssessment({ expert_examined: value })}
                          />
                          <AssessmentQuestion
                            label="Adulteração de sinais constatada?"
                            value={assessment.tampering_confirmed}
                            onChange={(value) => updateAssessment({ tampering_confirmed: value })}
                          />
                        </div>
                      </Panel>

                      {assessment.identifier_divergence === "sim" ? (
                        <Panel
                          icon={Fingerprint}
                          title="Indícios de divergência ou ausência de sinais"
                        >
                          <div className="grid gap-2 lg:grid-cols-2">
                            {DIVERGENCE_INDICATORS.map(([key, label]) => {
                              const selected = assessment.divergence_indicators?.includes(key);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    const current = assessment.divergence_indicators ?? [];
                                    updateAssessment({
                                      divergence_indicators: selected
                                        ? current.filter((item) => item !== key)
                                        : [...current, key],
                                    });
                                  }}
                                  className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left text-xs font-bold leading-5 transition ${
                                    selected
                                      ? "border-primary/40 bg-primary/10 text-foreground"
                                      : "border-border/75 bg-background/45 text-muted-foreground hover:border-primary/25 hover:text-foreground"
                                  }`}
                                >
                                  <span
                                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                                  >
                                    {selected ? <Check className="h-3 w-3" /> : null}
                                  </span>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </Panel>
                      ) : null}

                      <div className="grid gap-4 lg:grid-cols-2">
                        <FindingField
                          index="05"
                          title="Resultados obtidos"
                          value={resultFindings}
                          onChange={setResultFindings}
                          placeholder="Consolide os sinais examinados, divergências e conclusão técnica..."
                        />
                        <FindingField
                          index="06"
                          title="Providências adotadas"
                          value={measuresTaken}
                          onChange={setMeasuresTaken}
                          placeholder="Ex.: requisição pericial, comunicação ao DETRAN, encaminhamento..."
                        />
                      </div>

                      <details className="group rounded-3xl border border-border/75 bg-background/35">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                              Questionário administrativo
                            </p>
                            <p className="mt-1 text-sm font-black">
                              Custódia, notificações e destinação
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground transition group-open:rotate-90" />
                        </summary>
                        <div className="grid gap-3 border-t border-border/70 p-5 md:grid-cols-2">
                          {CUSTODY_QUESTIONNAIRE.map(([key, label]) => (
                            <AssessmentQuestion
                              key={key}
                              label={label}
                              value={assessment.questionnaire?.[key]}
                              onChange={(value) =>
                                updateAssessment({
                                  questionnaire: {
                                    ...assessment.questionnaire,
                                    [key]: value,
                                  },
                                })
                              }
                            />
                          ))}
                        </div>
                      </details>
                    </div>
                  ) : null}

                  {step === 6 ? (
                    <div className="space-y-5">
                      <div className="grid gap-4 lg:grid-cols-[1fr_0.42fr]">
                        <Panel icon={UsersRound} title="Vínculos e observações">
                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Pessoas vinculadas" hint="Uma pessoa por linha">
                              <textarea
                                value={linkedPeopleText}
                                onChange={(event) => setLinkedPeopleText(event.target.value)}
                                rows={7}
                                className={TEXTAREA_CLASS}
                                placeholder="Nome — vínculo ou condição"
                              />
                            </Field>
                            <Field label="Observações do vistoriador" hint="Síntese técnica">
                              <textarea
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                rows={7}
                                className={TEXTAREA_CLASS}
                                placeholder="Observações complementares"
                              />
                            </Field>
                          </div>
                          {editingInspection ? (
                            <div className="mt-4">
                              <Field label="Motivo da alteração" hint="Obrigatório para auditoria">
                                <input
                                  value={changeReason}
                                  onChange={(event) => setChangeReason(event.target.value)}
                                  className={FIELD_CLASS}
                                  placeholder="Ex.: complementação das constatações"
                                />
                              </Field>
                            </div>
                          ) : null}
                        </Panel>

                        <div className="rounded-3xl border border-primary/25 bg-primary/[0.055] p-5">
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/12 text-primary">
                            <ClipboardCheck className="h-5 w-5" />
                          </span>
                          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.17em] text-primary">
                            Prontidão do registro
                          </p>
                          <p className="mt-2 text-4xl font-black tracking-tight">{completeness}%</p>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/70">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${completeness}%` }}
                            />
                          </div>
                          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                            Campos não informados permanecem identificados no relatório, sem impedir
                            o registro da versão.
                          </p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-3xl border border-border/75 bg-background/35">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-primary">
                              Prévia do documento
                            </p>
                            <h3 className="mt-1 font-black">Relatório em formato A4</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Esta é a composição que seguirá para impressão e geração do PDF.
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                            <BadgeCheck className="h-4 w-4" /> Prévia ao vivo
                          </span>
                        </div>
                        <div className="sipi-vistoria-review-stage">
                          <VehicleInspectionPrintSheet
                            inspection={reviewInspection}
                            photos={reviewPhotos}
                            preview
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <footer
              className={`inspection-registration-light z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-card/95 px-5 py-4 md:px-7 ${step === 1 && !selectedVehicle ? "" : "sticky bottom-0 backdrop-blur-xl"}`}
            >
              <button
                type="button"
                onClick={step === 1 ? () => void navigate({ to: "/vistorias" }) : previousStep}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold transition hover:border-primary/30 hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" /> {step === 1 ? "Cancelar" : "Etapa anterior"}
              </button>
              <div className="hidden items-center gap-2 text-[10px] font-bold text-muted-foreground sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Alterações locais até o
                salvamento
              </div>
              {step < STEPS.length ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow-[0_10px_24px_-12px_color-mix(in_oklab,var(--primary)_90%,transparent)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
                >
                  Avançar para {STEPS.find((item) => item.id === step + 1)?.label ?? "revisão"}{" "}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void saveInspection()}
                  disabled={saving || loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow-[0_10px_24px_-12px_color-mix(in_oklab,var(--primary)_90%,transparent)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
                >
                  {saving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {saving
                    ? "Registrando versão..."
                    : editingInspection
                      ? "Salvar nova versão"
                      : "Concluir vistoria"}
                </button>
              )}
            </footer>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

function SectionTitle({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: typeof CarFront;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_24px_-12px_color-mix(in_oklab,var(--primary)_90%,transparent)]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-black tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-semibold">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {hint ? (
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function HeroMetric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Gauge;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/75 bg-background/45 p-3 backdrop-blur-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-black">{value}</p>
        <p className="truncate text-[10px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function VehicleDatum({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Fingerprint;
  label: string;
  value: unknown;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 bg-background/75 p-4">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.13em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 truncate text-xs font-black">
          {value ? String(value) : "Não informado"}
        </p>
      </div>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
  tone = "neutral",
}: {
  icon: typeof Building2;
  title: string;
  children: ReactNode;
  tone?: "primary" | "neutral";
}) {
  return (
    <section
      className={`rounded-3xl border p-5 ${tone === "primary" ? "border-primary/25 bg-primary/[0.045]" : "border-border/75 bg-background/35"}`}
    >
      <div className="mb-5 flex items-center gap-3 border-b border-border/65 pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="font-black">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ChecklistChoice({
  active,
  tone,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  tone: "success" | "danger" | "neutral";
  icon: typeof Check;
  label: string;
  onClick: () => void;
}) {
  const activeClass =
    tone === "success"
      ? "bg-emerald-500/15 text-emerald-500"
      : tone === "danger"
        ? "bg-rose-500/15 text-rose-500"
        : "bg-muted text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[10px] font-black transition ${active ? activeClass : "text-muted-foreground hover:bg-muted/60"}`}
      aria-pressed={active}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function AssessmentQuestion({
  label,
  value = "nao_informado",
  onChange,
}: {
  label: string;
  value?: VehicleInspectionAnswer;
  onChange: (value: VehicleInspectionAnswer) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/75 bg-background/45 p-3.5">
      <p className="min-h-10 text-xs font-bold leading-5">{label}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-background/70 p-1">
        <ChecklistChoice
          active={value === "sim"}
          tone="success"
          icon={Check}
          label="Sim"
          onClick={() => onChange("sim")}
        />
        <ChecklistChoice
          active={value === "nao"}
          tone="danger"
          icon={X}
          label="Não"
          onClick={() => onChange("nao")}
        />
        <ChecklistChoice
          active={value === "nao_informado"}
          tone="neutral"
          icon={Minus}
          label="N/I"
          onClick={() => onChange("nao_informado")}
        />
      </div>
    </div>
  );
}

function StatusCount({
  tone,
  value,
  label,
}: {
  tone: "success" | "danger" | "neutral";
  value: number;
  label: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
      : tone === "danger"
        ? "border-rose-500/25 bg-rose-500/10 text-rose-500"
        : "border-border bg-muted/60 text-muted-foreground";
  return (
    <span className={`rounded-full border px-3 py-1.5 ${toneClass}`}>
      {value} {label}
    </span>
  );
}

function FindingField({
  index,
  title,
  value,
  onChange,
  placeholder,
}: {
  index: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="rounded-2xl border border-border/75 bg-background/35 p-4 transition focus-within:border-primary/35 focus-within:bg-primary/[0.025]">
      <span className="mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-black text-primary">
          {index}
        </span>
        <span>
          <span className="block text-sm font-black">{title}</span>
          <span className="text-[10px] text-muted-foreground">Constatação técnica</span>
        </span>
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className={TEXTAREA_CLASS}
        placeholder={placeholder}
      />
    </label>
  );
}

function PhotoCapturePanel({
  title,
  description,
  allowedCategories,
  options,
  descriptionValue,
  onDescriptionChange,
  savedPhotos,
  pendingPhotos,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  description: string;
  allowedCategories: InspectionPhotoCategory[];
  options: PhotoCaptureOption[];
  descriptionValue: string;
  onDescriptionChange: (value: string) => void;
  savedPhotos: VehicleInspectionPhoto[];
  pendingPhotos: PendingInspectionPhoto[];
  onAdd: (files: FileList | null, category: InspectionPhotoCategory, caption?: string) => void;
  onUpdate: (photoId: string, patch: Partial<PendingInspectionPhoto>) => void;
  onRemove: (photoId: string) => void;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState(options[0].id);
  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? options[0];

  return (
    <section className="overflow-hidden rounded-3xl border border-border/75 bg-white">
      <div className="flex flex-col gap-4 border-b border-border/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Camera className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-black">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground shadow-sm transition hover:brightness-105">
          <ImagePlus className="h-4 w-4" /> Adicionar:{" "}
          {selectedOption.label.replace(/^Foto - /, "")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(event) => {
              onAdd(event.target.files, selectedOption.category, selectedOption.caption);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[190px_minmax(0,1fr)]">
        <div className="flex flex-wrap content-start gap-2 lg:flex-col">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedOptionId(option.id)}
              aria-pressed={selectedOptionId === option.id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${selectedOptionId === option.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-white text-foreground hover:border-primary/30"}`}
            >
              <Camera className="h-4 w-4 shrink-0" /> {option.label}
            </button>
          ))}
        </div>
        {savedPhotos.length || pendingPhotos.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {savedPhotos.map((photo) => (
              <figure
                key={photo.id}
                className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.045]"
              >
                {photo.vehicle_photo?.thumbnail_url ? (
                  <img
                    src={photo.vehicle_photo.thumbnail_url}
                    alt={photo.caption || PHOTO_CATEGORY_LABELS[photo.category]}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-muted text-xs text-muted-foreground">
                    Prévia indisponível
                  </div>
                )}
                <figcaption className="p-3">
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-500">
                    Foto vinculada
                  </span>
                  <p className="mt-1 text-xs font-bold">
                    {photo.caption || PHOTO_CATEGORY_LABELS[photo.category]}
                  </p>
                </figcaption>
              </figure>
            ))}

            {pendingPhotos.map((photo) => (
              <article
                key={photo.id}
                className="overflow-hidden rounded-2xl border border-primary/25 bg-primary/[0.04]"
              >
                <div className="relative">
                  <img
                    src={photo.previewUrl}
                    alt={photo.caption || PHOTO_CATEGORY_LABELS[photo.category]}
                    className="aspect-video w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(photo.id)}
                    className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-black/70 text-white transition hover:bg-destructive"
                    aria-label="Remover fotografia antes do envio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2 p-3">
                  {allowedCategories.length > 1 ? (
                    <select
                      value={photo.category}
                      onChange={(event) =>
                        onUpdate(photo.id, {
                          category: event.target.value as InspectionPhotoCategory,
                        })
                      }
                      aria-label="Categoria da fotografia"
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold"
                    >
                      {allowedCategories.map((category) => (
                        <option key={category} value={category}>
                          {PHOTO_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    value={photo.caption}
                    onChange={(event) => onUpdate(photo.id, { caption: event.target.value })}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold outline-none focus:border-primary/60"
                    placeholder="Legenda ou posição da foto"
                    aria-label="Legenda da fotografia"
                  />
                  <p className="text-[10px] font-bold text-primary">Será enviada ao salvar</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/[0.025] p-6 text-center transition hover:bg-primary/[0.06]">
            <ImagePlus className="h-7 w-7 text-primary" />
            <strong className="mt-3 text-sm">Nenhuma fotografia adicionada</strong>
            <span className="mt-1 text-xs text-muted-foreground">
              Clique para selecionar uma ou várias imagens.
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => {
                onAdd(event.target.files, selectedOption.category, selectedOption.caption);
                event.currentTarget.value = "";
              }}
            />
          </label>
        )}
      </div>
      <label className="block border-t border-border/70 p-5">
        <span className="mb-2 block text-sm font-black">Descrição</span>
        <textarea
          value={descriptionValue}
          onChange={(event) => onDescriptionChange(event.target.value)}
          rows={3}
          className={TEXTAREA_CLASS}
          placeholder="Descreva o que as fotografias mostram e a condição encontrada."
        />
      </label>
    </section>
  );
}
