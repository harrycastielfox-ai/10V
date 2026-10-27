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

test("persists an object edit and recovers its synthetic photo from local Storage", async ({
  page,
}) => {
  const user = syntheticUser({ cargo: "admin", status_autorizacao: "autorizado" });
  const marker = Date.now().toString(36);
  const originalDescription = `Objeto sintético ${marker}`;
  const editedDescription = `${originalDescription} revisado`;
  await submitLogin(page, user.login, user.password);

  await page.goto("/objetos/novo");
  await expect(page.getByRole("heading", { name: "Novo Objeto" })).toBeVisible();
  await page.getByLabel("Descrição").fill(originalDescription);
  await page.getByLabel("Marca / Modelo").fill("Marca Objeto E2E");
  await page.getByLabel("Quantidade").fill("2");
  await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
    name: "objeto-sintetico.png",
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
      url.pathname.startsWith("/storage/v1/object/object-photos/")
    ) {
      uploads.push(response);
    }
  });
  const recoveredPhoto = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.pathname.startsWith("/storage/v1/object/sign/object-photos/")
    );
  });

  await page.getByRole("button", { name: "Salvar objeto" }).click();
  await expect(page).toHaveURL(/\/objetos\/[0-9a-f-]+$/);
  await Promise.race([
    page.getByRole("heading", { name: originalDescription }).waitFor(),
    page.getByText("Não foi possível carregar o objeto.").waitFor(),
  ]);
  if (await page.getByText("Não foi possível carregar o objeto.").isVisible()) {
    throw new Error(
      `Object details failed after save: ${backendFailures.join(" | ") || "no HTTP failure"}`,
    );
  }

  const photoResponse = await recoveredPhoto;
  expect(photoResponse.ok(), "The signed object thumbnail must be retrievable").toBe(true);
  expect(photoResponse.headers()["content-type"]).toContain("image/webp");
  await expect.poll(() => uploads.length).toBe(2);
  expect(
    uploads.every((response) => response.ok()),
    "Both object WebP files must be stored",
  ).toBe(true);
  const gallery = page.locator("section").filter({ hasText: "Fotografias" });
  const image = gallery.getByRole("img");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/object-photos\//);

  await page.getByRole("link", { name: "Editar" }).click();
  await expect(page).toHaveURL(/\/objetos\/[0-9a-f-]+\/editar$/);
  await expect(page.getByRole("heading", { name: "Editar Objeto" })).toBeVisible();
  await page.getByLabel("Descrição").fill(editedDescription);
  await page.getByLabel("Quantidade").fill("3");
  await page.getByRole("button", { name: "Salvar objeto" }).click();
  await expect(page).toHaveURL(/\/objetos\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: editedDescription })).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: editedDescription })).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
  await expect(gallery.getByRole("img")).toBeVisible();
});
