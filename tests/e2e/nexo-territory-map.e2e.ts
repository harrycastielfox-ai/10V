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
  await map.getByRole("button", { name: "Zoom in" }).click();
  const automaticStatus = page.getByRole("status").filter({
    hasText: "Mapa recentralizado automaticamente",
  });
  await expect(automaticStatus).toHaveCount(0);

  await page.clock.fastForward(30_000);
  await expect(automaticStatus).toBeVisible();
});
