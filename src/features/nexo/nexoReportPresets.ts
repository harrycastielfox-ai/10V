import type { NexoReportConfig } from "./nexoReportConfig";

export const NEXO_REPORT_PRESETS_STORAGE_KEY = "nexo.report-presets.v1";
export const NEXO_REPORT_PRESET_LIMIT = 30;

export interface NexoReportPreset {
  id: string;
  name: string;
  version: number;
  config: NexoReportConfig;
  createdAt: string;
  updatedAt: string;
  versions: NexoReportPresetVersion[];
}

export interface NexoReportPresetVersion {
  version: number;
  config: NexoReportConfig;
  updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function parseNexoReportPresets(
  raw: string | null,
  normalize: (value: unknown) => NexoReportConfig,
) {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map((item) => {
        const version =
          typeof item.version === "number" && item.version > 0 ? Math.floor(item.version) : 1;
        const config = normalize(item.config);
        const versions = Array.isArray(item.versions)
          ? item.versions
              .filter((entry): entry is Record<string, unknown> => isRecord(entry))
              .map((entry) => ({
                version:
                  typeof entry.version === "number" && entry.version > 0
                    ? Math.floor(entry.version)
                    : 1,
                config: normalize(entry.config),
                updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : "",
              }))
              .filter((entry) => entry.updatedAt)
          : [];
        return {
          id: typeof item.id === "string" ? item.id : "",
          name: typeof item.name === "string" ? item.name.trim().slice(0, 120) : "",
          version,
          config,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
          updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
          versions: versions.length
            ? versions
            : [
                {
                  version,
                  config,
                  updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
                },
              ],
        };
      })
      .filter((item) => item.id && item.name)
      .slice(0, NEXO_REPORT_PRESET_LIMIT);
  } catch {
    return [];
  }
}

export function serializeNexoReportPresets(presets: NexoReportPreset[]) {
  return JSON.stringify(presets.slice(0, NEXO_REPORT_PRESET_LIMIT));
}

export function createNexoReportPreset(name: string, config: NexoReportConfig, now = new Date()) {
  const timestamp = now.toISOString();
  return {
    id: `report-preset-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim().slice(0, 120),
    version: 1,
    config,
    createdAt: timestamp,
    updatedAt: timestamp,
    versions: [{ version: 1, config, updatedAt: timestamp }],
  } satisfies NexoReportPreset;
}

export function upsertNexoReportPreset(
  presets: NexoReportPreset[],
  name: string,
  config: NexoReportConfig,
  activeId?: string,
  now = new Date(),
) {
  const cleanName = name.trim().slice(0, 120);
  if (!cleanName) return { presets, preset: null };
  const timestamp = now.toISOString();
  if (activeId) {
    const index = presets.findIndex((preset) => preset.id === activeId);
    if (index >= 0) {
      const current = presets[index];
      const preset = {
        ...current,
        name: cleanName,
        version: current.version + 1,
        config,
        updatedAt: timestamp,
        versions: [
          ...current.versions,
          { version: current.version + 1, config, updatedAt: timestamp },
        ],
      };
      const next = [...presets];
      next[index] = preset;
      return { presets: next, preset };
    }
  }
  const preset = createNexoReportPreset(cleanName, config, now);
  return { presets: [preset, ...presets].slice(0, NEXO_REPORT_PRESET_LIMIT), preset };
}

export function removeNexoReportPreset(presets: NexoReportPreset[], id: string) {
  return presets.filter((preset) => preset.id !== id);
}
