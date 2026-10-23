import { describe, expect, it } from "vitest";
import {
  canAssignProtectedInstitutionalFunction,
  canAtlasAssignRole,
  canAtlasEditTargetRole,
  canCreateCases,
  canCreateVehicles,
  canDeleteCases,
  canDeleteVehicles,
  canEditCases,
  canEditUserAccess,
  canEditVehicles,
  canManageNexo,
  canManageUsers,
  canOnlyViewPublicCases,
  canRegisterVehicleMovements,
  canReleaseVehicles,
  canViewAuditoria,
  canViewNexo,
  canViewPrivateCases,
  canViewRepresentacoes,
  canViewVehicles,
  isAdmin,
  isAuthorized,
  isProtectedInstitutionalFunction,
  type UserProfile,
} from "./authz";

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "user-1",
    nome: "Teste",
    email: "teste@example.com",
    login: "teste",
    avatar_path: null,
    funcao_institucional: null,
    cargo: "membro",
    status_autorizacao: "autorizado",
    can_access_sigiloso: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("isAuthorized", () => {
  it("is false for null profile", () => {
    expect(isAuthorized(null)).toBe(false);
  });

  it("is false for pending or blocked users", () => {
    expect(isAuthorized(makeProfile({ status_autorizacao: "aguardando" }))).toBe(false);
    expect(isAuthorized(makeProfile({ status_autorizacao: "bloqueado" }))).toBe(false);
  });

  it("is true only for autorizado", () => {
    expect(isAuthorized(makeProfile({ status_autorizacao: "autorizado" }))).toBe(true);
  });
});

