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

function isBoMutation(response: Response, method: "POST" | "PATCH") {
  const url = new URL(response.url());
  return response.request().method() === method && url.pathname === "/rest/v1/boletins_ocorrencia";
}

test("creates, links, edits and rejects a duplicate police report through the local Data API", async ({
  page,
}) => {
  let apiKey = "";
  const backendFailures: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/rest/v1/")) {
      apiKey ||= request.headers().apikey ?? "";
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!response.ok() && /^\/(?:rest|storage|functions)\/v1\//.test(url.pathname)) {
      backendFailures.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
    }
  });

  const user = syntheticUser({ cargo: "admin", status_autorizacao: "autorizado" });
  const marker = Date.now().toString(36);
  const inquiryNumber = `E2E-BO-IP-${marker}`;
  const reportNumber = `E2E-BO-${marker}`;
  const originalObservation = `Observação sintética ${marker}`;
  const editedObservation = `${originalObservation} revisada`;
  await submitLogin(page, user.login, user.password);
  await expect
    .poll(() => apiKey, { message: "The browser must use the local Data API" })
    .not.toBe("");

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

  const inquirySetup = await page.evaluate(
    async ({ key, token, numeroPpe }) => {
      const response = await fetch("/rest/v1/inqueritos", {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          numero_ppe: numeroPpe,
          origem_registro: "novo",
          visibilidade: "Público",
          tipo: "Inquérito Policial (IP)",
          tipo_procedimento_normalizado: "IP",
          situacao: "Instaurado",
        }),
      });
      const payload = (await response.json().catch(() => null)) as Array<{ id?: unknown }> | null;
      return { status: response.status, id: payload?.[0]?.id ?? null };
    },
    { key: apiKey, token: accessToken, numeroPpe: inquiryNumber },
  );
  expect(inquirySetup.status).toBe(201);
  expect(typeof inquirySetup.id).toBe("string");

  await page.goto("/bo/novo");
  await expect(page.getByRole("heading", { name: "Novo boletim de ocorrência" })).toBeVisible();
  await page.getByLabel(/Nº do B\.O\./).fill(reportNumber);
  await page.getByLabel(/Status/).selectOption("Em Andamento");
  await page.getByLabel(/Infração penal/).fill(`Infração sintética ${marker}`);
  await page.getByLabel("Diligências pendentes").fill(`Diligência sintética ${marker}`);
  await page.getByLabel("Observação").fill(originalObservation);
  await page.getByLabel("Categoria do local").selectOption({ index: 1 });
  await page.getByLabel("Logradouro").fill("Rua Sintética");
  await page.getByLabel("Número").fill("10");
  await page.getByLabel("Bairro / localidade").fill("Centro");
  await page.getByRole("button", { name: "Vincular a Inquérito" }).click();
  await page.locator('input[placeholder="Digite parte do número PPE..."]').fill(inquiryNumber);
  await page.getByRole("button", { name: new RegExp(inquiryNumber) }).click();
  await expect(page.getByText("Inquérito vinculado")).toBeVisible();

  const createResponsePromise = page.waitForResponse((response) => isBoMutation(response, "POST"));
  await page.getByRole("button", { name: "Salvar B.O." }).first().click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok(), await createResponse.text()).toBe(true);
  const created = (await createResponse.json()) as {
    id: string;
    numero_bo: string;
    inquerito_id: string | null;
  };
  expect(created.numero_bo).toBe(reportNumber);
  expect(created.inquerito_id).toBe(inquirySetup.id);
  await expect(page).toHaveURL(new RegExp(`/bo/${created.id}$`));
  await expect(page.getByRole("heading", { name: `B.O. ${reportNumber}` })).toBeVisible();
  await expect(page.getByText(inquiryNumber, { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/bo/${created.id}/editar$`));
  await expect(page.getByRole("heading", { name: `Editar B.O. ${reportNumber}` })).toBeVisible();
  await page.getByLabel("Observação").fill(editedObservation);
  const updateResponsePromise = page.waitForResponse((response) => isBoMutation(response, "PATCH"));
  await page.getByRole("button", { name: "Salvar B.O." }).first().click();
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.ok(), await updateResponse.text()).toBe(true);
  await expect(page).toHaveURL(new RegExp(`/bo/${created.id}$`));
  await expect(page.locator("p:visible").filter({ hasText: editedObservation })).toBeVisible();
  await page.reload();
  await expect(page.locator("p:visible").filter({ hasText: editedObservation })).toBeVisible();
  expect(backendFailures).toEqual([]);

  await page.goto("/bo/novo");
  await page.getByLabel(/Nº do B\.O\./).fill(reportNumber.toLowerCase());
  await page.getByLabel(/Infração penal/).fill("Tentativa sintética de duplicidade");
  const duplicateResponsePromise = page.waitForResponse((response) =>
    isBoMutation(response, "POST"),
  );
  await page.getByRole("button", { name: "Salvar B.O." }).first().click();
  const duplicateResponse = await duplicateResponsePromise;
  expect(duplicateResponse.status()).toBe(409);
  const duplicatePayload = (await duplicateResponse.json()) as { code?: unknown };
  expect(duplicatePayload.code).toBe("23505");
  await expect(page.getByText("Já existe um B.O. ativo com esse número.")).toBeVisible();
});
