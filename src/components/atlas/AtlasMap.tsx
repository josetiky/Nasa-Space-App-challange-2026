import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { greatCirclePoints } from "@/core/science/geo";
import { LANDING_SITES, SCIENCE_TARGETS } from "@/core/science/regions";
import type { TerrainGrid } from "@/core/science/terrain";
import type { GeoPoint } from "@/core/types";
import { LAYERS, type LayerId } from "@/data/layers";
import { CATALOGUE_SITES } from "@/data/sites";
import { TRAVERSES, TREK_LAYERS, trekSnapshotTemplate, trekTemplate, type TrekLayerKey } from "@/services/nasa/adapters";
import { useTraverse } from "@/services/nasa/hooks";
import { layerImage } from "./rasterImage";

export interface LayerState {
  on: boolean;
  opacity: number;
}

interface Props {
  basemap: TrekLayerKey;
  layers: Record<LayerId, LayerState>;
  grid: TerrainGrid | null;
  selected: GeoPoint | null;
  probe: GeoPoint | null;
  traverse: GeoPoint[];
  focus: GeoPoint | null;
  onPick: (point: GeoPoint) => void;
  onBasemapStatus: (status: "live" | "snapshot" | "offline") => void;
  onLayerStatus: (id: LayerId, status: string | null) => void;
}

const WORLD: [[number, number], [number, number]] = [
  [-90, -180],
  [90, 180],
];
const KIND_COLOR = { mineral: "#e0a23a", ice: "#7fd3f0", hazard: "#e8594a" } as const;

