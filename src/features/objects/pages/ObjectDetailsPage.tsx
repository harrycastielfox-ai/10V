import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
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
import {
  canDeleteObjects,
  canEditObjects,
  canRegisterObjectMovements,
  canReleaseObjects,
} from "@/lib/authz";
import {
  getObjectDetailBundle,
  registerObjectMovement,
  softDeleteObject,
} from "@/lib/repositories/objectsRepository";
import { ObjectStatusBadge } from "../components/ObjectStatusBadge";
import {
  OBJECT_SITUATION_LABELS,
  OBJECT_TYPE_LABELS,
  displayObjectValue,
  formatObjectDate,
  formatObjectWeightOrValue,
} from "../objectConstants";
import type { ObjectDetailBundle, ObjectMovementRecord, ObjectRecord } from "../objectTypes";

type MovementDraft = {
  movementType: ObjectMovementRecord["movement_type"];
  occurredAt: string;
  fromLocation: string;
  toLocation: string;
  notes: string;
  releasedTo: string;
  releaseDocument: string;
  releaseAuthority: string;
};

function createInitialMovement(fromLocation = ""): MovementDraft {
  const now = new Date();
  const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return {
    movementType: "transferencia",
    occurredAt: localDateTime,
    fromLocation,
    toLocation: "",
    notes: "",
    releasedTo: "",
    releaseDocument: "",
    releaseAuthority: "",
  };
}

const movementLabels: Record<ObjectMovementRecord["movement_type"], string> = {
  entrada: "Entrada",
  apreensao: "Apreensão",
  transferencia: "Transferência",
  pericia: "Perícia",
  liberacao: "Liberação",
  devolucao: "Devolução",
  incineracao: "Incineração / Destruição",
  disposicao_justica: "À disposição da Justiça",
  atualizacao: "Atualização",
};

