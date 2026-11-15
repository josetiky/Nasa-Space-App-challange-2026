/**
 * Mars Trek · Funciones puras de vista con prueba unitaria (Tarea 11, UX_UI_GUIDELINES §5):
 * - Color, forma y trama por zona Z0–Z5 (tres canales: texto + forma + color)
 * - Estilo visual por estado de salud S1–S5 y clase de confianza K1–K5
 * - Sombreado de relieve (hillshade) sobre la rejilla de elevación
 * - Segmentos de la Barra de Porqués (D, T, R, E, U, H suman 100 %)
 * - Conversión entre coordenadas métricas locales (x, z m) y planetocéntricas IAU_2015:49900 (lat, lon)
 */
import type {
  ConfidenceClass,
  CostTermId,
  HealthState,
  LocalPoint,
  ZoneClass,
} from "@/core/trek/contracts";
import { TREK_PARAMS } from "@/core/trek/params";

export type PatternKind = "none" | "diagonal" | "dots" | "crosshatch" | "vertical";

export interface ZoneVisualStyle {
  readonly zone: ZoneClass;
  readonly shapeGlyph: string;
  readonly pattern: PatternKind;
  readonly fillHex: string;
  readonly rgba: readonly [number, number, number, number];
  readonly badgeClass: string;
}

export const ZONE_VISUALS: Readonly<Record<ZoneClass, ZoneVisualStyle>> = {
  Z0: {
    zone: "Z0",
    shapeGlyph: "●",
    pattern: "none",
    fillHex: "#10b981",
    rgba: [16, 185, 129, 45],
    badgeClass: "border-mint/40 bg-mint/10 text-mint",
  },
  Z1: {
    zone: "Z1",
    shapeGlyph: "▲",
    pattern: "diagonal",
    fillHex: "#f59e0b",
    rgba: [245, 158, 11, 105],
    badgeClass: "border-amber/45 bg-amber/12 text-amber",
  },
  Z2: {
    zone: "Z2",
    shapeGlyph: "◆",
    pattern: "diagonal",
    fillHex: "#f97316",
    rgba: [249, 115, 22, 140],
    badgeClass: "border-amber/60 bg-amber/20 text-amber",
  },
  Z3: {
    zone: "Z3",
    shapeGlyph: "◌",
    pattern: "dots",
    fillHex: "#64748b",
    rgba: [100, 116, 139, 135],
    badgeClass: "border-line bg-ink2 text-fog",
  },
  Z4: {
    zone: "Z4",
    shapeGlyph: "▣",
    pattern: "vertical",
    fillHex: "#38bdf8",
    rgba: [56, 189, 248, 135],
    badgeClass: "border-cyan/45 bg-cyan/12 text-cyan",
  },
  Z5: {
    zone: "Z5",
    shapeGlyph: "■",
    pattern: "crosshatch",
    fillHex: "#f43f5e",
    rgba: [244, 63, 94, 175],
    badgeClass: "border-rose/55 bg-rose/15 text-rose",
  },
};

export function zoneVisual(zone: ZoneClass): ZoneVisualStyle {
  return ZONE_VISUALS[zone];
}

export interface HealthVisualStyle {
  readonly state: HealthState;
  readonly shapeGlyph: string;
  readonly shapeName: "circle" | "half-circle" | "triangle" | "diamond" | "full-square";
  readonly badgeClass: string;
  readonly fullWidthBanner: boolean;
}

export const HEALTH_VISUALS: Readonly<Record<HealthState, HealthVisualStyle>> = {
  NORMAL: {
    state: "NORMAL",
    shapeGlyph: "●",
    shapeName: "circle",
    badgeClass: "border-mint/45 bg-mint/12 text-mint",
    fullWidthBanner: false,
  },
  FATIGUE: {
    state: "FATIGUE",
    shapeGlyph: "◐",
    shapeName: "half-circle",
    badgeClass: "border-cyan/45 bg-cyan/12 text-cyan",
    fullWidthBanner: false,
  },
  CAUTION: {
    state: "CAUTION",
    shapeGlyph: "▲",
    shapeName: "triangle",
    badgeClass: "border-amber/50 bg-amber/15 text-amber",
    fullWidthBanner: false,
  },
  CRITICAL: {
    state: "CRITICAL",
    shapeGlyph: "◆",
    shapeName: "diamond",
    badgeClass: "border-rose/60 bg-rose/18 text-rose",
    fullWidthBanner: true,
  },
  EMERGENCY: {
    state: "EMERGENCY",
    shapeGlyph: "■",
    shapeName: "full-square",
    badgeClass: "border-rose bg-rose text-[#180609] font-bold",
    fullWidthBanner: true,
  },
};

export function healthVisual(state: HealthState): HealthVisualStyle {
  return HEALTH_VISUALS[state];
}

export interface ConfidenceVisualStyle {
  readonly cls: ConfidenceClass;
  readonly strokeStyle: "solid" | "dashed" | "dotted" | "hatched";
  readonly dashArray: string;
  readonly badgeClass: string;
}

export function confidenceVisual(cls: ConfidenceClass): ConfidenceVisualStyle {
  switch (cls) {
    case "K1":
    case "K2":
      return {
        cls,
        strokeStyle: "solid",
        dashArray: "none",
        badgeClass: "border-mint/40 bg-mint/10 text-mint",
      };
    case "K3a":
    case "K3b":
    case "K3c":
    case "K3d":
      return {
        cls,
        strokeStyle: "dashed",
        dashArray: "6,4",
        badgeClass: "border-cyan/40 bg-cyan/10 text-cyan",
      };
    case "K4":
      return {
        cls,
        strokeStyle: "dotted",
        dashArray: "2,4",
        badgeClass: "border-amber/40 bg-amber/10 text-amber",
      };
    case "K5":
      return {
        cls,
        strokeStyle: "hatched",
        dashArray: "1,5",
        badgeClass: "border-rose/40 bg-rose/10 text-rose",
      };
  }
}

