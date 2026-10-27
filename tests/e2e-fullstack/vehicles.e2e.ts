import type { Page, Response } from "@playwright/test";
import { expect, syntheticUser, test } from "./fixtures";

test.setTimeout(60_000);

async function submitLogin(page: Page, login: string, password: string) {
  await page.goto("/login");
  await page.locator("#usuario").fill(login);
  await page.locator("#senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/modulos$/);
}

test("uploads, converts and recovers a synthetic vehicle photo through local Storage", async ({
  page,
}) => {
  const user = syntheticUser({ cargo: "admin", status_autorizacao: "autorizado" });
  await submitLogin(page, user.login, user.password);

  await page.goto("/veiculos/novo");
  await page.getByLabel("Marca").fill("Marca Foto E2E");
  await page.getByLabel("Modelo", { exact: true }).fill("Modelo Foto E2E");
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: /^Próximo/ }).click();
  }

  await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
    name: "veiculo-sintetico.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });

  const uploads: Response[] = [];
  const backendFailures: string[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!response.ok() && /^\/(?:rest|storage)\/v1\//.test(url.pathname)) {
      backendFailures.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
    }
    if (
      response.request().method() === "POST" &&
      url.pathname.startsWith("/storage/v1/object/vehicle-photos/")
    ) {
      uploads.push(response);
    }
  });
  const recoveredPhoto = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.pathname.startsWith("/storage/v1/object/sign/vehicle-photos/")
    );
  });

  await page.getByRole("button", { name: "Salvar veículo" }).click();
  await expect(page).toHaveURL(/\/veiculos\/[0-9a-f-]+$/);
  await Promise.race([
    page.getByRole("heading", { name: "Fotografias" }).waitFor(),
    page.getByText("Não foi possível carregar os detalhes do veículo.").waitFor(),
  ]);
  if (await page.getByText("Não foi possível carregar os detalhes do veículo.").isVisible()) {
    throw new Error(
      `Vehicle details failed after save: ${backendFailures.join(" | ") || "no HTTP failure"}`,
    );
  }
  const photoResponse = await recoveredPhoto;
  expect(photoResponse.ok(), "The signed thumbnail must be retrievable").toBe(true);
  expect(photoResponse.headers()["content-type"]).toContain("image/webp");
  await expect.poll(() => uploads.length).toBe(2);
  expect(
    uploads.every((response) => response.ok()),
    "Both WebP objects must be stored",
  ).toBe(true);

  const gallery = page.locator("section").filter({ hasText: "Fotografias" });
  const image = gallery.getByRole("img");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/vehicle-photos\//);
});

test("opens the vehicle editor and persists changes through the local Data API", async ({
  page,
}) => {
  const user = syntheticUser({ cargo: "admin", status_autorizacao: "autorizado" });
  const marker = Date.now().toString(36);
  const originalModel = `Modelo edição ${marker}`;
  const editedModel = `${originalModel} revisado`;
  await submitLogin(page, user.login, user.password);

  await page.goto("/veiculos/novo");
  await page.getByLabel("Marca").fill("Marca Edição E2E");
  await page.getByLabel("Modelo", { exact: true }).fill(originalModel);
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: /^Próximo/ }).click();
  }
  await page.getByRole("button", { name: "Salvar veículo" }).click();
  await expect(page).toHaveURL(/\/veiculos\/[0-9a-f-]+$/);
  await expect(page.getByText(originalModel, { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Editar" }).click();
  await expect(page).toHaveURL(/\/veiculos\/[0-9a-f-]+\/editar$/);
  await expect(page.getByRole("heading", { name: "Editar Veículo" })).toBeVisible();
  await page.getByLabel("Modelo", { exact: true }).fill(editedModel);
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: /^Próximo/ }).click();
  }
  await page.getByRole("button", { name: "Salvar veículo" }).click();
  await expect(page).toHaveURL(/\/veiculos\/[0-9a-f-]+$/);
  await expect(page.getByText(editedModel, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(editedModel, { exact: true }).first()).toBeVisible();
});
