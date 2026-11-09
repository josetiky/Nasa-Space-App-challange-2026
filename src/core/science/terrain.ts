import type { GeoPoint } from "../types";
import { MARS } from "./constants";
import { normalizeLon } from "./geo";

/**
 * Equirectangular elevation grid. For MOLA MEGDR 4 px/deg (MEGT90N000CB):
 * width 1440, height 720, first sample centred at (89.875°N, 0.125°E),
 * longitudes 0–360° east, metres relative to the areoid.
 */
export interface TerrainGrid {
  width: number;
  height: number;
  pixelsPerDegree: number;
  /** Longitude (0–360) of the western edge of column 0. */
  westLon360: number;
  data: Int16Array;
  source: string;
}

export function createGrid(data: Int16Array, width: number, height: number, source = "MOLA MEGDR"): TerrainGrid {
  if (data.length !== width * height) throw new Error(`Grid size mismatch: ${data.length} != ${width}×${height}`);
  return { width, height, pixelsPerDegree: width / 360, westLon360: 0, data, source };
}

function cell(grid: TerrainGrid, column: number, row: number): number {
  const x = ((column % grid.width) + grid.width) % grid.width;
  const y = Math.max(0, Math.min(grid.height - 1, row));
  return grid.data[y * grid.width + x] ?? 0;
}

/** Fractional column/row of a point (pixel centres at integer + 0.5). */
function toPixel(grid: TerrainGrid, point: GeoPoint): { x: number; y: number } {
  const lon360 = (normalizeLon(point.lon) + 360) % 360;
  return {
    x: (lon360 - grid.westLon360) * grid.pixelsPerDegree - 0.5,
    y: (90 - point.lat) * grid.pixelsPerDegree - 0.5,
  };
}

/** Bilinear elevation (m). */
export function sampleElevation(grid: TerrainGrid, point: GeoPoint): number {
  const { x, y } = toPixel(grid, point);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const a = cell(grid, x0, y0);
  const b = cell(grid, x0 + 1, y0);
  const c = cell(grid, x0, y0 + 1);
  const d = cell(grid, x0 + 1, y0 + 1);
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/** Grid cell size in metres at a latitude: [east–west, north–south]. */
export function cellSizeM(grid: TerrainGrid, latDeg: number): [number, number] {
  const ns = (2 * Math.PI * MARS.molaReferenceRadiusM) / (360 * grid.pixelsPerDegree);
  return [Math.max(1, ns * Math.cos((latDeg * Math.PI) / 180)), ns];
}

/** Regional slope (deg) by central differences on the grid (baseline = 2 cells ≈ 30 km at 4 px/deg). */
export function slopeAt(grid: TerrainGrid, point: GeoPoint): number {
  const { x, y } = toPixel(grid, point);
  const cx = Math.round(x);
  const cy = Math.round(y);
  const [dxM, dyM] = cellSizeM(grid, point.lat);
  const dzdx = (cell(grid, cx + 1, cy) - cell(grid, cx - 1, cy)) / (2 * dxM);
  const dzdy = (cell(grid, cx, cy + 1) - cell(grid, cx, cy - 1)) / (2 * dyM);
  return (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;
}

/** Local relief: max − min in the 3×3 neighbourhood (m). */
export function reliefAt(grid: TerrainGrid, point: GeoPoint): number {
  const { x, y } = toPixel(grid, point);
  const cx = Math.round(x);
  const cy = Math.round(y);
  let min = Infinity;
  let max = -Infinity;
  for (let j = -1; j <= 1; j += 1) {
    for (let i = -1; i <= 1; i += 1) {
      const v = cell(grid, cx + i, cy + j);
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return max - min;
}

/** Full-resolution slope raster (deg), same layout as the grid. */
export function slopeRaster(grid: TerrainGrid): Float32Array {
  const out = new Float32Array(grid.width * grid.height);
  for (let row = 0; row < grid.height; row += 1) {
    const lat = 90 - (row + 0.5) / grid.pixelsPerDegree;
    const [dxM, dyM] = cellSizeM(grid, lat);
    for (let col = 0; col < grid.width; col += 1) {
      const dzdx = (cell(grid, col + 1, row) - cell(grid, col - 1, row)) / (2 * dxM);
      const dzdy = (cell(grid, col, row + 1) - cell(grid, col, row - 1)) / (2 * dyM);
      out[row * grid.width + col] = (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;
    }
  }
  return out;
}

/** Elevation statistics, used to validate a loaded grid. */
export function gridStats(grid: TerrainGrid): { min: number; max: number; mean: number } {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (let i = 0; i < grid.data.length; i += 1) {
    const v = grid.data[i] ?? 0;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, mean: sum / grid.data.length };
}

/** Sample elevations along a list of points (for route profiles). */
export function profileAlong(grid: TerrainGrid, points: GeoPoint[]): number[] {
  return points.map((point) => sampleElevation(grid, point));
}
