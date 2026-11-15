import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/core/rng";
import type { HealthState } from "../contracts";
import { createHeightGrid } from "@/core/science/routing";
import { buildSnapshot } from "../costmap/snapshot";
import { buildStaticTerrain } from "../costmap/terrain";
import { twoCorridorField } from "../costmap/synthetic";
import { createInitialResourceState } from "../resources/consumables";
import { planRoute } from "../routing/planner";
import { composeEnvelope } from "../safety/envelope";
import { createSession, setHuellaReplay, tick } from "../sim/session";
import { directiveFor } from "./directive";
import { createInitialFsmState } from "./fsm";
import {
  parseHuellaReplay,
  replayHealthAt,
  replayRowAt,
  type HuellaReplayTrace,
} from "./huellaReplay";
import {
  applyPhysioToDirective,
  assessPhysiology,
  initialPhysioState,
  PHYSIO_NEED_IDS,
  physioMultipliers,
  stepPhysio,
} from "./physio";

const REPLAY_DIR = path.resolve(process.cwd(), "public/data/trek/huella");
const HUELLA_DIR = path.resolve(process.cwd(), "../metricas de vida/huella_datos");

function loadTrace(id: string): HuellaReplayTrace {
  return parseHuellaReplay(
    JSON.parse(fs.readFileSync(path.join(REPLAY_DIR, `${id}.json`), "utf8")),
  );
}

/** Estado fisiológico estable en tS (varios pasos de 5 s para que el suavizado converja). */
function physioAt(trace: HuellaReplayTrace, tS: number) {
  let st = initialPhysioState(0, "huella-csv");
  for (let t = Math.max(0, tS - 300); t <= tS; t += 5) {
    st = stepPhysio(
      st,
      replayRowAt(trace, t, 0),
      { fatigueIndex: 0, doseRateMsvPerSol: 0.64 },
      t,
      "huella-csv",
    );
  }
  return st;
}

const STATES: readonly HealthState[] = ["NORMAL", "FATIGUE", "CAUTION", "CRITICAL", "EMERGENCY"];

function fsmIn(state: HealthState) {
  return {
    ...createInitialFsmState("EVA1"),
    state,
    causes: state === "CAUTION" ? (["termica"] as const) : [],
  };
}

