export const USER_ROLES = ["membro", "sipi_access", "atlas_access", "delegado", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AUTHORIZATION_STATUS = ["aguardando", "autorizado", "bloqueado"] as const;
export type AuthorizationStatus = (typeof AUTHORIZATION_STATUS)[number];

export const INSTITUTIONAL_FUNCTIONS = [
  "juiz",
  "promotor",
  "delegado",
  "escrivao",
  "investigador",
  "agente_policia",
  "administrativo",
] as const;
export type InstitutionalFunction = (typeof INSTITUTIONAL_FUNCTIONS)[number];

export const PUBLIC_SIGNUP_INSTITUTIONAL_FUNCTIONS = [
  "delegado",
  "juiz",
  "promotor",
  "escrivao",
  "investigador",
  "agente_policia",
  "administrativo",
] as const satisfies readonly InstitutionalFunction[];

export const PROTECTED_INSTITUTIONAL_FUNCTIONS = [
  "juiz",
  "promotor",
  "delegado",
] as const satisfies readonly InstitutionalFunction[];

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  login: string;
  avatar_path: string | null;
  funcao_institucional: InstitutionalFunction | null;
  cargo: UserRole;
  status_autorizacao: AuthorizationStatus;
  can_access_sigiloso?: boolean | null;
  created_at: string;
  updated_at: string;
}

export function isAuthorized(profile: Pick<UserProfile, "status_autorizacao"> | null): boolean {
  return profile?.status_autorizacao === "autorizado";
}

export function isAdmin(profile: Pick<UserProfile, "cargo"> | null): boolean {
  return profile?.cargo === "admin";
}

export function isDelegado(profile: Pick<UserProfile, "cargo"> | null): boolean {
  return profile?.cargo === "delegado";
}

export function isAtlasAccess(profile: Pick<UserProfile, "cargo"> | null): boolean {
  return profile?.cargo === "atlas_access";
}

export function canManageUsers(
  profile: Pick<UserProfile, "cargo" | "funcao_institucional"> | null,
): boolean {
  return isAdmin(profile) || isDelegado(profile);
}

export function isProtectedInstitutionalFunction(
  value: InstitutionalFunction | string | null | undefined,
): boolean {
  return (PROTECTED_INSTITUTIONAL_FUNCTIONS as readonly string[]).includes(value ?? "");
}

export function canAssignProtectedInstitutionalFunction(
  requester: Pick<UserProfile, "cargo"> | null,
): boolean {
  return requester?.cargo === "admin";
}

export function canAssignProtectedUserRole(requester: Pick<UserProfile, "cargo"> | null): boolean {
  return requester?.cargo === "admin";
}

export function canViewPrivateCases(
  profile: Pick<UserProfile, "status_autorizacao" | "can_access_sigiloso"> | null,
): boolean {
  return Boolean(
    profile?.status_autorizacao === "autorizado" && profile.can_access_sigiloso === true,
  );
}

export function canOnlyViewPublicCases(
  profile: Pick<UserProfile, "status_autorizacao" | "can_access_sigiloso"> | null,
): boolean {
  return !canViewPrivateCases(profile);
}

export function canCreateCases(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  if (!profile || !isAuthorized(profile)) return false;
  return profile.cargo !== "membro";
}

export function canEditCases(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canCreateCases(profile);
}

export function canDeleteCases(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canCreateCases(profile);
}

export function canManageCases(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canCreateCases(profile) || canEditCases(profile) || canDeleteCases(profile);
}

export function canManageProceduralTags(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return Boolean(
    profile && isAuthorized(profile) && (profile.cargo === "admin" || profile.cargo === "delegado"),
  );
}

export function canViewRepresentacoes(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  if (!profile || !isAuthorized(profile)) return false;
  return profile.cargo !== "membro";
}

export function canViewAuditoria(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  if (!profile || !isAuthorized(profile)) return false;
  return profile.cargo === "admin" || profile.cargo === "delegado";
}

export function canCreateRepresentacoes(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canViewRepresentacoes(profile);
}

export function canEditRepresentacoes(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canViewRepresentacoes(profile);
}

