import { defineConfig } from "@lovable.dev/vite-tanstack-config";

if (process.env.E2E_FULLSTACK !== "1") {
  throw new Error("The isolated Vite config requires E2E_FULLSTACK=1.");
}
const backend = new URL(process.env.E2E_SUPABASE_URL ?? "");
if (
  backend.protocol !== "http:" ||
  backend.hostname !== "127.0.0.1" ||
  !backend.port ||
  backend.pathname !== "/"
) {
  throw new Error("The isolated Vite config requires a 127.0.0.1 Supabase gateway.");
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
  throw new Error("The isolated Vite config requires a 127.0.0.1 Supabase upstream.");
}
const key = process.env.E2E_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!key) throw new Error("The isolated Vite config requires a local publishable key.");
const port = Number(process.env.E2E_APP_PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("The isolated Vite config requires an unprivileged local application port.");
}
const applicationOrigin = `http://127.0.0.1:${port}`;
const localSupabaseProxy = {
  target: upstream.origin,
  changeOrigin: true,
  secure: false,
  headers: { "cf-connecting-ip": "127.0.0.1" },
};

export default defineConfig({
  envDefine: false,
  nitro: false,
  vite: {
    envDir: false,
    envPrefix: "__CODEX_E2E_NO_AUTO_ENV_",
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(applicationOrigin),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(key),
    },
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      proxy: {
        "/auth": localSupabaseProxy,
        "/functions": localSupabaseProxy,
        "/rest": localSupabaseProxy,
        "/storage": localSupabaseProxy,
      },
    },
  },
});
