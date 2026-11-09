import type { ActiveEffect, EffectMods, SimState, SystemId } from "../types";
import { CREW_NEEDS, HABITAT_SHIELDING, LIFE_SUPPORT, MARS, POWER } from "../science/constants";

export interface CombinedMods {
  powerGenFactor: number;
  demandKw: number;
  o2LossKgPerSol: number;
  waterLossKgPerSol: number;
  isruFactor: number;
  isruWaterFactor: number;
  eclssFactor: number;
  waterRecoveryFactor: number;
  waterUseFactor: number;
  foodUseFactor: number;
  doseFactor: number;
  healthPerSol: number;
  moralePerSol: number;
  sciencePerSol: number;
  commsDown: boolean;
  evaBlocked: boolean;
  tauAdd: number;
  heatLossFactor: number;
  wear: Record<SystemId, number>;
}

const MULTIPLICATIVE = ["powerGenFactor", "isruFactor", "isruWaterFactor", "eclssFactor", "waterRecoveryFactor", "waterUseFactor", "foodUseFactor", "doseFactor", "heatLossFactor"] as const;
const ADDITIVE = ["demandKw", "o2LossKgPerSol", "waterLossKgPerSol", "healthPerSol", "moralePerSol", "sciencePerSol", "tauAdd"] as const;

export function combineMods(effects: ActiveEffect[]): CombinedMods {
  const combined: CombinedMods = {
    powerGenFactor: 1,
    demandKw: 0,
    o2LossKgPerSol: 0,
    waterLossKgPerSol: 0,
    isruFactor: 1,
    isruWaterFactor: 1,
    eclssFactor: 1,
    waterRecoveryFactor: 1,
    waterUseFactor: 1,
    foodUseFactor: 1,
    doseFactor: 1,
    healthPerSol: 0,
    moralePerSol: 0,
    sciencePerSol: 0,
    commsDown: false,
    evaBlocked: false,
    tauAdd: 0,
    heatLossFactor: 1,
    wear: { lifeSupport: 0, power: 0, habitat: 0, comms: 0, rover: 0, isru: 0 },
  };
  for (const effect of effects) {
    const m: EffectMods = effect.mods;
    for (const key of MULTIPLICATIVE) {
      const value = m[key];
      if (typeof value === "number") combined[key] *= value;
    }
    for (const key of ADDITIVE) {
      const value = m[key];
      if (typeof value === "number") combined[key] += value;
    }
    if (m.commsDown) combined.commsDown = true;
    if (m.evaBlocked) combined.evaBlocked = true;
    if (m.systemWearPerSol) {
      for (const [system, value] of Object.entries(m.systemWearPerSol) as Array<[SystemId, number]>) combined.wear[system] += value;
    }
  }
  combined.o2LossKgPerSol = Math.max(0, combined.o2LossKgPerSol);
  combined.waterLossKgPerSol = Math.max(0, combined.waterLossKgPerSol);
  return combined;
}

export interface DailyEnvironment {
  insolationWm2: number;
  tempMinC: number;
  tempMaxC: number;
  doseRateMsv: number;
}

export interface DailyBalance {
  generationKWh: number;
  solarKWh: number;
  fissionKWh: number;
  demandKWh: { base: number; heating: number; isru: number };
  served: { base: number; heating: number; isru: number };
  batteryKWh: number;
  energyBalanceKWh: number;
  oxygen: { consumed: number; regenerated: number; isru: number; leak: number; next: number };
  water: { used: number; recovered: number; isru: number; leak: number; next: number };
  foodNext: number;
  habitatTempC: number;
  doseMsv: number;
}

const solHours = MARS.solHours;

/** Electrical demand (kW) by tier, before load shedding. */
export function demandKw(state: SimState, mods: CombinedMods, outsideMeanC: number) {
  const ctx = state.ctx;
  const base = Math.max(1.5, POWER.habitatBaseKw + POWER.perCrewKw * ctx.crewSize + mods.demandKw);
  const integrityPenalty = 1 + Math.max(0, 100 - state.systems.habitat) / 100;
  // Electrical loads and crew metabolism end up as heat inside the habitat (internal gains).
  const internalGainsKw = POWER.internalGainFraction * base + POWER.crewMetabolicHeatKw * ctx.crewSize;
  const heatLoss = POWER.heatLossKwPerK[ctx.habitat] * (POWER.habitatSetpointC - outsideMeanC) * mods.heatLossFactor * integrityPenalty;
  const heating = Math.max(0, heatLoss - internalGainsKw);
  const isru = ((ctx.isru.oxygenKgPerSol * mods.isruFactor * POWER.isruOxygenKWhPerKg + ctx.isru.waterKgPerSol * mods.isruFactor * mods.isruWaterFactor * POWER.isruWaterKWhPerKg) / solHours) * (state.systems.isru > 5 ? 1 : 0);
  return { base, heating, isru };
}

