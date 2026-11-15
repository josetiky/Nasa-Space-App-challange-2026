/**
 * Mars Trek · Simulador determinista de telemetría biomédica y de traje (Tarea 9, ASTRONAUT_HEALTH_STATE_MACHINE §10).
 * Todas las filas producidas llevan simulated: true y dataType: "SIMULATED".
 */
import { mulberry32 } from "@/core/rng";
import type { DataQualityStatus } from "../contracts";
import { PSI_TO_KPA, type HuellaRow } from "./rules";
import { stepFatigue } from "./fatigue";

export type TelemetryIncidentId =
  | "nominal"
  | "falla_ventilador"
  | "fuga_traje"
  | "estres_termico"
  | "arritmia"
  | "perdida_comunicacion"
  | "fatiga_progresiva"
  | "recuperacion_descanso"
  | "perdida_sensores"
  | "emergencia_medica";

export interface TelemetryCrewConfig {
  readonly evId: string;
  readonly age?: number;
  readonly massKg?: number;
  readonly restingHrBpm?: number;
  readonly restingCoreTempC?: number;
  readonly vo2MaxMlKgMin?: number;
}

export interface TelemetrySimState {
  readonly evId: string;
  readonly seed: number;
  readonly rngState: number;
  readonly tS: number;
  readonly fcMax: number;
  readonly fcReposo: number;
  readonly tcReposo: number;
  readonly massKg: number;
  readonly vo2RepLMin: number;
  readonly vo2MaxLMin: number;
  readonly metKjH: number;
  readonly metSlowKjH: number;
  readonly fcExpectedBpm: number;
  readonly tcC: number;
  readonly co2MmHg: number;
  readonly priPsi: number;
  readonly secPsi: number;
  readonly o2Source: "PRI" | "SEC";
  readonly suitPressureKpa: number;
  readonly fanPriRpm: number;
  readonly fanSecRpm: number;
  readonly humidityPct: number;
  readonly lcvgC: number;
  readonly batteryWh: number;
  readonly coolantPct: number;
  readonly doseEvaMsv: number;
  readonly fatigueIndex: number;
  readonly incident: TelemetryIncidentId;
  readonly incidentElapsedS: number;
  readonly simulated: true;
}

export interface TelemetryStepInput {
  readonly dtS?: number;
  readonly metabolicW?: number;
  readonly resting?: boolean;
  readonly incident?: TelemetryIncidentId;
}

export interface TelemetrySampleRow extends HuellaRow {
  readonly t_s: number;
  readonly ev_id: string;
  readonly simulated: true;
  readonly dataType: "SIMULATED";
  readonly telemetryCut: boolean;
  readonly fatigueIndex: number;
  readonly dataQuality: Readonly<Record<string, DataQualityStatus>>;
}

const SETPOINT_KPA = 4.3 * PSI_TO_KPA;

function expFilter(prev: number, target: number, tauS: number, dtS = 1): number {
  return prev + (target - prev) * (1 - Math.exp(-dtS / Math.max(1e-6, tauS)));
}

export function createTelemetry(
  profile: TelemetryCrewConfig = { evId: "EVA1" },
  seed = 42,
): TelemetrySimState {
  const age = profile.age ?? 38;
  const massKg = profile.massKg ?? 65.0;
  const fcReposo = profile.restingHrBpm ?? 62.0;
  const tcReposo = profile.restingCoreTempC ?? 37.0;
  const vo2Max = profile.vo2MaxMlKgMin ?? 40.0;

  return {
    evId: profile.evId,
    seed,
    rngState: seed,
    tS: 0,
    fcMax: 208 - 0.7 * age,
    fcReposo,
    tcReposo,
    massKg,
    vo2RepLMin: (3.5 * massKg) / 1000,
    vo2MaxLMin: (vo2Max * massKg) / 1000,
    metKjH: 950,
    metSlowKjH: 950,
    fcExpectedBpm: fcReposo + 18,
    tcC: tcReposo,
    co2MmHg: 3.5,
    priPsi: 950,
    secPsi: 6000,
    o2Source: "PRI",
    suitPressureKpa: SETPOINT_KPA,
    fanPriRpm: 30000,
    fanSecRpm: 0,
    humidityPct: 45,
    lcvgC: 22,
    batteryWh: 500,
    coolantPct: 100,
    doseEvaMsv: 0,
    fatigueIndex: 0,
    incident: "nominal",
    incidentElapsedS: 0,
    simulated: true,
  };
}

