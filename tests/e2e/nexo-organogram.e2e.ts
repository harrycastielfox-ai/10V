import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("http://127.0.0.1:54321/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"message":"e2e backend offline"}',
    }),
  );
  await page.goto("/preview/nexo");
  await page.getByRole("button", { name: "Facções", exact: true }).click();
  await page
    .getByRole("button", { name: /^Abrir dossiê de / })
    .first()
    .click();
  await page.getByRole("button", { name: "Organograma", exact: true }).click();
});

test("registra a cidade de atuação pelo gerenciamento do cartão", async ({ page }) => {
  const memberName = "Pessoa fictícia BDM 01";
  await page.getByRole("button", { name: `Gerenciar posição de ${memberName}` }).click();

  await page.getByLabel("Cidade de atuação").fill("Eunápolis");
  await page.getByLabel("UF de atuação").fill("ba");
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  const card = page.getByRole("article", { name: new RegExp(memberName) });
  await expect(card).toContainText("Líder · Eunápolis/BA");
});
