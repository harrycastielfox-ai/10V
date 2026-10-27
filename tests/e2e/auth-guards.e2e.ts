import type { Page } from "@playwright/test";
import { expect, installApiIsolation, test } from "./fixtures";

// Browser recovery tests only: this synthetic, unsigned session and intercepted
// API responses are not evidence of a real Supabase login or authorization.
async function syntheticSession(page: Page, expired = false) {
  const userId = "00000000-0000-4000-8000-000000000001";
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: userId,
    aud: "authenticated",
    role: "authenticated",
    iat: now,
    exp: expired ? now - 60 : now + 3600,
  })}.c3ludGhldGlj`;
  await page.addInitScript(
    (session) => localStorage.setItem("sb-127-auth-token", JSON.stringify(session)),
    {
      access_token: token,
      refresh_token: "synthetic-refresh-token",
      expires_at: expired ? now - 60 : now + 3600,
      expires_in: expired ? -60 : 3600,
      token_type: "bearer",
      user: {
        id: userId,
        aud: "authenticated",
        role: "authenticated",
        email: "synthetic@example.test",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {},
        created_at: "2026-10-25T00:00:00Z",
      },
    },
  );
  await page.route("http://127.0.0.1:54321/**", (route) => {
    // Leave refresh pending to exercise the application's bounded auth timeout.
    // Closing the isolated browser context discards this synthetic request.
    if (expired && new URL(route.request().url()).pathname === "/auth/v1/token") return;
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "XX000", message: "synthetic profile service failure" }),
    });
  });
}

test("recovers a failed NEXO profile check in the browser", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "O workspace NEXO é restrito a desktop pela política atual.",
  );
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await syntheticSession(page);

  await page.goto("/nexo");

  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(
    page.getByText(/Não foi possível validar sua sessão ou carregar seu perfil/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test("recovers an expired session when refresh stalls on the pending-authorization page", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await syntheticSession(page, true);

  await page.goto("/aguardando-autorizacao");

  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(
    page.getByText(/Não foi possível validar sua sessão ou carregar seu perfil/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test("blocks an API outside the local backend before browser transport", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const blockedOrigins = await installApiIsolation(context);
    const page = await context.newPage();
    await page.goto("about:blank");
    const requestFailed = await page.evaluate(async () => {
      try {
        // Reserved .test domain: no real service or production data is involved.
        await fetch("https://unexpected-backend.example.test/rest/v1/synthetic");
        return false;
      } catch {
        return true;
      }
    });
    expect(requestFailed).toBe(true);
    expect(blockedOrigins).toEqual(["https://unexpected-backend.example.test"]);
  } finally {
    await context.close();
  }
});
