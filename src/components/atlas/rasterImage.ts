/** Browser-only: raster layer field → PNG data URL (cached per layer and grid). */
import type { TerrainGrid } from "@/core/science/terrain";
import { layerSpec, type LayerId } from "@/data/layers";
import { buildLayerField, colorizeField, fieldStats } from "@/services/atlas/rasters";

const cache = new Map<string, { url: string; min: number; max: number } | { unavailable: string }>();

/** Smooth literature proxies are rendered at 0.5 px/deg; MOLA-based layers at 2 px/deg. */
const RESOLUTION: Partial<Record<LayerId, [number, number]>> = { dust: [360, 180], waterIce: [360, 180] };

export function layerImage(id: LayerId, grid: TerrainGrid | null): { url: string; min: number; max: number } | { unavailable: string } {
  const key = `${id}:${grid ? grid.source : "none"}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [width, height] = RESOLUTION[id] ?? [720, 360];
  const field = buildLayerField(id, grid, width, height);
  if ("unavailable" in field) return field;
  const legend = layerSpec(id).legend;
  if (legend.kind !== "gradient") return { unavailable: "No gradient legend" };
  const rgba = colorizeField(field.values, legend.stops, 1);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { unavailable: "Canvas 2D unavailable" };
  const image = ctx.createImageData(width, height);
  image.data.set(rgba);
  ctx.putImageData(image, 0, 0);
  const result = { url: canvas.toDataURL("image/png"), ...fieldStats(field.values) };
  cache.set(key, result);
  return result;
}