export default function AtlasMap({ basemap, layers, grid, selected, probe, traverse, focus, onPick, onBasemapStatus, onLayerStatus }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const base = useRef<Leaflet.TileLayer | null>(null);
  const overlays = useRef(new Map<string, Leaflet.Layer>());
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [ready, setReady] = useState(false);

  const m20 = useTraverse("m20", layers.routes.on);
  const msl = useTraverse("msl", layers.routes.on);

  // Create the map once (Leaflet touches `window`, so it is imported on the client only).
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      if (cancelled || !el.current || map.current) return;
      const lib = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      L.current = lib;
      const m = lib.map(el.current, {
        crs: lib.CRS.EPSG4326,
        center: [10, 60],
        zoom: 1,
        minZoom: 0,
        maxZoom: 8,
        maxBounds: [
          [-100, -200],
          [100, 200],
        ],
        maxBoundsViscosity: 0.8,
        worldCopyJump: false,
        zoomSnap: 0.5,
      });
      m.attributionControl.setPrefix("Leaflet");
      m.on("click", (event: Leaflet.LeafletMouseEvent) => pickRef.current({ lat: Math.max(-90, Math.min(90, event.latlng.lat)), lon: ((((event.latlng.lng + 180) % 360) + 360) % 360) - 180 }));
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      overlays.current.clear();
    };
  }, []);

  // Basemap: NASA Trek WMTS (live), falling back to tiles saved by `npm run data:fetch`.
  useEffect(() => {
    const lib = L.current;
    const m = map.current;
    if (!ready || !lib || !m) return;
    base.current?.remove();
    const spec = TREK_LAYERS[basemap];
    let loaded = 0;
    let errors = 0;
    let usingSnapshot = false;
    const layer = lib.tileLayer(trekTemplate(basemap), {
      tileSize: 256,
      noWrap: true,
      bounds: WORLD,
      maxNativeZoom: spec.maxNativeZoom,
      maxZoom: 8,
      attribution: `${spec.label} · ${spec.credit} · <a href="https://trek.nasa.gov/mars/" target="_blank" rel="noreferrer">NASA Mars Trek</a>`,
    });
    layer.on("tileload", () => {
      loaded += 1;
      onBasemapStatus(usingSnapshot ? "snapshot" : "live");
    });
    layer.on("tileerror", () => {
      errors += 1;
      if (!usingSnapshot && loaded === 0 && errors >= 3) {
        usingSnapshot = true;
        errors = 0;
        layer.setUrl(trekSnapshotTemplate(basemap));
        layer.options.maxNativeZoom = 3;
      } else if (usingSnapshot && loaded === 0 && errors >= 3) onBasemapStatus("offline");
    });
    layer.addTo(m);
    layer.bringToBack();
    base.current = layer;
  }, [ready, basemap, onBasemapStatus]);

  // Raster layers computed from the MOLA grid and documented models.
  useEffect(() => {
    const lib = L.current;
    const m = map.current;
    if (!ready || !lib || !m) return;
    for (const spec of LAYERS) {
      if (spec.render !== "raster") continue;
      const key = `raster:${spec.id}`;
      const state = layers[spec.id];
      const existing = overlays.current.get(key) as (Leaflet.ImageOverlay & { _gridKey?: string }) | undefined;
      const gridKey = grid ? grid.source : "none";
      if (!state.on) {
        existing?.remove();
        overlays.current.delete(key);
        continue;
      }
      if (existing && existing._gridKey === gridKey) {
        existing.setOpacity(state.opacity);
        continue;
      }
      existing?.remove();
      const image = layerImage(spec.id, grid);
      if ("unavailable" in image) {
        onLayerStatus(spec.id, image.unavailable);
        overlays.current.delete(key);
        continue;
      }
      onLayerStatus(spec.id, null);
      const overlay = lib.imageOverlay(image.url, WORLD, { opacity: state.opacity, className: spec.id === "dust" || spec.id === "waterIce" ? "" : "mc-pixelated", interactive: false }) as Leaflet.ImageOverlay & { _gridKey?: string };
      overlay._gridKey = gridKey;
      overlay.addTo(m);
      overlays.current.set(key, overlay);
    }
  }, [ready, layers, grid, onLayerStatus]);

  // Vector layers: documented resources, landing sites, traverses and the user's plan.
  useEffect(() => {
    const lib = L.current;
    const m = map.current;
    if (!ready || !lib || !m) return;
    const replace = (key: string, build: () => Leaflet.Layer | null) => {
      overlays.current.get(key)?.remove();
      overlays.current.delete(key);
      const layer = build();
      if (layer) {
        layer.addTo(m);
        overlays.current.set(key, layer);
      }
    };
    replace("vector:resources", () =>
      layers.resources.on
        ? lib.layerGroup(
            SCIENCE_TARGETS.map((t) =>
              lib
                .circleMarker([t.point.lat, t.point.lon], { radius: 6, color: KIND_COLOR[t.kind], weight: 2, fillOpacity: 0.35 * layers.resources.opacity, opacity: layers.resources.opacity })
                .bindTooltip(`<b>${t.name}</b><br/>${t.detail}<br/><span style="opacity:.7">${t.reference}</span>`),
            ),
          )
        : null,
    );
    replace("vector:landing", () =>
      layers.landing.on
        ? lib.layerGroup([
            ...LANDING_SITES.map((s) =>
              lib.circleMarker([s.point.lat, s.point.lon], { radius: 4, color: "#f4f1ea", weight: 1.5, fillColor: "#f4f1ea", fillOpacity: 0.85, opacity: layers.landing.opacity }).bindTooltip(`<b>${s.mission}</b> (${s.agency}, ${s.year})<br/>${s.region}`),
            ),
            ...CATALOGUE_SITES.map((s) => lib.circleMarker([s.point.lat, s.point.lon], { radius: 2.5, color: "#f59e0b", weight: 1, fillOpacity: 0.6, opacity: 0.8 }).bindTooltip(s.name)),
          ])
        : null,
    );
    const lines: Leaflet.Layer[] = [];
    if (layers.routes.on) {
      for (const [id, q] of [
        ["m20", m20.data],
        ["msl", msl.data],
      ] as const) {
        if (!q) continue;
        const color = TRAVERSES[id].color;
        lines.push(lib.polyline(q.lines.map((line) => line.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])), { color, weight: 2.5, opacity: layers.routes.opacity }).bindTooltip(`${TRAVERSES[id].label} traverse · ${q.origin} · latest sol ${q.latestSol ?? "—"}`));
      }
      for (let i = 1; i < traverse.length; i += 1) {
        const leg = greatCirclePoints(traverse[i - 1]!, traverse[i]!, 48).map((p) => [p.lat, p.lon] as [number, number]);
        lines.push(lib.polyline(leg, { color: "#f59e0b", weight: 2, dashArray: "6 5", opacity: layers.routes.opacity }).bindTooltip(`Planned leg ${i} (simulated intent)`));
      }
      traverse.forEach((p, i) => lines.push(lib.circleMarker([p.lat, p.lon], { radius: 4, color: "#f59e0b", fillOpacity: 1 }).bindTooltip(`Waypoint ${i + 1}`)));
    }
    replace("vector:routes", () => (lines.length ? lib.layerGroup(lines) : null));
  }, [ready, layers.resources, layers.landing, layers.routes, m20.data, msl.data, traverse]);

  // Selected mission site and the probe (clicked location).
  useEffect(() => {
    const lib = L.current;
    const m = map.current;
    if (!ready || !lib || !m) return;
    overlays.current.get("marker:selected")?.remove();
    overlays.current.get("marker:probe")?.remove();
    if (selected) {
      const marker = lib.circleMarker([selected.lat, selected.lon], { radius: 9, color: "#f59e0b", weight: 3, fillOpacity: 0.15 }).bindTooltip("Mission site");
      marker.addTo(m);
      overlays.current.set("marker:selected", marker);
    }
    if (probe && (!selected || probe.lat !== selected.lat || probe.lon !== selected.lon)) {
      const marker = lib.circleMarker([probe.lat, probe.lon], { radius: 6, color: "#38bdf8", weight: 2, fillOpacity: 0.2, dashArray: "3 3" }).bindTooltip("Probe");
      marker.addTo(m);
      overlays.current.set("marker:probe", marker);
    }
  }, [ready, selected, probe]);

  useEffect(() => {
    if (ready && focus && map.current) map.current.flyTo([focus.lat, focus.lon], Math.max(map.current.getZoom(), 3), { duration: 0.8 });
  }, [ready, focus]);

  return <div ref={el} className="mc-map h-full w-full" role="application" aria-label="Survival Atlas map of Mars (click to analyse a location)" />;
}
