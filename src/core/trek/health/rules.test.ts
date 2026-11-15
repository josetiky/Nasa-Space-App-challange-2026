import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createRuleEngine,
  evaluateRows,
  PSI_TO_KPA,
  type CrewPhysioProfile,
  type HuellaEvent,
  type HuellaRow,
} from "./rules";
import { evaluateMissionRules } from "./missionRules";

const HUELLA_DIR = path.resolve(process.cwd(), "../metricas de vida/huella_datos");

const CREW_PROFILES: Readonly<Record<string, CrewPhysioProfile>> = {
  EVA1: { fc_max: 208 - 0.7 * 38, fc_reposo: 62.0, tc_reposo: 37.0 },
  EVA2: { fc_max: 208 - 0.7 * 34, fc_reposo: 58.0, tc_reposo: 36.9 },
};

function parseCsv(filePath: string): Array<Record<string, string>> {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const headers = lines[0]!.split(",");
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    const cols = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

describe("Mars Trek HUELLA rule engine & parity (Task 7)", () => {
  it("PT-09: reproduces all 6 caminata_*_eventos.csv reference outputs from huella_datos/", () => {
    if (!fs.existsSync(HUELLA_DIR)) {
      console.warn(`[PT-09] Skipping CSV parity test: ${HUELLA_DIR} not found`);
      return;
    }

    const scenarios = [
      "nominal",
      "falla_ventilador",
      "fuga_traje",
      "estres_termico",
      "arritmia",
      "perdida_comunicacion",
    ];

    for (const esc of scenarios) {
      const huellaCsv = path.join(HUELLA_DIR, `caminata_${esc}_huella.csv`);
      const eventosCsv = path.join(HUELLA_DIR, `caminata_${esc}_eventos.csv`);
      const rows = parseCsv(huellaCsv) as HuellaRow[];
      const expectedEvents = parseCsv(eventosCsv) as unknown as HuellaEvent[];

      const engine = createRuleEngine(4.3 * PSI_TO_KPA, CREW_PROFILES);
      const actualEvents = evaluateRows(rows, engine);

      expect(actualEvents, `Parity mismatch in scenario '${esc}'`).toEqual(expectedEvents);
    }
  });

  it("enforces persistence filter (rises in 3 s, falls in 30 s), 2 SUPERVIVENCIA => ABORTAR, EVA-17 buddy rule, and return mode latch", () => {
    const engine = createRuleEngine(4.3 * PSI_TO_KPA, CREW_PROFILES);
    const rows: HuellaRow[] = [];

    // t = 0..1: 2 seconds of high CO2 (>20 mmHg) -> should NOT trigger yet (needs 3 s: t - desde >= 2)
    for (let t = 0; t <= 1; t += 1) {
      rows.push({ t_s: t, ev_id: "EVA1", helmet_co2_mmhg: 22.0 });
      rows.push({ t_s: t, ev_id: "EVA2", helmet_co2_mmhg: 4.0 });
    }
    expect(evaluateRows(rows, engine)).toHaveLength(0);

    // Extend to t = 0..5 with BOTH high CO2 (>20) and low fan (<18000 rpm) on EVA1
    const engine2 = createRuleEngine(4.3 * PSI_TO_KPA, CREW_PROFILES);
    const rows2: HuellaRow[] = [];
    for (let t = 0; t <= 5; t += 1) {
      rows2.push({ t_s: t, ev_id: "EVA1", helmet_co2_mmhg: 22.0, fan_pri_rpm: 15000 });
      rows2.push({ t_s: t, ev_id: "EVA2", helmet_co2_mmhg: 4.0, fan_pri_rpm: 30000 });
    }
    const ev2 = evaluateRows(rows2, engine2);
    // EVA-04 and EVA-05 reach SUPERVIVENCIA at t=2 => LOGICA escalates to ABORTAR at t=2, REGRESO latches, and EVA2 triggers EVA-17 at t=4
    expect(
      ev2.some((e) => e.ev_id === "EVA1" && e.regla === "LOGICA" && e.nivel === "ABORTAR"),
    ).toBe(true);
    expect(ev2.some((e) => e.ev_id === "EVA1" && e.regla === "REGRESO")).toBe(true);
    expect(
      ev2.some((e) => e.ev_id === "EVA2" && e.regla === "EVA-17" && e.nivel === "SUPERVIVENCIA"),
    ).toBe(true);
  });

  it("evaluates derived mission rules (EVA-01, 13, 14, 15, 18, 19, 20)", () => {
    const hits = evaluateMissionRules({
      returnMarginMin: -3,
      returnMarginPct: -5,
      sepAlertActive: true,
      stormActive: true,
      posUncertaintyM: 180,
      minutesToSunset: 40,
      safeReturnDurationMin: 25,
      coolantInReserve: true,
      batteryRemainingMin: 30,
      reserveMin: 15,
    });
    const ids = hits.map((h) => h.ruleId);
    expect(ids).toEqual(["EVA-01", "EVA-13", "EVA-14", "EVA-15", "EVA-18", "EVA-19", "EVA-20"]);
  });
});
