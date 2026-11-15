import { describe, expect, it } from "vitest";
import { createHeightGrid } from "@/core/science/routing";
import { mulberry32 } from "@/core/rng";
import { confidenceRank, type NavigationDirective, type ZoneClass } from "../contracts";
import { buildStaticTerrain } from "../costmap/terrain";
import { buildSnapshot } from "../costmap/snapshot";
import { createInitialResourceState } from "../resources/consumables";
import { applyMultipliers, validateWeights, WEIGHT_PROFILES, WeightError } from "./weights";
import { edgeCost } from "./terms";
import { composeEnvelope, isSafetyEnvelope } from "../safety/envelope";

function makeDirective(overrides: Partial<NavigationDirective> = {}): NavigationDirective {
  return {
    directiveId: "dir-test-1",
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

describe("Mars Trek weights, edge cost & safety envelope (Task 5)", () => {
  it("PT-15: rejects negative, non-finite, or w_d < 0.05 weights and normalizes valid weights to sum 1", () => {
    expect(() => validateWeights({ d: -0.1, t: 0.2, r: 0.2, e: 0.2, u: 0.2, h: 0.3 })).toThrow(
      WeightError,
    );
    expect(() =>
      validateWeights({ d: Number.NaN, t: 0.2, r: 0.2, e: 0.2, u: 0.2, h: 0.2 }),
    ).toThrow(WeightError);
    expect(() => validateWeights({ d: 0.02, t: 0.3, r: 0.2, e: 0.2, u: 0.2, h: 0.08 })).toThrow(
      WeightError,
    );

    for (const profile of Object.values(WEIGHT_PROFILES)) {
      const sum = profile.d + profile.t + profile.r + profile.e + profile.u + profile.h;
      expect(sum).toBeCloseTo(1, 9);
      expect(profile.d).toBeGreaterThanOrEqual(0.05 - 1e-12);
    }

    const mult = applyMultipliers(WEIGHT_PROFILES.balanced, { t: 2, r: 3, u: 2, h: 3 });
    const multSum = mult.d + mult.t + mult.r + mult.e + mult.u + mult.h;
    expect(multSum).toBeCloseTo(1, 9);
    expect(mult.d).toBeGreaterThanOrEqual(0.05 - 1e-12);
    expect(mult.r / mult.d).toBeGreaterThan(
      WEIGHT_PROFILES.balanced.r / WEIGHT_PROFILES.balanced.d,
    );
  });

  it("PT-02: satisfies triangle consistency h(a) <= c(a->b) + h(b) across 500 seeded random cases", () => {
    const next = mulberry32(20261115);
    const rng = { next };
    const zones: ZoneClass[] = ["Z0", "Z1", "Z2"];

    for (let k = 0; k < 500; k += 1) {
      const raw = {
        d: 0.08 + rng.next() * 0.6,
        t: rng.next() * 0.4,
        r: rng.next() * 0.4,
        e: rng.next() * 0.4,
        u: rng.next() * 0.4,
        h: rng.next() * 0.4,
      };
      const w = validateWeights(raw);

      const ax = (rng.next() - 0.5) * 100;
      const az = (rng.next() - 0.5) * 100;
      const dx = rng.next() > 0.5 ? 1 : 0;
      const dz = dx === 0 ? 1 : rng.next() > 0.5 ? 1 : 0;
      const bx = ax + dx;
      const bz = az + dz;
      const gx = (rng.next() - 0.5) * 100;
      const gz = (rng.next() - 0.5) * 100;

      const dHoriz = Math.hypot(bx - ax, bz - az);
      const slopeDeg = (rng.next() - 0.3) * 28;
      const deltaZ = dHoriz * Math.tan((slopeDeg * Math.PI) / 180);
      const length3dM = Math.hypot(dHoriz, deltaZ);

      const cost = edgeCost(
        {
          length3dM,
          slopeDeg,
          roughness: rng.next(),
          softSoilProb: rng.next(),
          dustTau: 0.3 + rng.next() * 2.5,
          doseRateMsvPerSol: 0.4 + rng.next() * 1.5,
          confidenceScore: rng.next(),
          zone: zones[Math.floor(rng.next() * zones.length)]!,
          speedFactor: 0.6 + rng.next() * 0.4,
          strainFactor: 1 + rng.next() * 2,
        },
        w,
      );

      const hA = w.d * Math.hypot(gx - ax, gz - az);
      const hB = w.d * Math.hypot(gx - bx, gz - bz);
      expect(hA).toBeLessThanOrEqual(cost.totalCostM + hB + 1e-9);

      const sumParts =
        cost.contributions.D +
        cost.contributions.T +
        cost.contributions.R +
        cost.contributions.E +
        cost.contributions.U +
        cost.contributions.H;
      expect(sumParts).toBeCloseTo(cost.totalCostM, 9);
    }
  });

  it("PT-05: composes safety envelope monotonically (most restrictive wins) and never allows Z5", () => {
    const grid = createHeightGrid(-10, -10, 1, 21, 21);
    grid.h.fill(0);
    const snap = buildSnapshot(buildStaticTerrain(grid, { siteId: "env_test" }));
    const res = createInitialResourceState("EVA1");

    const laxDirective = makeDirective({
      limits: {
        maxSlopeDeg: 28,
        allowedZones: ["Z0", "Z1", "Z2", "Z5"],
        minConfidence: "K4",
        speedFactor: 1.0,
      },
    });
    const env = composeEnvelope(
      "team",
      { maxSlopeDeg: 20, allowedZones: ["Z0", "Z1", "Z5"] },
      { allowedZones: ["Z0", "Z1", "Z2", "Z5"] },
      laxDirective,
      res,
      snap,
    );

    expect(isSafetyEnvelope(env)).toBe(true);
    // Vehicle limit 20° beats lax directive 28°
    expect(env.maxSlopeDeg).toBe(20);
    // Mission profile 'team' minConfidence K3a beats lax directive K4
    expect(confidenceRank(env.minConfidence)).toBeGreaterThanOrEqual(confidenceRank("K3a"));
    // Z5 is never in allowedZones
    expect(env.allowedZones.has("Z5")).toBe(false);
    expect(env.allowedZones.has("Z2")).toBe(false);

    // Tightening health directive to FATIGUE (15°, K2) never relaxes the envelope
    const strictDirective = makeDirective({
      state: "FATIGUE",
      limits: {
        maxSlopeDeg: 15,
        allowedZones: ["Z0"],
        minConfidence: "K2",
        speedFactor: 0.8,
      },
    });
    const strictEnv = composeEnvelope(
      "team",
      { maxSlopeDeg: 20, allowedZones: ["Z0", "Z1"] },
      { allowedZones: ["Z0", "Z1"] },
      strictDirective,
      res,
      snap,
    );
    expect(strictEnv.maxSlopeDeg).toBe(15);
    expect(strictEnv.allowedZones.has("Z1")).toBe(false);
    expect(strictEnv.minConfidence).toBe("K2");
  });
});
