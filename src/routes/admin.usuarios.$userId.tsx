import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  KeyRound,
  Laptop,
  Mail,
  MapPin,
  Network,
  Pencil,
  Phone,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  X,
} from "lucide-react";
import { getCurrentProfile, getProfileAvatarPublicUrl, getSession } from "@/lib/auth";
import {
  canAssignProtectedInstitutionalFunction,
  canManageUsers,
  INSTITUTIONAL_FUNCTIONS,
  isProtectedInstitutionalFunction,
  type AuthorizationStatus,
  type InstitutionalFunction,
  type UserProfile,
  type UserRole,
} from "@/lib/authz";
import {
  listAuditoriaForAdminUser,
  type AuditoriaEvent,
} from "@/lib/repositories/auditoriaRepository";
import { supabase } from "@/lib/supabaseClient";
import {
  AccessContextError,
  getLatestUserAccessContext,
  type UserAccessContext,
} from "@/lib/accessContext";
import { MobileNavigation } from "@/components/MobileNavigation";

export const Route = createFileRoute("/admin/usuarios/$userId")({
  component: AdminUserProfilePage,
});

type AdminUserProfile = UserProfile & { telefone?: string | null };
type IconType = ComponentType<{ className?: string }>;
type InstitutionalFunctionDraft = InstitutionalFunction | "";

const INSTITUTIONAL_FUNCTION_LABELS: Record<InstitutionalFunction, string> = {
  juiz: "Juiz(a)",
  promotor: "Promotor(a)",
  delegado: "Delegado(a)",
  escrivao: "Escrivão(ã)",
  investigador: "Investigador(a)",
  agente_policia: "Agente de Polícia",
  administrativo: "Administrativo",
};