describe("Pesos fisiológicos dinámicos del A* con datos de 'metricas de vida'", () => {
  it("la caminata NOMINAL deja los pesos neutros casi todo el tiempo (línea base = percentil nominal)", () => {
    const trace = loadTrace("nominal");
    let neutral = 0;
    let total = 0;
    for (let t = 0; t <= trace.durationS; t += 60) {
      const a = assessPhysiology(replayRowAt(trace, t, 0), {
        fatigueIndex: 0,
        doseRateMsvPerSol: 0.64,
      });
      const m = physioMultipliers(a.needs).multipliers;
      total += 1;
      if (m.h === 1 && m.t === 1 && m.e === 1 && m.r === 1 && m.u === 1) neutral += 1;
    }
    expect(neutral / total).toBeGreaterThan(0.9);
  });

  it.each([
    // [escenario, t (s) tras el evento HUELLA, necesidad dominante, mínimos esperados]
    ["estres_termico", 7700, "thermal", { h: 3, r: 1.75, u: 1.75 }],
    ["falla_ventilador", 7190, "respiratory", { h: 3.5, t: 2.75, e: 2 }],
    ["fuga_traje", 7045, "suit", { t: 3, e: 4 }],
    ["arritmia", 6915, "cardio", { h: 4, t: 3 }],
    ["perdida_comunicacion", 7200, "navigation", { u: 2 }],
  ] as const)("%s: la necesidad %s sube los pesos del A*", (id, tS, need, mins) => {
    const st = physioAt(loadTrace(id), tS);
    const top = PHYSIO_NEED_IDS.reduce((a, b) => (st.needs[b] > st.needs[a] ? b : a));
    expect(top).toBe(need);
    for (const [k, v] of Object.entries(mins)) {
      expect(st.multipliers[k as "h"]).toBeGreaterThanOrEqual(v);
    }
    expect(st.drivers[0]?.need).toBe(need);
  });

  it("INV-P1: multiplicadores ≥ 1 y en pasos de 0.25 para filas aleatorias", () => {
    const rnd = mulberry32(2026);
    for (let i = 0; i < 500; i += 1) {
      const a = assessPhysiology(
        {
          heart_rate_bpm: 50 + rnd() * 140,
          hr_expected_bpm: 60 + rnd() * 60,
          core_temp_c: 36 + rnd() * 3.5,
          spo2_pct: 82 + rnd() * 18,
          helmet_co2_mmhg: rnd() * 25,
          resp_rate_rpm: 10 + rnd() * 30,
          fan_pri_rpm: rnd() * 31000,
          suit_o2_pressure_kpa: 26 + rnd() * 5,
          o2_pri_storage_pct: rnd() * 100,
          comm_ok: rnd() < 0.5 ? 0 : 1,
        },
        { fatigueIndex: rnd(), doseRateMsvPerSol: rnd() * 3 },
      );
      const { multipliers, strainFactor } = physioMultipliers(a.needs);
      for (const v of [...Object.values(multipliers), strainFactor]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(Math.abs(v * 4 - Math.round(v * 4))).toBeLessThan(1e-9);
      }
      for (const k of PHYSIO_NEED_IDS) {
        expect(a.needs[k]).toBeGreaterThanOrEqual(0);
        expect(a.needs[k]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("monotonía: más temperatura central nunca baja la necesidad térmica", () => {
    let prev = -1;
    for (let tc = 36.5; tc <= 39.5; tc += 0.05) {
      const n = assessPhysiology({ core_temp_c: tc, heart_rate_bpm: 90 }, {}).needs.thermal;
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });

  it("INV-P2: con cualquier estado de la FSM la fisiología solo endurece pesos; límites, meta y estado no cambian", () => {
    const trace = loadTrace("falla_ventilador");
    const physio = physioAt(trace, 7190);
    for (const s of STATES) {
      const dir = directiveFor(fsmIn(s));
      const out = applyPhysioToDirective(dir, physio);
      expect(out.state).toBe(dir.state);
      expect(out.limits).toEqual(dir.limits);
      expect(out.goalPolicy).toBe(dir.goalPolicy);
      expect(out.fallbackLadder).toEqual(dir.fallbackLadder);
      expect(out.requiresHumanConfirmation).toBe(dir.requiresHumanConfirmation);
      for (const k of ["t", "r", "e", "u", "h"] as const) {
        expect(out.weightMultipliers[k] ?? 1).toBeGreaterThanOrEqual(dir.weightMultipliers[k] ?? 1);
        expect(out.weightMultipliers[k] ?? 1).toBeGreaterThanOrEqual(physio.multipliers[k]);
      }
      expect(out.strainFactor).toBeGreaterThanOrEqual(dir.strainFactor);
    }
  });

  it("INV-P3: sin fila o con corte de telemetría se conserva el último valor (stale), nunca vuelve a neutro", () => {
    const hot = physioAt(loadTrace("estres_termico"), 7700);
    const held = stepPhysio(hot, null, {}, 7800, "huella-csv");
    expect(held.stale).toBe(true);
    expect(held.multipliers).toEqual(hot.multipliers);
    const cut = stepPhysio(hot, { core_temp_c: 37, telemetryCut: true }, {}, 7900, "huella-csv");
    expect(cut.stale).toBe(true);
    expect(cut.needs).toEqual(hot.needs);
  });

  it("suavizado asimétrico: sube en segundos y baja en minutos", () => {
    const calm = { heart_rate_bpm: 90, hr_expected_bpm: 90, core_temp_c: 37.2 };
    const hot = { heart_rate_bpm: 90, hr_expected_bpm: 90, core_temp_c: 38.5 };
    let st = stepPhysio(initialPhysioState(0, "generator"), calm, {}, 0, "generator");
    st = stepPhysio(st, hot, {}, 30, "generator");
    const up = st.needs.thermal;
    expect(up).toBeGreaterThan(0.7);
    st = stepPhysio(st, calm, {}, 60, "generator");
    expect(st.needs.thermal).toBeGreaterThan(0.5 * up);
  });

  it("cresta de 12°: con la FSM en NORMAL, a más exigencia cardíaca el A* elige rutas cada vez más suaves", () => {
    // Cresta norte-sur (admisible incluso en FATIGUE, límite 15°) entre origen y destino; el único
    // paso llano está al norte y el rodeo es ~35 % más largo. Ninguna regla HUELLA dispara: FC residual
    // ≤ 22 lpm (EVA-06 pide > 25 lpm sostenidos 120 s), así que solo cambian los pesos del A*.
    const grid = createHeightGrid(-40, -30, 1, 81, 61);
    for (let j = 0; j < 61; j += 1) {
      for (let i = 0; i < 81; i += 1) {
        const x = -40 + i;
        const z = -30 + j;
        grid.h[j * 81 + i] =
          4.4 * Math.max(0, 1 - Math.abs(x) / 20) * Math.max(0, Math.min(1, (24 - z) / 4));
      }
    }
    const snap = buildSnapshot(buildStaticTerrain(grid, { siteId: "physio-ridge" }));
    const res = createInitialResourceState("EVA1");
    const dir = directiveFor(createInitialFsmState("EVA1"));
    expect(dir.state).toBe("NORMAL");
    const req = {
      requestId: "physio-ridge",
      origin: { x: -35, z: 0 },
      goal: { x: 35, z: 0 },
      missionProfile: "team" as const,
      weightProfile: "balanced" as const,
      vehicle: "crew-foot" as const,
    };
    const routes = [2, 10, 16, 22].map((resid) => {
      const physio = stepPhysio(
        initialPhysioState(0),
        { heart_rate_bpm: 102 + resid, hr_expected_bpm: 102, core_temp_c: 37.4 },
        {},
        0,
        "generator",
      );
      const env = composeEnvelope(
        "team",
        "crew-foot",
        {},
        applyPhysioToDirective(dir, physio),
        res,
        snap,
      );
      const r = planRoute(req, env, snap, { computeAlternatives: false });
      expect(r.ok).toBe(true);
      expect(env.maxSlopeDeg).toBe(20); // la fisiología no toca el límite duro
      return r.ok ? r.route : null;
    });
    const [calm, , , hard] = routes;
    expect(calm!.maxSlopeDeg).toBeGreaterThan(11);
    expect(hard!.maxSlopeDeg).toBeLessThan(calm!.maxSlopeDeg - 3);
    expect(hard!.distanceM).toBeGreaterThan(calm!.distanceM * 1.2);
    for (let k = 1; k < routes.length; k += 1) {
      expect(routes[k]!.maxSlopeDeg).toBeLessThanOrEqual(routes[k - 1]!.maxSlopeDeg + 1e-6);
    }
  });

  it("sesión: la caminata HUELLA alimenta FSM y pesos; la FSM conserva su enclavamiento", () => {
    const field = twoCorridorField();
    let s = createSession({
      terrain: field.terrain,
      origin: field.origin,
      goal: field.goal,
      shelters: [field.shelter],
    });
    const nominalH = s.activeWeights.h;
    s = setHuellaReplay(s, loadTrace("estres_termico"));
    expect(s.physio.source).toBe("huella-csv");
    expect(s.fsm.state).toBe("NORMAL");
    // EVA-09 PRECAUCION a los 7294 s → CAUTION; la necesidad térmica ya pesa en el A*
    s = tick(s, 7300);
    for (let i = 0; i < 12; i += 1) s = tick(s, 5);
    expect(s.fsm.state).toBe("CAUTION");
    expect(s.physio.needs.thermal).toBeGreaterThan(0.3);
    expect(s.envelope.weightMultipliers.h).toBeGreaterThanOrEqual(
      s.directive.weightMultipliers.h ?? 1,
    );
    expect(s.activeWeights.h).toBeGreaterThan(nominalH);
    expect(s.replanLog.some((r) => r.causes.some((c) => c.startsWith("physio:")))).toBe(true);
    // EVA-09 SUPERVIVENCIA a los 7675 s → CRITICAL enclavado, pide confirmación humana
    for (let i = 0; i < 80; i += 1) s = tick(s, 5);
    expect(s.fsm.state).toBe("CRITICAL");
    expect(s.fsm.latch).toBe("return-mode");
    expect(s.fsm.requiresHumanConfirmation).toBe(true);
    expect(s.directive.goalPolicy).toBe("nearest-shelter");
    expect(s.directive.protocol).toBe("thermal-cardiac");
  });

  it("las repeticiones coinciden con los CSV de 'metricas de vida' (sha256 y eventos de EVA1)", () => {
    if (!fs.existsSync(HUELLA_DIR)) {
      console.warn(`[physio.test] ${HUELLA_DIR} no está: se omite la verificación de origen`);
      return;
    }
    for (const id of [
      "nominal",
      "estres_termico",
      "falla_ventilador",
      "fuga_traje",
      "arritmia",
      "perdida_comunicacion",
    ]) {
      const trace = loadTrace(id);
      const csv = path.join(HUELLA_DIR, `caminata_${id}_huella.csv`);
      expect(crypto.createHash("sha256").update(fs.readFileSync(csv)).digest("hex")).toBe(
        trace.sourceSha256,
      );
      const evLines = fs
        .readFileSync(path.join(HUELLA_DIR, `caminata_${id}_eventos.csv`), "utf8")
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .filter((l) => l.split(",")[1] === "EVA1");
      expect(trace.events.length).toBe(evLines.length);
      const last = trace.events[trace.events.length - 1];
      if (last) expect(replayHealthAt(trace, last.t).level).not.toBe(undefined);
    }
  });
});
