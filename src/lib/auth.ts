import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  PUBLIC_SIGNUP_INSTITUTIONAL_FUNCTIONS,
  type InstitutionalFunction,
  type UserProfile,
} from "@/lib/authz";

export type CurrentUserProfile = UserProfile & { telefone: string | null };

const PROFILE_SELECT =
  "id,nome,email,login,avatar_path,telefone,funcao_institucional,cargo,status_autorizacao,can_access_sigiloso,created_at,updated_at";
const PROFILE_SELECT_WITHOUT_SIGILO =
  "id,nome,email,login,avatar_path,telefone,funcao_institucional,cargo,status_autorizacao,created_at,updated_at";
const LEGACY_PROFILE_SELECT =
  "id,nome,email,login,avatar_path,telefone,cargo,status_autorizacao,created_at,updated_at";
const AVATAR_BUCKET = "profile-avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const DEFAULT_AUTH_TIMEOUT_MS = 10000;

export class AuthFlowError extends Error {
  code: string;
  cause?: unknown;
  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "AuthFlowError";
    this.code = code;
    this.cause = cause;
  }
}

function normalizeIdentifier(value: string): string {
  return value.trim();
}

function normalizeEmail(value: string): string {
  return normalizeIdentifier(value).toLowerCase();
}

function normalizeLogin(value: string): string {
  return normalizeIdentifier(value).toLowerCase();
}

function normalizePhone(value?: string): string {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 11);
}

function normalizePublicSignupInstitutionalFunction(
  value?: InstitutionalFunction | string | null,
): InstitutionalFunction | null {
  return PUBLIC_SIGNUP_INSTITUTIONAL_FUNCTIONS.includes(value as InstitutionalFunction)
    ? (value as InstitutionalFunction)
    : null;
}

type SecureLoginResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
};

async function getFunctionErrorCode(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;

  try {
    const payload = (await error.context.clone().json()) as { code?: unknown };
    return typeof payload.code === "string" ? payload.code : null;
  } catch {
    return null;
  }
}

function isAuthDuplicateEmailError(error: unknown): boolean {
  const code = String((error as { code?: string } | undefined)?.code || "").toLowerCase();
  const message = String((error as { message?: string } | undefined)?.message || "").toLowerCase();
  return code === "user_already_exists" || message.includes("already registered");
}

function isRlsError(error: unknown): boolean {
  const message = String((error as { message?: string } | undefined)?.message || "").toLowerCase();
  return message.includes("row-level security") || message.includes("permission denied");
}

function isMissingInstitutionalFunctionColumn(error: unknown): boolean {
  const code = String((error as { code?: string } | undefined)?.code ?? "");
  const message = String((error as { message?: string } | undefined)?.message ?? "").toLowerCase();
  return (code === "42703" || code === "PGRST204") && message.includes("funcao_institucional");
}

function isMissingSigiloAccessColumn(error: unknown): boolean {
  const code = String((error as { code?: string } | undefined)?.code ?? "");
  const message = String((error as { message?: string } | undefined)?.message ?? "").toLowerCase();
  return (code === "42703" || code === "PGRST204") && message.includes("can_access_sigiloso");
}

function withAuthTimeout<T>(
  operation: PromiseLike<T>,
  code: string,
  message: string,
  timeoutMs = DEFAULT_AUTH_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new AuthFlowError(code, message));
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(operation), timeoutPromise]).finally(() =>
    clearTimeout(timeoutId),
  );
}

