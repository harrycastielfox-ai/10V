import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  FileSignature,
  Link2,
  LoaderCircle,
  MapPin,
  Pencil,
  Repeat2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useAppProfile } from "@/components/AppProfileContext";
import { SipiPrintSheet, type SipiPrintSection } from "@/components/SipiPrintSheet";
import {
  canDeleteVehicles,
  canEditVehicles,
  canRegisterVehicleMovements,
  canReleaseVehicles,
} from "@/lib/authz";
import {
  getVehicleDetailBundle,
  registerVehicleMovement,
  softDeleteVehicle,
} from "@/lib/repositories/vehiclesRepository";
import { VehicleStatusBadge } from "../components/VehicleStatusBadge";
import { VehicleTimeline } from "../components/VehicleTimeline";
import {
  IDENTIFICATION_STATUS_LABELS,
  VEHICLE_SITUATION_LABELS,
  VEHICLE_TYPE_LABELS,
  displayVehicleValue,
  formatVehicleDate,
} from "../vehicleConstants";
import { formatVehicleInvolvedPeople } from "../vehiclePeople";
import type {
  VehicleMovementRecord,
  VehiclePhotoRecord,
  VehicleRecord,
  VehicleTimelineEvent,
} from "../vehicleTypes";

type DetailBundle = {
  vehicle: VehicleRecord;
  photos: VehiclePhotoRecord[];
  timeline: VehicleTimelineEvent[];
};

type MovementDraft = {
  movementType: VehicleMovementRecord["movement_type"];
  occurredAt: string;
  fromLocation: string;
  toLocation: string;
  notes: string;
  releasedTo: string;
  releaseDocument: string;
  releaseAuthority: string;
};

const INITIAL_MOVEMENT: MovementDraft = {
  movementType: "transferencia",
  occurredAt: new Date().toISOString().slice(0, 16),
  fromLocation: "",
  toLocation: "",
  notes: "",
  releasedTo: "",
  releaseDocument: "",
  releaseAuthority: "",
};

function createInitialMovement(fromLocation = ""): MovementDraft {
  const now = new Date();
  const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return {
    ...INITIAL_MOVEMENT,
    occurredAt: localDateTime,
    fromLocation,
  };
}

const movementLabels: Record<VehicleMovementRecord["movement_type"], string> = {
  entrada: "Entrada",
  apreensao: "Apreensão",
  transferencia: "Transferência",
  pericia: "Perícia",
  liberacao: "Liberação",
  devolucao: "Devolução",
  atualizacao: "Atualização",
};

const movementDescriptions: Record<VehicleMovementRecord["movement_type"], string> = {
  entrada: "Entrada do veículo em uma unidade ou depósito.",
  apreensao: "Formaliza a apreensão e define o local de custódia.",
  transferencia: "Move o veículo entre unidades, pátios ou depósitos.",
  pericia: "Registra o encaminhamento ou realização de perícia.",
  liberacao: "Entrega o veículo à pessoa autorizada.",
  devolucao: "Registra a devolução ao proprietário ou responsável.",
  atualizacao: "Acrescenta uma ocorrência ao histórico sem alterar a situação.",
};

