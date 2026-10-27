import { expect, test } from "./fixtures";

test("the Chromium page can reach Supabase through the isolated same-origin proxy", async ({
  page,
}) => {
  await page.goto("/login");
  const applicationOrigin = new URL(page.url()).origin;
  const result = await page.evaluate(async (url) => {
    try {
      const response = await fetch(`${url}/functions/v1/secure-login`, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
      return { status: response.status, error: null };
    } catch (error) {
      return {
        status: 0,
        error: error instanceof Error ? error.name : "UnknownError",
      };
    }
  }, applicationOrigin);

  expect(result).toEqual({ status: 401, error: null });
});
