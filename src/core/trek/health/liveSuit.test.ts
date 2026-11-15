import { describe, expect, it } from "vitest";
import { twoCorridorField } from "../costmap/synthetic";
import { createSession, tick, updateLive } from "../sim/session";
import {
  bsaMosteller,
  CREW_PRESETS,
  createLiveSuit,
  DEFAULT_CREW,
  fcMaxTanaka,
  liveTriggers,
  NOMINAL_FAULTS,
  radiationMatrix,
  stepLiveSuit,
  type CrewParams,
  type LiveSuitState,
  type SuitFaults,
} from "./liveSuit";

const CTX = {
  routeSlopePct: 5,
  walking: true,
  speActive: false,
  doseRateMsvPerSol: 0.64,
  observationS: 30,
};

function run(
  seconds: number,
  faults: SuitFaults = NOMINAL_FAULTS,
  params: CrewParams = DEFAULT_CREW,
  start?: LiveSuitState,
  ctx = CTX,
) {
  let s = start ?? createLiveSuit(params, 7);
  const levels: string[] = [];
  for (let i = 0; i < seconds; i += 1) {
    s = stepLiveSuit(s, params, faults, ctx);
    levels.push(s.level);
  }
  return { s, levels };
}

describe("Astronauta en vivo (port de simulador_huella.html)", () => {
  it("caminata nominal: se mantiene ESTABLE con FC plausible", () => {
    const { s, levels } = run(600);
    expect(new Set(levels)).toEqual(new Set(["NORMAL"]));
    expect(s.hr).toBeGreaterThan(70);
    expect(s.hr).toBeLessThan(130);
    expect(s.tc).toBeLessThan(37.6);
  });

  it("es determinista con la misma semilla", () => {
    expect(run(200).s).toEqual(run(200).s);
  });

  it("susto (+35 lpm) sube la FC pero no escala", () => {
    const base = run(120).s;
    let s: LiveSuitState = { ...base, scareAtS: base.tS };
    let peak = 0;
    for (let i = 0; i < 60; i += 1) {
      s = stepLiveSuit(s, DEFAULT_CREW, NOMINAL_FAULTS, CTX);
      peak = Math.max(peak, s.hr - s.fcEsp);
      expect(s.level).toBe("NORMAL");
    }
    expect(peak).toBeGreaterThan(20);
  });

  it("falla de ventilador: EVA-05 SUPERVIVENCIA tras 3 s y luego CO₂ → ABORTAR (2+ SUP)", () => {
    const { s, levels } = run(400, { ...NOMINAL_FAULTS, fanPct: 0 });
    expect(levels.slice(0, 2).every((l) => l === "NORMAL")).toBe(true);
    expect(levels).toContain("SUPERVIVENCIA");
    expect(s.co2).toBeGreaterThan(20);
    expect(s.level).toBe("ABORTAR");
    expect(liveTriggers(s).some((r) => r.ruleId === "LOGICA")).toBe(true);
  });

  it("observación n: tras resolver la falla, PRECAUCIÓN dura n s antes de volver a ESTABLE", () => {
    const hot = run(80, { ...NOMINAL_FAULTS, coolPct: 0 });
    expect(hot.s.level).toBe("PRECAUCION");
    const ctx = { ...CTX, observationS: 45 };
    const cool = run(400, NOMINAL_FAULTS, DEFAULT_CREW, hot.s, ctx);
    const firstRawNormal = (() => {
      let s = hot.s;
      for (let i = 1; i <= 400; i += 1) {
        s = stepLiveSuit(s, DEFAULT_CREW, NOMINAL_FAULTS, ctx);
        if (s.raw === "NORMAL") return i;
      }
      return -1;
    })();
    const firstNormal = cool.levels.indexOf("NORMAL") + 1;
    expect(firstRawNormal).toBeGreaterThan(0);
    // Igual que simulador_huella.html: la cuenta arranca en el último segundo aún en PRECAUCIÓN
    expect(firstNormal - firstRawNormal).toBeGreaterThanOrEqual(44);
    expect(firstNormal - firstRawNormal).toBeLessThanOrEqual(46);
  });

  it("los parámetros del tripulante cambian la fisiología", () => {
    expect(Math.round(fcMaxTanaka(38))).toBe(181);
    expect(bsaMosteller(65, 168)).toBeCloseTo(1.74, 2);
    const light = run(300).s;
    const heavy = run(300, NOMINAL_FAULTS, { ...DEFAULT_CREW, massKg: 95, payloadKg: 25 }).s;
    expect(heavy.met).toBeGreaterThan(light.met + 40);
    const fit = run(300, NOMINAL_FAULTS, {
      ...DEFAULT_CREW,
      ...CREW_PRESETS.EVA2,
      vo2MaxMlKgMin: 55,
    }).s;
    expect(fit.fcEsp).toBeLessThan(light.fcEsp);
    // Más área corporal disipa mejor el calor con el LCVG dañado
    const small = run(
      60,
      { ...NOMINAL_FAULTS, coolPct: 0 },
      { ...DEFAULT_CREW, massKg: 50, heightCm: 150 },
    ).s;
    const big = run(
      60,
      { ...NOMINAL_FAULTS, coolPct: 0 },
      { ...DEFAULT_CREW, massKg: 90, heightCm: 190 },
    ).s;
    expect(small.tc).toBeGreaterThan(big.tc);
  });

  it("matriz de radiación: reproduce el simulador (carrera 120 mSv, sin SPE)", () => {
    const rows = radiationMatrix(120, false);
    expect(rows[0]!.doseEvaMsv).toBeCloseTo(0.0267, 3);
    expect(rows[5]!.doseEvaMsv).toBeCloseTo(53.33, 2);
    expect(rows[5]!.totalMsv).toBeCloseTo(173.3, 1);
    expect(rows[5]!.level).toBe("SUPERVIVENCIA");
    expect(rows.slice(0, 5).every((r) => r.level === "NORMAL")).toBe(true);
    expect(radiationMatrix(470, false)[4]!.level).toBe("PRECAUCION");
    expect(radiationMatrix(120, true)[4]!.level).toBe("ABORTAR");
  });

  it("sesión individual: una falla en el camino lleva la FSM a CRITICAL y luego a EMERGENCY con candado", () => {
    const field = twoCorridorField();
    let s = createSession({
      terrain: field.terrain,
      origin: field.origin,
      goal: field.goal,
      shelters: [field.shelter],
      missionProfile: "solo",
      live: { params: DEFAULT_CREW },
    });
    expect(s.live).not.toBeNull();
    s = tick(s, 60);
    expect(s.fsm.state).toBe("NORMAL");
    s = updateLive(s, { faults: { fanPct: 0 } });
    s = tick(s, 15);
    expect(s.fsm.state).toBe("CRITICAL");
    expect(s.fsm.latch).toBe("return-mode");
    for (let i = 0; i < 30; i += 1) s = tick(s, 15);
    expect(s.fsm.state).toBe("EMERGENCY");
    expect(s.fsm.requiresHumanConfirmation).toBe(true);
    expect(s.physio.source).toBe("live");
    expect(s.physio.needs.respiratory).toBeGreaterThan(0.5);
    // Restaurar el ventilador no libera el candado: la FSM sigue enclavada hasta la confirmación humana
    s = updateLive(s, { nominal: true });
    for (let i = 0; i < 20; i += 1) s = tick(s, 15);
    expect(s.fsm.state).toBe("EMERGENCY");
  });

  it("cambiar la carga y la dosis de carrera actualiza los recursos y la necesidad de exposición", () => {
    const field = twoCorridorField();
    let s = createSession({
      terrain: field.terrain,
      origin: field.origin,
      goal: field.goal,
      missionProfile: "solo",
      live: { params: DEFAULT_CREW },
    });
    s = updateLive(s, { params: { payloadKg: 20, careerDoseMsv: 590 } });
    expect(s.resources.payloadKg).toBe(20);
    expect(s.resources.doseCareerMSv).toBe(590);
    s = tick(s, 60);
    expect(s.physio.needs.exposure).toBeGreaterThan(0.8);
  });
});
