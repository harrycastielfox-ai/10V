export type SeizedWeapon = {
  id: string;
  nome: string;
  marcaModelo: string;
  calibre: string;
  numeroSerie: string;
  observacoes: string;
};

const SERIALIZATION_PREFIX = "SIPI_ARMAS_V1:";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWeapon(value: unknown, index: number): SeizedWeapon | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const nome = text(raw.nome);
  if (!nome) return null;

  return {
    id: text(raw.id) || `arma-${index + 1}`,
    nome,
    marcaModelo: text(raw.marcaModelo),
    calibre: text(raw.calibre),
    numeroSerie: text(raw.numeroSerie),
    observacoes: text(raw.observacoes),
  };
}

export function createEmptySeizedWeapon(): SeizedWeapon {
  return {
    id: "",
    nome: "",
    marcaModelo: "",
    calibre: "",
    numeroSerie: "",
    observacoes: "",
  };
}

export function parseSeizedWeapons(value: string | null | undefined): SeizedWeapon[] {
  const rawValue = value?.trim() ?? "";
  if (!rawValue) return [];

  const serialized = rawValue.startsWith(SERIALIZATION_PREFIX)
    ? rawValue.slice(SERIALIZATION_PREFIX.length)
    : rawValue.startsWith("[")
      ? rawValue
      : "";

  if (serialized) {
    try {
      const parsed = JSON.parse(serialized) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((weapon, index) => normalizeWeapon(weapon, index))
          .filter((weapon): weapon is SeizedWeapon => weapon !== null);
      }
    } catch {
      // Registros legados continuam legíveis mesmo quando o texto se parece com JSON.
    }
  }

  return [
    {
      ...createEmptySeizedWeapon(),
      id: "arma-legada-1",
      nome: rawValue,
    },
  ];
}

export function serializeSeizedWeapons(weapons: readonly SeizedWeapon[]): string {
  const normalized = weapons
    .map((weapon, index) => normalizeWeapon(weapon, index))
    .filter((weapon): weapon is SeizedWeapon => weapon !== null);

  if (!normalized.length) return "";
  return `${SERIALIZATION_PREFIX}${JSON.stringify(normalized)}`;
}

export function formatSeizedWeaponsForDisplay(value: string | null | undefined): string {
  return parseSeizedWeapons(value)
    .map((weapon) => {
      const details = [
        weapon.marcaModelo,
        weapon.calibre ? `calibre ${weapon.calibre}` : "",
        weapon.numeroSerie ? `nº ${weapon.numeroSerie}` : "",
        weapon.observacoes,
      ].filter(Boolean);
      return details.length ? `${weapon.nome} — ${details.join("; ")}` : weapon.nome;
    })
    .join("\n");
}