/**
 * Avanza el simulador de telemetría dtS segundos (por defecto 1 s) de forma determinista con semilla.
 */
export function stepTelemetry(
  prev: TelemetrySimState,
  input: TelemetryStepInput = {},
): { state: TelemetrySimState; row: TelemetrySampleRow } {
  const dtS = Math.max(1, Math.round(input.dtS ?? 1));
  const incident = input.incident ?? prev.incident;
  const rng = { next: mulberry32(prev.rngState + prev.tS * 31 + 7) };
  const gauss = (std: number) => {
    const u1 = Math.max(1e-9, rng.next());
    const u2 = rng.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * std;
  };

  let cur = {
    ...prev,
    incident,
    incidentElapsedS: incident === prev.incident ? prev.incidentElapsedS : 0,
  };

  let lastRow: TelemetrySampleRow | null = null;

  for (let s = 0; s < dtS; s += 1) {
    const nextT = cur.tS + 1;
    const incDt = incident === "nominal" ? 0 : cur.incidentElapsedS + 1;

    const baseMetW =
      incident === "fatiga_progresiva"
        ? 640
        : incident === "recuperacion_descanso" || input.resting
          ? 180
          : (input.metabolicW ?? 278);

    const targetMetKjH = baseMetW * 3.6;
    const metKjH = expFilter(cur.metKjH, targetMetKjH, 40, 1);
    const metSlowKjH = expFilter(cur.metSlowKjH, metKjH, 900, 1);
    const vo2 = metKjH / 20.9 / 60;
    const vco2 = 0.85 * vo2;
    const frac = Math.max(
      0,
      Math.min(1, (vo2 - cur.vo2RepLMin) / (cur.vo2MaxLMin - cur.vo2RepLMin)),
    );
    const fcExpected = expFilter(
      cur.fcExpectedBpm,
      cur.fcReposo + (cur.fcMax - cur.fcReposo) * frac,
      45,
      1,
    );

    let fanPri = 30000 + gauss(25);
    let fanSec = 0;
    let o2Source: "PRI" | "SEC" = cur.o2Source;
    let suitPress = cur.suitPressureKpa;
    let co2MmHg = cur.co2MmHg;
    let tcC = expFilter(cur.tcC, cur.tcReposo + 0.0006 * (metSlowKjH - 500), 600, 1);
    let humidity = 45;
    let lcvg = 22;
    let spo2 = Math.min(100, 98.2 + gauss(0.2));
    let rhythmIrregular = 0;
    let commOk = 1;
    let fcStress = 0;
    let telemetryCut = false;

    if (incident === "falla_ventilador") {
      fanPri = Math.max(0, 30000 * (1 - incDt / 45));
      if (fanPri < 20000) {
        co2MmHg = cur.co2MmHg + (3.0 / 60) * (vco2 / 0.7);
      }
      fcStress = 18 * Math.exp(-incDt / 300);
    } else if (incident === "fuga_traje") {
      if (suitPress > SETPOINT_KPA - 1.9) {
        suitPress -= 0.6 / 60;
      } else {
        o2Source = "SEC";
        suitPress = SETPOINT_KPA - 2.4;
      }
      fcStress = 12 * Math.exp(-incDt / 400);
    } else if (incident === "estres_termico") {
      lcvg = 22 + Math.min(10, incDt / 18);
      tcC = cur.tcC + (0.08 / 60) * (metKjH / 1000);
      humidity = Math.min(88, 45 + incDt / 20);
      fcStress = 20 * Math.max(0, tcC - cur.tcReposo);
    } else if (incident === "arritmia") {
      rhythmIrregular = 1;
      fcStress = 12;
    } else if (incident === "perdida_comunicacion") {
      commOk = 0;
    } else if (incident === "emergencia_medica") {
      rhythmIrregular = 1;
      spo2 = 83.0;
      tcC = 39.2;
      fcStress = 35;
    } else if (incident === "perdida_sensores") {
      telemetryCut = true;
    } else {
      co2MmHg = expFilter(cur.co2MmHg, 1.5 + 4.0 * vco2, 90, 1);
    }

    const fc = fcExpected + gauss(1.5) + 1.2 * Math.max(0, co2MmHg - 10) + fcStress;
    const rr = 12 + 16 * frac + 0.8 * Math.max(0, co2MmHg - 10) + gauss(0.4);

    const priPsi = o2Source === "PRI" ? Math.max(0, cur.priPsi - (2.13 * vo2) / 60) : cur.priPsi;
    const secPsi = o2Source === "SEC" ? Math.max(0, cur.secPsi - 20 / 60) : cur.secPsi;
    const batteryWh = Math.max(0, cur.batteryWh - 50 / 3600);
    const coolantPct = Math.max(0, cur.coolantPct - (0.003 * metKjH) / 1000);
    const doseEvaMsv = cur.doseEvaMsv + 0.64 / 86400;

    const nextFatigue = stepFatigue(cur.fatigueIndex, 1, {
      metabolicW: baseMetW,
      resting: incident === "recuperacion_descanso" || Boolean(input.resting),
    });

    const dataQuality: Record<string, DataQualityStatus> = telemetryCut
      ? {
          ecg: "missing",
          spo2: "missing",
          coreTemp: "missing",
          suitPressure: "valid",
          co2: "valid",
        }
      : {
          ecg: "valid",
          spo2: "valid",
          coreTemp: "valid",
          suitPressure: "valid",
          co2: "valid",
        };

    cur = {
      ...cur,
      tS: nextT,
      rngState: Math.floor(rng.next() * 1_000_000_000),
      metKjH,
      metSlowKjH,
      fcExpectedBpm: fcExpected,
      tcC,
      co2MmHg,
      priPsi,
      secPsi,
      o2Source,
      suitPressureKpa: suitPress,
      fanPriRpm: fanPri,
      fanSecRpm: fanSec,
      humidityPct: humidity,
      lcvgC: lcvg,
      batteryWh,
      coolantPct,
      doseEvaMsv,
      fatigueIndex: nextFatigue,
      incidentElapsedS: incDt,
    };

    lastRow = {
      t_s: nextT,
      ev_id: cur.evId,
      batt_primary_pct: Number(((100 * batteryWh) / 500).toFixed(2)),
      o2_source: o2Source,
      o2_pri_pressure_psi: Number(priPsi.toFixed(2)),
      o2_sec_pressure_psi: Number(secPsi.toFixed(1)),
      suit_o2_pressure_kpa: Number((suitPress + gauss(0.05)).toFixed(2)),
      helmet_co2_mmhg: Number(Math.max(0, co2MmHg).toFixed(2)),
      fan_pri_rpm: Math.round(fanPri),
      fan_sec_rpm: Math.round(fanSec),
      coolant_storage_pct: Number(coolantPct.toFixed(2)),
      heart_rate_bpm: telemetryCut ? "" : Number(fc.toFixed(1)),
      spo2_pct: telemetryCut ? "" : Number(spo2.toFixed(1)),
      core_temp_c: telemetryCut ? "" : Number(tcC.toFixed(2)),
      resp_rate_rpm: telemetryCut ? "" : Number(rr.toFixed(1)),
      rhythm_irregular: telemetryCut ? "" : rhythmIrregular,
      suit_humidity_pct: Number(humidity.toFixed(1)),
      lcvg_inlet_temp_c: Number(lcvg.toFixed(2)),
      comm_ok: commOk,
      metabolic_rate_kj_h: Math.round(metKjH),
      vo2_l_min: Number(vo2.toFixed(3)),
      vco2_l_min: Number(vco2.toFixed(3)),
      hr_expected_bpm: Number(fcExpected.toFixed(1)),
      dose_eva_msv: Number(doseEvaMsv.toFixed(4)),
      simulated: true,
      dataType: "SIMULATED",
      telemetryCut,
      fatigueIndex: nextFatigue,
      dataQuality,
    };
  }

  return { state: cur, row: lastRow! };
}
