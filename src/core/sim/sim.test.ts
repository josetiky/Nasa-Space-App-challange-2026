import { describe, expect, it } from "vitest";
import { CREW_NEEDS, LIFE_SUPPORT, RADIATION } from "../science/constants";
import { scenarioMultiplier } from "./config";
import { chooseOption, createInitialState, defaultPolicy, optionFeasibility, runUntilDecision, simulateForward, stepSol } from "./engine";
import { EVENT_DEFINITIONS } from "./events";
import { makePlan, stateWithEvent } from "./fixtures";
import { buildReport, checkFailure } from "./outcome";
import { combineMods, computeDailyBalance, reserveSols } from "./resources";

const noEvents = { dustStorm: 0, powerFailure: 0, commsLoss: 0, habitatDamage: 0, oxygenLeak: 0, waterFailure: 0, vehicleFailure: 0, medical: 0, sep: 0, discovery: 0 };
const solFactor = 88775.244 / 86400;

describe("resource consumption", () => {
  it("consumes O₂ at the BVAD rate and regenerates the documented fraction", () => {
    const state = createInitialState(makePlan({ isru: { oxygenKgPerSol: 0, waterKgPerSol: 0 }, evaEverySols: 0, eventMultipliers: noEvents }));
    const balance = computeDailyBalance(state, { insolationWm2: 150, tempMinC: -80, tempMaxC: -10, doseRateMsv: 0.66 }, combineMods([]), { hours: 0, o2Kg: 0 });
    const metabolic = 4 * CREW_NEEDS.oxygenKgPerDay * solFactor;
    expect(balance.oxygen.consumed).toBeCloseTo(metabolic, 6);
    expect(balance.oxygen.regenerated).toBeCloseTo(metabolic * LIFE_SUPPORT.oxygenRegeneration, 3);
    expect(balance.oxygen.next).toBeCloseTo(120 - metabolic + metabolic * LIFE_SUPPORT.oxygenRegeneration, 3);
  });

  it("recovers water at the ISS-demonstrated 98 % when life support is healthy", () => {
    const state = createInitialState(makePlan({ isru: { oxygenKgPerSol: 0, waterKgPerSol: 0 }, evaEverySols: 0 }));
    const balance = computeDailyBalance(state, { insolationWm2: 150, tempMinC: -80, tempMaxC: -10, doseRateMsv: 0.66 }, combineMods([]), { hours: 0, o2Kg: 0 });
    const used = 4 * (CREW_NEEDS.potableWaterKgPerDay + CREW_NEEDS.hygieneWaterKgPerDay) * solFactor;
    expect(balance.water.used).toBeCloseTo(used, 6);
    expect(balance.water.recovered).toBeCloseTo(used * 0.98, 6);
  });

  it("sheds ISRU before life support when energy runs out", () => {
    const plan = makePlan({ power: { source: "solar", solarAreaM2: 10, fissionUnits: 0, batteryKWh: 0 }, evaEverySols: 0 });
    const state = { ...createInitialState(plan), resources: { ...createInitialState(plan).resources, batteryKWh: 0 } };
    const balance = computeDailyBalance(state, { insolationWm2: 120, tempMinC: -80, tempMaxC: -10, doseRateMsv: 0.66 }, combineMods([]), { hours: 0, o2Kg: 0 });
    expect(balance.served.isru).toBeLessThanOrEqual(balance.served.base);
    if (balance.demandKWh.heating > 0) expect(balance.served.heating).toBeLessThanOrEqual(balance.served.base);
    expect(balance.served.base).toBeLessThan(1);
    expect(balance.served.isru).toBe(0);
  });

  it("reduces dose inside a better-shielded habitat", () => {
    const surface = createInitialState(makePlan({ habitat: "surface" }));
    const lava = createInitialState(makePlan({ habitat: "lavaTube" }));
    const env = { insolationWm2: 150, tempMinC: -80, tempMaxC: -10, doseRateMsv: 0.66 };
    const a = computeDailyBalance(surface, env, combineMods([]), { hours: 0, o2Kg: 0 });
    const b = computeDailyBalance(lava, env, combineMods([]), { hours: 0, o2Kg: 0 });
    expect(b.doseMsv).toBeLessThan(a.doseMsv);
  });
});

describe("sol advance", () => {
  it("advances one sol, records history and is deterministic", () => {
    const plan = makePlan({ eventMultipliers: noEvents });
    const s0 = createInitialState(plan);
    const s1 = stepSol(s0);
    expect(s1.sol).toBe(1);
    expect(s1.history).toHaveLength(1);
    expect(s0.sol).toBe(0); // pure
    const a = simulateForward(createInitialState(makePlan({ seed: 7 })), 40, defaultPolicy, true);
    const b = simulateForward(createInitialState(makePlan({ seed: 7 })), 40, defaultPolicy, true);
    expect(a.history.map((h) => h.oxygenKg)).toEqual(b.history.map((h) => h.oxygenKg));
    expect(a.incidents).toEqual(b.incidents);
  });

  it("accumulates radiation dose every sol", () => {
    const s = simulateForward(createInitialState(makePlan({ eventMultipliers: noEvents })), 10);
    expect(s.crew.doseMsv).toBeGreaterThan(0);
    expect(s.crew.doseMsv).toBeLessThan(10 * 1);
  });

  it("completes a quiet mission successfully", () => {
    const end = runUntilDecision(createInitialState(makePlan({ eventMultipliers: noEvents, durationSols: 30 })));
    expect(end.sol).toBe(30);
    expect(end.status).toBe("success");
    expect(end.science).toBeGreaterThanOrEqual(end.scienceTarget * 0.7);
  });
});

