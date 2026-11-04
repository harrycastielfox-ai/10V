import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "O roteador do SIED restringe o módulo NEXO em viewports móveis menores que 768 px.",
  );
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
  await page.clock.install();
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
  const zoomOut = page.getByRole("button", { name: "Reduzir zoom" });
  await page.clock.fastForward(15_300);
  await expect(zoomOut).toBeDisabled();

  await page.getByRole("button", { name: "Ampliar zoom" }).click();
  await expect(zoomOut).toBeEnabled();

  await page.getByRole("button", { name: `Recolher ramificação de ${memberName}` }).click();
  await expect(page.getByRole("article")).toHaveCount(1);

  await page.clock.fastForward(15_300);
  await expect(zoomOut).toBeDisabled();
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("permanece utilizável em notebook compacto", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.clock.runFor(300);

  await expect(page.getByLabel(/Organograma de /)).toBeVisible();
  await expect(page.getByLabel("Navegação do organograma")).toBeVisible();
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ampliar zoom" })).toBeVisible();
});
