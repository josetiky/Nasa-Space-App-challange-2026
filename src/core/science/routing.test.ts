import { describe, expect, it } from "vitest";
import { createHeightGrid, findSafePath, heightAt, polylineMaxSlope, rasterizeTriangles } from "./routing";

/** Grid of `nx × nz` 1 m cells filled by a height function. */
function gridFrom(nx: number, nz: number, h: (x: number, z: number) => number) {
  const g = createHeightGrid(0, 0, 1, nx, nz);
  for (let j = 0; j < nz; j += 1) for (let i = 0; i < nx; i += 1) g.h[j * nx + i] = h(i, j);
  return g;
}

describe("terrain rasterisation", () => {
  it("fills cells under a triangle with its interpolated height and leaves the rest unknown", () => {
    const g = createHeightGrid(0, 0, 1, 12, 12);
    // Plane y = 0.5·x over the triangle (0,0)-(10,0)-(0,10) in x/z.
    rasterizeTriangles(g, [0, 0, 0, 10, 5, 0, 0, 0, 10]);
    expect(g.h[2 * 12 + 4]).toBeCloseTo(2, 6);
    expect(g.h[1 * 12 + 1]).toBeCloseTo(0.5, 6);
    expect(Number.isNaN(g.h[11 * 12 + 11]!)).toBe(true);
  });

  it("interpolates heights between cell centres", () => {
    const g = gridFrom(5, 5, (x) => x * 2);
    expect(heightAt(g, 1.5, 2)).toBeCloseTo(3, 6);
  });
});

describe("safe route search (A*)", () => {
  it("goes straight across flat ground", () => {
    const r = findSafePath(gridFrom(21, 5, () => 0), { x: 1, z: 2 }, { x: 19, z: 2 });
    expect(r.found).toBe(true);
    expect(r.points).toHaveLength(2);
    expect(r.lengthM).toBeCloseTo(18, 6);
    expect(r.maxSlopeDeg).toBe(0);
  });

  it("detours through the gap in a cliff instead of climbing it", () => {
    const g = gridFrom(21, 11, (x, z) => (x === 10 && z !== 8 ? 10 : 0));
    const r = findSafePath(g, { x: 2, z: 2 }, { x: 18, z: 2 });
    expect(r.found).toBe(true);
    expect(r.lengthM).toBeGreaterThan(16 + 4);
    expect(polylineMaxSlope(g, r.points)).toBeLessThan(25);
    const crossing = r.points.find((p, i) => i > 0 && (r.points[i - 1]!.x - 10) * (p.x - 10) <= 0)!;
    expect(crossing).toBeDefined();
  });

  it("prefers a short detour around a moderate mound over climbing it", () => {
    // 20° mound (caution band) in the middle of the straight line, flat around it.
    const g = gridFrom(41, 21, (x, z) => Math.max(0, 3 - 0.36 * Math.hypot(x - 20, z - 10)));
    const r = findSafePath(g, { x: 5, z: 10 }, { x: 35, z: 10 });
    expect(r.found).toBe(true);
    expect(polylineMaxSlope(g, r.points)).toBeLessThan(15);
  });

  it("reports no route when a cliff or unknown terrain blocks the way", () => {
    expect(findSafePath(gridFrom(21, 11, (x) => (x === 10 ? 10 : 0)), { x: 2, z: 2 }, { x: 18, z: 2 }).found).toBe(false);
    expect(findSafePath(gridFrom(21, 11, (x) => (x === 10 ? Number.NaN : 0)), { x: 2, z: 2 }, { x: 18, z: 2 }).found).toBe(false);
  });

  it("never makes the route steeper when simplifying it", () => {
    const g = gridFrom(41, 21, (x, z) => 0.2 * Math.sin(x / 3) * 3 + 0.15 * z);
    const r = findSafePath(g, { x: 2, z: 2 }, { x: 38, z: 18 });
    expect(r.found).toBe(true);
    expect(polylineMaxSlope(g, r.points)).toBeLessThanOrEqual(r.rawMaxSlopeDeg + 1e-6);
    expect(r.points.length).toBeLessThan(r.rawCells);
  });
});
