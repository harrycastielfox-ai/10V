import { createClient } from "npm:@supabase/supabase-js@2.110.9";
import { getTrustedClientIp } from "../_shared/clientIp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PrepareLoginResult = {
  attempt_id: string | null;
  allowed: boolean;
  retry_after_seconds: number;
  resolved_email: string | null;
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function firstPrepareResult(value: unknown): PrepareLoginResult | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return null;
  const result = candidate as Partial<PrepareLoginResult>;
  if (typeof result.allowed !== "boolean") return null;
  return result as PrepareLoginResult;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ code: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitSecret = Deno.env.get("LOGIN_RATE_LIMIT_SECRET");
  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !rateLimitSecret ||
    rateLimitSecret.length < 32
  ) {
    return json({ code: "service_unavailable" }, 503);
  }

  const clientIp = getTrustedClientIp(req.headers);
  if (!clientIp) return json({ code: "service_unavailable" }, 503);

  let payload: { identifier?: unknown; password?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ code: "invalid_request" }, 400);
  }

  const identifier = typeof payload.identifier === "string" ? payload.identifier.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!identifier || identifier.length > 254 || !password || password.length > 1024) {
    return json({ code: "invalid_request" }, 400);
  }

  const normalizedIdentifier = identifier.toLowerCase();
  const [identifierHash, ipHash] = await Promise.all([
    hmacSha256Hex(rateLimitSecret, `identifier:${normalizedIdentifier}`),
    hmacSha256Hex(rateLimitSecret, `ip:${clientIp}`),
  ]);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: prepareData, error: prepareError } = await admin.rpc("prepare_login_attempt", {
    p_identifier: normalizedIdentifier,
    p_identifier_hash: identifierHash,
    p_ip_hash: ipHash,
  });
  const prepared = firstPrepareResult(prepareData);
  if (prepareError || !prepared) return json({ code: "service_unavailable" }, 503);

  if (!prepared.allowed) {
    const retryAfter = Math.max(1, Number(prepared.retry_after_seconds) || 600);
    return json({ code: "too_many_attempts", retry_after_seconds: retryAfter }, 429, {
      "Retry-After": String(retryAfter),
    });
  }

  if (!prepared.attempt_id) return json({ code: "service_unavailable" }, 503);

  const email = prepared.resolved_email || `invalid-${identifierHash.slice(0, 24)}@invalid.local`;
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let failureCode = "invalid_credentials";
  try {
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (!authError && authData.session) {
      accessToken = authData.session.access_token;
      refreshToken = authData.session.refresh_token;
    } else if (authError) {
      const authErrorCode = String(authError.code || "").toLowerCase();
      if (authErrorCode === "email_not_confirmed") failureCode = "email_not_confirmed";
      else if (authErrorCode === "over_request_rate_limit" || authErrorCode === "too_many_requests")
        failureCode = "too_many_attempts";
      else if (Number(authError.status) >= 500) failureCode = "service_unavailable";
    }
  } catch {
    failureCode = "service_unavailable";
  }

  const { error: completeError } = await admin.rpc("complete_login_attempt", {
    p_attempt_id: prepared.attempt_id,
    p_succeeded: Boolean(accessToken && refreshToken),
  });
  if (completeError) return json({ code: "service_unavailable" }, 503);

  if (!accessToken || !refreshToken) {
    if (failureCode === "too_many_attempts") return json({ code: failureCode }, 429);
    if (failureCode === "email_not_confirmed") return json({ code: failureCode }, 403);
    if (failureCode === "service_unavailable") return json({ code: failureCode }, 503);
    return json({ code: failureCode, message: "Usuário ou senha inválidos." }, 401);
  }

  return json({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
});
