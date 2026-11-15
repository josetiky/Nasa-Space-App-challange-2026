/**
 * Mars Trek · Catálogo de procedencia de capas compartido por las vistas /trek (clásica y MarsWalk).
 * Solo describe etiquetas de procedencia: ninguna lógica de costo, A*, envolvente ni salud vive aquí.
 */
import type { DataType } from "@/core/types";
import type { MapLayerId, TrekStoreState } from "@/state/trekStore";

/** Capas científicas que existen como producto pero NO como ráster numérico local (Restricción #3). */
export const UNAVAILABLE_DECOUPLED_LAYERS = [
  {
    id: "mola-hrsc-dem-200m",
    title: "MGS MOLA / MEX HRSC Blended DEM (200 m/px)",
    mission: "MGS MOLA + Mars Express HRSC",
    status: "no_disponible",
    reasonEs:
      "Producto regional (200 m/px) no apto para pendientes a escala EVA humana (INV-C1: requiere 1–2 m); interfaz reservada para nivel regional N1.",
    reasonEn:
      "Regional product (200 m/px) unsuitable for human EVA slopes (INV-C1: requires 1–2 m); interface reserved for regional level N1.",
  },
  {
    id: "themis-ti-100m",
    title: "Mars Odyssey THEMIS Thermal Inertia (100 m/px)",
    mission: "2001 Mars Odyssey · THEMIS",
    status: "no_disponible",
    reasonEs:
      "Teselas WMTS de Mars Trek son imágenes RGB, no ráster numérico de inercia térmica en J·m⁻²·K⁻¹·s⁻½.",
    reasonEn:
      "Mars Trek WMTS tiles are RGB imagery, not numeric thermal inertia rasters in J·m⁻²·K⁻¹·s⁻½.",
  },
  {
    id: "crism-hydrous",
    title: "MRO CRISM / OMEGA Hydrous Minerals",
    mission: "MRO CRISM · Mars Express OMEGA",
    status: "no_disponible",
    reasonEs:
      "Sin archivo ráster PDS recortado en local; los objetivos minerales del sitio se representan mediante POIs verificados de Curiosity.",
    reasonEn:
      "No local clipped PDS raster archive bundled; site mineral targets are represented via verified Curiosity POIs.",
  },
] as const;

export const MAP_LAYER_IDS: readonly MapLayerId[] = [
  "elevation",
  "slope",
  "zones",
  "confidence",
  "dust",
  "radiation",
];

/**
 * Procedencia honesta de cada capa base para el sitio cargado.
 * - Elevación: la del sitio (REAL para mallas Curiosity, SIMULATED para el banco sintético).
 * - Pendiente / zonas / confianza: DERIVED de la elevación (o SIMULATED si la base es sintética).
 * - Polvo y radiación: MODELLED; pasan a SIMULATED cuando hay tormentas o SEP inyectados.
 */
export function layerProvenance(
  layer: MapLayerId,
  state: Pick<TrekStoreState, "siteInfo" | "session">,
): DataType {
  const synthetic = state.siteInfo.dataType === "SIMULATED";
  switch (layer) {
    case "elevation":
      return state.siteInfo.dataType;
    case "slope":
    case "zones":
    case "confidence":
      return synthetic ? "SIMULATED" : "DERIVED";
    case "dust":
      return state.session.storms.some((s) => s.active) ? "SIMULATED" : "MODELLED";
    case "radiation":
      return state.session.sepAlertActive ? "SIMULATED" : "MODELLED";
  }
}
