import { describe, expect, it } from "vitest";
import { createInitialState } from "../sim/engine";
import { dustStormScenario, makePlan, stateWithEvent } from "../sim/fixtures";
import { POSTURE_WEIGHTS } from "./criteria";
import { analyzeDecision, identifyRisks } from "./engine";
import { evaluateRules } from "./rules";

const noEvents = { dustStorm: 0, powerFailure: 0, commsLoss: 0, habitatDamage: 0, oxygenLeak: 0, waterFailure: 0, vehicleFailure: 0, medical: 0, sep: 0, discovery: 0 };

describe("decision engine — dust storm example (alternatives A–D)", () => {
  const state = dustStormScenario({ power: { source: "solar", solarAreaM2: 450, fissionUnits: 0, batteryKWh: 250 } }, 2);
  const analysis = analyzeDecision(state, { samples: 16, horizonSols: 10 });

  it("evaluates every alternative with metrics and a score", () => {
    expect(analysis.alternatives.map((a) => a.optionId)).toEqual(["shelter", "relocate", "repair", "reduce"]);
    for (const alt of analysis.alternatives) {
      expect(alt.metrics.survivalProbability).toBeGreaterThanOrEqual(0);
      expect(alt.metrics.survivalProbability).toBeLessThanOrEqual(1);
      expect(alt.consequences.length).toBeGreaterThan(0);
    }
  });

  it("recommends the highest-scoring feasible alternative and explains why", () => {
    const best = analysis.alternatives.filter((a) => a.feasible).sort((a, b) => b.score - a.score)[0]!;
    expect(analysis.recommendedId).toBe(best.optionId);
    expect(analysis.rationale[0]).toContain(best.label);
    expect(analysis.rationale.length).toBeGreaterThan(1);
  });

  it("penalises EVA during a heavy storm through an explicit rule", () => {
    const repair = analysis.alternatives.find((a) => a.optionId === "repair")!;
    expect(repair.rules.some((r) => r.ruleId === "R-DUST-EVA")).toBe(true);
    expect(repair.ruleAdjustment).toBeLessThan(0);
  });

  it("is deterministic and reproducible", () => {
    const again = analyzeDecision(state, { samples: 16, horizonSols: 10 });
    expect(again.recommendedId).toBe(analysis.recommendedId);
    expect(again.alternatives.map((a) => a.score)).toEqual(analysis.alternatives.map((a) => a.score));
    expect(again.deterministicKey).toBe(analysis.deterministicKey);
  });

  it("uses posture weights that sum to 1", () => {
    for (const weights of Object.values(POSTURE_WEIGHTS)) expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
});

describe("decision engine — safety rules", () => {
  it("vetoes EVA-based actions during a solar particle event", () => {
    const state = stateWithEvent(createInitialState(makePlan({ eventMultipliers: noEvents })), "sep", 3);
    const analysis = analyzeDecision(state, { samples: 8 });
    const cont = analysis.alternatives.find((a) => a.optionId === "continue")!;
    expect(cont.feasible).toBe(false);
    expect(analysis.recommendedId).not.toBe("continue");
  });

  it("vetoes actions whose requirements are not met", () => {
    const base = createInitialState(makePlan({ supplies: { oxygenKg: 120, waterKg: 600, foodCrewDays: 280, spareParts: 0 }, eventMultipliers: noEvents }));
    const state = stateWithEvent(base, "oxygenLeak", 2);
    const seal = state.pending!.options.find((o) => o.id === "seal")!;
    expect(evaluateRules(state, state.pending!, seal).some((r) => r.effect === "veto")).toBe(true);
    const analysis = analyzeDecision(state, { samples: 8 });
    expect(analysis.recommendedId).not.toBe("seal");
  });

  it("prefers protecting oxygen when the O₂ reserve is critically low", () => {
    const base = createInitialState(makePlan({ supplies: { oxygenKg: 20, waterKg: 600, foodCrewDays: 280, spareParts: 6 }, eventMultipliers: noEvents }));
    const state = stateWithEvent(base, "oxygenLeak", 3);
    const analysis = analyzeDecision(state, { samples: 12 });
    expect(["seal", "candles", "isolate", "boost-isru"]).toContain(analysis.recommendedId);
    expect(analysis.risks.some((r) => r.text.includes("O₂"))).toBe(true);
    const rec = analysis.alternatives.find((a) => a.optionId === analysis.recommendedId)!;
    const monitorLike = analysis.alternatives.filter((a) => a.feasible).sort((a, b) => a.metrics.survivalProbability - b.metrics.survivalProbability)[0]!;
    expect(rec.metrics.survivalProbability).toBeGreaterThanOrEqual(monitorLike.metrics.survivalProbability);
  });

  it("identifies risks from the mission state", () => {
    const base = createInitialState(makePlan());
    const risks = identifyRisks({ ...base, crew: { ...base.crew, health: 35 }, systems: { ...base.systems, habitat: 20 } });
    expect(risks.filter((r) => r.level === "danger").length).toBeGreaterThanOrEqual(2);
  });
});
