/**
 * Mars Trek · Astronauta en vivo para la misión individual (port de simulador_huella.html de
 * "metricas de vida/huella_datos").
 *
 * Modelo fisiológico y de traje por segundo, determinista (PRNG con estado), parametrizado por el
 * tripulante (edad → FCmáx de Tanaka, estatura + masa → BSA de Mosteller para la disipación del LCVG,
 * VO₂máx, carga extra, setpoint del traje) y por fallas que se pueden inyectar en pleno camino
 * (potencia del ventilador, enfriamiento LCVG, fuga del traje, inestabilidad ECG, pérdida de enlace,
 * susto). Cada segundo evalúa las reglas HUELLA instantáneas del simulador y un filtro de persistencia
 * (sube si dura ≥ 3 s; de SUPERVIVENCIA/ABORTAR baja a PRECAUCIÓN cuando se resuelve; de PRECAUCIÓN
 * a ESTABLE solo tras n s de observación). El nivel filtrado alimenta la máquina de estados de la
 * sesión (fsm.ts), que conserva sus propios enclavamientos (CRITICAL hasta refugio/IV, EMERGENCY con
 * candado IV1). Todo lo que produce es SIMULATED.
 */
import type { CauseFlag, HuellaLevel } from "../contracts";
import { PSI_TO_KPA } from "./rules";
import type { TelemetrySampleRow } from "./telemetry";

export interface CrewParams {
  readonly ageY: number;
  readonly heightCm: number;
  readonly massKg: number;
  readonly vo2MaxMlKgMin: number;
  /** Carga extra (equipo + muestras) además del traje de 104 kg. */
  readonly payloadKg: number;
  /** Pendiente forzada (%) para pruebas; null = la del tramo de la ruta A* en curso. */
  readonly manualSlopePct: number | null;
  readonly setpointPsi: number;
  /** Dosis previa acumulada en la carrera (mSv) — PRE-14 (límite NASA 600 mSv). */
  readonly careerDoseMsv: number;
}

export interface SuitFaults {
  /** Potencia del ventilador (%) → 30 000 rpm al 100 %. */
  readonly fanPct: number;
  /** Enfriamiento LCVG (%) → agua a 22 °C al 100 %, 34 °C al 0 %. */
  readonly coolPct: number;
  readonly leakRateKpaMin: number;
  /** Probabilidad por segundo de latido irregular (%). */
  readonly arrhythmiaPct: number;
  readonly commLoss: boolean;
}

export interface ProtocolSettings {
  /** Observación en PRECAUCIÓN antes de volver a ESTABLE (s). */
  readonly observationS: number;
}

export const CREW_PRESETS = {
  EVA1: { ageY: 38, heightCm: 168, massKg: 65, vo2MaxMlKgMin: 40, payloadKg: 3.4 },
  EVA2: { ageY: 34, heightCm: 178, massKg: 72, vo2MaxMlKgMin: 44, payloadKg: 2.5 },
} as const;

export const DEFAULT_CREW: CrewParams = {
  ...CREW_PRESETS.EVA1,
  manualSlopePct: null,
  setpointPsi: 4.3,
  careerDoseMsv: 120,
};

export const NOMINAL_FAULTS: SuitFaults = {
  fanPct: 100,
  coolPct: 100,
  leakRateKpaMin: 0,
  arrhythmiaPct: 0,
  commLoss: false,
};

export const DEFAULT_PROTOCOL: ProtocolSettings = { observationS: 30 };

export interface LiveRuleHit {
  readonly ruleId: string;
  readonly level: HuellaLevel;
  readonly cause: CauseFlag;
  readonly value: number | string;
  readonly message: string;
}

export interface LiveSuitState {
  readonly tS: number;
  readonly rng: number;
  readonly met: number;
  readonly vo2: number;
  readonly fcEsp: number;
  readonly co2: number;
  readonly presKpa: number;
  readonly o2Src: "PRI" | "SEC";
  readonly o2PriPct: number;
  readonly fanRpm: number;
  readonly tc: number;
  readonly hum: number;
  readonly lcvg: number;
  readonly hr: number;
  readonly spo2: number;
  readonly rr: number;
  readonly rhythmIrregular: boolean;
  readonly commOk: boolean;
  readonly commLostSinceS: number | null;
  readonly slopePct: number;
  readonly walking: boolean;
  readonly doseEvaMsv: number;
  readonly scareAtS: number | null;
  /** Nivel instantáneo del motor de reglas y reglas que lo explican. */
  readonly raw: HuellaLevel;
  readonly rules: readonly LiveRuleHit[];
  /** Nivel filtrado (persistencia 3 s ↑ · observación n s ↓) que recibe la FSM. */
  readonly level: HuellaLevel;
  readonly candLevel: HuellaLevel | null;
  readonly candSinceS: number;
  readonly recoverySinceS: number | null;
}

