import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("http://127.0.0.1:54321/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"message":"e2e backend offline"}',
    }),
  );
});

test("recentraliza o mapa após 30 segundos mesmo com interação", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview/nexo");
  await page.getByRole("button", { name: "Facções", exact: true }).click();

  await page.clock.install();
  await page
    .getByRole("button", { name: /^Abrir dossiê de / })
    .first()
    .click();

  const map = page.getByLabel("Mapa de ruas para marcação territorial");
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute("data-map-center", "-16.575000,-39.559000");
  await expect(map).toHaveAttribute("data-map-zoom", "15");
  await map.getByRole("button", { name: "Zoom in" }).click();
  await expect(map).toHaveAttribute("data-map-zoom", "16");
  const automaticStatus = page.getByRole("status").filter({
    hasText: "Mapa recentralizado automaticamente",
  });
  await expect(automaticStatus).toHaveCount(0);

  await page.clock.fastForward(30_000);
  await expect(automaticStatus).toBeVisible();
  await expect(map).toHaveAttribute("data-map-center", "-16.575000,-39.559000");
  await expect(map).toHaveAttribute("data-map-zoom", "15");
});

test("mantém o mapa de desenho parado e desmonta o temporizador com segurança", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview/nexo");
  await page.getByRole("button", { name: "Facções", exact: true }).click();

  await page.clock.install();
  await page
    .getByRole("button", { name: /^Abrir dossiê de / })
    .first()
    .click();
  await page.getByRole("button", { name: "Adicionar local" }).click();

  const dialog = page.getByRole("dialog", { name: "Marcar área de influência" });
  const drawingMap = dialog.getByLabel("Mapa de ruas para marcação territorial");
  await expect(drawingMap).toHaveAttribute("data-map-zoom", "15");
  await drawingMap.getByRole("button", { name: "Zoom in" }).click();
  await expect(drawingMap).toHaveAttribute("data-map-zoom", "16");

  await page.clock.fastForward(90_000);
  await expect(drawingMap).toHaveAttribute("data-map-zoom", "16");
  await dialog.getByRole("button", { name: "Fechar" }).click();
  await expect(dialog).toHaveCount(0);

  await page.clock.fastForward(30_000);
  expect(pageErrors).toEqual([]);
});

test("usa cadastro territorial enxuto e permite concluir várias áreas independentes", async ({
  page,
}) => {
  await page.goto("/preview/nexo");
  await page.getByRole("button", { name: "Facções", exact: true }).click();
  await page
    .getByRole("button", { name: /^Abrir dossiê de / })
    .first()
    .click();

  const addLocal = page.getByRole("button", { name: "Adicionar local" }).first();
  await expect(addLocal).toHaveClass(/bg-emerald-600/);
  await addLocal.click();

  const dialog = page.getByRole("dialog", { name: "Marcar área de influência" });
  await expect(dialog.getByLabel("Bairro ou localidade")).toBeVisible();
  await expect(dialog.getByLabel("Categoria operacional")).toBeVisible();
  await expect(dialog.getByLabel("Classificação")).toBeVisible();
  await expect(dialog.getByLabel("Organização relacionada")).toBeVisible();
  await expect(dialog.getByLabel("Link do Google Maps")).toBeVisible();
  await expect(dialog.getByLabel("Observações")).toBeVisible();
  await expect(dialog.getByLabel("Logradouro")).toHaveCount(0);
  await expect(dialog.getByLabel("Confiança (0–100)")).toHaveCount(0);

  const map = dialog.getByLabel("Mapa de ruas para marcação territorial");
  const drawTriangle = async (coordinates: [number, number][]) => {
    await map.scrollIntoViewIfNeeded();
    const box = await map.boundingBox();
    if (!box) throw new Error("Mapa territorial sem dimensões para o teste");
    for (const [x, y] of coordinates) {
      await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    }
  };
  await drawTriangle([
    [0.2, 0.35],
    [0.3, 0.35],
    [0.25, 0.48],
  ]);
  await dialog.getByRole("button", { name: "Concluir área e iniciar outra" }).click();
  await expect(dialog.getByText("1 área(s) concluída(s)", { exact: false })).toBeVisible();

  await drawTriangle([
    [0.62, 0.35],
    [0.72, 0.35],
    [0.67, 0.48],
  ]);
  await dialog.getByRole("button", { name: "Concluir área e iniciar outra" }).click();
  await expect(dialog.getByText("2 área(s) concluída(s)", { exact: false })).toBeVisible();
  await expect(
    dialog.getByLabel("Áreas concluídas").getByText("Área 1", { exact: false }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Áreas concluídas").getByText("Área 2", { exact: false }),
  ).toBeVisible();
});