export function computeDailyBalance(state: SimState, env: DailyEnvironment, mods: CombinedMods, eva: { hours: number; o2Kg: number }): DailyBalance {
  const ctx = state.ctx;
  const crew = ctx.crewSize;
  const powerHealth = 0.4 + 0.6 * (state.systems.power / 100);
  const solarKw = (ctx.power.solarAreaM2 * POWER.pvEfficiency * env.insolationWm2 * state.panelCleanliness) / 1000;
  const fissionKw = ctx.power.fissionUnits * POWER.fissionKwePerUnit;
  const solarKWh = solarKw * solHours * powerHealth * mods.powerGenFactor;
  const fissionKWh = fissionKw * solHours * (0.6 + 0.4 * (state.systems.power / 100)) * Math.min(1, mods.powerGenFactor + 0.3);
  const generationKWh = solarKWh + fissionKWh;

  const outsideMean = (env.tempMinC + env.tempMaxC) / 2;
  const d = demandKw(state, mods, outsideMean);
  const demand = { base: d.base * solHours, heating: d.heating * solHours, isru: d.isru * solHours };

  let available = generationKWh + state.resources.batteryKWh;
  const serve = (need: number) => {
    if (need <= 0) return 1;
    const used = Math.min(available, need);
    available -= used;
    return used / need;
  };
  const served = { base: serve(demand.base), heating: serve(demand.heating), isru: serve(demand.isru) };
  const consumedEnergy = demand.base * served.base + demand.heating * served.heating + demand.isru * served.isru;
  const batteryKWh = Math.min(ctx.capacities.batteryKWh, Math.max(0, state.resources.batteryKWh + generationKWh - consumedEnergy));

  // Life support efficiency: subsystem health, power served to the base tier and active effects.
  const eclss = Math.max(0, (state.systems.lifeSupport / 100) ** 0.5 * served.base * mods.eclssFactor);

  // Oxygen (kg)
  const metabolicO2 = crew * CREW_NEEDS.oxygenKgPerDay * (MARS.solSeconds / 86400);
  const consumedO2 = metabolicO2 + eva.o2Kg;
  const regenerated = metabolicO2 * LIFE_SUPPORT.oxygenRegeneration * eclss;
  const isruHealth = state.systems.isru / 100;
  const isruO2 = ctx.isru.oxygenKgPerSol * mods.isruFactor * served.isru * isruHealth;
  const nextO2 = Math.min(ctx.capacities.oxygenKg, state.resources.oxygenKg - consumedO2 + regenerated + isruO2 - mods.o2LossKgPerSol);

  // Water (kg)
  const used = crew * (CREW_NEEDS.potableWaterKgPerDay + CREW_NEEDS.hygieneWaterKgPerDay) * mods.waterUseFactor * (MARS.solSeconds / 86400);
  const recoveryFraction = Math.min(LIFE_SUPPORT.issWaterRecovery, LIFE_SUPPORT.issWaterRecovery * Math.min(1, (state.systems.lifeSupport / 100) * served.base) * mods.waterRecoveryFactor);
  const recovered = used * recoveryFraction;
  const iceAccess = 0.2 + 0.8 * ctx.environment.iceLikelihood;
  const isruWater = ctx.isru.waterKgPerSol * mods.isruFactor * mods.isruWaterFactor * served.isru * isruHealth * iceAccess;
  const nextWater = Math.min(ctx.capacities.waterKg, state.resources.waterKg - used + recovered + isruWater - mods.waterLossKgPerSol);

  const foodNext = state.resources.foodCrewDays - crew * mods.foodUseFactor;

  // Habitat thermal state: relax toward the equilibrium set by internal gains + heating,
  // capped by the thermostat (excess heat is rejected).
  const integrityPenalty = 1 + Math.max(0, 100 - state.systems.habitat) / 100;
  const ua = POWER.heatLossKwPerK[ctx.habitat] * mods.heatLossFactor * integrityPenalty;
  const gainsKw = POWER.internalGainFraction * d.base * served.base + POWER.crewMetabolicHeatKw * crew + d.heating * served.heating;
  const equilibriumC = outsideMean + gainsKw / Math.max(1e-3, ua);
  const targetC = Math.min(POWER.habitatSetpointC, equilibriumC);
  const habitatTempC = state.habitatTempC + POWER.habitatThermalResponse * (targetC - state.habitatTempC);

  // Radiation: crew inside the habitat except during EVA hours.
  const shielding = HABITAT_SHIELDING[ctx.habitat];
  const evaFraction = Math.min(1, eva.hours / solHours);
  const doseMsv = env.doseRateMsv * mods.doseFactor * ((1 - evaFraction) * (1 - shielding) + evaFraction);

  return {
    generationKWh,
    solarKWh,
    fissionKWh,
    demandKWh: demand,
    served,
    batteryKWh,
    energyBalanceKWh: generationKWh - consumedEnergy,
    oxygen: { consumed: consumedO2, regenerated, isru: isruO2, leak: mods.o2LossKgPerSol, next: nextO2 },
    water: { used, recovered, isru: isruWater, leak: mods.waterLossKgPerSol, next: nextWater },
    foodNext,
    habitatTempC,
    doseMsv,
  };
}

/** Sols of supply (conservative accounting used for margins and the decision engine). */
export function reserveSols(state: Pick<SimState, "resources" | "ctx">) {
  const crew = state.ctx.crewSize;
  const oxygen = state.resources.oxygenKg / (crew * CREW_NEEDS.oxygenKgPerDay);
  // ASSUMPTION: water margin assumes recovery degraded to 80 % (20 % of daily use lost).
  const water = state.resources.waterKg / (crew * (CREW_NEEDS.potableWaterKgPerDay + CREW_NEEDS.hygieneWaterKgPerDay) * 0.2);
  const food = state.resources.foodCrewDays / crew;
  return { oxygen, water, food, min: Math.min(oxygen, water, food) };
}
