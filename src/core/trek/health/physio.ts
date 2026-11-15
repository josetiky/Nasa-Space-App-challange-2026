/**
 * Mars Trek · Pesos fisiológicos dinámicos del A* (necesidades del astronauta → multiplicadores de peso).
 *
 * La máquina de estados de salud (fsm.ts → directive.ts) sigue siendo la única autoridad sobre los límites
 * DUROS (pendiente máxima, zonas, meta, enclavamientos y confirmación humana). Este módulo solo modula los
 * pesos BLANDOS del costo de arista (T, R, E, U, H y el factor φ del término H) de forma continua, a partir
 * de la telemetría HUELLA de cada ciclo, para que el A* prefiera antes las rutas que el cuerpo necesita:
 * menos pendiente con el corazón exigido, menos gasto con el traje comprometido, terreno conocido sin enlace…
 *
 *   necesidad_k = max_s  cap_s · rampa(valor_s; base_s → límite_s)     (0 = nominal, 1 = umbral HUELLA)
 *   base_s   = percentil de la caminata NOMINAL de "metricas de vida" (huellaReference.ts, generado)
 *   límite_s = umbral de SUPERVIVENCIA de reglas.json / motor_reglas.py (cap 0.6 si la regla solo llega
 *              a PRECAUCION) · los marcados [diseño] no tienen umbral HUELLA
 *
 * Invariantes:
 * - INV-P1: todos los multiplicadores ≥ 1 (como INV-H2): la fisiología nunca abarata un término de seguridad
 *   ni toca w_d; tampoco cambia límites, zonas, meta ni estado (eso es de la FSM).
 * - INV-P2: se combina con la directiva de la FSM por máximo componente a componente (gana lo más restrictivo).
 * - INV-P3: sin dato no se asume sano: si la fila falta o hay corte de telemetría, se conserva el último valor
 *   (stale = true) y la FSM, por su lado, sube a CAUTION por SEN-04.
 * - INV-P4: determinista (misma fila + mismo estado previo + mismo Δt ⇒ mismos pesos) y estable: suavizado
 *   asimétrico (sube rápido, baja lento) y cuantización a pasos de 0.25.
 */
import type { NavigationDirective } from "../contracts";
import { HUELLA_NOMINAL_BASELINE as BASE } from "./huellaReference";
import { PSI_TO_KPA, type HuellaRow } from "./rules";

export const PHYSIO_NEED_IDS = [
  "cardio",
  "thermal",
  "respiratory",
  "suit",
  "consumables",
  "fatigue",
  "exposure",
  "navigation",
] as const;
export type PhysioNeedId = (typeof PHYSIO_NEED_IDS)[number];
export type PhysioNeeds = Readonly<Record<PhysioNeedId, number>>;
export type PhysioTerm = "t" | "r" | "e" | "u" | "h";
export type PhysioMultipliers = Readonly<Record<PhysioTerm, number>>;
export type PhysioSource = "none" | "generator" | "huella-csv" | "live";

export interface PhysioDriver {
  readonly need: PhysioNeedId;
  /** Columna HUELLA (o variable derivada) que empuja la necesidad. */
  readonly signal: string;
  readonly value: number;
  readonly unit: string;
  /** Valor que da 0: percentil de la caminata nominal (o [diseño]). */
  readonly zero: number;
  /** Valor que da 1 (× cap): umbral HUELLA. */
  readonly one: number;
  readonly ruleId: string;
  /** Intensidad ya multiplicada por cap, en [0, 1]. */
  readonly intensity: number;
}

export interface PhysioContext {
  /** Índice de fatiga acumulada F en [0, 1] (fatigue.ts). */
  readonly fatigueIndex?: number;
  /** Tasa de dosis ambiental vigente (mSv/sol); 0.64 = superficie nominal (MSL/RAD). */
  readonly doseRateMsvPerSol?: number;
  /** FC máxima del tripulante (motor_reglas.py usa 183.5 por defecto). */
  readonly fcMax?: number;
  /** Presión nominal del traje (kPa). */
  readonly setpointKpa?: number;
  /** Dosis de carrera acumulada + dosis de esta EVA (mSv) → PRE-14 (80 % = 480, límite 600). */
  readonly careerDoseMsv?: number;
}

