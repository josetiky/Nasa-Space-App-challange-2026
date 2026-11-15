import type { ActionOption, ActiveEffect, EventType, ImmediateEffect, LogKind, MissionEvent, MissionPlan, SimContext, SimState, SystemId } from "../types";
import { hashSeed, streamRng } from "../rng";
import { MARS, POWER } from "../science/constants";
import { backgroundTau, solEnvironment } from "../science/environment";
import { lsFromMsd } from "../science/marsTime";
import { EVENT_PRIORITY, OUTCOME, SYSTEM_WEAR, scenarioMultiplier } from "./config";
import { EVENT_DEFINITIONS } from "./events";
import { checkFailure, finalOutcome } from "./outcome";
import { combineMods, computeDailyBalance, reserveSols } from "./resources";

const SYSTEMS: SystemId[] = ["lifeSupport", "power", "habitat", "comms", "rover", "isru"];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const MAX_LOG = 400;

export const BASE_SCIENCE_PER_SOL = 0.4;
export const EVA_SCIENCE = 6;

export function createInitialState(plan: MissionPlan): SimState {
  const ls = lsFromMsd(plan.startMsd);
  const env = solEnvironment(plan.environment, ls, backgroundTau(ls));
  const ctx: SimContext = {
    missionName: plan.name,
    siteName: plan.site.name,
    crewSize: plan.crewSize,
    habitat: plan.habitat,
    power: plan.power,
    isru: plan.isru,
    environment: plan.environment,
    startMsd: plan.startMsd,
    evaEverySols: plan.evaEverySols,
    evaPlan: plan.eva,
    scenario: plan.scenario,
    eventMultipliers: plan.eventMultipliers,
    riskPosture: plan.riskPosture,
    capacities: {
      oxygenKg: Math.max(plan.supplies.oxygenKg * 1.5, 50),
      waterKg: Math.max(plan.supplies.waterKg * 1.5, 100),
      batteryKWh: Math.max(10, plan.power.batteryKWh),
    },
    initial: { ...plan.supplies, batteryKWh: plan.power.batteryKWh },
  };
  return {
    planId: plan.id,
    seed: plan.seed,
    sol: 0,
    durationSols: plan.durationSols,
    status: "running",
    resources: { ...plan.supplies, batteryKWh: plan.power.batteryKWh },
    systems: { lifeSupport: 100, power: 100, habitat: 100, comms: 100, rover: 100, isru: 100 },
    crew: { size: plan.crewSize, health: 95, morale: 80, doseMsv: 0 },
    habitatTempC: POWER.habitatSetpointC,
    panelCleanliness: 1,
    science: 0,
    scienceTarget: Math.round(plan.durationSols * 0.75),
    env: { ...env, sepActive: false, commsUp: true },
    effects: [],
    pending: null,
    log: [{ sol: 0, kind: "info", text: `${plan.name} begins at ${plan.site.name} with ${plan.crewSize} crew (seed ${plan.seed}, Ls ${ls.toFixed(0)}°).` }],
    history: [],
    decisions: [],
    incidents: [],
    consumption: { oxygenKg: 0, waterKg: 0, foodCrewDays: 0, energyKWh: 0, producedOxygenKg: 0, producedWaterKg: 0, sparePartsUsed: 0 },
    failureCause: null,
    lowMarginSols: 0,
    evaHours: 0,
    ctx,
  };
}

/** Copy of the mutable parts of a state (context is immutable and shared). */
export function cloneState(state: SimState, keepHistory = true): SimState {
  return {
    ...state,
    resources: { ...state.resources },
    systems: { ...state.systems },
    crew: { ...state.crew },
    env: { ...state.env },
    effects: state.effects.map((effect) => ({ ...effect, mods: { ...effect.mods } })),
    pending: state.pending,
    log: keepHistory ? state.log.slice(-MAX_LOG) : [],
    history: keepHistory ? state.history.slice() : state.history.slice(-3),
    decisions: state.decisions.slice(),
    incidents: state.incidents.slice(),
    consumption: { ...state.consumption },
  };
}

