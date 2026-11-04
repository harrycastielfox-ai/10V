import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.clock.install();
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
  await page.clock.runFor(300);
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

test("mantém os três controles dos cartões operacionais", async ({ page }) => {
  const memberName = "Pessoa fictícia BDM 01";
  const cards = page.getByRole("article");
  const initialCardCount = await cards.count();

  await page.getByRole("button", { name: `Recolher ramificação de ${memberName}` }).click();
  await expect(cards).toHaveCount(1);

  await page.getByRole("button", { name: `Expandir ramificação de ${memberName}` }).click();
  await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(initialCardCount);

  await page.getByRole("button", { name: `Abrir dossiê de ${memberName}` }).click();
  await expect(page.getByRole("dialog", { name: `Resumo de ${memberName}` })).toBeVisible();
});

test("recentraliza a árvore a cada 15 segundos sem alterar ramificações", async ({ page }) => {
  const memberName = "Pessoa fictícia BDM 01";
  const stage = page.locator(".nexo-organogram-stage");
  const initialZoom = await stage.getAttribute("data-viewport-zoom");

  await page.getByRole("button", { name: "Ampliar zoom" }).click();
  await expect(stage).not.toHaveAttribute("data-viewport-zoom", initialZoom || "");

  await page.getByRole("button", { name: `Recolher ramificação de ${memberName}` }).click();
  await expect(page.getByRole("article")).toHaveCount(1);

  await page.clock.fastForward(15_300);
  await expect(stage).toHaveAttribute("data-viewport-zoom", initialZoom || "");
  await expect(page.getByRole("article")).toHaveCount(1);
});
