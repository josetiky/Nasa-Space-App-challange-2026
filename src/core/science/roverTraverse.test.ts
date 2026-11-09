import { describe, expect, it } from "vitest";
import { computeEvaPlan } from "./eva";
import { MMGIS_SPHERE_RADIUS_M, planRoverTraverseEva, toLocalMetres, type RoverWaypoint, type TraverseStop } from "./roverTraverse";

const DEG = Math.PI / 180;
const NORTH_0_001 = 0.001 * DEG * MMGIS_SPHERE_RADIUS_M; // ≈ 59.27 m

/** Three end-of-drive stops heading north: the first leg was a detour (80 m driven for ~59 m), the second was not. */
const WAYPOINTS: RoverWaypoint[] = [
  { sol: 1, site: 1, drive: 0, lat: 0, lon: 0, elevationM: 0, tiltDeg: 5, driveM: 0, odometerM: 1000 },
  { sol: 2, site: 1, drive: 10, lat: 0.001, lon: 0, elevationM: 3, tiltDeg: 16, driveM: 80, odometerM: 1080 },
  { sol: 3, site: 1, drive: 20, lat: 0.002, lon: 0, elevationM: 3, tiltDeg: 4, driveM: 50, odometerM: 1130 },
];
const STOPS: TraverseStop[] = [
  { id: "s2", sol: 2, title: "Stop 2", kind: "outcrop", weight: 1, text: "Test outcrop", source: { label: "test", url: "https://science.nasa.gov/" } },
];

describe("local frame on the MMGIS sphere", () => {
  it("puts north at −z, east at +x (scaled by cos latitude) and keeps elevation as y", () => {
    const [p] = toLocalMetres([{ lat: -4.799, lon: 137.381, elevationM: -3600 }], { lat: -4.8, lon: 137.38 });
    expect(p!.z).toBeCloseTo(-NORTH_0_001, 3);
    expect(p!.x).toBeCloseTo(NORTH_0_001 * Math.cos(-4.8 * DEG), 3);
    expect(p!.y).toBe(-3600);
  });
});

describe("EVA plan length factors", () => {
  const waypoints = [
    { id: "a", x: 0, y: 0, z: 0 },
    { id: "b", x: 100, y: 0, z: 0 },
  ];
  const samples = [[{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }]];
  const base = computeEvaPlan({ siteId: "t", siteName: "T", waypoints, segmentSamples: samples, pois: [], crew: 1 });

  it("stretches a segment's length, walking time and O₂ by its factor, keeping its grade", () => {
    const longer = computeEvaPlan({ siteId: "t", siteName: "T", waypoints, segmentSamples: samples, pois: [], crew: 1, segmentLengthFactors: [1.5] });
    expect(longer.distanceM).toBeCloseTo(150, 6);
    expect(longer.durationMin).toBeCloseTo(base.durationMin * 1.5, 6);
    expect(longer.o2Kg).toBeCloseTo(base.o2Kg * 1.5, 6);
    expect(longer.maxSlopeDeg).toBe(base.maxSlopeDeg);
  });

  it("never makes a segment shorter than its straight geometry", () => {
    const shorter = computeEvaPlan({ siteId: "t", siteName: "T", waypoints, segmentSamples: samples, pois: [], crew: 1, segmentLengthFactors: [0.5] });
    expect(shorter.distanceM).toBeCloseTo(100, 6);
  });
});

describe("EVA along a rover traverse", () => {
  it("follows Curiosity's odometry where the drive was longer than the straight leg", () => {
    const r = planRoverTraverseEva(WAYPOINTS, STOPS, { fromSol: 1, toSol: 3 });
    expect(r.odometryM).toBeCloseTo(130, 6);
    expect(r.straightM).toBeCloseTo(Math.hypot(NORTH_0_001, 3) + NORTH_0_001, 3);
    expect(r.plan.distanceM).toBeCloseTo(80 + NORTH_0_001, 3);
    expect(r.plan.elevationGainM).toBeCloseTo(3, 6);
    expect(r.plan.waypoints.map((w) => w.id)).toEqual(["sol-1", "sol-2", "sol-3"]);
  });

  it("walks back along the same path when asked, visiting each stop once", () => {
    const one = planRoverTraverseEva(WAYPOINTS, STOPS, { fromSol: 1, toSol: 3 });
    const loop = planRoverTraverseEva(WAYPOINTS, STOPS, { fromSol: 1, toSol: 3, returnToStart: true });
    expect(loop.plan.distanceM).toBeCloseTo(2 * one.plan.distanceM, 6);
    expect(loop.plan.waypoints).toHaveLength(5);
    expect(loop.plan.waypoints.at(-1)).toMatchObject({ x: 0, y: 0, z: 0 });
    expect(loop.plan.poisVisited).toEqual(["Stop 2"]);
  });

  it("flags stops where the rover measured a tilt above the suited-walking caution threshold", () => {
    const r = planRoverTraverseEva(WAYPOINTS, STOPS, { fromSol: 1, toSol: 3 });
    expect(r.steepStops.map((w) => w.sol)).toEqual([2]);
    expect(r.maxTiltDeg).toBe(16);
    expect(r.plan.hazards.some((h) => h.includes("sol 2") && h.includes("16"))).toBe(true);
  });

  it("names steep legs by their sols, once, even when the walk returns over them", () => {
    const steep = WAYPOINTS.map((w) => (w.sol === 2 ? { ...w, elevationM: 30 } : w.sol === 3 ? { ...w, elevationM: 30 } : w));
    const r = planRoverTraverseEva(steep, STOPS, { fromSol: 1, toSol: 3, returnToStart: true });
    const legHazards = r.plan.hazards.filter((h) => h.includes("sol 1 → sol 2"));
    expect(legHazards).toHaveLength(1);
    expect(legHazards[0]).toMatch(/27° .*no-go/);
    expect(r.plan.hazards.some((h) => h.startsWith("Segment"))).toBe(false);
  });

  it("plans only the chosen span and can walk it in either direction", () => {
    const r = planRoverTraverseEva(WAYPOINTS, STOPS, { fromSol: 3, toSol: 2 });
    expect(r.plan.waypoints.map((w) => w.id)).toEqual(["sol-3", "sol-2"]);
    expect(r.plan.distanceM).toBeCloseTo(NORTH_0_001, 3);
    expect(r.odometryM).toBeCloseTo(50, 6);
  });

  it("rejects a sol that is not on the traverse", () => {
    expect(() => planRoverTraverseEva(WAYPOINTS, STOPS, { fromSol: 1, toSol: 9 })).toThrow(/sol 9/);
  });
});
