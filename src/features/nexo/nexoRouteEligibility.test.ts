import { describe, expect, it } from "vitest";
import type { NexoPessoa } from "./nexoTypes";
import { routeAvailability, routeCoordinates, safeNexoNavigationUrl } from "./nexoRouteEligibility";

function person(latitude: unknown, longitude: unknown, link: string | null = null) {
  return { endereco: { latitude, longitude, link_navegacao: link } } as NexoPessoa;
}

describe("NEXO route eligibility", () => {
  it("requires a complete, finite coordinate pair inside geographic limits", () => {
    expect(routeCoordinates(person(-16.57, -39.56))).toEqual({
      latitude: -16.57,
      longitude: -39.56,
    });
    for (const [latitude, longitude] of [
      [null, -39],
      [-16, null],
      [NaN, -39],
      [-16, Infinity],
      [91, 0],
      [0, -181],
      [0, 0],
      ["-16", -39],
    ]) {
      expect(routeCoordinates(person(latitude, longitude))).toBeNull();
    }
    expect(routeCoordinates(person(0, -39))).not.toBeNull();
  });

  it("separates external-only navigation from a route eligible for the embedded map", () => {
    expect(routeAvailability(person(null, null, "https://maps.google.com/?q=test"))).toBe(
      "external",
    );
    expect(routeAvailability(person(-16, -39, "https://maps.google.com/?q=test"))).toBe(
      "coordinates",
    );
    expect(routeAvailability(person(null, null, "javascript:alert(1)"))).toBe("missing");
    expect(routeAvailability(person(null, null))).toBe("missing");
  });

  it("does not use a stale individual address after switching address mode", () => {
    const address = person(-16, -39, "https://maps.google.com/?q=test");
    for (const overrides of [{ usar_local_faccao: true }, { em_situacao_rua: true }]) {
      const current = { ...address, ...overrides };
      expect(routeCoordinates(current)).toBeNull();
      expect(routeAvailability(current)).toBe("missing");
    }
  });

  it("allows explicit web navigation URLs and rejects executable or credential-bearing links", () => {
    expect(safeNexoNavigationUrl(" https://www.google.com/maps?q=-16,-39 ")).toBe(
      "https://www.google.com/maps?q=-16,-39",
    );
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,test",
      "file:///test",
      "/relative",
      "https://user:secret@example.com",
      "",
    ]) {
      expect(safeNexoNavigationUrl(value)).toBeNull();
    }
  });
});
