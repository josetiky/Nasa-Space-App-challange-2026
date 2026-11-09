import type { DataType } from "@/core/types";

export type LayerId = "elevation" | "slope" | "temperature" | "radiation" | "dust" | "waterIce" | "resources" | "landing" | "hazards" | "routes";

export type Legend =
  | { kind: "gradient"; min: number; max: number; stops: Array<[number, string]>; format?: (v: number) => string }
  | { kind: "categories"; items: Array<{ label: string; color: string }> };

export interface LayerSpec {
  id: LayerId;
  title: string;
  unit: string;
  dataType: DataType;
  source: string;
  period: string;
  resolution: string;
  description: string;
  legend: Legend;
  defaultOn: boolean;
  defaultOpacity: number;
  render: "raster" | "vector";
}

export const ELEVATION_STOPS: Array<[number, string]> = [
  [-8000, "#1d2b6b"],
  [-5000, "#2563c9"],
  [-3000, "#22a6b3"],
  [-1000, "#55b85c"],
  [1000, "#d6c64a"],
  [3000, "#e08a2c"],
  [6000, "#c0392b"],
  [12000, "#8e5a4e"],
  [21000, "#f5f0eb"],
];

export const LAYERS: LayerSpec[] = [
  {
    id: "elevation",
    title: "Elevation & topography",
    unit: "m (areoid)",
    dataType: "REAL",
    source: "MGS MOLA MEGDR (MEGT90N000CB), NASA PDS Geosciences Node",
    period: "MOLA mapping 1997-09 → 2001-06",
    resolution: "4 px/deg (≈ 14.8 km at the equator)",
    description: "Median MOLA altimetry per 0.25° cell, metres above the areoid.",
    legend: { kind: "gradient", min: -8000, max: 21000, stops: ELEVATION_STOPS },
    defaultOn: true,
    defaultOpacity: 0.65,
    render: "raster",
  },
  {
    id: "slope",
    title: "Terrain slope",
    unit: "degrees",
    dataType: "DERIVED",
    source: "Computed from the MOLA MEGDR grid (central differences)",
    period: "Derived from 1997–2001 data",
    resolution: "≈ 30 km baseline — regional, not EVA scale",
    description: "Regional slope. EVA-scale slopes come from the Access Mars terrain in the Explorer.",
    legend: { kind: "gradient", min: 0, max: 4, stops: [[0, "#1f3b2c"], [0.5, "#3f9d5a"], [1.5, "#d6c64a"], [2.5, "#e08a2c"], [4, "#c0392b"]] },
    defaultOn: false,
    defaultOpacity: 0.7,
    render: "raster",
  },
  {
    id: "temperature",
    title: "Surface air temperature",
    unit: "°C (annual mean)",
    dataType: "MODELLED",
    source: "Insolation-driven empirical model, REMS-calibrated (Gale) — see SIMULATION_MODEL.md",
    period: "Climatology over one Mars year",
    resolution: "Model evaluated per grid cell (1 px/deg render)",
    description: "Annual-mean near-surface temperature from latitude, season and elevation. Not a measurement.",
    legend: { kind: "gradient", min: -110, max: -40, stops: [[-110, "#1d2b6b"], [-90, "#2563c9"], [-75, "#22a6b3"], [-62, "#d6c64a"], [-50, "#e08a2c"], [-40, "#c0392b"]] },
    defaultOn: false,
    defaultOpacity: 0.6,
    render: "raster",
  },
  {
    id: "radiation",
    title: "Radiation (GCR dose)",
    unit: "mSv/sol",
    dataType: "MODELLED",
    source: "MSL-RAD baseline 0.64 mSv/day (Hassler et al. 2014) scaled by atmospheric column from MOLA",
    period: "Solar maximum conditions of 2012–2013",
    resolution: "Model per grid cell",
    description: "Galactic cosmic-ray dose equivalent at the surface; thicker atmosphere (lower elevation) shields more.",
    legend: { kind: "gradient", min: 0.5, max: 1.1, stops: [[0.5, "#1f3b2c"], [0.62, "#3f9d5a"], [0.72, "#d6c64a"], [0.85, "#e08a2c"], [1.1, "#c0392b"]] },
    defaultOn: false,
    defaultOpacity: 0.6,
    render: "raster",
  },
  {
    id: "dust",
    title: "Dust storms",
    unit: "activity index 0–1",
    dataType: "DERIVED",
    source: "Storm tracks reported by Wang & Richardson (2015) and the Mars Dust Activity Database (Battalio & Wang 2021)",
    period: "Mars years 24–32 (literature)",
    resolution: "Qualitative zones (~1000 km)",
    description: "Where regional storms are commonly reported to start or travel. Qualitative proxy, not a forecast.",
    legend: { kind: "gradient", min: 0, max: 1, stops: [[0, "rgba(0,0,0,0)"], [0.3, "#d6c64a"], [0.6, "#e08a2c"], [1, "#c0392b"]] },
    defaultOn: false,
    defaultOpacity: 0.55,
    render: "raster",
  },
  {
    id: "waterIce",
    title: "Water ice",
    unit: "likelihood 0–1",
    dataType: "DERIVED",
    source: "Ground-ice stability latitude + radar/SWIM ice regions (Bramson 2015, Stuurman 2016, Morgan 2021)",
    period: "Literature 2009–2021",
    resolution: "Qualitative (latitude band + ~500–900 km regions)",
    description: "Where shallow ground ice is likely. Qualitative proxy; confirm with SHARAD/SWIM products.",
    legend: { kind: "gradient", min: 0, max: 1, stops: [[0, "rgba(0,0,0,0)"], [0.3, "#22a6b3"], [0.6, "#7fd3f0"], [1, "#f5fbff"]] },
    defaultOn: false,
    defaultOpacity: 0.55,
    render: "raster",
  },
  {
    id: "resources",
    title: "Potential resources",
    unit: "documented detections",
    dataType: "REAL",
    source: "Orbital/in-situ mineral and ice detections (CRISM, OMEGA, rovers, Phoenix) — references per point",
    period: "1997–2021 missions",
    resolution: "Point locations",
    description: "Clays, carbonates, sulfates, silica and ice reported in the literature; each marker cites its source.",
    legend: { kind: "categories", items: [{ label: "Minerals (clays, carbonates, sulfates, silica)", color: "#e0a23a" }, { label: "Water ice detection", color: "#7fd3f0" }, { label: "Hazard (seismic source)", color: "#e8594a" }] },
    defaultOn: true,
    defaultOpacity: 1,
    render: "vector",
  },
  {
    id: "landing",
    title: "Landing zones",
    unit: "historical landers",
    dataType: "REAL",
    source: "Published landing coordinates (NASA, CNSA mission records)",
    period: "1976–2021",
    resolution: "Point locations",
    description: "Every successful lander, as reference for proven entry, descent and landing conditions.",
    legend: { kind: "categories", items: [{ label: "Successful landing site", color: "#f4f1ea" }, { label: "Selected mission site", color: "#f59e0b" }] },
    defaultOn: true,
    defaultOpacity: 1,
    render: "vector",
  },
  {
    id: "hazards",
    title: "Geological hazards",
    unit: "hazard index 0–1",
    dataType: "DERIVED",
    source: "Composite of MOLA slope, local relief and elevation (EDL) — formula in SIMULATION_MODEL.md",
    period: "Derived from 1997–2001 data",
    resolution: "4 px/deg",
    description: "Steep, rugged or very high terrain flagged for landing and traverse planning.",
    legend: { kind: "gradient", min: 0, max: 1, stops: [[0, "rgba(0,0,0,0)"], [0.35, "#d6c64a"], [0.65, "#e08a2c"], [1, "#c0392b"]] },
    defaultOn: false,
    defaultOpacity: 0.6,
    render: "raster",
  },
  {
    id: "routes",
    title: "Exploration routes",
    unit: "traverses",
    dataType: "REAL",
    source: "Curiosity & Perseverance traverses (NASA/JPL MMGIS) + your planned mission legs",
    period: "2012 → present (traverse snapshot date shown in NASA Data)",
    resolution: "Rover localisation (metres)",
    description: "Real rover drives and the great-circle legs of your plan (planned legs are SIMULATED intent, not drives).",
    legend: { kind: "categories", items: [{ label: "Perseverance traverse", color: "#38bdf8" }, { label: "Curiosity traverse", color: "#a78bfa" }, { label: "Planned mission legs", color: "#f59e0b" }] },
    defaultOn: true,
    defaultOpacity: 1,
    render: "vector",
  },
];

export function layerSpec(id: LayerId): LayerSpec {
  return LAYERS.find((layer) => layer.id === id)!;
}

/** Linear interpolation in a gradient legend → [r, g, b, a] 0–255. */
export function colorAt(stops: Array<[number, string]>, value: number): [number, number, number, number] {
  const parse = (color: string): [number, number, number, number] => {
    if (color.startsWith("#")) {
      const n = parseInt(color.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    }
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const parts = m[1]!.split(",").map((p) => parseFloat(p));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, Math.round((parts[3] ?? 1) * 255)];
  };
  if (value <= stops[0]![0]) return parse(stops[0]![1]);
  for (let i = 1; i < stops.length; i += 1) {
    const [v1, c1] = stops[i]!;
    const [v0, c0] = stops[i - 1]!;
    if (value <= v1) {
      const t = (value - v0) / (v1 - v0 || 1);
      const a = parse(c0);
      const b = parse(c1);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
    }
  }
  return parse(stops[stops.length - 1]![1]);
}
