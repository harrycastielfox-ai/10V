import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  LoaderCircle,
  MapPin,
  UsersRound,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import {
  createVehicleInspection,
  listVehicleInspections,
  listVehiclesForInspection,
  updateVehicleInspection,
} from "@/lib/repositories/vistoriasRepository";
import {
  INSPECTION_PRESENTATION_REASONS,
  INSPECTION_PRESENTING_INSTITUTIONS,
  INSPECTION_YARD_TYPES,
  type InspectionPresentationReason,
  type InspectionPresentingInstitution,
  type InspectionYardType,
  type VehicleInspection,
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

const STEPS = [
  { id: 1, label: "Veículo", description: "Identificação e data", icon: CarFront },
  { id: 2, label: "Apresentação", description: "Origem e custódia", icon: Building2 },
  { id: 3, label: "Exame", description: "Checklist e constatações", icon: ListChecks },
  { id: 4, label: "Revisão", description: "Pessoas e confirmação", icon: UsersRound },
] as const;

type Step = (typeof STEPS)[number]["id"];

const FIELD_CLASS =
  "h-11 w-full rounded-xl border border-input bg-background/75 px-3 text-sm font-normal outline-none transition focus:border-primary/65 focus:ring-4 focus:ring-primary/10";
const TEXTAREA_CLASS =
  "w-full resize-y rounded-xl border border-input bg-background/75 px-3 py-3 text-sm font-normal outline-none transition focus:border-primary/65 focus:ring-4 focus:ring-primary/10";

export default function VehicleInspectionFormPage({ inspectionId }: { inspectionId?: string }) {
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
  const [linkedPeopleText, setLinkedPeopleText] = useState("");
  const [changeReason, setChangeReason] = useState("");

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;

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
        setLinkedPeopleText((inspection.linked_people ?? []).join("\n"));
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
    setStep((current) => Math.min(4, current + 1) as Step);
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
      if (editingInspection) {
        await updateVehicleInspection(editingInspection.id, input, changeReason);
      } else {
        await createVehicleInspection(input);
      }
      await navigate({ to: "/vistorias" });
    } catch {
      setError("Não foi possível salvar a vistoria. Verifique os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout module="vistorias">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm md:p-6">
          <Link
            to="/vistorias"
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para vistorias
          </Link>
          <div className="mt-4 flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <ClipboardCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                {inspectionId ? "Edição de vistoria" : "Novo registro"}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                {inspectionId ? "Editar vistoria" : "Nova vistoria"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Cadastro separado da consulta, organizado em etapas para evitar informações
                misturadas.
              </p>
            </div>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-primary/25 bg-card/90 shadow-[0_18px_55px_-35px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
          <nav className="grid border-b border-border/80 bg-background/30 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((item) => {
              const Icon = item.icon;
              const active = step === item.id;
              const completed = step > item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(item.id)}
                  className={`flex items-center gap-3 border-b border-border/60 px-5 py-4 text-left transition sm:border-r xl:border-b-0 ${
                    active
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
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
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm">{item.label}</strong>
                    <span className="block truncate text-[11px] opacity-75">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-h-[430px] p-5 md:p-7">
            {loading ? (
              <div className="flex min-h-[360px] items-center justify-center text-muted-foreground">
                <LoaderCircle className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                {error ? (
                  <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="space-y-5">
                    <SectionTitle
                      icon={CarFront}
                      title="Identifique o veículo"
                      description="A vistoria ficará permanentemente vinculada a este cadastro."
                    />
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,0.7fr)]">
                      <label className="space-y-2 text-sm font-semibold">
                        Veículo cadastrado
                        <select
                          value={vehicleId}
                          onChange={(event) => setVehicleId(event.target.value)}
                          disabled={Boolean(editingInspection)}
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
                      <div className="rounded-2xl border border-primary/25 bg-primary/[0.07] p-4">
                        <p className="text-xs font-black uppercase tracking-[0.15em] text-primary">
                          Veículo selecionado
                        </p>
                        <p className="mt-2 text-lg font-black">{selectedVehicle.internal_id}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedVehicle.brand_model || "Modelo não informado"} ·{" "}
                          {selectedVehicle.plate || "Sem placa"}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border bg-background/40 p-4 text-sm text-muted-foreground">
                        Veículo ainda não cadastrado?{" "}
                        <Link
                          to="/veiculos/novo"
                          className="font-bold text-primary hover:underline"
                        >
                          Cadastrar veículo
                        </Link>
                      </div>
                    )}
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="space-y-5">
                    <SectionTitle
                      icon={Building2}
                      title="Apresentação e custódia"
                      description="Registre a origem, o motivo e o destino do veículo."
                    />
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Field label="Número do B.O. / ocorrência">
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
                      <Field label="Instituição que apresentou">
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
                      <Field label="Local da vistoria">
                        <span className="relative block">
                          <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                          <input
                            value={location}
                            onChange={(event) => setLocation(event.target.value)}
                            className={`${FIELD_CLASS} pl-10`}
                            placeholder="Unidade, pátio ou endereço"
                          />
                        </span>
                      </Field>
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
                    <label className="flex items-center gap-3 rounded-xl border border-border bg-background/45 p-4 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={deliveryRestricted}
                        onChange={(event) => setDeliveryRestricted(event.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      Veículo com restrição de entrega
                    </label>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="space-y-6">
                    <SectionTitle
                      icon={ListChecks}
                      title="Exame do veículo"
                      description="Registre itens observados e constatações técnicas."
                    />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {CHECKLIST_ITEMS.map(([key, label]) => (
                        <label
                          key={key}
                          className="rounded-xl border border-border bg-background/45 p-3 text-xs font-bold"
                        >
                          <span>{label}</span>
                          <select
                            value={checklist[key] ?? "nao_informado"}
                            onChange={(event) =>
                              setChecklist((current) => ({
                                ...current,
                                [key]: event.target.value as VehicleInspectionChecklist[string],
                              }))
                            }
                            className={`${FIELD_CLASS} mt-2`}
                          >
                            <option value="nao_informado">Não informado</option>
                            <option value="presente">Presente</option>
                            <option value="ausente">Ausente</option>
                          </select>
                        </label>
                      ))}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <TextArea
                        label="Identificação e sinais"
                        value={identificationFindings}
                        onChange={setIdentificationFindings}
                        placeholder="Chassi, motor, placas, etiquetas e demais sinais"
                      />
                      <TextArea
                        label="Estrutura e integridade"
                        value={structureFindings}
                        onChange={setStructureFindings}
                        placeholder="Estrutura, fixações, vidros e componentes"
                      />
                      <TextArea
                        label="Estado de conservação"
                        value={conservationFindings}
                        onChange={setConservationFindings}
                        placeholder="Condições gerais observadas"
                      />
                      <TextArea
                        label="Acessórios e itens adicionais"
                        value={accessoriesFindings}
                        onChange={setAccessoriesFindings}
                        placeholder="Itens presentes, ausentes ou divergentes"
                      />
                    </div>
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="space-y-5">
                    <SectionTitle
                      icon={UsersRound}
                      title="Revisão e confirmação"
                      description="Complete os vínculos e confirme antes de salvar."
                    />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field label="Pessoas vinculadas — uma por linha">
                        <textarea
                          value={linkedPeopleText}
                          onChange={(event) => setLinkedPeopleText(event.target.value)}
                          rows={6}
                          className={TEXTAREA_CLASS}
                          placeholder="Nome — vínculo ou condição"
                        />
                      </Field>
                      <Field label="Observações do vistoriador">
                        <textarea
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          rows={6}
                          className={TEXTAREA_CLASS}
                          placeholder="Observações complementares"
                        />
                      </Field>
                    </div>
                    {editingInspection ? (
                      <Field label="Motivo da alteração">
                        <input
                          value={changeReason}
                          onChange={(event) => setChangeReason(event.target.value)}
                          className={FIELD_CLASS}
                          placeholder="Ex.: complementação das constatações"
                        />
                      </Field>
                    ) : null}
                    <div className="grid gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <Review
                        label="Veículo"
                        value={selectedVehicle?.internal_id || "Não selecionado"}
                      />
                      <Review label="Data" value={inspectionDate || "Não informada"} />
                      <Review label="B.O." value={policeReportNumber || "Não informado"} />
                      <Review label="Local" value={location || "Não informado"} />
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/25 px-5 py-4 md:px-7">
            <button
              type="button"
              onClick={step === 1 ? () => void navigate({ to: "/vistorias" }) : previousStep}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold transition hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" /> {step === 1 ? "Cancelar" : "Voltar"}
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
              >
                Continuar <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void saveInspection()}
                disabled={saving || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
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
          </footer>
        </section>
      </div>
    </AppLayout>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CarFront;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className="font-black">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2 text-sm font-semibold">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className={TEXTAREA_CLASS}
        placeholder={placeholder}
      />
    </Field>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-bold">{value}</p>
    </div>
  );
}
