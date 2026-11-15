/**
 * Mars Trek · Catálogo de sitios de navegación y carga de teselas reales de Gale (Tarea 1 y Tarea 11).
 */
import type { HeightGrid } from "@/core/science/routing";
import type { DataType, GeoPoint } from "@/core/types";
import type { ConfidenceClass, LocalPoint, ShelterPoint, TourStop } from "@/core/trek/contracts";
import { twoCorridorField } from "@/core/trek/costmap/synthetic";
import { EVA_SITES } from "@/data/evaSites";
import { decodeElevationTile, type SiteManifest } from "./tiles";

export { decodeElevationTile, type SiteManifest } from "./tiles";

export interface TrekSitePoi {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly point: LocalPoint;
  readonly scienceWeight: number;
}

/**
 * Estación científica del recorrido por defecto: punto de observación seguro (validado con A* en
 * defaultTour.test.ts) junto a un objetivo real de Curiosity, con su tarea en los dos idiomas.
 * `dwellMin` es [diseño]: del orden de las estaciones geológicas de Apollo 15–17 (15–75 min).
 */
export interface TrekStation extends TourStop {
  /** Objetivo de Curiosity (POI de Access Mars) que se estudia desde aquí. */
  readonly poiId: string;
  readonly task: string;
  readonly taskEn: string;
}

export interface TrekSiteInfo {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly solRange: string;
  readonly capturedDate: string;
  readonly coord: GeoPoint & { readonly elevationM: number };
  readonly dataType: DataType;
  readonly baseConfidence: ConfidenceClass;
  readonly resolutionM: number;
  readonly source: string;
  readonly manifestUrl: string | null;
  readonly tileUrl: string | null;
  /**
   * Ortofoto cenital (2048 px, 6.25 cm/px) alineada con la rejilla, proyectada desde las mallas
   * texturizadas de Access Mars por scripts/trek/build_site_orthophotos.py. null en el banco sintético.
   */
  readonly orthophotoUrl: string | null;
  readonly defaultOrigin: LocalPoint;
  /** En los sitios con recorrido por defecto es el propio rover (la EVA regresa al punto de partida). */
  readonly defaultGoal: LocalPoint;
  /** Estaciones científicas del recorrido por defecto (vacío = caminata de un solo destino). */
  readonly defaultStops: readonly TrekStation[];
  readonly shelters: readonly ShelterPoint[];
  readonly roverTraversePoints: readonly LocalPoint[];
  readonly pois: readonly TrekSitePoi[];
  readonly simulated: boolean;
}

const GALE_DEFAULTS: Readonly<
  Record<
    string,
    {
      origin: LocalPoint;
      goal: LocalPoint;
      shelters: ShelterPoint[];
      traverse: LocalPoint[];
      stations?: TrekStation[];
    }
  >
