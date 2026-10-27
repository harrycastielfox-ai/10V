import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import test from "node:test";

const gatewayModule = new URL("../../scripts/e2e-local/gateway.mjs", import.meta.url);

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test("gateway pins the upstream and replaces spoofable network identity headers", async (t) => {
  let received;
  const backend = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      received = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      };
      res.writeHead(207, { "x-backend-result": "preserved", connection: "close" });
      res.end("backend-response");
    });
  });
  const backendUrl = await listen(backend);
  t.after(() => backend.close());
  const { startLocalGateway } = await import(gatewayModule);
  const gateway = await startLocalGateway(backendUrl);
  t.after(() => gateway.close());

  const response = await fetch(`${gateway.url}/functions/v1/secure-login?attempt=1`, {
    method: "POST",
    headers: {
      authorization: "Bearer local-anon-token",
      apikey: "local-anon-token",
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.40",
      forwarded: "for=203.0.113.40",
      "x-forwarded-for": "203.0.113.40",
    },
    body: '{"identifier":"synthetic"}',
  });
  assert.equal(response.status, 207);
  assert.equal(response.headers.get("x-backend-result"), "preserved");
  assert.equal(await response.text(), "backend-response");
  assert.deepEqual(
    {
      method: received.method,
      url: received.url,
      authorization: received.headers.authorization,
      apikey: received.headers.apikey,
      contentType: received.headers["content-type"],
      clientIp: received.headers["cf-connecting-ip"],
      forwarded: received.headers.forwarded,
      xForwardedFor: received.headers["x-forwarded-for"],
      body: received.body,
    },
    {
      method: "POST",
      url: "/functions/v1/secure-login?attempt=1",
      authorization: "Bearer local-anon-token",
      apikey: "local-anon-token",
      contentType: "application/json",
      clientIp: "127.0.0.1",
      forwarded: undefined,
      xForwardedFor: undefined,
      body: '{"identifier":"synthetic"}',
    },
  );
  assert.deepEqual(gateway.snapshot(), {
    active: 0,
    requests: [
      {
        method: "POST",
        path: "/functions/v1/secure-login?attempt=1",
        state: "completed",
        status: 207,
      },
    ],
  });
});

test("gateway rejects remote or ambiguous upstreams before listening", async () => {
  const { startLocalGateway } = await import(gatewayModule);
  for (const url of [
    "https://127.0.0.1:54321",
    "http://localhost:54321",
    "http://192.168.1.10:54321",
    "http://127.0.0.1:54321/rest/v1",
    "http://user:pass@127.0.0.1:54321",
    "http://127.0.0.1:54321?target=remote",
  ]) {
    await assert.rejects(startLocalGateway(url), /loopback|origin|upstream/i, url);
  }
});

test("gateway rejects absolute-form request targets without contacting the backend", async (t) => {
  let contacts = 0;
  const backend = createServer((_req, res) => {
    contacts += 1;
    res.end("unexpected");
  });
  const backendUrl = await listen(backend);
  t.after(() => backend.close());
  const { startLocalGateway } = await import(gatewayModule);
  const gateway = await startLocalGateway(backendUrl);
  t.after(() => gateway.close());
  const target = new URL(gateway.url);

  const status = await new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: target.hostname,
        port: target.port,
        method: "GET",
        path: "http://example.invalid/steal",
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      },
    );
    req.once("error", reject);
    req.end();
  });
  assert.equal(status, 400);
  assert.equal(contacts, 0);
});
