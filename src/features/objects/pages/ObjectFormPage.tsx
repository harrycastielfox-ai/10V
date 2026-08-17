import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Link2,
  LoaderCircle,
  Save,
  ShieldAlert,
  X,
} from "lucide-react";
import { useAppProfile } from "@/components/AppProfileContext";
import { FormFieldLabel } from "@/components/FormFieldLabel";
import { canCreateObjects, canEditObjects, canReleaseObjects } from "@/lib/authz";
import {
  searchInqueritosForLink,
  type InqueritoLinkOption,
} from "@/lib/repositories/inqueritosRepository";
import {
  createObject,
  getObjectById,
  updateObject,
  uploadObjectPhotos,
} from "@/lib/repositories/objectsRepository";
import { validateObjectImage } from "../imageCompression";
import {
  MEASUREMENT_UNIT_LABELS,
  OBJECT_OCCURRENCE_TYPES,
  OBJECT_SITUATION_LABELS,
  OBJECT_TYPES_WITH_BRAND_MODEL,
  OBJECT_TYPES_WITH_CALIBER,
  OBJECT_TYPES_WITH_DOCUMENT_INFO,
  OBJECT_TYPES_WITH_SERIAL,
  OBJECT_TYPE_LABELS,
} from "../objectConstants";
import { useDebouncedValue } from "../useDebouncedValue";
import type {
  MeasurementUnit,
  ObjectPayload,
  ObjectRecord,
  ObjectSituation,
  ObjectType,
} from "../objectTypes";

type FormMode = "create" | "edit";

/**
 * Situações que só quem tem permissão de liberação (Delegado/Admin) pode
 * atribuir. Sem isso, um editor comum poderia destruir ou liberar um
 * objeto direto pelo cadastro, contornando o fluxo de liberação — a mesma
 * proteção que já existe no banco (gatilho enforce_object_privileged_changes)
 * também precisa existir aqui, para não expor uma opção que o servidor vai
 * recusar.
 */
const RELEASE_ONLY_SITUATIONS = new Set(["liberado", "incinerado", "disposicao_justica"]);

type FormState = {
  objectType: ObjectType;
  description: string;
  brandModel: string;
  serialNumber: string;
  caliber: string;
  color: string;
  quantity: string;
  measurementUnit: MeasurementUnit | "";
  weightOrValue: string;
  situation: ObjectSituation | "";
  occurrenceType: string;
  status: string;
  pendingIdentification: boolean;
  procedureType: string;
  procedureNumber: string;
  policeReportNumber: string;
  courtProcessNumber: string;
  involvedPeople: string;
  documentHolderName: string;
  documentIssuingAuthority: string;
  documentNumber: string;
  inqueritoId: string;
  seizureDate: string;
  seizureLocation: string;
  custodyLocation: string;
  storageLocation: string;
  custodyResponsible: string;
  custodyObservations: string;
  observations: string;
  expertiseDate: string;
  releaseStatus: string;
  releaseDate: string;
  releasedTo: string;
  releaseDocument: string;
  releaseAuthority: string;
  deliveryTerm: string;
  releaseObservations: string;
};

const INITIAL_STATE: FormState = {
  objectType: "arma_fogo",
  description: "",
  brandModel: "",
  serialNumber: "",
  caliber: "",
  color: "",
  quantity: "1",
  measurementUnit: "",
  weightOrValue: "",
  situation: "apreendido",
  occurrenceType: "",
  status: "",
  pendingIdentification: false,
  procedureType: "",
  procedureNumber: "",
  policeReportNumber: "",
  courtProcessNumber: "",
  involvedPeople: "",
  documentHolderName: "",
  documentIssuingAuthority: "",
  documentNumber: "",
  inqueritoId: "",
  seizureDate: "",
  seizureLocation: "",
  custodyLocation: "",
  storageLocation: "",
  custodyResponsible: "",
  custodyObservations: "",
  observations: "",
  expertiseDate: "",
  releaseStatus: "nao_liberado",
  releaseDate: "",
  releasedTo: "",
  releaseDocument: "",
  releaseAuthority: "",
  deliveryTerm: "",
  releaseObservations: "",
};

