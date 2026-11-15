/**
 * Mars Trek · Port exacto a TypeScript de motor_reglas.py de HUELLA (Tarea 7, D-H1, PT-09).
 * Evalúa filas de telemetría por segundo y por astronauta con filtro de persistencia (3 s subida, 30 s bajada),
 * regla de dos o más en SUPERVIVENCIA => ABORTAR, regla de pareja EVA-17 y enclavamiento en modo regreso.
 */
import type { HuellaLevel } from "../contracts";
import { TREK_PARAMS } from "../params";

export const PSI_TO_KPA = 6.895;
export const HUELLA_LEVELS: readonly HuellaLevel[] = [
  "NORMAL",
  "PRECAUCION",
  "SUPERVIVENCIA",
  "ABORTAR",
];

const SUBIDA_S = TREK_PARAMS.persistenceRiseS.value;
const BAJADA_S = TREK_PARAMS.persistenceFallS.value;

export interface CrewPhysioProfile {
  readonly fc_max?: number;
  readonly fc_reposo?: number;
  readonly tc_reposo?: number;
}

/**
 * Valor de un campo de fila HUELLA. Las filas del simulador también llevan banderas booleanas
 * (simulated, telemetryCut) y el mapa dataQuality; las reglas solo leen los campos numéricos/texto.
 */
export type HuellaValue = string | number | boolean | undefined | Readonly<Record<string, string>>;

export type HuellaRow = Record<string, HuellaValue>;

export interface HuellaEvent {
  readonly t_s: string;
  readonly ev_id: string;
  readonly regla: string;
  readonly nivel: HuellaLevel;
  readonly valor: string;
  readonly mensaje: string;
}

function parseNum(v: HuellaValue): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function worstLevel(levels: readonly HuellaLevel[]): HuellaLevel {
  let maxIdx = 0;
  for (const lv of levels) {
    const idx = HUELLA_LEVELS.indexOf(lv);
    if (idx > maxIdx) maxIdx = idx;
  }
  return HUELLA_LEVELS[maxIdx]!;
}

/**
 * Redondeo idéntico a Python 3 round(x, ndigits) / f"{x:.nf}" (round-half-to-even).
 */
function pyRoundEven(val: number, digits = 0): number {
  const factor = 10 ** digits;
  const scaled = val * factor;
  const flo = Math.floor(scaled);
  const diff = scaled - flo;
  const eps = 1e-9;
  if (Math.abs(diff - 0.5) <= eps) {
    return (flo % 2 === 0 ? flo : flo + 1) / factor;
  }
  return Math.round(scaled) / factor;
}

function pyFixed(val: number, digits: number): string {
  return pyRoundEven(val, digits).toFixed(digits);
}

function pySignedInt(val: number): string {
  const r = pyRoundEven(val, 0);
  return r >= 0 ? `+${r.toFixed(0)}` : r.toFixed(0);
}

/** Formatea un número como lo serializa csv.DictWriter de Python para un float/int. */
function pyValueString(val: number | string): string {
  if (typeof val === "string") return val;
  if (Number.isInteger(val)) return `${val}.0`;
  return String(val);
}

export interface RuleEvalEntry {
  readonly ruleId: string;
  readonly level: HuellaLevel;
  readonly value: string;
  readonly message: string;
}

export interface RuleEngine {
  readonly setpointKpa: number;
  evaluateRow(row: HuellaRow): RuleEvalEntry[];
  reset(): void;
}