export interface PhysioAssessment {
  readonly needs: PhysioNeeds;
  readonly drivers: readonly PhysioDriver[];
  /** Número de señales con dato válido en la fila. */
  readonly signalsSeen: number;
}

export interface PhysioWeightState {
  readonly atS: number;
  /** Necesidades instantáneas de la última fila. */
  readonly raw: PhysioNeeds;
  /** Necesidades suavizadas (las que mueven los pesos). */
  readonly needs: PhysioNeeds;
  readonly drivers: readonly PhysioDriver[];
  readonly multipliers: PhysioMultipliers;
  readonly strainFactor: number;
  /** Capacidad metabólica sostenible que conserva el astronauta (1 − 0.15·exigencia) → término H. */
  readonly capacityFactor: number;
  /** Pendiente cómoda blanda (°) o null sin exigencia fisiológica → bisagra en el término T. */
  readonly comfortSlopeDeg: number | null;
  readonly source: PhysioSource;
  readonly stale: boolean;
}

/** Parámetros [diseño] del mapeo necesidades → pesos, en un solo lugar. */
export const PHYSIO_PARAMS = {
  riseTauS: 20,
  fallTauS: 120,
  quantum: 0.25,
  gains: { h: 3, t: 2, e: 3, r: 2, u: 2, phi: 3 },
  /** Pérdida de capacidad metabólica sostenible con exigencia fisiológica máxima. */
  capacityLoss: 0.15,
  /** Pendiente cómoda: de 15° (exigencia 0) a 10° (exigencia 1), anticipando FATIGUE/CAUTION. */
  comfortSlopeAtZeroDeg: 15,
  comfortSlopeAtOneDeg: 10,
  /** Zona muerta: variaciones pequeñas sobre el p95 nominal no mueven pesos. */
  deadband: 0.15,
  consumablesZeroPct: 50,
  consumablesOnePct: 15,
  fatigueZero: 0.3,
  fatigueOne: 0.6,
  posUncertaintyZeroM: 25,
  posUncertaintyOneM: 50,
} as const;

const ZERO_NEEDS: PhysioNeeds = {
  cardio: 0,
  thermal: 0,
  respiratory: 0,
  suit: 0,
  consumables: 0,
  fatigue: 0,
  exposure: 0,
  navigation: 0,
};

export const NEUTRAL_MULTIPLIERS: PhysioMultipliers = { t: 1, r: 1, e: 1, u: 1, h: 1 };

function num(v: HuellaRow[string]): number | null {
  if (v === undefined || v === null || v === "" || typeof v === "object") return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === "True" || v === "true") return 1;
  if (v === "False" || v === "false") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Rampa lineal acotada: 0 en `zero`, 1 en `one` (sirve también para señales que bajan: zero > one). */
export function ramp(value: number, zero: number, one: number): number {
  if (!Number.isFinite(value)) return 0;
  const span = one - zero;
  if (Math.abs(span) < 1e-12) return value >= one ? 1 : 0;
  return Math.max(0, Math.min(1, (value - zero) / span));
}

/**
 * Evalúa la fila HUELLA y devuelve las necesidades instantáneas con sus impulsores.
 * No aplica estado: es una función pura de (fila, contexto).
 */
