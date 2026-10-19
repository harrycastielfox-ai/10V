import type { NexoPessoa } from "./nexoTypes";

export function routeCoordinates(person: NexoPessoa | null | undefined) {
  // An old address must not override the current address mode.
  if (person?.usar_local_faccao || person?.em_situacao_rua) return null;
  const latitude = person?.endereco?.latitude;
  const longitude = person?.endereco?.longitude;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)
  )
    return null;
  return { latitude, longitude };
}

export function safeNexoNavigationUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function routeAvailability(person: NexoPessoa) {
  if (person.usar_local_faccao || person.em_situacao_rua) return "missing" as const;
  if (routeCoordinates(person)) return "coordinates" as const;
  if (safeNexoNavigationUrl(person.endereco?.link_navegacao)) return "external" as const;
  return "missing" as const;
}

export function normalizeRouteSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
