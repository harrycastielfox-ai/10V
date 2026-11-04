import { describe, expect, it } from "vitest";
import { circleArea, geographicPoint, isGeographicArea } from "./nexoTerritoryCoordinates";

describe("territorial coordinates", () => {
  it("does not interpret legacy image percentages as geographic coordinates", () => {
    expect(isGeographicArea([{ x: 25, y: 30 }])).toBe(false);
    expect(isGeographicArea([])).toBe(false);
    expect(isGeographicArea([geographicPoint(NaN, 20)])).toBe(false);
    expect(isGeographicArea([geographicPoint(91, 20)])).toBe(false);
    expect(isGeographicArea([geographicPoint(-16.575, -39.559)])).toBe(true);
  });
  it("keeps a circular boundary approximately 200m from its chosen center after JSON roundtrip", () => {
    const lat = -16.575;
    const lng = -39.559;
    const points = JSON.parse(JSON.stringify(circleArea(lat, lng, 200)));
    expect(points).toHaveLength(48);
    expect(isGeographicArea(points)).toBe(true);
    for (const point of points) {
      const dy = ((point.y - lat) * Math.PI) / 180;
      const dx = ((point.x - lng) * Math.PI) / 180;
      const a =
        Math.sin(dy / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((point.y * Math.PI) / 180) *
          Math.sin(dx / 2) ** 2;
      expect(6371008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toBeCloseTo(200, 3);
    }
  });
});
