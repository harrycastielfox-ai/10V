import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { probeLocalSecureLogin } from "../../scripts/e2e-local/preflight.mjs";

async function localServer(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

test("secure-login preflight validates real local credentials without returning tokens", async (t) => {
  const token = "synthetic-token-that-must-not-be-returned";
  const origin = await localServer(t, (request, response) => {
    assert.equal(request.url, "/functions/v1/secure-login");
    assert.equal(request.headers.apikey, "local-anon-key");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ access_token: token, refresh_token: token }));
  });

  const result = await probeLocalSecureLogin({
    origin,
    anonKey: "local-anon-key",
    user: { email: "admin.preflight@example.test", password: "synthetic-password" },
  });

  assert.deepEqual(result, { status: 200 });
  assert.equal(JSON.stringify(result).includes(token), false);
});

test("secure-login preflight reports only a sanitized remote error code", async (t) => {
  const origin = await localServer(t, (_request, response) => {
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ code: "service_unavailable", secret: "must-not-escape" }));
  });

  await assert.rejects(
    probeLocalSecureLogin({
      origin,
      anonKey: "local-anon-key",
      user: { email: "admin.preflight@example.test", password: "synthetic-password" },
    }),
    /HTTP 503 \(service_unavailable\)/,
  );
});

test("secure-login preflight refuses non-loopback origins and non-test identities", async () => {
  await assert.rejects(
    probeLocalSecureLogin({
      origin: "https://example.com",
      anonKey: "local-anon-key",
      user: { email: "admin@example.test", password: "synthetic-password" },
    }),
    /loopback/i,
  );
  await assert.rejects(
    probeLocalSecureLogin({
      origin: "http://127.0.0.1:54321",
      anonKey: "local-anon-key",
      user: { email: "admin@example.com", password: "synthetic-password" },
    }),
    /synthetic/i,
  );
});
