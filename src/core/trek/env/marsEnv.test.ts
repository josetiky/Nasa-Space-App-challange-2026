import { describe, expect, it } from "vitest";
import { twoCorridorField } from "../costmap/synthetic";
import { createSession, setMarsEnv, tick } from "../sim/session";
import {
  ambientCoolingFactor,
  buildMarsEnv,
  envAtMissionTime,
  sunElevationDeg,
  type RemsSolLike,
} from "./marsEnv";

/** Sol 4995 del feed REMS de Curiosity (mars.nasa.gov, consultado el 2026-11-15). */
const REMS_4995: RemsSolLike = {
  sol: 4995,
  date: "2026-08-25",
  minT: -71,
  maxT: -5,
  pressurePa: 777,
  opacity: "Sunny",
  uv: "Moderate",
  sunrise: "06:46",
  sunset: "18:51",
};
const GALE = { lat: -4.7031, lon: 137.3912, elevationM: -4404 };
const NOW = new Date("2026-11-15T15:00:00Z");

describe("Entorno de Marte atado a fuentes reales", () => {
  it("elevación solar: mediodía alto, 06 h y 18 h cerca del horizonte", () => {
    expect(sunElevationDeg(0, 0, 12)).toBeCloseTo(90, 5);
    expect(Math.abs(sunElevationDeg(-4.7, 30, 6))).toBeLessThan(15);
    expect(sunElevationDeg(-4.7, 30, 0)).toBeLessThan(-60);
  });

  it("REMS da presión y temperaturas REALES con su antigüedad; la dosis sale de esa presión", () => {
    const env = buildMarsEnv({
      now: NOW,
      site: GALE,
      rems: REMS_4995,
      sepEventsIso: ["2026-10-01T00:00:00Z"],
    });
    expect(env.pressurePa).toMatchObject({ value: 777, source: "REAL" });
    expect(env.rems?.ageDays).toBe(82);
    expect(env.airMinC?.value).toBe(-71);
    expect(env.doseRateMsvPerSol.source).toBe("DERIVED");
    expect(env.doseRateMsvPerSol.value).toBeGreaterThan(0.6);
    expect(env.doseRateMsvPerSol.value).toBeLessThan(0.75);
    expect(env.tau.source).toBe("MODELLED");
    expect(env.sep.value).toBe(false);
    expect(env.ltstAtStart.source).toBe("DERIVED");
  });

  it("sin REMS ni DONKI no inventa: presión MODELLED y sin alerta SEP", () => {
    const env = buildMarsEnv({ now: NOW, site: GALE, rems: null, sepEventsIso: null });
    expect(env.pressurePa.source).toBe("MODELLED");
    expect(env.airMinC).toBeNull();
    expect(env.sep).toMatchObject({ value: false, source: "MODELLED" });
  });

  it("ejemplos: atardecer, temporada de polvo y SEP real de DONKI", () => {
    const sunset = buildMarsEnv({
      now: NOW,
      site: GALE,
      rems: REMS_4995,
      sepEventsIso: [],
      example: "sunset",
    });
    const at0 = envAtMissionTime(sunset, 0);
    const at1h = envAtMissionTime(sunset, 3600);
    expect(at0.sunElevationDeg).toBeGreaterThan(at1h.sunElevationDeg);
    expect(at1h.sunElevationDeg).toBeLessThan(5);
    const dusty = buildMarsEnv({
      now: NOW,
      site: GALE,
      rems: REMS_4995,
      sepEventsIso: [],
      example: "dusty",
    });
    const now = buildMarsEnv({ now: NOW, site: GALE, rems: REMS_4995, sepEventsIso: [] });
    expect(dusty.tau.value).toBeGreaterThanOrEqual(now.tau.value);
    const sep = buildMarsEnv({
      now: NOW,
      site: GALE,
      rems: REMS_4995,
      sepEventsIso: ["2024-05-13T12:00:00Z", "2024-05-20T06:00:00Z"],
      example: "sep",
    });
    expect(sep.sep).toMatchObject({ value: true, source: "REAL" });
    expect(sep.sep.lastEventIso?.slice(0, 10)).toBe("2024-05-20");
  });

  it("ejemplo SEP sin eventos recientes: usa el episodio histórico real y lo rotula", () => {
    const env = buildMarsEnv({
      now: NOW,
      site: GALE,
      rems: REMS_4995,
      sepEventsIso: [],
      example: "sep",
      historicSepIso: ["2024-05-10T12:00:00Z", "2024-12-21T12:00:00Z"],
      historicSepLabel: "DONKI 2024, respaldo incluido",
    });
    expect(env.sep.value).toBe(true);
    expect(env.sep.lastEventIso?.slice(0, 10)).toBe("2024-12-21");
    expect(env.sep.note).toContain("DONKI 2024");
    // En "ahora" el histórico nunca enciende la alerta
    const now = buildMarsEnv({
      now: NOW,
      site: GALE,
      rems: REMS_4995,
      sepEventsIso: [],
      historicSepIso: ["2024-12-21T12:00:00Z"],
    });
    expect(now.sep.value).toBe(false);
  });

  it("la temperatura del aire sigue el ciclo diario entre el mínimo y el máximo de REMS", () => {
    const env = buildMarsEnv({ now: NOW, site: GALE, rems: REMS_4995, sepEventsIso: [] });
    for (let h = 0; h < 24; h += 1) {
      const t = envAtMissionTime(env, (h * 88775) / 24).airTempC!;
      expect(t).toBeGreaterThanOrEqual(-71 - 1e-9);
      expect(t).toBeLessThanOrEqual(-5 + 1e-9);
    }
  });

  it("PRE-07: más presión ambiente reduce el enfriamiento del traje", () => {
    expect(ambientCoolingFactor(777)).toBe(1);
    expect(ambientCoolingFactor(1000)).toBeLessThan(1);
    expect(ambientCoolingFactor(1200)).toBe(0.5);
  });

  it("sesión: con el entorno aplicado, el Sol se mueve con el reloj y el SEP real manda al refugio", () => {
    const field = twoCorridorField();
    const base = {
      terrain: field.terrain,
      origin: field.origin,
      goal: field.goal,
      shelters: [field.shelter],
    };
    const sunsetEnv = buildMarsEnv({
      now: NOW,
      site: GALE,
      rems: REMS_4995,
      sepEventsIso: [],
      example: "sunset",
    });
    let s = createSession({ ...base, env: sunsetEnv });
    const sun0 = s.snapshot.dynamic.sunElevationDeg;
    s = tick(s, 3600);
    expect(s.snapshot.dynamic.sunElevationDeg).toBeLessThan(sun0);
    const sepEnv = buildMarsEnv({
      now: NOW,
      site: GALE,
      rems: REMS_4995,
      sepEventsIso: ["2024-05-20T06:00:00Z"],
      example: "sep",
    });
    s = setMarsEnv(s, sepEnv);
    expect(s.sepAlertActive).toBe(true);
    expect(s.envelope.goalPolicy).toBe("nearest-shelter");
    expect(s.baseDoseRateMsvPerSol).toBeGreaterThan(sepEnv.doseRateMsvPerSol.value * 3);
  });
});
