const MAX_CLIENT_IP_LENGTH = 128;

function normalizeCandidate(value: string | null) {
  const candidate = value?.trim() ?? "";
  return candidate && candidate.length <= MAX_CLIENT_IP_LENGTH ? candidate : null;
}

export function getTrustedClientIp(headers: Headers): string | null {
  const edgeAddress =
    normalizeCandidate(headers.get("cf-connecting-ip")) ??
    normalizeCandidate(headers.get("x-real-ip"));
  if (edgeAddress) return edgeAddress;

  return normalizeCandidate(headers.get("x-forwarded-for")?.split(",", 1)[0] ?? null);
}
