import type { Page } from "@playwright/test";
import { expect, syntheticUser, test } from "./fixtures";

test.setTimeout(90_000);

async function submitLogin(page: Page, login: string, password: string) {
  await page.goto("/login");
  await page.locator("#usuario").fill(login);
  await page.locator("#senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/modulos$/);
}

async function advanceInspectionForm(page: Page) {
  for (let step = 1; step < 6; step += 1) {
    await page.getByRole("button", { name: /^Avançar para / }).click();
  }
}

test("persists an inspection revision and signed PDF through the real local UI", async ({
  page,
  context,
}) => {
  const user = syntheticUser({ cargo: "admin", status_autorizacao: "autorizado" });
  await submitLogin(page, user.login, user.password);

  await page.goto("/veiculos/novo");
  await expect(page.getByRole("heading", { name: "Novo Veículo" })).toBeVisible();
  await page.getByLabel("Marca").fill("Marca E2E");
  await page.getByLabel("Modelo", { exact: true }).fill("Modelo Vistoria");
  await page.getByLabel("Cor").fill("Azul sintético");
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: /^Próximo/ }).click();
  }
  await page.getByRole("button", { name: "Salvar veículo" }).click();
  await expect(page).toHaveURL(/\/veiculos\/[0-9a-f-]+$/);
  const vehicleId = new URL(page.url()).pathname.split("/").at(-1);
  expect(vehicleId, "The created vehicle URL must expose its identifier").toMatch(
    /^[0-9a-f-]{36}$/,
  );

  await page.goto("/vistorias/nova");
  await expect(page.getByRole("heading", { name: "Iniciar vistoria técnica" })).toBeVisible();
  await page.getByLabel("Veículo cadastrado").selectOption(vehicleId);
  await advanceInspectionForm(page);
  await page.getByRole("button", { name: "Concluir vistoria" }).click();
  await expect(page).toHaveURL(/\/vistorias$/);

  let row = page
    .locator('tr[aria-label^="Abrir vistoria"]')
    .filter({ hasText: "Marca E2E Modelo Vistoria" });
  await expect(row).toContainText("Vistoria v1");
  await row.click();
  await expect(page.getByText("Versão 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page).toHaveURL(/\/vistorias\/[0-9a-f-]+\/editar$/);
  await expect(
    page.getByRole("heading", { name: "Atualizar relatório de vistoria" }),
  ).toBeVisible();
  await advanceInspectionForm(page);
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await expect(page).toHaveURL(/\/vistorias$/);

  await page.reload();
  row = page
    .locator('tr[aria-label^="Abrir vistoria"]')
    .filter({ hasText: "Marca E2E Modelo Vistoria" });
  await expect(row).toContainText("Vistoria v2");
  await row.click();
  await page.getByRole("button", { name: "Abrir detalhes" }).click();
  await expect(page).toHaveURL(/\/vistorias\/[0-9a-f-]+$/);
  await expect(page.getByText("Versão 2", { exact: true }).first()).toBeVisible();

  const pdfUpload = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.startsWith("/storage/v1/object/vehicle-inspection-pdfs/") &&
      response.request().method() === "POST"
    );
  });
  await page.getByLabel("Anexar PDF assinado").setInputFiles({
    name: "vistoria-sintetica.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"),
  });
  expect((await pdfUpload).ok(), "The PDF must be accepted by local Storage").toBe(true);
  await expect(page.getByText("PDF assinado", { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("Versão 2", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("PDF assinado", { exact: true }).first()).toBeVisible();
  const popupPromise = context.waitForEvent("page");
  const signedPdfResponse = context.waitForEvent(
    "response",
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname.startsWith(
        "/storage/v1/object/sign/vehicle-inspection-pdfs/",
      ),
  );
  await page.getByRole("button", { name: "Ver PDF" }).click();
  const [popup, response] = await Promise.all([popupPromise, signedPdfResponse]);
  expect(response.ok(), "The signed URL must recover the private PDF").toBe(true);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  await popup.close();
});
