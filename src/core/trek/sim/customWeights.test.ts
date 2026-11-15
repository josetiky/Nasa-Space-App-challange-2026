import { describe, expect, it } from "vitest";
import { resolveBaseWeights, WEIGHT_PROFILES } from "../cost/weights";
import { twoCorridorField } from "../costmap/synthetic";
import { createSession, dispatch } from "./session";

const field = twoCorridorField();
const base = () =>
  createSession({
    terrain: field.terrain,
    origin: field.origin,
    goal: field.goal,
    shelters: [field.shelter],
  });

describe("Operator weight preference (set-custom-weights)", () => {
  it("re-plans with the operator's priorities: distance-heavy picks a shorter route than terrain-heavy", () => {
    const distanceFirst = dispatch(base(), {
      kind: "set-custom-weights",
      weights: { d: 0.8, t: 0.04, r: 0.04, e: 0.04, u: 0.04, h: 0.04 },
      simulated: false,
    });
    const terrainFirst = dispatch(base(), {
      kind: "set-custom-weights",
      weights: { d: 0.05, t: 0.7, r: 0.1, e: 0.05, u: 0.05, h: 0.05 },
      simulated: false,
    });
    expect(distanceFirst.routeResult.ok && terrainFirst.routeResult.ok).toBe(true);
    if (!distanceFirst.routeResult.ok || !terrainFirst.routeResult.ok) return;
    expect(distanceFirst.routeResult.route.distanceM).toBeLessThan(
      terrainFirst.routeResult.route.distanceM,
    );
    expect(terrainFirst.routeResult.route.maxSlopeDeg).toBeLessThanOrEqual(
      distanceFirst.routeResult.route.maxSlopeDeg,
    );
    // Weights are normalised (Σw = 1) and exposed as the effective vector used by A*
    const w = distanceFirst.activeWeights;
    expect(w.d + w.t + w.r + w.e + w.u + w.h).toBeCloseTo(1, 6);
    expect(distanceFirst.customWeights?.d).toBeCloseTo(0.8, 6);
  });

  it("never relaxes the safety envelope: the chosen route respects the slope limit whatever the weights", () => {
    const s = dispatch(base(), {
      kind: "set-custom-weights",
      weights: { d: 1, t: 0, r: 0, e: 0, u: 0, h: 0 },
      simulated: false,
    });
    expect(s.routeResult.ok).toBe(true);
    if (s.routeResult.ok)
      expect(s.routeResult.route.maxSlopeDeg).toBeLessThanOrEqual(s.envelope.maxSlopeDeg + 1e-6);
  });

  it("rejects an invalid vector (INV-R1: w_d < 0.05) without touching the session", () => {
    const s0 = base();
    const s1 = dispatch(s0, {
      kind: "set-custom-weights",
      weights: { d: 0, t: 1, r: 0, e: 0, u: 0, h: 0 },
      simulated: false,
    });
    expect(s1.customWeights).toBeNull();
    expect(s1.weightProfile).toBe(s0.weightProfile);
  });

  it("picking a named profile clears the preference; CRITICAL/EMERGENCY ignore it (emergency profile)", () => {
    let s = dispatch(base(), {
      kind: "set-custom-weights",
      weights: { d: 0.2, t: 0.2, r: 0.2, e: 0.2, u: 0.1, h: 0.1 },
      simulated: false,
    });
    expect(s.customWeights).not.toBeNull();
    s = dispatch(s, { kind: "set-weight-profile", profileId: "safest", simulated: false });
    expect(s.customWeights).toBeNull();

    expect(
      resolveBaseWeights("emergency", { d: 0.2, t: 0.2, r: 0.2, e: 0.2, u: 0.1, h: 0.1 }),
    ).toEqual(WEIGHT_PROFILES.emergency);
    s = dispatch(s, {
      kind: "set-custom-weights",
      weights: { d: 0.1, t: 0.5, r: 0.1, e: 0.1, u: 0.1, h: 0.1 },
      simulated: false,
    });
    s = dispatch(s, { kind: "health-incident", incident: "emergencia_medica", simulated: true });
    expect(s.fsm.state).toBe("EMERGENCY");
    // The effective weights follow the emergency profile (distance-dominant), not the operator's terrain-heavy preference
    expect(s.activeWeights.d).toBeGreaterThan(s.activeWeights.t);
  });
});