export function createRuleEngine(
  setpointKpa = 4.3 * PSI_TO_KPA,
  profiles: Readonly<Record<string, CrewPhysioProfile>> = {},
  fcMaxDefault = 183.5,
): RuleEngine {
  const desde = new Map<string, number>();
  const residAlerta = new Set<string>();

  const getProfile = (ev: string, key: keyof CrewPhysioProfile, def: number): number => {
    const p = profiles[ev];
    const val = p?.[key];
    return typeof val === "number" ? val : def;
  };

  const sostenida = (
    ev: string,
    key: string,
    cond: boolean,
    t: number,
    seconds: number,
  ): boolean => {
    const mapKey = `${ev}::${key}`;
    if (!cond) {
      desde.delete(mapKey);
      return false;
    }
    if (!desde.has(mapKey)) {
      desde.set(mapKey, t);
    }
    return t - desde.get(mapKey)! >= seconds;
  };

  return {
    setpointKpa,
    reset() {
      desde.clear();
      residAlerta.clear();
    },
    evaluateRow(h: HuellaRow): RuleEvalEntry[] {
      const ev = String(h["ev_id"] ?? "EVA1");
      const t = parseNum(h["t_s"]) ?? 0.0;
      const out: RuleEvalEntry[] = [];

      // 1. EVA-02: presión del traje
      const p = parseNum(h["suit_o2_pressure_kpa"]);
      if (p !== null) {
        const d = Math.abs(p - setpointKpa);
        const nivel: HuellaLevel = d > 1.72 ? "SUPERVIVENCIA" : d > 0.69 ? "PRECAUCION" : "NORMAL";
        out.push({
          ruleId: "EVA-02",
          level: nivel,
          value: pyValueString(pyRoundEven(p, 2)),
          message: `Presion del traje ${pyFixed(p, 1)} kPa (ajuste ${pyFixed(setpointKpa, 1)})`,
        });
      }

      // 2. EVA-03: O2 secundario en uso
      const o2Source = h["o2_source"];
      if (o2Source !== undefined && o2Source !== null && o2Source !== "") {
        const srcStr = String(o2Source);
        out.push({
          ruleId: "EVA-03",
          level: srcStr === "SEC" ? "ABORTAR" : "NORMAL",
          value: srcStr,
          message: "Respirando del tanque secundario de O2",
        });
      }

      // 3. EVA-04: CO2 en casco
      const co2 = parseNum(h["helmet_co2_mmhg"]);
      if (co2 !== null) {
        const nivel: HuellaLevel = co2 > 20 ? "SUPERVIVENCIA" : co2 > 15 ? "PRECAUCION" : "NORMAL";
        out.push({
          ruleId: "EVA-04",
          level: nivel,
          value: pyValueString(pyRoundEven(co2, 1)),
          message: `CO2 en casco ${pyFixed(co2, 1)} mmHg`,
        });
      }

      // 4. EVA-05: ventilador
      const fp = parseNum(h["fan_pri_rpm"]) ?? 0;
      const fs = parseNum(h["fan_sec_rpm"]) ?? 0;
      if (
        (h["fan_pri_rpm"] !== undefined && h["fan_pri_rpm"] !== "") ||
        (h["fan_sec_rpm"] !== undefined && h["fan_sec_rpm"] !== "")
      ) {
        const rpm = Math.max(fp, fs);
        const nivel: HuellaLevel =
          rpm < 20000 ? "SUPERVIVENCIA" : rpm < 27000 ? "PRECAUCION" : "NORMAL";
        out.push({
          ruleId: "EVA-05",
          level: nivel,
          value: pyValueString(rpm),
          message: `Ventilador activo a ${pyFixed(rpm, 0)} rpm`,
        });
      }

      // 5. EVA-07: FC absoluta sostenida
      const fc = parseNum(h["heart_rate_bpm"]);
      const fcMax = getProfile(ev, "fc_max", fcMaxDefault);
      if (fc !== null) {
        const a90 = sostenida(ev, "fc90", fc > 0.9 * fcMax, t, 120);
        const a140 = sostenida(ev, "fc140", fc > 140, t, 300);
        out.push({
          ruleId: "EVA-07",
          level: a90 || a140 ? "PRECAUCION" : "NORMAL",
          value: pyValueString(pyRoundEven(fc, 1)),
          message: `FC ${pyFixed(fc, 0)} lpm sostenida`,
        });
      }

      const spo2 = parseNum(h["spo2_pct"]);
      const co2v = co2 ?? 0;
      const tc = parseNum(h["core_temp_c"]);
      const rr = parseNum(h["resp_rate_rpm"]);
      const fce = parseNum(h["hr_expected_bpm"]);

      // 6. EVA-06: FC residual no explicada por el esfuerzo + histéresis
      if (fc !== null && fce !== null) {
        const res = fc - fce;
        let alto = sostenida(ev, "resid", res > 25, t, 120);
        if (alto) {
          residAlerta.add(ev);
        } else if (residAlerta.has(ev)) {
          if (sostenida(ev, "resid_bajo", res < 15, t, 60)) {
            residAlerta.delete(ev);
          } else {
            alto = true;
          }
        }
        const riStr = String(h["rhythm_irregular"] ?? "");
        const confirma =
          (spo2 !== null && spo2 < 94) ||
          co2v > 15 ||
          (tc !== null && tc >= 38.0) ||
          riStr === "1" ||
          riStr === "True" ||
          riStr === "true";
        const nivel: HuellaLevel =
          alto && confirma ? "SUPERVIVENCIA" : alto ? "PRECAUCION" : "NORMAL";
        out.push({
          ruleId: "EVA-06",
          level: nivel,
          value: pyValueString(pyRoundEven(res, 1)),
          message: `FC ${pySignedInt(res)} lpm sobre lo que explica el esfuerzo`,
        });
      }

      // 7. EVA-08: SpO2
      if (spo2 !== null) {
        const nivel: HuellaLevel =
          spo2 < 85 ? "ABORTAR" : spo2 < 90 ? "SUPERVIVENCIA" : spo2 < 95 ? "PRECAUCION" : "NORMAL";
        out.push({
          ruleId: "EVA-08",
          level: nivel,
          value: pyValueString(spo2),
          message: `SpO2 ${pyFixed(spo2, 0)} %`,
        });
      }

      // 8. EVA-09: Temperatura central
      if (tc !== null) {
        const nivel: HuellaLevel =
          tc >= 39.0 || tc < 35.0
            ? "ABORTAR"
            : tc >= 38.5 || tc < 35.5
              ? "SUPERVIVENCIA"
              : tc >= 38.0
                ? "PRECAUCION"
                : "NORMAL";
        out.push({
          ruleId: "EVA-09",
          level: nivel,
          value: pyValueString(tc),
          message: `Temperatura central ${pyFixed(tc, 1)} °C`,
        });
      }

      // 9. EVA-10: Índice de estrés fisiológico (Moran et al. 1998)
      if (fc !== null && tc !== null) {
        const fc0 = getProfile(ev, "fc_reposo", 65.0);
        const tc0 = getProfile(ev, "tc_reposo", 37.0);
        const psi = (5 * (tc - tc0)) / (39.5 - tc0) + (5 * (fc - fc0)) / (180 - fc0);
        const nivel: HuellaLevel = psi >= 9 ? "SUPERVIVENCIA" : psi >= 7 ? "PRECAUCION" : "NORMAL";
        out.push({
          ruleId: "EVA-10",
          level: nivel,
          value: pyValueString(pyRoundEven(psi, 1)),
          message: `Indice de estres fisiologico ${pyFixed(psi, 1)}/10`,
        });
      }

      // 10. EVA-12: Ritmo cardíaco irregular
      const ri = h["rhythm_irregular"];
      if (ri !== undefined && ri !== null && ri !== "") {
        const riStr = String(ri);
        const irregular = riStr === "1" || riStr === "True" || riStr === "true";
        const sost = sostenida(ev, "ritmo", irregular, t, 60);
        const nivel: HuellaLevel = sost ? "SUPERVIVENCIA" : irregular ? "PRECAUCION" : "NORMAL";
        out.push({
          ruleId: "EVA-12",
          level: nivel,
          value: irregular ? "1" : "0",
          message: "El ECG muestra un ritmo irregular",
        });
      }

      // 11. EVA-16: Pérdida de comunicación (> 5 min = 300 s)
      const cm = h["comm_ok"];
      if (cm !== undefined && cm !== null && cm !== "") {
        const cmStr = String(cm);
        const sin = cmStr === "0" || cmStr === "False" || cmStr === "false";
        const nivel: HuellaLevel = sostenida(ev, "comm", sin, t, 300) ? "PRECAUCION" : "NORMAL";
        out.push({
          ruleId: "EVA-16",
          level: nivel,
          value: !sin ? "1" : "0",
          message: "Mas de 5 min sin contacto: regresar al ultimo waypoint",
        });
      }

      // 12. EVA-21: Humedad del traje
      const hr = parseNum(h["suit_humidity_pct"]);
      if (hr !== null) {
        let nivel: HuellaLevel;
        if (hr < 5) {
          nivel = "SUPERVIVENCIA";
        } else if (hr < 15) {
          nivel = sostenida(ev, "hr2", true, t, 7200) ? "SUPERVIVENCIA" : "PRECAUCION";
        } else if (hr < 25) {
          nivel = sostenida(ev, "hr8", true, t, 28800) ? "PRECAUCION" : "NORMAL";
        } else {
          sostenida(ev, "hr2", false, t, 0);
          sostenida(ev, "hr8", false, t, 0);
          nivel = hr > 75 ? "PRECAUCION" : "NORMAL";
        }
        out.push({
          ruleId: "EVA-21",
          level: nivel,
          value: pyValueString(hr),
          message: `Humedad del traje ${pyFixed(hr, 0)} %`,
        });
      }

      // 13. EVA-11: Frecuencia respiratoria
      const met = parseNum(h["metabolic_rate_kj_h"]);
      if (rr !== null) {
        const esfuerzoBajo = met === null || met < 1000;
        const nivel: HuellaLevel = sostenida(ev, "rr", rr > 30 && esfuerzoBajo, t, 180)
          ? "PRECAUCION"
          : "NORMAL";
        out.push({
          ruleId: "EVA-11",
          level: nivel,
          value: pyValueString(rr),
          message: `Respiracion ${pyFixed(rr, 0)} rpm sin esfuerzo que la explique`,
        });
      }

      return out;
    },
  };
}

