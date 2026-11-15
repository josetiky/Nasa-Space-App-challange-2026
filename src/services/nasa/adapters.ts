/**
 * Client adapters for every integrated NASA source. Each loader states where
 * the data came from: "live" (browser → NASA), "proxy" (our server route →
 * NASA), "snapshot" (file saved by `npm run data:fetch`) or "bundled".
 * Nothing here fabricates data: when every route fails the caller gets an error.
 */
import { createGrid, type TerrainGrid } from "@/core/science/terrain";
import { fetchArrayBuffer, fetchJson, fetchWithTimeout, firstAvailable } from "./http";
import { DONKI_2024_EPISODES, donkiEpisodes, int16FromLittleEndian, latestValidSol, megdrToInt16, parseTraverse, trimRems, type DonkiEpisode, type RemsSnapshot, type TraverseLine } from "./transform";

export type Origin = "live" | "proxy" | "snapshot" | "bundled";

/* ----------------------------- Mars Trek -------------------------------- */

export const TREK_LAYERS = {
  viking: { id: "Mars_Viking_MDIM21_ClrMosaic_global_232m", label: "Viking MDIM 2.1 colour mosaic (232 m/px)", maxNativeZoom: 7, credit: "NASA/JPL-Caltech/USGS — Viking Orbiters" },
  molaShade: { id: "Mars_MGS_MOLA_ClrShade_merge_global_463m", label: "MGS MOLA colour shaded relief (463 m/px)", maxNativeZoom: 6, credit: "NASA/JPL-Caltech/GSFC — MGS MOLA" },
} as const;
export type TrekLayerKey = keyof typeof TREK_LAYERS;

const TREK_BASE = "https://trek.nasa.gov/tiles/Mars/EQ";

/** WMTS tile URL (equirectangular: 2^(z+1) columns × 2^z rows). */
export function trekTileUrl(layer: TrekLayerKey, z: number, row: number, col: number): string {
  return `${TREK_BASE}/${TREK_LAYERS[layer].id}/1.0.0/default/default028mm/${z}/${row}/${col}.jpg`;
}

/** Tile (row, column) containing a point at zoom z in Trek's equirectangular tiling (origin 90°N, 180°W). */
export function trekTileIndex(z: number, lat: number, lon: number): { row: number; col: number } {
  return { row: Math.floor(((90 - lat) / 180) * 2 ** z), col: Math.floor(((lon + 180) / 360) * 2 ** (z + 1)) };
}

/** HiRISE Curiosity roving-site mosaic on Trek (PNG tiles to zoom 16), used by the boxwork Marswalk. */
export const HIRISE_GALE = { id: "curiosity_hirise_mosaic", probe: { lat: -4.8057, lon: 137.3802 } } as const;

/** Leaflet template ({y} = row, {x} = column). */
export function trekTemplate(layer: TrekLayerKey): string {
  return `${TREK_BASE}/${TREK_LAYERS[layer].id}/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`;
}

/** Local copy written by `npm run data:fetch` (zoom 0–3), used when Trek is unreachable. */
export function trekSnapshotTemplate(layer: TrekLayerKey): string {
  return `/data/nasa/trek/${layer}/{z}/{y}/{x}.jpg`;
}

/** Load an image (CORS-enabled) for texture compositing. */
export function loadImage(url: string, timeoutMs = 15000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => reject(new Error(`timed out loading ${url}`)), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`could not load ${new URL(url, window.location.href).pathname}`));
    };
    img.src = url;
  });
}

/** Equirectangular texture for the 3D globe from Trek tiles at zoom z (live → snapshot). */
export async function trekGlobeTexture(layer: TrekLayerKey, z = 2): Promise<{ canvas: HTMLCanvasElement; origin: Origin }> {
  const cols = 2 ** (z + 1);
  const rows = 2 ** z;
  const attempt = async (template: (r: number, c: number) => string) => {
    const canvas = document.createElement("canvas");
    canvas.width = cols * 256;
    canvas.height = rows * 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    const jobs: Array<Promise<void>> = [];
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) jobs.push(loadImage(template(r, c)).then((img) => ctx.drawImage(img, c * 256, r * 256, 256, 256)));
    await Promise.all(jobs);
    return canvas;
  };
  const result = await firstAvailable<HTMLCanvasElement, Origin>([
    { origin: "live", load: () => attempt((r, c) => trekTileUrl(layer, z, r, c)) },
    { origin: "snapshot", load: () => attempt((r, c) => trekSnapshotTemplate(layer).replace("{z}", String(z)).replace("{y}", String(r)).replace("{x}", String(c))) },
  ]);
  return { canvas: result.value, origin: result.origin };
}

/* ----------------------------- MOLA MEGDR ------------------------------- */

export const MOLA_SNAPSHOT = "/data/nasa/mola/megt90n000cb_int16le.bin";
let molaPromise: Promise<{ grid: TerrainGrid; origin: Origin }> | null = null;