export async function getSession() {
  const { data, error } = await withAuthTimeout(
    supabase.auth.getSession(),
    "AUTH_SESSION_TIMEOUT",
    "Tempo limite ao carregar sessão.",
  );
  if (error) throw error;
  return data.session;
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentProfile(): Promise<CurrentUserProfile | null> {
  const session = await getSession();
  if (!session?.user) return null;

  let { data, error } = await withAuthTimeout(
    supabase.from("profiles").select(PROFILE_SELECT).eq("id", session.user.id).maybeSingle(),
    "PROFILE_FETCH_TIMEOUT",
    "Tempo limite ao carregar perfil.",
  );
  if (error && isMissingSigiloAccessColumn(error)) {
    const fallbackResult = await withAuthTimeout(
      supabase
        .from("profiles")
        .select(PROFILE_SELECT_WITHOUT_SIGILO)
        .eq("id", session.user.id)
        .maybeSingle(),
      "PROFILE_FETCH_TIMEOUT",
      "Tempo limite ao carregar perfil.",
    );
    data = fallbackResult.data ? { ...fallbackResult.data, can_access_sigiloso: false } : null;
    error = fallbackResult.error;
  }
  if (error && isMissingInstitutionalFunctionColumn(error)) {
    const legacyResult = await withAuthTimeout(
      supabase
        .from("profiles")
        .select(LEGACY_PROFILE_SELECT)
        .eq("id", session.user.id)
        .maybeSingle(),
      "PROFILE_FETCH_TIMEOUT",
      "Tempo limite ao carregar perfil.",
    );
    data = legacyResult.data
      ? { ...legacyResult.data, funcao_institucional: null, can_access_sigiloso: false }
      : null;
    error = legacyResult.error;
  }
  if (error) {
    if (isRlsError(error)) {
      throw new AuthFlowError(
        "PROFILE_RLS_DENIED",
        "RLS/policy bloqueou a leitura do perfil.",
        error,
      );
    }
    throw new AuthFlowError("PROFILE_FETCH_FAILED", "Falha ao carregar perfil.", error);
  }

  if (!data) {
    throw new AuthFlowError(
      "PROFILE_NOT_FOUND",
      "Perfil não encontrado para o usuário autenticado.",
    );
  }

  return data as CurrentUserProfile;
}

export async function authenticateWithLoginOrEmail(loginOrEmail: string, password: string) {
  const identifier = normalizeIdentifier(loginOrEmail);
  const { data, error } = await withAuthTimeout(
    supabase.functions.invoke<SecureLoginResponse>("secure-login", {
      body: { identifier, password },
    }),
    "AUTH_SERVICE_UNAVAILABLE",
    "Tempo limite ao validar credenciais.",
  );

  if (error) {
    const errorCode = await getFunctionErrorCode(error);
    if (errorCode === "too_many_attempts") {
      throw new AuthFlowError("AUTH_RATE_LIMITED", "Muitas tentativas de login.", error);
    }
    if (errorCode === "email_not_confirmed") {
      throw new AuthFlowError("AUTH_EMAIL_NOT_CONFIRMED", "E-mail ainda não confirmado.", error);
    }
    if (errorCode === "invalid_credentials" || errorCode === "invalid_request") {
      throw new AuthFlowError("AUTH_INVALID_CREDENTIALS", "Credenciais inválidas.", error);
    }
    throw new AuthFlowError("AUTH_SERVICE_UNAVAILABLE", "Serviço de login indisponível.", error);
  }

  if (typeof data?.access_token !== "string" || typeof data.refresh_token !== "string") {
    throw new AuthFlowError("AUTH_SERVICE_UNAVAILABLE", "Resposta de login inválida.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionError || !sessionData.session) {
    throw new AuthFlowError(
      "AUTH_SERVICE_UNAVAILABLE",
      "Não foi possível iniciar a sessão.",
      sessionError,
    );
  }

  return sessionData.session;
}

export async function signInWithLoginOrEmail(loginOrEmail: string, password: string) {
  await authenticateWithLoginOrEmail(loginOrEmail, password);
  return getCurrentProfile();
}

export async function updateOwnAvatar(userId: string, avatarFile: File): Promise<string> {
  if (!avatarFile.type.startsWith("image/")) throw new Error("AVATAR_INVALID_TYPE");
  if (avatarFile.size > MAX_AVATAR_BYTES) throw new Error("AVATAR_TOO_LARGE");

  const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, avatarFile, { upsert: true });
  if (error) {
    throw new AuthFlowError("AVATAR_UPLOAD_FAILED", "Falha no upload do avatar.", error);
  }

  const { error: avatarUpdateError } = await supabase.rpc("update_own_avatar", {
    input_avatar_path: path,
  });
  if (avatarUpdateError) {
    throw new AuthFlowError(
      "AVATAR_RPC_UPDATE_FAILED",
      "Falha ao atualizar avatar_path no perfil.",
      avatarUpdateError,
    );
  }

  return path;
}

export async function updateOwnPhone(telefone: string): Promise<string | null> {
  const cleanTelefone = normalizePhone(telefone);
  const { error } = await supabase.rpc("update_own_phone", {
    p_telefone: cleanTelefone || null,
  });
  if (error) {
    throw new AuthFlowError(
      "PHONE_RPC_UPDATE_FAILED",
      "Falha ao atualizar telefone no perfil.",
      error,
    );
  }

  return cleanTelefone || null;
}

export async function updateOwnName(nome: string): Promise<string> {
  const cleanName = nome.trim().replace(/\s+/g, " ");
  const { error } = await supabase.rpc("update_own_name", {
    p_nome: cleanName,
  });
  if (error) {
    throw new AuthFlowError("NAME_RPC_UPDATE_FAILED", "Falha ao atualizar nome no perfil.", error);
  }

  return cleanName;
}

export async function signUpUser(payload: {
  nome: string;
  email: string;
  login: string;
  telefone?: string;
  funcaoInstitucional?: InstitutionalFunction | null;
  password: string;
  avatarFile?: File | null;
  termsAcceptedAt: string;
  termsVersion: string;
  accessContextConsent: boolean;
}) {
  const {
    nome,
    email,
    login,
    telefone,
    funcaoInstitucional,
    password,
    avatarFile,
    termsAcceptedAt,
    termsVersion,
    accessContextConsent,
  } = payload;
  const cleanEmail = normalizeEmail(email);
  const cleanLogin = normalizeLogin(login);
  const cleanTelefone = normalizePhone(telefone);
  const cleanFunction = normalizePublicSignupInstitutionalFunction(funcaoInstitucional);

  if (!cleanLogin) throw new Error("LOGIN_REQUIRED");
  if (!accessContextConsent || !termsAcceptedAt || !termsVersion) throw new Error("TERMS_REQUIRED");

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        nome: nome.trim(),
        login: cleanLogin,
        telefone: cleanTelefone || null,
        funcao_institucional: cleanFunction,
        terms_accepted_at: termsAcceptedAt,
        terms_version: termsVersion,
        access_context_consent: true,
      },
    },
  });

  if (error) {
    console.error("[signUpUser] Erro do Supabase Auth", error);
    if (isAuthDuplicateEmailError(error)) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }
    throw error;
  }

  let avatarUploadWarning = false;
  let avatarUploadWarningReason: "NO_ACTIVE_SESSION" | "UPLOAD_OR_RPC_ERROR" | null = null;
  if (avatarFile && data.user?.id) {
    try {
      const session = data.session ?? (await getSession());
      if (session?.user?.id === data.user.id) {
        const avatarPath = await updateOwnAvatar(data.user.id, avatarFile);
        console.info("[signUpUser] avatar_path salvo com sucesso", {
          userId: data.user.id,
          avatarPath,
        });
      } else {
        avatarUploadWarning = true;
        avatarUploadWarningReason = "NO_ACTIVE_SESSION";
        console.warn("[signUpUser] Sessão ausente após signUp; avatar não enviado neste momento", {
          userId: data.user.id,
          hasSession: Boolean(session),
          sessionUserId: session?.user?.id ?? null,
        });
      }
    } catch (avatarError) {
      avatarUploadWarning = true;
      avatarUploadWarningReason = "UPLOAD_OR_RPC_ERROR";
      const authErrorCode = (avatarError as { code?: string } | undefined)?.code;
      if (authErrorCode === "AVATAR_RPC_UPDATE_FAILED") {
        console.error("[signUpUser] Erro na RPC update_own_avatar", avatarError);
      } else if (authErrorCode === "AVATAR_UPLOAD_FAILED") {
        console.error("[signUpUser] Erro de upload de avatar", avatarError);
      } else {
        console.error("[signUpUser] Erro de upload de avatar", avatarError);
        console.error("[signUpUser] Erro na RPC update_own_avatar", avatarError);
      }
    }
  }

  await supabase.auth.signOut();
  return { ...data, avatarUploadWarning, avatarUploadWarningReason };
}

export function getProfileAvatarPublicUrl(avatarPath: string | null | undefined): string | null {
  if (!avatarPath) return null;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
  return data.publicUrl;
}