function AdminUserProfilePage() {
  const navigate = useNavigate();
  const { userId } = Route.useParams();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [targetUser, setTargetUser] = useState<AdminUserProfile | null>(null);
  const [requestState, setRequestState] = useState<
    "idle" | "not_found" | "forbidden" | "rpc_unavailable" | "error"
  >("idle");
  const [auditoriaLoading, setAuditoriaLoading] = useState(false);
  const [auditoriaError, setAuditoriaError] = useState<string | null>(null);
  const [auditoriaEvents, setAuditoriaEvents] = useState<AuditoriaEvent[]>([]);
  const [editingInstitutionalFunction, setEditingInstitutionalFunction] = useState(false);
  const [institutionalFunctionDraft, setInstitutionalFunctionDraft] =
    useState<InstitutionalFunctionDraft>("");
  const [savingInstitutionalFunction, setSavingInstitutionalFunction] = useState(false);
  const [institutionalFunctionFeedback, setInstitutionalFunctionFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [accessContext, setAccessContext] = useState<UserAccessContext | null>(null);
  const [accessContextState, setAccessContextState] = useState<
    "idle" | "loading" | "ready" | "unavailable" | "forbidden" | "error"
  >("idle");
  const [sigiloAccess, setSigiloAccess] = useState(false);
  const [sigiloAccessLoading, setSigiloAccessLoading] = useState(false);
  const [sigiloAccessSaving, setSigiloAccessSaving] = useState(false);
  const [sigiloAccessFeedback, setSigiloAccessFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await getSession();
        if (!session) {
          if (!cancelled) navigate({ to: "/login", replace: true });
          return;
        }
        const profile = await getCurrentProfile();
        if (!profile) {
          if (!cancelled) navigate({ to: "/modulos", replace: true });
          return;
        }
        if (!cancelled) {
          setCurrentProfile(profile);
          setHasAccess(canManageUsers(profile));
        }
      } catch (error) {
        console.error("[AdminUserProfilePage] Erro ao validar sessão", error);
        if (!cancelled) navigate({ to: "/modulos", replace: true });
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    void (async () => {
      setLoadingUser(true);
      setRequestState("idle");
      const { data, error } = await supabase.rpc("list_profiles_for_admin");
      if (cancelled) return;

      if (error) {
        const code = String(error.code ?? "");
        const normalized = String(error.message ?? "").toLowerCase();
        if (import.meta.env.DEV) {
          console.error("[admin][usuarios][$userId] Falha na RPC list_profiles_for_admin", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            userId,
          });
        }
        if (code === "42501" || normalized.includes("permission")) {
          setRequestState("forbidden");
        } else if (
          code === "PGRST202" ||
          normalized.includes("function") ||
          normalized.includes("rpc")
        ) {
          setRequestState("rpc_unavailable");
        } else {
          setRequestState("error");
        }
        setTargetUser(null);
        setLoadingUser(false);
        return;
      }

      const users = (data ?? []) as AdminUserProfile[];
      if (!Array.isArray(data)) {
        if (import.meta.env.DEV) {
          console.warn(
            "[admin][usuarios][$userId] list_profiles_for_admin retornou payload não-lista",
            {
              payloadType: typeof data,
              userId,
            },
          );
        }
      }
      const found = users.find((profile) => String(profile.id) === String(userId)) ?? null;
      if (!found) {
        setRequestState("not_found");
        setTargetUser(null);
      } else {
        setTargetUser(found);
        setInstitutionalFunctionDraft(found.funcao_institucional ?? "");
        setEditingInstitutionalFunction(false);
        setInstitutionalFunctionFeedback(null);
      }
      setLoadingUser(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAccess, userId]);

  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;

    void (async () => {
      setSigiloAccessLoading(true);
      setSigiloAccessFeedback(null);
      const { data, error } = await supabase.rpc("admin_get_user_sigilo_access", {
        p_target_user_id: userId,
      });
      if (cancelled) return;

      if (error) {
        setSigiloAccess(false);
        setSigiloAccessFeedback({
          kind: "error",
          message: "Não foi possível consultar a permissão individual de sigilo.",
        });
      } else {
        setSigiloAccess(data === true);
      }
      setSigiloAccessLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [hasAccess, userId]);

  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;

    void (async () => {
      setAccessContextState("loading");
      try {
        const context = await getLatestUserAccessContext(userId);
        if (cancelled) return;
        setAccessContext(context);
        setAccessContextState("ready");
      } catch (error) {
        if (cancelled) return;
        setAccessContext(null);
        if (error instanceof AccessContextError && error.code === "UNAVAILABLE") {
          setAccessContextState("unavailable");
        } else if (error instanceof AccessContextError && error.code === "PERMISSION_DENIED") {
          setAccessContextState("forbidden");
        } else {
          setAccessContextState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasAccess, userId]);

  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    void (async () => {
      setAuditoriaLoading(true);
      setAuditoriaError(null);
      const result = await listAuditoriaForAdminUser(userId, { limit: 20 });
      if (cancelled) return;
      if (result.error) {
        if (import.meta.env.DEV) {
          console.warn("[auditoria][individual] Falha ao listar eventos", {
            message: result.error.message,
            details: result.error.details,
            hint: result.error.hint,
            code: result.error.code,
            userId,
          });
        }

        const normalized = result.error.message.toLowerCase();
        const code = (result.error.code ?? "").toLowerCase();
        if (
          normalized.includes("insufficient_privilege") ||
          normalized.includes("permission") ||
          code === "42501"
        ) {
          setAuditoriaError("Sem permissão para visualizar os eventos de auditoria deste usuário.");
        } else if (
          code === "pgrst202" ||
          normalized.includes("function") ||
          normalized.includes("rpc")
        ) {
          setAuditoriaError("Função RPC não encontrada no Supabase para auditoria individual.");
        } else if (normalized.includes("invalid_user_id_format") || code === "client_validation") {
          setAuditoriaError(
            "Identificador de usuário inválido para consulta de auditoria individual.",
          );
        } else {
          setAuditoriaError("Não foi possível carregar a auditoria individual no momento.");
        }
        setAuditoriaEvents([]);
      } else {
        setAuditoriaEvents(result.data);
      }
      setAuditoriaLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAccess, userId]);

  const statusMessage = useMemo(() => {
    if (requestState === "not_found")
      return "Perfil não encontrado para o identificador informado.";
    if (requestState === "forbidden")
      return "Você não tem permissão para visualizar este perfil nesta operação administrativa.";
    if (requestState === "rpc_unavailable")
      return "Não foi possível consultar o perfil agora: RPC administrativa indisponível no Supabase.";
    if (requestState === "error")
      return "Falha ao carregar o perfil administrativo no momento. Tente novamente.";
    return null;
  }, [requestState]);

  const activitySummary = useMemo(() => getActivitySummary(auditoriaEvents), [auditoriaEvents]);
  const avatarUrl = getProfileAvatarPublicUrl(targetUser?.avatar_path ?? null);
  const initial = (targetUser?.nome?.trim().charAt(0) || "?").toUpperCase();
  const createdAt = formatDate(targetUser?.created_at);
  const updatedAt = formatDate(targetUser?.updated_at);
  const institutionalFunctionOptions = useMemo(
    () =>
      INSTITUTIONAL_FUNCTIONS.filter(
        (institutionalFunction) =>
          !isProtectedInstitutionalFunction(institutionalFunction) ||
          canAssignProtectedInstitutionalFunction(currentProfile),
      ),
    [currentProfile],
  );
  const canEditInstitutionalFunction =
    currentProfile?.cargo === "admin" || currentProfile?.cargo === "delegado";

  const cancelInstitutionalFunctionEdit = () => {
    setInstitutionalFunctionDraft(targetUser?.funcao_institucional ?? "");
    setEditingInstitutionalFunction(false);
    setInstitutionalFunctionFeedback(null);
  };

  const saveInstitutionalFunction = async () => {
    if (!targetUser || savingInstitutionalFunction) return;

    const nextFunction = institutionalFunctionDraft || null;
    if (nextFunction === targetUser.funcao_institucional) {
      setEditingInstitutionalFunction(false);
      setInstitutionalFunctionFeedback(null);
      return;
    }

    setSavingInstitutionalFunction(true);
    setInstitutionalFunctionFeedback(null);
    const { error } = await supabase.rpc("admin_update_user_function", {
      target_user_id: targetUser.id,
      new_function: nextFunction,
    });

    if (error) {
      const code = String(error.code ?? "");
      const normalizedMessage = String(error.message ?? "").toLowerCase();
      const forbidden =
        code === "42501" ||
        normalizedMessage.includes("permission") ||
        normalizedMessage.includes("access_denied");
      const unavailable =
        code === "PGRST202" ||
        normalizedMessage.includes("could not find the function") ||
        normalizedMessage.includes("schema cache");
      setInstitutionalFunctionFeedback({
        kind: "error",
        message: forbidden
          ? "Seu perfil não tem permissão para alterar esta função."
          : unavailable
            ? "A função administrativa ainda não está disponível no Supabase."
            : "Não foi possível salvar a função institucional.",
      });
      setSavingInstitutionalFunction(false);
      return;
    }

    setTargetUser((current) =>
      current
        ? {
            ...current,
            funcao_institucional: nextFunction,
            updated_at: new Date().toISOString(),
          }
        : current,
    );
    setEditingInstitutionalFunction(false);
    setInstitutionalFunctionFeedback({
      kind: "success",
      message: "Função institucional atualizada com sucesso.",
    });
    setSavingInstitutionalFunction(false);
  };

  const toggleSigiloAccess = async () => {
    if (!targetUser || sigiloAccessLoading || sigiloAccessSaving) return;

    const nextValue = !sigiloAccess;
    setSigiloAccessSaving(true);
    setSigiloAccessFeedback(null);
    const { data, error } = await supabase.rpc("admin_update_user_sigilo_access", {
      p_target_user_id: targetUser.id,
      p_enabled: nextValue,
    });

    if (error) {
      const code = String(error.code ?? "");
      const normalizedMessage = String(error.message ?? "").toLowerCase();
      setSigiloAccessFeedback({
        kind: "error",
        message:
          code === "42501" || normalizedMessage.includes("access_denied")
            ? "Somente Admin ou Delegado autorizado pode alterar esta permissão."
            : "Não foi possível atualizar a permissão de sigilo.",
      });
      setSigiloAccessSaving(false);
      return;
    }

    setSigiloAccess(data === true);
    setSigiloAccessFeedback({
      kind: "success",
      message: nextValue
        ? "Acesso individual a casos sigilosos ativado."
        : "Acesso individual a casos sigilosos desativado.",
    });
    setSigiloAccessSaving(false);
  };

  if (checkingAccess) {
    return (
      <PageShell profile={currentProfile}>
        <StateBox text="Verificando permissões..." />
      </PageShell>
    );
  }

  if (!hasAccess) {
    return (
      <PageShell profile={currentProfile}>
        <section className="rounded-2xl border border-border bg-card/80 p-8 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-2">
              <ShieldAlert className="h-5 w-5 text-warning" />
            </div>
            <h1 className="text-2xl font-bold">Acesso restrito</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Esta área é permitida somente para perfis com permissão de administração de usuários.
          </p>
          <Link
            to="/modulos"
            className="mt-6 inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
          >
            Voltar para módulos
          </Link>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell profile={currentProfile}>
      <section className="rounded-2xl border border-primary/25 bg-card/80 p-6 shadow-[0_0_30px_rgba(34,197,94,0.07)]">
        <Link
          to="/admin/usuarios"
          className="mb-5 inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para usuários
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
          Dossiê administrativo
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-wide">Perfil administrativo do usuário</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados institucionais e função profissional. Permissões de acesso continuam administradas
          separadamente.
        </p>
      </section>

      {loadingUser ? <StateBox text="Carregando perfil do usuário..." /> : null}
      {!loadingUser && statusMessage ? <StateBox text={statusMessage} /> : null}

      {!loadingUser && targetUser ? (
        <>
          <section className="rounded-2xl border border-primary/20 bg-card/75 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={`Avatar de ${targetUser.nome}`}
                    className="h-24 w-24 rounded-full border border-primary/35 object-cover shadow-xl"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-3xl font-bold text-primary">
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-2xl font-bold text-foreground">{targetUser.nome}</p>
                  <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{targetUser.email}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge status={targetUser.status_autorizacao} />
                    <RoleBadge role={targetUser.cargo} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-primary/15 bg-background/55 px-4 py-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Criado em
                </p>
                <p className="mt-1 font-semibold text-foreground">{createdAt}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <InfoCard icon={KeyRound} label="Login" value={targetUser.login} />
            <InfoCard
              icon={Phone}
              label="Telefone institucional"
              value={formatPhone(targetUser.telefone) || "Não informado"}
            />
            <InfoCard icon={CalendarDays} label="Data de criação" value={createdAt} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <InfoCard
              icon={UserCog}
              label="Cargo"
              value={formatRole(targetUser.cargo)}
              tone={getRoleTone(targetUser.cargo)}
            />
            <InstitutionalFunctionCard
              value={targetUser.funcao_institucional}
              draft={institutionalFunctionDraft}
              options={institutionalFunctionOptions}
              canEdit={canEditInstitutionalFunction}
              editing={editingInstitutionalFunction}
              saving={savingInstitutionalFunction}
              feedback={institutionalFunctionFeedback}
              onEdit={() => {
                setInstitutionalFunctionDraft(targetUser.funcao_institucional ?? "");
                setInstitutionalFunctionFeedback(null);
                setEditingInstitutionalFunction(true);
              }}
              onChange={setInstitutionalFunctionDraft}
              onCancel={cancelInstitutionalFunctionEdit}
              onSave={() => void saveInstitutionalFunction()}
            />
            <InfoCard
              icon={Shield}
              label="Status de autorização"
              value={formatStatus(targetUser.status_autorizacao)}
              tone={getStatusTone(targetUser.status_autorizacao)}
            />
            {targetUser.updated_at ? (
              <InfoCard icon={Clock3} label="Atualizado em" value={updatedAt} />
            ) : null}
          </section>

          <SigiloAccessCard
            enabled={sigiloAccess}
            loading={sigiloAccessLoading}
            saving={sigiloAccessSaving}
            canEdit={canEditInstitutionalFunction}
            feedback={sigiloAccessFeedback}
            onToggle={() => void toggleSigiloAccess()}
          />

          <AccessContextSection context={accessContext} state={accessContextState} />

          <section className="rounded-2xl border border-primary/15 bg-card/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Resumo de atividade</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Derivado dos eventos de auditoria já carregados para este usuário.
                </p>
              </div>
              <Activity className="h-5 w-5 text-primary/70" />
            </div>
            {auditoriaLoading ? (
              <p className="text-sm text-muted-foreground">Carregando resumo operacional...</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <ActivityCard label="Eventos registrados" value={String(activitySummary.total)} />
                <ActivityCard label="Última ação" value={activitySummary.latestAction} />
                <ActivityCard label="Último registro" value={activitySummary.latestDate} />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-primary/15 bg-card/70 p-6">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Auditoria individual</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Histórico operacional vinculado ao usuário selecionado.
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {auditoriaEvents.length} evento(s)
              </span>
            </div>

            {auditoriaLoading ? (
              <p className="text-sm text-muted-foreground">Carregando eventos de auditoria...</p>
            ) : null}
            {!auditoriaLoading && auditoriaError ? (
              <p className="text-sm text-warning">{auditoriaError}</p>
            ) : null}
            {!auditoriaLoading && !auditoriaError && auditoriaEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum evento de auditoria registrado para este usuário.
              </p>
            ) : null}

            {!auditoriaLoading && !auditoriaError && auditoriaEvents.length > 0 ? (
              <div className="space-y-3">
                {auditoriaEvents.map((event) => (
                  <AuditEventCard key={event.id} event={event} />
                ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </PageShell>
  );
}

function AccessContextSection({
  context,
  state,
}: {
  context: UserAccessContext | null;
  state: "idle" | "loading" | "ready" | "unavailable" | "forbidden" | "error";
}) {
  const stateMessage =
    state === "loading" || state === "idle"
      ? "Carregando último contexto de acesso..."
      : state === "unavailable"
        ? "O contrato de contexto de acesso ainda não foi ativado no banco."
        : state === "forbidden"
          ? "Seu perfil não tem permissão para consultar este contexto de acesso."
          : state === "error"
            ? "Não foi possível carregar o contexto de acesso agora."
            : !context
              ? "Nenhum contexto de acesso foi registrado para este usuário."
              : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-card/70">
      <div className="flex flex-col gap-2 border-b border-primary/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Network className="h-5 w-5 text-primary" />
            Último contexto de acesso
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Rede, dispositivo e localização informados na sessão mais recente.
          </p>
        </div>
        {context ? (
          <span className="text-xs font-medium text-muted-foreground">
            {formatDate(context.observed_at)}
          </span>
        ) : null}
      </div>

      {stateMessage ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">{stateMessage}</p>
      ) : null}

      {context ? (
        <div className="grid md:grid-cols-2">
          <div className="space-y-4 px-5 py-5 md:border-r md:border-primary/10">
            <ContextGroupTitle icon={Laptop} title="Rede e dispositivo" />
            <ContextRow label="Endereço IP" value={context.ip_address || "Não registrado"} />
            <ContextRow label="Provedor" value={context.ip_provider || "Não identificado"} />
            <ContextRow label="Dispositivo" value={context.device_label || "Não identificado"} />
            <ContextRow label="Sistema" value={context.operating_system || "Não identificado"} />
            <ContextRow label="Navegador" value={context.browser || "Não identificado"} />
            <ContextRow label="Fuso horário" value={context.timezone || "Não informado"} />
          </div>
          <div className="space-y-4 border-t border-primary/10 px-5 py-5 md:border-t-0">
            <ContextGroupTitle icon={MapPin} title="Localização" />
            <ContextRow label="País" value={context.country || "Não informado"} />
            <ContextRow label="Estado" value={context.region || "Não informado"} />
            <ContextRow label="Cidade" value={context.city || "Não informado"} />
            <ContextRow label="Rua" value={context.street || "Não informado"} />
            <ContextRow label="Coordenadas" value={formatCoordinates(context)} />
            <ContextRow
              label="Precisão"
              value={
                context.accuracy_meters == null
                  ? "Não informada"
                  : `Aproximadamente ${Math.round(context.accuracy_meters)} m`
              }
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ContextGroupTitle({ icon: Icon, title }: { icon: IconType; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary/85">
      <Icon className="h-4 w-4" />
      {title}
    </h3>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-baseline">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="break-words text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function formatCoordinates(context: UserAccessContext) {
  if (context.latitude == null || context.longitude == null) return "Não autorizadas";
  return `${context.latitude.toFixed(6)}, ${context.longitude.toFixed(6)}`;
}

function PageShell({ children, profile }: { children: ReactNode; profile?: UserProfile | null }) {
  return (
    <>
      {profile ? <MobileNavigation profile={profile} /> : null}
      <main className="min-h-screen bg-background px-4 pb-24 pt-20 text-foreground sm:px-6 md:py-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </main>
    </>
  );
}

function StateBox({ text }: { text: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
      {text}
    </section>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: IconType;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-card/60 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className={`mt-3 break-words text-sm font-semibold ${tone ?? "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function InstitutionalFunctionCard({
  value,
  draft,
  options,
  canEdit,
  editing,
  saving,
  feedback,
  onEdit,
  onChange,
  onCancel,
  onSave,
}: {
  value: InstitutionalFunction | null;
  draft: InstitutionalFunctionDraft;
  options: readonly InstitutionalFunction[];
  canEdit: boolean;
  editing: boolean;
  saving: boolean;
  feedback: { kind: "success" | "error"; message: string } | null;
  onEdit: () => void;
  onChange: (value: InstitutionalFunctionDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-card/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <BriefcaseBusiness className="h-4 w-4" />
          Função institucional
        </div>
        {!editing && canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            title="Editar função institucional"
            aria-label="Editar função institucional"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {!editing ? (
        <p className="mt-3 break-words text-sm font-semibold text-foreground">
          {formatInstitutionalFunction(value)}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <select
            value={draft}
            onChange={(event) => onChange(event.target.value as InstitutionalFunctionDraft)}
            disabled={saving}
            className="h-10 w-full rounded-lg border border-primary/25 bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-primary/60 disabled:opacity-60"
            aria-label="Selecionar função institucional"
          >
            <option value="">Não definida</option>
            {options.map((institutionalFunction) => (
              <option key={institutionalFunction} value={institutionalFunction}>
                {INSTITUTIONAL_FUNCTION_LABELS[institutionalFunction]}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/30 bg-primary/15 px-3 text-xs font-semibold text-primary transition hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background/60 px-3 text-xs font-semibold text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {feedback ? (
        <p
          className={`mt-3 text-xs ${feedback.kind === "success" ? "text-emerald-300" : "text-rose-300"}`}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}

function SigiloAccessCard({
  enabled,
  loading,
  saving,
  canEdit,
  feedback,
  onToggle,
}: {
  enabled: boolean;
  loading: boolean;
  saving: boolean;
  canEdit: boolean;
  feedback: { kind: "success" | "error"; message: string } | null;
  onToggle: () => void;
}) {
  const active = enabled && !loading;

  return (
    <section
      className={`rounded-2xl border p-5 transition-colors ${
        active
          ? "border-emerald-400/35 bg-emerald-400/[0.06]"
          : "border-rose-400/30 bg-rose-400/[0.05]"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${
              active
                ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-300"
                : "border-rose-400/35 bg-rose-400/10 text-rose-300"
            }`}
          >
            {active ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Permissão individual de segurança
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              Acessar casos sigilosos
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Permite visualizar procedimentos e movimentações sigilosas. Esta autorização independe
              do cargo do usuário.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
              active
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : "border-rose-400/40 bg-rose-400/10 text-rose-300"
            }`}
          >
            {loading ? "Consultando" : active ? "Ligado" : "Desligado"}
          </span>
          {canEdit ? (
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label="Permitir acesso a casos sigilosos"
              onClick={onToggle}
              disabled={loading || saving}
              className={`relative h-8 w-14 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? "border-emerald-400/60 bg-emerald-400/25"
                  : "border-rose-400/50 bg-rose-400/15"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full shadow transition-all ${
                  active ? "left-7 bg-emerald-300" : "left-1 bg-rose-300"
                }`}
              />
            </button>
          ) : null}
        </div>
      </div>

      {feedback ? (
        <p
          className={`mt-3 text-xs ${feedback.kind === "success" ? "text-emerald-300" : "text-rose-300"}`}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
    </section>
  );
}

function ActivityCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-background/55 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function AuditEventCard({ event }: { event: AuditoriaEvent }) {
  const eventHref = getAuditEventHref(event);
  const isDeleteEvent = isDeleteAction(event.acao);
  const canNavigate = Boolean(eventHref) && !isDeleteEvent;
  const actionLabel = getAuditTargetActionLabel(eventHref);
  const cardBaseClassName =
    "rounded-2xl border border-primary/10 bg-background/60 p-4 transition-colors";
  const cardContent = (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/85">
              {formatModule(event.modulo)}
            </span>
            <span className="rounded-full border border-zinc-700/70 bg-zinc-900/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {event.entidade || "registro"}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {formatFriendlyAction(event.acao)}
          </p>
          {event.descricao ? (
            <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
              {event.descricao}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-primary/10 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          {formatDate(event.created_at)}
        </div>
      </div>
      {event.entidade_id ? (
        <div
          className={`mt-3 flex items-center gap-2 text-xs ${canNavigate ? "text-primary/90" : "text-muted-foreground"}`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="truncate">ID {shortId(event.entidade_id)}</span>
        </div>
      ) : null}
      {canNavigate ? (
        <div className="mt-3 inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors group-hover:bg-primary/15">
          {actionLabel}
        </div>
      ) : null}
    </>
  );

  if (!eventHref || isDeleteEvent) {
    return <article className={cardBaseClassName}>{cardContent}</article>;
  }

  return (
    <Link
      to={eventHref}
      className={`${cardBaseClassName} group block cursor-pointer hover:border-primary/30 hover:bg-background/80`}
      title={actionLabel}
      aria-label={actionLabel}
    >
      {cardContent}
    </Link>
  );
}

function StatusBadge({ status }: { status: AuthorizationStatus }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getStatusBadgeClass(status)}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/85">
      {formatRole(role)}
    </span>
  );
}

function formatDate(value?: string) {
  if (!value) return "Não informado";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}

function formatFriendlyAction(action?: string) {
  if (!action) return "Ação não informada";
  return action.replaceAll("_", " ").toLowerCase();
}

function formatModule(value?: string) {
  return String(value || "modulo").replaceAll("_", " ");
}

function getActivitySummary(events: AuditoriaEvent[]) {
  const latest = events[0];
  return {
    total: events.length,
    latestAction: latest ? formatFriendlyAction(latest.acao) : "Sem eventos",
    latestDate: latest ? formatDate(latest.created_at) : "Não informado",
  };
}

function formatPhone(value?: string | null) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatRole(role: UserRole) {
  const labels: Record<UserRole, string> = {
    membro: "Membro",
    sipi_access: "SIED Access",
    atlas_access: "Atlas Access",
    delegado: "Delegado",
    admin: "Admin",
  };
  return labels[role] ?? role;
}

function formatInstitutionalFunction(value?: InstitutionalFunction | null) {
  return value ? INSTITUTIONAL_FUNCTION_LABELS[value] : "Não definida";
}

function formatStatus(status: AuthorizationStatus) {
  const labels: Record<AuthorizationStatus, string> = {
    aguardando: "Aguardando",
    autorizado: "Autorizado",
    bloqueado: "Bloqueado",
  };
  return labels[status] ?? status;
}

function getRoleTone(role: UserRole) {
  if (role === "admin" || role === "delegado") return "text-primary";
  if (role === "atlas_access") return "text-violet-300";
  if (role === "sipi_access") return "text-sky-300";
  return "text-muted-foreground";
}

function getStatusTone(status: AuthorizationStatus) {
  if (status === "autorizado") return "text-emerald-300";
  if (status === "bloqueado") return "text-rose-300";
  return "text-amber-300";
}

function getStatusBadgeClass(status: AuthorizationStatus) {
  if (status === "autorizado") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "bloqueado") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

function shortId(value: string) {
  const clean = value.trim();
  if (clean.length <= 14) return clean;
  return `${clean.slice(0, 8)}...${clean.slice(-4)}`;
}

function getAuditEventHref(event: AuditoriaEvent) {
  const entityId = event.entidade_id ? String(event.entidade_id).trim() : "";
  if (!entityId) return null;

  const modulo = normalizeAuditRouteToken(event.modulo);
  const entidade = normalizeAuditRouteToken(event.entidade);

  if (
    matchesAuditRoute(entidade, ["inquerito", "inqueritos"]) ||
    matchesAuditRoute(modulo, ["inquerito", "inqueritos"])
  ) {
    return `/inqueritos/${entityId}`;
  }
  if (
    matchesAuditRoute(entidade, ["representacao", "representacoes"]) ||
    matchesAuditRoute(modulo, ["representacao", "representacoes"])
  ) {
    return `/representacoes/${entityId}`;
  }
  if (
    matchesAuditRoute(entidade, [
      "profile",
      "profiles",
      "perfil",
      "perfis",
      "usuario",
      "usuarios",
      "admin_usuario",
      "admin_usuarios",
    ]) ||
    matchesAuditRoute(modulo, [
      "profile",
      "profiles",
      "perfil",
      "perfis",
      "usuario",
      "usuarios",
      "admin_usuario",
      "admin_usuarios",
    ])
  ) {
    return `/admin/usuarios/${entityId}`;
  }

  return null;
}

function normalizeAuditRouteToken(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function matchesAuditRoute(value: string, candidates: string[]) {
  return candidates.some(
    (candidate) =>
      value === candidate || value.includes(`_${candidate}`) || value.includes(`${candidate}_`),
  );
}

function getAuditTargetActionLabel(href: string | null) {
  if (!href) return "Abrir item relacionado";
  if (href.startsWith("/inqueritos/")) return "Abrir inquérito";
  if (href.startsWith("/representacoes/")) return "Abrir representação";
  if (href.startsWith("/admin/usuarios/")) return "Abrir perfil";
  return "Abrir item relacionado";
}

function isDeleteAction(action?: string | null) {
  const normalized = String(action || "")
    .trim()
    .toLowerCase();
  return normalized === "delete" || normalized.endsWith("_delete") || normalized.includes("exclu");
}