/** MOLA 4 px/deg grid: local snapshot first (fast, offline), then the PDS proxy. */
export function loadMolaGrid(): Promise<{ grid: TerrainGrid; origin: Origin }> {
  if (!molaPromise) {
    molaPromise = firstAvailable<Int16Array, Origin>([
      { origin: "snapshot", load: async () => int16FromLittleEndian(await fetchArrayBuffer(MOLA_SNAPSHOT, { timeoutMs: 20000 })) },
      { origin: "proxy", load: async () => megdrToInt16(await fetchArrayBuffer("/api/nasa/mola", { timeoutMs: 60000 })) },
    ])
      .then(({ value, origin }) => ({ grid: createGrid(value, 1440, 720, "MGS MOLA MEGDR MEGT90N000CB (PDS)"), origin }))
      .catch((error) => {
        molaPromise = null;
        throw error;
      });
  }
  return molaPromise;
}

/* ----------------------------- REMS weather ----------------------------- */

export const REMS_URL = "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json";
export const REMS_SNAPSHOT = "/data/nasa/rems/msl_rems_weather.json";

export async function loadRems(): Promise<{ snapshot: RemsSnapshot; origin: Origin }> {
  const now = new Date().toISOString();
  const result = await firstAvailable<RemsSnapshot, Origin>([
    { origin: "live", load: async () => trimRems(await fetchJson(REMS_URL, { timeoutMs: 12000 }), REMS_URL, now) },
    { origin: "proxy", load: () => fetchJson<RemsSnapshot>("/api/nasa/rems", { timeoutMs: 20000 }) },
    { origin: "snapshot", load: () => fetchJson<RemsSnapshot>(REMS_SNAPSHOT) },
  ]);
  if (!result.value.count || !latestValidSol(result.value)) throw new Error(`REMS feed returned no complete sols (${result.origin})`);
  return { snapshot: result.value, origin: result.origin };
}

/* ----------------------------- Traverses -------------------------------- */

export const TRAVERSES = {
  m20: { label: "Perseverance (Mars 2020)", url: "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json", color: "#38bdf8" },
  msl: { label: "Curiosity (MSL)", url: "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json", color: "#a78bfa" },
} as const;
export type TraverseId = keyof typeof TRAVERSES;

export async function loadTraverse(id: TraverseId): Promise<{ lines: TraverseLine[]; origin: Origin; latestSol: number | null }> {
  const result = await firstAvailable<TraverseLine[], Origin>([
    { origin: "live", load: async () => parseTraverse(await fetchJson(TRAVERSES[id].url, { timeoutMs: 20000 })) },
    { origin: "snapshot", load: () => fetchJson<TraverseLine[]>(`/data/nasa/traverses/${id}.json`) },
  ]);
  if (!result.value.length) throw new Error("traverse contained no lines");
  const sols = result.value.map((line) => line.sol ?? -1);
  return { lines: result.value, origin: result.origin, latestSol: Math.max(...sols) >= 0 ? Math.max(...sols) : null };
}

/* ----------------------------- DONKI SEP -------------------------------- */

export async function loadSepEpisodes(): Promise<{ episodes: DonkiEpisode[]; origin: Origin; period: string }> {
  try {
    const result = await firstAvailable<{ episodes: DonkiEpisode[]; period: string }, Origin>([
      { origin: "proxy", load: () => fetchJson("/api/nasa/donki", { timeoutMs: 25000 }) },
      { origin: "snapshot", load: async () => ({ episodes: donkiEpisodes(await fetchJson("/data/nasa/donki/sep.json")), period: "snapshot" }) },
    ]);
    if (!result.value.episodes.length) throw new Error("no SEP episodes");
    return { ...result.value, origin: result.origin };
  } catch {
    // DONKI 2024 episodes already bundled with the original Sol-by-Sol simulator (real records).
    return { episodes: DONKI_2024_EPISODES.map(([dayOfYear, tier]) => ({ dayOfYear, tier, time: "2024" })), origin: "bundled", period: "2024-01-01 → 2024-12-31" };
  }
}

/* ----------------------------- NASA Images ------------------------------ */

export interface NasaImage {
  nasaId: string;
  title: string;
  description: string;
  date: string;
  center: string;
  thumb: string;
  page: string;
}

export async function searchNasaImages(query: string, limit = 8): Promise<NasaImage[]> {
  const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=${limit}`;
  const data = await fetchJson<{ collection?: { items?: Array<{ data?: Array<Record<string, string>>; links?: Array<{ href: string; rel?: string }> }> } }>(url, { timeoutMs: 15000 });
  return (data.collection?.items ?? [])
    .map((item) => {
      const meta = item.data?.[0] ?? {};
      const thumb = item.links?.find((link) => link.rel === "preview")?.href ?? item.links?.[0]?.href ?? "";
      return {
        nasaId: meta["nasa_id"] ?? "",
        title: meta["title"] ?? "Untitled",
        description: (meta["description"] ?? "").slice(0, 280),
        date: (meta["date_created"] ?? "").slice(0, 10),
        center: meta["center"] ?? "NASA",
        thumb,
        page: meta["nasa_id"] ? `https://images.nasa.gov/details/${encodeURIComponent(meta["nasa_id"])}` : "https://images.nasa.gov/",
      };
    })
    .filter((image) => image.nasaId && image.thumb)
    .slice(0, limit);
}

