import { describe, expect, it } from "vitest";
import { approachPoint, distanceToRouteM } from "./scienceCard";

describe("distanceToRouteM", () => {
  const route = [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 10 },
  ];
  it("is zero on the path and perpendicular distance beside it", () => {
    expect(distanceToRouteM({ x: 5, z: 0 }, route)).toBeCloseTo(0);
    expect(distanceToRouteM({ x: 5, z: 3 }, route)).toBeCloseTo(3);
  });
  it("clamps to the segment ends", () => {
    expect(distanceToRouteM({ x: -4, z: 3 }, route)).toBeCloseTo(5);
    expect(distanceToRouteM({ x: 13, z: 14 }, route)).toBeCloseTo(5);
  });
  it("returns NaN without a route (no data is not zero)", () => {
    expect(Number.isNaN(distanceToRouteM({ x: 0, z: 0 }, []))).toBe(true);
  });
});

describe("approachPoint", () => {
  // Pared de 40° para x >= 0, llano de 5° para x < 0.
  const slopeAt = (x: number) => (x >= 0 ? 40 : 5);
  const yes = () => true;
  it("returns the target cell when it is walkable", () => {
    expect(approachPoint({ x: -6, z: 0 }, 20, slopeAt, () => "Z0", yes)).toEqual({ x: -6, z: 0 });
  });
  it("steps back to the nearest cell whose 3x3 window is within the slope limit", () => {
    expect(approachPoint({ x: 2, z: 0 }, 20, slopeAt, () => "Z0", yes)).toEqual({ x: -2, z: 0 });
  });
  it("never proposes forbidden zones or unknown terrain", () => {
    expect(approachPoint({ x: -6, z: 0 }, 20, slopeAt, () => "Z5", yes)).toBeNull();
    expect(
      approachPoint(
        { x: -6, z: 0 },
        20,
        () => Number.NaN,
        () => "Z0",
        yes,
      ),
    ).toBeNull();
  });
  it("skips walkable islands the planner cannot reach", () => {
    const p = approachPoint(
      { x: -6, z: 0 },
      20,
      slopeAt,
      () => "Z0",
      (c) => c.x <= -10,
    );
    expect(p).not.toBeNull();
    expect(p!.x).toBeLessThanOrEqual(-10);
    expect(
      approachPoint(
        { x: -6, z: 0 },
        20,
        slopeAt,
        () => "Z0",
        () => false,
      ),
    ).toBeNull();
  });
});
