import { expect, test as base, type BrowserContext } from "@playwright/test";

export async function installApiIsolation(context: BrowserContext) {
  const blockedOrigins: string[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const isBackendApi = /^\/(?:auth|rest|storage|functions)\/v1(?:\/|$)/.test(url.pathname);
    if (isBackendApi && url.origin !== "http://127.0.0.1:54321") {
      blockedOrigins.push(url.origin);
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });
  return blockedOrigins;
}

export const test = base.extend<{ apiIsolation: void }>({
  apiIsolation: [
    async ({ context }, use) => {
      const blockedOrigins = await installApiIsolation(context);
      await use();
      expect(
        blockedOrigins,
        "Smoke tests attempted an API outside the isolated local backend",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
