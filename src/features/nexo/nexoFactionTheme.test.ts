import { describe, expect, it } from "vitest";
import { getNexoFactionTheme } from "./nexoFactionTheme";

describe("tema visual das facções", () => {
  it("escolhe o texto com maior contraste para cores claras e escuras", () => {
    expect(getNexoFactionTheme("#22c3e6").foreground).toBe("#102b3d");
    expect(getNexoFactionTheme("#173d5b").foreground).toBe("#ffffff");
  });
});
