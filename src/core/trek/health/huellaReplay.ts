/**
 * Mars Trek · Repetición de las caminatas HUELLA de "metricas de vida" dentro de la sesión.
 *
 * La traza la genera scripts/trek/build-huella-replay.mjs a partir de caminata_<escenario>_huella.csv
 * (EVA1, una muestra cada 5 s) y caminata_<escenario>_eventos.csv. La sesión la usa como fuente de
 * telemetría: cada fila alimenta los pesos fisiológicos del A* (physio.ts) y el nivel HUELLA filtrado
 * + los eventos de reglas alimentan la máquina de estados de salud (fsm.ts), que no se modifica.
 * Todo lo que sale de aquí conserva la etiqueta SIMULATED (son caminatas sintéticas).
 */
import type { DataQualityStatus, HuellaLevel } from "../contracts";
import type { FsmTrigger } from "./fsm";
import type { TelemetrySampleRow } from "./telemetry";

export interface HuellaReplayEvent {
  readonly t: number;
  readonly rule: string;
  readonly level: HuellaLevel;
  readonly value: string;
  readonly message: string;
}

export interface HuellaReplayTrace {
  readonly scenarioId: string;
  readonly subjectId: string;
  readonly titleEs: string;
  readonly titleEn: string;
  readonly dataType: "SIMULATED";
  readonly source: string;
  readonly eventsSource: string;
  readonly sourceSha256: string;
  readonly strideS: number;
  readonly durationS: number;
  readonly t: readonly number[];
  readonly columns: Readonly<Record<string, ReadonlyArray<number | null>>>;
  readonly labels: readonly string[];
  readonly levels: readonly HuellaLevel[];
  readonly label: readonly number[];
  readonly level: readonly number[];
  readonly events: readonly HuellaReplayEvent[];
}

const LEVELS: readonly HuellaLevel[] = ["NORMAL", "PRECAUCION", "SUPERVIVENCIA", "ABORTAR"];

/** Valida la forma de la traza (viene de un JSON público) y la devuelve tipada. */
export function parseHuellaReplay(json: unknown): HuellaReplayTrace {
  const o = json as Partial<HuellaReplayTrace> | null;
  if (!o || typeof o !== "object") throw new Error("Traza HUELLA vacía");
  if (typeof o.scenarioId !== "string" || !Array.isArray(o.t) || o.t.length === 0) {
    throw new Error("Traza HUELLA sin escenario o sin muestras");
  }
  if (!o.columns || typeof o.columns !== "object") throw new Error("Traza HUELLA sin columnas");
  for (const [k, col] of Object.entries(o.columns)) {
    if (!Array.isArray(col) || col.length !== o.t.length) {
      throw new Error(
        `Columna ${k} con ${Array.isArray(col) ? col.length : "?"} muestras ≠ ${o.t.length}`,
      );
    }
  }
  if (!Array.isArray(o.level) || o.level.length !== o.t.length)
    throw new Error("Nivel HUELLA incompleto");
  for (let i = 1; i < o.t.length; i += 1) {
    if (!(o.t[i]! > o.t[i - 1]!)) throw new Error("Tiempos de la traza no crecientes");
  }
  const events = Array.isArray(o.events) ? o.events : [];
  for (const e of events) {
    if (!LEVELS.includes(e.level))
      throw new Error(`Nivel de evento desconocido: ${String(e.level)}`);
  }
  return {
    scenarioId: o.scenarioId,
    subjectId: o.subjectId ?? "EVA1",
    titleEs: o.titleEs ?? o.scenarioId,
    titleEn: o.titleEn ?? o.scenarioId,
    dataType: "SIMULATED",
    source: o.source ?? "metricas de vida/huella_datos",
    eventsSource: o.eventsSource ?? "",
    sourceSha256: o.sourceSha256 ?? "",
    strideS: o.strideS ?? 5,
    durationS: o.durationS ?? o.t[o.t.length - 1]!,
    t: o.t,
    columns: o.columns,
    labels: o.labels ?? [],
    levels: o.levels ?? LEVELS,
    label: o.label ?? [],
    level: o.level,
    events: [...events].sort((a, b) => a.t - b.t),
  };
}

/** Índice de la última muestra con t ≤ tS (acotado a la traza: después del final se queda en la última). */
export function replayIndexAt(trace: HuellaReplayTrace, tS: number): number {
  const t = trace.t;
  if (tS <= t[0]!) return 0;
  if (tS >= t[t.length - 1]!) return t.length - 1;
  let lo = 0;
  let hi = t.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid]! <= tS) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Fase de la caminata (event_label del CSV) en tS. */
