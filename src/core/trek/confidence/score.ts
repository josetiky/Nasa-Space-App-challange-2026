/**
 * Mars Trek · Clases y puntuación de confianza científica (SCIENTIFIC_CONFIDENCE §2–§5).
 */
import type { ConfidenceClass, MissionProfileId } from "../contracts";

export const BASE_CLASS_SCORE: Readonly<Record<ConfidenceClass, number>> = {
  K1: 0.95,
  K2: 0.85,
  K3a: 0.75,
  K3b: 0.55,
  K3c: 0.35,
  K3d: 0.2,
  K4: 0.15,
  K5: 0.0,
};

export const REQUIRED_SCALE_M: Readonly<Record<MissionProfileId, number>> = {
  solo: 2,
  team: 2,
  "rover-crew": 2,
  rover: 5,
};

export const MIN_CONFIDENCE_FOR_PROFILE: Readonly<Record<MissionProfileId, ConfidenceClass>> = {
  solo: "K3a",
  team: "K3a",
  "rover-crew": "K3a",
  rover: "K3b",
};

export interface ConfidenceScoreInput {
  readonly cls: ConfidenceClass;
  readonly dataResolutionM: number;
  readonly requiredScaleM?: number;
  readonly profile?: MissionProfileId;
  readonly ageYears?: number;
  readonly halfLifeYears?: number | null;
  readonly qualityFactor?: number;
  readonly coverageFraction?: number;
  readonly modelFactor?: number;
}

/**
 * Calcula la puntuación multiplicativa de confianza C en [0, 1] (SCIENTIFIC_CONFIDENCE §4):
 * C = C_K * q_res * q_edad * q_cal * q_cob * q_mod
 * La incertidumbre geográfica es u = 1 - C.
 */
export function confidenceScore(input: ConfidenceScoreInput): number {
  if (input.cls === "K5") return 0;
  const cK = BASE_CLASS_SCORE[input.cls];
  const sReq = input.requiredScaleM ?? (input.profile ? REQUIRED_SCALE_M[input.profile] : 2);
  const sDato = Math.max(0.01, input.dataResolutionM);
  const qRes = Math.pow(Math.min(1, sReq / sDato), 0.5);

  const halfLife = input.halfLifeYears ?? null;
  const age = Math.max(0, input.ageYears ?? 0);
  const qEdad = halfLife && halfLife > 0 ? Math.pow(0.5, age / halfLife) : 1.0;

  const qCal = Math.max(0, Math.min(1, input.qualityFactor ?? 1.0));
  const qCob = Math.max(0, Math.min(1, input.coverageFraction ?? 1.0));
  const qMod = Math.max(0, Math.min(1, input.modelFactor ?? 1.0));

  const score = cK * qRes * qEdad * qCal * qCob * qMod;
  return Math.max(0, Math.min(1, score));
}

export function uncertaintyFromConfidence(score: number): number {
  if (!Number.isFinite(score)) return 1;
  return Math.max(0, Math.min(1, 1 - score));
}
