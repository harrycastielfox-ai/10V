import { describe, expect, it } from "vitest";
import {
  formatSeizedWeaponObservationsForDisplay,
  formatSeizedWeaponsForDisplay,
  parseSeizedWeapons,
  serializeSeizedWeapons,
  type SeizedWeapon,
} from "./seizedWeapons";

const weapons: SeizedWeapon[] = [
  {
    id: "arma-1",
    nome: "Revólver",
    marcaModelo: "Taurus 82",
    calibre: ".38",
    numeroSerie: "ABC123",
    observacoes: "Cabo de madeira",
  },
  {
    id: "arma-2",
    nome: "Pistola",
    marcaModelo: "Glock G17",
    calibre: "9 mm",
    numeroSerie: "XYZ789",
    observacoes: "",
  },
];

describe("seizedWeapons", () => {
  it("preserva os dados estruturados de várias armas", () => {
    expect(parseSeizedWeapons(serializeSeizedWeapons(weapons))).toEqual(weapons);
  });

  it("mantém registros antigos como uma arma legada", () => {
    expect(parseSeizedWeapons("Revólver calibre .38")[0]?.nome).toBe("Revólver calibre .38");
  });

  it("gera uma descrição humana para detalhes e impressão", () => {
    expect(formatSeizedWeaponsForDisplay(serializeSeizedWeapons(weapons))).toBe(
      "1 - Revólver — Taurus 82; calibre .38; nº ABC123\n" +
        "2 - Pistola — Glock G17; calibre 9 mm; nº XYZ789",
    );
  });

  it("separa as observações mantendo o número da arma correspondente", () => {
    expect(formatSeizedWeaponObservationsForDisplay(serializeSeizedWeapons(weapons))).toBe(
      "1 - Cabo de madeira",
    );
  });
});
