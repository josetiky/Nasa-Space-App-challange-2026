import { describe, expect, it } from "vitest";
import type { LocalPoint, NavigationDirective, TourStop } from "../contracts";
import { buildSnapshot } from "../costmap/snapshot";
import { twoCorridorField } from "../costmap/synthetic";
import { composeEnvelope } from "../safety/envelope";
import { createInitialResourceState } from "../resources/consumables";
import { planRoute } from "./planner";

function directive(overrides: Partial<NavigationDirective> = {}): NavigationDirective {
  return {
    directiveId: "dir-tour-test",
    issuedAtS: 0,
    subject: { kind: "crew", id: "EVA1" },
    state: "NORMAL",
    causes: [],
    goalPolicy: "keep-goal",
    limits: { maxSlopeDeg: 20, allowedZones: ["Z0", "Z1"], minConfidence: "K3a", speedFactor: 1.0 },
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

const near = (a: LocalPoint, b: LocalPoint, tol = 1.5) => Math.hypot(a.x - b.x, a.z - b.z) <= tol;

function setup(dir: NavigationDirective = directive()) {
  const field = twoCorridorField();
  const snap = buildSnapshot(field.terrain, { shelters: [field.shelter] });
  const resources = createInitialResourceState("EVA1");
  const env = composeEnvelope("team", "crew-foot", {}, dir, resources, snap);
  const base = {
    requestId: "tour",
    origin: field.origin,
    goal: field.goal,
    missionProfile: "team" as const,
    weightProfile: "balanced" as const,
    vehicle: "crew-foot" as const,
  };
  return { field, snap, resources, env, base };
}

const NORTH: TourStop = {
  id: "north",
  name: "Corredor norte",
  point: { x: 0, z: 36 },
  dwellMin: 30,
};
const WALL: TourStop = { id: "wall", name: "Pared", point: { x: 0, z: 20 }, dwellMin: 20 };

describe("Recorrido con varias paradas científicas", () => {
  it("pasa por la parada en orden, con su tiempo de ciencia, y termina en el destino", () => {
    const { env, snap, resources, base } = setup();
    const res = planRoute({ ...base, stops: [NORTH] }, env, snap, { resources });
    if (!res.ok) throw new Error(res.message);
    const pts = res.route.points;
    expect(pts.some((p) => near(p, NORTH.point))).toBe(true);
    expect(near(pts[pts.length - 1]!, base.goal)).toBe(true);
    const tour = res.tour!;
    expect(tour.legs.map((l) => l.toStopId)).toEqual(["north", null]);
    expect(tour.legs[0]!.dwellMin).toBe(30);
    expect(tour.legs[1]!.arriveMin).toBeGreaterThan(tour.legs[0]!.departMin - 1e-9);
    expect(tour.dwellMin).toBe(30);
    expect(tour.totalMin).toBeCloseTo(tour.walkMin + 30, 6);
    // La ruta caminada no incluye la parada; el plan de recursos sí
    expect(res.route.durationMin).toBeCloseTo(tour.walkMin, 6);
    expect(res.resourcePlan.totals.durationMin).toBeCloseTo(tour.totalMin, 6);
    expect(res.explanation.totals.durationMin).toBeCloseTo(tour.totalMin, 6);
  });

  it("el tiempo de ciencia consume oxígeno y reduce el margen de regreso", () => {
    const { env, snap, resources, base } = setup();
    const short = planRoute({ ...base, stops: [{ ...NORTH, dwellMin: 0 }] }, env, snap, {
      resources,
    });
    const long = planRoute({ ...base, stops: [{ ...NORTH, dwellMin: 60 }] }, env, snap, {
      resources,
    });
    if (!short.ok || !long.ok) throw new Error("sin ruta");
    expect(long.resourcePlan.totals.o2Kg).toBeGreaterThan(short.resourcePlan.totals.o2Kg);
    expect(long.resourcePlan.returnMarginMin).toBeCloseTo(
      short.resourcePlan.returnMarginMin - 60,
      6,
    );
  });

  it("una parada inadmisible se omite con su motivo y el recorrido sigue al destino", () => {
    const { env, snap, resources, base } = setup();
    const res = planRoute({ ...base, stops: [WALL, NORTH] }, env, snap, { resources });
    if (!res.ok) throw new Error(res.message);
    const tour = res.tour!;
    expect(tour.skipped.map((s) => s.stopId)).toEqual(["wall"]);
    expect(tour.skipped[0]!.reason).toBe("goal-inadmissible");
    expect(tour.legs.map((l) => l.toStopId)).toEqual(["north", null]);
  });

  it("con política de refugio (CRITICAL) ignora las paradas y va al refugio", () => {
    const { env, snap, resources, base, field } = setup(
      directive({ state: "CRITICAL", goalPolicy: "nearest-shelter" }),
    );
    const res = planRoute({ ...base, stops: [NORTH] }, env, snap, { resources });
    if (!res.ok) throw new Error(res.message);
    expect(res.tour).toBeUndefined();
    expect(near(res.effectiveGoal, field.shelter.point)).toBe(true);
  });

  it("sin paradas el resultado es el de siempre (sin recorrido)", () => {
    const { env, snap, resources, base } = setup();
    const res = planRoute({ ...base, stops: [] }, env, snap, { resources });
    if (!res.ok) throw new Error(res.message);
    expect(res.tour).toBeUndefined();
  });
});
