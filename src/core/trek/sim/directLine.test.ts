import { describe, expect, it } from "vitest";
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

describe("Optimal route vs straight line (Calcular ruta óptima)", () => {
  it("measures the straight line on the same costmap and reports it with the A* explanation", () => {
    const s = dispatch(base(), { kind: "request-replan", simulated: false });
    expect(s.routeResult.ok).toBe(true);
    if (!s.routeResult.ok) return;
    const d = s.routeResult.explanation.directLine;
    expect(d).toBeDefined();
    expect(d!.horizontalM).toBeCloseTo(
      Math.hypot(field.goal.x - field.origin.x, field.goal.z - field.origin.z),
      3,
    );
    expect(d!.distanceM).toBeGreaterThanOrEqual(d!.horizontalM - 1e-6);
    // The explicit request is logged as its own replan cause
    expect(s.replanLog.at(-1)?.causes).toContain("manual:replan");
  });

  it("when a storm blocks the straight line, A* detours over admissible terrain instead of going straight", () => {
    const s = dispatch(base(), {
      kind: "storm-appear",
      storm: {
        id: "st-mid",
        name: "Tormenta central",
        center: { x: 0, z: 0 },
        radiusM: 8,
        tau: 3,
        active: true,
        dataType: "SIMULATED",
      },
      simulated: true,
    });
    expect(s.routeResult.ok).toBe(true);
    if (!s.routeResult.ok) return;
    const d = s.routeResult.explanation.directLine!;
    expect(d.admissible).toBe(false);
    expect(s.routeResult.explanation.blockedDirectPath.length).toBeGreaterThan(0);
    expect(s.routeResult.route.distanceM).toBeGreaterThan(d.horizontalM);
  });
});
