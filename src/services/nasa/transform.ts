/**
 * Pure transforms shared by the server proxies (src/routes/api/nasa/*) and the
 * client adapters. scripts/fetch-nasa-data.mjs mirrors them for Node.
 */

export const MOLA_WIDTH = 1440;
export const MOLA_HEIGHT = 720;

/** PDS MEGDR (MSB int16) → native Int16Array. Throws on an unexpected size. */
export function megdrToInt16(buffer: ArrayBuffer): Int16Array {
  if (buffer.byteLength !== MOLA_WIDTH * MOLA_HEIGHT * 2) throw new Error(`Unexpected MEGDR size ${buffer.byteLength}`);
  const view = new DataView(buffer);
  const out = new Int16Array(MOLA_WIDTH * MOLA_HEIGHT);
  for (let i = 0; i < out.length; i += 1) out[i] = view.getInt16(i * 2, false);
  return out;
}

/** Little-endian Int16 buffer (snapshot format) → Int16Array. */
export function int16FromLittleEndian(buffer: ArrayBuffer): Int16Array {
  if (buffer.byteLength !== MOLA_WIDTH * MOLA_HEIGHT * 2) throw new Error(`Unexpected grid size ${buffer.byteLength}`);
  const view = new DataView(buffer);
  const out = new Int16Array(MOLA_WIDTH * MOLA_HEIGHT);
  for (let i = 0; i < out.length; i += 1) out[i] = view.getInt16(i * 2, true);
  return out;
}

export function int16ToLittleEndian(data: Int16Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < data.length; i += 1) view.setInt16(i * 2, data[i] ?? 0, true);
  return buffer;
}

export interface RemsSol {
  sol: number;
  date: string | null;
  ls: number | null;
  minT: number | null;
  maxT: number | null;
  pressurePa: number | null;
  minGroundT: number | null;
  maxGroundT: number | null;
  uv: string | null;
  opacity: string | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface RemsSnapshot {
  source: string;
  retrievedAt: string;
  credit: string;
  count: number;
  soles: RemsSol[];
}

const num = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() && value !== "--" ? value : null);

/** Trim the REMS feed to the fields the platform uses, sorted by sol. */
export function trimRems(raw: unknown, source: string, retrievedAt: string): RemsSnapshot {
  const soles = Array.isArray((raw as { soles?: unknown[] })?.soles) ? (raw as { soles: Array<Record<string, unknown>> }).soles : [];
  const out: RemsSol[] = [];
  for (const s of soles) {
    const sol = num(s["sol"]);
    if (sol === null) continue;
    out.push({
      sol,
      date: str(s["terrestrial_date"]),
      ls: num(s["ls"]),
      minT: num(s["min_temp"]),
      maxT: num(s["max_temp"]),
      pressurePa: num(s["pressure"]),
      minGroundT: num(s["min_gts_temp"]),
      maxGroundT: num(s["max_gts_temp"]),
      uv: str(s["local_uv_irradiance_index"]),
      opacity: str(s["atmo_opacity"]),
      sunrise: str(s["sunrise"]),
      sunset: str(s["sunset"]),
    });
  }
  out.sort((a, b) => a.sol - b.sol);
  return { source, retrievedAt, credit: "NASA/JPL-Caltech/CAB(CSIC-INTA)", count: out.length, soles: out };
}

/** Most recent sol with temperatures and pressure. */
export function latestValidSol(snapshot: RemsSnapshot): RemsSol | null {
  for (let i = snapshot.soles.length - 1; i >= 0; i -= 1) {
    const s = snapshot.soles[i]!;
    if (s.minT !== null && s.maxT !== null && s.pressurePa !== null) return s;
  }
  return null;
}

export type LngLat = [number, number];

export interface TraverseLine {
  sol: number | null;
  coordinates: LngLat[];
}

/** Douglas–Peucker simplification in degrees. */
export function simplifyLine(points: LngLat[], epsilon: number): LngLat[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = points[a]!;
    const [bx, by] = points[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1e-12;
    let index = -1;
    let max = 0;
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = points[i]!;
      const distance = Math.abs(dy * px - dx * py + bx * ay - by * ax) / length;
      if (distance > max) {
        max = distance;
        index = i;
      }
    }
    if (max > epsilon && index > 0) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** GeoJSON traverse → simplified lines with sols. */
export function parseTraverse(raw: unknown, epsilon = 2e-5): TraverseLine[] {
  const features = Array.isArray((raw as { features?: unknown[] })?.features) ? (raw as { features: Array<{ properties?: Record<string, unknown>; geometry?: { type: string; coordinates: unknown } }> }).features : [];
  const lines: TraverseLine[] = [];
  for (const feature of features) {
    const props = feature.properties ?? {};
    const sol = num(props["sol"] ?? props["Sol"] ?? props["SOL"]);
    const geometry = feature.geometry;
    if (!geometry) continue;
    const parts: LngLat[][] =
      geometry.type === "LineString" ? [geometry.coordinates as LngLat[]] : geometry.type === "MultiLineString" ? (geometry.coordinates as LngLat[][]) : [];
    for (const part of parts) {
      const clean = part.filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])).map((c) => [c[0], c[1]] as LngLat);
      if (clean.length >= 2) lines.push({ sol, coordinates: simplifyLine(clean, epsilon) });
    }
  }
  return lines;
}

export interface DonkiEpisode {
  dayOfYear: number;
  tier: 1 | 2 | 3;
  time: string;
}

/**
 * Group DONKI SEP records within 48 h into episodes and estimate a tier
 * (same rule as the original Sol-by-Sol simulator: any >100 MeV detection →
 * severe, 4+ detections → moderate, else minor).
 */
export function donkiEpisodes(raw: unknown): DonkiEpisode[] {
  const records = Array.isArray(raw) ? (raw as Array<{ eventTime?: string; instruments?: Array<{ displayName?: string }> }>) : [];
  const rows = records
    .map((r) => ({ t: Date.parse(r.eventTime ?? ""), time: r.eventTime ?? "", hard: (r.instruments ?? []).some((i) => String(i.displayName ?? "").includes(">100 MeV")) }))
    .filter((r) => Number.isFinite(r.t))
    .sort((a, b) => a.t - b.t);
  const clusters: Array<typeof rows> = [];
  for (const row of rows) {
    const last = clusters[clusters.length - 1];
    if (last && row.t - last[last.length - 1]!.t <= 48 * 3600e3) last.push(row);
    else clusters.push([row]);
  }
  return clusters.map((cluster) => {
    const first = cluster[0]!;
    const d = new Date(first.t);
    const doy = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
    const tier: 1 | 2 | 3 = cluster.some((r) => r.hard) ? 3 : cluster.length >= 4 ? 2 : 1;
    return { dayOfYear: doy, tier, time: first.time };
  });
}

/** DONKI 2024 episodes bundled in the original Sol-by-Sol simulator (public/sol-simulator/app.js). */
export const DONKI_2024_EPISODES: Array<[number, 1 | 2 | 3]> = [
  [2, 2], [22, 1], [29, 2], [37, 1], [40, 2], [43, 3], [75, 2], [83, 2], [130, 3], [134, 2], [160, 3], [164, 2], [205, 3],
  [213, 1], [218, 1], [245, 1], [249, 1], [253, 2], [261, 2], [283, 3], [300, 2], [326, 3], [343, 1], [353, 1], [356, 1],
];