const OBJECT_FIELD_HINTS: Record<string, string> = {
  "Categoria do objeto":
    "Define os campos específicos do cadastro (calibre, número de série) e onde o objeto aparecerá nas consultas.",
  Descrição: 'O que é o objeto — ex.: "Pistola Taurus PT840", "Motosserra Stihl 070".',
  "Marca / Modelo": "Marca e modelo do objeto, quando identificáveis.",
  "Número de série": "Número gravado no objeto, quando existir.",
  Calibre: "Calibre da arma ou munição, quando aplicável.",
  Cor: "Cor predominante do objeto, quando ajudar na identificação.",
  Quantidade: "Quantidade de itens — relevante para munição, dinheiro em cédulas e entorpecentes.",
  "Unidade de medida": "Como a quantidade ou o peso/valor abaixo deve ser lido.",
  "Peso ou valor": "Peso do entorpecente ou valor monetário, conforme a unidade selecionada.",
  Situação: "Condição policial atual do objeto, usada nos painéis e filtros de custódia.",
  "Tipo de ocorrência": "Natureza da ocorrência que levou à apreensão do objeto.",
  "Status operacional": "Complemento livre para indicar a etapa interna de tratamento do objeto.",
  "Tipo do procedimento": "Espécie do procedimento relacionado, como IP, APF, TCO, BOC ou outro.",
  "Número do procedimento": "Número formal do procedimento policial relacionado ao objeto.",
  "Número do B.O.": "Número do boletim de ocorrência relacionado ao objeto.",
  "Processo judicial": "Número do processo judicial relacionado, quando existir.",
  Envolvidos: "Pessoas relacionadas ao objeto, como proprietário, encontrado com ou vítima.",
  "Nome no documento": "Nome da pessoa identificada no documento apreendido.",
  "Número do documento": "Número do RG, CNH, passaporte ou outro documento apreendido.",
  "Órgão emissor / UF": "Órgão que emitiu o documento e a unidade da federação, ex.: SSP/BA.",
  "Vincular a Inquérito do SIPI":
    "Pesquise e selecione um procedimento já cadastrado para criar o vínculo direto com o objeto.",
  "Data da apreensão": "Data em que o objeto entrou em apreensão ou custódia policial.",
  "Local da apreensão": "Local onde o objeto foi localizado ou formalmente apreendido.",
  "Local de custódia": "Unidade ou endereço responsável pela custódia atual do objeto.",
  "Depósito / cofre": "Setor, cofre, prateleira ou posição física onde o objeto está armazenado.",
  "Responsável pelo recebimento": "Servidor que recebeu o objeto no local de custódia.",
  "Observações da custódia":
    "Registre lacres, embalagens, condições de guarda e outras informações.",
  "Data da perícia": "Data em que o objeto foi ou será encaminhado para exame pericial.",
  "Situação da liberação":
    "Indica se o objeto permanece retido, foi liberado, devolvido ou destruído.",
  "Data da devolução": "Data em que o objeto foi efetivamente entregue, devolvido ou destruído.",
  "Pessoa que recebeu": "Nome da pessoa que recebeu o objeto na saída da custódia.",
  "Documento apresentado": "Documento usado para comprovar identidade, propriedade ou autorização.",
  "Autoridade responsável": "Autoridade que autorizou ou determinou a liberação do objeto.",
  "Termo de entrega": "Número, referência ou descrição do termo que formalizou a entrega.",
  "Observações da saída": "Informações complementares sobre a liberação, devolução ou destruição.",
  "Fotografias do objeto":
    "Anexe até 8 imagens. O sistema cria versões comprimidas e miniaturas automaticamente.",
};

function textOrNull(value: string) {
  return value.trim() || null;
}

