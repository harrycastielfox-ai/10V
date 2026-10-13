import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Clock3,
  Mail,
  ShieldAlert,
  UserCheck,
  UserCog,
  UserMinus,
  Users,
} from "lucide-react";
import { getCurrentProfile, getProfileAvatarPublicUrl, getSession } from "@/lib/auth";
import {
  canAtlasAssignRole,
  canAssignProtectedUserRole,
  canEditUserAccess,
  canManageUsers,
  type AuthorizationStatus,
  type UserProfile,
  type UserRole,
} from "@/lib/authz";
import { supabase } from "@/lib/supabaseClient";
import { MobileNavigation } from "@/components/MobileNavigation";

export const Route = createFileRoute("/admin/usuarios")({
  component: AdminUsuariosPage,
});

type AdminUserProfile = UserProfile & { telefone?: string | null };
type EditableUserState = { cargo: UserRole; status: AuthorizationStatus };
type IconType = ComponentType<{ className?: string }>;

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "membro", label: "Membro" },
  { value: "sipi_access", label: "SIED Access" },
  { value: "atlas_access", label: "Atlas Access" },
  { value: "delegado", label: "Delegado" },
  { value: "admin", label: "Admin" },
];

const STATUS_OPTIONS: Array<{ value: AuthorizationStatus; label: string }> = [
  { value: "aguardando", label: "Aguardando" },
  { value: "autorizado", label: "Autorizado" },
  { value: "bloqueado", label: "Bloqueado" },
];

