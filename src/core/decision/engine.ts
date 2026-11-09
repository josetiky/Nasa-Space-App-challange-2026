import type { AlternativeEvaluation, CriterionId, DecisionAnalysis, RiskPosture, SimState, TrajectoryPoint } from "../types";
import { hashSeed } from "../rng";
import { CREW_NEEDS, RADIATION } from "../science/constants";
import { chooseOption, defaultPolicy, stepSol, withSeedVariant } from "../sim/engine";
import { reserveSols } from "../sim/resources";
import { POSTURE_WEIGHTS } from "./criteria";
import { buildRationale, describeConsequences } from "./explain";
import { evaluateRules } from "./rules";

export interface AnalyzeOptions {
  horizonSols?: number;
  samples?: number;
  posture?: RiskPosture;
  now?: Date;
}

interface SampleResult {
  survived: boolean;
  minReserve: number;
  finalHealth: number;
  finalMorale: number;
  science: number;
  critical: boolean;
  complication: boolean;
  costCrewSols: number;
  trajectory: TrajectoryPoint[];
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function point(state: SimState): TrajectoryPoint {
  const r = reserveSols(state);
  return { sol: state.sol, oxygenSols: r.oxygen, waterSols: r.water, batteryKWh: state.resources.batteryKWh, health: state.crew.health };
}

function runSample(state: SimState, optionId: string, k: number, horizon: number): SampleResult {
  const variant = withSeedVariant(state, k);
  const start = variant;
  let current = chooseOption(variant, optionId, null, { keepHistory: false });
  const complication = current.decisions.at(-1)?.complication != null;
  const trajectory: TrajectoryPoint[] = [point(current)];
  let minReserve = reserveSols(current).min;
  let critical = false;
  const targetSol = state.sol + horizon;
  let guard = 0;
  while (guard < horizon * 3 + 5) {
    guard += 1;
    if (current.status === "awaiting-decision") {
      current = chooseOption(current, defaultPolicy(current), null, { keepHistory: false });
      continue;
    }
    if (current.status !== "running" || current.sol >= targetSol) break;
    current = stepSol(current, { keepHistory: false });
    const r = reserveSols(current);
    minReserve = Math.min(minReserve, r.min);
    if (r.min < 5 || current.crew.health < 40) critical = true;
    trajectory.push(point(current));
  }
  const survived = current.status !== "failed";
  if (!survived) critical = true;
  const crew = start.ctx.crewSize;
  const o2Used = Math.max(0, start.resources.oxygenKg - current.resources.oxygenKg) / (crew * CREW_NEEDS.oxygenKgPerDay);
  const waterUsed = Math.max(0, start.resources.waterKg - current.resources.waterKg) / (crew * (CREW_NEEDS.potableWaterKgPerDay + CREW_NEEDS.hygieneWaterKgPerDay));
  const spares = Math.max(0, start.resources.spareParts - current.resources.spareParts);
  return {
    survived,
    minReserve,
    finalHealth: survived ? current.crew.health : 0,
    finalMorale: survived ? current.crew.morale : 0,
    science: current.science - start.science,
    critical,
    complication,
    costCrewSols: o2Used + waterUsed + spares * 2,
    trajectory,
  };
}

function medianTrajectory(samples: SampleResult[], horizon: number, startSol: number): TrajectoryPoint[] {
  const out: TrajectoryPoint[] = [];
  for (let i = 0; i <= horizon; i += 1) {
    const at = samples.map((s) => s.trajectory[i]).filter((p): p is TrajectoryPoint => Boolean(p));
    if (!at.length) break;
    out.push({
      sol: startSol + i,
      oxygenSols: median(at.map((p) => p.oxygenSols)),
      waterSols: median(at.map((p) => p.waterSols)),
      batteryKWh: median(at.map((p) => p.batteryKWh)),
      health: median(at.map((p) => p.health)),
    });
  }
  return out;
}

export function identifyRisks(state: SimState): DecisionAnalysis["risks"] {
  const risks: DecisionAnalysis["risks"] = [];
  const r = reserveSols(state);
  if (r.oxygen < 5) risks.push({ level: "danger", text: `O₂ stock covers ${r.oxygen.toFixed(1)} sols of crew demand.` });
  else if (r.oxygen < 10) risks.push({ level: "caution", text: `O₂ stock covers ${r.oxygen.toFixed(1)} sols of crew demand.` });
  if (r.food < 10) risks.push({ level: r.food < 5 ? "danger" : "caution", text: `Food for ${r.food.toFixed(1)} sols.` });
  if (state.resources.batteryKWh < state.ctx.capacities.batteryKWh * 0.25) risks.push({ level: "caution", text: `Battery at ${Math.round((state.resources.batteryKWh / state.ctx.capacities.batteryKWh) * 100)} % of capacity.` });
  if (state.crew.health < 60) risks.push({ level: state.crew.health < 40 ? "danger" : "caution", text: `Crew health ${Math.round(state.crew.health)} %.` });
  if (state.systems.habitat < 50) risks.push({ level: state.systems.habitat < 25 ? "danger" : "caution", text: `Habitat integrity ${Math.round(state.systems.habitat)} %.` });
  if (state.systems.lifeSupport < 50) risks.push({ level: "caution", text: `Life support health ${Math.round(state.systems.lifeSupport)} %.` });
  if (state.crew.doseMsv > RADIATION.careerLimitMsv * 0.5) risks.push({ level: "caution", text: `Dose ${state.crew.doseMsv.toFixed(0)} mSv — over half the NASA career limit.` });
  if (!state.env.commsUp) risks.push({ level: "info", text: "No communications with Earth." });
  if (state.env.tau >= 2) risks.push({ level: state.env.tau >= 4 ? "danger" : "caution", text: `Dust optical depth ${state.env.tau.toFixed(1)}.` });
  if (state.resources.spareParts <= 2) risks.push({ level: "caution", text: `${state.resources.spareParts} spare kits left.` });
  if (state.habitatTempC < 15) risks.push({ level: "caution", text: `Habitat at ${state.habitatTempC.toFixed(0)} °C.` });
  return risks;
}

export function criticalResources(state: SimState): string[] {
  const r = reserveSols(state);
  const list: string[] = [];
  if (r.oxygen < 10) list.push("oxygen");
  if (r.water < 10) list.push("water");
  if (r.food < 10) list.push("food");
  if (state.resources.batteryKWh < state.ctx.capacities.batteryKWh * 0.25) list.push("energy");
  if (state.resources.spareParts <= 2) list.push("spare kits");
  return list;
}

/**
 * Evaluate every action of the pending event. Deterministic: the same state,
 * seed and options always return the same analysis.
 */
export function analyzeDecision(state: SimState, options: AnalyzeOptions = {}): DecisionAnalysis {
  const event = state.pending;
  if (!event) throw new Error("No pending event to analyse.");
  const horizon = options.horizonSols ?? 10;
  const samples = options.samples ?? 24;
  const posture = options.posture ?? state.ctx.riskPosture;
  const weights = POSTURE_WEIGHTS[posture];

  const raw = event.options.map((option) => {
    const rules = evaluateRules(state, event, option);
    const vetoed = rules.some((rule) => rule.effect === "veto");
    const results: SampleResult[] = [];
    if (!vetoed) for (let k = 0; k < samples; k += 1) results.push(runSample(state, option.id, k, horizon));
    return { option, rules, vetoed, results };
  });

  const feasibleRaw = raw.filter((entry) => !entry.vetoed);
  const costs = feasibleRaw.map((entry) => mean(entry.results.map((r) => r.costCrewSols)));
  const sciences = feasibleRaw.map((entry) => mean(entry.results.map((r) => r.science)));
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minSci = Math.min(...sciences);
  const maxSci = Math.max(...sciences);

  const alternatives: AlternativeEvaluation[] = raw.map((entry) => {
    const { option, rules, vetoed, results } = entry;
    const survival = vetoed ? 0 : results.filter((r) => r.survived).length / results.length;
    const minReserve = vetoed ? 0 : median(results.map((r) => r.minReserve));
    const health = vetoed ? 0 : mean(results.map((r) => r.finalHealth));
    const morale = vetoed ? 0 : mean(results.map((r) => r.finalMorale));
    const cost = vetoed ? 0 : mean(results.map((r) => r.costCrewSols));
    const science = vetoed ? 0 : mean(results.map((r) => r.science));
    const criticalShare = vetoed ? 1 : results.filter((r) => r.critical).length / results.length;
    const complication = option.risk?.probability ?? 0;
    const riskIndex = clamp01(criticalShare + complication * 0.5);
    const normalized: Record<CriterionId, number> = {
      survival,
      reserves: clamp01(minReserve / 30),
      health: health / 100,
      morale: morale / 100,
      cost: maxCost - minCost > 0.05 ? 1 - (cost - minCost) / (maxCost - minCost) : 1,
      science: maxSci - minSci > 0.25 ? (science - minSci) / (maxSci - minSci) : 0.5,
      risk: 1 - riskIndex,
    };
    const contributions = Object.fromEntries((Object.keys(weights) as CriterionId[]).map((id) => [id, weights[id] * normalized[id]])) as Record<CriterionId, number>;
    const ruleAdjustment = rules.reduce((sum, rule) => sum + (rule.effect === "veto" ? 0 : rule.weight), 0);
    const base = Object.values(contributions).reduce((a, b) => a + b, 0);
    const score = vetoed ? 0 : Math.round((base + ruleAdjustment) * 1000) / 1000;
    const trajectory = vetoed ? [] : medianTrajectory(results, horizon, state.sol);
    const evaluation: AlternativeEvaluation = {
      optionId: option.id,
      label: option.label,
      feasible: !vetoed,
      rules,
      metrics: {
        survivalProbability: survival,
        minReserveSols: minReserve,
        expectedHealth: health,
        expectedMorale: morale,
        resourceCost: cost,
        scienceDelta: science,
        riskIndex,
        complicationProbability: complication,
      },
      normalized,
      contributions,
      ruleAdjustment,
      score,
      trajectory,
      consequences: [],
    };
    evaluation.consequences = describeConsequences(state, option, evaluation);
    return evaluation;
  });

  const ranked = alternatives
    .filter((a) => a.feasible)
    .sort((a, b) => b.score - a.score || b.metrics.survivalProbability - a.metrics.survivalProbability || a.optionId.localeCompare(b.optionId));
  const recommended = ranked[0] ?? alternatives[0]!;
  const analysis: DecisionAnalysis = {
    eventId: event.id,
    eventType: event.type,
    eventTitle: event.title,
    sol: state.sol,
    horizonSols: horizon,
    samples,
    posture,
    weights,
    risks: identifyRisks(state),
    criticalResources: criticalResources(state),
    alternatives,
    recommendedId: recommended.optionId,
    rationale: [],
    computedAt: (options.now ?? new Date()).toISOString(),
    deterministicKey: hashSeed(state.seed, state.sol, event.id, horizon, samples, posture, ...event.options.map((o) => o.id)).toString(16),
  };
  analysis.rationale = buildRationale(state, analysis);
  return analysis;
}
