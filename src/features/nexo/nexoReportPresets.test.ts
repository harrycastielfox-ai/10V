import { describe, expect, it } from "vitest";
import { createNexoReportConfig, normalizeNexoReportConfig } from "./nexoReportConfig";
import {
  createNexoReportPreset,
  parseNexoReportPresets,
  removeNexoReportPreset,
  serializeNexoReportPresets,
  upsertNexoReportPreset,
} from "./nexoReportPresets";

describe("modelos versionados de relatório NEXO", () => {
  it("cria, serializa e reabre um modelo sem perder as seleções", () => {
    const config = createNexoReportConfig();
    config.sections.photographs = false;
    config.excludedSourceKeys = ["source-1"];
    const preset = createNexoReportPreset(
      "Ficha individual",
      config,
      new Date("2026-10-21T12:00:00Z"),
    );
    const restored = parseNexoReportPresets(serializeNexoReportPresets([preset]), (value) =>
      normalizeNexoReportConfig(value as never),
    );
    expect(restored[0]).toMatchObject({
      name: "Ficha individual",
      version: 1,
      config: { sections: { photographs: false }, excludedSourceKeys: ["source-1"] },
    });
  });

  it("incrementa a versão quando o usuário reutiliza o mesmo modelo", () => {
    const first = createNexoReportPreset(
      "Modelo",
      createNexoReportConfig(),
      new Date("2026-10-21T12:00:00Z"),
    );
    const updated = upsertNexoReportPreset(
      [first],
      "Modelo atualizado",
      { ...first.config, sections: { ...first.config.sections, sources: false } },
      first.id,
      new Date("2026-10-21T13:00:00Z"),
    );
    expect(updated.preset?.version).toBe(2);
    expect(updated.presets).toHaveLength(1);
    expect(updated.preset?.config.sections.sources).toBe(false);
  });

  it("remove somente o modelo solicitado", () => {
    const first = createNexoReportPreset("A", createNexoReportConfig());
    const second = createNexoReportPreset("B", createNexoReportConfig());
    expect(removeNexoReportPreset([first, second], first.id).map((item) => item.name)).toEqual([
      "B",
    ]);
  });

  it("ignora JSON corrompido e registros inválidos", () => {
    expect(
      parseNexoReportPresets("{quebrado", (value) => normalizeNexoReportConfig(value as never)),
    ).toEqual([]);
    expect(
      parseNexoReportPresets(JSON.stringify([{ id: "", name: "", config: {} }]), (value) =>
        normalizeNexoReportConfig(value as never),
      ),
    ).toEqual([]);
  });
});