describe("events", () => {
  it("never triggers events whose probability multiplier is 0", () => {
    const end = runUntilDecision(createInitialState(makePlan({ eventMultipliers: noEvents, durationSols: 80 })));
    expect(end.incidents).toHaveLength(0);
  });

  it("always triggers an event when its multiplier forces probability ≥ 1", () => {
    const s = stepSol(createInitialState(makePlan({ eventMultipliers: { ...noEvents, oxygenLeak: 1e6 } })));
    expect(s.status).toBe("awaiting-decision");
    expect(s.pending?.type).toBe("oxygenLeak");
    expect(s.effects.some((e) => e.source === "oxygenLeak")).toBe(true);
  });

  it("makes dust storms more likely in the dusty season", () => {
    const state = createInitialState(makePlan());
    const clear = EVENT_DEFINITIONS.dustStorm.probability({ ...state, env: { ...state.env, ls: 90 } }, false);
    const dusty = EVENT_DEFINITIONS.dustStorm.probability({ ...state, env: { ...state.env, ls: 250 } }, false);
    expect(dusty).toBeGreaterThan(clear * 3);
  });

  it("applies scenario multipliers and per-plan overrides", () => {
    expect(scenarioMultiplier("dust-season", "dustStorm")).toBe(2.5);
    expect(scenarioMultiplier("dust-season", "dustStorm", { dustStorm: 2 })).toBe(5);
    expect(scenarioMultiplier("nominal", "medical")).toBe(1);
  });

  it("applies the chosen action and resolves the event", () => {
    const base = createInitialState(makePlan({ eventMultipliers: noEvents }));
    const withLeak = stateWithEvent(base, "oxygenLeak", 2);
    const sealed = chooseOption(withLeak, "seal", "seal");
    expect(sealed.status).toBe("running");
    expect(sealed.resources.spareParts).toBe(base.resources.spareParts - 1);
    expect(sealed.effects.some((e) => e.source === "oxygenLeak")).toBe(false);
    expect(sealed.decisions.at(-1)?.followedRecommendation).toBe(true);
  });

  it("blocks infeasible actions", () => {
    const base = createInitialState(makePlan({ supplies: { oxygenKg: 120, waterKg: 600, foodCrewDays: 280, spareParts: 0 }, eventMultipliers: noEvents }));
    const withLeak = stateWithEvent(base, "oxygenLeak", 1);
    const seal = withLeak.pending!.options.find((o) => o.id === "seal")!;
    expect(optionFeasibility(withLeak, seal).feasible).toBe(false);
    expect(() => chooseOption(withLeak, "seal")).toThrow();
  });
});

describe("success and failure conditions", () => {
  it("fails when oxygen is exhausted", () => {
    const plan = makePlan({ supplies: { oxygenKg: 3, waterKg: 600, foodCrewDays: 280, spareParts: 8 }, isru: { oxygenKgPerSol: 0, waterKgPerSol: 8 }, eventMultipliers: noEvents });
    const end = runUntilDecision(createInitialState(plan));
    expect(end.status).toBe("failed");
    expect(end.failureCause).toMatch(/Oxygen/);
  });

  it("aborts when the career dose limit is crossed", () => {
    const s = createInitialState(makePlan());
    expect(checkFailure({ ...s, crew: { ...s.crew, doseMsv: RADIATION.careerLimitMsv + 1 } })).toMatch(/career limit/);
  });

  it("is compromised when science objectives are missed", () => {
    const end = runUntilDecision(createInitialState(makePlan({ eventMultipliers: noEvents, evaEverySols: 0, durationSols: 40 })));
    expect(end.status).toBe("compromised");
  });

  it("builds a report with decisions, consumption and key factors", () => {
    const plan = makePlan({ scenario: "harsh", durationSols: 50, seed: 3 });
    const end = simulateForward(createInitialState(plan), 60, defaultPolicy, true);
    const report = buildReport(end);
    expect(["success", "compromised", "failed"]).toContain(report.outcome);
    expect(report.keyFactors.length).toBeGreaterThan(2);
    expect(report.consumption.oxygenKg).toBeGreaterThan(0);
    expect(reserveSols(end).min).toBeTypeOf("number");
  });
});

describe("event injection (decision sandbox)", () => {
  it("puts a chosen event on the pending slot without mutating the input state", async () => {
    const { injectEvent } = await import("./engine");
    const start = createInitialState(makePlan());
    const before = JSON.stringify(start);
    const s = injectEvent(start, "dustStorm", 2);
    expect(JSON.stringify(start)).toBe(before);
    expect(s.status).toBe("awaiting-decision");
    expect(s.pending?.type).toBe("dustStorm");
    expect(s.pending?.severity).toBe(2);
    expect(s.pending?.options.map((o) => o.id)).toEqual(expect.arrayContaining(["shelter", "reduce"]));
    expect(s.effects.some((e) => e.source === "dustStorm")).toBe(true);
    expect(s.incidents).toHaveLength(1);
  });
});