describe("isAdmin", () => {
  it("only admin cargo counts as admin", () => {
    expect(isAdmin(makeProfile({ cargo: "admin" }))).toBe(true);
    expect(isAdmin(makeProfile({ cargo: "delegado" }))).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("canManageUsers", () => {
  it("allows admin and delegado", () => {
    expect(canManageUsers(makeProfile({ cargo: "admin" }))).toBe(true);
    expect(canManageUsers(makeProfile({ cargo: "delegado" }))).toBe(true);
  });

  it("blocks membro, sipi_access and atlas_access", () => {
    expect(canManageUsers(makeProfile({ cargo: "membro" }))).toBe(false);
    expect(canManageUsers(makeProfile({ cargo: "sipi_access" }))).toBe(false);
    expect(canManageUsers(makeProfile({ cargo: "atlas_access" }))).toBe(false);
  });
});

describe("isProtectedInstitutionalFunction", () => {
  it("flags juiz, promotor and delegado as protected", () => {
    expect(isProtectedInstitutionalFunction("juiz")).toBe(true);
    expect(isProtectedInstitutionalFunction("promotor")).toBe(true);
    expect(isProtectedInstitutionalFunction("delegado")).toBe(true);
  });

  it("does not flag other institutional functions", () => {
    expect(isProtectedInstitutionalFunction("escrivao")).toBe(false);
    expect(isProtectedInstitutionalFunction(null)).toBe(false);
    expect(isProtectedInstitutionalFunction(undefined)).toBe(false);
  });
});

describe("canAssignProtectedInstitutionalFunction", () => {
  it("only admin can assign a protected institutional function", () => {
    expect(canAssignProtectedInstitutionalFunction(makeProfile({ cargo: "admin" }))).toBe(true);
    expect(canAssignProtectedInstitutionalFunction(makeProfile({ cargo: "delegado" }))).toBe(false);
    expect(canAssignProtectedInstitutionalFunction(null)).toBe(false);
  });
});

describe("private case visibility", () => {
  it("allows an authorized user only when the individual permission is enabled", () => {
    expect(
      canViewPrivateCases(
        makeProfile({
          cargo: "membro",
          can_access_sigiloso: true,
          status_autorizacao: "autorizado",
        }),
      ),
    ).toBe(true);
  });

  it("does not grant private access based on cargo", () => {
    for (const cargo of ["membro", "sipi_access", "atlas_access", "delegado", "admin"] as const) {
      const profile = makeProfile({ cargo, can_access_sigiloso: false });
      expect(canViewPrivateCases(profile)).toBe(false);
      expect(canOnlyViewPublicCases(profile)).toBe(true);
    }
  });

  it("denies blocked users even when the individual permission is enabled", () => {
    expect(
      canViewPrivateCases(
        makeProfile({ status_autorizacao: "bloqueado", can_access_sigiloso: true }),
      ),
    ).toBe(false);
  });

  it("canOnlyViewPublicCases is the exact negation of canViewPrivateCases", () => {
    for (const cargo of ["membro", "sipi_access", "atlas_access", "delegado", "admin"] as const) {
      const profile = makeProfile({ cargo, can_access_sigiloso: cargo === "sipi_access" });
      expect(canOnlyViewPublicCases(profile)).toBe(!canViewPrivateCases(profile));
    }
  });
});

describe("case management permissions", () => {
  it("unauthorized users cannot create, edit or delete cases", () => {
    const profile = makeProfile({ status_autorizacao: "aguardando" });
    expect(canCreateCases(profile)).toBe(false);
    expect(canEditCases(profile)).toBe(false);
    expect(canDeleteCases(profile)).toBe(false);
  });

  it("membro cargo cannot manage cases even when authorized", () => {
    const profile = makeProfile({ cargo: "membro", status_autorizacao: "autorizado" });
    expect(canCreateCases(profile)).toBe(false);
  });

  it("authorized non-membro roles can manage cases", () => {
    const profile = makeProfile({ cargo: "sipi_access", status_autorizacao: "autorizado" });
    expect(canCreateCases(profile)).toBe(true);
    expect(canEditCases(profile)).toBe(true);
    expect(canDeleteCases(profile)).toBe(true);
  });

  it("null profile can never manage cases", () => {
    expect(canCreateCases(null)).toBe(false);
  });
});

describe("representacoes and auditoria permissions", () => {
  it("membro cannot view representacoes even if authorized", () => {
    expect(canViewRepresentacoes(makeProfile({ cargo: "membro" }))).toBe(false);
  });

  it("only admin and delegado can view auditoria", () => {
    expect(canViewAuditoria(makeProfile({ cargo: "admin" }))).toBe(true);
    expect(canViewAuditoria(makeProfile({ cargo: "delegado" }))).toBe(true);
    expect(canViewAuditoria(makeProfile({ cargo: "atlas_access" }))).toBe(false);
    expect(canViewAuditoria(makeProfile({ cargo: "sipi_access" }))).toBe(false);
  });

  it("auditoria access still requires authorization", () => {
    expect(canViewAuditoria(makeProfile({ cargo: "admin", status_autorizacao: "bloqueado" }))).toBe(
      false,
    );
  });
});

describe("vehicle permissions", () => {
  it("keeps consultation available to every authorized module role", () => {
    expect(canViewVehicles(makeProfile({ cargo: "sipi_access" }))).toBe(true);
    expect(canViewVehicles(makeProfile({ cargo: "atlas_access" }))).toBe(true);
    expect(canViewVehicles(makeProfile({ cargo: "delegado" }))).toBe(true);
    expect(canViewVehicles(makeProfile({ cargo: "admin" }))).toBe(true);
  });

  it("allows operational vehicle writes to SIED, delegado and admin roles", () => {
    for (const cargo of ["sipi_access", "delegado", "admin"] as const) {
      const profile = makeProfile({ cargo });
      expect(canCreateVehicles(profile)).toBe(true);
      expect(canEditVehicles(profile)).toBe(true);
      expect(canRegisterVehicleMovements(profile)).toBe(true);
    }
  });

  it("keeps atlas_access and membro in consultation-only mode", () => {
    for (const cargo of ["atlas_access", "membro"] as const) {
      const profile = makeProfile({ cargo });
      expect(canCreateVehicles(profile)).toBe(false);
      expect(canEditVehicles(profile)).toBe(false);
      expect(canRegisterVehicleMovements(profile)).toBe(false);
    }
  });

  it("reserves release and deletion for delegado or admin", () => {
    expect(canReleaseVehicles(makeProfile({ cargo: "sipi_access" }))).toBe(false);
    expect(canDeleteVehicles(makeProfile({ cargo: "sipi_access" }))).toBe(false);
    expect(canReleaseVehicles(makeProfile({ cargo: "delegado" }))).toBe(true);
    expect(canDeleteVehicles(makeProfile({ cargo: "admin" }))).toBe(true);
  });

  it("denies every mutation while authorization is not active", () => {
    const profile = makeProfile({ cargo: "admin", status_autorizacao: "bloqueado" });
    expect(canCreateVehicles(profile)).toBe(false);
    expect(canEditVehicles(profile)).toBe(false);
    expect(canRegisterVehicleMovements(profile)).toBe(false);
    expect(canReleaseVehicles(profile)).toBe(false);
  });
});

describe("NEXO permissions", () => {
  it("allows only authorized admin and delegado profiles", () => {
    for (const cargo of ["admin", "delegado"] as const) {
      const profile = makeProfile({ cargo });
      expect(canViewNexo(profile)).toBe(true);
      expect(canManageNexo(profile)).toBe(true);
    }
  });

  it("blocks atlas_access and every non-authority profile", () => {
    for (const cargo of ["atlas_access", "sipi_access", "membro"] as const) {
      const profile = makeProfile({ cargo });
      expect(canViewNexo(profile)).toBe(false);
      expect(canManageNexo(profile)).toBe(false);
    }
  });

  it("still requires the profile to be authorized", () => {
    expect(canViewNexo(makeProfile({ cargo: "admin", status_autorizacao: "bloqueado" }))).toBe(
      false,
    );
    expect(canViewNexo(null)).toBe(false);
  });
});

describe("Atlas-scoped role edition", () => {
  it("atlas_access cannot target admin, delegado or another atlas_access account", () => {
    expect(canAtlasEditTargetRole("admin")).toBe(false);
    expect(canAtlasEditTargetRole("delegado")).toBe(false);
    expect(canAtlasEditTargetRole("atlas_access")).toBe(false);
  });

  it("atlas_access can target membro and sipi_access accounts", () => {
    expect(canAtlasEditTargetRole("membro")).toBe(true);
    expect(canAtlasEditTargetRole("sipi_access")).toBe(true);
  });

  it("atlas_access can only assign membro or sipi_access as the next role", () => {
    expect(canAtlasAssignRole("membro")).toBe(true);
    expect(canAtlasAssignRole("sipi_access")).toBe(true);
    expect(canAtlasAssignRole("admin")).toBe(false);
    expect(canAtlasAssignRole("delegado")).toBe(false);
    expect(canAtlasAssignRole("atlas_access")).toBe(false);
  });

  it("canEditUserAccess: admin and delegado can always edit", () => {
    const admin = makeProfile({ cargo: "admin" });
    const target = makeProfile({ cargo: "membro" });
    expect(canEditUserAccess(admin, target, "admin")).toBe(true);
  });

  it("canEditUserAccess: atlas_access is blocked from privileged targets or roles", () => {
    const atlas = makeProfile({ cargo: "atlas_access" });
    const privilegedTarget = makeProfile({ cargo: "delegado" });
    const regularTarget = makeProfile({ cargo: "membro" });
    expect(canEditUserAccess(atlas, privilegedTarget, "membro")).toBe(false);
    expect(canEditUserAccess(atlas, regularTarget, "admin")).toBe(false);
    expect(canEditUserAccess(atlas, regularTarget, "sipi_access")).toBe(true);
  });

  it("canEditUserAccess: everyone else is blocked", () => {
    const membro = makeProfile({ cargo: "membro" });
    const target = makeProfile({ cargo: "membro" });
    expect(canEditUserAccess(membro, target)).toBe(false);
    expect(canEditUserAccess(null, target)).toBe(false);
    expect(canEditUserAccess(membro, null)).toBe(false);
  });
});