/**
 * Calcula el sombreado de relieve (hillshade) en [0, 1] para la celda (i, j) de una rejilla de elevación.
 * Azimut solar 315° (NO), altitud solar 45°.
 */
export function hillshadeAt(
  elevation: Float32Array,
  nx: number,
  nz: number,
  cellM: number,
  i: number,
  j: number,
): number {
  const idx = (x: number, z: number) => z * nx + x;
  const c = elevation[idx(i, j)]!;
  if (Number.isNaN(c)) return 0.25;

  const iL = Math.max(0, i - 1);
  const iR = Math.min(nx - 1, i + 1);
  const jD = Math.max(0, j - 1);
  const jU = Math.min(nz - 1, j + 1);

  const zL = Number.isNaN(elevation[idx(iL, j)]!) ? c : elevation[idx(iL, j)]!;
  const zR = Number.isNaN(elevation[idx(iR, j)]!) ? c : elevation[idx(iR, j)]!;
  const zD = Number.isNaN(elevation[idx(i, jD)]!) ? c : elevation[idx(i, jD)]!;
  const zU = Number.isNaN(elevation[idx(i, jU)]!) ? c : elevation[idx(i, jU)]!;

  const dzdx = (zR - zL) / Math.max(1e-6, (iR - iL) * cellM);
  const dzdz = (zU - zD) / Math.max(1e-6, (jU - jD) * cellM);

  const slopeRad = Math.atan(Math.hypot(dzdx, dzdz));
  const aspectRad = Math.atan2(dzdz, -dzdx);

  const zenithRad = (45 * Math.PI) / 180;
  const azimuthRad = (315 * Math.PI) / 180;

  const hs =
    Math.cos(zenithRad) * Math.cos(slopeRad) +
    Math.sin(zenithRad) * Math.sin(slopeRad) * Math.cos(azimuthRad - aspectRad);

  return Math.max(0.12, Math.min(1, (hs + 1) / 2));
}

export interface WhyBarSegment {
  readonly term: CostTermId;
  readonly metersEq: number;
  readonly pct: number;
  readonly colorHex: string;
}

const TERM_COLORS: Readonly<Record<CostTermId, string>> = {
  D: "#38bdf8",
  T: "#f59e0b",
  R: "#f43f5e",
  E: "#34d399",
  U: "#a78bfa",
  H: "#fb7185",
};

/**
 * Convierte el diccionario de contribuciones (D, T, R, E, U, H) en segmentos porcentuales
 * que suman exactamente 100.0 % (UX_UI_GUIDELINES §3.3).
 */
export function whyBarSegments(
  contributions: Readonly<Record<CostTermId, number>>,
): WhyBarSegment[] {
  const keys: readonly CostTermId[] = ["D", "T", "R", "E", "U", "H"];
  const clean = keys.map((k) => Math.max(0, Number.isFinite(contributions[k]) ? contributions[k] : 0));
  const sum = clean.reduce((a, b) => a + b, 0);

  if (sum <= 1e-9) {
    return keys.map((term, idx) => ({
      term,
      metersEq: 0,
      pct: idx === 0 ? 100 : 0,
      colorHex: TERM_COLORS[term],
    }));
  }

  const rawPcts = clean.map((v) => (100 * v) / sum);
  const rounded = rawPcts.map((p) => Math.round(p * 10) / 10);
  const roundedSum = rounded.reduce((a, b) => a + b, 0);
  const diff = Number((100 - roundedSum).toFixed(1));

  // Ajustar el segmento mayor para que la suma de porcentajes sea exactamente 100 %
  let maxIdx = 0;
  for (let i = 1; i < rounded.length; i += 1) {
    if (rounded[i]! > rounded[maxIdx]!) maxIdx = i;
  }
  rounded[maxIdx] = Number((rounded[maxIdx]! + diff).toFixed(1));

  return keys.map((term, i) => ({
    term,
    metersEq: clean[i]!,
    pct: rounded[i]!,
    colorHex: TERM_COLORS[term],
  }));
}

/**
 * Convierte un punto métrico local (x este, z norte en metros) a coordenadas planetocéntricas
 * sobre la esfera IAU_2015:49900 (radio 3 396 190 m).
 */
export function localToPlanetocentric(
  point: LocalPoint,
  siteRef: { readonly lat: number; readonly lon: number },
): { readonly lat: number; readonly lon: number } {
  const R = TREK_PARAMS.marsRadiusIauM.value;
  const dLatDeg = ((point.z / R) * 180) / Math.PI;
  const cosLat = Math.max(0.05, Math.cos((siteRef.lat * Math.PI) / 180));
  const dLonDeg = ((point.x / (R * cosLat)) * 180) / Math.PI;
  return {
    lat: Number((siteRef.lat + dLatDeg).toFixed(5)),
    lon: Number((siteRef.lon + dLonDeg).toFixed(5)),
  };
}

/** Genera una minigráfica ASCII monoespaciada (ascii-skills) para lecturas de telemetría. */
export function asciiSparkBar(value: number, min: number, max: number, width = 10): string {
  const ratio = Math.max(0, Math.min(1, (value - min) / Math.max(1e-6, max - min)));
  const filled = Math.round(ratio * width);
  return `${"#".repeat(filled)}${".".repeat(Math.max(0, width - filled))}`;
}
