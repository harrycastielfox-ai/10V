type ErrorRecord = {
  code?: unknown;
  details?: unknown;
  message?: unknown;
};

function asErrorRecord(cause: unknown): ErrorRecord | null {
  return cause !== null && typeof cause === "object" ? (cause as ErrorRecord) : null;
}

export function getErrorCode(cause: unknown): string {
  const code = asErrorRecord(cause)?.code;
  return typeof code === "string" ? code : "";
}

export function getErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.trim()) return cause.message.trim();
  if (typeof cause === "string" && cause.trim()) return cause.trim();

  const source = asErrorRecord(cause);
  const message = typeof source?.message === "string" ? source.message.trim() : "";
  const details = typeof source?.details === "string" ? source.details.trim() : "";

  if (message && details && details !== message) return `${message} (${details})`;
  return message || details || fallback;
}