export function assessPhysiology(row: HuellaRow | null, ctx: PhysioContext = {}): PhysioAssessment {
  const drivers: PhysioDriver[] = [];
  let seen = 0;
  const add = (
    need: PhysioNeedId,
    signal: string,
    value: number | null,
    unit: string,
    zero: number,
    one: number,
    ruleId: string,
    cap = 1,
  ) => {
    if (value === null) return;
    seen += 1;
    const r = ramp(value, zero, one);
    const db = PHYSIO_PARAMS.deadband;
    const intensity = cap * (r <= db ? 0 : (r - db) / (1 - db));
    drivers.push({ need, signal, value, unit, zero, one, ruleId, intensity });
  };
  const flag = (need: PhysioNeedId, signal: string, on: boolean, ruleId: string, cap = 1) => {
    seen += 1;
    drivers.push({
      need,
      signal,
      value: on ? 1 : 0,
      unit: "",
      zero: 0,
      one: 1,
      ruleId,
      intensity: on ? cap : 0,
    });
  };

  if (row) {
    const fc = num(row["heart_rate_bpm"]);
    const fce = num(row["hr_expected_bpm"]);
    const tc = num(row["core_temp_c"]);
    const fcMax = ctx.fcMax ?? 183.5;
    // Cardiovascular (EVA-06 FC residual, EVA-07 FC sostenida, EVA-12 ritmo)
    add(
      "cardio",
      "hr_residual_bpm",
      fc !== null && fce !== null ? fc - fce : null,
      "lpm",
      BASE.hrResidualP95,
      25,
      "EVA-06",
    );
    add("cardio", "heart_rate_bpm", fc, "lpm", BASE.hrP95, 0.9 * fcMax, "EVA-07", 0.6);
    const ri = num(row["rhythm_irregular"]);
    if (ri !== null) flag("cardio", "rhythm_irregular", ri >= 1, "EVA-12");
    // Térmica (EVA-09 temperatura central, EVA-10 PSI de Moran, EVA-21 humedad)
    add("thermal", "core_temp_c", tc, "°C", BASE.coreTempP95, 38.5, "EVA-09");
    const psi =
      fc !== null && tc !== null
        ? (5 * (tc - 37)) / (39.5 - 37) + (5 * (fc - 65)) / (180 - 65)
        : null;
    add("thermal", "psi", psi, "/10", BASE.psiP95, 9, "EVA-10");
    add(
      "thermal",
      "suit_humidity_pct",
      num(row["suit_humidity_pct"]),
      "%",
      BASE.humidityP95,
      75,
      "EVA-21",
      0.6,
    );
    // Respiratoria / ventilación (EVA-04 CO2, EVA-08 SpO2, EVA-11 FR, EVA-05 ventilador)
    add(
      "respiratory",
      "helmet_co2_mmhg",
      num(row["helmet_co2_mmhg"]),
      "mmHg",
      BASE.co2P95,
      20,
      "EVA-04",
    );
    add("respiratory", "spo2_pct", num(row["spo2_pct"]), "%", BASE.spo2P5, 90, "EVA-08");
    add(
      "respiratory",
      "resp_rate_rpm",
      num(row["resp_rate_rpm"]),
      "rpm",
      BASE.respRateP95,
      30,
      "EVA-11",
      0.6,
    );
    const fp = num(row["fan_pri_rpm"]);
    const fs = num(row["fan_sec_rpm"]);
    if (fp !== null || fs !== null) {
      add("respiratory", "fan_rpm", Math.max(fp ?? 0, fs ?? 0), "rpm", 27000, 20000, "EVA-05");
    }
    // Integridad del traje (EVA-02 presión, EVA-03 O2 secundario)
    const p = num(row["suit_o2_pressure_kpa"]);
    const setpoint = ctx.setpointKpa ?? 4.3 * PSI_TO_KPA;
    add(
      "suit",
      "suit_pressure_dev_kpa",
      p === null ? null : Math.abs(p - setpoint),
      "kPa",
      BASE.suitPressureDevP95,
      1.72,
      "EVA-02",
    );
    const src = row["o2_source"];
    if (src !== undefined && src !== "")
      flag("suit", "o2_source", String(src) === "SEC" || src === 1, "EVA-03");
    // Consumibles del traje [diseño]: el más bajo de O2 primario, batería y refrigerante
    const cons = ["o2_pri_storage_pct", "batt_primary_pct", "coolant_storage_pct"]
      .map((k) => num(row[k]))
      .filter((v): v is number => v !== null);
    if (cons.length > 0) {
      add(
        "consumables",
        "consumable_min_pct",
        Math.min(...cons),
        "%",
        PHYSIO_PARAMS.consumablesZeroPct,
        PHYSIO_PARAMS.consumablesOnePct,
        "PRE-02 [diseño]",
      );
    }
    // Navegación: sin enlace (EVA-16, solo PRECAUCION) o posición incierta [diseño]
    const comm = num(row["comm_ok"]);
    if (comm !== null) flag("navigation", "comm_ok", comm < 1, "EVA-16", 0.6);
    add(
      "navigation",
      "pos_uncertainty_m",
      num(row["pos_uncertainty_m"]),
      "m",
      PHYSIO_PARAMS.posUncertaintyZeroM,
      PHYSIO_PARAMS.posUncertaintyOneM,
      "[diseño]",
      0.6,
    );
  }

  // Contexto que no viene en la fila
  if (ctx.fatigueIndex !== undefined && Number.isFinite(ctx.fatigueIndex)) {
    add(
      "fatigue",
      "fatigue_index",
      ctx.fatigueIndex,
      "F",
      PHYSIO_PARAMS.fatigueZero,
      PHYSIO_PARAMS.fatigueOne,
      "FAT-06",
    );
  }
  if (ctx.doseRateMsvPerSol !== undefined && Number.isFinite(ctx.doseRateMsvPerSol)) {
    add("exposure", "dose_rate_ratio", ctx.doseRateMsvPerSol / 0.64, "× nominal", 1, 4, "EVA-13");
  }
  if (ctx.careerDoseMsv !== undefined && Number.isFinite(ctx.careerDoseMsv)) {
    add("exposure", "career_dose_msv", ctx.careerDoseMsv, "mSv", 480, 600, "PRE-14");
  }

  const needs: Record<PhysioNeedId, number> = { ...ZERO_NEEDS };
  for (const d of drivers) needs[d.need] = Math.max(needs[d.need], d.intensity);
  drivers.sort((a, b) => b.intensity - a.intensity || a.signal.localeCompare(b.signal));
  return { needs, drivers, signalsSeen: seen };
}

