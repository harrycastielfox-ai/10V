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

test("abre o organograma em tela cheia e permite sair pelo X ou Esc", async ({ page }) => {
  const organogram = page.getByLabel(/Organograma de /);
  const openFullscreen = page.getByRole("button", {
    name: "Abrir organograma em tela cheia",
  });

  await openFullscreen.click();
  await expect(organogram).toHaveClass(/is-fullscreen/);
  await expect(page.getByRole("button", { name: "Fechar tela cheia" })).toBeVisible();

  await page.getByRole("button", { name: "Fechar tela cheia" }).click();
  await expect(organogram).not.toHaveClass(/is-fullscreen/);

  await openFullscreen.click();
  await expect(organogram).toHaveClass(/is-fullscreen/);
  await page.keyboard.press("Escape");
  await expect(organogram).not.toHaveClass(/is-fullscreen/);
});

test("permanece utilizável em notebook compacto", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.clock.runFor(300);

  await expect(page.getByLabel(/Organograma de /)).toBeVisible();
  await expect(page.getByLabel("Navegação do organograma")).toBeVisible();
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ampliar zoom" })).toBeVisible();
});

test("deixa a roda do mouse rolar a página fora da tela cheia", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  const dossier = page.getByRole("dialog", { name: /^Dossiê de / });
  await dossier.evaluate((element) => element.scrollTo(0, 0));
  const tree = page.getByLabel(/^Árvore do organograma de /);
  const stage = page.locator(".nexo-organogram-stage");
  await page.getByRole("button", { name: "Ajustar à tela" }).click();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await dossier.evaluate((element) => element.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const box = await tree.boundingBox();
  expect(box).not.toBeNull();

  const initialScroll = await dossier.evaluate((element) => element.scrollTop);
  const initialZoom = await stage.getAttribute("data-viewport-zoom");
  await page.mouse.move(box!.x + box!.width / 2, Math.min(620, box!.y + 220));
  await page.mouse.wheel(0, 500);
  await page.evaluate(() => new Promise(requestAnimationFrame));

  await expect
    .poll(() => dossier.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialScroll);
  expect(await stage.getAttribute("data-viewport-zoom")).toBe(initialZoom);

  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -500);
  await page.keyboard.up("Control");
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(await stage.getAttribute("data-viewport-zoom")).toBe(initialZoom);
});
