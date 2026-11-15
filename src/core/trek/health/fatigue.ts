/**
 * Mars Trek · Modelo de fatiga acumulada y reglas FAT-01..FAT-06 (ASTRONAUT_HEALTH_STATE_MACHINE §5.2 y §10.4).
 */
import { TREK_PARAMS } from "../params";

const SUSTAINABLE_W = TREK_PARAMS.sustainableMetabolicW.value;
const ENTER_F = TREK_PARAMS.fatigueEnterThreshold.value;
const EXIT_F = TREK_PARAMS.fatigueExitThreshold.value;

// Tasas [diseño] ajustadas para que una subida sostenida entre en FATIGUE en ~5-8 min y recupere en descanso
const ACCUM_RATE_PER_S = 0.0035;
const RECOVERY_RATE_PER_S = 0.0045;

export interface FatigueStepInput {
  readonly metabolicW: number;
  readonly resting?: boolean;
  readonly sustainableW?: number;
}

/**
 * Actualiza el índice de fatiga F en [0, 1] (ASTRONAUT_HEALTH_STATE_MACHINE §10.4):
 * F(t + Δt) = clamp( F(t) + Δt · [ a · max(0, M/M_sost − 1) − b · descanso ], 0, 1 )
 */
export function stepFatigue(currentF: number, dtS: number, input: FatigueStepInput): number {
  if (dtS <= 0) return Math.max(0, Math.min(1, currentF));
  const mSost = input.sustainableW ?? SUSTAINABLE_W;
  const overload = input.resting ? 0 : Math.max(0, input.metabolicW / mSost - 1);
  const restFactor = input.resting || input.metabolicW < mSost * 0.85 ? 1 : 0;
  const delta = dtS * (ACCUM_RATE_PER_S * overload - RECOVERY_RATE_PER_S * restFactor);
  return Math.max(0, Math.min(1, currentF + delta));
}

export interface FatigueRuleInput {
  readonly fatigueIndex: number;
  readonly wasFatigued: boolean;
  readonly evaElapsedMin?: number;
  readonly speedRatio?: number;
  readonly psiScore?: number;
  readonly selfReportedHighEffort?: boolean;
}

export interface FatigueRuleEvaluation {
  readonly active: boolean;
  readonly triggeredRules: ReadonlyArray<{
    ruleId: string;
    value: number | string;
    message: string;
  }>;
}

/**
 * Evalúa las reglas FAT-01..FAT-06 con histéresis:
 * FAT-06 entra con F >= 0.6 y solo sale cuando F <= 0.4 y no hay otra regla FAT activa.
 */
export function evaluateFatigueRules(input: FatigueRuleInput): FatigueRuleEvaluation {
  const triggered: Array<{ ruleId: string; value: number | string; message: string }> = [];

  // FAT-06 con histéresis [0.4, 0.6]
  const fat06Active = input.wasFatigued
    ? input.fatigueIndex > EXIT_F
    : input.fatigueIndex >= ENTER_F;
  if (fat06Active) {
    triggered.push({
      ruleId: "FAT-06",
      value: Number(input.fatigueIndex.toFixed(2)),
      message: `Índice de fatiga acumulada F=${input.fatigueIndex.toFixed(2)} (umbral entrada ${ENTER_F}, salida ${EXIT_F}) [diseño]`,
    });
  }

  // FAT-02: PSI en banda moderada 5-6
  if (input.psiScore !== undefined && input.psiScore >= 5 && input.psiScore < 7) {
    triggered.push({
      ruleId: "FAT-02",
      value: Number(input.psiScore.toFixed(1)),
      message: `Índice de estrés fisiológico moderado (${input.psiScore.toFixed(1)}/10) [diseño]`,
    });
  }

  // FAT-03: velocidad real < 70 % de la prevista
  if (input.speedRatio !== undefined && input.speedRatio < 0.7) {
    triggered.push({
      ruleId: "FAT-03",
      value: Number((input.speedRatio * 100).toFixed(0)),
      message: `Capacidad de movilidad reducida (${(input.speedRatio * 100).toFixed(0)} % de la velocidad prevista) [diseño]`,
    });
  }

  // FAT-04: tiempo de EVA > 6 h (360 min)
  if (input.evaElapsedMin !== undefined && input.evaElapsedMin > 360) {
    triggered.push({
      ruleId: "FAT-04",
      value: Number((input.evaElapsedMin / 60).toFixed(1)),
      message: `Tiempo acumulado de EVA ${(input.evaElapsedMin / 60).toFixed(1)} h supera las 6 h nominales`,
    });
  }

  // FAT-05: autoinforme de esfuerzo alto
  if (input.selfReportedHighEffort) {
    triggered.push({
      ruleId: "FAT-05",
      value: "ALTO",
      message: "Autoinforme de fatiga o esfuerzo elevado del tripulante",
    });
  }

  return {
    active: triggered.length > 0,
    triggeredRules: triggered,
  };
}
