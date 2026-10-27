import type { Page } from "@playwright/test";
import { expect, syntheticUser, test } from "./fixtures";

async function submitLogin(page: Page, login: string, password: string) {
  await page.goto("/login");
  await page.locator("#usuario").fill(login);
  await page.locator("#senha").fill(password);
  const loginRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/functions/v1/secure-login" && request.method() === "POST";
  });
  await page.getByRole("button", { name: "Entrar" }).click();
  const request = await loginRequest;
  const expectedOrigin = new URL(page.url()).origin;
  const actualOrigin = new URL(request.url()).origin;
  if (actualOrigin !== expectedOrigin) {
    throw new Error(`secure-login used unexpected API origin ${actualOrigin}`);
  }
  const response = await request.response();
  if (!response) {
    throw new Error(`secure-login request failed (${request.failure()?.errorText ?? "unknown"})`);
  }
  if (!response.ok()) {
    const payload = (await response.json().catch(() => null)) as { code?: unknown } | null;
    const code = typeof payload?.code === "string" ? payload.code : "unknown";
    throw new Error(`secure-login failed with HTTP ${response.status()} (${code})`);
  }
}

test("logs an authorized synthetic administrator in and out through real local Auth", async ({
  page,
}) => {
  const user = syntheticUser({ cargo: "admin", status_autorizacao: "autorizado" });
  await submitLogin(page, user.login, user.password);
  await expect(page).toHaveURL(/\/modulos$/);
  await expect(page.getByRole("heading", { name: /Módulos do Sistema/i })).toBeVisible();
  await page.getByRole("button", { name: /Sair/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("denies a real local session whose synthetic profile is blocked", async ({ page }) => {
  const user = syntheticUser({ status_autorizacao: "bloqueado" });
  await submitLogin(page, user.email, user.password);
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(
    page.getByText("Seu acesso está bloqueado. Procure um administrador do sistema."),
  ).toBeVisible();
});

test("allows an administrator to load synthetic profiles through the real RPC", async ({
  page,
}) => {
  const user = syntheticUser({ cargo: "admin", status_autorizacao: "autorizado" });
  await submitLogin(page, user.email, user.password);
  await expect(page).toHaveURL(/\/modulos$/);

  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Administração de Usuários" })).toBeVisible();
  await expect(page.getByText("4 perfil(is) carregado(s)")).toBeVisible();
  await expect(page.getByText("Administrador Sintético").first()).toBeVisible();
  await expect(page.getByText("Usuário Bloqueado Sintético").first()).toBeVisible();
});

test("denies the administrative area to an authorized member", async ({ page }) => {
  const user = syntheticUser({ cargo: "membro", status_autorizacao: "autorizado" });
  await submitLogin(page, user.login, user.password);
  await expect(page).toHaveURL(/\/modulos$/);

  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
  await expect(page.getByText(/Esta área exige perfil administrativo/)).toBeVisible();
});

test("allows inspection writes only through the transactional RPCs", async ({ page }) => {
  let apiKey = "";
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/rest/v1/")) {
      apiKey ||= request.headers().apikey ?? "";
    }
  });

  const user = syntheticUser({ cargo: "admin", status_autorizacao: "autorizado" });
  await submitLogin(page, user.login, user.password);
  await expect(page).toHaveURL(/\/modulos$/);
  expect(apiKey, "The browser must have used the local Data API").not.toBe("");

  const accessToken = await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const session = JSON.parse(raw) as { access_token?: unknown };
      if (typeof session.access_token === "string") return session.access_token;
    }
    return null;
  });
  expect(accessToken, "A real local Auth session must be present").not.toBeNull();

  const result = await page.evaluate(
    async ({ token, key }) => {
      const request = async (path: string, method: "PATCH" | "POST", body: unknown) => {
        const response = await fetch(path, {
          method,
          headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => null)) as { code?: unknown } | null;
        return { status: response.status, code: payload?.code ?? null };
      };

      return Promise.all([
        request(
          "/rest/v1/vehicle_inspection_versions?id=eq.00000000-0000-4000-8000-000000000000",
          "PATCH",
          { snapshot: { tampered: true } },
        ),
        request("/rest/v1/vehicle_inspection_versions", "POST", {
          inspection_id: "00000000-0000-4000-8000-000000000000",
          version: 99,
          snapshot: { forged: true },
          change_reason: "forged",
          created_by: "00000000-0000-4000-8000-000000000000",
        }),
        request(
          "/rest/v1/vehicle_inspections?id=eq.00000000-0000-4000-8000-000000000000",
          "PATCH",
          { current_version: 99, status: "emitido" },
        ),
      ]);
    },
    { token: accessToken, key: apiKey },
  );

  expect(result).toEqual([
    { status: 403, code: "42501" },
    { status: 403, code: "42501" },
    { status: 403, code: "42501" },
  ]);
});
