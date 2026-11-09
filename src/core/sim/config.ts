import type { EventType, ScenarioId } from "../types";
import { RADIATION } from "../science/constants";

/**
 * Event probabilities per sol (SIMULATED scenario parameters).
 * They are tuned so a 60–100 sol mission meets roughly one decision every
 * 10–15 sols; they are not statistics of real Mars operations, except the SEP
 * rate, which follows the bundled NASA DONKI 2024 snapshot (moderate/severe
 * episodes, halved because Mars does not always face the same solar longitude
 * as Earth — same convention as the original Sol-by-Sol simulator).
 */
export const EVENT_BASE_PROBABILITY: Record<EventType, number> = {
  dustStorm: 0.01,
  powerFailure: 0.004,
  commsLoss: 0.004,
  habitatDamage: 0.002,
  oxygenLeak: 0.003,
  waterFailure: 0.004,
  vehicleFailure: 0.003,
  medical: 0.003,
  sep: (16 / 365) * 0.5,
  discovery: 0.006,
};

/** Priority when several events trigger on the same sol (first wins). */
export const EVENT_PRIORITY: EventType[] = [
  "oxygenLeak",
  "habitatDamage",
  "sep",
  "dustStorm",
  "powerFailure",
  "waterFailure",
  "medical",
  "vehicleFailure",
  "commsLoss",
  "discovery",
];

export interface ScenarioPreset {
  id: ScenarioId;
  label: string;
  description: string;
  multipliers: Partial<Record<EventType, number>>;
}

export const SCENARIOS: ScenarioPreset[] = [
  { id: "nominal", label: "Nominal", description: "Baseline event rates.", multipliers: {} },
  {
    id: "dust-season",
    label: "Dust season",
    description: "Perihelion dust season: storms 2.5× more likely, more power faults.",
    multipliers: { dustStorm: 2.5, powerFailure: 1.4, habitatDamage: 1.3 },
  },
  {
    id: "harsh",
    label: "Harsh",
    description: "Everything that can go wrong is 2.2× more likely.",
    multipliers: { dustStorm: 2.2, powerFailure: 2.2, commsLoss: 2.2, habitatDamage: 2.2, oxygenLeak: 2.2, waterFailure: 2.2, vehicleFailure: 2.2, medical: 2.2, sep: 1.5, discovery: 1 },
  },
  {
    id: "training",
    label: "Training",
    description: "Half the hazard rates; good for a first run.",
    multipliers: { dustStorm: 0.5, powerFailure: 0.5, commsLoss: 0.5, habitatDamage: 0.5, oxygenLeak: 0.5, waterFailure: 0.5, vehicleFailure: 0.5, medical: 0.5, sep: 0.5, discovery: 1.2 },
  },
];

export function scenarioMultiplier(scenario: ScenarioId, type: EventType, overrides: Partial<Record<EventType, number>> = {}): number {
  const preset = SCENARIOS.find((item) => item.id === scenario);
  const base = preset?.multipliers[type] ?? 1;
  const override = overrides[type];
  return override === undefined ? base : base * override;
}

export const SEP_DOSE_FACTOR: Record<1 | 2 | 3, number> = {
  1: 1 + RADIATION.sepMultipliers[1],
  2: 1 + RADIATION.sepMultipliers[2],
  3: 1 + RADIATION.sepMultipliers[3],
};

/** Daily wear of each subsystem (health points per sol). SIMULATED. */
export const SYSTEM_WEAR = {
  lifeSupport: 0.06,
  power: 0.05,
  habitat: 0.03,
  comms: 0.03,
  rover: 0.05,
  isru: 0.08,
} as const;

/** Outcome thresholds. */
export const OUTCOME = {
  failHealth: 15,
  failHabitat: 8,
  dehydrationSols: 3,
  successHealth: 60,
  successScienceFraction: 0.7,
  lowMarginSols: 5,
  maxLowMarginFraction: 0.1,
} as const;
