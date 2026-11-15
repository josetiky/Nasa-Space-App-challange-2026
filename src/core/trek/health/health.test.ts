import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/core/rng";
import { healthRank, type HuellaLevel } from "../contracts";
import { evaluateFatigueRules, stepFatigue } from "./fatigue";
import { createInitialFsmState, stepFsm } from "./fsm";
import { composeTeamDirective, directiveFor } from "./directive";

describe("Mars Trek fatigue, FSM & navigation directive (Task 8)", () => {
  it("enters FATIGUE when F >= 0.6 and exits only when F <= 0.4 (hysteresis)", () => {
    let f = 0;
    for (let t = 0; t < 300; t += 1) {
      f = stepFatigue(f, 1, { metabolicW: 650 });
    }
    expect(f).toBeGreaterThanOrEqual(0.6);

    const enter = evaluateFatigueRules({ fatigueIndex: f, wasFatigued: false });
    expect(enter.active).toBe(true);
    expect(enter.triggeredRules.some((r) => r.ruleId === "FAT-06")).toBe(true);

    // At F = 0.5, remains active if wasFatigued is true, but not if false
    expect(evaluateFatigueRules({ fatigueIndex: 0.5, wasFatigued: true }).active).toBe(true);
    expect(evaluateFatigueRules({ fatigueIndex: 0.5, wasFatigued: false }).active).toBe(false);

    // At F = 0.38 <= 0.4, exits FATIGUE
    expect(evaluateFatigueRules({ fatigueIndex: 0.38, wasFatigued: true }).active).toBe(false);
  });

  it("PT-11: enforces single-level step-downs, latches CRITICAL & EMERGENCY until authorized/shelter, and never returns NORMAL on missing telemetry", () => {
    const rng = { next: mulberry32(808) };
    const levels: HuellaLevel[] = ["NORMAL", "PRECAUCION", "SUPERVIVENCIA", "ABORTAR"];
    let state = createInitialFsmState("EVA1");

    for (let step = 1; step <= 300; step += 1) {
      const lv = levels[Math.floor(rng.next() * levels.length)]!;
      const fat = rng.next() > 0.5;
      const cut = rng.next() < 0.15;
      const auth =
        rng.next() < 0.25 ? { by: "HAB-IV1", justification: "Cleared after check" } : undefined;
      const shelter = rng.next() < 0.25;

      const next = stepFsm(state, {
        missionTimeS: step * 10,
        huellaLevel: lv,
        fatigueActive: fat,
        telemetryCut: cut,
        atShelter: shelter,
        ...(auth ? { humanAuthorization: auth } : {}),
      });

      const prevR = healthRank(state.state);
      const nextR = healthRank(next.state);

      // Step-down is at most 1 level at a time
      if (nextR < prevR) {
        expect(prevR - nextR).toBe(1);
      }

      // With sensor cut, never steps down and never produces NORMAL
      if (cut) {
        expect(next.state).not.toBe("NORMAL");
        expect(nextR).toBeGreaterThanOrEqual(prevR);
      }

      // CRITICAL cannot step down without shelter or human authorization
      if (state.state === "CRITICAL" && !shelter && !auth && nextR <= prevR) {
        expect(next.state).toBe("CRITICAL");
      }

      // EMERGENCY cannot step down without human authorization
      if (state.state === "EMERGENCY" && !auth) {
        expect(next.state).toBe("EMERGENCY");
      }

      state = next;
    }
  });

  it("emits state directives matching the specification table with multipliers >= 1 and CRITICAL ladder ending in hold-position", () => {
    const base = createInitialFsmState("EVA1");
    const dNormal = directiveFor(base);
    expect(dNormal.limits.maxSlopeDeg).toBe(20);
    expect(dNormal.goalPolicy).toBe("keep-goal");

    const sFatigue = stepFsm(base, { missionTimeS: 60, fatigueActive: true, fatigueIndex: 0.65 });
    const dFatigue = directiveFor(sFatigue);
    expect(dFatigue.state).toBe("FATIGUE");
    expect(dFatigue.limits.maxSlopeDeg).toBe(15);
    expect(dFatigue.limits.speedFactor).toBe(0.8);
    expect(dFatigue.strainFactor).toBe(2);

    const sCaution = stepFsm(base, {
      missionTimeS: 120,
      huellaLevel: "PRECAUCION",
      causes: ["termica"],
    });
    const dCaution = directiveFor(sCaution);
    expect(dCaution.state).toBe("CAUTION");
    expect(dCaution.limits.maxSlopeDeg).toBe(10);

    const sCritical = stepFsm(base, {
      missionTimeS: 180,
      huellaLevel: "SUPERVIVENCIA",
      causes: ["traje"],
    });
    const dCritical = directiveFor(sCritical);
    expect(dCritical.state).toBe("CRITICAL");
    expect(dCritical.goalPolicy).toBe("nearest-shelter");
    expect(dCritical.fallbackLadder.length).toBeGreaterThanOrEqual(2);
    const lastRung = dCritical.fallbackLadder[dCritical.fallbackLadder.length - 1]!;
    expect(lastRung.goalPolicy).toBe("hold-position");

    for (const d of [dNormal, dFatigue, dCaution, dCritical]) {
      for (const m of Object.values(d.weightMultipliers)) {
        expect(m).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("T-12: composes team directive using the most restrictive member (never the average)", () => {
    const ev1 = directiveFor(createInitialFsmState("EVA1")); // NORMAL: 20°, speed 1.0
    const ev2 = directiveFor(
      stepFsm(createInitialFsmState("EVA2"), { missionTimeS: 30, fatigueActive: true }),
    ); // FATIGUE: 15°, speed 0.8
    const ev3 = directiveFor(
      stepFsm(createInitialFsmState("EVA3"), {
        missionTimeS: 30,
        huellaLevel: "PRECAUCION",
        causes: ["termica"],
      }),
    ); // CAUTION physio: 10°, speed 0.7

    const team = composeTeamDirective([ev1, ev2, ev3]);
    expect(team.state).toBe("CAUTION");
    expect(team.limits.maxSlopeDeg).toBe(10);
    expect(team.limits.speedFactor).toBe(0.7);
    expect(team.rationale.some((r) => r.message.includes("EVA3"))).toBe(true);
  });
});
