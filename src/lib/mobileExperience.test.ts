import { describe, expect, it } from "vitest";
import {
  getMobileRouteRedirect,
  getPostAuthDestination,
  isMobilePathAllowed,
} from "./mobileExperience";

describe("mobile experience", () => {
  it("opens inquiries after authentication only on mobile", () => {
    expect(getPostAuthDestination(true)).toBe("/inqueritos");
    expect(getPostAuthDestination(false)).toBe("/modulos");
  });

  it.each([
    "/login",
    "/criar-conta",
    "/aguardando-autorizacao",
    "/inqueritos",
    "/inqueritos/case-1",
    "/representacoes",
    "/representacoes/rep-1",
    "/admin/usuarios",
    "/admin/usuarios/user-1",
    "/perfil",
    "/veiculos/todos",
    "/veiculos/motocicletas",
    "/veiculos/vehicle-id",
    "/objetos/todos",
    "/objetos/object-id",
  ])("allows the mobile consultation path %s", (pathname) => {
    expect(isMobilePathAllowed(pathname)).toBe(true);
    expect(getMobileRouteRedirect(pathname, true)).toBeNull();
  });

  it.each([
    "/",
    "/modulos",
    "/alertas",
    "/estatisticas",
    "/auditoria",
    "/localidades",
    "/novo-caso",
    "/inqueritos/case-1/editar",
    "/nova-representacao",
    "/representacoes/rep-1/editar",
  ])("redirects the mobile-only restricted path %s", (pathname) => {
    expect(getMobileRouteRedirect(pathname, true)).toBe("/inqueritos");
    expect(getMobileRouteRedirect(pathname, false)).toBeNull();
  });

  it.each(["/veiculos", "/veiculos/novo", "/veiculos/vehicle-id/editar"])(
    "redirects restricted vehicle path %s to the mobile vehicle list",
    (pathname) => {
      expect(getMobileRouteRedirect(pathname, true)).toBe("/veiculos/todos");
    },
  );

  it.each(["/objetos", "/objetos/novo", "/objetos/object-id/editar"])(
    "redirects restricted object path %s to the mobile object list",
    (pathname) => {
      expect(getMobileRouteRedirect(pathname, true)).toBe("/objetos/todos");
    },
  );
});
