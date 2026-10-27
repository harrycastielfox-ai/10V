import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUserProfile } from "@/lib/auth";

const mocks = vi.hoisted(() => ({
  effects: [] as Array<() => (() => void) | void>,
  navigate: vi.fn(),
  getSession: vi.fn(),
  getCurrentProfile: vi.fn(),
  logout: vi.fn(),
  setInterval: vi.fn(),
  clearInterval: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  // Drive the route's effect explicitly without a browser or external auth.
  useEffect: (effect: () => (() => void) | void) => mocks.effects.push(effect),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/auth", () => ({
  getSession: mocks.getSession,
  getCurrentProfile: mocks.getCurrentProfile,
  logout: mocks.logout,
}));

import { Route } from "./aguardando-autorizacao";

const pendingProfile: CurrentUserProfile = {
  id: "synthetic-user",
  nome: "Usuário sintético",
  email: "synthetic@example.test",
  login: "synthetic",
  avatar_path: null,
  telefone: null,
  funcao_institucional: null,
  cargo: "membro",
  status_autorizacao: "aguardando",
  can_access_sigiloso: false,
  created_at: "2026-10-25T00:00:00.000Z",
  updated_at: "2026-10-25T00:00:00.000Z",
};
const session = { user: { id: pendingProfile.id } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function startVerification() {
  renderToString(createElement(Route.options.component!));
  return mocks.effects[0]();
}

const flushAsyncWork = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("pending authorization checks", () => {
  let intervalTick: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.effects.length = 0;
    mocks.getSession.mockResolvedValue(session);
    mocks.getCurrentProfile.mockResolvedValue(pendingProfile);
    mocks.setInterval.mockImplementation((tick: () => void) => {
      intervalTick = tick;
      return 27;
    });
    vi.stubGlobal("window", {
      setInterval: mocks.setInterval,
      clearInterval: mocks.clearInterval,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(["getSession", "getCurrentProfile"] as const)(
    "recovers through login when %s rejects",
    async (operation) => {
      mocks[operation].mockRejectedValue(new Error("synthetic auth timeout"));
      const cleanup = startVerification();

      try {
        await vi.waitFor(() => {
          expect(mocks.navigate).toHaveBeenCalledWith({
            to: "/login",
            search: { erro: "profile_load_failed" },
            replace: true,
          });
        });
        expect(mocks.logout).not.toHaveBeenCalled();
      } finally {
        cleanup?.();
      }
    },
  );

  it.each(["getSession", "getCurrentProfile"] as const)(
    "does not navigate when %s rejects after unmount",
    async (operation) => {
      const operationResult = deferred<never>();
      mocks[operation].mockReturnValue(operationResult.promise);
      const cleanup = startVerification();
      await flushAsyncWork();

      cleanup?.();
      operationResult.reject(new Error("synthetic auth failure after unmount"));
      await flushAsyncWork();

      expect(mocks.navigate).not.toHaveBeenCalled();
      expect(mocks.clearInterval).toHaveBeenCalledWith(27);
    },
  );

  it.each(["getSession", "getCurrentProfile"] as const)(
    "waits for the pending %s check before starting another interval check",
    async (operation) => {
      const operationResult = deferred<typeof session | CurrentUserProfile>();
      mocks[operation].mockReturnValue(operationResult.promise);
      const cleanup = startVerification();
      await flushAsyncWork();

      try {
        intervalTick();
        await flushAsyncWork();
        expect(mocks.getSession).toHaveBeenCalledTimes(1);
        expect(mocks.setInterval).toHaveBeenCalledWith(expect.any(Function), 10_000);

        operationResult.resolve(operation === "getSession" ? session : pendingProfile);
        await flushAsyncWork();
        intervalTick();
        await flushAsyncWork();

        expect(mocks.getSession).toHaveBeenCalledTimes(2);
        expect(mocks.navigate).not.toHaveBeenCalled();
      } finally {
        operationResult.resolve(operation === "getSession" ? session : pendingProfile);
        cleanup?.();
        await flushAsyncWork();
      }
    },
  );
});