interface FilterSlot {
  nivel: HuellaLevel;
  cand: HuellaLevel | null;
  desde: number;
}

/**
 * Evalúa todas las filas (agrupadas por segundo), escribe `nivel_huella` en cada fila
 * y devuelve la lista de eventos filtrados con paridad exacta respecto a `evaluar_filas` de `motor_reglas.py`.
 */
export function evaluateRows(rows: HuellaRow[], engine: RuleEngine): HuellaEvent[] {
  const eventos: HuellaEvent[] = [];
  const estado = new Map<string, FilterSlot>();
  const porT = new Map<string, HuellaRow[]>();

  for (const h of rows) {
    const tKey = String(h["t_s"] ?? "0");
    const list = porT.get(tKey);
    if (list) list.push(h);
    else porT.set(tKey, [h]);
  }

  const filtrar = (
    h: HuellaRow,
    rid: string,
    nivel: HuellaLevel,
    valor: string,
    msg: string,
    t: number,
  ): HuellaLevel => {
    const evId = String(h["ev_id"] ?? "EVA1");
    const k = `${evId}::${rid}`;
    let e = estado.get(k);
    if (!e) {
      e = { nivel: "NORMAL", cand: null, desde: t };
      estado.set(k, e);
    }
    if (nivel === e.nivel) {
      e.cand = null;
      return e.nivel;
    }
    if (e.cand !== nivel) {
      e.cand = nivel;
      e.desde = t;
    }
    const espera =
      HUELLA_LEVELS.indexOf(nivel) > HUELLA_LEVELS.indexOf(e.nivel) ? SUBIDA_S : BAJADA_S;
    if (t - e.desde >= espera - 1) {
      e.nivel = nivel;
      e.cand = null;
      eventos.push({
        t_s: String(h["t_s"] ?? t),
        ev_id: evId,
        regla: rid,
        nivel,
        valor,
        mensaje: msg,
      });
    }
    return e.nivel;
  };

  const enRegreso = new Set<string>();
  const sortedTKeys = [...porT.keys()].sort((a, b) => (parseNum(a) ?? 0) - (parseNum(b) ?? 0));

  for (const tTxt of sortedTKeys) {
    const t = parseNum(tTxt) ?? 0;
    const grupo = porT.get(tTxt)!;
    const niveles = new Map<string, HuellaLevel>();

    for (const h of grupo) {
      const evId = String(h["ev_id"] ?? "EVA1");
      const res = engine.evaluateRow(h);
      const filtrados = res.map((entry) =>
        filtrar(h, entry.ruleId, entry.level, entry.value, entry.message, t),
      );
      let n = worstLevel(filtrados);
      const supCount = filtrados.filter((v) => v === "SUPERVIVENCIA").length;
      if (supCount >= 2) {
        n = worstLevel([n, "ABORTAR"]);
      }
      filtrar(
        h,
        "LOGICA",
        n === "ABORTAR" ? "ABORTAR" : "NORMAL",
        n,
        "Dos o mas reglas en SUPERVIVENCIA (o una de ABORTAR)",
        t,
      );
      niveles.set(evId, n);
    }

    for (const h of grupo) {
      const evId = String(h["ev_id"] ?? "EVA1");
      let emergencia = false;
      for (const [k, v] of niveles.entries()) {
        if (k !== evId && HUELLA_LEVELS.indexOf(v) >= HUELLA_LEVELS.indexOf("SUPERVIVENCIA")) {
          emergencia = true;
          break;
        }
      }
      const b = filtrar(
        h,
        "EVA-17",
        emergencia ? "SUPERVIVENCIA" : "NORMAL",
        "",
        "Tu companera esta en emergencia: nadie regresa sola",
        t,
      );
      let n = worstLevel([niveles.get(evId) ?? "NORMAL", b]);
      if (
        HUELLA_LEVELS.indexOf(n) >= HUELLA_LEVELS.indexOf("SUPERVIVENCIA") &&
        !enRegreso.has(evId)
      ) {
        enRegreso.add(evId);
        eventos.push({
          t_s: String(h["t_s"] ?? t),
          ev_id: evId,
          regla: "REGRESO",
          nivel: "SUPERVIVENCIA",
          valor: "",
          mensaje: "Modo regreso: volver al habitat (la EVA no se reanuda sola)",
        });
      }
      if (enRegreso.has(evId)) {
        n = worstLevel([n, "SUPERVIVENCIA"]);
      }
      h["nivel_huella"] = n;
    }
  }

  return eventos;
}