export function replayPhaseAt(trace: HuellaReplayTrace, tS: number): string {
  const i = replayIndexAt(trace, tS);
  return trace.labels[trace.label[i] ?? 0] ?? "";
}

const VALID_QUALITY: Readonly<Record<string, DataQualityStatus>> = {
  ecg: "valid",
  spo2: "valid",
  coreTemp: "valid",
  suitPressure: "valid",
  co2: "valid",
};

/** Fila de telemetría (mismo formato que el generador) tomada de la traza en tS. */
export function replayRowAt(
  trace: HuellaReplayTrace,
  tS: number,
  fatigueIndex: number,
): TelemetrySampleRow {
  const i = replayIndexAt(trace, tS);
  const row: Record<string, string | number | boolean | Readonly<Record<string, string>>> = {};
  for (const [k, col] of Object.entries(trace.columns)) {
    const v = col[i];
    if (v === null || v === undefined) continue;
    row[k] = k === "o2_source" ? (v >= 1 ? "SEC" : "PRI") : v;
  }
  return {
    ...row,
    t_s: tS,
    ev_id: trace.subjectId,
    event_label: trace.labels[trace.label[i] ?? 0] ?? "",
    nivel_huella: trace.levels[trace.level[i] ?? 0] ?? "NORMAL",
    huella_source: trace.source,
    simulated: true,
    dataType: "SIMULATED",
    telemetryCut: false,
    fatigueIndex,
    dataQuality: VALID_QUALITY,
  } as TelemetrySampleRow;
}

/**
 * Lo que motor_reglas.py decidió hasta tS: nivel filtrado de la muestra y reglas activas (último nivel
 * de cada regla en los eventos ≤ tS distinto de NORMAL). LOGICA hereda la causa de la regla fisiológica
 * activa, para que la FSM elija el protocolo correcto.
 */
export function replayHealthAt(
  trace: HuellaReplayTrace,
  tS: number,
): { readonly level: HuellaLevel; readonly triggers: readonly FsmTrigger[] } {
  const i = replayIndexAt(trace, tS);
  const sampleLevel = trace.levels[trace.level[i] ?? 0] ?? "NORMAL";
  const last = new Map<string, HuellaReplayEvent>();
  for (const e of trace.events) {
    if (e.t > tS) break;
    last.set(e.rule, e);
  }
  // REGRESO es la marca de modo regreso de motor_reglas.py, no una regla: no cuenta para "dos o más en
  // SUPERVIVENCIA" (la FSM ya enclava CRITICAL en return-mode). LOGICA sí es la decisión ABORTAR del motor.
  const active = [...last.values()].filter((e) => e.level !== "NORMAL" && e.rule !== "REGRESO");
  const physio = active.find((e) => e.rule.startsWith("EVA-"));
  const triggers: FsmTrigger[] = active.map((e) => {
    const base = {
      ruleId: e.rule,
      level: e.level,
      value:
        e.value === "" ? e.level : Number.isFinite(Number(e.value)) ? Number(e.value) : e.value,
      message: `${e.message} · HUELLA t=${e.t}s`,
    };
    if (e.rule === "LOGICA" && physio) {
      return { ...base, cause: causeOfRule(physio.rule) };
    }
    // EVA-21 alta (> 75 %) es sudor por carga térmica (estrés térmico), no un fallo del traje
    if (e.rule === "EVA-21" && Number(e.value) > 75) {
      return { ...base, cause: "termica" as const };
    }
    return base;
  });
  let worst = LEVELS.indexOf(sampleLevel);
  for (const e of active) worst = Math.max(worst, LEVELS.indexOf(e.level));
  return { level: LEVELS[Math.max(0, worst)]!, triggers };
}

function causeOfRule(rule: string): NonNullable<FsmTrigger["cause"]> {
  switch (rule) {
    case "EVA-06":
    case "EVA-07":
    case "EVA-12":
      return "cardiaca";
    case "EVA-09":
    case "EVA-10":
      return "termica";
    case "EVA-16":
      return "comunicaciones";
    default:
      return "traje";
  }
}

/** Primer evento de la traza (para "saltar al incidente"), o null en la caminata nominal. */
export function firstReplayEventS(trace: HuellaReplayTrace): number | null {
  return trace.events.length > 0 ? trace.events[0]!.t : null;
}
