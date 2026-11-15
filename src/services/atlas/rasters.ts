/**
 * Survival Atlas raster layers: numeric fields evaluated from the core models
 * (MOLA grid + documented formulas), then colourised with each layer legend.
 * Pure functions — the browser-only image conversion lives in ./canvas.ts.
 */
import { LANDING_SITES } from "@/core/science/regions";
import { backgroundTau, dailyTemperature, dustActivity, gcrDosePerSol, iceLikelihood, pressureAt, REMS_CALIBRATION } from "@/core/science/environment";
import { distanceKm } from "@/core/science/geo";
import { reliefAt, sampleElevation, slopeAt, type TerrainGrid } from "@/core/science/terrain";
import type { GeoPoint, SiteEnvironment } from "@/core/types";
import { colorAt, type LayerId } from "@/data/layers";

export type LayerField = { width: number; height: number; values: Float32Array } | { unavailable: string };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (x: number, a: number, b: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Geological-hazard composite (DERIVED, documented in SIMULATION_MODEL.md):
 * 50 % regional slope (0.3→3°), 30 % local relief (300→3000 m),
 * 20 % elevation (0→6 km: thinner air for entry, descent and landing).
 */
export function hazardIndex(slopeDeg: number, reliefM: number, elevationM: number): number {
  return clamp01(0.5 * smoothstep(slopeDeg, 0.3, 3) + 0.3 * smoothstep(reliefM, 300, 3000) + 0.2 * smoothstep(elevationM, 0, 6000));
}

const GRID_LAYERS: LayerId[] = ["elevation", "slope", "temperature", "radiation", "hazards"];
const VECTOR_LAYERS: LayerId[] = ["resources", "landing", "routes"];

/** Equirectangular pixel centre (row 0 at 90°N, column 0 at 180°W). */
export function pixelCenter(x: number, y: number, width: number, height: number): GeoPoint {
  return { lat: 90 - ((y + 0.5) / height) * 180, lon: -180 + ((x + 0.5) / width) * 360 };
}

/** Annual-mean temperature for a row of elevations, exact w.r.t. annualMeanTemperature(). */
function temperatureRow(latDeg: number, elevations: Float32Array, out: Float32Array, offset: number, steps = 36) {
  // dailyTemperature() is max(148 K, A(lat, Ls) − lapse·(z − z_ref)); evaluating it once at
  // z0 below the deepest point of Mars lets every other elevation follow by subtraction.
  const z0 = -9000;
  const seasonal = new Float64Array(steps);
  for (let i = 0; i < steps; i += 1) {
    const ls = (i / steps) * 360;
    seasonal[i] = dailyTemperature(latDeg, z0, ls, backgroundTau(ls)).meanC + 273.15;
  }
  const k = REMS_CALIBRATION.lapseKPerKm / 1000;
  for (let x = 0; x < elevations.length; x += 1) {
    const shift = k * (elevations[x]! - z0);
    let sum = 0;
    for (let i = 0; i < steps; i += 1) sum += Math.max(148, seasonal[i]! - shift);
    out[offset + x] = sum / steps - 273.15;
  }
}

/** Numeric field of a raster layer at width×height (NaN = no data). */
export function buildLayerField(id: LayerId, grid: TerrainGrid | null, width: number, height: number): LayerField {
  if (VECTOR_LAYERS.includes(id)) return { unavailable: `${id} is a vector layer` };
  if (GRID_LAYERS.includes(id) && !grid) return { unavailable: "Requires the MOLA MEGDR grid (load it in NASA Data or run npm run data:fetch)." };
  const values = new Float32Array(width * height);
  const rowElevations = new Float32Array(width);
  for (let y = 0; y < height; y += 1) {
    const lat = 90 - ((y + 0.5) / height) * 180;
    if (grid) for (let x = 0; x < width; x += 1) rowElevations[x] = sampleElevation(grid, pixelCenter(x, y, width, height));
    if (id === "temperature") {
      temperatureRow(lat, rowElevations, values, y * width);
      continue;
    }
    for (let x = 0; x < width; x += 1) {
      const point = pixelCenter(x, y, width, height);
      const i = y * width + x;
      switch (id) {
        case "elevation":
          values[i] = rowElevations[x]!;
          break;
        case "slope":
          values[i] = slopeAt(grid!, point);
          break;
        case "radiation":
          values[i] = gcrDosePerSol(pressureAt(rowElevations[x]!));
          break;
        case "hazards":
          values[i] = hazardIndex(slopeAt(grid!, point), reliefAt(grid!, point), rowElevations[x]!);
          break;
        case "dust":
          values[i] = dustActivity(point);
          break;
        case "waterIce":
          values[i] = iceLikelihood(point);
          break;
        default:
          values[i] = Number.NaN;
      }
    }
  }
  return { width, height, values };
}

/** RGBA pixels from a field and gradient stops; NaN → transparent. */
export function colorizeField(values: Float32Array, stops: Array<[number, string]>, opacity: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(values.length * 4);
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]!;
    if (!Number.isFinite(v)) continue;
    const [r, g, b, a] = colorAt(stops, v);
    rgba[i * 4] = Math.round(r);
    rgba[i * 4 + 1] = Math.round(g);
    rgba[i * 4 + 2] = Math.round(b);
    rgba[i * 4 + 3] = Math.round(a * opacity);
  }
  return rgba;
}

export function fieldStats(values: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

const fmt = (v: number, digits = 0) => v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Value of a layer at an analysed location, with units (for the atlas readout). */
export function layerValue(id: LayerId, env: SiteEnvironment): { value: number | null; text: string } {
  const noGrid = { value: null, text: "unavailable — MOLA grid not loaded" };
  switch (id) {
    case "elevation":
      return env.elevationM === null ? noGrid : { value: env.elevationM, text: `${fmt(env.elevationM)} m` };
    case "slope":
      return env.slopeDeg === null ? noGrid : { value: env.slopeDeg, text: `${fmt(env.slopeDeg, 2)}° (regional)` };
    case "temperature":
      return { value: env.annualMeanTempC, text: `${fmt(env.annualMeanTempC)} °C annual mean${env.elevationSource === "mola" ? "" : " (reference elevation)"}` };
    case "radiation":
      return { value: env.gcrDoseMsvPerSol, text: `${fmt(env.gcrDoseMsvPerSol, 2)} mSv/sol` };
    case "dust":
      return { value: env.dustActivity, text: `${fmt(env.dustActivity, 2)} activity index` };
    case "waterIce":
      return { value: env.iceLikelihood, text: `${fmt(env.iceLikelihood, 2)} likelihood` };
    case "hazards":
      if (env.elevationM === null || env.slopeDeg === null || env.reliefM === null) return noGrid;
      return { value: hazardIndex(env.slopeDeg, env.reliefM, env.elevationM), text: `${fmt(hazardIndex(env.slopeDeg, env.reliefM, env.elevationM), 2)} hazard index` };
    case "resources":
      return env.nearestTarget ? { value: env.nearestTarget.distanceKm, text: `${env.nearestTarget.name} · ${fmt(env.nearestTarget.distanceKm)} km` } : { value: null, text: "none documented nearby" };
    case "landing": {
      const nearest = LANDING_SITES.map((site) => ({ site, d: distanceKm(env.point, site.point) })).sort((a, b) => a.d - b.d)[0];
      return nearest ? { value: nearest.d, text: `${nearest.site.mission} · ${fmt(nearest.d)} km` } : { value: null, text: "—" };
    }
    case "routes":
      return { value: null, text: "see the map (MMGIS traverses + planned legs)" };
  }
}
