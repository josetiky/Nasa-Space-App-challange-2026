import { describe, expect, it } from "vitest";
import { createHeightGrid, findSafePath } from "@/core/science/routing";
import { mulberry32 } from "@/core/rng";
import type { NavigationDirective } from "../contracts";
import { buildStaticTerrain } from "../costmap/terrain";
import { buildSnapshot } from "../costmap/snapshot";
import { twoCorridorField } from "../costmap/synthetic";
import { validateWeights, WEIGHT_PROFILES } from "../cost/weights";
import { composeEnvelope } from "../safety/envelope";
import { createInitialResourceState } from "../resources/consumables";
import { searchPath } from "./astar";
import { validateRoute } from "./trace";
import { planRoute } from "./planner";

function makeDirective(overrides: Partial<NavigationDirective> = {}): NavigationDirective {
  return {
    directiveId: "dir-route-test",
    issuedAtS: 0,
    subject: { kind: "crew", id: "EVA1" },
    state: "NORMAL",
    causes: [],
    goalPolicy: "keep-goal",
    limits: {
      maxSlopeDeg: 20,
      allowedZones: ["Z0", "Z1"],
      minConfidence: "K3a",
      speedFactor: 1.0,
    },
    weightMultipliers: {},
    strainFactor: 1,
    fallbackLadder: [],
    rationale: [],
    latch: "none",
    requiresHumanConfirmation: false,
    simulated: true,
    ...overrides,
  };
}