const movementDescriptions: Record<ObjectMovementRecord["movement_type"], string> = {
  entrada: "Entrada do objeto em uma unidade ou depósito.",
  apreensao: "Formaliza a apreensão e define o local de custódia.",
  transferencia: "Move o objeto entre unidades, cofres ou depósitos.",
  pericia:
    "Registra a data do exame pericial no histórico. A situação do objeto não muda — ele continua apreendido.",
  liberacao: "Entrega o objeto à pessoa autorizada.",
  devolucao: "Registra a devolução ao proprietário ou responsável.",
  incineracao: "Registra a destruição definitiva do objeto por determinação.",
  disposicao_justica: "Coloca o objeto formalmente à disposição da Justiça.",
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
  if (isRelease && !draft.releasedTo.trim()) errors.push("Informe quem receberá o objeto.");
  if (isRelease && !draft.releaseDocument.trim()) errors.push("Informe o documento apresentado.");
  if (isRelease && !draft.releaseAuthority.trim()) errors.push("Informe a autoridade responsável.");

  return errors;
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

export default function ObjectDetailsPage() {
  const { objectId } = useParams({ from: "/objetos/$objectId" });
  const navigate = useNavigate();
  const profile = useAppProfile();
  const canEdit = canEditObjects(profile);
  const canMove = canRegisterObjectMovements(profile);
  const canRelease = canReleaseObjects(profile);
  const canDelete = canDeleteObjects(profile);
  const [bundle, setBundle] = useState<ObjectDetailBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [movementOpen, setMovementOpen] = useState(false);
  const [movement, setMovement] = useState<MovementDraft>(createInitialMovement());
  const [movementSaving, setMovementSaving] = useState(false);
  const [movementError, setMovementError] = useState("");
  const [movementSuccess, setMovementSuccess] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getObjectDetailBundle(objectId);
      if (!data) throw new Error("Objeto não encontrado.");
      setBundle(data);
    } catch {
      setError("Não foi possível carregar os detalhes do objeto.");
    } finally {
      setLoading(false);
    }
  }, [objectId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  async function saveMovement() {
    const isReleaseMovement =
      movement.movementType === "liberacao" || movement.movementType === "devolucao";
    const isRestricted =
      isReleaseMovement ||
      movement.movementType === "incineracao" ||
      movement.movementType === "disposicao_justica";
    if (!canMove || (isRestricted && !canRelease)) {
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
      await registerObjectMovement({
        objectId,
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

  async function removeObject() {
    if (!canDelete || deleting || isMobileViewport()) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await softDeleteObject(objectId);
      setDeleteOpen(false);
      await navigate({ to: "/objetos/todos", replace: true });
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
          ? "Seu perfil não possui permissão para excluir objetos."
          : "Não foi possível excluir o objeto. Atualize a página e tente novamente.",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-warning" />
      </div>
    );
  if (error && !bundle)
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  if (!bundle) return null;
  const { object, photos, movements } = bundle;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-border/70 bg-card/60 p-5 lg:p-6">
        <button
          type="button"
          onClick={() => history.back()}
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-warning"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm font-black tracking-wide text-warning">
                {object.internal_id}
              </p>
              <ObjectStatusBadge situation={object.situation} />
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{object.description}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {OBJECT_TYPE_LABELS[object.object_type]}
              {object.brand_model ? ` · ${object.brand_model}` : ""}
            </p>
          </div>
          {canEdit || canDelete ? (
            <div className="hidden gap-2 md:flex">
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError("");
                    setDeleteOpen(true);
                  }}
                  disabled={deleting}
                  aria-label="Excluir objeto"
                  title="Excluir objeto"
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
                  to="/objetos/$objectId/editar"
                  params={{ objectId }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-warning/35"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </Link>
              ) : null}
            </div>
          ) : null}
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
            <DetailField label="Categoria" value={OBJECT_TYPE_LABELS[object.object_type]} />
            <DetailField label="Marca / Modelo" value={object.brand_model} />
            <DetailField label="Número de série" value={object.serial_number} />
            <DetailField label="Calibre" value={object.caliber} />
            <DetailField label="Cor" value={object.color} />
            <DetailField label="Quantidade" value={object.quantity} />
            <DetailField
              label="Peso ou valor"
              value={formatObjectWeightOrValue(object.weight_or_value, object.measurement_unit)}
            />
          </DetailSection>

          <DetailSection title="2. SITUAÇÃO POLICIAL" icon={<ShieldCheck className="h-4 w-4" />}>
            <DetailField
              label="Situação"
              value={object.situation ? OBJECT_SITUATION_LABELS[object.situation] : null}
            />
            <DetailField label="Tipo de ocorrência" value={object.occurrence_type} />
            <DetailField label="B.O." value={object.police_report_number} />
            <DetailField
              label="Procedimento"
              value={[object.procedure_type, object.procedure_number].filter(Boolean).join(" ")}
            />
            <DetailField label="Processo judicial" value={object.court_process_number} />
            {object.inquerito_id ? (
              <div className="md:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Inquérito vinculado
                </span>
                <Link
                  to="/inqueritos/$caseId"
                  params={{ caseId: object.inquerito_id }}
                  className="mt-1 flex items-center gap-2 text-sm font-semibold text-warning hover:underline"
                >
                  <Link2 className="h-4 w-4" /> Abrir procedimento no SIED
                </Link>
              </div>
            ) : null}
            <DetailField label="Envolvidos" value={object.involved_people} wide />
            {object.object_type === "documento" ? (
              <>
                <DetailField label="Nome no documento" value={object.document_holder_name} />
                <DetailField label="Número do documento" value={object.document_number} />
                <DetailField label="Órgão emissor / UF" value={object.document_issuing_authority} />
              </>
            ) : null}
            <DetailField label="Observações" value={object.observations} wide />
          </DetailSection>

          <DetailSection title="3. APREENSÃO E CUSTÓDIA" icon={<MapPin className="h-4 w-4" />}>
            <DetailField label="Data da apreensão" value={formatObjectDate(object.seizure_date)} />
            <DetailField label="Local da apreensão" value={object.seizure_location} />
            <DetailField label="Local de custódia" value={object.custody_location} />
            <DetailField label="Depósito / cofre" value={object.storage_location} />
            <DetailField label="Responsável pelo recebimento" value={object.custody_responsible} />
            <DetailField label="Data da perícia" value={formatObjectDate(object.expertise_date)} />
            <DetailField label="Observações da custódia" value={object.custody_observations} wide />
          </DetailSection>

          <DetailSection title="4. LIBERAÇÃO OU DEVOLUÇÃO" icon={<RotateCcw className="h-4 w-4" />}>
            <DetailField
              label="Situação da liberação"
              value={object.release_status?.replaceAll("_", " ")}
            />
            <DetailField label="Data" value={formatObjectDate(object.release_date)} />
            <DetailField label="Pessoa que recebeu" value={object.released_to} />
            <DetailField label="Documento apresentado" value={object.release_document} />
            <DetailField label="Autoridade responsável" value={object.release_authority} />
            <DetailField label="Termo de entrega" value={object.delivery_term} />
            <DetailField label="Observações da saída" value={object.release_observations} wide />
          </DetailSection>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold">Fotografias</h2>
                <p className="text-xs text-muted-foreground">Miniaturas comprimidas</p>
              </div>
              <Camera className="h-5 w-5 text-warning" />
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
                      alt={photo.caption || `Fotografia de ${object.internal_id}`}
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
                setMovement(createInitialMovement(object.custody_location ?? ""));
                setMovementError("");
                setMovementSuccess("");
                setMovementOpen(true);
              }}
              className="hidden w-full items-center justify-center gap-2 rounded-xl border border-warning/60 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning transition hover:bg-warning/20 md:inline-flex"
            >
              <Repeat2 className="h-4 w-4" /> Registrar movimentação
            </button>
          ) : null}

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-bold">Histórico</h2>
            {movements.length ? (
              <ul className="mt-4 space-y-3">
                {movements.map((item) => (
                  <li key={item.id} className="border-l-2 border-warning/40 pl-3">
                    <p className="text-xs font-bold text-warning">
                      {movementLabels[item.movement_type]}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatObjectDate(item.occurred_at, true)}
                    </p>
                    {item.to_location ? (
                      <p className="mt-0.5 text-xs">→ {item.to_location}</p>
                    ) : null}
                    {item.notes ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                Nenhuma movimentação registrada ainda.
              </p>
            )}
          </section>
        </aside>
      </div>

      {movementOpen ? (
        <MovementDialog
          draft={movement}
          saving={movementSaving}
          error={movementError}
          canRelease={canRelease}
          currentLocation={object.custody_location || object.storage_location}
          currentSituation={
            object.situation ? OBJECT_SITUATION_LABELS[object.situation] : "Não informada"
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
          aria-labelledby="delete-object-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 id="delete-object-title" className="text-lg font-bold text-foreground">
                  Excluir objeto
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  O objeto <strong className="text-foreground">{object.internal_id}</strong> será
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
                onClick={() => void removeObject()}
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
      <div className="flex items-center gap-2 border-b border-border px-5 py-4 text-warning">
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
        {displayObjectValue(value)}
      </dd>
    </div>
  );
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
  const isRestricted =
    isRelease ||
    draft.movementType === "incineracao" ||
    draft.movementType === "disposicao_justica";
  const hasLocationChange = ["entrada", "apreensao", "transferencia"].includes(draft.movementType);
  const validationErrors = getMovementValidationErrors(draft);
  const canSubmit = validationErrors.length === 0 && (!isRelease || releaseConfirmed) && !saving;
  // "pericia" é só um evento no histórico — não muda a situação, por isso
  // cai no "currentSituation" do fim, igual a "atualizacao".
  const nextSituation =
    draft.movementType === "entrada" || draft.movementType === "apreensao"
      ? "Apreendido"
      : draft.movementType === "incineracao"
        ? "Incinerado"
        : draft.movementType === "disposicao_justica"
          ? "À disposição da Justiça"
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
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <Repeat2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-warning">
                Custódia e histórico
              </p>
              <h2 className="mt-1 text-lg font-bold">Registrar movimentação</h2>
              <p className="text-xs text-muted-foreground">
                A situação do objeto e o histórico serão atualizados juntos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-warning/40 hover:text-foreground"
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
                    ([value]) =>
                      canRelease ||
                      !["liberacao", "devolucao", "incineracao", "disposicao_justica"].includes(
                        value,
                      ),
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

          <p className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">{movementLabels[draft.movementType]}:</strong>{" "}
            {movementDescriptions[draft.movementType]}
          </p>

          {hasLocationChange ? (
            <section className="grid gap-4 rounded-xl border border-border bg-background/35 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <h3 className="text-xs font-black uppercase tracking-[0.12em] text-warning">
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
              <ClipboardCheck className="h-4 w-4 text-warning" />
              <h3 className="text-xs font-black uppercase tracking-[0.12em]">Resultado previsto</h3>
            </div>
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card/60 p-3">
                <span className="text-muted-foreground">Situação</span>
                <p className="mt-1 font-bold">
                  {currentSituation} <span className="px-1 text-warning">→</span> {nextSituation}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card/60 p-3">
                <span className="text-muted-foreground">Custódia</span>
                <p className="mt-1 font-bold">
                  {currentLocation || "Não informada"} <span className="px-1 text-warning">→</span>{" "}
                  {nextLocation}
                </p>
              </div>
            </div>
          </section>

          {isRestricted ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
              <input
                type="checkbox"
                checked={releaseConfirmed}
                onChange={(event) => setReleaseConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--success)]"
              />
              <span className="text-xs leading-relaxed">
                <strong className="block text-warning">
                  Confirmar ato de maior responsabilidade
                </strong>
                Confirmo que a autorização e os dados foram conferidos antes de registrar esta
                movimentação.
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
            className="inline-flex items-center gap-2 rounded-xl border border-warning/60 bg-warning/10 px-4 py-2.5 text-sm font-semibold text-warning transition hover:bg-warning/20 disabled:cursor-not-allowed disabled:opacity-40"
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
