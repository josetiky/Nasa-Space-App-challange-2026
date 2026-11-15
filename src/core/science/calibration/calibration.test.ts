import { describe, expect, it } from "vitest";
import { backgroundTau, dailyTemperature, pressureAt, REMS_CALIBRATION } from "../environment";
import { REMS_GALE_LS_BINS, REMS_GALE_META } from "./remsGale";

const rms = (errors: number[]) => Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
const { latDeg, referenceElevationM } = REMS_GALE_META;

describe("model calibration against Curiosity REMS (Gale, 36 Ls bins, sols 1–4995)", () => {
  const model = REMS_GALE_LS_BINS.map((b) => ({ bin: b, t: dailyTemperature(latDeg, referenceElevationM, b.ls, backgroundTau(b.ls)) }));

  it("reproduces the seasonal daily-mean air temperature (RMS < 2 K, max < 4 K)", () => {
    const errors = model.map(({ bin, t }) => t.meanC - bin.meanC);
    expect(rms(errors)).toBeLessThan(2);
    expect(Math.max(...errors.map(Math.abs))).toBeLessThan(4);
  });

  it("reproduces the diurnal range, larger near perihelion (RMS < 3 K)", () => {
    const errors = model.map(({ bin, t }) => t.maxC - t.minC - bin.rangeK);
    expect(rms(errors)).toBeLessThan(3);
    const aphelion = model.find(({ bin }) => bin.ls === 75)!;
    const perihelion = model.find(({ bin }) => bin.ls === 185)!;
    expect(perihelion.t.maxC - perihelion.t.minC).toBeGreaterThan(aphelion.t.maxC - aphelion.t.minC + 8);
  });

  it("reproduces the CO₂ pressure cycle (RMS < 1.5 % of the mean)", () => {
    const errors = REMS_GALE_LS_BINS.map((b) => (pressureAt(referenceElevationM, b.ls) - b.pressurePa) / b.pressurePa);
    expect(rms(errors)).toBeLessThan(0.015);
  });

  it("is flagged as calibrated, with its dataset recorded", () => {
    expect(REMS_CALIBRATION.calibrated).toBe(true);
    expect(REMS_CALIBRATION.calibrationDataset).toMatch(/REMS/);
  });
});
