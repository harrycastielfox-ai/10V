import { createServer, request } from "node:http";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const SPOOFABLE_NETWORK_HEADERS = new Set([
  "cf-connecting-ip",
  "forwarded",
  "true-client-ip",
  "x-client-ip",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
]);

function pinnedLoopbackOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Local gateway upstream must be a valid loopback origin");
  }
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Local gateway upstream must be an exact HTTP 127.0.0.1 origin");
  }
  return url;
}

function connectionTokens(headers) {
  const value = headers.connection;
  if (typeof value !== "string") return new Set();
  return new Set(
    value
      .split(",")
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean),
  );
}

function filteredHeaders(headers, { requestHeaders = false } = {}) {
  const nominated = connectionTokens(headers);
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (
      value === undefined ||
      HOP_BY_HOP.has(lower) ||
      nominated.has(lower) ||
      (requestHeaders && SPOOFABLE_NETWORK_HEADERS.has(lower))
    ) {
      continue;
    }
    result[lower] = value;
  }
  return result;
}

function validOriginForm(target) {
  return (
    typeof target === "string" &&
    target.startsWith("/") &&
    !target.startsWith("//") &&
    !target.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(target)
  );
}

export async function startLocalGateway(backendUrl, { port = 0 } = {}) {
  const backend = pinnedLoopbackOrigin(backendUrl);
  if (!Number.isInteger(port) || port < 0 || port > 65535 || (port > 0 && port < 1024)) {
    throw new Error(`Unsafe local gateway port: ${port}`);
  }

  const diagnostics = [];
  const record = (entry) => {
    diagnostics.push(entry);
    if (diagnostics.length > 20) diagnostics.shift();
    return entry;
  };
  const server = createServer((clientRequest, clientResponse) => {
    if (!validOriginForm(clientRequest.url)) {
      clientResponse.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      clientResponse.end("Invalid local request target");
      return;
    }
    const headers = filteredHeaders(clientRequest.headers, { requestHeaders: true });
    headers.host = backend.host;
    headers["cf-connecting-ip"] = "127.0.0.1";
    const diagnostic = record({
      method: clientRequest.method ?? "UNKNOWN",
      path: clientRequest.url,
      state: "active",
    });
    const upstream = request(
      {
        protocol: backend.protocol,
        hostname: backend.hostname,
        port: backend.port,
        method: clientRequest.method,
        path: clientRequest.url,
        headers,
      },
      (upstreamResponse) => {
        diagnostic.state = "upstream_headers";
        diagnostic.status = upstreamResponse.statusCode ?? 502;
        clientResponse.writeHead(
          upstreamResponse.statusCode ?? 502,
          filteredHeaders(upstreamResponse.headers),
        );
        upstreamResponse.pipe(clientResponse);
      },
    );
    upstream.once("error", () => {
      diagnostic.state = "upstream_error";
      if (!clientResponse.headersSent) {
        clientResponse.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      clientResponse.end("Local backend unavailable");
    });
    clientRequest.once("aborted", () => {
      diagnostic.state = "client_request_aborted";
      upstream.destroy();
    });
    clientResponse.once("finish", () => {
      diagnostic.state = "completed";
    });
    clientResponse.once("close", () => {
      if (diagnostic.state !== "completed") diagnostic.state = "client_response_closed";
    });
    clientRequest.pipe(upstream);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    snapshot: () => ({
      active: diagnostics.filter(({ state }) => !["completed", "upstream_error"].includes(state))
        .length,
      requests: diagnostics.map(({ method, path, state, status }) => ({
        method,
        path,
        state,
        ...(status === undefined ? {} : { status }),
      })),
    }),
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
