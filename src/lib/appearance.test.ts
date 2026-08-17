import { describe, expect, it } from "vitest";
import { APPEARANCE_OPTIONS, isAppearance } from "./appearance";

describe("aparências do SIPI", () => {
  it("mantém somente Escuro, Claro e Mesclar", () => {
    expect(APPEARANCE_OPTIONS).toEqual(["default", "light", "mixed"]);
  });

  it("migra o antigo Black ao rejeitar o valor salvo", () => {
    expect(isAppearance("black")).toBe(false);
    expect(isAppearance("mixed")).toBe(true);
  });
});
