import type { ActionOption, AlternativeEvaluation, CriterionId, DecisionAnalysis, SimState } from "../types";
import { criterionLabel } from "./criteria";

const pct = (v: number) => `${Math.round(v * 100)} %`;
const sols = (v: number) => `${v.toFixed(v < 10 ? 1 : 0)} sols`;

/** Deterministic consequence lines for one alternative. */
export function describeConsequences(state: SimState, option: ActionOption, evaluation: AlternativeEvaluation): string[] {
  if (!evaluation.feasible) return evaluation.rules.filter((r) => r.effect === "veto").map((r) => `Not available: ${r.message}`);
  const lines: string[] = [];
  const m = evaluation.metrics;
  lines.push(`Survival over the next ${evaluation.trajectory.length - 1} sols: ${pct(m.survivalProbability)} of simulated futures.`);
  const last = evaluation.trajectory.at(-1);
  if (last) lines.push(`Median end state: O₂ ${sols(last.oxygenSols)}, battery ${Math.round(last.batteryKWh)} kWh, crew health ${Math.round(last.health)} %.`);
  lines.push(`Lowest reserve on the way: ${sols(m.minReserveSols)}.`);
  if (option.immediate.resources?.spareParts) lines.push(`Uses ${-option.immediate.resources.spareParts} spare kit(s) (${state.resources.spareParts} available).`);
  if (option.immediate.resources?.oxygenKg && option.immediate.resources.oxygenKg < 0) lines.push(`Spends ${(-option.immediate.resources.oxygenKg).toFixed(1)} kg of O₂ immediately.`);
  if (option.immediate.evaHours) lines.push(`Requires ${option.immediate.evaHours} h of EVA.`);
  if (m.complicationProbability > 0 && option.risk) lines.push(`Complication risk ${pct(m.complicationProbability)}: ${option.risk.label.toLowerCase()}.`);
  if (option.ongoing) lines.push(`Ongoing for ${option.ongoing.sols} sols: ${option.ongoing.label.toLowerCase()}.`);
  lines.push(`Science over the horizon: ${m.scienceDelta >= 0 ? "+" : ""}${m.scienceDelta.toFixed(1)} points.`);
  return lines;
}

function strongestDifferences(best: AlternativeEvaluation, other: AlternativeEvaluation, n = 2): CriterionId[] {
  return (Object.keys(best.contributions) as CriterionId[])
    .map((id) => ({ id, delta: best.contributions[id] - other.contributions[id] }))
    .filter((entry) => entry.delta > 0.005)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, n)
    .map((entry) => entry.id);
}

function metricPhrase(id: CriterionId, a: AlternativeEvaluation): string {
  const m = a.metrics;
  switch (id) {
    case "survival":
      return `survival ${pct(m.survivalProbability)}`;
    case "reserves":
      return `lowest reserve ${sols(m.minReserveSols)}`;
    case "health":
      return `crew health ${Math.round(m.expectedHealth)} %`;
    case "morale":
      return `morale ${Math.round(m.expectedMorale)} %`;
    case "cost":
      return `cost ${m.resourceCost.toFixed(1)} crew-sols of consumables`;
    case "science":
      return `science ${m.scienceDelta.toFixed(1)} pts`;
    case "risk":
      return `critical-state risk ${pct(m.riskIndex)}`;
  }
}

/** Natural-language rationale built only from the analysis numbers (no LLM). */
export function buildRationale(state: SimState, analysis: DecisionAnalysis): string[] {
  const lines: string[] = [];
  const feasible = analysis.alternatives.filter((a) => a.feasible).sort((a, b) => b.score - a.score);
  const best = analysis.alternatives.find((a) => a.optionId === analysis.recommendedId);
  if (!best) return ["No feasible action — every option violates a hard rule."];
  lines.push(`Recommended: “${best.label}” (score ${best.score.toFixed(3)}, ${analysis.posture} posture, ${analysis.samples} simulated futures over ${analysis.horizonSols} sols).`);
  const runnerUp = feasible.find((a) => a.optionId !== best.optionId);
  if (runnerUp) {
    const diffs = strongestDifferences(best, runnerUp);
    if (diffs.length) {
      lines.push(
        `It beats “${runnerUp.label}” (score ${runnerUp.score.toFixed(3)}) mainly on ${diffs.map((id) => criterionLabel(id).toLowerCase()).join(" and ")}: ${diffs.map((id) => `${metricPhrase(id, best)} vs ${metricPhrase(id, runnerUp)}`).join("; ")}.`,
      );
    } else lines.push(`It narrowly beats “${runnerUp.label}” (score ${runnerUp.score.toFixed(3)}); the difference comes from rule adjustments.`);
    const tradeoffs = (Object.keys(best.contributions) as CriterionId[]).filter((id) => runnerUp.contributions[id] - best.contributions[id] > 0.01);
    if (tradeoffs.length) lines.push(`Trade-off accepted: “${runnerUp.label}” would be better on ${tradeoffs.map((id) => `${criterionLabel(id).toLowerCase()} (${metricPhrase(id, runnerUp)})`).join(", ")}.`);
  }
  for (const rule of best.rules) if (rule.effect !== "veto") lines.push(`Rule ${rule.ruleId}: ${rule.message}`);
  const vetoed = analysis.alternatives.filter((a) => !a.feasible);
  for (const v of vetoed) lines.push(`Excluded “${v.label}”: ${v.rules.filter((r) => r.effect === "veto").map((r) => r.message).join(" ")}`);
  if (analysis.criticalResources.length) lines.push(`Critical resources right now: ${analysis.criticalResources.join(", ")}.`);
  if (state.ctx.riskPosture !== analysis.posture) lines.push(`Analysis run with a ${analysis.posture} posture (mission default: ${state.ctx.riskPosture}).`);
  return lines;
}