describe("Mars Trek A*, trace & route planner (Task 6)", () => {
  it("PT-01: matches Dijkstra optimal cost on 200 seeded random grids", () => {
    const rng = { next: mulberry32(101) };
    let foundCount = 0;

    for (let trial = 0; trial < 200; trial += 1) {
      const nx = 9;
      const nz = 9;
      const grid = createHeightGrid(0, 0, 1, nx, nz);
      for (let i = 0; i < grid.h.length; i += 1) {
        grid.h[i] = (rng.next() - 0.5) * 0.3;
      }
      const terrain = buildStaticTerrain(grid, { siteId: `pt01_${trial}` });
      const snap = buildSnapshot(terrain);
      const res = createInitialResourceState("EVA1");
      const env = composeEnvelope("team", "crew-foot", {}, makeDirective(), res, snap);

      const w = validateWeights({
        d: 0.1 + rng.next() * 0.5,
        t: rng.next() * 0.3,
        r: rng.next() * 0.3,
        e: rng.next() * 0.3,
        u: rng.next() * 0.3,
        h: rng.next() * 0.3,
      });

      const origin = { x: 0, z: 0 };
      const goal = { x: nx - 1, z: nz - 1 };

      const astarRes = searchPath(snap, env, w, origin, goal);
      const dijkstraRes = searchPath(snap, env, w, origin, goal, { dijkstraMode: true });

      expect(astarRes.ok).toBe(dijkstraRes.ok);
      if (astarRes.ok && dijkstraRes.ok) {
        foundCount += 1;
        expect(astarRes.totalCostM).toBeCloseTo(dijkstraRes.totalCostM, 7);
        expect(astarRes.expandedNodes).toBeLessThanOrEqual(dijkstraRes.expandedNodes);
      }
    }
    expect(foundCount).toBeGreaterThan(150);
  });

  it("PT-04 & PT-06: never returns a route that violates its safety envelope across 300 random cases, and smoothing never increases cost or maxSlope", () => {
    const rng = { next: mulberry32(404) };
    for (let trial = 0; trial < 300; trial += 1) {
      const nx = 11;
      const nz = 11;
      const grid = createHeightGrid(0, 0, 1, nx, nz);
      for (let i = 0; i < grid.h.length; i += 1) {
        if (rng.next() < 0.08 && i !== 0 && i !== nx * nz - 1) {
          grid.h[i] = Number.NaN;
        } else {
          grid.h[i] = (rng.next() - 0.5) * 0.8;
        }
      }
      const terrain = buildStaticTerrain(grid, { siteId: `pt04_${trial}` });
      const maxSlope = 10 + rng.next() * 10;
      const snap = buildSnapshot(terrain);
      const res = createInitialResourceState("EVA1");
      const dir = makeDirective({
        limits: {
          maxSlopeDeg: maxSlope,
          allowedZones: ["Z0", "Z1"],
          minConfidence: "K3a",
          speedFactor: 1.0,
        },
      });
      const env = composeEnvelope("team", "crew-foot", {}, dir, res, snap);

      const req = {
        requestId: `req-${trial}`,
        origin: { x: 0, z: 0 },
        goal: { x: nx - 1, z: nz - 1 },
        missionProfile: "team" as const,
        weightProfile: "balanced" as const,
        vehicle: "crew-foot" as const,
      };

      const rawPlan = planRoute(req, env, snap, { smooth: false, computeAlternatives: false });
      const smoothPlan = planRoute(req, env, snap, { smooth: true, computeAlternatives: false });

      expect(smoothPlan.ok).toBe(rawPlan.ok);
      if (smoothPlan.ok && rawPlan.ok) {
        const val = validateRoute(smoothPlan.route, snap, env);
        expect(val.ok).toBe(true);
        expect(smoothPlan.route.maxSlopeDeg).toBeLessThanOrEqual(env.maxSlopeDeg + 1e-6);
        // PT-06: smoothing does not increase equivalent cost or steepest slope
        expect(smoothPlan.route.equivalentCostM).toBeLessThanOrEqual(
          rawPlan.route.equivalentCostM + 1e-6,
        );
        expect(smoothPlan.route.maxSlopeDeg).toBeLessThanOrEqual(
          rawPlan.route.rawMaxSlopeDeg + 1e-6,
        );
      }
    }
  });

  it("PT-07: produces identical route, explanation, contributions sum, and deterministicKey for identical inputs", () => {
    const field = twoCorridorField();
    const snap = buildSnapshot(field.terrain, { shelters: [field.shelter] });
    const res = createInitialResourceState("EVA1");
    const env = composeEnvelope("team", "crew-foot", {}, makeDirective(), res, snap);

    const req = {
      requestId: "det-1",
      origin: field.origin,
      goal: field.goal,
      missionProfile: "team" as const,
      weightProfile: "balanced" as const,
      vehicle: "crew-foot" as const,
    };

    const r1 = planRoute(req, env, snap);
    const r2 = planRoute(req, env, snap);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.explanation.deterministicKey).toBe(r2.explanation.deterministicKey);
      expect(r1.route.points).toEqual(r2.route.points);
      expect(r1.route.equivalentCostM).toBeCloseTo(r2.route.equivalentCostM, 9);

      const c = r1.explanation.contributions;
      const sumC = c.D + c.T + c.R + c.E + c.U + c.H;
      expect(sumC).toBeCloseTo(r1.route.equivalentCostM, 7);
    }
  });

  it("T-10 & Foco 1–2: returns ok:false with reason when origin/goal is out-of-bounds or inadmissible, or when Z5 blocks the goal even with zero safety weights", () => {
    const grid = createHeightGrid(0, 0, 1, 15, 15);
    grid.h.fill(0);
    // Create a complete Z5 barrier across column x = 7
    const terrain = buildStaticTerrain(grid, { siteId: "t10_barrier" });
    const manualZones = [];
    for (let z = 0; z < 15; z += 2) {
      manualZones.push({
        id: `z5-${z}`,
        name: "Exclusion Wall",
        center: { x: 7, z },
        radiusM: 2.0,
        zone: "Z5" as const,
        reason: "Fissure",
      });
    }
    const snap = buildSnapshot(terrain, { manualZones });
    const res = createInitialResourceState("EVA1");
    const env = composeEnvelope("team", "crew-foot", {}, makeDirective(), res, snap);

    // 1. Out of bounds origin
    const oob = planRoute(
      {
        requestId: "oob",
        origin: { x: -50, z: 0 },
        goal: { x: 12, z: 7 },
        missionProfile: "team",
        weightProfile: "balanced",
        vehicle: "crew-foot",
      },
      env,
      snap,
    );
    expect(oob.ok).toBe(false);
    if (!oob.ok) expect(oob.reason).toBe("origin-out-of-bounds");

    // 2. Origin on inadmissible Z5 cell
    const inadOrigin = planRoute(
      {
        requestId: "inad",
        origin: { x: 7, z: 7 },
        goal: { x: 12, z: 7 },
        missionProfile: "team",
        weightProfile: "balanced",
        vehicle: "crew-foot",
      },
      env,
      snap,
    );
    expect(inadOrigin.ok).toBe(false);
    if (!inadOrigin.ok) expect(inadOrigin.reason).toBe("origin-inadmissible");

    // 3. Goal behind Z5 barrier even when all non-distance weights are 0 (d=1, t=r=e=u=h=0)
    const zeroSafetyWeights = validateWeights({ d: 1, t: 0, r: 0, e: 0, u: 0, h: 0 });
    const searchBlocked = searchPath(snap, env, zeroSafetyWeights, { x: 1, z: 7 }, { x: 13, z: 7 });
    expect(searchBlocked.ok).toBe(false);
    if (!searchBlocked.ok) {
      expect(searchBlocked.reason).toBe("no-safe-corridor");
    }
  });

  it("T-06: selects Corridor A in NORMAL (and shows B as alternative), switches to Corridor B in FATIGUE citing health slope limit, and routes to shelter in CRITICAL", () => {
    const field = twoCorridorField();
    const snap = buildSnapshot(field.terrain, { shelters: [field.shelter] });
    const res = createInitialResourceState("EVA1");

    const req = {
      requestId: "t06",
      origin: field.origin,
      goal: field.goal,
      missionProfile: "team" as const,
      weightProfile: "fastest" as const,
      vehicle: "crew-foot" as const,
    };

    // 1. NORMAL state (maxSlope 20°): Corridor A (17°) is admissible and shorter
    const envNormal = composeEnvelope(
      "team",
      "crew-foot",
      {},
      makeDirective({ state: "NORMAL" }),
      res,
      snap,
    );
    const resNormal = planRoute(req, envNormal, snap);
    expect(resNormal.ok).toBe(true);
    if (resNormal.ok) {
      // Corridor A stays near z = 0 and has maxSlope ~17°
      expect(resNormal.route.maxSlopeDeg).toBeGreaterThan(15);
      expect(resNormal.route.maxSlopeDeg).toBeLessThanOrEqual(20);
      // Alternatives include Corridor B
      expect(resNormal.explanation.alternatives.some((a) => a.status === "admissible")).toBe(true);
    }

    // 2. FATIGUE state (maxSlope 15°): Corridor A (17° > 15°) is excluded from graph; route takes Corridor B (<= 9°)
    const envFatigue = composeEnvelope(
      "team",
      "crew-foot",
      {},
      makeDirective({
        state: "FATIGUE",
        causes: ["fatiga"],
        limits: {
          maxSlopeDeg: 15,
          allowedZones: ["Z0", "Z1"],
          minConfidence: "K3a",
          speedFactor: 0.8,
        },
        weightMultipliers: { t: 2, e: 1.5, h: 3 },
        strainFactor: 2,
      }),
      res,
      snap,
    );
    const resFatigue = planRoute(req, envFatigue, snap);
    expect(resFatigue.ok).toBe(true);
    if (resFatigue.ok) {
      expect(resFatigue.route.maxSlopeDeg).toBeLessThanOrEqual(15);
      // Route detours north through Corridor B (z >= 22)
      expect(resFatigue.route.points.some((p) => p.z >= 20)).toBe(true);
      // Explanation cites the health slope limit and discarded Corridor A
      expect(resFatigue.explanation.blockedDirectPath.some((b) => b.kind === "slope")).toBe(true);
      expect(resFatigue.explanation.alternatives.some((a) => a.status === "discarded")).toBe(true);
    }

    // 3. CRITICAL state: goalPolicy is nearest-shelter, routes to shelter (-42, -20)
    const envCritical = composeEnvelope(
      "team",
      "crew-foot",
      {},
      makeDirective({
        state: "CRITICAL",
        causes: ["traje"],
        goalPolicy: "nearest-shelter",
        limits: {
          maxSlopeDeg: 15,
          allowedZones: ["Z0", "Z1"],
          minConfidence: "K3a",
          speedFactor: 0.8,
        },
      }),
      res,
      snap,
    );
    const resCritical = planRoute(req, envCritical, snap);
    expect(resCritical.ok).toBe(true);
    if (resCritical.ok) {
      expect(resCritical.effectiveGoal).toEqual(field.shelter.point);
      const lastPt = resCritical.route.points[resCritical.route.points.length - 1]!;
      expect(lastPt).toEqual(field.shelter.point);
    }
  });

  it("PT-08: reproduces findSafePath when configured in edge slope mode with legacy slope cost", () => {
    const grid = createHeightGrid(0, 0, 1, 21, 21);
    for (let j = 0; j < 21; j += 1) {
      for (let i = 0; i < 21; i += 1) {
        const d = Math.hypot(i - 10, j - 10);
        grid.h[j * 21 + i] = d < 4 ? (4 - d) * 0.6 : 0;
      }
    }
    const start = { x: 2, z: 10 };
    const goal = { x: 18, z: 10 };
    const legacy = findSafePath(grid, start, goal, {
      cautionDeg: 15,
      noGoDeg: 25,
      cautionWeight: 4,
    });
    expect(legacy.found).toBe(true);

    const terrain = buildStaticTerrain(grid, { siteId: "pt08" });
    const snap = buildSnapshot(terrain, {}, { maxSlopeDeg: 25, cautionSlopeDeg: 15 });
    const res = createInitialResourceState("EVA1");
    const env = composeEnvelope(
      "team",
      { maxSlopeDeg: 25, allowedZones: ["Z0", "Z1", "Z2", "Z3", "Z4"] },
      { allowedZones: ["Z0", "Z1", "Z2", "Z3", "Z4"], slopeMode: "edge" },
      makeDirective({
        limits: {
          maxSlopeDeg: 25,
          allowedZones: ["Z0", "Z1", "Z2", "Z3", "Z4"],
          minConfidence: "K5",
          speedFactor: 1.0,
        },
      }),
      res,
      snap,
    );

    const search = searchPath(snap, env, WEIGHT_PROFILES.balanced, start, goal, {
      legacySlopeCostOnly: true,
      legacyCautionDeg: 15,
      legacyCautionWeight: 4,
    });
    expect(search.ok).toBe(true);
    if (search.ok) {
      expect(search.rawPoints.length).toBe(legacy.rawCells);
    }
  });
});