const quantize = (v: number) => Math.round(v / PHYSIO_PARAMS.quantum) * PHYSIO_PARAMS.quantum;

/** Necesidades → multiplicadores (≥ 1, cuantizados) y factor φ del término H. */
export function physioMultipliers(n: PhysioNeeds): {
  multipliers: PhysioMultipliers;
  strainFactor: number;
  capacityFactor: number;
  comfortSlopeDeg: number | null;
} {
  const g = PHYSIO_PARAMS.gains;
  const strain = Math.max(n.cardio, n.thermal, n.respiratory, n.fatigue);
  const slopeStrain = Math.max(strain, n.suit);
  const m = {
    h: 1 + g.h * strain,
    t: 1 + g.t * Math.max(n.cardio, n.respiratory, n.fatigue, n.suit),
    e: 1 + g.e * Math.max(n.consumables, n.suit, 0.5 * n.respiratory),
    r: 1 + g.r * Math.max(n.exposure, 0.5 * n.thermal),
    u: 1 + g.u * Math.max(n.navigation, 0.5 * Math.max(n.respiratory, n.thermal)),
  };
  return {
    multipliers: {
      t: Math.max(1, quantize(m.t)),
      r: Math.max(1, quantize(m.r)),
      e: Math.max(1, quantize(m.e)),
      u: Math.max(1, quantize(m.u)),
      h: Math.max(1, quantize(m.h)),
    },
    strainFactor: Math.max(1, quantize(1 + g.phi * strain)),
    capacityFactor: Math.round((1 - PHYSIO_PARAMS.capacityLoss * strain) * 20) / 20,
    comfortSlopeDeg:
      slopeStrain > 0
        ? Math.round(
            (PHYSIO_PARAMS.comfortSlopeAtZeroDeg -
              (PHYSIO_PARAMS.comfortSlopeAtZeroDeg - PHYSIO_PARAMS.comfortSlopeAtOneDeg) *
                slopeStrain) *
              2,
          ) / 2
        : null,
  };
}

export function initialPhysioState(atS = 0, source: PhysioSource = "none"): PhysioWeightState {
  return {
    atS,
    raw: ZERO_NEEDS,
    needs: ZERO_NEEDS,
    drivers: [],
    multipliers: NEUTRAL_MULTIPLIERS,
    strainFactor: 1,
    capacityFactor: 1,
    comfortSlopeDeg: null,
    source,
    stale: source === "none",
  };
}

/**
 * Un paso del estado fisiológico: evalúa la fila, suaviza (sube con τ = 20 s, baja con τ = 120 s) y
 * recalcula multiplicadores. Con fila ausente o corte de telemetría conserva lo último (INV-P3).
 */