export interface LiveStepContext {
  /** Pendiente del tramo de la ruta en curso (%), con signo. */
  readonly routeSlopePct: number;
  /** Caminando por la ruta (true) o trabajando en el destino (false). */
  readonly walking: boolean;
  readonly speActive: boolean;
  readonly doseRateMsvPerSol: number;
  readonly observationS: number;
  /** Eficacia del enfriamiento por la presión ambiente (PRE-07), 0.5–1. Omitida = 1. */
  readonly coolingFactor?: number;
}

const LEVELS: readonly HuellaLevel[] = ["NORMAL", "PRECAUCION", "SUPERVIVENCIA", "ABORTAR"];
const rank = (l: HuellaLevel) => LEVELS.indexOf(l);
/** Persistencia de subida del filtro (reglas.json · persistencia). */
export const LIVE_RISE_S = 3;
const BSA_REF = 1.74;

export function bsaMosteller(massKg: number, heightCm: number): number {
  return Math.sqrt((massKg * heightCm) / 3600);
}

export function fcMaxTanaka(ageY: number): number {
  return 208 - 0.7 * ageY;
}

function nextRandom(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

function pandolfMarsW(W: number, L: number, vel: number, pendPct: number): number {
  const G = Math.max(pendPct, 0);
  return (
    1.5 * W +
    2.0 * (W + L) * (L / W) ** 2 * 0.38 +
    1.2 * (W + L) * (1.5 * vel * vel + 0.35 * vel * G) * 0.38
  );
}

function velMs(pendPct: number): number {
  const f = pendPct >= 0 ? 1 - pendPct / 40 : 1 - Math.abs(pendPct) / 60;
  return Math.max(0.8, 2.0 * f) / 3.6;
}

const K_CAL = 1000.0 / (pandolfMarsW(65, 104 + 3.4, 2.0 / 3.6, 0) * 3.6);

export function createLiveSuit(params: CrewParams, seed = 7): LiveSuitState {
  return {
    tS: 0,
    rng: seed,
    met: 1000,
    vo2: 0.8,
    fcEsp: 86,
    co2: 2.6,
    presKpa: params.setpointPsi * PSI_TO_KPA,
    o2Src: "PRI",
    o2PriPct: 100,
    fanRpm: 30000,
    tc: 37.0,
    hum: 45,
    lcvg: 22.0,
    hr: 86,
    spo2: 98.2,
    rr: 15,
    rhythmIrregular: false,
    commOk: true,
    commLostSinceS: null,
    slopePct: 0,
    walking: true,
    doseEvaMsv: 0,
    scareAtS: null,
    raw: "NORMAL",
    rules: [],
    level: "NORMAL",
    candLevel: null,
    candSinceS: 0,
    recoverySinceS: null,
  };
}

/** Reglas HUELLA instantáneas del simulador (mismos umbrales que reglas.json / motor_reglas.py). */
export function evaluateLiveRules(
  s: LiveSuitState,
  params: CrewParams,
  speActive: boolean,
): { level: HuellaLevel; rules: LiveRuleHit[] } {
  const rules: LiveRuleHit[] = [];
  const fcMax = fcMaxTanaka(params.ageY);
  const setpoint = params.setpointPsi * PSI_TO_KPA;
  const dp = Math.abs(s.presKpa - setpoint);
  const r1 = (v: number, d = 1) => Number(v.toFixed(d));
  if (dp > 1.72)
    rules.push({
      ruleId: "EVA-02",
      level: "SUPERVIVENCIA",
      cause: "traje",
      value: r1(s.presKpa),
      message: `Presión del traje ${s.presKpa.toFixed(1)} kPa (ajuste ${setpoint.toFixed(1)})`,
    });
  else if (dp > 0.69)
    rules.push({
      ruleId: "EVA-02",
      level: "PRECAUCION",
      cause: "traje",
      value: r1(s.presKpa),
      message: `Presión del traje ${s.presKpa.toFixed(1)} kPa (ajuste ${setpoint.toFixed(1)})`,
    });
  if (s.o2Src === "SEC")
    rules.push({
      ruleId: "EVA-03",
      level: "ABORTAR",
      cause: "traje",
      value: "SEC",
      message: "Respirando del tanque secundario de O₂",
    });
  if (s.co2 > 20)
    rules.push({
      ruleId: "EVA-04",
      level: "SUPERVIVENCIA",
      cause: "traje",
      value: r1(s.co2),
      message: `CO₂ en casco ${s.co2.toFixed(1)} mmHg`,
    });
  else if (s.co2 > 15)
    rules.push({
      ruleId: "EVA-04",
      level: "PRECAUCION",
      cause: "traje",
      value: r1(s.co2),
      message: `CO₂ en casco ${s.co2.toFixed(1)} mmHg`,
    });
  if (s.fanRpm < 20000)
    rules.push({
      ruleId: "EVA-05",
      level: "SUPERVIVENCIA",
      cause: "traje",
      value: Math.round(s.fanRpm),
      message: `Ventilador a ${Math.round(s.fanRpm)} rpm`,
    });
  else if (s.fanRpm < 27000)
    rules.push({
      ruleId: "EVA-05",
      level: "PRECAUCION",
      cause: "traje",
      value: Math.round(s.fanRpm),
      message: `Ventilador a ${Math.round(s.fanRpm)} rpm`,
    });
  if (s.hr > 0.9 * fcMax || s.hr > 140)
    rules.push({
      ruleId: "EVA-07",
      level: "PRECAUCION",
      cause: "cardiaca",
      value: Math.round(s.hr),
      message: `FC ${Math.round(s.hr)} lpm (FCmáx ${Math.round(fcMax)})`,
    });
  if (s.tc >= 39.0)
    rules.push({
      ruleId: "EVA-09",
      level: "ABORTAR",
      cause: "termica",
      value: r1(s.tc, 2),
      message: `Temperatura central ${s.tc.toFixed(2)} °C`,
    });
  else if (s.tc >= 38.5)
    rules.push({
      ruleId: "EVA-09",
      level: "SUPERVIVENCIA",
      cause: "termica",
      value: r1(s.tc, 2),
      message: `Temperatura central ${s.tc.toFixed(2)} °C`,
    });
  else if (s.tc >= 38.0)
    rules.push({
      ruleId: "EVA-09",
      level: "PRECAUCION",
      cause: "termica",
      value: r1(s.tc, 2),
      message: `Temperatura central ${s.tc.toFixed(2)} °C`,
    });
  if (s.rhythmIrregular)
    rules.push({
      ruleId: "EVA-12",
      level: "SUPERVIVENCIA",
      cause: "cardiaca",
      value: 1,
      message: "El ECG muestra un ritmo irregular",
    });
  if (speActive)
    rules.push({
      ruleId: "EVA-13",
      level: "SUPERVIVENCIA",
      cause: "radiacion",
      value: "SPE",
      message: "Evento de partículas solares: refugio obligatorio",
    });
  if (s.commLostSinceS !== null && s.tS - s.commLostSinceS >= 300)
    rules.push({
      ruleId: "EVA-16",
      level: "PRECAUCION",
      cause: "comunicaciones",
      value: 0,
      message: "Más de 5 min sin contacto: regresar al último waypoint",
    });
  if (s.hum > 75)
    rules.push({
      ruleId: "EVA-21",
      level: "PRECAUCION",
      cause: "termica",
      value: Math.round(s.hum),
      message: `Humedad del traje ${Math.round(s.hum)} %`,
    });

  let level: HuellaLevel = "NORMAL";
  for (const r of rules) if (rank(r.level) > rank(level)) level = r.level;
  if (rules.filter((r) => r.level === "SUPERVIVENCIA").length >= 2) {
    level = "ABORTAR";
    const lead = rules.find((r) => r.level === "SUPERVIVENCIA")!;
    rules.push({
      ruleId: "LOGICA",
      level: "ABORTAR",
      cause: lead.cause,
      value: "2+ SUP",
      message: "Dos o más reglas en SUPERVIVENCIA",
    });
  }
  return { level, rules };
}

/** Un segundo de física, fisiología, reglas y filtro de persistencia. */
export function stepLiveSuit(
  prev: LiveSuitState,
  params: CrewParams,
  faults: SuitFaults,
  ctx: LiveStepContext,
): LiveSuitState {
  let rng = prev.rng;
  const rand = () => {
    const [v, nextState] = nextRandom(rng);
    rng = nextState;
    return v;
  };
  const t = prev.tS + 1;
  const spKpa = params.setpointPsi * PSI_TO_KPA;
  const slopePct = params.manualSlopePct ?? ctx.routeSlopePct;
  const walking = params.manualSlopePct !== null || ctx.walking;

  // 1. Metabolismo (Pandolf a 0.38 g con la masa y la carga del tripulante) y FC esperada
  const metTarget = walking
    ? pandolfMarsW(params.massKg, 104 + params.payloadKg, velMs(slopePct), slopePct) * 3.6 * K_CAL
    : 1024;
  const met = prev.met + (metTarget - prev.met) * 0.04;
  const vo2 = met / 20.9 / 60;
  const vo2Rep = (3.5 * params.massKg) / 1000;
  const vo2Max = (params.vo2MaxMlKgMin * params.massKg) / 1000;
  const fcMax = fcMaxTanaka(params.ageY);
  const frac = Math.min(Math.max((vo2 - vo2Rep) / Math.max(1e-6, vo2Max - vo2Rep), 0), 1);
  const fcEsp = prev.fcEsp + (62 + (fcMax - 62) * frac - prev.fcEsp) * 0.03;

  // 2. Ventilador → CO₂
  const targetRpm = 30000 * (faults.fanPct / 100);
  const fanRpm = prev.fanRpm + (targetRpm - prev.fanRpm) * 0.15;
  const co2 =
    fanRpm < 25000
      ? Math.min(35, prev.co2 + 0.08 * ((25000 - fanRpm) / 25000))
      : prev.co2 + (2.6 - prev.co2) * 0.06;

  // 3. Fuga del traje → presión y cambio a O₂ secundario
  let presKpa = prev.presKpa;
  let o2Src = prev.o2Src;
  if (faults.leakRateKpaMin > 0) {
    if (presKpa > spKpa - 1.9) presKpa -= faults.leakRateKpaMin / 60;
    else {
      o2Src = "SEC";
      presKpa = spKpa - 2.4;
    }
  } else {
    o2Src = "PRI";
    presKpa += (spKpa - presKpa) * 0.08;
  }

  // 4. Térmica: disipación del LCVG escalada por el área corporal (BSA de Mosteller)
  const bsa = bsaMosteller(params.massKg, params.heightCm);
  const heatFluxRatio = met / 3.6 / bsa / (1000 / 3.6 / BSA_REF);
  const coolDeficit = 1 - (faults.coolPct / 100) * Math.max(0, Math.min(1, ctx.coolingFactor ?? 1));
  const lcvg = prev.lcvg + (22 + 12 * coolDeficit - prev.lcvg) * 0.08;
  let tc = prev.tc;
  let hum = prev.hum;
  if (coolDeficit > 0.15) {
    tc += 0.015 * coolDeficit * heatFluxRatio;
    hum = Math.min(92, hum + 0.18 * coolDeficit);
  } else {
    tc += (37.0 - tc) * 0.025 * (bsa / BSA_REF);
    hum += (45 - hum) * 0.05;
  }

  // 5. Radiación, ritmo, enlace y susto
  const doseEvaMsv = prev.doseEvaMsv + ctx.doseRateMsvPerSol / 24 / 3600;
  const rhythmIrregular = faults.arrhythmiaPct > 0 && rand() * 100 < faults.arrhythmiaPct;
  const commOk = !faults.commLoss;
  const commLostSinceS = commOk ? null : (prev.commLostSinceS ?? t);
  let scare = 0;
  if (prev.scareAtS !== null && t >= prev.scareAtS && t - prev.scareAtS < 120) {
    const d = t - prev.scareAtS;
    scare = 35 * (1 - Math.exp(-d / 3)) * Math.exp(-d / 35);
  }
  const hr =
    fcEsp + scare + 1.2 * Math.max(0, co2 - 10) + 18 * Math.max(0, tc - 37.2) + (rand() - 0.5) * 3;
  const o2PriPct = Math.max(0, prev.o2PriPct - ((2.13 * vo2) / 950 / 60) * 100);
  // [diseño] El simulador original no modela SpO₂ ni frecuencia respiratoria: valores plausibles
  const spo2 = 98.2 + (rand() - 0.5) * 0.4;
  const rr = 12 + 10 * frac + 0.5 * Math.max(0, co2 - 8) + (rand() - 0.5);

  const next: LiveSuitState = {
    ...prev,
    tS: t,
    rng,
    met,
    vo2,
    fcEsp,
    co2,
    presKpa,
    o2Src,
    o2PriPct,
    fanRpm,
    tc,
    hum,
    lcvg,
    hr,
    spo2,
    rr,
    rhythmIrregular,
    commOk,
    commLostSinceS,
    slopePct,
    walking,
    doseEvaMsv,
  };

  // 6. Reglas instantáneas + filtro de persistencia
  const { level: raw, rules } = evaluateLiveRules(next, params, ctx.speActive);
  let level = prev.level;
  let candLevel = prev.candLevel;
  let candSinceS = prev.candSinceS;
  let recoverySinceS = prev.recoverySinceS;
  if (rank(raw) > rank(level)) {
    recoverySinceS = null;
    if (candLevel !== raw) {
      candLevel = raw;
      candSinceS = t;
    }
    if (t - candSinceS >= LIVE_RISE_S) {
      level = raw;
      candLevel = null;
    }
  } else {
    candLevel = null;
    if (rank(level) >= rank("SUPERVIVENCIA") && rank(raw) <= rank("PRECAUCION")) {
      level = "PRECAUCION";
      recoverySinceS = t;
    } else if (level === "PRECAUCION") {
      if (raw === "NORMAL") {
        if (recoverySinceS === null) recoverySinceS = t;
        if (t - recoverySinceS >= ctx.observationS) {
          level = "NORMAL";
          recoverySinceS = null;
        }
      } else {
        recoverySinceS = t;
      }
    }
  }
  return { ...next, raw, rules, level, candLevel, candSinceS, recoverySinceS };
}

/**
 * Reglas que justifican el nivel filtrado (nunca por encima de él): así la FSM no adelanta una
 * escalada que el filtro de 3 s todavía no confirmó (p. ej. dos SUPERVIVENCIA de 1 s ⇒ no ABORTAR).
 */
export function liveTriggers(s: LiveSuitState): LiveRuleHit[] {
  const cap = rank(s.level);
  if (cap === 0) return [];
  const out: LiveRuleHit[] = [];
  let sup = 0;
  for (const r of s.rules) {
    if (rank(r.level) > cap) continue;
    if (r.level === "SUPERVIVENCIA") {
      if (cap < rank("ABORTAR") && sup >= 1) continue;
      sup += 1;
    }
    out.push(r);
  }
  return out;
}

/** Fila con las columnas HUELLA (mismo formato que el generador y la repetición CSV). */
export function liveRow(
  s: LiveSuitState,
  params: CrewParams,
  extras: {
    readonly batteryPct: number;
    readonly coolantPct: number;
    readonly fatigueIndex: number;
    readonly evId?: string;
  },
): TelemetrySampleRow {
  const fcMax = fcMaxTanaka(params.ageY);
  return {
    t_s: s.tS,
    ev_id: extras.evId ?? "EVA1",
    heart_rate_bpm: Number(s.hr.toFixed(1)),
    hr_expected_bpm: Number(s.fcEsp.toFixed(1)),
    spo2_pct: Number(s.spo2.toFixed(1)),
    core_temp_c: Number(s.tc.toFixed(2)),
    resp_rate_rpm: Number(s.rr.toFixed(1)),
    rhythm_irregular: s.rhythmIrregular ? 1 : 0,
    helmet_co2_mmhg: Number(s.co2.toFixed(2)),
    suit_o2_pressure_kpa: Number(s.presKpa.toFixed(2)),
    suit_total_pressure_kpa: Number(s.presKpa.toFixed(2)),
    suit_humidity_pct: Number(s.hum.toFixed(1)),
    lcvg_inlet_temp_c: Number(s.lcvg.toFixed(2)),
    fan_pri_rpm: Math.round(s.fanRpm),
    fan_sec_rpm: 0,
    o2_source: s.o2Src,
    o2_pri_storage_pct: Number(s.o2PriPct.toFixed(2)),
    o2_pri_pressure_psi: Number(((950 * s.o2PriPct) / 100).toFixed(1)),
    batt_primary_pct: Number(extras.batteryPct.toFixed(1)),
    coolant_storage_pct: Number(extras.coolantPct.toFixed(1)),
    metabolic_rate_kj_h: Math.round(s.met),
    vo2_l_min: Number(s.vo2.toFixed(3)),
    dose_eva_msv: Number(s.doseEvaMsv.toFixed(5)),
    comm_ok: s.commOk ? 1 : 0,
    pos_uncertainty_m: 1,
    fc_max_bpm: Math.round(fcMax),
    event_label: s.walking ? "traslado" : "trabajo",
    nivel_huella: s.level,
    simulated: true,
    dataType: "SIMULATED",
    telemetryCut: false,
    fatigueIndex: extras.fatigueIndex,
    dataQuality: {
      ecg: "valid",
      spo2: "valid",
      coreTemp: "valid",
      suitPressure: "valid",
      co2: "valid",
    },
  } as TelemetrySampleRow;
}

export interface RadiationRow {
  readonly key: string;
  readonly labelEs: string;
  readonly labelEn: string;
  readonly hours: number;
  readonly doseEvaMsv: number;
  readonly totalMsv: number;
  readonly level: HuellaLevel;
  readonly effectEs: string;
  readonly effectEn: string;
}

/**
 * Matriz de radiación del simulador: dosis por tiempo fuera (0.64 mSv/día, MSL/RAD; SPE ×150 [diseño])
 * sumada a la dosis de carrera, con el impacto según PRE-14 (480/600 mSv) y EVA-13.
 */
export function radiationMatrix(careerDoseMsv: number, speActive: boolean): RadiationRow[] {
  const perHour = (0.64 / 24) * (speActive ? 150 : 1);
  const rows: Array<[string, string, string, number]> = [
    ["1h", "1 hora EVA", "1 h EVA", 1],
    ["4h", "4 horas EVA", "4 h EVA", 4],
    ["8h", "8 horas (límite EVA)", "8 h (EVA limit)", 8],
    ["30d", "30 días (20 EVAs × 6 h)", "30 days (20 EVAs × 6 h)", 120],
    ["180d", "180 días (estancia media)", "180 days (mid stay)", 720],
    ["500d", "500 días (misión larga)", "500 days (long mission)", 2000],
  ];
  return rows.map(([key, labelEs, labelEn, hours]) => {
    const doseEvaMsv = perHour * hours;
    const totalMsv = careerDoseMsv + doseEvaMsv;
    let level: HuellaLevel = "NORMAL";
    let effectEs = "Sin síntomas agudos; daño celular acumulativo mínimo.";
    let effectEn = "No acute symptoms; minimal cumulative cell damage.";
    if (doseEvaMsv >= 500) {
      level = "ABORTAR";
      effectEs = "Riesgo agudo (SPE): fatiga, náuseas y caída inmune sin refugio (EVA-13).";
      effectEn = "Acute risk (SPE): fatigue, nausea and immune drop without shelter (EVA-13).";
    } else if (totalMsv > 600) {
      level = "ABORTAR";
      effectEs = "Supera el límite de carrera NASA (600 mSv, PRE-14).";
      effectEn = "Exceeds the NASA career limit (600 mSv, PRE-14).";
    } else if (totalMsv > 480) {
      level = "PRECAUCION";
      effectEs = "Supera el 80 % del límite NASA (PRE-14): restringir tiempo fuera.";
      effectEn = "Above 80 % of the NASA limit (PRE-14): restrict time outside.";
    } else if (doseEvaMsv >= 50) {
      level = "SUPERVIVENCIA";
      effectEs = "Exposición moderada: daño en ADN y riesgo estocástico a largo plazo.";
      effectEn = "Moderate exposure: DNA damage and long-term stochastic risk.";
    }
    return { key, labelEs, labelEn, hours, doseEvaMsv, totalMsv, level, effectEs, effectEn };
  });
}
