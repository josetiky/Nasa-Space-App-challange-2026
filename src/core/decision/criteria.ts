import type { CriterionId, RiskPosture } from "../types";

export const CRITERIA: Array<{ id: CriterionId; label: string; description: string }> = [
  { id: "survival", label: "Survival", description: "Share of Monte-Carlo futures in which the crew survives the look-ahead horizon." },
  { id: "reserves", label: "Reserves", description: "Median of the lowest O₂ / water / food reserve over the horizon (saturates at 30 sols)." },
  { id: "health", label: "Crew health", description: "Expected crew health at the end of the horizon." },
  { id: "morale", label: "Morale", description: "Expected crew morale at the end of the horizon." },
  { id: "cost", label: "Resource cost", description: "Consumables and spare kits spent (lower is better, relative to the other options)." },
  { id: "science", label: "Science", description: "Science points gained over the horizon (relative to the other options)." },
  { id: "risk", label: "Risk", description: "Probability of a critical state (failure, reserves < 5 sols, health < 40 %) or an action complication." },
];

/** Criterion weights per mission risk posture (sum = 1). */
export const POSTURE_WEIGHTS: Record<RiskPosture, Record<CriterionId, number>> = {
  conservative: { survival: 0.34, reserves: 0.2, health: 0.16, morale: 0.05, cost: 0.1, science: 0.05, risk: 0.1 },
  balanced: { survival: 0.28, reserves: 0.16, health: 0.14, morale: 0.07, cost: 0.12, science: 0.13, risk: 0.1 },
  aggressive: { survival: 0.22, reserves: 0.12, health: 0.12, morale: 0.08, cost: 0.12, science: 0.24, risk: 0.1 },
};

export function criterionLabel(id: CriterionId): string {
  return CRITERIA.find((c) => c.id === id)?.label ?? id;
}