export function stepPhysio(
  prev: PhysioWeightState,
  row: (HuellaRow & { readonly telemetryCut?: boolean }) | null,
  ctx: PhysioContext,
  atS: number,
  source: PhysioSource,
): PhysioWeightState {
  const dtS = Math.max(0, atS - prev.atS);
  if (!row || row.telemetryCut === true) {
    return { ...prev, atS, source, stale: true };
  }
  const a = assessPhysiology(row, ctx);
  const needs: Record<PhysioNeedId, number> = { ...ZERO_NEEDS };
  for (const k of PHYSIO_NEED_IDS) {
    const target = a.needs[k];
    const cur = prev.stale && prev.source === "none" ? target : prev.needs[k];
    const tau = target > cur ? PHYSIO_PARAMS.riseTauS : PHYSIO_PARAMS.fallTauS;
    const alpha = dtS > 0 ? 1 - Math.exp(-dtS / tau) : 0;
    const v = cur + (target - cur) * alpha;
    needs[k] = Math.abs(v) < 1e-4 ? 0 : Math.max(0, Math.min(1, v));
  }
  const { multipliers, strainFactor, capacityFactor, comfortSlopeDeg } = physioMultipliers(needs);
  return {
    atS,
    raw: a.needs,
    needs,
    drivers: a.drivers.filter((d) => d.intensity > 0).slice(0, 6),
    multipliers,
    strainFactor,
    capacityFactor,
    comfortSlopeDeg,
    source,
    stale: false,
  };
}

/**
 * Directiva que usa el enrutador: la de la FSM con multiplicadores y φ combinados por máximo (INV-P2).
 * Estado, causas, límites, meta, escalera, protocolo, enclavamiento y confirmación humana no cambian.
 */
export function applyPhysioToDirective(
  directive: NavigationDirective,
  physio: PhysioWeightState,
): NavigationDirective {
  const merged: Record<PhysioTerm, number> = { t: 1, r: 1, e: 1, u: 1, h: 1 };
  let raised = false;
  for (const k of ["t", "r", "e", "u", "h"] as const) {
    const fsm = Math.max(1, directive.weightMultipliers[k] ?? 1);
    const phy = Math.max(1, physio.multipliers[k]);
    merged[k] = Math.max(fsm, phy);
    if (phy > fsm) raised = true;
  }
  const strainFactor = Math.max(directive.strainFactor, physio.strainFactor);
  const capacityFactor = Math.min(directive.capacityFactor ?? 1, physio.capacityFactor);
  const comfort =
    physio.comfortSlopeDeg === null
      ? directive.comfortSlopeDeg
      : Math.min(directive.comfortSlopeDeg ?? Number.POSITIVE_INFINITY, physio.comfortSlopeDeg);
  if (
    !raised &&
    strainFactor === directive.strainFactor &&
    capacityFactor === (directive.capacityFactor ?? 1) &&
    comfort === directive.comfortSlopeDeg
  ) {
    return directive;
  }
  const top = physio.drivers[0];
  return {
    ...directive,
    weightMultipliers: merged,
    strainFactor,
    ...(capacityFactor < 1 ? { capacityFactor } : {}),
    ...(comfort !== undefined ? { comfortSlopeDeg: comfort } : {}),
    rationale: [
      ...directive.rationale,
      {
        ruleId: "PHYSIO",
        message: top
          ? `Pesos fisiológicos dinámicos: ${top.signal} = ${Number(top.value.toFixed(2))} ${top.unit} (${top.ruleId}) → ${formatMultipliers(merged)}`
          : `Pesos fisiológicos dinámicos → ${formatMultipliers(merged)}`,
      },
    ],
  };
}

export function formatMultipliers(m: Readonly<Partial<Record<PhysioTerm, number>>>): string {
  return (
    (["h", "t", "e", "r", "u"] as const)
      .filter((k) => (m[k] ?? 1) > 1)
      .map((k) => `${k.toUpperCase()}×${(m[k] ?? 1).toFixed(2)}`)
      .join(" · ") || "neutros"
  );
}

export function sameMultipliers(a: PhysioMultipliers, b: PhysioMultipliers): boolean {
  return a.t === b.t && a.r === b.r && a.e === b.e && a.u === b.u && a.h === b.h;
}
