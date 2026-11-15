import { describe, expect, it } from "vitest";
import {
  ALL_SCIENTIFIC_DISCOVERIES,
  MARS_MISSIONS,
  PLANETARY_FEATURES,
  RECONSTRUCTION_LABELS,
  TERRAIN_INTELLIGENCE_SOURCES,
  computeMissionSolMetrics,
  getMissionById,
} from "./marsMissionAtlas";
import { CURIOSITY_ROVER_PARTS, EVA_SITES } from "./evaSites";

describe("Mars Mission Atlas — Scientific Data Foundation", () => {
  it("contains all 11 required Martian surface and aerial missions", () => {
    expect(MARS_MISSIONS).toHaveLength(11);
    const ids = MARS_MISSIONS.map((m) => m.id);
    expect(ids).toEqual([
      "sojourner",
      "spirit",
      "opportunity",
      "curiosity",
      "perseverance",
      "zhurong",
      "ingenuity",
      "viking1",
      "viking2",
      "phoenix",
      "insight",
    ]);
  });

  it("normalizes all mission coordinates to IAU Mars 2000 planetocentric bounds", () => {
    for (const m of MARS_MISSIONS) {
      expect(m.lat).toBeGreaterThanOrEqual(-90);
      expect(m.lat).toBeLessThanOrEqual(90);
      expect(m.lon).toBeGreaterThanOrEqual(-180);
      expect(m.lon).toBeLessThanOrEqual(180);
      expect(m.lon360).toBeGreaterThanOrEqual(0);
      expect(m.lon360).toBeLessThan(360);
      expect(m.elevationM).toBeGreaterThan(-9000);
      expect(m.elevationM).toBeLessThan(22000);
      expect(m.metadata.crs).toBe("IAU Mars 2000 Planetocentric (MOLA Areoid)");
    }
  });

  it("never fabricates mobile trajectories for stationary landers (Viking 1, Viking 2, Phoenix, InSight)", () => {
    const landers = MARS_MISSIONS.filter((m) => m.category === "lander");
    expect(landers).toHaveLength(4);
    for (const lander of landers) {
      expect(lander.hasMobileTraverse).toBe(false);
      expect(lander.totalTraverseKm).toBeNull();
      expect(lander.waypoints).toHaveLength(0);
      const metrics = computeMissionSolMetrics(lander, 100);
      expect(metrics.distanceKm).toBe(0);
      expect(metrics.lat).toBe(lander.lat);
      expect(metrics.lon).toBe(lander.lon);
    }
  });

  it("computes progressive Sol-by-Sol timeline metrics for Perseverance and Curiosity", () => {
    const m20 = getMissionById("perseverance")!;
    const sol1 = computeMissionSolMetrics(m20, 1);
    const sol690 = computeMissionSolMetrics(m20, 690);
    const sol2022 = computeMissionSolMetrics(m20, 2022);

    expect(sol1.distanceKm).toBe(0);
    expect(sol690.distanceKm).toBeGreaterThan(10);
    expect(sol2022.distanceKm).toBeCloseTo(45.25, 2);
    expect(sol2022.cumulativeGainM).toBeGreaterThan(500);
    expect(sol2022.discoveriesUpToSol.length).toBeGreaterThanOrEqual(sol1.discoveriesUpToSol.length);
  });

  it("integrates all 7 Terrain Intelligence sources and 5 Access Mars photogrammetric scenes", () => {
    expect(TERRAIN_INTELLIGENCE_SOURCES.map((s) => s.id)).toEqual([
      "mola",
      "hirise",
      "ctx",
      "themis",
      "crism",
      "hrsc",
      "usgs",
    ]);
    expect(EVA_SITES).toHaveLength(5);
    for (const site of EVA_SITES) {
      expect(site.reconstructionType).toBe("TYPE_A_PHOTOGRAMMETRY");
    }
    expect(CURIOSITY_ROVER_PARTS).toHaveLength(6);
    expect(Object.keys(RECONSTRUCTION_LABELS)).toHaveLength(4);
    expect(ALL_SCIENTIFIC_DISCOVERIES.length).toBeGreaterThanOrEqual(18);
    expect(PLANETARY_FEATURES.length).toBeGreaterThanOrEqual(8);
  });
});