export function canDeleteRepresentacoes(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canViewRepresentacoes(profile);
}

export function canViewVehicles(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  if (!profile || !isAuthorized(profile)) return false;
  return profile.cargo !== "membro";
}

const VEHICLE_EDITOR_ROLES: UserRole[] = ["sipi_access", "delegado", "admin"];
const VEHICLE_RELEASE_ROLES: UserRole[] = ["delegado", "admin"];

export function canCreateVehicles(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return Boolean(profile && isAuthorized(profile) && VEHICLE_EDITOR_ROLES.includes(profile.cargo));
}

export function canEditVehicles(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canCreateVehicles(profile);
}

export function canRegisterVehicleMovements(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canCreateVehicles(profile);
}

export function canReleaseVehicles(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return Boolean(profile && isAuthorized(profile) && VEHICLE_RELEASE_ROLES.includes(profile.cargo));
}

export function canDeleteVehicles(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canReleaseVehicles(profile);
}

export function canManageVehicles(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canCreateVehicles(profile) || canReleaseVehicles(profile) || canDeleteVehicles(profile);
}

export function canViewObjects(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  if (!profile || !isAuthorized(profile)) return false;
  return profile.cargo !== "membro";
}

const OBJECT_EDITOR_ROLES: UserRole[] = ["sipi_access", "delegado", "admin"];
const OBJECT_RELEASE_ROLES: UserRole[] = ["delegado", "admin"];

export function canCreateObjects(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return Boolean(profile && isAuthorized(profile) && OBJECT_EDITOR_ROLES.includes(profile.cargo));
}

export function canEditObjects(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canCreateObjects(profile);
}

export function canRegisterObjectMovements(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canCreateObjects(profile);
}

export function canReleaseObjects(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return Boolean(profile && isAuthorized(profile) && OBJECT_RELEASE_ROLES.includes(profile.cargo));
}

export function canDeleteObjects(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canReleaseObjects(profile);
}

export function canManageObjects(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return canCreateObjects(profile) || canReleaseObjects(profile) || canDeleteObjects(profile);
}

const AGENDA_EDITOR_ROLES: UserRole[] = ["sipi_access", "delegado", "admin"];

export function canViewAgenda(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  if (!profile || !isAuthorized(profile)) return false;
  return profile.cargo !== "membro";
}

export function canManageAgenda(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return Boolean(profile && isAuthorized(profile) && AGENDA_EDITOR_ROLES.includes(profile.cargo));
}

// Contato Operacional é restrito ao cargo admin — a pedido explícito do usuário.
const LOCALIZACAO_ROLES: UserRole[] = ["admin"];

export function canViewLocalizacao(
  profile: Pick<UserProfile, "cargo" | "status_autorizacao"> | null,
): boolean {
  return Boolean(profile && isAuthorized(profile) && LOCALIZACAO_ROLES.includes(profile.cargo));
}

export const canManageLocalizacao = canViewLocalizacao;

export const canSeePrivateRecords = canViewPrivateCases;
export const canCreateRecords = canCreateCases;
export const canEditRecords = canEditCases;
export const canDeleteRecords = canDeleteCases;

const ATLAS_BLOCKED_ROLES: UserRole[] = ["admin", "delegado", "atlas_access"];
const ATLAS_ALLOWED_TARGET_ROLES: UserRole[] = ["membro", "sipi_access"];

export function canAtlasEditTargetRole(targetRole: UserRole): boolean {
  return !ATLAS_BLOCKED_ROLES.includes(targetRole);
}

export function canAtlasAssignRole(nextRole: UserRole): boolean {
  return ATLAS_ALLOWED_TARGET_ROLES.includes(nextRole);
}

export function canEditUserAccess(
  requester: Pick<UserProfile, "cargo"> | null,
  target: Pick<UserProfile, "cargo"> | null,
  nextRole?: UserRole,
): boolean {
  if (!requester || !target) return false;
  if (requester.cargo === "admin" || requester.cargo === "delegado") return true;
  if (requester.cargo !== "atlas_access") return false;
  if (!canAtlasEditTargetRole(target.cargo)) return false;
  return nextRole ? canAtlasAssignRole(nextRole) : true;
}
