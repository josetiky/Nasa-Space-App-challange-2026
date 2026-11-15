import { describe, expect, it } from "vitest";
import type { SimEvent } from "../contracts";
import { twoCorridorField } from "../costmap/synthetic";
import { decideReplan } from "./replanner";
import { createSession, dispatch, tick } from "./session";

describe("Mars Trek simulation session & dynamic replanner (Task 10)", () => {
  it("T-07: switches goal to shelter and latches CRITICAL on falla_ventilador until human authorization", () => {
    const field = twoCorridorField();
    let session = createSession({
      terrain: field.terrain,
      origin: field.origin,
      goal: field.goal,
      shelters: [field.shelter],
    });

    expect(session.fsm.state).toBe("NORMAL");
    expect(session.routeResult.ok).toBe(true);

    // Inject falla_ventilador -> CRITICAL
    session = dispatch(session, {
      kind: "health-incident",
      incident: "falla_ventilador",
      simulated: true,
    });

    expect(session.fsm.state).toBe("CRITICAL");
    expect(session.fsm.latch).toBe("return-mode");
    expect(session.directive.goalPolicy).toBe("nearest-shelter");
    expect(session.routeResult.ok).toBe(true);
    if (session.routeResult.ok) {
      expect(session.routeResult.effectiveGoal).toEqual(field.shelter.point);
    }

    // Even if incident returns to nominal, CRITICAL stays latched without human authorization or reaching shelter
    session = dispatch(session, {
      kind: "health-incident",
      incident: "nominal",
      simulated: true,
    });
    expect(session.fsm.state).toBe("CRITICAL");

    // Human authorization with justification steps down 1 level (CRITICAL -> CAUTION) and records justification
    session = dispatch(session, {
      kind: "human-authorize",
      by: "HAB-COM-1",
      justification: "Ventilador secundario estable y CO2 normalizado",
      atShelter: true,
      simulated: true,
    });
    expect(session.fsm.state).toBe("CAUTION");
    const lastTransition = session.fsm.history[session.fsm.history.length - 1];
    expect(lastTransition?.humanConfirmed?.by).toBe("HAB-COM-1");
    expect(lastTransition?.humanConfirmed?.justification).toContain("Ventilador secundario");
  });

  it("T-03: invalidates route when active storm polygon enters path and replans around the storm without crossing it", () => {
    const field = twoCorridorField();
    let session = createSession({
      terrain: field.terrain,
      origin: field.origin,
      goal: field.goal,
      shelters: [field.shelter],
      weightProfile: "fastest",
    });

    // Initially uses Corridor A along z = 0
    expect(session.activeRoute).not.toBeNull();
    expect(session.activeRoute!.points.every((p) => Math.abs(p.z) <= 6)).toBe(true);

    // Place an active storm polygon at (0, 0) radius 8 blocking Corridor A
    const stormCenter = { x: 0, z: 0 };
    const stormRadius = 8;
    session = dispatch(session, {
      kind: "storm-appear",
      storm: {
        id: "storm-t03",
        name: "Tormenta Local",
        center: stormCenter,
        radiusM: stormRadius,
        tau: 2.5,
        active: true,
        dataType: "SIMULATED",
      },
      simulated: true,
    });

    expect(session.activeRoute).not.toBeNull();
    // New route detours via Corridor B and no point lies inside the storm polygon
    for (const pt of session.activeRoute!.points) {
      const dist = Math.hypot(pt.x - stormCenter.x, pt.z - stormCenter.z);
      expect(dist).toBeGreaterThan(stormRadius);
    }
    const lastLog = session.replanLog[session.replanLog.length - 1];
    expect(lastLog?.decision).toBe("replan");
    expect(lastLog?.causes).toContain("storm:storm-t03");
  });

  it("enforces stability rule: proposes alternative only when cost improves by > 10 % and keeps route otherwise", () => {
    const field = twoCorridorField();
    const session = createSession({
      terrain: field.terrain,
      origin: field.origin,
      goal: field.goal,
      shelters: [field.shelter],
    });
    const currentRoute = session.activeRoute!;

    // Minor cost change (0% difference) -> keep
    const keepDecision = decideReplan({
      seq: 1,
      atS: 30,
      currentRoute,
      candidateResult: session.routeResult,
      snapshot: session.snapshot,
      envelope: session.envelope,
      weights: { d: 0.25, t: 0.2, r: 0.15, e: 0.15, u: 0.15, h: 0.1 },
      causes: ["dust:0.55"],
    });
    expect(keepDecision.decision).toBe("keep");
    expect(keepDecision.proposedRoute).toBeNull();

    // Synthetic candidate that is 20% cheaper while current route remains valid -> propose
    if (session.routeResult.ok) {
      const cheaperCandidate = {
        ...session.routeResult,
        route: {
          ...session.routeResult.route,
          equivalentCostM: currentRoute.equivalentCostM * 0.75,
        },
      };
      const proposeDecision = decideReplan({
        seq: 2,
        atS: 60,
        currentRoute,
        candidateResult: cheaperCandidate,
        snapshot: session.snapshot,
        envelope: session.envelope,
        weights: { d: 0.25, t: 0.2, r: 0.15, e: 0.15, u: 0.15, h: 0.1 },
        causes: ["cost-drop"],
      });
      expect(proposeDecision.decision).toBe("propose");
      expect(proposeDecision.proposedRoute).not.toBeNull();
    }
  });

  it("Foco 5 & T-11: processes 3 simultaneous events in a single replan with identical result regardless of arrival order", () => {
    const field = twoCorridorField();
    const baseA = createSession({
      terrain: field.terrain,
      origin: field.origin,
      goal: field.goal,
      shelters: [field.shelter],
      weightProfile: "fastest",
    });
    const baseB = createSession({
      terrain: field.terrain,
      origin: field.origin,
      goal: field.goal,
      shelters: [field.shelter],
      weightProfile: "fastest",
    });

    const evStorm: SimEvent = {
      kind: "storm-appear",
      storm: {
        id: "st-sim",
        name: "Storm",
        center: { x: 0, z: 0 },
        radiusM: 8,
        tau: 2.2,
        active: true,
        dataType: "SIMULATED",
      },
      simulated: true,
    };
    const evFatigue: SimEvent = {
      kind: "health-incident",
      incident: "fatiga_progresiva",
      simulated: true,
    };
    const evBat: SimEvent = {
      kind: "battery-drop",
      dropPct: 25,
      simulated: true,
    };

    const resOrder1 = dispatch(baseA, [evStorm, evFatigue, evBat]);
    const resOrder2 = dispatch(baseB, [evBat, evStorm, evFatigue]);

    // Exactly ONE replan record added
    expect(resOrder1.replanLog).toHaveLength(1);
    expect(resOrder2.replanLog).toHaveLength(1);

    // Identical envelope, state, route and deterministicKey regardless of order
    expect(resOrder1.fsm.state).toBe("FATIGUE");
    expect(resOrder1.fsm.state).toBe(resOrder2.fsm.state);
    expect(resOrder1.envelope.envelopeId).toBe(resOrder2.envelope.envelopeId);
    expect(resOrder1.activeRoute?.points).toEqual(resOrder2.activeRoute?.points);
    if (resOrder1.routeResult.ok && resOrder2.routeResult.ok) {
      expect(resOrder1.routeResult.explanation.deterministicKey).toBe(
        resOrder2.routeResult.explanation.deterministicKey,
      );
    }
  });

  it("escalates to CRITICAL via EVA-01 when return margin becomes negative", () => {
    const field = twoCorridorField();
    let session = createSession({
      terrain: field.terrain,
      origin: field.origin,
      goal: field.goal,
      shelters: [field.shelter],
    });

    // Drain primary O2 so returnMarginMin < 0 (reserve is 30 min)
    session = dispatch(session, {
      kind: "o2-leak",
      dropPsi: 920,
      simulated: true,
    });
    session = tick(session, 5);

    expect(session.fsm.state).toBe("CRITICAL");
    expect(session.directive.goalPolicy).toBe("nearest-shelter");
    expect(session.fsm.activeTriggers.some((t) => t.ruleId === "EVA-01")).toBe(true);
  });
});
