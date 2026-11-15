import { describe, expect, it } from "vitest";
import { metabolicRateW, walkingSpeedKmh } from "@/core/science/eva";
import { pandolfMars, toblerLinear } from "./locomotion";
import {
  consumptionRates,
  createInitialResourceState,
  limitingConsumable,
  returnMargin,
  stepResources,
} from "./consumables";

describe("Mars Trek locomotion & consumables (Task 3)", () => {
  it("calibrates pandolf-mars on flat ground to 1000 kJ/h ± 0.5 % and 2.0 km/h for the reference astronaut", () => {
    const model = pandolfMars();
    const speedMs = model.speedMs({ slopeDeg: 0, gradePct: 0 });
    expect(speedMs * 3.6).toBeCloseTo(2.0, 5);

    const watts = model.metabolicW({
      slopeDeg: 0,
      gradePct: 0,
      bodyMassKg: 65,
      suitMassKg: 104,
      payloadKg: 3.4,
    });
    const kjPerH = watts * 3.6;
    expect(Math.abs(kjPerH - 1000) / 1000).toBeLessThanOrEqual(0.005);
  });

  it("reduces pandolf-mars speed to 1.0 km/h at 20 % grade and never drops below 0.8 km/h", () => {
    const model = pandolfMars();
    expect(model.speedMs({ slopeDeg: 11.31, gradePct: 20 }) * 3.6).toBeCloseTo(1.0, 5);
    expect(model.speedMs({ slopeDeg: 30, gradePct: 35 }) * 3.6).toBeCloseTo(0.8, 5);
    expect(model.speedMs({ slopeDeg: -30, gradePct: -50 }) * 3.6).toBeCloseTo(0.8, 5);
  });

  it("treats downhills as flat ground for metabolic expenditure in pandolf-mars and increases cost with payload", () => {
    const model = pandolfMars();
    const flatAtDownhillSpeed = model.metabolicW({
      slopeDeg: 0,
      gradePct: 0,
    });
    // Downhill grade has G = max(grade, 0) = 0; at equal speed (0 grade vs -0 grade) metabolic rate equals flat:
    const gentleDown = model.metabolicW({ slopeDeg: -10, gradePct: 0 });
    expect(gentleDown).toBeCloseTo(flatAtDownhillSpeed, 5);

    // For a downhill where speed is reduced, G is still 0 so expenditure never exceeds flat ground:
    const steepDown = model.metabolicW({ slopeDeg: -12, gradePct: -12 });
    expect(steepDown).toBeLessThanOrEqual(flatAtDownhillSpeed);

    // Payload increases metabolic rate:
    const light = model.metabolicW({ slopeDeg: 10, gradePct: 15, payloadKg: 0 });
    const heavy = model.metabolicW({ slopeDeg: 10, gradePct: 15, payloadKg: 15 });
    expect(heavy).toBeGreaterThan(light);
  });

  it("matches walkingSpeedKmh and metabolicRateW in tobler-linear", () => {
    for (const deg of [-15, -5, 0, 8, 18]) {
      const expectedKmh = walkingSpeedKmh(Math.abs(deg), deg >= 0);
      expect(toblerLinear.speedMs({ slopeDeg: deg }) * 3.6).toBeCloseTo(expectedKmh, 6);
      expect(toblerLinear.metabolicW({ slopeDeg: deg })).toBeCloseTo(
        metabolicRateW(Math.abs(deg)),
        6,
      );
    }
  });

  it("computes O2 tank pressure drop at 2.13 psi/min per L/min of VO2 and flags negative return margin as noGo", () => {
    const rates = consumptionRates(1000 / 3.6);
    expect(rates.o2PsiPerMin / rates.vo2LPerMin).toBeCloseTo(2.13, 6);

    const go = returnMargin({ limitingMin: 200, returnMin: 100, reserveMin: 30 });
    expect(go.noGo).toBe(false);
    expect(go.caution).toBe(false);
    expect(go.status).toBe("go");

    const caution = returnMargin({ limitingMin: 200, returnMin: 145, reserveMin: 30 });
    expect(caution.marginMin).toBeCloseTo(25, 5);
    expect(caution.marginPct).toBeCloseTo(12.5, 5);
    expect(caution.caution).toBe(true);
    expect(caution.noGo).toBe(false);

    const noGo = returnMargin({ limitingMin: 120, returnMin: 100, reserveMin: 30 });
    expect(noGo.marginMin).toBe(-10);
    expect(noGo.noGo).toBe(true);
    expect(noGo.status).toBe("noGo");
  });

  it("tracks limiting consumable and steps resource state consistently", () => {
    const init = createInitialResourceState("EVA1");
    const stepped = stepResources(init, 600, 300);
    expect(stepped.missionTimeS).toBe(600);
    expect(stepped.o2PrimaryPsi).toBeLessThan(init.o2PrimaryPsi);
    expect(stepped.batteryWh).toBeLessThan(init.batteryWh);
    expect(stepped.limiting.minutes).toBeGreaterThan(0);

    const lowBat = limitingConsumable({
      o2PrimaryPsi: 900,
      co2ScrubberPct: 10,
      coolantStoragePct: 90,
      batteryWh: 15,
    });
    expect(lowBat.limiting.resource).toBe("battery");
  });
});
