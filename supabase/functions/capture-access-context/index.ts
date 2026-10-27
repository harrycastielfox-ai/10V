import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTrustedClientIp } from "../_shared/clientIp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "authentication_required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_configuration_error" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "invalid_session" }, 401);

  const userId = userData.user.id;
  const { data: context, error: contextError } = await admin
    .from("user_access_contexts")
    .select("access_context_consent")
    .eq("user_id", userId)
    .maybeSingle();
  if (contextError) return json({ error: "context_lookup_failed" }, 500);
  if (!context?.access_context_consent)
    return json({ captured: false, reason: "consent_required" });

  const ip = getTrustedClientIp(req.headers);
  if (!ip) return json({ captured: false, reason: "ip_unavailable" });

  let provider: string | null = null;
  let country: string | null = null;
  let region: string | null = null;
  let city: string | null = null;
  const geoUrl = `https://ipwho.is/${encodeURIComponent(ip)}`;
  try {
    const response = await fetch(geoUrl, { headers: { accept: "application/json" } });
    if (response.ok) {
      const geo = await response.json();
      if (geo.success !== false) {
        provider = geo.connection?.isp ?? geo.connection?.org ?? null;
        country = geo.country ?? null;
        region = geo.region ?? null;
        city = geo.city ?? null;
      }
    }
  } catch {
    // IP ainda pode ser registrado mesmo quando o enriquecimento falhar.
  }

  const { error: updateError } = await admin
    .from("user_access_contexts")
    .update({ ip_address: ip, ip_provider: provider, country, region, city })
    .eq("user_id", userId)
    .eq("access_context_consent", true);
  if (updateError) return json({ error: "context_update_failed" }, 500);

  return json({ captured: true, enriched: Boolean(provider || country || region || city) });
});
