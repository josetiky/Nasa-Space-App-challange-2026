/**
 * MarsWalk · Funciones puras de presentación (sin React) para la vista adaptada de mars-space-rockstars.
 * Solo traducen el estado del store a texto/estructura de vista. No deciden rutas, costos ni estados de salud:
 * todo valor proviene de src/core/trek/** a través de trekStore.
 */
import type { HealthState, HealthTransition, ReplanRecord } from "@/core/trek/contracts";
import { healthRank } from "@/core/trek/contracts";
import type { TelemetrySampleRow } from "@/core/trek/health/telemetry";

export type FeedLevel = "info" | "warn" | "crit";

export interface FeedEntry {
  readonly key: string;
  readonly atS: number;
  readonly level: FeedLevel;
  readonly source: "replan" | "health";
  readonly text: string;
  readonly seq: number;
}

function replanLevel(decision: ReplanRecord["decision"]): FeedLevel {
  if (decision === "emergency" || decision === "hold-position") return "crit";
  if (decision === "replan" || decision === "propose") return "warn";
  return "info";
}

function healthLevel(to: HealthState): FeedLevel {
  const r = healthRank(to);
  if (r >= healthRank("CRITICAL")) return "crit";
  if (r >= healthRank("FATIGUE")) return "warn";
  return "info";
}

/**
 * Bitácora del asistente: fusiona replanificaciones A* y transiciones de la FSM de salud,
 * ordenadas por tiempo de misión (las más recientes al final) y limitadas a `limit` entradas.
 */
export function buildAssistantFeed(
  replanLog: readonly ReplanRecord[],
  history: readonly HealthTransition[],
  limit = 40,
): FeedEntry[] {
  const entries: FeedEntry[] = [
    ...replanLog.map((r): FeedEntry => ({
      key: `r-${r.seq}`,
      atS: r.atS,
      level: replanLevel(r.decision),
      source: "replan",
      seq: r.seq,
      text: `[A* · ${r.decision.toUpperCase()}] ${r.summary}`,
    })),
    ...history.map((h): FeedEntry => {
      const auth = h.humanConfirmed
        ? ` · confirmado por ${h.humanConfirmed.by}: "${h.humanConfirmed.justification}"`
        : "";
      const rules = h.triggers.map((t) => t.ruleId).join(", ");
      return {
        key: `h-${h.seq}`,
        atS: h.missionTimeS,
        level: healthLevel(h.to),
        source: "health",
        seq: h.seq,
        text: `[FSM] ${h.from} → ${h.to}${rules ? ` (${rules})` : ""}${auth}`,
      };
    }),
  ];
  // Mismo instante: primero la transición de salud (causa) y luego la replanificación (efecto); dentro de cada fuente, por seq numérico.
  entries.sort(
    (a, b) =>
      a.atS - b.atS ||
      (a.source === b.source ? 0 : a.source === "health" ? -1 : 1) ||
      a.seq - b.seq,
  );
  return entries.slice(-limit);
}

/** Longitud mínima de justificación para registrar una confirmación humana. */
export const MIN_JUSTIFICATION_CHARS = 20;

/**
 * Compuerta de UI para el descenso de estado: solo se habilita si la FSM lo exige
 * y el operador identificó su rol y escribió una justificación suficiente.
 */
export function canSubmitHumanConfirmation(input: {
  readonly requiresHumanConfirmation: boolean;
  readonly by: string;
  readonly justification: string;
}): boolean {
  return (
    input.requiresHumanConfirmation &&
    input.by.trim().length >= 3 &&
    input.justification.trim().length >= MIN_JUSTIFICATION_CHARS
  );
}

export interface VitalReading {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly value: number | null;
  readonly digits: number;
  /** Calidad declarada por el simulador para el canal (valid | stale | missing | implausible). */
  readonly quality: string;
}

function num(v: string | number | boolean | undefined | null): number | null {
  if (v === undefined || v === null || v === "" || typeof v === "boolean") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrae lecturas de la última fila de telemetría (siempre SIMULATED).
 * No aplica umbrales: el nivel de alerta lo decide exclusivamente la FSM HUELLA.
 */
export function vitalsFromRow(row: TelemetrySampleRow | null): VitalReading[] {
  const q = row?.dataQuality ?? {};
  const v = (key: string) => (row ? num(row[key] as string | number | undefined) : null);
  return [
    {
      id: "hr",
      label: "FC",
      unit: "bpm",
      value: v("heart_rate_bpm"),
      digits: 0,
      quality: q["ecg"] ?? (row ? "valid" : "missing"),
    },
    {
      id: "spo2",
      label: "SpO₂",
      unit: "%",
      value: v("spo2_pct"),
      digits: 1,
      quality: q["spo2"] ?? (row ? "valid" : "missing"),
    },
    {
      id: "core",
      label: "T. central",
      unit: "°C",
      value: v("core_temp_c"),
      digits: 2,
      quality: q["coreTemp"] ?? (row ? "valid" : "missing"),
    },
    {
      id: "co2",
      label: "CO₂ casco",
      unit: "mmHg",
      value: v("helmet_co2_mmhg"),
      digits: 2,
      quality: q["co2"] ?? (row ? "valid" : "missing"),
    },
    {
      id: "press",
      label: "P. traje",
      unit: "kPa",
      value: v("suit_o2_pressure_kpa"),
      digits: 2,
      quality: q["suitPressure"] ?? (row ? "valid" : "missing"),
    },
    {
      id: "o2pri",
      label: "O₂ prim.",
      unit: "psi",
      value: v("o2_pri_pressure_psi"),
      digits: 0,
      quality: row ? "valid" : "missing",
    },
    {
      id: "fan",
      label: "Ventilador",
      unit: "rpm",
      value: v("fan_pri_rpm"),
      digits: 0,
      quality: row ? "valid" : "missing",
    },
    {
      id: "batt",
      label: "Batería",
      unit: "%",
      value: v("batt_primary_pct"),
      digits: 1,
      quality: row ? "valid" : "missing",
    },
    {
      id: "dose",
      label: "Dosis EVA",
      unit: "µSv",
      value: scale(v("dose_eva_msv"), 1000),
      digits: 2,
      quality: row ? "valid" : "missing",
    },
  ];
}

function scale(v: number | null, k: number): number | null {
  return v === null ? null : v * k;
}

/** Formato T+ hh:mm:ss del reloj de misión. */
export function missionClock(s: number): string {
  const t = Math.max(0, Math.round(s));
  const hh = String(Math.floor(t / 3600)).padStart(2, "0");
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  return `T+ ${hh}:${mm}:${ss}`;
}

/** Formato de latitud/longitud planetocéntrica con hemisferio explícito. */
export function formatLatLon(geo: { readonly lat: number; readonly lon: number }): string {
  const lat = `${Math.abs(geo.lat).toFixed(4)}° ${geo.lat < 0 ? "S" : "N"}`;
  const lon = `${Math.abs(geo.lon).toFixed(4)}° ${geo.lon < 0 ? "W" : "E"}`;
  return `${lat} · ${lon}`;
}

/** Paso "bonito" de cuadrícula métrica (1, 2, 5 × 10ⁿ) para ~`targetLines` divisiones. */
export function niceGridStep(extentM: number, targetLines = 8): number {
  const raw = Math.max(1e-6, extentM / targetLines);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const m = raw / pow;
  const nice = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
  return nice * pow;
}