/* ----------------------------- Health checks ---------------------------- */

export type LinkState = "online" | "fallback" | "offline";

export interface SourceHealth {
  id: string;
  state: LinkState;
  origin: Origin | null;
  detail: string;
  latencyMs: number | null;
  checkedAt: string;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t) };
}

/** Real reachability checks — each one performs the request the platform depends on. */
export const HEALTH_CHECKS: Record<string, () => Promise<Omit<SourceHealth, "id" | "checkedAt">>> = {
  trek: async () => {
    try {
      const { ms } = await timed(() => loadImage(trekTileUrl("viking", 0, 0, 0), 10000));
      return { state: "online", origin: "live", detail: "WMTS tile 0/0/0 loaded", latencyMs: ms };
    } catch {
      try {
        await loadImage(trekSnapshotTemplate("viking").replace("{z}", "0").replace("{y}", "0").replace("{x}", "0"), 5000);
        return { state: "fallback", origin: "snapshot", detail: "Trek unreachable — using saved tiles", latencyMs: null };
      } catch {
        return { state: "offline", origin: null, detail: "Trek unreachable and no saved tiles", latencyMs: null };
      }
    }
  },
  hirise: async () => {
    const { row, col } = trekTileIndex(12, HIRISE_GALE.probe.lat, HIRISE_GALE.probe.lon);
    try {
      const { ms } = await timed(() => loadImage(`${TREK_BASE}/${HIRISE_GALE.id}/1.0.0/default/default028mm/12/${row}/${col}.png`, 10000));
      return { state: "online", origin: "live", detail: `HiRISE tile 12/${row}/${col} over the boxwork loaded`, latencyMs: ms };
    } catch {
      return { state: "offline", origin: null, detail: "Trek HiRISE tiles unreachable", latencyMs: null };
    }
  },
  mola: async () => {
    try {
      const { value, ms } = await timed(loadMolaGrid);
      return { state: value.origin === "snapshot" ? "online" : "online", origin: value.origin, detail: `Grid ${value.grid.width}×${value.grid.height} loaded (${value.origin})`, latencyMs: ms };
    } catch (error) {
      return { state: "offline", origin: null, detail: (error as Error).message, latencyMs: null };
    }
  },
  rems: async () => {
    try {
      const { value, ms } = await timed(loadRems);
      const latest = latestValidSol(value.snapshot);
      return { state: value.origin === "snapshot" ? "fallback" : "online", origin: value.origin, detail: `${value.snapshot.count} sols · latest complete sol ${latest?.sol ?? "—"}`, latencyMs: ms };
    } catch (error) {
      return { state: "offline", origin: null, detail: (error as Error).message, latencyMs: null };
    }
  },
  traverses: async () => {
    try {
      const { value, ms } = await timed(() => loadTraverse("m20"));
      return { state: value.origin === "snapshot" ? "fallback" : "online", origin: value.origin, detail: `${value.lines.length} drive segments · latest sol ${value.latestSol ?? "—"}`, latencyMs: ms };
    } catch (error) {
      return { state: "offline", origin: null, detail: (error as Error).message, latencyMs: null };
    }
  },
  donki: async () => {
    const { value, ms } = await timed(loadSepEpisodes);
    return { state: value.origin === "bundled" ? "fallback" : "online", origin: value.origin, detail: `${value.episodes.length} SEP episodes (${value.period})`, latencyMs: ms };
  },
  imagery: async () => {
    try {
      const { value, ms } = await timed(() => searchNasaImages("Jezero crater", 1));
      return { state: value.length ? "online" : "offline", origin: "live", detail: value.length ? "Search API responded" : "No results", latencyMs: ms };
    } catch (error) {
      return { state: "offline", origin: null, detail: (error as Error).message, latencyMs: null };
    }
  },
  accessMars: async () => {
    try {
      const { ms } = await timed(() => fetchWithTimeout("/eva/gale/landing_site/terrain.glb", { method: "HEAD", timeoutMs: 8000 }));
      return { state: "online", origin: "bundled", detail: "Terrain assets bundled with the app", latencyMs: ms };
    } catch (error) {
      return { state: "offline", origin: null, detail: (error as Error).message, latencyMs: null };
    }
  },
};

export async function checkSource(id: string): Promise<SourceHealth> {
  const check = HEALTH_CHECKS[id];
  const checkedAt = new Date().toISOString();
  if (!check) return { id, state: "offline", origin: null, detail: "Not integrated", latencyMs: null, checkedAt };
  try {
    return { id, ...(await check()), checkedAt };
  } catch (error) {
    return { id, state: "offline", origin: null, detail: (error as Error).message, latencyMs: null, checkedAt };
  }
}
