import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

const seedModule = new URL("../../scripts/e2e-local/seed.mjs", import.meta.url);

async function fakeSupabase(t) {
  const requests = [];
  let sequence = 1;
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      if (req.url === "/auth/v1/admin/users" && req.method === "POST") {
        const input = JSON.parse(body);
        const suffix = String(sequence++).padStart(12, "0");
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            id: `00000000-0000-4000-8000-${suffix}`,
            aud: "authenticated",
            role: "authenticated",
            email: input.email,
            email_confirmed_at: "2026-10-25T00:00:00Z",
            app_metadata: { provider: "email", providers: ["email"] },
            user_metadata: input.user_metadata,
            identities: [],
            created_at: "2026-10-25T00:00:00Z",
            updated_at: "2026-10-25T00:00:00Z",
            is_anonymous: false,
          }),
        );
        return;
      }
      if (req.url === "/rest/v1/rpc/e2e_prepare_synthetic_profile" && req.method === "POST") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("null");
        return;
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "unexpected local test endpoint" }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => server.close());
  return { url: `http://127.0.0.1:${server.address().port}`, requests };
}

test("seeds four synthetic role/status profiles through the real SDK boundary", async (t) => {
  const local = await fakeSupabase(t);
  const { seedLocalSupabase } = await import(seedModule);
  const serviceRoleKey = "local-service-role-never-returned";
  const users = await seedLocalSupabase({
    apiUrl: local.url,
    serviceRoleKey,
    runId: "run12345",
  });
  assert.deepEqual(
    users.map(({ password: _password, ...user }) => user),
    [
      {
        id: "00000000-0000-4000-8000-000000000001",
        email: "admin.run12345@example.test",
        login: "admin.run12345",
        cargo: "admin",
        status_autorizacao: "autorizado",
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        email: "delegado.run12345@example.test",
        login: "delegado.run12345",
        cargo: "delegado",
        status_autorizacao: "autorizado",
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        email: "membro.run12345@example.test",
        login: "membro.run12345",
        cargo: "membro",
        status_autorizacao: "autorizado",
      },
      {
        id: "00000000-0000-4000-8000-000000000004",
        email: "bloqueado.run12345@example.test",
        login: "bloqueado.run12345",
        cargo: "membro",
        status_autorizacao: "bloqueado",
      },
    ],
  );
  assert.equal(
    users.every((user) => user.password.length >= 20),
    true,
  );
  assert.equal(JSON.stringify(users).includes(serviceRoleKey), false);
  const authRequests = local.requests.filter((request) => request.url === "/auth/v1/admin/users");
  const profileRequests = local.requests.filter(
    (request) => request.url === "/rest/v1/rpc/e2e_prepare_synthetic_profile",
  );
  assert.equal(authRequests.length, 4);
  assert.equal(profileRequests.length, 4);
  assert.equal(
    authRequests.every((request) => request.headers.apikey === serviceRoleKey),
    true,
  );
  assert.equal(
    authRequests.every(
      (request) => JSON.parse(request.body).user_metadata.access_context_consent === false,
    ),
    true,
  );
  assert.equal(
    local.requests.some((request) => request.url?.startsWith("/rest/v1/profiles")),
    false,
  );
  assert.equal(
    profileRequests.every((request) => JSON.parse(request.body).p_email.endsWith(".test")),
    true,
  );
  assert.equal(
    profileRequests.every(
      (request) => request.headers.authorization === `Bearer ${serviceRoleKey}`,
    ),
    true,
  );
});

test("seed refuses any non-loopback API before creating a client", async () => {
  const { seedLocalSupabase } = await import(seedModule);
  await assert.rejects(
    seedLocalSupabase({
      apiUrl: "https://project.supabase.co",
      serviceRoleKey: "must-not-be-used",
      runId: "run12345",
    }),
    /loopback|127\.0\.0\.1/i,
  );
});