function AdminUsuariosPage() {
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const showingUserDetail =
    currentPath !== "/admin/usuarios" && currentPath.startsWith("/admin/usuarios/");
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<AdminUserProfile[]>([]);
  const [formState, setFormState] = useState<Record<string, EditableUserState>>({});
  const [loadingByUser, setLoadingByUser] = useState<Record<string, string | null>>({});
  const [feedbackByUser, setFeedbackByUser] = useState<
    Record<string, { kind: "success" | "error"; message: string }>
  >({});
  const [sigiloAccessByUser, setSigiloAccessByUser] = useState<Record<string, boolean>>({});
  const [sigiloLoadingByUser, setSigiloLoadingByUser] = useState<Record<string, boolean>>({});
  const [sigiloSavingByUser, setSigiloSavingByUser] = useState<Record<string, boolean>>({});
  const [sigiloFeedbackByUser, setSigiloFeedbackByUser] = useState<
    Record<string, { kind: "success" | "error"; message: string }>
  >({});

  const canManageSigilo =
    currentProfile?.status_autorizacao === "autorizado" &&
    (currentProfile.cargo === "admin" || currentProfile.cargo === "delegado");

  const getSupabaseErrorMessage = (issue: unknown, fallback: string) => {
    const code =
      typeof issue === "object" && issue !== null && "code" in issue
        ? String((issue as { code?: string }).code ?? "")
        : "";
    const message =
      typeof issue === "object" && issue !== null && "message" in issue
        ? String((issue as { message?: string }).message ?? "")
        : "";
    const normalized = message.toLowerCase();
    if (code === "PGRST202" || normalized.includes("rpc") || normalized.includes("function")) {
      return `${fallback}. RPC ausente ou indisponível no Supabase.`;
    }
    if (code === "42501" || normalized.includes("permission")) {
      return `${fallback}. Sem permissão na policy/RPC.`;
    }
    return fallback;
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await getSession();
        if (!session) {
          if (!cancelled) navigate({ to: "/login", replace: true });
          return;
        }
        const currentProfile = await getCurrentProfile();
        if (!currentProfile) {
          if (!cancelled) navigate({ to: "/modulos", replace: true });
          return;
        }
        setCurrentProfile(currentProfile);
        if (!canManageUsers(currentProfile)) {
          if (!cancelled) setHasAccess(false);
          return;
        }
        if (!cancelled) setHasAccess(true);
      } catch (authError) {
        console.error("[AdminUsuariosPage] Erro ao validar acesso", authError);
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
    if (!hasAccess) {
      setLoadingUsers(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingUsers(true);
      setError(null);
      try {
        const { data, error: listError } = await supabase.rpc("list_profiles_for_admin");
        if (listError) throw listError;
        const normalizedUsers = ((data ?? []) as AdminUserProfile[]).map((user) => ({
          ...user,
          updated_at: user.created_at,
        }));
        if (cancelled) return;
        setUsuarios(normalizedUsers);
        setFormState((current) => {
          const next = { ...current };
          for (const user of normalizedUsers) {
            next[user.id] = {
              cargo: current[user.id]?.cargo ?? user.cargo,
              status: current[user.id]?.status ?? user.status_autorizacao,
            };
          }
          return next;
        });

        if (canManageSigilo) {
          setSigiloLoadingByUser(
            Object.fromEntries(normalizedUsers.map((user) => [user.id, true])),
          );
          const sigiloResults = await Promise.all(
            normalizedUsers.map(async (user) => {
              const result = await supabase.rpc("admin_get_user_sigilo_access", {
                p_target_user_id: user.id,
              });
              return { userId: user.id, ...result };
            }),
          );
          if (cancelled) return;

          setSigiloAccessByUser(
            Object.fromEntries(
              sigiloResults.map((result) => [
                result.userId,
                result.error ? false : result.data === true,
              ]),
            ),
          );
          setSigiloFeedbackByUser(
            Object.fromEntries(
              sigiloResults
                .filter((result) => result.error)
                .map((result) => [
                  result.userId,
                  {
                    kind: "error" as const,
                    message: "Não foi possível consultar a permissão de sigilo.",
                  },
                ]),
            ),
          );
          setSigiloLoadingByUser({});
        } else {
          setSigiloAccessByUser({});
          setSigiloLoadingByUser({});
          setSigiloFeedbackByUser({});
        }
      } catch (fetchError) {
        console.error("[AdminUsuariosPage] Erro ao listar usuários", fetchError);
        if (!cancelled)
          setError(
            getSupabaseErrorMessage(fetchError, "Não foi possível carregar os usuários no momento"),
          );
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageSigilo, hasAccess]);

  const canEditTarget = (target: UserProfile, nextRole?: UserRole) =>
    canEditUserAccess(currentProfile, target, nextRole);
  const allowedRolesForRequester = (target: UserProfile) => {
    if (currentProfile?.cargo !== "atlas_access") {
      return ROLE_OPTIONS.filter(
        (opt) =>
          !["admin", "delegado"].includes(opt.value) || canAssignProtectedUserRole(currentProfile),
      );
    }
    if (!canEditTarget(target)) return [];
    return ROLE_OPTIONS.filter((opt) => canAtlasAssignRole(opt.value));
  };

  const updateUser = async (
    user: AdminUserProfile,
    role: UserRole,
    status: AuthorizationStatus,
    actionLabel: string,
  ) => {
    if (!canEditTarget(user, role)) {
      setFeedbackByUser((current) => ({
        ...current,
        [user.id]: { kind: "error", message: "Ação restrita a Delegado/Admin." },
      }));
      return;
    }
    setLoadingByUser((current) => ({ ...current, [user.id]: actionLabel }));
    setFeedbackByUser((current) => ({ ...current, [user.id]: { kind: "success", message: "" } }));
    const { error: updateError } = await supabase.rpc("admin_update_user_access", {
      target_user_id: user.id,
      new_role: role,
      new_status: status,
    });
    if (updateError) {
      setFeedbackByUser((current) => ({
        ...current,
        [user.id]: {
          kind: "error",
          message: getSupabaseErrorMessage(
            updateError,
            "Não foi possível salvar a alteração. Tente novamente",
          ),
        },
      }));
      setLoadingByUser((current) => ({ ...current, [user.id]: null }));
      return;
    }
    setUsuarios((current) =>
      current.map((entry) =>
        entry.id === user.id
          ? {
              ...entry,
              cargo: role,
              status_autorizacao: status,
              updated_at: new Date().toISOString(),
            }
          : entry,
      ),
    );
    setFormState((current) => ({ ...current, [user.id]: { cargo: role, status } }));
    setFeedbackByUser((current) => ({
      ...current,
      [user.id]: { kind: "success", message: "Alterações salvas com sucesso." },
    }));
    setLoadingByUser((current) => ({ ...current, [user.id]: null }));
  };

  const toggleUserSigiloAccess = async (user: AdminUserProfile) => {
    if (!canManageSigilo || sigiloLoadingByUser[user.id] || sigiloSavingByUser[user.id]) return;

    const nextValue = !sigiloAccessByUser[user.id];
    setSigiloSavingByUser((current) => ({ ...current, [user.id]: true }));
    setSigiloFeedbackByUser((current) => {
      const next = { ...current };
      delete next[user.id];
      return next;
    });

    const { data, error: updateError } = await supabase.rpc("admin_update_user_sigilo_access", {
      p_target_user_id: user.id,
      p_enabled: nextValue,
    });

    if (updateError) {
      setSigiloFeedbackByUser((current) => ({
        ...current,
        [user.id]: {
          kind: "error",
          message: getSupabaseErrorMessage(
            updateError,
            "Não foi possível alterar o acesso a casos sigilosos",
          ),
        },
      }));
      setSigiloSavingByUser((current) => ({ ...current, [user.id]: false }));
      return;
    }

    setSigiloAccessByUser((current) => ({
      ...current,
      [user.id]: data === true ? true : nextValue,
    }));
    setSigiloFeedbackByUser((current) => ({
      ...current,
      [user.id]: {
        kind: "success",
        message: nextValue
          ? "Acesso individual a casos sigilosos ativado."
          : "Acesso individual a casos sigilosos desativado.",
      },
    }));
    setSigiloSavingByUser((current) => ({ ...current, [user.id]: false }));
  };

  const pendentes = useMemo(
    () => usuarios.filter((user) => user.status_autorizacao === "aguardando"),
    [usuarios],
  );
  const autorizados = useMemo(
    () => usuarios.filter((user) => user.status_autorizacao === "autorizado").length,
    [usuarios],
  );
  const bloqueados = useMemo(
    () => usuarios.filter((user) => user.status_autorizacao === "bloqueado").length,
    [usuarios],
  );
  const administradores = useMemo(
    () => usuarios.filter((user) => user.cargo === "admin").length,
    [usuarios],
  );

  if (showingUserDetail) return <Outlet />;

  if (checkingAccess) return <PageState title="Verificando permissões..." />;
  if (!hasAccess) {
    return (
      <section className="min-h-screen bg-background px-4 pb-24 pt-20 text-foreground sm:px-6 md:py-8 lg:px-8">
        {currentProfile ? <MobileNavigation profile={currentProfile} /> : null}
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card/80 p-8 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-2">
              <ShieldAlert className="h-5 w-5 text-warning" />
            </div>
            <h1 className="text-2xl font-bold">Acesso restrito</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Esta área exige perfil administrativo. Admin e Delegado possuem gestão completa; Atlas
            Access possui gestão limitada conforme as regras de acesso.
          </p>
          <Link
            to="/modulos"
            className="mt-6 inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
          >
            Voltar para módulos
          </Link>
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-20 text-foreground sm:px-6 md:py-6 lg:px-8">
      {currentProfile ? <MobileNavigation profile={currentProfile} /> : null}
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link
            to="/modulos"
            className="hidden items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 md:inline-flex"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>

        <header className="rounded-2xl border border-primary/25 bg-card/80 p-6 shadow-[0_0_30px_rgba(34,197,94,0.07)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
                Painel administrativo
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-wide">Administração de Usuários</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Controle institucional de acesso, cargos e autorizações do SIED.
              </p>
            </div>
            <div className="hidden rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-medium text-primary/85 md:block">
              {usuarios.length} perfil(is) carregado(s)
            </div>
          </div>
        </header>

        <section className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard icon={Users} label="Total usuários" value={usuarios.length} tone="primary" />
          <SummaryCard icon={Clock3} label="Aguardando" value={pendentes.length} tone="warning" />
          <SummaryCard icon={UserCheck} label="Autorizados" value={autorizados} tone="success" />
          <SummaryCard icon={UserMinus} label="Bloqueados" value={bloqueados} tone="danger" />
          <SummaryCard
            icon={UserCog}
            label="Administradores"
            value={administradores}
            tone="neutral"
          />
        </section>

        <UsersSection
          title="Solicitações pendentes de acesso"
          description="Usuários que aguardam autorização inicial para uso do sistema."
          loading={loadingUsers}
          error={error}
          users={pendentes}
          mode="pending"
          formState={formState}
          loadingByUser={loadingByUser}
          feedbackByUser={feedbackByUser}
          onRoleChange={(userId, role) =>
            setFormState((cur) => ({
              ...cur,
              [userId]: { cargo: role, status: cur[userId]?.status ?? "aguardando" },
            }))
          }
          onStatusChange={(userId, status) =>
            setFormState((cur) => ({
              ...cur,
              [userId]: { cargo: cur[userId]?.cargo ?? "membro", status },
            }))
          }
          onAuthorize={(user) =>
            updateUser(user, formState[user.id]?.cargo ?? "membro", "autorizado", "authorize")
          }
          onBlock={(user) =>
            updateUser(user, formState[user.id]?.cargo ?? "membro", "bloqueado", "block")
          }
          onSave={(user) =>
            updateUser(
              user,
              formState[user.id]?.cargo ?? user.cargo,
              formState[user.id]?.status ?? user.status_autorizacao,
              "save",
            )
          }
          currentProfile={currentProfile}
          canEditTarget={canEditTarget}
          allowedRolesForRequester={allowedRolesForRequester}
          canManageSigilo={canManageSigilo}
          sigiloAccessByUser={sigiloAccessByUser}
          sigiloLoadingByUser={sigiloLoadingByUser}
          sigiloSavingByUser={sigiloSavingByUser}
          sigiloFeedbackByUser={sigiloFeedbackByUser}
          onToggleSigilo={toggleUserSigiloAccess}
        />

        <UsersSection
          title="Todos os usuários"
          description="Relação completa de perfis cadastrados no SIED."
          loading={loadingUsers}
          error={error}
          users={usuarios}
          mode="all"
          formState={formState}
          loadingByUser={loadingByUser}
          feedbackByUser={feedbackByUser}
          onRoleChange={(userId, role) =>
            setFormState((cur) => ({
              ...cur,
              [userId]: { cargo: role, status: cur[userId]?.status ?? "aguardando" },
            }))
          }
          onStatusChange={(userId, status) =>
            setFormState((cur) => ({
              ...cur,
              [userId]: { cargo: cur[userId]?.cargo ?? "membro", status },
            }))
          }
          onAuthorize={(user) =>
            updateUser(user, formState[user.id]?.cargo ?? "membro", "autorizado", "authorize")
          }
          onBlock={(user) =>
            updateUser(user, formState[user.id]?.cargo ?? "membro", "bloqueado", "block")
          }
          onSave={(user) =>
            updateUser(
              user,
              formState[user.id]?.cargo ?? user.cargo,
              formState[user.id]?.status ?? user.status_autorizacao,
              "save",
            )
          }
          currentProfile={currentProfile}
          canEditTarget={canEditTarget}
          allowedRolesForRequester={allowedRolesForRequester}
          canManageSigilo={canManageSigilo}
          sigiloAccessByUser={sigiloAccessByUser}
          sigiloLoadingByUser={sigiloLoadingByUser}
          sigiloSavingByUser={sigiloSavingByUser}
          sigiloFeedbackByUser={sigiloFeedbackByUser}
          onToggleSigilo={toggleUserSigiloAccess}
        />
      </div>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: IconType;
  label: string;
  value: number;
  tone: "primary" | "warning" | "success" | "danger" | "neutral";
}) {
  const toneClass = {
    primary: "text-primary bg-primary/10 border-primary/25",
    warning: "text-amber-300 bg-amber-400/10 border-amber-400/25",
    success: "text-emerald-300 bg-emerald-400/10 border-emerald-400/25",
    danger: "text-rose-300 bg-rose-400/10 border-rose-400/25",
    neutral: "text-slate-300 bg-slate-400/10 border-slate-400/25",
  }[tone];

  return (
    <article className="rounded-xl border border-primary/15 bg-card/75 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className={`rounded-lg border p-2 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="text-3xl font-bold leading-none text-foreground">{value}</div>
    </article>
  );
}

function UsersSection({
  title,
  description,
  loading,
  error,
  users,
  mode,
  formState,
  loadingByUser,
  feedbackByUser,
  onRoleChange,
  onStatusChange,
  onAuthorize,
  onBlock,
  onSave,
  currentProfile,
  canEditTarget,
  allowedRolesForRequester,
  canManageSigilo,
  sigiloAccessByUser,
  sigiloLoadingByUser,
  sigiloSavingByUser,
  sigiloFeedbackByUser,
  onToggleSigilo,
}: {
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  users: AdminUserProfile[];
  mode: "pending" | "all";
  formState: Record<string, EditableUserState>;
  loadingByUser: Record<string, string | null>;
  feedbackByUser: Record<string, { kind: "success" | "error"; message: string }>;
  onRoleChange: (userId: string, role: UserRole) => void;
  onStatusChange: (userId: string, status: AuthorizationStatus) => void;
  onAuthorize: (user: AdminUserProfile) => void;
  onBlock: (user: AdminUserProfile) => void;
  onSave: (user: AdminUserProfile) => void;
  currentProfile: UserProfile | null;
  canEditTarget: (user: UserProfile, nextRole?: UserRole) => boolean;
  allowedRolesForRequester: (user: UserProfile) => Array<{ value: UserRole; label: string }>;
  canManageSigilo: boolean;
  sigiloAccessByUser: Record<string, boolean>;
  sigiloLoadingByUser: Record<string, boolean>;
  sigiloSavingByUser: Record<string, boolean>;
  sigiloFeedbackByUser: Record<string, { kind: "success" | "error"; message: string }>;
  onToggleSigilo: (user: AdminUserProfile) => void;
}) {
  return (
    <section className="rounded-2xl border border-primary/15 bg-card/70 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.14)]">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {users.length} registro(s)
        </span>
      </div>

      {loading ? <PageState title="Carregando usuários..." /> : null}
      {!loading && error ? <PageError message={error} /> : null}
      {!loading && !error && users.length === 0 ? (
        <PageState title="Nenhum usuário encontrado nesta seção." />
      ) : null}

      {!loading && !error && users.length > 0 ? (
        <div className="space-y-3">
          {users.map((user) => {
            const isLoading = Boolean(loadingByUser[user.id]);
            const selectedRole = formState[user.id]?.cargo ?? user.cargo;
            const selectedStatus = formState[user.id]?.status ?? user.status_autorizacao;
            const feedback = feedbackByUser[user.id];
            const canEditUser = canEditTarget(user, selectedRole);
            const roleOptions = allowedRolesForRequester(user);
            return (
              <UserAdminCard
                key={user.id}
                user={user}
                mode={mode}
                selectedRole={selectedRole}
                selectedStatus={selectedStatus}
                roleOptions={roleOptions}
                isLoading={isLoading}
                feedback={feedback}
                canEditUser={canEditUser}
                showAtlasRestriction={currentProfile?.cargo === "atlas_access" && !canEditUser}
                onRoleChange={onRoleChange}
                onStatusChange={onStatusChange}
                onAuthorize={onAuthorize}
                onBlock={onBlock}
                onSave={onSave}
                canManageSigilo={canManageSigilo}
                sigiloEnabled={sigiloAccessByUser[user.id] === true}
                sigiloLoading={sigiloLoadingByUser[user.id] === true}
                sigiloSaving={sigiloSavingByUser[user.id] === true}
                sigiloFeedback={sigiloFeedbackByUser[user.id]}
                onToggleSigilo={onToggleSigilo}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function UserAdminCard({
  user,
  mode,
  selectedRole,
  selectedStatus,
  roleOptions,
  isLoading,
  feedback,
  canEditUser,
  showAtlasRestriction,
  onRoleChange,
  onStatusChange,
  onAuthorize,
  onBlock,
  onSave,
  canManageSigilo,
  sigiloEnabled,
  sigiloLoading,
  sigiloSaving,
  sigiloFeedback,
  onToggleSigilo,
}: {
  user: AdminUserProfile;
  mode: "pending" | "all";
  selectedRole: UserRole;
  selectedStatus: AuthorizationStatus;
  roleOptions: Array<{ value: UserRole; label: string }>;
  isLoading: boolean;
  feedback?: { kind: "success" | "error"; message: string };
  canEditUser: boolean;
  showAtlasRestriction: boolean;
  onRoleChange: (userId: string, role: UserRole) => void;
  onStatusChange: (userId: string, status: AuthorizationStatus) => void;
  onAuthorize: (user: AdminUserProfile) => void;
  onBlock: (user: AdminUserProfile) => void;
  onSave: (user: AdminUserProfile) => void;
  canManageSigilo: boolean;
  sigiloEnabled: boolean;
  sigiloLoading: boolean;
  sigiloSaving: boolean;
  sigiloFeedback?: { kind: "success" | "error"; message: string };
  onToggleSigilo: (user: AdminUserProfile) => void;
}) {
  return (
    <article className="rounded-2xl border border-primary/15 bg-background/65 p-4 transition hover:border-primary/30 hover:bg-background/85">
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,1.2fr)_minmax(360px,1.6fr)_auto] lg:items-center">
        <UserIdentity
          profile={user}
          canManageSigilo={canManageSigilo}
          sigiloEnabled={sigiloEnabled}
          sigiloLoading={sigiloLoading}
          sigiloSaving={sigiloSaving}
          sigiloFeedback={sigiloFeedback}
          onToggleSigilo={() => onToggleSigilo(user)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <UserMeta
            icon={BadgeCheck}
            label="Cargo"
            value={formatRole(user.cargo)}
            accent={getRoleTone(user.cargo)}
          />
          <UserMeta
            icon={CalendarDays}
            label="Criado em"
            value={formatShortDate(user.created_at)}
          />
        </div>

        <div className="flex flex-col gap-3 lg:min-w-[280px]">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusBadge status={user.status_autorizacao} />
            <Link
              to="/admin/usuarios/$userId"
              params={{ userId: String(user.id) }}
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              Ver perfil
            </Link>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <select
              value={selectedRole}
              onChange={(event) => onRoleChange(user.id, event.target.value as UserRole)}
              disabled={isLoading || !canEditUser || roleOptions.length === 0}
              className="h-9 rounded-lg border border-primary/15 bg-card/70 px-2 text-xs text-foreground outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={`Cargo de ${user.nome}`}
            >
              {roleOptions.map((roleOption) => (
                <option key={roleOption.value} value={roleOption.value}>
                  {roleOption.label}
                </option>
              ))}
            </select>

            {mode === "all" ? (
              <select
                value={selectedStatus}
                onChange={(event) =>
                  onStatusChange(user.id, event.target.value as AuthorizationStatus)
                }
                disabled={isLoading || !canEditUser}
                className="h-9 rounded-lg border border-primary/15 bg-card/70 px-2 text-xs text-foreground outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`Status de ${user.nome}`}
              >
                {STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex h-9 items-center rounded-lg border border-primary/10 bg-card/50 px-2 text-xs capitalize text-muted-foreground">
                {user.status_autorizacao}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {mode === "pending" ? (
              <>
                <button
                  onClick={() => onAuthorize(user)}
                  disabled={isLoading || !canEditUser}
                  className="rounded-md border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Autorizar
                </button>
                <button
                  onClick={() => onBlock(user)}
                  disabled={isLoading || !canEditUser}
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Bloquear
                </button>
              </>
            ) : (
              <button
                onClick={() => onSave(user)}
                disabled={isLoading || !canEditUser}
                className="rounded-md border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Salvar
              </button>
            )}
          </div>

          {showAtlasRestriction ? (
            <p className="text-right text-[11px] text-muted-foreground">
              Ação restrita a Delegado/Admin.
            </p>
          ) : null}
          {isLoading ? (
            <p className="text-right text-xs text-muted-foreground">Salvando...</p>
          ) : null}
          {feedback?.message ? (
            <p
              className={`text-right text-xs ${feedback.kind === "error" ? "text-destructive" : "text-emerald-400"}`}
            >
              {feedback.message}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function UserIdentity({
  profile,
  canManageSigilo,
  sigiloEnabled,
  sigiloLoading,
  sigiloSaving,
  sigiloFeedback,
  onToggleSigilo,
}: {
  profile: AdminUserProfile;
  canManageSigilo: boolean;
  sigiloEnabled: boolean;
  sigiloLoading: boolean;
  sigiloSaving: boolean;
  sigiloFeedback?: { kind: "success" | "error"; message: string };
  onToggleSigilo: () => void;
}) {
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-4">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`Avatar de ${profile.nome}`}
          className="h-16 w-16 rounded-full border border-primary/35 object-cover shadow-lg"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-xl font-bold text-primary">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-base font-semibold text-foreground">{profile.nome}</div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{profile.email}</span>
        </div>
        {canManageSigilo ? (
          <div className="mt-2">
            <button
              type="button"
              role="switch"
              aria-checked={sigiloEnabled}
              aria-label={`Acesso de ${profile.nome} a casos sigilosos`}
              onClick={onToggleSigilo}
              disabled={sigiloLoading || sigiloSaving}
              className={`inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] transition disabled:cursor-wait disabled:opacity-60 ${
                sigiloEnabled
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"
                  : "border-rose-400/40 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15"
              }`}
            >
              <ShieldAlert className="h-3 w-3 shrink-0" />
              <span>Sigilo</span>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  sigiloEnabled ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              <span className="truncate">
                {sigiloLoading
                  ? "Carregando"
                  : sigiloSaving
                    ? "Salvando"
                    : sigiloEnabled
                      ? "Ligado"
                      : "Desligado"}
              </span>
            </button>
            {sigiloFeedback?.message ? (
              <p
                className={`mt-1 max-w-xs text-[10px] leading-4 ${
                  sigiloFeedback.kind === "error" ? "text-destructive" : "text-emerald-400"
                }`}
              >
                {sigiloFeedback.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UserMeta({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: IconType;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-primary/10 bg-card/45 px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p
        className={`mt-1 truncate text-sm font-semibold ${accent ?? "text-foreground"}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: AuthorizationStatus }) {
  const className = {
    aguardando: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    autorizado: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    bloqueado: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  }[status];

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function PageState({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
      {title}
    </div>
  );
}

function PageError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4" />
      {message}
    </div>
  );
}

function getRoleTone(role: UserRole) {
  if (role === "admin" || role === "delegado") return "text-primary";
  if (role === "atlas_access") return "text-violet-300";
  if (role === "sipi_access") return "text-sky-300";
  return "text-muted-foreground";
}

function formatRole(role: UserRole) {
  const match = ROLE_OPTIONS.find((option) => option.value === role);
  return match?.label ?? role;
}

function formatStatus(status: AuthorizationStatus) {
  const match = STATUS_OPTIONS.find((option) => option.value === status);
  return match?.label ?? status;
}

function formatShortDate(value?: string) {
  if (!value) return "Não informado";
  return new Date(value).toLocaleDateString("pt-BR");
}
