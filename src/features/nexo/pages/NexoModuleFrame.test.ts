import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  effects: [] as Array<() => (() => void) | void>,
  navigate: vi.fn(),
  getSession: vi.fn(),
  getCurrentProfile: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  // SSR does not run effects; drive the guard's effect explicitly without a DOM.
  useEffect: (effect: () => (() => void) | void) => mocks.effects.push(effect),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  Outlet: () => null,
}));

vi.mock("@/lib/auth", () => ({
  getSession: mocks.getSession,
  getCurrentProfile: mocks.getCurrentProfile,
  logout: mocks.logout,
}));

import NexoModuleFrame from "./NexoModuleFrame";

describe("NexoModuleFrame authentication guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.effects.length = 0;
    mocks.getSession.mockResolvedValue({ user: { id: "synthetic-user" } });
    mocks.getCurrentProfile.mockResolvedValue({
      id: "synthetic-user",
      nome: "Usuário sintético",
      email: "synthetic@example.test",
      login: "synthetic",
      avatar_path: null,
      telefone: null,
      funcao_institucional: null,
      cargo: "admin",
      status_autorizacao: "autorizado",
      can_access_sigiloso: false,
      created_at: "2026-10-25T00:00:00.000Z",
      updated_at: "2026-10-25T00:00:00.000Z",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["getSession", "getCurrentProfile"] as const)(
    "offers login recovery when %s fails instead of keeping the loading screen",
    async (operation) => {
      mocks[operation].mockRejectedValue(new Error("synthetic auth timeout"));
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      renderToString(createElement(NexoModuleFrame));

      mocks.effects[0]();

      await vi.waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith({
          to: "/login",
          search: { erro: "profile_load_failed" },
          replace: true,
        });
      });
    },
  );

  it("does not redirect after unmount when an in-flight auth check fails", async () => {
    let rejectSession!: (reason: Error) => void;
    mocks.getSession.mockReturnValue(
      new Promise((_, reject) => {
        rejectSession = reject;
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderToString(createElement(NexoModuleFrame));
    const cleanup = mocks.effects[0]();

    cleanup?.();
    rejectSession(new Error("synthetic auth failure after unmount"));
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
