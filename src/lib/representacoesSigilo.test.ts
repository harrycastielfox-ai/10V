import { describe, expect, it } from "vitest";
import { canAccessSigilosa, isRepresentacaoSigilosa } from "./representacoesSigilo";
import type { RepresentacaoRecord } from "@/lib/repositories/representacoesRepository";

describe("isRepresentacaoSigilosa", () => {
  it("is false for null/undefined", () => {
    expect(isRepresentacaoSigilosa(null)).toBe(false);
    expect(isRepresentacaoSigilosa(undefined)).toBe(false);
  });

  it("prefers the normalized boolean field when present", () => {
    expect(
      isRepresentacaoSigilosa({
        pedido_sigiloso_normalizado: true,
        pedido_sigiloso: "nao",
      } as Partial<RepresentacaoRecord>),
    ).toBe(true);
  });

  it("accepts common truthy aliases in the raw text field", () => {
    for (const value of ["sim", "S", "true", "1", "sigilosa", "Sigiloso", "yes"]) {
      expect(isRepresentacaoSigilosa({ pedido_sigiloso: value })).toBe(true);
    }
  });

  it("is false for empty or negative values", () => {
    expect(isRepresentacaoSigilosa({ pedido_sigiloso: "nao" })).toBe(false);
    expect(isRepresentacaoSigilosa({ pedido_sigiloso: "" })).toBe(false);
    expect(isRepresentacaoSigilosa({})).toBe(false);
  });
});

describe("canAccessSigilosa", () => {
  it("denies access with no profile or no individual permission", () => {
    expect(canAccessSigilosa(null)).toBe(false);
    expect(canAccessSigilosa({})).toBe(false);
  });

  it("allows any authorized profile with the individual permission enabled", () => {
    expect(
      canAccessSigilosa({
        cargo: "membro",
        status_autorizacao: "autorizado",
        can_access_sigiloso: true,
      }),
    ).toBe(true);
  });

  it("does not grant sigilo merely because of the role", () => {
    for (const cargo of ["admin", "delegado", "atlas_access"]) {
      expect(
        canAccessSigilosa({
          cargo,
          status_autorizacao: "autorizado",
          can_access_sigiloso: false,
        }),
      ).toBe(false);
    }
  });

  it("denies a blocked profile even when its individual permission is enabled", () => {
    expect(
      canAccessSigilosa({
        cargo: "admin",
        status_autorizacao: "bloqueado",
        can_access_sigiloso: true,
      }),
    ).toBe(false);
  });
});
