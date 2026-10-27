import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(baseURL).hostname)) {
  throw new Error("The smoke suite requires a loopback application URL.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm dev --host 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          // Never let smoke tests use the production Supabase configured in
          // .env.local. Authenticated/write flows require an isolated backend.
          VITE_SUPABASE_URL: "http://127.0.0.1:54321",
          VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-local-placeholder",
        },
      },
});
