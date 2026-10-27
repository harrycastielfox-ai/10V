type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  name?: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseErrorLike | null;
  status?: number;
};

type RunSupabaseQueryOptions = {
  retries?: number;
  timeoutMs?: number;
  recoverAuthentication?: () => Promise<boolean>;
};

const DEFAULT_QUERY_TIMEOUT_MS = 20000;
const DEFAULT_QUERY_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 500;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown) {
  const name = String((error as { name?: string } | undefined)?.name ?? "");
  const message = String((error as { message?: string } | undefined)?.message ?? "").toLowerCase();
  return name === "AbortError" || message.includes("aborted") || message.includes("abort");
}

function isTransientFetchError(error: unknown) {
  const name = String((error as { name?: string } | undefined)?.name ?? "");
  const code = String((error as { code?: string } | undefined)?.code ?? "");
  const message = String((error as { message?: string } | undefined)?.message ?? "").toLowerCase();
  return (
    name === "SupabaseTimeoutError" ||
    code === "SUPABASE_QUERY_TIMEOUT" ||
    isAbortError(error) ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("tempo limite") ||
    message.includes("timeout") ||
    message.includes("timed out")
  );
}

function buildTimeoutError(label: string, timeoutMs: number) {
  return {
    name: "SupabaseTimeoutError",
    code: "SUPABASE_QUERY_TIMEOUT",
    message: `Tempo limite excedido ao carregar ${label}.`,
    details: `A consulta excedeu ${timeoutMs}ms sem resposta do Supabase.`,
  };
}

async function recoverSupabaseAuthentication() {
  try {
    const { supabase } = await import("@/lib/supabaseClient");
    const { data, error } = await supabase.auth.refreshSession();
    return !error && Boolean(data.session);
  } catch {
    return false;
  }
}

// Use apenas em leituras. Repetir a chamada é seguro porque nada é alterado no banco.
export async function runSupabaseQuery<T>(
  label: string,
  execute: (signal: AbortSignal) => PromiseLike<SupabaseResult<T>>,
  options: RunSupabaseQueryOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_QUERY_RETRIES;
  const recoverAuthentication = options.recoverAuthentication ?? recoverSupabaseAuthentication;
  let lastError: unknown = null;
  let authenticationRecoveryAttempted = false;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(buildTimeoutError(label, timeoutMs)),
      timeoutMs,
    );

    try {
      const { data, error, status } = await execute(controller.signal);
      if (error) {
        if (status === 401 && attempt < retries && !authenticationRecoveryAttempted) {
          authenticationRecoveryAttempted = true;
          if (await recoverAuthentication()) continue;
        }
        throw error;
      }
      return data as T;
    } catch (error) {
      lastError = isAbortError(error) ? buildTimeoutError(label, timeoutMs) : error;

      if (attempt >= retries || !isTransientFetchError(lastError)) {
        throw lastError;
      }

      if (import.meta.env.DEV) {
        console.warn(
          `[supabase:${label}] tentativa ${attempt + 1} falhou; tentando novamente`,
          lastError,
        );
      }

      await delay(DEFAULT_RETRY_DELAY_MS);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

// Use em gravações (insert/update/upsert/delete e RPCs que alteram dados).
// Sem retentativa: se o banco gravar e a resposta se perder, repetir duplicaria o registro.
export function runSupabaseMutation<T>(
  label: string,
  execute: (signal: AbortSignal) => PromiseLike<SupabaseResult<T>>,
  options: Omit<RunSupabaseQueryOptions, "retries"> = {},
): Promise<T> {
  return runSupabaseQuery(label, execute, { ...options, retries: 0 });
}
