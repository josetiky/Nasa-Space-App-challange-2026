import { describe, expect, it } from "vitest";
import {
  HISTORICAL_INCIDENTS,
  rollHistoricalIncidents,
  type HistoricalContext,
} from "./historicalEvents";

const base: HistoricalContext = {
  clockS: 60,
  dtS: 15,
  seed: 7,
  solo: false,
  evaElapsedMin: 1,
  routePoints: [
    { x: 0, z: 0 },
    { x: 10, z: 5 },
    { x: 20, z: 10 },
  ],
  maxSlopeDeg: 8,
  ls: 90,
  tau: 0.6,
  airMinC: -70,
  sepRealActive: false,
  sepAlreadyOn: false,
  stormActive: false,
};

describe("historicalEvents", () => {
  it("cada incidente cita un precedente real", () => {
    for (const inc of HISTORICAL_INCIDENTS) {
      expect(inc.refEs.length).toBeGreaterThan(20);
      expect(inc.refEn.length).toBeGreaterThan(20);
    }
  });

  it("es determinista para el mismo contexto", () => {
    const a = rollHistoricalIncidents({ ...base, clockS: 300 }, new Set(), "demo").map((f) => f.id);
    const b = rollHistoricalIncidents({ ...base, clockS: 300 }, new Set(), "demo").map((f) => f.id);
    expect(a).toEqual(b);
  });

  it("un SEP real de DONKI se dispara de inmediato aun en modo realista", () => {
    const f = rollHistoricalIncidents({ ...base, sepRealActive: true }, new Set(), "realistic");
    const sep = f.find((x) => x.id === "sep-donki");
    expect(sep?.realTrigger).toBe(true);
  });

  it("no repite incidentes ya disparados", () => {
    const fired = new Set(HISTORICAL_INCIDENTS.map((i) => i.id));
    expect(rollHistoricalIncidents({ ...base, sepRealActive: true }, fired, "demo")).toEqual([]);
  });

  it("la temporada de polvo y τ alta suben la tasa de tormentas", () => {
    const storm = HISTORICAL_INCIDENTS.find((i) => i.id === "mars-dust-storm")!;
    expect(storm.hazardPerHour({ ...base, ls: 250, tau: 2 })).toBeGreaterThan(
      storm.hazardPerHour(base),
    );
  });

  it("los incidentes de traje en vivo solo aplican a la misión individual", () => {
    let soloOnly = 0;
    for (let s = 0; s < 4000; s += 15) {
      for (const f of rollHistoricalIncidents(
        { ...base, clockS: s, evaElapsedMin: 90 },
        new Set(),
        "demo",
      ))
        if (f.incident.soloOnly) soloOnly++;
    }
    expect(soloOnly).toBe(0);
  });

  it("en una caminata larga en modo demo ocurre al menos un incidente", () => {
    const fired = new Set<string>();
    for (let s = 15; s <= 3600; s += 15) {
      for (const f of rollHistoricalIncidents(
        { ...base, clockS: s, evaElapsedMin: s / 60, ls: 250, tau: 1.4 },
        fired,
        "demo",
      ))
        fired.add(f.id);
    }
    expect(fired.size).toBeGreaterThan(0);
  });
});
