function loopbackOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Secure-login preflight requires a valid loopback origin");
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
    throw new Error("Secure-login preflight requires an exact HTTP loopback origin");
  }
  return url.origin;
}

export async function probeLocalSecureLogin({ origin, anonKey, user, timeoutMs = 15_000 }) {
  const localOrigin = loopbackOrigin(origin);
  if (typeof anonKey !== "string" || !anonKey.trim()) {
    throw new Error("Secure-login preflight requires a local anonymous key");
  }
  if (
    !user ||
    typeof user.email !== "string" ||
    !user.email.endsWith("@example.test") ||
    typeof user.password !== "string" ||
    user.password.length < 12
  ) {
    throw new Error("Secure-login preflight requires a synthetic .test identity");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
    throw new Error("Secure-login preflight timeout is outside the safe range");
  }

  let response;
  try {
    response = await fetch(`${localOrigin}/functions/v1/secure-login`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ identifier: user.email, password: user.password }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error("Secure-login preflight did not receive a local response");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const code = typeof payload?.code === "string" ? payload.code : "unknown";
    throw new Error(`Secure-login preflight returned HTTP ${response.status} (${code})`);
  }

  // Deliberately do not parse successful token-bearing responses.
  await response.body?.cancel().catch(() => {});
  return { status: response.status };
}