> = {
  murray_buttes: {
    // (-38, -28) y (28, 24) caen sobre laderas de 24° y 23° (Z5 a pie): la pantalla abría sin ruta.
    // Se usan los puntos llanos más cercanos (pendiente ≤ 7° en la ventana 3×3).
    origin: { x: -40, z: -16 },
    // Recorrido por defecto: rover → 3 estaciones científicas → rover (EVA de ~2.6 h).
    goal: { x: -40, z: -16 },
    stations: [
      {
        id: "st-mb2",
        poiId: "mb2",
        name: "Bruce Murray",
        point: { x: -11, z: -13 },
        dwellMin: 30,
        task: "Panorámica estereoscópica del campo de buttes para elegir dónde muestrear.",
        taskEn: "Stereo panorama of the butte field to choose where to sample.",
      },
      {
        id: "st-mb1",
        poiId: "mb1",
        name: "Buttes · Monument Valley",
        point: { x: 11, z: 7 },
        dwellMin: 75,
        task: "Base del butte: fotos de detalle de la arenisca erosionada por el viento y muestras.",
        taskEn: "Butte base: close-up imaging of the wind-eroded sandstone and samples.",
      },
      {
        id: "st-mb4",
        poiId: "mb4",
        name: "Interference",
        point: { x: -60, z: 35 },
        dwellMin: 45,
        task: "Prueba de enlace con el orbitador dentro de la sombra de radio de los buttes.",
        taskEn: "Orbiter link test inside the buttes' radio shadow.",
      },
    ],
    shelters: [
      {
        id: "hab-mb",
        name: "Rover Presurizado / Base Murray Buttes",
        point: { x: -40, z: -16 },
        kind: "rover",
        shielded: true,
      },
      {
        id: "shelter-lee",
        name: "Abrigo Sotavento Butte B",
        point: { x: -10, z: -12 },
        kind: "natural-shelter",
        shielded: true,
      },
    ],
    traverse: [
      { x: -38, z: -28 },
      { x: -24, z: -18 },
      { x: -10, z: -12 },
      { x: 4, z: -2 },
      { x: 14, z: 7 },
    ],
  },
  landing_site: {
    origin: { x: -35, z: -25 },
    goal: { x: 25, z: 20 },
    shelters: [
      {
        id: "hab-ls",
        name: "Hábitat Bradbury Landing",
        point: { x: -35, z: -25 },
        kind: "habitat",
        shielded: true,
      },
      {
        id: "rover-ls",
        name: "Rover Auxiliar Bradbury",
        point: { x: 0, z: 0 },
        kind: "rover",
        shielded: true,
      },
    ],
    traverse: [
      { x: -35, z: -25 },
      { x: -15, z: -10 },
      { x: 0, z: 0 },
      { x: 14, z: 6 },
      { x: 21, z: 0 },
    ],
  },
  pahrump_hills: {
    origin: { x: -32, z: -22 },
    goal: { x: -32, z: -22 },
    stations: [
      {
        id: "st-ph4",
        poiId: "ph4",
        name: "Mount Sharp",
        point: { x: -29, z: -11 },
        dwellMin: 20,
        task: "Panorámica de las capas de Mount Sharp desde su base.",
        taskEn: "Panorama of Mount Sharp's layers from its base.",
      },
      {
        id: "st-ph2",
        poiId: "ph2",
        name: "Ancient History",
        point: { x: 2, z: -9 },
        dwellMin: 45,
        task: "Muestras de roca sedimentaria del antiguo fondo de lago.",
        taskEn: "Samples of sedimentary rock from the ancient lake bed.",
      },
      {
        id: "st-ph3",
        poiId: "ph3",
        name: "Mojave & Telegraph Peak",
        point: { x: 7, z: -6 },
        dwellMin: 75,
        task: "Comparar los minerales de los dos sitios de perforación: la química del lago cambió.",
        taskEn: "Compare minerals at the two drill sites: the lake chemistry changed.",
      },
    ],
    shelters: [
      {
        id: "hab-ph",
        name: "Estación Base Pahrump Hills",
        point: { x: -32, z: -22 },
        kind: "habitat",
        shielded: true,
      },
      {
        id: "rover-ph",
        name: "Punto Seguro Mojave Drill",
        point: { x: 7, z: -6 },
        kind: "waypoint",
        shielded: false,
      },
    ],
    traverse: [
      { x: -32, z: -22 },
      { x: -12, z: -12 },
      { x: 2, z: -4 },
      { x: 7, z: -6 },
    ],
  },
  marias_pass: {
    origin: { x: -30, z: -24 },
    goal: { x: -30, z: -24 },
    stations: [
      {
        id: "st-mp4",
        poiId: "mp4",
        name: "Conjunction",
        point: { x: 2, z: 5 },
        dwellMin: 20,
        task: "Prueba de comunicaciones donde Curiosity esperó la conjunción solar.",
        taskEn: "Comms check where Curiosity waited out solar conjunction.",
      },
      {
        id: "st-mp1",
        poiId: "mp1",
        name: "Arrival",
        point: { x: 9, z: 6 },
        dwellMin: 40,
        task: "Arenisca joven sobre lutita antigua: fotos y muestras de las dos capas.",
        taskEn: "Young sandstone over old mudstone: imaging and samples of both layers.",
      },
      {
        id: "st-mp2",
        poiId: "mp2",
        name: "Buckskin",
        point: { x: 6, z: 22 },
        dwellMin: 75,
        task: "Muestra rica en sílice (puede preservar orgánicos) y búsqueda de tridimita.",
        taskEn: "Silica-rich sample (may preserve organics) and search for tridymite.",
      },
    ],
    shelters: [
      {
        id: "hab-mp",
        name: "Rover Presurizado Marias Pass",
        point: { x: -30, z: -24 },
        kind: "rover",
        shielded: true,
      },
      {
        id: "shelter-mp",
        name: "Contacto Buckskin",
        point: { x: 6, z: 22 },
        kind: "natural-shelter",
        shielded: true,
      },
    ],
    traverse: [
      { x: -30, z: -24 },
      { x: -8, z: -6 },
      { x: 2, z: 5 },
      { x: 9, z: 6 },
    ],
  },
  live_site: {
    origin: { x: -34, z: -26 },
    goal: { x: 26, z: 24 },
    shelters: [
      {
        id: "hab-lv",
        name: "Base Vera Rubin Ridge",
        point: { x: -34, z: -26 },
        kind: "habitat",
        shielded: true,
      },
      {
        id: "rover-lv",
        name: "Rover Ascenso VRR",
        point: { x: 4, z: -4 },
        kind: "rover",
        shielded: true,
      },
    ],
    traverse: [
      { x: -34, z: -26 },
      { x: -16, z: -14 },
      { x: -6, z: 5 },
      { x: 4, z: -4 },
    ],
  },
};

