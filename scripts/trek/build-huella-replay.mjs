#!/usr/bin/env node
/**
 * Mars Trek · Datos de "metricas de vida" (HUELLA) para el motor de rutas.
 *
 * Lee las caminatas sintéticas HUELLA (`caminata_<escenario>_huella.csv` + `_eventos.csv`, generadas por
 * generar_caminata_sintetica.py y evaluadas por motor_reglas.py) y produce:
 *
 *   public/data/trek/huella/<escenario>.json   repetición de EVA1 cada 5 s: columnas fisiológicas, de traje y
 *                                               consumibles + nivel HUELLA filtrado + eventos de reglas
 *   public/data/trek/huella/index.json          catálogo (duración, primer evento, procedencia, sha256)
 *   src/core/trek/health/huellaReference.ts     línea base fisiológica medida en la caminata NOMINAL
 *                                               (percentiles de EVA1 + EVA2), usada para normalizar
 *                                               las necesidades fisiológicas de los pesos dinámicos del A*
 *
 * Uso: node scripts/trek/build-huella-replay.mjs ["../metricas de vida/huella_datos"]
 * Sin dependencias: solo node:fs / node:crypto.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const IN_DIR = path.resolve(ROOT, process.argv[2] ?? "../metricas de vida/huella_datos");
const OUT_DIR = path.join(ROOT, "public/data/trek/huella");
const REF_TS = path.join(ROOT, "src/core/trek/health/huellaReference.ts");
const STRIDE_S = 5;
const SUBJECT = "EVA1";

const SCENARIOS = [
  { id: "nominal", es: "Caminata nominal", en: "Nominal walk" },
  { id: "estres_termico", es: "Estrés térmico (falla LCVG)", en: "Heat stress (LCVG failure)" },
  { id: "falla_ventilador", es: "Falla de ventilador → CO₂", en: "Fan failure → CO₂" },
  { id: "fuga_traje", es: "Fuga de presión del traje", en: "Suit pressure leak" },
  { id: "arritmia", es: "Arritmia sostenida", en: "Sustained arrhythmia" },
  { id: "perdida_comunicacion", es: "Pérdida de comunicación", en: "Loss of comms" },
];

/** Columnas que viajan a la app (todas numéricas; o2_source se codifica 0 = PRI, 1 = SEC). */
const COLUMNS = [
  "heart_rate_bpm",
  "hr_expected_bpm",
  "spo2_pct",
  "core_temp_c",
  "resp_rate_rpm",
  "rhythm_irregular",
  "helmet_co2_mmhg",
  "suit_o2_pressure_kpa",
  "suit_humidity_pct",
  "lcvg_inlet_temp_c",
  "fan_pri_rpm",
  "fan_sec_rpm",
  "o2_source",
  "o2_pri_pressure_psi",
  "o2_pri_storage_pct",
  "batt_primary_pct",
  "coolant_storage_pct",
  "metabolic_rate_kj_h",
  "dose_eva_msv",
  "comm_ok",
  "pos_uncertainty_m",
];

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const split = (line) => {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const header = split(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = split(l);
    const row = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

const num = (v) => {
  if (v === undefined || v === "") return Number.NaN;
  if (v === "True" || v === "true") return 1;
  if (v === "False" || v === "false") return 0;
  if (v === "PRI") return 0;
  if (v === "SEC") return 1;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
};

const round = (v, d) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);
const DIGITS = {
  o2_pri_pressure_psi: 1,
  fan_pri_rpm: 0,
  fan_sec_rpm: 0,
  metabolic_rate_kj_h: 0,
  dose_eva_msv: 5,
};

function percentile(values, p) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (a.length === 0) return Number.NaN;
  const k = (a.length - 1) * (p / 100);
  const f = Math.floor(k);
  const c = Math.min(a.length - 1, f + 1);
  return a[f] + (a[c] - a[f]) * (k - f);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function main() {
  if (!fs.existsSync(IN_DIR)) {
    console.error(`[build-huella-replay] No existe ${IN_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const catalog = [];

  for (const sc of SCENARIOS) {
    const csvFile = path.join(IN_DIR, `caminata_${sc.id}_huella.csv`);
    const evFile = path.join(IN_DIR, `caminata_${sc.id}_eventos.csv`);
    const rows = parseCsv(fs.readFileSync(csvFile, "utf8")).filter((r) => r.ev_id === SUBJECT);
    const events = parseCsv(fs.readFileSync(evFile, "utf8"))
      .filter((e) => e.ev_id === SUBJECT)
      .map((e) => ({
        t: Number(e.t_s),
        rule: e.regla,
        level: e.nivel,
        value: e.valor,
        message: e.mensaje,
      }));

    const labels = [];
    const levels = ["NORMAL", "PRECAUCION", "SUPERVIVENCIA", "ABORTAR"];
    const cols = Object.fromEntries(COLUMNS.map((c) => [c, []]));
    const t = [];
    const label = [];
    const level = [];
    const durationS = Number(rows[rows.length - 1].t_s);
    // Muestreo cada STRIDE_S s; el nivel de cada muestra es el PEOR del intervalo para no perder
    // transiciones breves (el filtro de persistencia de motor_reglas.py ya se aplicó en el CSV).
    let worst = 0;
    for (const r of rows) {
      const ts = Number(r.t_s);
      worst = Math.max(worst, levels.indexOf(r.nivel_huella));
      if (ts % STRIDE_S !== 0 && ts !== durationS) continue;
      t.push(ts);
      for (const c of COLUMNS) cols[c].push(round(num(r[c]), DIGITS[c] ?? 2));
      if (!labels.includes(r.event_label)) labels.push(r.event_label);
      label.push(labels.indexOf(r.event_label));
      level.push(Math.max(0, worst));
      worst = 0;
    }

    const out = {
      scenarioId: sc.id,
      subjectId: SUBJECT,
      titleEs: sc.es,
      titleEn: sc.en,
      dataType: "SIMULATED",
      source: `metricas de vida/huella_datos/caminata_${sc.id}_huella.csv`,
      eventsSource: `metricas de vida/huella_datos/caminata_${sc.id}_eventos.csv`,
      sourceSha256: sha256(csvFile),
      generator: "generar_caminata_sintetica.py + motor_reglas.py (HUELLA)",
      strideS: STRIDE_S,
      durationS,
      t,
      columns: cols,
      labels,
      levels,
      label,
      level,
      events,
    };
    fs.writeFileSync(path.join(OUT_DIR, `${sc.id}.json`), JSON.stringify(out));
    catalog.push({
      id: sc.id,
      titleEs: sc.es,
      titleEn: sc.en,
      file: `/data/trek/huella/${sc.id}.json`,
      durationS,
      firstEventS: events.length > 0 ? events[0].t : null,
      events: events.length,
      sourceSha256: out.sourceSha256,
    });
    console.log(
      `[build-huella-replay] ${sc.id}: ${t.length} muestras (${STRIDE_S} s), ${events.length} eventos EVA1, ${durationS} s`,
    );
  }
  fs.writeFileSync(
    path.join(OUT_DIR, "index.json"),
    `${JSON.stringify({ strideS: STRIDE_S, subjectId: SUBJECT, dataType: "SIMULATED", scenarios: catalog }, null, 2)}\n`,
  );

  // Línea base nominal (EVA1 + EVA2): lo que el cuerpo hace en una EVA sin incidentes.
  const nominal = parseCsv(
    fs.readFileSync(path.join(IN_DIR, "caminata_nominal_huella.csv"), "utf8"),
  );
  const col = (k) => nominal.map((r) => num(r[k]));
  const fc = col("heart_rate_bpm");
  const fce = col("hr_expected_bpm");
  const tc = col("core_temp_c");
  const resid = fc.map((v, i) => v - fce[i]);
  const psi = fc.map((v, i) => (5 * (tc[i] - 37)) / (39.5 - 37) + (5 * (v - 65)) / (180 - 65));
  const press = col("suit_o2_pressure_kpa").map((p) => Math.abs(p - 4.3 * 6.895));
  const f = (v, d = 2) => Number(v.toFixed(d));
  const ref = {
    hrResidualP95: f(percentile(resid, 95), 1),
    hrP95: f(percentile(fc, 95), 1),
    coreTempP95: f(percentile(tc, 95)),
    psiP95: f(percentile(psi, 95)),
    co2P95: f(percentile(col("helmet_co2_mmhg"), 95)),
    spo2P5: f(percentile(col("spo2_pct"), 5), 1),
    respRateP95: f(percentile(col("resp_rate_rpm"), 95), 1),
    suitPressureDevP95: f(percentile(press, 95)),
    humidityP95: f(percentile(col("suit_humidity_pct"), 95), 1),
    lcvgInletP95: f(percentile(col("lcvg_inlet_temp_c"), 95)),
    metabolicP50: f(percentile(col("metabolic_rate_kj_h"), 50), 0),
    metabolicP95: f(percentile(col("metabolic_rate_kj_h"), 95), 0),
    samples: nominal.length,
  };
  const ts = `/**
 * GENERADO por scripts/trek/build-huella-replay.mjs — no editar a mano.
 * Línea base fisiológica medida en la caminata NOMINAL de "metricas de vida" (HUELLA):
 * percentiles de EVA1 + EVA2 (${ref.samples} filas de 1 s) de caminata_nominal_huella.csv
 * (sha256 ${sha256(path.join(IN_DIR, "caminata_nominal_huella.csv")).slice(0, 16)}…).
 * Lo que queda por debajo de estos valores es "lo que el cuerpo hace en una EVA sin incidentes" y
 * no cambia los pesos del A*; los umbrales de 1.0 son los de reglas.json / motor_reglas.py.
 */
export const HUELLA_NOMINAL_BASELINE = ${JSON.stringify(ref, null, 2)
    .replace(/"(\w+)":/g, "$1:")
    .replace(/(\S)\n}$/, "$1,\n}")} as const;

export const HUELLA_BASELINE_SOURCE =
  "metricas de vida/huella_datos/caminata_nominal_huella.csv (EVA1 + EVA2, percentiles p5/p50/p95)";
`;
  fs.writeFileSync(REF_TS, ts);
  console.log("[build-huella-replay] línea base nominal:", ref);
}

main();
