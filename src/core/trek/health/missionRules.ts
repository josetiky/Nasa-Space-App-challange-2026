/**
 * Mars Trek · Reglas de misión derivadas de HUELLA (EVA-01, 13, 14, 15, 18, 19, 20) (Tarea 7).
 * Complementan las reglas biomédicas de rules.ts con el contexto de recursos, ambiente y navegación.
 */
import type { CauseFlag, HuellaLevel } from "../contracts";

export interface MissionRulesInput {
  readonly returnMarginMin?: number;
  readonly returnMarginPct?: number;
  readonly sepAlertActive?: boolean;
  readonly stormActive?: boolean;
  readonly visibilityM?: number;
  readonly posUncertaintyM?: number;
  readonly minutesToSunset?: number;
  readonly safeReturnDurationMin?: number;
  readonly reserveMin?: number;
  readonly coolantInReserve?: boolean;
  readonly batteryRemainingMin?: number;
}

export interface MissionRuleHit {
  readonly ruleId: "EVA-01" | "EVA-13" | "EVA-14" | "EVA-15" | "EVA-18" | "EVA-19" | "EVA-20";
  readonly level: HuellaLevel;
  readonly cause: CauseFlag;
  readonly value: number | string;
  readonly message: string;
}

/**
 * Evalúa las reglas derivadas de misión de reglas.json:
 * - EVA-01: Punto de no retorno (margen_regreso_min < 0 => SUPERVIVENCIA; < 20% => PRECAUCION)
 * - EVA-13: Evento solar activo (alerta_spe == true => SUPERVIVENCIA)
 * - EVA-14: Tormenta de polvo (visibilidad < 100 m o tormenta_activa => SUPERVIVENCIA)
 * - EVA-15: Incertidumbre de ubicación (> 150 m => SUPERVIVENCIA; > 50 m => PRECAUCION)
 * - EVA-18: Luz restante (min_para_puesta_sol < t_regreso_min + 30 => SUPERVIVENCIA)
 * - EVA-19: Agua de alimentación en reserva (=> PRECAUCION)
 * - EVA-20: Energía de batería (bateria_min < t_regreso_min + reserva_min => SUPERVIVENCIA)
 */
export function evaluateMissionRules(vars: MissionRulesInput): MissionRuleHit[] {
  const hits: MissionRuleHit[] = [];

  // EVA-01: Punto de no retorno
  if (vars.returnMarginMin !== undefined || vars.returnMarginPct !== undefined) {
    const mMin = vars.returnMarginMin ?? 999;
    const mPct = vars.returnMarginPct ?? 100;
    if (mMin < 0) {
      hits.push({
        ruleId: "EVA-01",
        level: "SUPERVIVENCIA",
        cause: "traje",
        value: Number(mMin.toFixed(1)),
        message: `Te queda ${mMin.toFixed(1)} min de margen. Hora de regresar.`,
      });
    } else if (mPct < 20) {
      hits.push({
        ruleId: "EVA-01",
        level: "PRECAUCION",
        cause: "traje",
        value: Number(mPct.toFixed(1)),
        message: `Margen de regreso bajo (${mPct.toFixed(0)} % < 20 %).`,
      });
    }
  }

  // EVA-13: Evento de partículas solares
  if (vars.sepAlertActive) {
    hits.push({
      ruleId: "EVA-13",
      level: "SUPERVIVENCIA",
      cause: "radiacion",
      value: "SEP",
      message: "Alerta de evento solar. Ve al refugio blindado más cercano.",
    });
  }

  // EVA-14: Tormenta de polvo
  if (vars.stormActive || (vars.visibilityM !== undefined && vars.visibilityM < 100)) {
    hits.push({
      ruleId: "EVA-14",
      level: "SUPERVIVENCIA",
      cause: "ambiente",
      value: vars.visibilityM ?? "TORMENTA",
      message: "Tormenta de polvo activa. Sigue la ruta al refugio más cercano.",
    });
  }

  // EVA-15: Incertidumbre de ubicación
  if (vars.posUncertaintyM !== undefined) {
    if (vars.posUncertaintyM > 150) {
      hits.push({
        ruleId: "EVA-15",
        level: "SUPERVIVENCIA",
        cause: "navegacion",
        value: Number(vars.posUncertaintyM.toFixed(1)),
        message: `Incertidumbre de posición alta (±${vars.posUncertaintyM.toFixed(0)} m > 150 m). Regresa a la última referencia.`,
      });
    } else if (vars.posUncertaintyM > 50) {
      hits.push({
        ruleId: "EVA-15",
        level: "PRECAUCION",
        cause: "navegacion",
        value: Number(vars.posUncertaintyM.toFixed(1)),
        message: `Incertidumbre de posición moderada (±${vars.posUncertaintyM.toFixed(0)} m > 50 m).`,
      });
    }
  }

  // EVA-18: Luz restante
  if (vars.minutesToSunset !== undefined && vars.safeReturnDurationMin !== undefined) {
    if (vars.minutesToSunset < vars.safeReturnDurationMin + 30) {
      hits.push({
        ruleId: "EVA-18",
        level: "SUPERVIVENCIA",
        cause: "ambiente",
        value: Number(vars.minutesToSunset.toFixed(0)),
        message: "Si no regresas ahora, llegarás de noche.",
      });
    }
  }

  // EVA-19: Agua de alimentación en reserva
  if (vars.coolantInReserve) {
    hits.push({
      ruleId: "EVA-19",
      level: "PRECAUCION",
      cause: "termica",
      value: "RESERVA",
      message: "Tu agua de enfriamiento pasó a reserva.",
    });
  }

  // EVA-20: Energía de batería
  if (vars.batteryRemainingMin !== undefined && vars.safeReturnDurationMin !== undefined) {
    const reserve = vars.reserveMin ?? 15;
    if (vars.batteryRemainingMin < vars.safeReturnDurationMin + reserve) {
      hits.push({
        ruleId: "EVA-20",
        level: "SUPERVIVENCIA",
        cause: "traje",
        value: Number(vars.batteryRemainingMin.toFixed(1)),
        message: "La batería solo alcanza para regresar.",
      });
    }
  }

  return hits;
}
