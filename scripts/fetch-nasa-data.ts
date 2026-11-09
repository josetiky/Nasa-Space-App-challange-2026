/**
 * Download offline snapshots of every NASA source the platform integrates into
 * public/data/nasa/, so the app keeps working without network access.
 *
 *   npm run data:fetch                 # MOLA, REMS, traverses, DONKI, Trek zoom 0–2
 *   npm run data:fetch -- --trek-zoom=3 --only=mola,rems
 *
 * Optional: NASA_API_KEY=… (api.nasa.gov key for DONKI; DEMO_KEY otherwise).
 * Transforms are shared with the app (src/services/nasa/transform.ts, unit-tested).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { donkiEpisodes, int16ToLittleEndian, megdrToInt16, parseTraverse, trimRems } from "../src/services/nasa/transform.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "data", "nasa");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const only = args["only"] ? new Set(String(args["only"]).split(",")) : null;
const trekZoom = Math.min(4, Math.max(0, Number(args["trek-zoom"] ?? 2)));
const want = (id: string) => !only || only.has(id);

const SOURCES = {
  molaImg: "https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg004/megt90n000cb.img",
  molaLbl: "https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg004/megt90n000cb.lbl",
  rems: "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json",
  m20: "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json",
  msl: "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json",
  trek: {
    viking: "Mars_Viking_MDIM21_ClrMosaic_global_232m",
    molaShade: "Mars_MGS_MOLA_ClrShade_merge_global_463m",
  },
};

async function get(url: string, timeoutMs = 60000): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "mars-survive-data-fetch" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response;
}

async function save(relative: string, data: string | ArrayBuffer | Uint8Array) {
  const path = join(OUT, relative);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof data === "string" ? data : new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer));
  return path;
}

type Entry = { id: string; ok: boolean; files: string[]; source: string; detail: string };
const manifest: { generatedAt: string; entries: Entry[] } = { generatedAt: new Date().toISOString(), entries: [] };

async function step(id: string, source: string, run: () => Promise<{ files: string[]; detail: string }>) {
  if (!want(id)) return;
  process.stdout.write(`• ${id.padEnd(10)} `);
  try {
    const { files, detail } = await run();
    manifest.entries.push({ id, ok: true, files, source, detail });
    console.log(`ok — ${detail}`);
  } catch (error) {
    manifest.entries.push({ id, ok: false, files: [], source, detail: (error as Error).message });
    console.log(`FAILED — ${(error as Error).message}`);
  }
}

await step("mola", SOURCES.molaImg, async () => {
  const grid = megdrToInt16(await (await get(SOURCES.molaImg, 120000)).arrayBuffer());
  let min = Infinity;
  let max = -Infinity;
  for (const v of grid) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const label = await (await get(SOURCES.molaLbl)).text();
  await save("mola/megt90n000cb_int16le.bin", int16ToLittleEndian(grid));
  await save("mola/megt90n000cb.lbl", label);
  return { files: ["mola/megt90n000cb_int16le.bin", "mola/megt90n000cb.lbl"], detail: `1440×720 int16, ${min} → ${max} m` };
});

await step("rems", SOURCES.rems, async () => {
  const snapshot = trimRems(await (await get(SOURCES.rems)).json(), SOURCES.rems, new Date().toISOString());
  if (!snapshot.count) throw new Error("feed had no sols");
  await save("rems/msl_rems_weather.json", JSON.stringify(snapshot));
  return { files: ["rems/msl_rems_weather.json"], detail: `${snapshot.count} sols (latest ${snapshot.soles[snapshot.soles.length - 1]?.sol})` };
});

for (const id of ["m20", "msl"] as const) {
  await step(`traverse-${id}`, SOURCES[id], async () => {
    const lines = parseTraverse(await (await get(SOURCES[id])).json());
    if (!lines.length) throw new Error("no traverse lines");
    await save(`traverses/${id}.json`, JSON.stringify(lines));
    return { files: [`traverses/${id}.json`], detail: `${lines.length} lines, ${lines.reduce((n, l) => n + l.coordinates.length, 0)} vertices` };
  });
}

await step("donki", "https://api.nasa.gov/DONKI/SEP", async () => {
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 864e5);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const key = process.env["NASA_API_KEY"] || "DEMO_KEY";
  const raw = await (await get(`https://api.nasa.gov/DONKI/SEP?startDate=${day(start)}&endDate=${day(end)}&api_key=${encodeURIComponent(key)}`)).json();
  if (!Array.isArray(raw)) throw new Error("unexpected DONKI response");
  await save("donki/sep.json", JSON.stringify(raw));
  return { files: ["donki/sep.json"], detail: `${raw.length} records → ${donkiEpisodes(raw).length} episodes (${day(start)} → ${day(end)})` };
});

for (const [key, layer] of Object.entries(SOURCES.trek)) {
  await step(`trek-${key}`, `https://trek.nasa.gov/tiles/Mars/EQ/${layer}`, async () => {
    const files: string[] = [];
    for (let z = 0; z <= trekZoom; z += 1) {
      for (let row = 0; row < 2 ** z; row += 1) {
        for (let col = 0; col < 2 ** (z + 1); col += 1) {
          const url = `https://trek.nasa.gov/tiles/Mars/EQ/${layer}/1.0.0/default/default028mm/${z}/${row}/${col}.jpg`;
          files.push(await save(`trek/${key}/${z}/${row}/${col}.jpg`, await (await get(url)).arrayBuffer()).then(() => `trek/${key}/${z}/${row}/${col}.jpg`));
        }
      }
    }
    return { files: [`trek/${key}/`], detail: `${files.length} tiles, zoom 0–${trekZoom}` };
  });
}

await save("manifest.json", JSON.stringify(manifest, null, 2));
const failed = manifest.entries.filter((e) => !e.ok);
console.log(`\nSaved to public/data/nasa/ — ${manifest.entries.length - failed.length} ok, ${failed.length} failed.`);
if (failed.length) process.exitCode = 1;
