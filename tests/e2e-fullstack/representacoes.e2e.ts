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

function isRepresentacaoMutation(response: Response, method: "POST" | "PATCH") {
  const url = new URL(response.url());
  return response.request().method() === method && url.pathname === "/rest/v1/representacoes";
}

test("creates and edits a final-report representation without the historical HTTP 400", async ({
  page,
}) => {
  const user = syntheticUser({ cargo: "admin", status_autorizacao: "autorizado" });
  const marker = Date.now().toString(36);
  const originalProcess = `E2E-REP-${marker}`;
  const editedProcess = `${originalProcess}-REV`;
  const justification = `Movimentação sintética isolada ${marker}`;
  const backendFailures: string[] = [];

  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!response.ok() && /^\/(?:rest|storage|functions)\/v1\//.test(url.pathname)) {
      backendFailures.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
    }
  });

  await submitLogin(page, user.login, user.password);
  await page.goto("/nova-representacao");
  await expect(
    page.getByRole("heading", { name: "Cadastrar Movimentação Processual" }),
  ).toBeVisible();

  const identification = page.locator("section").filter({ hasText: "Identificação Judicial" });
  await identification.locator("select").first().selectOption("nao");
  await identification.locator("textarea").fill(justification);
  await identification.locator('input[placeholder^="Ex.: 8001619"]').fill(originalProcess);

  const typeSearch = identification.locator('input[role="combobox"]');
  await typeSearch.fill("Relatorio Final");
  await identification.getByRole("option", { name: "Relatorio Final", exact: true }).click();
  await identification.locator('input[type="date"]').fill("2026-10-26");
  await page.getByLabel("Status da movimentação").selectOption({ label: "Aguardando decisao" });

  const createResponsePromise = page.waitForResponse((response) =>
    isRepresentacaoMutation(response, "POST"),
  );
  await page.getByRole("button", { name: "Salvar movimentação" }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok(), await createResponse.text()).toBe(true);
  const created = (await createResponse.json()) as {
    id: string;
    tipo: string | null;
    tipo_normalizado: string | null;
  };
  expect(created.tipo).toBe("Relatorio Final");
  expect(created.tipo_normalizado).toBe("outros");
  await expect(page).toHaveURL(/\/representacoes$/);

  await page.goto(`/representacoes/${created.id}`);
  await expect(page.getByRole("heading", { name: originalProcess, exact: true })).toBeVisible();
  await expect(
    page.locator("dd:visible").filter({ hasText: "Relatorio Final" }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/representacoes/${created.id}/editar$`));
  await expect(page.getByRole("heading", { name: "Editar Movimentação Processual" })).toBeVisible();

  const editIdentification = page.locator("section").filter({ hasText: "Identificação Judicial" });
  await editIdentification
    .locator('input:not([type="date"]):not([role="combobox"])')
    .first()
    .fill(editedProcess);
  const updateResponsePromise = page.waitForResponse((response) =>
    isRepresentacaoMutation(response, "PATCH"),
  );
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.ok(), await updateResponse.text()).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/representacoes/${created.id}$`));
  await expect(page.getByRole("heading", { name: editedProcess, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: editedProcess, exact: true })).toBeVisible();
  expect(backendFailures).toEqual([]);
});
