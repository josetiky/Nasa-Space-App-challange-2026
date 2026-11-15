/**
 * Mars Trek · Perfiles de pesos, validación, renormalización y multiplicadores (ROUTING_ALGORITHM §3.4–§4.1).
 * Invariantes:
 * - INV-R1: w_k >= 0 para todo k; w_d >= 0.05
 * - INV-R5: validación y renormalización (Σw = 1) en un único punto de entrada
 */
import type { WeightProfileId, WeightVector, ZoneClass } from "../contracts";
import { TREK_PARAMS } from "../params";

const MIN_WD = TREK_PARAMS.minDistanceWeight.value;

export class WeightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeightError";
  }
}

export interface RawWeights {
  readonly d: number;
  readonly t: number;
  readonly r: number;
  readonly e: number;
  readonly u: number;
  readonly h: number;
}

/**
 * Valida y renormaliza un vector de pesos (INV-R1, INV-R5).
 * Lanza WeightError si algún componente es negativo, no finito, o si tras renormalizar w_d < 0.05.
 */
export function validateWeights(raw: RawWeights): WeightVector {
  const keys: Array<keyof RawWeights> = ["d", "t", "r", "e", "u", "h"];
  let sum = 0;
  for (const k of keys) {
    const v = raw[k];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new WeightError(`Weight '${k}' must be a finite number (got ${String(v)})`);
    }
    if (v < 0) {
      throw new WeightError(`Weight '${k}' must be >= 0 (got ${v})`);
    }
    sum += v;
  }
  if (sum <= 0) {
    throw new WeightError("Weight vector sum must be > 0");
  }
  if (raw.d < MIN_WD * sum - 1e-12) {
    throw new WeightError(
      `Normalized distance weight w_d (${(raw.d / sum).toFixed(4)}) is below minimum ${MIN_WD}`,
    );
  }
  return {
    d: raw.d / sum,
    t: raw.t / sum,
    r: raw.r / sum,
    e: raw.e / sum,
    u: raw.u / sum,
    h: raw.h / sum,
  };
}

export const WEIGHT_PROFILES: Readonly<Record<WeightProfileId, WeightVector>> = {
  balanced: validateWeights({ d: 0.25, t: 0.2, r: 0.15, e: 0.15, u: 0.15, h: 0.1 }),
  fastest: validateWeights({ d: 0.45, t: 0.15, r: 0.1, e: 0.1, u: 0.1, h: 0.1 }),
  safest: validateWeights({ d: 0.1, t: 0.25, r: 0.25, e: 0.1, u: 0.2, h: 0.1 }),
  known: validateWeights({ d: 0.1, t: 0.15, r: 0.15, e: 0.1, u: 0.4, h: 0.1 }),
  "resource-saving": validateWeights({ d: 0.15, t: 0.15, r: 0.1, e: 0.4, u: 0.1, h: 0.1 }),
  "autonomous-rover": validateWeights({ d: 0.25, t: 0.3, r: 0.1, e: 0.2, u: 0.15, h: 0.0 }),
  emergency: validateWeights({ d: 0.6, t: 0.15, r: 0.15, e: 0.05, u: 0.05, h: 0.0 }),
};

/**
 * Pesos base de una solicitud: la preferencia del operador (validada y renormalizada) si existe,
 * o el perfil nombrado. En CRITICAL/EMERGENCY el llamador pasa "emergency" y la preferencia se ignora.
 */
export function resolveBaseWeights(
  profileId: WeightProfileId,
  customWeights?: WeightVector | null,
): WeightVector {
  if (customWeights && profileId !== "emergency") return validateWeights(customWeights);
  return WEIGHT_PROFILES[profileId];
}

/**
 * Aplica multiplicadores de la directiva de salud sobre un perfil base.
 * Los multiplicadores de salud solo pueden aumentar los pesos de seguridad (t, r, e, u, h >= 1).
 * Si la renormalización reduciese w_d por debajo de MIN_WD (0.05), se fija w_d = MIN_WD y se
 * reparte el (1 - MIN_WD) entre los demás términos proporcionalmente para mantener INV-R1 e INV-R5.
 */
export function applyMultipliers(
  base: WeightVector,
  multipliers: Partial<Record<"t" | "r" | "e" | "u" | "h", number>> = {},
): WeightVector {
  const validatedBase = validateWeights(base);
  const mT = Math.max(1, Number.isFinite(multipliers.t) ? multipliers.t! : 1);
  const mR = Math.max(1, Number.isFinite(multipliers.r) ? multipliers.r! : 1);
  const mE = Math.max(1, Number.isFinite(multipliers.e) ? multipliers.e! : 1);
  const mU = Math.max(1, Number.isFinite(multipliers.u) ? multipliers.u! : 1);
  const mH = Math.max(1, Number.isFinite(multipliers.h) ? multipliers.h! : 1);

  const rawT = validatedBase.t * mT;
  const rawR = validatedBase.r * mR;
  const rawE = validatedBase.e * mE;
  const rawU = validatedBase.u * mU;
  const rawH = validatedBase.h * mH;
  const otherSum = rawT + rawR + rawE + rawU + rawH;
  const total = validatedBase.d + otherSum;

  if (validatedBase.d / total < MIN_WD && otherSum > 0) {
    const scale = (1 - MIN_WD) / otherSum;
    return validateWeights({
      d: MIN_WD,
      t: rawT * scale,
      r: rawR * scale,
      e: rawE * scale,
      u: rawU * scale,
      h: rawH * scale,
    });
  }

  return validateWeights({
    d: validatedBase.d,
    t: rawT,
    r: rawR,
    e: rawE,
    u: rawU,
    h: rawH,
  });
}

/** Multiplicador de costo κ por clase de zona (ROUTING_ALGORITHM §3.4). κ >= 1 siempre. */
export function zoneMultiplier(zone: ZoneClass): number {
  switch (zone) {
    case "Z0":
      return TREK_PARAMS.zoneMultiplierZ0.value;
    case "Z1":
      return TREK_PARAMS.zoneMultiplierZ1.value;
    case "Z2":
      return TREK_PARAMS.zoneMultiplierZ2.value;
    case "Z3":
    case "Z4":
    case "Z5":
      // Z3..Z5 se tratan por máscara según perfil; si exploración robótica admite Z3, κ >= 4
      return TREK_PARAMS.zoneMultiplierZ2.value;
  }
}
