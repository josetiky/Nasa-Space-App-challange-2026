import { describe, expect, it } from "vitest";
import { makePlan } from "./fixtures";
import { feasibilityPreview, sizeSupplies } from "./planning";

const base = { crewSize: 4, durationSols: 60, isru: { oxygenKgPerSol: 0, waterKgPerSol: 0 }, iceLikelihood: 0.5, evaEverySols: 0, evaO2Kg: 0 };

describe("supply sizing", () => {
  it("scales with crew and duration", () => {
    const a = sizeSupplies(base);
    const b = sizeSupplies({ ...base, crewSize: 8 });
    const c = sizeSupplies({ ...base, durationSols: 120 });
    expect(b.oxygenKg).toBeCloseTo(a.oxygenKg * 2, 0);
    expect(c.oxygenKg).toBeGreaterThan(a.oxygenKg * 1.5);
    expect(a.foodCrewDays).toBe(4 * (60 + 30));
  });

  it("credits ISRU production but never sizes below the contingency reserve", () => {
    const none = sizeSupplies(base);
    const isru = sizeSupplies({ ...base, isru: { oxygenKgPerSol: 2, waterKgPerSol: 8 } });
    const huge = sizeSupplies({ ...base, isru: { oxygenKgPerSol: 50, waterKgPerSol: 200 } });
    expect(isru.oxygenKg).toBeLessThan(none.oxygenKg);
    expect(isru.waterKg).toBeLessThan(none.waterKg);
    expect(huge.oxygenKg).toBeGreaterThan(0);
    expect(huge.oxygenKg).toBe(huge.reserve.oxygenKg);
  });

  it("budgets suit oxygen for scheduled EVAs", () => {
    expect(sizeSupplies({ ...base, evaEverySols: 5, evaO2Kg: 1.2 }).oxygenKg).toBeGreaterThan(sizeSupplies(base).oxygenKg);
  });

  it("explains its basis", () => {
    expect(sizeSupplies(base).basis.join(" ")).toMatch(/BVAD/);
  });
});

describe("feasibility preview", () => {
  it("is deterministic for the same plan", () => {
    const plan = makePlan({ durationSols: 40 });
    expect(feasibilityPreview(plan, 6)).toEqual(feasibilityPreview(plan, 6));
  });

  it("flags a mission launched without oxygen as failing", () => {
    const plan = makePlan({ durationSols: 40, supplies: { oxygenKg: 0, waterKg: 600, foodCrewDays: 280, spareParts: 8 }, isru: { oxygenKgPerSol: 0, waterKgPerSol: 0 } });
    const preview = feasibilityPreview(plan, 4);
    expect(preview.failureRate).toBe(1);
    expect(Object.keys(preview.failureCauses).join(" ")).toMatch(/oxygen/i);
  });

  it("finds a well-sized training mission survivable", () => {
    const sized = sizeSupplies({ crewSize: 4, durationSols: 60, isru: { oxygenKgPerSol: 2, waterKgPerSol: 8 }, iceLikelihood: 0.4, evaEverySols: 7, evaO2Kg: 1 });
    const plan = makePlan({ durationSols: 60, scenario: "training", supplies: { oxygenKg: sized.oxygenKg, waterKg: sized.waterKg, foodCrewDays: sized.foodCrewDays, spareParts: sized.spareParts } });
    const preview = feasibilityPreview(plan, 8);
    expect(preview.failureRate).toBeLessThanOrEqual(0.125);
    expect(preview.runs).toBe(8);
    expect(preview.successRate + preview.compromisedRate + preview.failureRate).toBeCloseTo(1, 6);
  });
});