function addLog(state: SimState, kind: LogKind, text: string) {
  state.log.push({ sol: state.sol, kind, text });
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

export function isEvaSol(state: SimState, sol: number): boolean {
  return state.ctx.evaEverySols > 0 && sol > 0 && sol % state.ctx.evaEverySols === 0;
}

export function evaAllowedNow(state: SimState): boolean {
  const mods = combineMods(state.effects);
  const sep = state.effects.some((effect) => effect.source === "sep");
  return !mods.evaBlocked && !sep && state.env.tau < 4 && state.crew.health > 40;
}

function applyImmediate(state: SimState, effect: ImmediateEffect) {
  if (effect.resources) {
    for (const [key, delta] of Object.entries(effect.resources) as Array<[keyof SimState["resources"], number]>) {
      if (key === "spareParts" && delta < 0) state.consumption.sparePartsUsed += -delta;
      if (key === "oxygenKg" && delta < 0) state.consumption.oxygenKg += -delta;
      state.resources[key] = state.resources[key] + delta;
    }
    state.resources.oxygenKg = Math.min(state.ctx.capacities.oxygenKg, state.resources.oxygenKg);
    state.resources.batteryKWh = clamp(state.resources.batteryKWh, 0, state.ctx.capacities.batteryKWh);
    state.resources.spareParts = Math.max(0, state.resources.spareParts);
  }
  if (effect.systems) {
    for (const [system, delta] of Object.entries(effect.systems) as Array<[SystemId, number]>) state.systems[system] = clamp(state.systems[system] + delta, 0, 100);
  }
  if (effect.crew) {
    if (effect.crew.health !== undefined) state.crew.health = clamp(state.crew.health + effect.crew.health, 0, 100);
    if (effect.crew.morale !== undefined) state.crew.morale = clamp(state.crew.morale + effect.crew.morale, 0, 100);
    if (effect.crew.doseMsv !== undefined) state.crew.doseMsv = Math.max(0, state.crew.doseMsv + effect.crew.doseMsv);
  }
  if (effect.science) state.science = Math.max(0, state.science + effect.science);
  if (effect.evaHours) state.evaHours += effect.evaHours;
  if (effect.panelCleanliness) state.panelCleanliness = clamp(state.panelCleanliness + effect.panelCleanliness, 0.3, 1);
}

export function optionFeasibility(state: SimState, option: ActionOption): { feasible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const req = option.requires;
  if (req?.spareParts !== undefined && state.resources.spareParts < req.spareParts) reasons.push(`Needs ${req.spareParts} spare kits (have ${state.resources.spareParts}).`);
  if (req?.systems) {
    for (const [system, min] of Object.entries(req.systems) as Array<[SystemId, number]>) {
      if (state.systems[system] < min) reasons.push(`Needs ${system} health ≥ ${min} % (now ${Math.round(state.systems[system])} %).`);
    }
  }
  if (req?.commsUp && !state.env.commsUp) reasons.push("Needs a working communications link.");
  if (req?.evaAllowed && !evaAllowedNow(state)) reasons.push("EVA not allowed right now (shelter order, SEP, dust τ ≥ 4 or crew health ≤ 40 %).");
  return { feasible: reasons.length === 0, reasons };
}

function rollEvent(state: SimState, evaToday: boolean): MissionEvent | null {
  const rng = streamRng(state.seed, state.sol, "events");
  const activeSources = new Set(state.effects.map((effect) => effect.source));
  let chosen: EventType | null = null;
  for (const type of EVENT_PRIORITY) {
    const draw = rng();
    if (chosen) continue;
    if (activeSources.has(type)) continue;
    const def = EVENT_DEFINITIONS[type];
    const p = def.probability(state, evaToday) * scenarioMultiplier(state.ctx.scenario, type, state.ctx.eventMultipliers);
    if (draw < p) chosen = type;
  }
  if (!chosen) return null;
  const def = EVENT_DEFINITIONS[chosen];
  const severity = def.severity(streamRng(state.seed, state.sol, `severity:${chosen}`), state);
  const built = def.build(state, severity);
  return { ...built, id: `ev-${state.sol}-${chosen}`, sol: state.sol, type: chosen, severity };
}

/** Apply an event's immediate and ongoing effects and make it the pending decision (mutates `next`). */
function materializeEvent(next: SimState, event: MissionEvent) {
  if (event.immediate) applyImmediate(next, event.immediate);
  if (event.eventEffect) next.effects.push({ id: event.id, source: event.type, label: event.eventEffect.label, remainingSols: event.eventEffect.sols, mods: event.eventEffect.mods });
  next.pending = event;
  next.status = "awaiting-decision";
  next.incidents.push({ sol: next.sol, type: event.type, title: event.title, severity: event.severity });
  addLog(next, "event", `${event.title}: ${event.description}`);
}

/**
 * Decision sandbox: put an event of the given type and severity on the pending
 * slot exactly as the simulator would (pure — returns a new state).
 */
export function injectEvent(state: SimState, type: EventType, severity: 1 | 2 | 3): SimState {
  const next = cloneState(state);
  const built = EVENT_DEFINITIONS[type].build(next, severity);
  materializeEvent(next, { ...built, id: `ev-${next.sol}-${type}-sandbox`, sol: next.sol, type, severity });
  return next;
}

/** Advance the mission by one sol. Pure: returns a new state. */
export function stepSol(state: SimState, options: { keepHistory?: boolean } = {}): SimState {
  if (state.status !== "running") return state;
  const keep = options.keepHistory ?? true;
  const next = cloneState(state, keep);
  const ctx = next.ctx;
  next.sol = state.sol + 1;
  const sol = next.sol;
  const ls = lsFromMsd(ctx.startMsd + sol);
  const mods = combineMods(next.effects);
  const tau = backgroundTau(ls) + mods.tauAdd;
  const env = solEnvironment(ctx.environment, ls, tau);
  const sepActive = next.effects.some((effect) => effect.source === "sep");
  const commsUp = !mods.commsDown && next.systems.comms > 10;
  next.env = { ...env, sepActive, commsUp };

  const evaToday = isEvaSol(next, sol) && !mods.evaBlocked && !sepActive && tau < 3 && next.crew.health > 45;
  const evaHours = evaToday ? (ctx.evaPlan ? ctx.evaPlan.durationMin / 60 : 4) : 0;
  const evaO2 = evaToday ? (ctx.evaPlan ? ctx.evaPlan.o2Kg : 1.6) : 0;
  if (isEvaSol(next, sol) && !evaToday) addLog(next, "warning", "Scheduled science EVA cancelled (shelter order, SEP, dust or crew health).");

  const balance = computeDailyBalance(next, env, mods, { hours: evaHours, o2Kg: evaO2 });
  const before = reserveSols(next);
  next.resources.oxygenKg = balance.oxygen.next;
  next.resources.waterKg = balance.water.next;
  next.resources.foodCrewDays = balance.foodNext;
  next.resources.batteryKWh = balance.batteryKWh;
  next.habitatTempC = balance.habitatTempC;
  next.crew.doseMsv += balance.doseMsv;
  next.evaHours += evaHours;
  next.consumption.oxygenKg += balance.oxygen.consumed + balance.oxygen.leak;
  next.consumption.waterKg += balance.water.used + balance.water.leak;
  next.consumption.foodCrewDays += state.resources.foodCrewDays - balance.foodNext;
  next.consumption.energyKWh += balance.demandKWh.base * balance.served.base + balance.demandKWh.heating * balance.served.heating + balance.demandKWh.isru * balance.served.isru;
  next.consumption.producedOxygenKg += balance.oxygen.isru + balance.oxygen.regenerated;
  next.consumption.producedWaterKg += balance.water.isru + balance.water.recovered;

  // Dust on the arrays (Pathfinder MAE rate, faster under storms) and rare wind cleaning.
  const envRng = streamRng(next.seed, sol, "environment");
  next.panelCleanliness = clamp(next.panelCleanliness * (1 - POWER.dustDepositionPerSol * (1 + tau / 2)), 0.3, 1);
  if (envRng() < 0.01) {
    next.panelCleanliness = clamp(next.panelCleanliness + 0.1, 0.3, 1);
    addLog(next, "info", "A wind gust cleaned part of the solar arrays.");
  }

  // Crew health and morale.
  let dh = 0.3 + mods.healthPerSol;
  if (next.resources.waterKg <= 0) dh -= 12;
  if (next.resources.foodCrewDays <= 0) dh -= 2.5;
  if (next.habitatTempC < 10) dh -= Math.min(5, (10 - next.habitatTempC) / 4);
  if (balance.served.base < 0.8) dh -= (0.8 - balance.served.base) * 10;
  if (balance.doseMsv > 1.5) dh -= Math.min(6, (balance.doseMsv - 1.5) * 0.8);
  if (next.crew.morale < 30) dh -= 0.5;
  next.crew.health = clamp(next.crew.health + dh, 0, 100);
  let dm = (70 - next.crew.morale) * 0.03 + mods.moralePerSol;
  if (!commsUp && !mods.commsDown) dm -= 0.5;
  if (next.crew.health < 60) dm -= 0.5;
  if (next.habitatTempC < 15) dm -= 0.5;
  if (evaToday) dm += 0.6;
  next.crew.morale = clamp(next.crew.morale + dm, 0, 100);

  // Science.
  let ds = BASE_SCIENCE_PER_SOL * (0.5 + 0.5 * (next.systems.rover / 100)) + mods.sciencePerSol;
  if (evaToday) {
    ds += EVA_SCIENCE * Math.max(0.35, ctx.evaPlan?.scienceValue ?? 0.5);
    addLog(next, "success", `Science EVA completed (${evaHours.toFixed(1)} h, ${evaO2.toFixed(1)} kg O₂).`);
  }
  next.science = Math.max(0, next.science + ds);

  // Wear.
  for (const system of SYSTEMS) {
    const extra = system === "rover" && evaToday ? 0.3 : 0;
    next.systems[system] = clamp(next.systems[system] - SYSTEM_WEAR[system] - mods.wear[system] - extra, 0, 100);
  }

  // Effects tick.
  const remaining: ActiveEffect[] = [];
  for (const effect of next.effects) {
    const left = effect.remainingSols - 1;
    if (left > 0) remaining.push({ ...effect, remainingSols: left });
    else addLog(next, "info", `${effect.label} ended.`);
  }
  next.effects = remaining;

  // Margins and warnings.
  const reserves = reserveSols(next);
  if (reserves.min < OUTCOME.lowMarginSols) next.lowMarginSols += 1;
  if (reserves.oxygen < 10 && before.oxygen >= 10) addLog(next, "warning", `O₂ stock below 10 sols of crew demand (${next.resources.oxygenKg.toFixed(1)} kg).`);
  if (balance.served.heating < 0.999 && state.history.at(-1)?.habitatTempC === POWER.habitatSetpointC) addLog(next, "warning", "Heating partially unpowered — habitat is cooling.");
  if (balance.served.base < 0.999) addLog(next, "critical", `Base loads only ${Math.round(balance.served.base * 100)} % powered — life support degraded.`);

  next.history.push({
    sol,
    oxygenKg: next.resources.oxygenKg,
    waterKg: next.resources.waterKg,
    foodCrewDays: next.resources.foodCrewDays,
    batteryKWh: next.resources.batteryKWh,
    energyBalanceKWh: balance.energyBalanceKWh,
    health: next.crew.health,
    morale: next.crew.morale,
    doseMsv: next.crew.doseMsv,
    habitatTempC: next.habitatTempC,
    tau,
    science: next.science,
    systemsMin: Math.min(...SYSTEMS.map((system) => next.systems[system])),
    integrity: next.systems.habitat,
  });

  const failure = checkFailure(next);
  if (failure) {
    next.status = "failed";
    next.failureCause = failure;
    addLog(next, "critical", failure);
    return next;
  }
  if (sol >= next.durationSols) {
    next.status = finalOutcome(next);
    addLog(next, next.status === "success" ? "success" : "warning", next.status === "success" ? `Mission complete after ${sol} sols — objectives met.` : `Mission completed after ${sol} sols with compromised margins or objectives.`);
    return next;
  }

  const event = rollEvent(next, evaToday);
  if (event) {
    materializeEvent(next, event);
    const afterEvent = checkFailure(next);
    if (afterEvent) {
      next.status = "failed";
      next.failureCause = afterEvent;
      next.pending = null;
      addLog(next, "critical", afterEvent);
    }
  }
  return next;
}

/** Apply the crew's choice for the pending event. */
export function chooseOption(state: SimState, optionId: string, recommendedId: string | null = null, options: { keepHistory?: boolean } = {}): SimState {
  if (state.status !== "awaiting-decision" || !state.pending) return state;
  const next = cloneState(state, options.keepHistory ?? true);
  const event = next.pending!;
  const option = event.options.find((item) => item.id === optionId);
  if (!option) throw new Error(`Unknown option ${optionId} for ${event.type}`);
  const feasibility = optionFeasibility(next, option);
  if (!feasibility.feasible) throw new Error(`Option ${optionId} is not feasible: ${feasibility.reasons.join(" ")}`);

  applyImmediate(next, option.immediate);
  let complication: string | null = null;
  if (option.risk) {
    const rng = streamRng(next.seed, next.sol, `risk:${event.id}:${option.id}`);
    if (rng() < option.risk.probability) {
      applyImmediate(next, option.risk.effect);
      complication = option.risk.label;
      addLog(next, "warning", `Complication: ${option.risk.label}.`);
    }
  }
  if (option.endsEventEffect) next.effects = next.effects.filter((effect) => effect.id !== event.id);
  else if (option.shortensEventEffect) {
    next.effects = next.effects.map((effect) =>
      effect.id === event.id ? { ...effect, remainingSols: Math.max(1, Math.round(effect.remainingSols * (1 - option.shortensEventEffect!))) } : effect,
    );
  }
  if (option.ongoing) next.effects.push({ id: `${event.id}:${option.id}`, source: "action", label: option.ongoing.label, remainingSols: option.ongoing.sols, mods: option.ongoing.mods });

  next.decisions.push({
    sol: next.sol,
    eventType: event.type,
    eventTitle: event.title,
    optionId: option.id,
    optionLabel: option.label,
    recommendedId,
    followedRecommendation: recommendedId ? recommendedId === option.id : null,
    complication,
  });
  addLog(next, "decision", `Decision: ${option.label}${recommendedId ? (recommendedId === option.id ? " (engine recommendation)" : " (overrode the engine recommendation)") : ""}.`);
  next.pending = null;
  next.status = "running";
  const failure = checkFailure(next);
  if (failure) {
    next.status = "failed";
    next.failureCause = failure;
    addLog(next, "critical", failure);
  }
  return next;
}

export type Policy = (state: SimState) => string;

/** Default autopilot: the event's default option if feasible, otherwise the first feasible one. */
export const defaultPolicy: Policy = (state) => {
  const event = state.pending;
  if (!event) return "";
  const preferred = event.options.find((item) => item.id === event.defaultOptionId);
  if (preferred && optionFeasibility(state, preferred).feasible) return preferred.id;
  const firstFeasible = event.options.find((item) => optionFeasibility(state, item).feasible);
  return firstFeasible?.id ?? event.options[event.options.length - 1]!.id;
};

/** Step until a decision is needed, the mission ends or `maxSols` elapse. */
export function runUntilDecision(state: SimState, maxSols = Number.POSITIVE_INFINITY): SimState {
  let current = state;
  let steps = 0;
  while (current.status === "running" && steps < maxSols) {
    current = stepSol(current);
    steps += 1;
  }
  return current;
}

/** Simulate forward, resolving events with a policy (used by the decision engine and tests). */
export function simulateForward(state: SimState, sols: number, policy: Policy = defaultPolicy, keepHistory = false): SimState {
  let current = state;
  const targetSol = state.sol + sols;
  let guard = 0;
  while (guard < sols * 3 + 10) {
    guard += 1;
    if (current.status === "awaiting-decision") {
      current = chooseOption(current, policy(current), null, { keepHistory });
      continue;
    }
    if (current.status !== "running" || current.sol >= targetSol) break;
    current = stepSol(current, { keepHistory });
  }
  return current;
}

/** Re-seed the future of a state (Monte-Carlo sample k), keeping the past intact. */
export function withSeedVariant(state: SimState, k: number): SimState {
  return { ...state, seed: hashSeed(state.seed, "variant", k) };
}

export function solsToHours(sols: number): number {
  return (sols * MARS.solSeconds) / 3600;
}