function numberOrNull(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function stateFromObject(object: ObjectRecord): FormState {
  return {
    objectType: object.object_type,
    description: object.description,
    brandModel: object.brand_model ?? "",
    serialNumber: object.serial_number ?? "",
    caliber: object.caliber ?? "",
    color: object.color ?? "",
    quantity: String(object.quantity ?? 1),
    measurementUnit: object.measurement_unit ?? "",
    weightOrValue: object.weight_or_value !== null ? String(object.weight_or_value) : "",
    situation: object.situation ?? "",
    occurrenceType: object.occurrence_type ?? "",
    status: object.status ?? "",
    pendingIdentification: object.pending_identification,
    procedureType: object.procedure_type ?? "",
    procedureNumber: object.procedure_number ?? "",
    policeReportNumber: object.police_report_number ?? "",
    courtProcessNumber: object.court_process_number ?? "",
    involvedPeople: object.involved_people ?? "",
    documentHolderName: object.document_holder_name ?? "",
    documentIssuingAuthority: object.document_issuing_authority ?? "",
    documentNumber: object.document_number ?? "",
    inqueritoId: object.inquerito_id ?? "",
    seizureDate: object.seizure_date ?? "",
    seizureLocation: object.seizure_location ?? "",
    custodyLocation: object.custody_location ?? "",
    storageLocation: object.storage_location ?? "",
    custodyResponsible: object.custody_responsible ?? "",
    custodyObservations: object.custody_observations ?? "",
    observations: object.observations ?? "",
    expertiseDate: object.expertise_date ?? "",
    releaseStatus: object.release_status ?? "nao_liberado",
    releaseDate: object.release_date ?? "",
    releasedTo: object.released_to ?? "",
    releaseDocument: object.release_document ?? "",
    releaseAuthority: object.release_authority ?? "",
    deliveryTerm: object.delivery_term ?? "",
    releaseObservations: object.release_observations ?? "",
  };
}

function toPayload(state: FormState): ObjectPayload {
  return {
    object_type: state.objectType,
    description: state.description.trim(),
    brand_model: OBJECT_TYPES_WITH_BRAND_MODEL.includes(state.objectType)
      ? textOrNull(state.brandModel)
      : null,
    serial_number: OBJECT_TYPES_WITH_SERIAL.includes(state.objectType)
      ? textOrNull(state.serialNumber)
      : null,
    caliber: OBJECT_TYPES_WITH_CALIBER.includes(state.objectType)
      ? textOrNull(state.caliber)
      : null,
    color: textOrNull(state.color),
    quantity: Math.max(1, Number(state.quantity) || 1),
    measurement_unit: state.measurementUnit || null,
    weight_or_value: numberOrNull(state.weightOrValue),
    situation: state.situation || null,
    occurrence_type: textOrNull(state.occurrenceType),
    status: textOrNull(state.status),
    pending_identification: state.pendingIdentification,
    procedure_type: textOrNull(state.procedureType),
    procedure_number: textOrNull(state.procedureNumber),
    police_report_number: textOrNull(state.policeReportNumber),
    court_process_number: textOrNull(state.courtProcessNumber),
    involved_people: textOrNull(state.involvedPeople),
    document_holder_name: OBJECT_TYPES_WITH_DOCUMENT_INFO.includes(state.objectType)
      ? textOrNull(state.documentHolderName)
      : null,
    document_issuing_authority: OBJECT_TYPES_WITH_DOCUMENT_INFO.includes(state.objectType)
      ? textOrNull(state.documentIssuingAuthority)
      : null,
    document_number: OBJECT_TYPES_WITH_DOCUMENT_INFO.includes(state.objectType)
      ? textOrNull(state.documentNumber)
      : null,
    inquerito_id: textOrNull(state.inqueritoId),
    seizure_date: textOrNull(state.seizureDate),
    seizure_location: textOrNull(state.seizureLocation),
    custody_location: textOrNull(state.custodyLocation),
    storage_location: textOrNull(state.storageLocation),
    custody_responsible: textOrNull(state.custodyResponsible),
    custody_observations: textOrNull(state.custodyObservations),
    observations: textOrNull(state.observations),
    expertise_date: textOrNull(state.expertiseDate),
    release_status: textOrNull(state.releaseStatus),
    release_date: textOrNull(state.releaseDate),
    released_to: textOrNull(state.releasedTo),
    release_document: textOrNull(state.releaseDocument),
    release_authority: textOrNull(state.releaseAuthority),
    delivery_term: textOrNull(state.deliveryTerm),
    release_observations: textOrNull(state.releaseObservations),
  };
}

export function ObjectFormPage({ mode, objectId }: { mode: FormMode; objectId?: string }) {
  const navigate = useNavigate();
  const profile = useAppProfile();
  const canModify = mode === "create" ? canCreateObjects(profile) : canEditObjects(profile);
  const canRelease = canReleaseObjects(profile);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState("");
  // Guarda o id do cadastro já gravado para que uma nova tentativa (fotos que
  // falharam) atualize o mesmo objeto em vez de criar outro.
  const [savedObjectId, setSavedObjectId] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [inquiryQuery, setInquiryQuery] = useState("");
  const debouncedInquiryQuery = useDebouncedValue(inquiryQuery, 350);
  const [inquiries, setInquiries] = useState<InqueritoLinkOption[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<InqueritoLinkOption | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !objectId) return;
    let cancelled = false;
    void getObjectById(objectId)
      .then((object) => {
        if (!object) throw new Error("Objeto não encontrado.");
        if (!cancelled) setForm(stateFromObject(object));
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o objeto para edição.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, objectId]);

  useEffect(() => {
    let cancelled = false;
    if (debouncedInquiryQuery.trim().length < 2) {
      setInquiries([]);
      return;
    }
    void searchInqueritosForLink(debouncedInquiryQuery, 8)
      .then((items) => {
        if (!cancelled) setInquiries(items);
      })
      .catch(() => {
        if (!cancelled) setInquiries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedInquiryQuery]);

  const title = mode === "create" ? "Novo Objeto" : "Editar Objeto";
  const chosenPhotoNames = useMemo(() => photos.map((file) => file.name).join(", "), [photos]);
  const showBrandModel = OBJECT_TYPES_WITH_BRAND_MODEL.includes(form.objectType);
  const showSerialNumber = OBJECT_TYPES_WITH_SERIAL.includes(form.objectType);
  const showCaliber = OBJECT_TYPES_WITH_CALIBER.includes(form.objectType);
  const showDocumentInfo = OBJECT_TYPES_WITH_DOCUMENT_INFO.includes(form.objectType);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handlePhotos(files: FileList | null) {
    const selected = Array.from(files ?? []).slice(0, 8);
    const validation = selected.map(validateObjectImage).find(Boolean);
    if (validation) {
      setPhotoError(validation);
      return;
    }
    setPhotoError("");
    setPhotos(selected);
  }

  async function submit() {
    if (!canModify) {
      setError("Seu perfil não possui permissão para salvar objetos.");
      return;
    }
    if (!form.description.trim()) {
      setError("Descreva o objeto antes de salvar.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = toPayload(form);
      const existingId = mode === "edit" ? objectId : savedObjectId;
      const saved = existingId
        ? await updateObject(existingId, payload)
        : await createObject(payload);
      setSavedObjectId(saved.id);

      // Daqui em diante o objeto já está gravado. As fotografias são uma etapa
      // à parte: se falharem, o usuário reenvia só elas.
      if (photos.length) {
        const failed = await sendPhotos(saved.id, photos);
        if (failed.length) return;
      }
      navigate({ to: "/objetos/$objectId", params: { objectId: saved.id }, replace: true });
    } catch (submissionError) {
      console.error("[ObjectForm] Falha ao salvar", submissionError);
      setError("Não foi possível salvar o objeto. Revise os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function sendPhotos(targetObjectId: string, files: File[]) {
    const { failed } = await uploadObjectPhotos(targetObjectId, files);
    setPendingPhotos(failed);
    setPhotos(failed);
    return failed;
  }

  async function retryPendingPhotos() {
    if (!savedObjectId || !pendingPhotos.length) return;
    setSaving(true);
    setError("");
    try {
      const failed = await sendPhotos(savedObjectId, pendingPhotos);
      if (!failed.length) {
        navigate({ to: "/objetos/$objectId", params: { objectId: savedObjectId }, replace: true });
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-warning" />
      </div>
    );

  if (!canModify)
    return (
      <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-warning/30 bg-card p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-black">Alteração não autorizada</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Seu perfil possui acesso para consulta, mas não pode cadastrar ou editar objetos.
        </p>
      </section>
    );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="rounded-2xl border border-border/70 bg-card/60 p-5 lg:p-6">
        <button
          type="button"
          onClick={() => history.back()}
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-warning"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <p className="text-[10px] font-bold tracking-[0.2em] text-warning">MÓDULO OBJETOS</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O formulário aceita registros incompletos e adapta os campos à categoria selecionada.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {savedObjectId && pendingPhotos.length ? (
        <section className="rounded-xl border border-warning/35 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-warning">
                Objeto salvo.{" "}
                {pendingPhotos.length === 1
                  ? "1 fotografia não foi enviada"
                  : `${pendingPhotos.length} fotografias não foram enviadas`}
                .
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                O cadastro já está gravado — não é preciso salvar de novo. Tente enviar as
                fotografias restantes ou siga para o objeto e envie depois.
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    navigate({
                      to: "/objetos/$objectId",
                      params: { objectId: savedObjectId },
                      replace: true,
                    })
                  }
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-xs font-semibold hover:border-warning/45 disabled:opacity-50"
                >
                  Continuar sem as fotografias
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void retryPendingPhotos()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-warning px-4 text-xs font-bold text-background disabled:opacity-50"
                >
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Tentar enviar novamente
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <form
        onSubmit={(event) => event.preventDefault()}
        className="space-y-6 rounded-2xl border border-border bg-card p-5 lg:p-6"
      >
        <FormSection title="1. IDENTIFICAÇÃO" description="O que é o objeto e como reconhecê-lo.">
          <SelectField
            label="Categoria do objeto"
            value={form.objectType}
            onChange={(value) => update("objectType", value as ObjectType)}
            required
          >
            {Object.entries(OBJECT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Descrição"
            value={form.description}
            onChange={(value) => update("description", value)}
            placeholder='Ex.: "Pistola Taurus PT840"'
            className="md:col-span-2"
          />
          {showBrandModel ? (
            <TextField
              label="Marca / Modelo"
              value={form.brandModel}
              onChange={(value) => update("brandModel", value)}
            />
          ) : null}
          {showSerialNumber ? (
            <TextField
              label="Número de série"
              value={form.serialNumber}
              onChange={(value) => update("serialNumber", value)}
            />
          ) : null}
          {showCaliber ? (
            <TextField
              label="Calibre"
              value={form.caliber}
              onChange={(value) => update("caliber", value)}
            />
          ) : null}
          <TextField label="Cor" value={form.color} onChange={(value) => update("color", value)} />
          <TextField
            label="Quantidade"
            type="number"
            value={form.quantity}
            onChange={(value) => update("quantity", value)}
          />
          <SelectField
            label="Unidade de medida"
            value={form.measurementUnit}
            onChange={(value) => update("measurementUnit", value as MeasurementUnit | "")}
          >
            <option value="">Não se aplica</option>
            {Object.entries(MEASUREMENT_UNIT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Peso ou valor"
            type="number"
            value={form.weightOrValue}
            onChange={(value) => update("weightOrValue", value)}
            placeholder="Peso em gramas ou valor em reais"
          />
        </FormSection>

        <FormSection
          title="2. SITUAÇÃO POLICIAL"
          description="Ocorrência, procedimento e pessoas vinculadas."
        >
          <SelectField
            label="Situação"
            value={form.situation}
            onChange={(value) => update("situation", value as ObjectSituation | "")}
            required
          >
            {Object.entries(OBJECT_SITUATION_LABELS)
              .filter(([value]) => canRelease || !RELEASE_ONLY_SITUATIONS.has(value))
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </SelectField>
          <SelectField
            label="Tipo de ocorrência"
            value={form.occurrenceType}
            onChange={(value) => update("occurrenceType", value)}
          >
            <option value="">Selecione</option>
            {OBJECT_OCCURRENCE_TYPES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </SelectField>
          <TextField
            label="Status operacional"
            value={form.status}
            onChange={(value) => update("status", value)}
          />
          <CheckboxField
            label="Pendente de identificação"
            checked={form.pendingIdentification}
            onChange={(value) => update("pendingIdentification", value)}
          />
          <TextField
            label="Tipo do procedimento"
            value={form.procedureType}
            onChange={(value) => update("procedureType", value)}
            placeholder="IP, APF, TCO..."
          />
          <TextField
            label="Número do procedimento"
            value={form.procedureNumber}
            onChange={(value) => update("procedureNumber", value)}
          />
          <TextField
            label="Número do B.O."
            value={form.policeReportNumber}
            onChange={(value) => update("policeReportNumber", value)}
          />
          <TextField
            label="Processo judicial"
            value={form.courtProcessNumber}
            onChange={(value) => update("courtProcessNumber", value)}
          />
          <div className="relative md:col-span-2">
            <ObjectFieldLabel label="Vincular a Inquérito do SIPI" />
            {form.inqueritoId ? (
              <div className="flex h-11 items-center justify-between rounded-xl border border-warning/35 bg-warning/10 px-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Link2 className="h-4 w-4 text-warning" />
                  <span className="truncate">
                    {selectedInquiry?.numero_ppe || form.inqueritoId}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    update("inqueritoId", "");
                    setSelectedInquiry(null);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <input
                  value={inquiryQuery}
                  onChange={(event) => setInquiryQuery(event.target.value)}
                  placeholder="Digite ao menos 2 caracteres do PPE"
                  className="h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm outline-none focus:border-warning/50"
                />
                {inquiries.length ? (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl">
                    {inquiries.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          update("inqueritoId", item.id);
                          setSelectedInquiry(item);
                          setInquiryQuery("");
                          setInquiries([]);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-warning/10"
                      >
                        <strong>{item.numero_ppe || "Sem PPE"}</strong>
                        <span className="text-muted-foreground">
                          {item.tipo_procedimento_normalizado || item.tipo || "Procedimento"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
          <TextAreaField
            label="Envolvidos"
            value={form.involvedPeople}
            onChange={(value) => update("involvedPeople", value)}
            className="md:col-span-2"
            placeholder="Nomes e papel de cada pessoa relacionada ao objeto"
          />
          {showDocumentInfo ? (
            <>
              <div className="md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider text-warning">
                  Dados do documento
                </p>
              </div>
              <TextField
                label="Nome no documento"
                value={form.documentHolderName}
                onChange={(value) => update("documentHolderName", value)}
              />
              <TextField
                label="Número do documento"
                value={form.documentNumber}
                onChange={(value) => update("documentNumber", value)}
              />
              <TextField
                label="Órgão emissor / UF"
                value={form.documentIssuingAuthority}
                onChange={(value) => update("documentIssuingAuthority", value)}
                placeholder="Ex.: SSP/BA"
              />
            </>
          ) : null}
          <TextAreaField
            label="Observações gerais"
            value={form.observations}
            onChange={(value) => update("observations", value)}
            className="md:col-span-2"
          />
        </FormSection>

        <FormSection
          title="3. APREENSÃO E CUSTÓDIA"
          description="Entrada, localização e condições do objeto."
        >
          <TextField
            label="Data da apreensão"
            type="date"
            value={form.seizureDate}
            onChange={(value) => update("seizureDate", value)}
          />
          <TextField
            label="Local da apreensão"
            value={form.seizureLocation}
            onChange={(value) => update("seizureLocation", value)}
          />
          <TextField
            label="Local de custódia"
            value={form.custodyLocation}
            onChange={(value) => update("custodyLocation", value)}
          />
          <TextField
            label="Depósito / cofre"
            value={form.storageLocation}
            onChange={(value) => update("storageLocation", value)}
          />
          <TextField
            label="Responsável pelo recebimento"
            value={form.custodyResponsible}
            onChange={(value) => update("custodyResponsible", value)}
          />
          <TextField
            label="Data da perícia"
            type="date"
            value={form.expertiseDate}
            onChange={(value) => update("expertiseDate", value)}
          />
          <TextAreaField
            label="Observações da custódia"
            value={form.custodyObservations}
            onChange={(value) => update("custodyObservations", value)}
            className="md:col-span-2"
          />
        </FormSection>

        <FormSection
          title="4. LIBERAÇÃO E FOTOGRAFIAS"
          description="Preencha a saída somente quando houver e anexe fotografias comprimidas."
        >
          {canRelease ? (
            <>
              <SelectField
                label="Situação da liberação"
                value={form.releaseStatus}
                onChange={(value) => update("releaseStatus", value)}
              >
                <option value="nao_liberado">Não liberado</option>
                <option value="autorizado">Autorizado</option>
                <option value="liberado">Liberado</option>
                <option value="devolvido">Devolvido</option>
              </SelectField>
              <TextField
                label="Data da devolução"
                type="date"
                value={form.releaseDate}
                onChange={(value) => update("releaseDate", value)}
              />
              <TextField
                label="Pessoa que recebeu"
                value={form.releasedTo}
                onChange={(value) => update("releasedTo", value)}
              />
              <TextField
                label="Documento apresentado"
                value={form.releaseDocument}
                onChange={(value) => update("releaseDocument", value)}
              />
              <TextField
                label="Autoridade responsável"
                value={form.releaseAuthority}
                onChange={(value) => update("releaseAuthority", value)}
              />
              <TextField
                label="Termo de entrega"
                value={form.deliveryTerm}
                onChange={(value) => update("deliveryTerm", value)}
              />
              <TextAreaField
                label="Observações da saída"
                value={form.releaseObservations}
                onChange={(value) => update("releaseObservations", value)}
                className="md:col-span-2"
              />
            </>
          ) : (
            <div className="rounded-xl border border-warning/25 bg-warning/5 p-4 md:col-span-2">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <h3 className="text-sm font-bold">Liberação restrita</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Somente Delegado ou Administrador pode autorizar a saída, alterar os dados da
                    entrega e emitir a movimentação de liberação, devolução ou destruição.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="md:col-span-2">
            <ObjectFieldLabel label="Fotografias do objeto" />
            <label>
              <span className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-warning/35 bg-warning/5 px-4 py-5 text-center hover:bg-warning/10">
                <Camera className="h-6 w-6 text-warning" />
                <span className="mt-2 text-sm font-semibold">Selecionar até 8 fotografias</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  O original e a miniatura serão convertidos e comprimidos em WebP.
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) => handlePhotos(event.target.files)}
                  className="sr-only"
                />
              </span>
            </label>
            {chosenPhotoNames ? (
              <span className="mt-2 block truncate text-xs text-muted-foreground">
                {chosenPhotoNames}
              </span>
            ) : null}
            {photoError ? (
              <span className="mt-2 block text-xs text-destructive">{photoError}</span>
            ) : null}
          </div>
        </FormSection>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={saving || Boolean(photoError)}
            onClick={() => void submit()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-warning/60 bg-warning/10 px-5 text-sm font-semibold text-warning transition hover:bg-warning/20 disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Salvando..." : "Salvar objeto"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-5">
        <h2 className="text-sm font-black tracking-[0.14em] text-warning">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function ObjectFieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <FormFieldLabel
      label={`${label}${required ? " *" : ""}`}
      hint={OBJECT_FIELD_HINTS[label] ?? ""}
      uppercase={false}
      className="mb-1.5 text-xs font-semibold tracking-normal"
    />
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <ObjectFieldLabel label={label} />
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm outline-none focus:border-warning/50"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label>
      <ObjectFieldLabel label={label} required={required} />
      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm outline-none focus:border-warning/50"
      >
        {children}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  className = "",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <label className={className}>
      <ObjectFieldLabel label={label} />
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder={placeholder}
        className="w-full resize-y rounded-xl border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-warning/50"
      />
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex h-11 items-center gap-2 self-end rounded-xl border border-border bg-background/70 px-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-[var(--warning)]"
      />
      {label}
    </label>
  );
}