function getMovementValidationErrors(draft: MovementDraft) {
  const errors: string[] = [];
  const requiresDestination = ["entrada", "apreensao", "transferencia"].includes(
    draft.movementType,
  );
  const isRelease = draft.movementType === "liberacao" || draft.movementType === "devolucao";

  if (!draft.occurredAt) errors.push("Informe a data e a hora.");
  if (requiresDestination && !draft.toLocation.trim()) errors.push("Informe o local de destino.");
  if (draft.movementType === "atualizacao" && !draft.notes.trim())
    errors.push("Descreva a atualização que será registrada.");
  if (isRelease && !draft.releasedTo.trim()) errors.push("Informe quem receberá o veículo.");
  if (isRelease && !draft.releaseDocument.trim()) errors.push("Informe o documento apresentado.");
  if (isRelease && !draft.releaseAuthority.trim()) errors.push("Informe a autoridade responsável.");

  return errors;
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

export default function VehicleDetailsPage() {
  const { vehicleId } = useParams({ from: "/veiculos/$vehicleId" });
  const navigate = useNavigate();
  const profile = useAppProfile();
  const canEdit = canEditVehicles(profile);
  const canMove = canRegisterVehicleMovements(profile);
  const canRelease = canReleaseVehicles(profile);
  const canDelete = canDeleteVehicles(profile);
  const [bundle, setBundle] = useState<DetailBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [movementOpen, setMovementOpen] = useState(false);
  const [movement, setMovement] = useState<MovementDraft>(INITIAL_MOVEMENT);
  const [movementSaving, setMovementSaving] = useState(false);
  const [movementError, setMovementError] = useState("");
  const [movementSuccess, setMovementSuccess] = useState("");
  const [printMode, setPrintMode] = useState<"ficha" | "termo">("ficha");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getVehicleDetailBundle(vehicleId);
      if (!data) throw new Error("Veículo não encontrado.");
      setBundle(data);
    } catch {
      setError("Não foi possível carregar os detalhes do veículo.");
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  function printDocument(mode: "ficha" | "termo") {
    setPrintMode(mode);
    window.setTimeout(() => window.print(), 0);
  }

  async function saveMovement() {
    const isReleaseMovement =
      movement.movementType === "liberacao" || movement.movementType === "devolucao";
    if (!canMove || (isReleaseMovement && !canRelease)) {
      setMovementError("Seu perfil não possui permissão para esta movimentação.");
      return;
    }

    const validationErrors = getMovementValidationErrors(movement);
    if (validationErrors.length) {
      setMovementError(validationErrors[0]);
      return;
    }

    setMovementSaving(true);
    setMovementError("");
    setMovementSuccess("");
    try {
      await registerVehicleMovement({
        vehicleId,
        movementType: movement.movementType,
        occurredAt: new Date(movement.occurredAt).toISOString(),
        fromLocation: movement.fromLocation,
        toLocation: movement.toLocation,
        notes: movement.notes,
        details: {
          released_to: movement.releasedTo,
          release_document: movement.releaseDocument,
          release_authority: movement.releaseAuthority,
        },
      });
      setMovementOpen(false);
      setMovement(createInitialMovement());
      setMovementSuccess(`${movementLabels[movement.movementType]} registrada com sucesso.`);
      await loadDetails();
    } catch {
      setMovementError(
        "Não foi possível registrar a movimentação. Revise os dados e tente novamente.",
      );
    } finally {
      setMovementSaving(false);
    }
  }

  async function removeVehicle() {
    if (!canDelete || deleting || isMobileViewport()) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await softDeleteVehicle(vehicleId);
      setDeleteOpen(false);
      await navigate({ to: "/veiculos/todos", replace: true });
    } catch (deleteFailure) {
      const code =
        typeof deleteFailure === "object" &&
        deleteFailure !== null &&
        "code" in deleteFailure &&
        typeof deleteFailure.code === "string"
          ? deleteFailure.code
          : "";
      setDeleteError(
        code === "42501"
          ? "Seu perfil não possui permissão para excluir veículos."
          : "Não foi possível excluir o veículo. Atualize a página e tente novamente.",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-info" />
      </div>
    );
  if (error && !bundle)
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  if (!bundle) return null;
  const { vehicle, photos, timeline } = bundle;
  const printSections = buildPrintSections(vehicle, printMode);

  return (
    <div className="sipi-print-document space-y-5">
      <header className="rounded-2xl border border-border/70 bg-card/60 p-5 lg:p-6">
        <button
          type="button"
          onClick={() => history.back()}
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-info"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm font-black tracking-wide text-info">
                {vehicle.internal_id}
              </p>
              <VehicleStatusBadge situation={vehicle.situation} />
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {displayVehicleValue(vehicle.brand_model)}
            </h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              Placa: {displayVehicleValue(vehicle.plate)} · Chassi:{" "}
              {displayVehicleValue(vehicle.chassis)}
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto">
            <button
              type="button"
              onClick={() => printDocument("ficha")}
              className="group inline-flex min-w-48 items-center gap-3 rounded-xl bg-info px-3 py-2.5 text-left text-white shadow-lg shadow-info/10 transition hover:-translate-y-0.5 hover:brightness-110"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <FileDown className="h-4 w-4" />
              </span>
              <span>
                <strong className="block text-sm">Gerar ficha em PDF</strong>
                <small className="block text-[10px] font-medium text-white/75">
                  Documento completo A4
                </small>
              </span>
            </button>
            <button
              type="button"
              onClick={() => printDocument("termo")}
              className="group inline-flex min-w-48 items-center gap-3 rounded-xl border border-success/35 bg-success/10 px-3 py-2.5 text-left text-success transition hover:-translate-y-0.5 hover:border-success/55 hover:bg-success/15"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/15">
                <FileSignature className="h-4 w-4" />
              </span>
              <span>
                <strong className="block text-sm">Gerar termo</strong>
                <small className="block text-[10px] font-medium text-muted-foreground">
                  Entrega e assinaturas
                </small>
              </span>
            </button>
            {canEdit || canDelete ? (
              <div className="hidden gap-2 sm:col-span-2 md:flex">
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError("");
                      setDeleteOpen(true);
                    }}
                    disabled={deleting}
                    aria-label="Excluir veículo"
                    title="Excluir veículo"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/35 bg-destructive/5 text-destructive transition hover:border-destructive/55 hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
                {canEdit ? (
                  <Link
                    to="/veiculos/$vehicleId/editar"
                    params={{ vehicleId }}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-info/35"
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {movementSuccess ? (
        <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" /> {movementSuccess}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <DetailSection title="1. IDENTIFICAÇÃO" icon={<ClipboardCheck className="h-4 w-4" />}>
            <DetailField label="Tipo" value={VEHICLE_TYPE_LABELS[vehicle.vehicle_type]} />
            <DetailField label="Marca" value={vehicle.brand} />
            <DetailField label="Modelo" value={vehicle.model} />
            <DetailField label="Cor" value={vehicle.color} />
            <DetailField label="Ano de fabricação" value={vehicle.manufacture_year} />
            <DetailField label="Ano do modelo" value={vehicle.model_year} />
            <IdentificationDetail
              label="Placa"
              value={vehicle.plate}
              status={vehicle.plate_status}
            />
            <IdentificationDetail
              label="Renavam"
              value={vehicle.renavam}
              status={vehicle.renavam_status}
            />
            <IdentificationDetail
              label="Número do motor"
              value={vehicle.engine_number}
              status={vehicle.engine_status}
            />
            <IdentificationDetail
              label="Chassi"
              value={vehicle.chassis}
              status={vehicle.chassis_status}
            />
            <DetailField label="Motorizado" value={vehicle.is_motorized} />
            <DetailField label="Conservação" value={vehicle.conservation_state} />
          </DetailSection>

          <DetailSection title="2. SITUAÇÃO POLICIAL" icon={<ShieldCheck className="h-4 w-4" />}>
            <DetailField
              label="Situação"
              value={vehicle.situation ? VEHICLE_SITUATION_LABELS[vehicle.situation] : null}
            />
            <DetailField label="Tipo de ocorrência" value={vehicle.occurrence_type} />
            <DetailField label="B.O." value={vehicle.police_report_number} />
            <DetailField
              label="Procedimento"
              value={[vehicle.procedure_type, vehicle.procedure_number].filter(Boolean).join(" ")}
            />
            <DetailField label="Processo judicial" value={vehicle.court_process_number} />
            {vehicle.inquerito_id ? (
              <div className="md:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Inquérito vinculado
                </span>
                <Link
                  to="/inqueritos/$caseId"
                  params={{ caseId: vehicle.inquerito_id }}
                  className="mt-1 flex items-center gap-2 text-sm font-semibold text-info hover:underline"
                >
                  <Link2 className="h-4 w-4" /> Abrir procedimento no SIED
                </Link>
              </div>
            ) : null}
            <DetailField
              label="Envolvidos"
              value={formatVehicleInvolvedPeople(vehicle.involved_people)}
              wide
            />
            <DetailField label="Observações" value={vehicle.observations} wide />
          </DetailSection>

          <DetailSection title="3. APREENSÃO E CUSTÓDIA" icon={<MapPin className="h-4 w-4" />}>
            <DetailField
              label="Data da apreensão"
              value={formatVehicleDate(vehicle.seizure_date)}
            />
            <DetailField label="Local da apreensão" value={vehicle.seizure_location} />
            <DetailField label="Local de custódia" value={vehicle.custody_location} />
            <DetailField label="Depósito" value={vehicle.storage_location} />
            <DetailField label="Responsável pelo recebimento" value={vehicle.custody_responsible} />
            <DetailField label="Possui chave" value={vehicle.has_key} />
            <DetailField label="Possui documento" value={vehicle.has_document} />
            <DetailField
              label="Observações da custódia"
              value={vehicle.custody_observations}
              wide
            />
          </DetailSection>

          <DetailSection title="4. LIBERAÇÃO OU DEVOLUÇÃO" icon={<RotateCcw className="h-4 w-4" />}>
            <DetailField
              label="Situação da liberação"
              value={vehicle.release_status?.replaceAll("_", " ")}
            />
            <DetailField label="Data" value={formatVehicleDate(vehicle.release_date)} />
            <DetailField label="Pessoa que recebeu" value={vehicle.released_to} />
            <DetailField label="Documento apresentado" value={vehicle.release_document} />
            <DetailField label="Autoridade responsável" value={vehicle.release_authority} />
            <DetailField label="Termo de entrega" value={vehicle.delivery_term} />
            <DetailField label="Observações da saída" value={vehicle.release_observations} wide />
          </DetailSection>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold">Fotografias</h2>
                <p className="text-xs text-muted-foreground">Miniaturas comprimidas</p>
              </div>
              <Camera className="h-5 w-5 text-info" />
            </div>
            {photos.length ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.original_url}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-xl border border-border bg-background"
                  >
                    <img
                      src={photo.thumbnail_url}
                      alt={photo.caption || `Fotografia de ${vehicle.internal_id}`}
                      loading="lazy"
                      className="aspect-[4/3] h-full w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                Nenhuma fotografia cadastrada.
              </p>
            )}
          </section>

          {canMove ? (
            <button
              type="button"
              onClick={() => {
                setMovement(createInitialMovement(vehicle.custody_location ?? ""));
                setMovementError("");
                setMovementSuccess("");
                setMovementOpen(true);
              }}
              className="hidden w-full items-center justify-center gap-2 rounded-xl bg-info px-4 py-3 text-sm font-semibold text-white md:inline-flex"
            >
              <Repeat2 className="h-4 w-4" /> Registrar movimentação
            </button>
          ) : null}
        </aside>
      </div>

      <VehicleTimeline events={timeline} />

      <SipiPrintSheet
        documentTitle={
          printMode === "ficha" ? "Ficha de Veículo Apreendido" : "Termo de Entrega de Veículo"
        }
        documentSubtitle={
          printMode === "ficha"
            ? "Cadastro, identificação e situação de custódia"
            : "Registro de liberação ou devolução"
        }
        identifierLabel="Número do B.O."
        identifier={vehicle.police_report_number?.trim() || "NÃO INFORMADO"}
        variant={printMode === "ficha" ? "vehicle" : "term"}
        summary={[
          { label: "Cadastro SIED", value: vehicle.internal_id },
          { label: "Placa", value: vehicle.plate },
          { label: "Veículo", value: vehicle.brand_model },
          {
            label: "Situação",
            value: vehicle.situation ? VEHICLE_SITUATION_LABELS[vehicle.situation] : null,
          },
        ]}
        sections={printSections}
      />

      {movementOpen ? (
        <MovementDialog
          draft={movement}
          saving={movementSaving}
          error={movementError}
          canRelease={canRelease}
          currentLocation={vehicle.custody_location || vehicle.storage_location}
          currentSituation={
            vehicle.situation ? VEHICLE_SITUATION_LABELS[vehicle.situation] : "Não informada"
          }
          onChange={(value) => {
            setMovement(value);
            setMovementError("");
          }}
          onClose={() => {
            setMovementOpen(false);
            setMovementError("");
          }}
          onSave={saveMovement}
        />
      ) : null}

      {deleteOpen && canDelete ? (
        <div
          className="fixed inset-0 z-50 hidden items-center justify-center bg-black/75 p-4 md:flex"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-vehicle-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 id="delete-vehicle-title" className="text-lg font-bold text-foreground">
                  Excluir veículo
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  O veículo <strong className="text-foreground">{vehicle.internal_id}</strong> será
                  removido das listas. O histórico, as movimentações e as fotografias serão
                  preservados para auditoria.
                </p>
              </div>
            </div>

            {deleteError ? (
              <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                {deleteError}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void removeVehicle()}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleting ? "Excluindo..." : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4 text-info">
        {icon}
        <h2 className="text-xs font-black tracking-[0.14em]">{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

function DetailField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {displayVehicleValue(value)}
      </dd>
    </div>
  );
}

function IdentificationDetail({
  label,
  value,
  status,
}: {
  label: string;
  value: string | null;
  status: VehicleRecord["plate_status"];
}) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono font-semibold">{displayVehicleValue(value)}</span>
        {status && status !== "informado" ? (
          <span className="rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-warning">
            {IDENTIFICATION_STATUS_LABELS[status]}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function buildPrintSections(vehicle: VehicleRecord, mode: "ficha" | "termo"): SipiPrintSection[] {
  if (mode === "termo") {
    const vehicleDescription = [
      VEHICLE_TYPE_LABELS[vehicle.vehicle_type],
      vehicle.brand_model,
      vehicle.color ? `cor ${vehicle.color}` : null,
      vehicle.plate ? `placa ${vehicle.plate}` : null,
      vehicle.chassis ? `chassi ${vehicle.chassis}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    return [
      {
        title: "DADOS DA ENTREGA",
        wide: true,
        fields: [
          { label: "Situação", value: vehicle.release_status?.replaceAll("_", " ") },
          { label: "Data", value: formatVehicleDate(vehicle.release_date) },
          { label: "Pessoa que recebeu", value: vehicle.released_to },
          { label: "Documento apresentado", value: vehicle.release_document },
          { label: "Autoridade responsável", value: vehicle.release_authority },
          { label: "Termo de entrega", value: vehicle.delivery_term },
          { label: "Observações", value: vehicle.release_observations, wide: true },
        ],
      },
      {
        title: "IDENTIFICAÇÃO DO VEÍCULO",
        wide: true,
        fields: [
          { label: "Tipo", value: VEHICLE_TYPE_LABELS[vehicle.vehicle_type] },
          { label: "Marca / Modelo", value: vehicle.brand_model },
          { label: "Cor", value: vehicle.color },
          { label: "Placa", value: vehicle.plate },
          { label: "Renavam", value: vehicle.renavam },
          { label: "Chassi", value: vehicle.chassis },
        ],
      },
      {
        title: "DECLARAÇÃO DE RECEBIMENTO",
        wide: true,
        narrative: true,
        fields: [
          {
            label: "Declaração",
            value: `Declaro, para os devidos fins, o recebimento do veículo ${vehicleDescription}, nas condições registradas neste termo. Confirmo que os dados acima foram conferidos no ato da entrega.`,
            wide: true,
          },
        ],
      },
      {
        title: "ASSINATURAS",
        wide: true,
        signatures: true,
        fields: [
          {
            label: "Pessoa que recebeu",
            value: vehicle.released_to?.trim() || "Nome não informado",
          },
          {
            label: "Responsável pela entrega",
            value: vehicle.release_authority?.trim() || "Nome e matrícula não informados",
          },
          {
            label: "Local e data",
            manualLine: true,
          },
        ],
      },
    ];
  }
  return [
    {
      title: "IDENTIFICAÇÃO",
      wide: true,
      fields: [
        { label: "Tipo", value: VEHICLE_TYPE_LABELS[vehicle.vehicle_type] },
        { label: "Marca / Modelo", value: vehicle.brand_model },
        { label: "Cor", value: vehicle.color },
        {
          label: "Ano",
          value: [vehicle.manufacture_year, vehicle.model_year].filter(Boolean).join("/"),
        },
        { label: "Placa", value: vehicle.plate },
        { label: "Renavam", value: vehicle.renavam },
        { label: "Motor", value: vehicle.engine_number },
        { label: "Chassi", value: vehicle.chassis },
      ],
    },
    {
      title: "SITUAÇÃO POLICIAL",
      wide: true,
      fields: [
        { label: "Ocorrência", value: vehicle.occurrence_type },
        { label: "B.O.", value: vehicle.police_report_number },
        {
          label: "Procedimento",
          value: [vehicle.procedure_type, vehicle.procedure_number].filter(Boolean).join(" "),
        },
        { label: "Processo judicial", value: vehicle.court_process_number },
        {
          label: "Envolvidos",
          value: formatVehicleInvolvedPeople(vehicle.involved_people),
          wide: true,
        },
      ],
    },
    {
      title: "APREENSÃO E CUSTÓDIA",
      wide: true,
      fields: [
        { label: "Data", value: formatVehicleDate(vehicle.seizure_date) },
        { label: "Local da apreensão", value: vehicle.seizure_location },
        { label: "Custódia", value: vehicle.custody_location },
        { label: "Depósito", value: vehicle.storage_location },
        { label: "Responsável", value: vehicle.custody_responsible },
        { label: "Observações", value: vehicle.custody_observations, wide: true },
      ],
    },
  ];
}

function MovementDialog({
  draft,
  saving,
  error,
  canRelease,
  currentLocation,
  currentSituation,
  onChange,
  onClose,
  onSave,
}: {
  draft: MovementDraft;
  saving: boolean;
  error: string;
  canRelease: boolean;
  currentLocation: string | null;
  currentSituation: string;
  onChange: (value: MovementDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [releaseConfirmed, setReleaseConfirmed] = useState(false);
  const isRelease = draft.movementType === "liberacao" || draft.movementType === "devolucao";
  const hasLocationChange = ["entrada", "apreensao", "transferencia"].includes(draft.movementType);
  const validationErrors = getMovementValidationErrors(draft);
  const canSubmit = validationErrors.length === 0 && (!isRelease || releaseConfirmed) && !saving;
  const nextSituation =
    draft.movementType === "entrada" || draft.movementType === "apreensao"
      ? "Apreendido"
      : draft.movementType === "pericia"
        ? "Periciado"
        : isRelease
          ? "Liberado"
          : currentSituation;
  const nextLocation = isRelease
    ? "Fora da custódia"
    : hasLocationChange
      ? draft.toLocation.trim() || "Aguardando destino"
      : currentLocation || "Não informado";
  const set = <K extends keyof MovementDraft>(key: K, value: MovementDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar movimentação"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl md:rounded-2xl"
      >
        <div className="flex items-start justify-between border-b border-border p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
              <Repeat2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-info">
                Custódia e histórico
              </p>
              <h2 className="mt-1 text-lg font-bold">Registrar movimentação</h2>
              <p className="text-xs text-muted-foreground">
                A situação do veículo e o histórico serão atualizados juntos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-info/40 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <section className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Tipo de movimentação
              </span>
              <select
                value={draft.movementType}
                onChange={(event) => {
                  set("movementType", event.target.value as MovementDraft["movementType"]);
                  setReleaseConfirmed(false);
                }}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                {Object.entries(movementLabels)
                  .filter(
                    ([value]) => canRelease || (value !== "liberacao" && value !== "devolucao"),
                  )
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Data e hora <strong className="text-destructive">*</strong>
              </span>
              <input
                type="datetime-local"
                value={draft.occurredAt}
                onChange={(event) => set("occurredAt", event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>
          </section>

          <p className="rounded-xl border border-info/20 bg-info/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">{movementLabels[draft.movementType]}:</strong>{" "}
            {movementDescriptions[draft.movementType]}
          </p>

          {hasLocationChange ? (
            <section className="grid gap-4 rounded-xl border border-border bg-background/35 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <h3 className="text-xs font-black uppercase tracking-[0.12em] text-info">
                  Localização
                </h3>
              </div>
              <MovementInput
                label="Origem"
                value={draft.fromLocation}
                onChange={(value) => set("fromLocation", value)}
              />
              <MovementInput
                label="Destino"
                value={draft.toLocation}
                required
                onChange={(value) => set("toLocation", value)}
              />
            </section>
          ) : null}

          {isRelease ? (
            <section className="grid gap-4 rounded-xl border border-success/25 bg-success/5 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <h3 className="text-xs font-black uppercase tracking-[0.12em] text-success">
                  Dados de quem receberá
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Estes dados serão usados automaticamente no termo de entrega.
                </p>
              </div>
              <MovementInput
                label="Pessoa que recebeu"
                value={draft.releasedTo}
                required
                onChange={(value) => set("releasedTo", value)}
              />
              <MovementInput
                label="Documento apresentado"
                value={draft.releaseDocument}
                required
                onChange={(value) => set("releaseDocument", value)}
              />
              <MovementInput
                label="Autoridade responsável"
                value={draft.releaseAuthority}
                required
                onChange={(value) => set("releaseAuthority", value)}
              />
            </section>
          ) : null}

          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Observações
              {draft.movementType === "atualizacao" ? (
                <strong className="ml-1 text-destructive">*</strong>
              ) : null}
            </span>
            <textarea
              rows={4}
              value={draft.notes}
              onChange={(event) => set("notes", event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>

          <section className="rounded-xl border border-border bg-background/45 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-info" />
              <h3 className="text-xs font-black uppercase tracking-[0.12em]">Resultado previsto</h3>
            </div>
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card/60 p-3">
                <span className="text-muted-foreground">Situação</span>
                <p className="mt-1 font-bold">
                  {currentSituation} <span className="px-1 text-info">→</span> {nextSituation}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card/60 p-3">
                <span className="text-muted-foreground">Custódia</span>
                <p className="mt-1 font-bold">
                  {currentLocation || "Não informada"} <span className="px-1 text-info">→</span>{" "}
                  {nextLocation}
                </p>
              </div>
            </div>
          </section>

          {isRelease ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
              <input
                type="checkbox"
                checked={releaseConfirmed}
                onChange={(event) => setReleaseConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--success)]"
              />
              <span className="text-xs leading-relaxed">
                <strong className="block text-warning">Confirmar saída da custódia</strong>
                Confirmo que a autorização e os dados da pessoa que receberá o veículo foram
                conferidos.
              </span>
            </label>
          ) : null}

          {error || validationErrors.length ? (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error || validationErrors[0]}</span>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-background/25 p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-xl bg-info px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarClock className="h-4 w-4" />
            )}{" "}
            {isRelease
              ? `Confirmar ${movementLabels[draft.movementType].toLowerCase()}`
              : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MovementInput({
  label,
  value,
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label}
        {required ? <strong className="ml-1 text-destructive">*</strong> : null}
      </span>
      <input
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
    </label>
  );
}
