/**
 * Planning helpers: supply sizing that mirrors the simulator's consumption
 * model, and a multi-seed feasibility preview run with the default autopilot.
 */
import { hashSeed } from "../rng";
import { CREW_NEEDS, LIFE_SUPPORT, MARS } from "../science/constants";
import type { MissionPlan } from "../types";
import { createInitialState, defaultPolicy, simulateForward } from "./engine";

export interface SizingInput {
  crewSize: number;
  durationSols: number;
  isru: { oxygenKgPerSol: number; waterKgPerSol: number };
  /** 0..1 ground-ice proxy of the site (ISRU water yield factor 0.2 + 0.8·ice, as in the simulator). */
  iceLikelihood: number;
  evaEverySols: number;
  evaO2Kg: number;
  /** Sols of reserve kept on top of the mission need (default 30). */
  marginSols?: number;
  /** Fractional contingency on the nominal mission need (default 0.25). */
  contingency?: number;
}

export interface SupplySizing {
  oxygenKg: number;
  waterKg: number;
  foodCrewDays: number;
  spareParts: number;
  reserve: { oxygenKg: number; waterKg: number };
  basis: string[];
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function sizeSupplies(input: SizingInput): SupplySizing {
  const crew = Math.max(1, Math.round(input.crewSize));
  const sols = Math.max(1, Math.round(input.durationSols));
  const marginSols = input.marginSols ?? 30;
  const contingency = input.contingency ?? 0.25;
  const solFactor = MARS.solSeconds / 86400;

  const metabolicO2 = crew * CREW_NEEDS.oxygenKgPerDay * solFactor;
  const evaO2PerSol = input.evaEverySols > 0 ? input.evaO2Kg / input.evaEverySols : 0;
  const lossO2 = metabolicO2 * (1 - LIFE_SUPPORT.oxygenRegeneration) + evaO2PerSol;
  const netO2 = Math.max(0, lossO2 - input.isru.oxygenKgPerSol);

  const waterUse = crew * (CREW_NEEDS.potableWaterKgPerDay + CREW_NEEDS.hygieneWaterKgPerDay) * solFactor;
  const lossWater = waterUse * (1 - LIFE_SUPPORT.issWaterRecovery);
  const netWater = Math.max(0, lossWater - input.isru.waterKgPerSol * (0.2 + 0.8 * Math.max(0, Math.min(1, input.iceLikelihood))));

  // Reserve: `marginSols` with ISRU offline, plus 2 sols of open-loop O₂ and 3 of open-loop water.
  const reserveO2 = lossO2 * marginSols + metabolicO2 * 2;
  const reserveWater = lossWater * marginSols + waterUse * 3;

  return {
    oxygenKg: round1(netO2 * sols * (1 + contingency) + reserveO2),
    waterKg: round1(netWater * sols * (1 + contingency) + reserveWater),
    foodCrewDays: crew * (sols + marginSols),
    spareParts: Math.ceil(sols / 15) + 2,
    reserve: { oxygenKg: round1(reserveO2), waterKg: round1(reserveWater) },
    basis: [
      `Crew needs from NASA BVAD (Anderson et al. 2018): O₂ ${CREW_NEEDS.oxygenKgPerDay} kg, water ${CREW_NEEDS.potableWaterKgPerDay + CREW_NEEDS.hygieneWaterKgPerDay} kg, food ${CREW_NEEDS.foodKgPerDay} kg per crew-day.`,
      `Closure: ${Math.round(LIFE_SUPPORT.oxygenRegeneration * 100)} % O₂ regeneration (assumption), ${Math.round(LIFE_SUPPORT.issWaterRecovery * 100)} % water recovery (ISS 2023).`,
      `Net loss ${netO2.toFixed(2)} kg O₂ and ${netWater.toFixed(2)} kg water per sol after ISRU; +${Math.round(contingency * 100)} % contingency.`,
      `Reserve: ${marginSols} sols with ISRU offline + short open-loop buffers; food for ${sols + marginSols} sols.`,
    ],
  };
}

export interface FeasibilityPreview {
  runs: number;
  successRate: number;
  compromisedRate: number;
  failureRate: number;
  failureCauses: Record<string, number>;
  medianFinalHealth: number;
  medianScience: number;
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** Generic failure category (the sol number is stripped so causes aggregate across runs). */
const causeKey = (cause: string) => cause.replace(/ on sol \d+|\(sol \d+\)|sol \d+/g, "").replace(/\s+/g, " ").replace(/\s\./, ".").trim();

/** Run the plan with `runs` seeds and the default autopilot (events resolved with their default option). */
export function feasibilityPreview(plan: MissionPlan, runs = 12): FeasibilityPreview {
  let success = 0;
  let compromised = 0;
  let failed = 0;
  const causes: Record<string, number> = {};
  const health: number[] = [];
  const science: number[] = [];
  for (let k = 0; k < runs; k += 1) {
    const state = simulateForward(createInitialState({ ...plan, seed: hashSeed(plan.seed, "preview", k) }), plan.durationSols + 1, defaultPolicy, false);
    if (state.status === "failed") {
      failed += 1;
      const key = causeKey(state.failureCause ?? "Unknown failure");
      causes[key] = (causes[key] ?? 0) + 1;
    } else if (state.status === "success") success += 1;
    else compromised += 1;
    health.push(state.crew.health);
    science.push(state.science);
  }
  return {
    runs,
    successRate: success / runs,
    compromisedRate: compromised / runs,
    failureRate: failed / runs,
    failureCauses: causes,
    medianFinalHealth: median(health),
    medianScience: median(science),
  };
}
