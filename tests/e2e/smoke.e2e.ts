import { expect, test } from "./fixtures";
import { onePagePdf } from "../support/syntheticPdf";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.error(`[browser] ${error.message}`));
  // The smoke suite is deliberately backend-independent. This returns a
  // deterministic offline response if the login screen probes local Supabase.
  await page.route("http://127.0.0.1:54321/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"message":"e2e backend offline"}',
    }),
  );
});

test("renders an accessible login without horizontal overflow", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "SIED" })).toBeVisible();
  await expect(page.getByLabel("E-mail ou login")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  await expect(page.getByRole("link", { name: "Recuperar senha" })).toHaveAttribute(
    "rel",
    /noopener/,
  );

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("redirects an unauthenticated visitor away from a protected route", async ({ page }) => {
  await page.goto("/modulos");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("handles an unavailable authentication service without exposing credentials", async ({
  page,
}) => {
  const syntheticPassword = "senha-sintetica-e2e";

  await page.goto("/login");
  await page.getByLabel("E-mail ou login").fill("usuario.sintetico");
  await page.getByLabel("Senha", { exact: true }).fill(syntheticPassword);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(
    page.getByText(
      "O serviço de login está temporariamente indisponível. Tente novamente em instantes.",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator("body")).not.toContainText(syntheticPassword);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
});

test("loads the NEXO PDF engine on demand in the browser", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "A política atual restringe o workspace NEXO a viewport desktop.",
  );

  await page.goto("/preview/nexo");
  await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
  await page.getByRole("button", { name: /Anexo PDF/ }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: "sintetico.pdf",
    mimeType: "application/pdf",
    buffer: onePagePdf(),
  });

  await expect(page.getByRole("heading", { name: "sintetico.pdf" })).toBeVisible();
  await expect(page.getByText(/1 página\(s\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Revisar no cadastro (1 PDF)" })).toBeEnabled();
});