export const TREK_SITES: readonly TrekSiteInfo[] = [
  ...EVA_SITES.map((site): TrekSiteInfo => {
    const cfg = GALE_DEFAULTS[site.id] ?? GALE_DEFAULTS["murray_buttes"]!;
    return {
      id: site.id,
      name: site.name,
      subtitle: `Cráter Gale · ${site.solRange}`,
      solRange: site.solRange,
      capturedDate: site.capturedDate,
      coord: site.planetocentricCoord,
      dataType: "REAL",
      baseConfidence: "K2",
      resolutionM: 1,
      source: `NASA/JPL-Caltech MSL Curiosity Navcam/Mastcam stereo mesh (${site.name})`,
      manifestUrl: `/data/trek/gale/${site.id}/manifest.json`,
      tileUrl: `/data/trek/gale/${site.id}/elevation.f32`,
      orthophotoUrl: `/data/trek/gale/${site.id}/orthophoto.jpg`,
      defaultOrigin: cfg.origin,
      defaultGoal: cfg.goal,
      defaultStops: cfg.stations ?? [],
      shelters: cfg.shelters,
      roverTraversePoints: cfg.traverse,
      pois: site.pois.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.text,
        point: {
          x: Math.max(-60, Math.min(60, p.position[0])),
          z: Math.max(-60, Math.min(60, p.position[2])),
        },
        scienceWeight: p.weight,
      })),
      simulated: false,
    };
  }),
  {
    id: "synthetic_two_corridors",
    name: "Banco de Pruebas T-06 · Dos Corredores (Simulado)",
    subtitle: "Escenario Sintético de Validación · Corredor A (17°) vs Corredor B (9°)",
    solRange: "Simulación Determinista",
    capturedDate: "2026-11-15",
    coord: { lat: -4.65, lon: 137.41, elevationM: -4420 },
    dataType: "SIMULATED",
    baseConfidence: "K2",
    resolutionM: 1,
    source:
      "Rejilla sintética determinista para validación de seguridad (TESTING_STRATEGY §3 T-06)",
    manifestUrl: null,
    tileUrl: null,
    orthophotoUrl: null,
    defaultOrigin: { x: -42, z: 0 },
    defaultGoal: { x: 42, z: 0 },
    defaultStops: [],
    shelters: [
      {
        id: "shelter-hab",
        name: "Refugio Hábitat (Simulado)",
        point: { x: -42, z: -20 },
        kind: "habitat",
        shielded: true,
      },
    ],
    roverTraversePoints: [
      { x: -42, z: 0 },
      { x: -42, z: 28 },
      { x: 0, z: 28 },
      { x: 42, z: 28 },
      { x: 42, z: 0 },
    ],
    pois: [
      {
        id: "syn-a",
        title: "Paso Directo A (Pendiente 17°)",
        description:
          "Corredor corto de 17° admisible en NORMAL pero bloqueado en FATIGUE (límite 15°).",
        point: { x: 0, z: 0 },
        scienceWeight: 0.8,
      },
      {
        id: "syn-b",
        title: "Corredor Norte B (Pendiente ≤ 9°)",
        description: "Rodeo seguro de baja exigencia fisiológica admisible en FATIGUE y CAUTION.",
        point: { x: 0, z: 28 },
        scienceWeight: 0.9,
      },
    ],
    simulated: true,
  },
];

export function getTrekSite(siteId: string): TrekSiteInfo {
  return TREK_SITES.find((s) => s.id === siteId) ?? TREK_SITES[3]!;
}

/** Carga en navegador (o entorno con fetch) la rejilla de elevación y manifiesto de un sitio. */
export async function loadSiteElevationGrid(siteId: string): Promise<{
  site: TrekSiteInfo;
  grid: HeightGrid;
  manifest: SiteManifest | null;
}> {
  const site = getTrekSite(siteId);
  if (site.id === "synthetic_two_corridors" || !site.manifestUrl || !site.tileUrl) {
    const syn = twoCorridorField();
    return { site, grid: syn.heightGrid, manifest: null };
  }

  const [manifestRes, tileRes] = await Promise.all([fetch(site.manifestUrl), fetch(site.tileUrl)]);
  if (!manifestRes.ok) {
    throw new Error(`No se pudo cargar el manifiesto de ${site.id} (${manifestRes.status})`);
  }
  if (!tileRes.ok) {
    throw new Error(`No se pudo cargar la tesela de elevación de ${site.id} (${tileRes.status})`);
  }
  const manifest = (await manifestRes.json()) as SiteManifest;
  const buffer = await tileRes.arrayBuffer();
  const grid = decodeElevationTile(buffer, manifest);
  return { site, grid, manifest };
}
