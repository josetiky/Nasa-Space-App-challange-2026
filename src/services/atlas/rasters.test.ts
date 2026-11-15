import { describe, expect, it } from "vitest";
import { annualMeanTemperature, describeEnvironment, gcrDosePerSol, pressureAt } from "@/core/science/environment";
import { createGrid, sampleElevation } from "@/core/science/terrain";
import { colorAt, layerSpec } from "@/data/layers";
import { buildLayerField, colorizeField, hazardIndex, layerValue } from "./rasters";

/** Synthetic MOLA-like grid: elevation rises 10 m per column, plus a high plateau in one block. */
function syntheticGrid() {
  const width = 1440;
  const height = 720;
  const data = new Int16Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const plateau = row > 300 && row < 340 && col > 100 && col < 140 ? 6000 : 0;
      data[row * width + col] = -4000 + (col % 800) * 10 + plateau;
    }
  }
  return createGrid(data, width, height, "synthetic");
}

const pixelPoint = (x: number, y: number, w: number, h: number) => ({ lat: 90 - ((y + 0.5) / h) * 180, lon: -180 + ((x + 0.5) / w) * 360 });

describe("hazard index", () => {
  it("is low on flat lowland and high on steep, rugged, elevated terrain", () => {
    expect(hazardIndex(0.1, 50, -3000)).toBeLessThan(0.1);
    expect(hazardIndex(4, 4000, 8000)).toBeGreaterThan(0.85);
  });

  it("stays within 0..1 and grows with slope", () => {
    const values = [0, 0.5, 1, 2, 3, 6].map((slope) => hazardIndex(slope, 500, 0));
    values.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    values.forEach((v) => expect(v).toBeLessThanOrEqual(1));
    for (let i = 1; i < values.length; i += 1) expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
  });
});

describe("layer fields", () => {
  it("marks elevation-dependent layers unavailable without the MOLA grid", () => {
    for (const id of ["elevation", "slope", "temperature", "radiation", "hazards"] as const) {
      const field = buildLayerField(id, null, 36, 18);
      expect("unavailable" in field && field.unavailable).toMatch(/MOLA/);
    }
  });

  it("computes the dust and ice proxies without the grid", () => {
    const dust = buildLayerField("dust", null, 72, 36);
    expect("values" in dust).toBe(true);
    if ("values" in dust) {
      expect(dust.values).toHaveLength(72 * 36);
      expect(Math.max(...dust.values)).toBeGreaterThan(0.4);
    }
  });

  it("samples MOLA elevation at pixel centres", () => {
    const grid = syntheticGrid();
    const field = buildLayerField("elevation", grid, 90, 45);
    if (!("values" in field)) throw new Error("expected values");
    for (const [x, y] of [[0, 0], [10, 20], [89, 44]] as const) {
      expect(field.values[y * 90 + x]).toBeCloseTo(sampleElevation(grid, pixelPoint(x, y, 90, 45)), 3);
    }
  });

  it("matches the annual-mean temperature model within 0.5 K", () => {
    const grid = syntheticGrid();
    const field = buildLayerField("temperature", grid, 72, 36);
    if (!("values" in field)) throw new Error("expected values");
    for (const [x, y] of [[5, 3], [30, 18], [60, 30], [40, 34]] as const) {
      const p = pixelPoint(x, y, 72, 36);
      const expected = annualMeanTemperature(p.lat, sampleElevation(grid, p)).meanC;
      expect(Math.abs(field.values[y * 72 + x]! - expected)).toBeLessThan(0.5);
    }
  });

  it("models radiation from the pressure at each cell", () => {
    const grid = syntheticGrid();
    const field = buildLayerField("radiation", grid, 36, 18);
    if (!("values" in field)) throw new Error("expected values");
    const p = pixelPoint(7, 9, 36, 18);
    expect(field.values[9 * 36 + 7]).toBeCloseTo(gcrDosePerSol(pressureAt(sampleElevation(grid, p))), 6);
  });

  it("colourises with the layer legend and leaves no-data transparent", () => {
    const legend = layerSpec("elevation").legend;
    if (legend.kind !== "gradient") throw new Error("gradient expected");
    const rgba = colorizeField(new Float32Array([-8000, 21000, Number.NaN]), legend.stops, 1);
    expect(Array.from(rgba.slice(0, 4))).toEqual(colorAt(legend.stops, -8000).map(Math.round));
    expect(rgba[11]).toBe(0);
  });
});

describe("layer readouts", () => {
  it("formats the value of each layer for a location", () => {
    const env = describeEnvironment({ lat: -4.59, lon: 137.44 }, syntheticGrid());
    expect(layerValue("elevation", env).text).toMatch(/m$/);
    expect(layerValue("radiation", env).text).toMatch(/mSv\/sol/);
    expect(layerValue("temperature", env).text).toMatch(/°C/);
    expect(layerValue("hazards", env).value).toBeGreaterThanOrEqual(0);
    const noGrid = describeEnvironment({ lat: -4.59, lon: 137.44 }, null);
    expect(layerValue("elevation", noGrid)).toMatchObject({ value: null });
  });
});
