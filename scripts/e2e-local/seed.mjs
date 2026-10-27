import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BLUEPRINTS = Object.freeze([
  {
    slug: "admin",
    nome: "Administrador Sintético",
    cargo: "admin",
    status_autorizacao: "autorizado",
    funcao_institucional: "delegado",
    can_access_sigiloso: true,
  },
  {
    slug: "delegado",
    nome: "Delegado Sintético",
    cargo: "delegado",
    status_autorizacao: "autorizado",
    funcao_institucional: "delegado",
    can_access_sigiloso: true,
  },
  {
    slug: "membro",
    nome: "Membro Sintético",
    cargo: "membro",
    status_autorizacao: "autorizado",
    funcao_institucional: "investigador",
    can_access_sigiloso: false,
  },
  {
    slug: "bloqueado",
    nome: "Usuário Bloqueado Sintético",
    cargo: "membro",
    status_autorizacao: "bloqueado",
    funcao_institucional: "investigador",
    can_access_sigiloso: false,
  },
]);

function localApiOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Synthetic seed requires a valid local loopback API origin");
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
    throw new Error("Synthetic seed requires an exact HTTP 127.0.0.1 loopback API origin");
  }
  return url.origin;
}

export async function seedLocalSupabase({ apiUrl, serviceRoleKey, runId }) {
  const origin = localApiOrigin(apiUrl);
  if (typeof serviceRoleKey !== "string" || serviceRoleKey.length < 8) {
    throw new Error("A local service-role key is required for synthetic seeding");
  }
  if (typeof runId !== "string" || !/^[a-z0-9]{8,20}$/.test(runId)) {
    throw new Error("Synthetic seed runId must contain 8-20 lowercase ASCII letters or digits");
  }
  const client = createClient(origin, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "x-client-info": "sied-local-e2e-seed" } },
  });
  const users = [];
  for (const blueprint of BLUEPRINTS) {
    const email = `${blueprint.slug}.${runId}@example.test`;
    const login = `${blueprint.slug}.${runId}`;
    const password = `${randomBytes(18).toString("base64url")}Aa1!`;
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome: blueprint.nome,
        login,
        access_context_consent: false,
      },
    });
    if (error || !data.user?.id) {
      throw new Error(`Local Auth could not create synthetic ${blueprint.slug} user`);
    }
    const { error: profileError } = await client.rpc("e2e_prepare_synthetic_profile", {
      p_user_id: data.user.id,
      p_nome: blueprint.nome,
      p_email: email,
      p_login: login,
      p_cargo: blueprint.cargo,
      p_status: blueprint.status_autorizacao,
      p_funcao: blueprint.funcao_institucional,
      p_sigilo: blueprint.can_access_sigiloso,
    });
    if (profileError) {
      const code = typeof profileError.code === "string" ? profileError.code : "unknown";
      throw new Error(
        `Local database could not prepare synthetic ${blueprint.slug} profile (${code})`,
      );
    }
    users.push({
      id: data.user.id,
      email,
      login,
      password,
      cargo: blueprint.cargo,
      status_autorizacao: blueprint.status_autorizacao,
    });
  }
  return users;
}
