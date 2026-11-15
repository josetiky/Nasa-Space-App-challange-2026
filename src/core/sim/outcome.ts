import type { MissionReport, SimState } from "../types";
import { RADIATION } from "../science/constants";
import { OUTCOME } from "./config";
import { eventLabel } from "./events";

export function checkFailure(state: SimState): string | null {
  if (state.resources.oxygenKg <= 0) return `Oxygen reserves were exhausted on sol ${state.sol}.`;
  const recent = state.history.slice(-OUTCOME.dehydrationSols);
  if (recent.length === OUTCOME.dehydrationSols && recent.every((s) => s.waterKg <= 0)) return `The crew went ${OUTCOME.dehydrationSols} sols without water (sol ${state.sol}).`;
  if (state.crew.health < OUTCOME.failHealth) return `Crew health fell below ${OUTCOME.failHealth} % on sol ${state.sol}; the mission was lost.`;
  if (state.systems.habitat < OUTCOME.failHabitat) return `Habitat integrity collapsed on sol ${state.sol}.`;
  if (state.crew.doseMsv >= RADIATION.careerLimitMsv) return `Accumulated dose passed NASA's ${RADIATION.careerLimitMsv} mSv career limit on sol ${state.sol}; the mission was aborted.`;
  return null;
}

export function finalOutcome(state: SimState): "success" | "compromised" {
  const scienceOk = state.science >= state.scienceTarget * OUTCOME.successScienceFraction;
  const healthOk = state.crew.health >= OUTCOME.successHealth;
  const marginsOk = state.lowMarginSols <= Math.ceil(state.durationSols * OUTCOME.maxLowMarginFraction);
  return scienceOk && healthOk && marginsOk ? "success" : "compromised";
}

export function compromisedReasons(state: SimState): string[] {
  const reasons: string[] = [];
  if (state.science < state.scienceTarget * OUTCOME.successScienceFraction) reasons.push(`Science reached ${Math.round((state.science / Math.max(1, state.scienceTarget)) * 100)} % of the objective (needs ${Math.round(OUTCOME.successScienceFraction * 100)} %).`);
  if (state.crew.health < OUTCOME.successHealth) reasons.push(`Crew health ended at ${Math.round(state.crew.health)} % (needs ${OUTCOME.successHealth} %).`);
  if (state.lowMarginSols > Math.ceil(state.durationSols * OUTCOME.maxLowMarginFraction)) reasons.push(`${state.lowMarginSols} sols were flown with less than ${OUTCOME.lowMarginSols} sols of reserves.`);
  return reasons;
}

export function keyFactors(state: SimState): string[] {
  const factors: string[] = [];
  const history = state.history;
  if (history.length) {
    let lowest = history[0]!;
    for (const snap of history) if (snap.oxygenKg < lowest.oxygenKg) lowest = snap;
    factors.push(`Lowest O₂ stock: ${lowest.oxygenKg.toFixed(1)} kg on sol ${lowest.sol}.`);
    let worstEnergy = history[0]!;
    for (const snap of history) if (snap.energyBalanceKWh < worstEnergy.energyBalanceKWh) worstEnergy = snap;
    if (worstEnergy.energyBalanceKWh < 0) factors.push(`Worst energy deficit: ${Math.round(-worstEnergy.energyBalanceKWh)} kWh on sol ${worstEnergy.sol} (τ = ${worstEnergy.tau.toFixed(1)}).`);
    const maxTau = Math.max(...history.map((s) => s.tau));
    factors.push(`Peak dust optical depth: ${maxTau.toFixed(1)}.`);
  }
  const byType = new Map<string, number>();
  for (const incident of state.incidents) byType.set(incident.type, (byType.get(incident.type) ?? 0) + 1);
  if (byType.size) factors.push(`Incidents: ${[...byType.entries()].map(([type, count]) => `${count}× ${eventLabel(type as never).toLowerCase()}`).join(", ")}.`);
  const decided = state.decisions.filter((d) => d.followedRecommendation !== null);
  if (decided.length) {
    const followed = decided.filter((d) => d.followedRecommendation).length;
    factors.push(`Decision engine recommendation followed in ${followed} of ${decided.length} decisions.`);
  }
  const complications = state.decisions.filter((d) => d.complication);
  if (complications.length) factors.push(`Complications: ${complications.map((d) => `sol ${d.sol} — ${d.complication}`).join("; ")}.`);
  factors.push(`Radiation dose per crew member: ${state.crew.doseMsv.toFixed(0)} mSv (${Math.round((state.crew.doseMsv / RADIATION.careerLimitMsv) * 100)} % of the NASA career limit).`);
  factors.push(`Science: ${state.science.toFixed(1)} of ${state.scienceTarget} objective points.`);
  if (state.status === "compromised") factors.push(...compromisedReasons(state));
  if (state.failureCause) factors.unshift(state.failureCause);
  return factors;
}

export function buildReport(state: SimState, now: Date = new Date()): MissionReport {
  const outcome = state.status === "failed" ? "failed" : state.status === "success" ? "success" : "compromised";
  return {
    id: `report-${state.planId}-${state.seed}-${state.sol}`,
    planId: state.planId,
    missionName: state.ctx.missionName,
    siteName: state.ctx.siteName,
    outcome,
    solsCompleted: state.sol,
    durationSols: state.durationSols,
    crewSize: state.ctx.crewSize,
    finalHealth: state.crew.health,
    finalMorale: state.crew.morale,
    doseMsv: state.crew.doseMsv,
    science: state.science,
    scienceTarget: state.scienceTarget,
    failureCause: state.failureCause,
    decisions: state.decisions,
    incidents: state.incidents,
    consumption: state.consumption,
    finalResources: state.resources,
    keyFactors: keyFactors(state),
    history: state.history,
    generatedAt: now.toISOString(),
    seed: state.seed,
  };
}
