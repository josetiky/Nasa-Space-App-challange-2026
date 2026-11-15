import { describe, expect, it } from "vitest";
import { createHeightGrid } from "@/core/science/routing";
import { confidenceScore } from "../confidence/score";
import { buildStaticTerrain } from "./terrain";
import { buildSnapshot } from "./snapshot";
import { twoCorridorField } from "./synthetic";

describe("Mars Trek costmap, confidence & zones (Task 4)", () => {
  it("keeps cells without elevation as NaN, class K5 and zone Z3 (never 0)", () => {
    const grid = createHeightGrid(-5, -5, 1, 11, 11);
    for (let i = 0; i < grid.h.length; i += 1) grid.h[i] = 0;
    // Mark center cell (0,0) as unknown (NaN)
    const centerIdx = 5 * 11 + 5;
    grid.h[centerIdx] = Number.NaN;

    const terrain = buildStaticTerrain(grid, { siteId: "test_nan" });
    const snap = buildSnapshot(terrain);

    expect(Number.isNaN(snap.sample("elevation", 0, 0))).toBe(true);
    expect(Number.isNaN(snap.sample("slopeDeg", 0, 0))).toBe(true);
    expect(snap.confidenceAt(0, 0)).toBe("K5");
    expect(snap.sample("confidenceScore", 0, 0)).toBe(0);
    expect(snap.zoneAt(0, 0)).toBe("Z3");
  });

  it("classifies slope > 20° as Z5 and 15–20° as Z1 for foot crew", () => {
    const grid = createHeightGrid(0, 0, 1, 10, 10);
    const tan17 = Math.tan((17 * Math.PI) / 180);
    const tan24 = Math.tan((24 * Math.PI) / 180);

    for (let j = 0; j < 10; j += 1) {
      for (let i = 0; i < 10; i += 1) {
        if (j < 3) {
          grid.h[j * 10 + i] = 0; // flat -> Z0
        } else if (j < 6) {
          grid.h[j * 10 + i] = i * tan17; // 17° -> Z1
        } else {
          grid.h[j * 10 + i] = i * tan24; // 24° -> Z5
        }
      }
    }

    const terrain = buildStaticTerrain(grid, { siteId: "test_slopes" });
    const snap = buildSnapshot(terrain);

    expect(snap.zoneAt(4, 1)).toBe("Z0");
    expect(snap.zoneAt(4, 4)).toBe("Z1");
    expect(snap.zoneAt(4, 8)).toBe("Z5");
  });

  it("applies storm polygon as Z5 only while active, manual exclusion as Z5, and restricted zone as Z4 without mutating inputs", () => {
    const grid = createHeightGrid(-10, -10, 1, 21, 21);
    grid.h.fill(0);
    const terrain = buildStaticTerrain(grid, { siteId: "test_dyn" });

    const snapBase = buildSnapshot(terrain);
    expect(snapBase.zoneAt(0, 0)).toBe("Z0");

    const snapActiveStorm = buildSnapshot(terrain, {
      storms: [
        {
          id: "st-1",
          name: "Dust Squall",
          center: { x: 0, z: 0 },
          radiusM: 3,
          tau: 2.5,
          active: true,
          dataType: "SIMULATED",
        },
      ],
    });
    expect(snapActiveStorm.zoneAt(0, 0)).toBe("Z5");
    expect(snapActiveStorm.version).not.toBe(snapBase.version);
    // Base snapshot remains unchanged
    expect(snapBase.zoneAt(0, 0)).toBe("Z0");

    const snapInactiveStorm = buildSnapshot(terrain, {
      storms: [
        {
          id: "st-1",
          name: "Dust Squall",
          center: { x: 0, z: 0 },
          radiusM: 3,
          tau: 2.5,
          active: false,
          dataType: "SIMULATED",
        },
      ],
    });
    expect(snapInactiveStorm.zoneAt(0, 0)).toBe("Z0");

    const snapManual = buildSnapshot(terrain, {
      manualZones: [
        {
          id: "excl",
          name: "Operator Exclusion",
          center: { x: -5, z: -5 },
          radiusM: 2,
          zone: "Z5",
          reason: "Boulder field",
        },
        {
          id: "spec",
          name: "Special Region",
          center: { x: 5, z: 5 },
          radiusM: 2,
          zone: "Z4",
          reason: "COSPAR ice",
        },
      ],
    });
    expect(snapManual.zoneAt(-5, -5)).toBe("Z5");
    expect(snapManual.zoneAt(5, 5)).toBe("Z4");
  });

  it("constructs twoCorridorField with Corridor A around 17° and Corridor B <= 9°, labelled SIMULATED", () => {
    const field = twoCorridorField();
    expect(field.terrain.simulated).toBe(true);
    const snap = buildSnapshot(field.terrain);
    expect(snap.simulated).toBe(true);

    const slopeA = snap.sample("slopeDeg", field.corridorAMidpoint.x, field.corridorAMidpoint.z);
    expect(slopeA).toBeGreaterThan(15.5);
    expect(slopeA).toBeLessThan(18.5);
    expect(snap.zoneAt(field.corridorAMidpoint.x, field.corridorAMidpoint.z)).toBe("Z1");

    const slopeB = snap.sample("slopeDeg", field.corridorBMidpoint.x, field.corridorBMidpoint.z);
    expect(slopeB).toBeGreaterThan(6);
    expect(slopeB).toBeLessThanOrEqual(9.0);
    expect(snap.zoneAt(field.corridorBMidpoint.x, field.corridorBMidpoint.z)).toBe("Z0");
  });

  it("degrades confidence score when data resolution is coarser than required scale", () => {
    const fine = confidenceScore({ cls: "K3a", dataResolutionM: 1, requiredScaleM: 2 });
    const coarse = confidenceScore({ cls: "K3c", dataResolutionM: 200, requiredScaleM: 2 });
    expect(fine).toBeGreaterThan(0.7);
    expect(coarse).toBeLessThan(0.05);
  });
});
