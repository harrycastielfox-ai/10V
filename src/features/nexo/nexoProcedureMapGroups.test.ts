import { describe, expect, it } from "vitest";
import { groupProcedureMapPoints } from "./nexoProcedureMapGroups";

describe("procedure map marker groups", () => {
  it("keeps colocated facts available in a single marker with their classifications", () => {
    const points = [
      { id: "a", latitude: -9.97, longitude: -67.81, cvli: true },
      { id: "b", latitude: -9.97, longitude: -67.81, cvli: false },
    ];
    const groups = groupProcedureMapPoints(points, 20);
    expect(groups).toHaveLength(1);
    expect(groups[0].points.map((point) => point.id)).toEqual(["a", "b"]);
    expect(groups[0].cvliCount).toBe(1);
  });

  it("separates nearby facts as the user zooms in without changing their ids", () => {
    const points = [
      { id: "a", latitude: -9.97, longitude: -67.81, cvli: true },
      { id: "b", latitude: -9.97, longitude: -67.809, cvli: false },
    ];
    expect(groupProcedureMapPoints(points, 13)).toHaveLength(1);
    expect(groupProcedureMapPoints(points, 18)).toHaveLength(2);
    expect(groupProcedureMapPoints(points.slice().reverse(), 13)).toEqual(
      groupProcedureMapPoints(points, 13),
    );
  });

  it("handles nearby points across bucket borders and ignores invalid coordinates", () => {
    const points = [
      { id: "a", latitude: 0, longitude: 0, cvli: true },
      { id: "b", latitude: 0, longitude: 0.00001, cvli: true },
      { id: "invalid", latitude: Number.NaN, longitude: 0, cvli: false },
      { id: "invalid-range", latitude: 100, longitude: 0, cvli: false },
    ];
    const groups = groupProcedureMapPoints(points, 15);
    expect(groups).toHaveLength(1);
    expect(groups[0].points).toHaveLength(2);
    expect(groups[0].cvliCount).toBe(2);
  });
});
