import type { Page, Response } from "@playwright/test";
import { expect, syntheticUser, test } from "./fixtures";

test.setTimeout(90_000);

async function submitLogin(page: Page, login: string, password: string) {
  await page.goto("/login");
  await page.locator("#usuario").fill(login);
  await page.locator("#senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/modulos$/);
}

function isDataApiMutation(response: Response, method: string, path: string) {
  const url = new URL(response.url());
  return response.request().method() === method && url.pathname === path;
}

test("creates and edits an inquiry with a person through the real relationship RPC", async ({
  page,
}) => {
  const user = syntheticUser({ cargo: "admin", status_autorizacao: "autorizado" });
  const marker = Date.now().toString(36);
  const ppe = `E2E-IP-${marker}`;
  const originalPerson = `Investigado sintético ${marker}`;
  const editedPerson = `${originalPerson} revisado`;
  const backendFailures: string[] = [];
  const createResponses: Response[] = [];
  const updateResponses: Response[] = [];
  const replacePeopleResponses: Response[] = [];

  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!response.ok() && /^\/(?:rest|storage|functions)\/v1\//.test(url.pathname)) {
      backendFailures.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
    }
    if (isDataApiMutation(response, "POST", "/rest/v1/inqueritos")) {
      createResponses.push(response);
    }
    if (isDataApiMutation(response, "PATCH", "/rest/v1/inqueritos")) {
      updateResponses.push(response);
    }
    if (isDataApiMutation(response, "POST", "/rest/v1/rpc/replace_inquerito_pessoas")) {
      replacePeopleResponses.push(response);
    }
  });

  await submitLogin(page, user.login, user.password);
  await page.goto("/novo-caso");

  const identification = page.locator("section").filter({
    has: page.getByRole("heading", { name: "1. Identificação do Procedimento" }),
  });
  await identification.locator('input[placeholder^="Ex.: 001/"]').fill(ppe);
  await identification.locator("select").nth(0).selectOption("novo");
  await identification.locator("select").nth(1).selectOption("Público");
  await identification.locator("select").nth(2).selectOption("Inquérito Policial (IP)");
  await page.getByRole("button", { name: /^Próximo/ }).click();

  const fact = page.locator("section").filter({
    has: page.getByRole("heading", { name: "2. O Fato" }),
  });
  const syntheticClassification = `Classificação sintética ${marker}`;
  await fact
    .locator('input[placeholder="Busque ou crie uma tipificação"]')
    .fill(syntheticClassification);
  await fact.getByRole("button", { name: "Criar tag" }).click();
  await expect(
    fact.getByRole("button", { name: `Remover tag ${syntheticClassification}` }),
  ).toBeVisible();
  await fact.locator('input[placeholder="Busque ou crie uma gravidade"]').fill("Patrimonial");
  await fact.getByRole("option", { name: "Patrimonial", exact: true }).click();
  await fact
    .locator('textarea[placeholder^="Registre, de forma objetiva"]')
    .fill(`Fato inteiramente sintético para validação isolada ${marker}.`);
  await page.getByRole("button", { name: /^Próximo/ }).click();

  const location = page.locator("section").filter({
    has: page.getByRole("heading", { name: "3. Local e Motivação" }),
  });
  await location.locator('input[placeholder^="Informe ou selecione um bairro"]').fill("Centro");
  await location.locator('input[placeholder="Ex.: Itabela"]').fill("Itabela");
  await location.locator("select").selectOption("Não");
  await page.getByRole("button", { name: /^Próximo/ }).click();

  await page.getByRole("button", { name: "Adicionar pessoa", exact: true }).click();
  const personDialog = page.getByRole("dialog", { name: "Adicionar pessoa" });
  await personDialog.getByLabel("Papel *").selectOption("autor_investigado");
  await personDialog.getByLabel("Nome *").fill(originalPerson);
  await personDialog.getByLabel("Autoria").selectOption("true");
  await personDialog.getByLabel("Situação prisional").selectOption("false");
  await personDialog.getByRole("button", { name: "Adicionar pessoa", exact: true }).click();
  await expect(page.getByText(originalPerson, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Próximo/ }).click();

  await expect(page.getByRole("button", { name: "Remover tag Instaurado" })).toBeVisible();
  await page.getByRole("button", { name: /^Próximo/ }).click();
  await expect(page.getByRole("heading", { name: "6. Revisar e Registrar" })).toBeVisible();

  await page.getByRole("button", { name: "Registrar Inquérito" }).click();
  await expect.poll(() => createResponses.length).toBe(1);
  await expect.poll(() => replacePeopleResponses.length).toBe(1);
  const createResponse = createResponses[0];
  const createPeopleResponse = replacePeopleResponses[0];
  expect(createResponse.ok(), await createResponse.text()).toBe(true);
  expect(createPeopleResponse.ok(), await createPeopleResponse.text()).toBe(true);
  const created = (await createResponse.json()) as { id: string; numero_ppe: string | null };
  expect(created.numero_ppe).toBe(ppe);
  await expect(page).toHaveURL(new RegExp(`/inqueritos/${created.id}$`));
  await expect(page.getByRole("heading", { name: ppe, exact: true })).toBeVisible();
  await expect(page.getByText(originalPerson, { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/inqueritos/${created.id}/editar$`));
  await expect(page.getByRole("heading", { name: "Editar Procedimento Policial" })).toBeVisible();
  await page.getByTitle(`Editar ${originalPerson}`).click();
  const editPersonDialog = page.getByRole("dialog", { name: "Editar pessoa" });
  await editPersonDialog.getByLabel("Nome *").fill(editedPerson);
  await editPersonDialog.getByRole("button", { name: "Salvar alterações" }).click();

  await page.getByRole("button", { name: "Salvar procedimento" }).click();
  await expect.poll(() => updateResponses.length).toBe(1);
  await expect.poll(() => replacePeopleResponses.length).toBe(2);
  const updateResponse = updateResponses[0];
  const updatePeopleResponse = replacePeopleResponses[1];
  expect(updateResponse.ok(), await updateResponse.text()).toBe(true);
  expect(updatePeopleResponse.ok(), await updatePeopleResponse.text()).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/inqueritos/${created.id}$`));
  await expect(page.getByRole("heading", { name: ppe, exact: true })).toBeVisible();
  await expect(page.getByText(editedPerson, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(editedPerson, { exact: true }).first()).toBeVisible();
  expect(backendFailures).toEqual([]);
});
