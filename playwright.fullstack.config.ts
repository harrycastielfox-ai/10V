import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

if (process.env.E2E_FULLSTACK !== "1") {
  throw new Error("E2E_FULLSTACK=1 is required for the isolated full-stack suite.");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.E2E_SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("The Playwright process must never receive a Supabase service-role key.");
}

const backend = new URL(process.env.E2E_SUPABASE_URL ?? "");
if (
  backend.protocol !== "http:" ||
  backend.hostname !== "127.0.0.1" ||
  !backend.port ||
  backend.pathname !== "/" ||
  backend.search ||
  backend.hash ||
  backend.username ||
  backend.password
) {
  throw new Error("E2E_SUPABASE_URL must be an exact HTTP 127.0.0.1 loopback origin.");
}
const upstream = new URL(process.env.E2E_SUPABASE_UPSTREAM_URL ?? "");
if (
  upstream.protocol !== "http:" ||
  upstream.hostname !== "127.0.0.1" ||
  !upstream.port ||
  upstream.pathname !== "/" ||
  upstream.search ||
  upstream.hash ||
  upstream.username ||
  upstream.password
) {
  throw new Error("E2E_SUPABASE_UPSTREAM_URL must be an exact HTTP 127.0.0.1 loopback origin.");
}
if (!process.env.E2E_SUPABASE_PUBLISHABLE_KEY?.trim()) {
  throw new Error("E2E_SUPABASE_PUBLISHABLE_KEY is required.");
}

const appPort = Number(process.env.E2E_APP_PORT);
if (!Number.isInteger(appPort) || appPort < 1024 || appPort > 65535) {
  throw new Error("E2E_APP_PORT must be an unprivileged local port.");
}
const users = JSON.parse(process.env.E2E_SYNTHETIC_USERS_JSON ?? "null") as unknown;
if (!Array.isArray(users) || users.length < 2) {
  throw new Error("At least two isolated synthetic users are required.");
}
const baseURL = `http://127.0.0.1:${appPort}`;
const node = JSON.stringify(process.execPath);
const vite = JSON.stringify(resolve("node_modules/vite/bin/vite.js"));
const viteConfig = JSON.stringify(resolve("tests/e2e-fullstack/vite.config.ts"));

export default defineConfig({
  testDir: "./tests/e2e-fullstack",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "fullstack-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `${node} ${vite} --config ${viteConfig}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      E2E_FULLSTACK: "1",
      E2E_APP_PORT: String(appPort),
      E2E_SUPABASE_URL: backend.origin,
      E2E_SUPABASE_UPSTREAM_URL: upstream.origin,
      E2E_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_PUBLISHABLE_KEY,
      E2E_SYNTHETIC_USERS_JSON: process.env.E2E_SYNTHETIC_USERS_JSON ?? "[]",
    },
  },
});
