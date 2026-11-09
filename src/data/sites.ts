import type { SiteRef } from "@/core/types";

/**
 * Candidate exploration sites (single catalogue for the whole platform).
 * Coordinates are planetocentric, east-positive; scores are NOT stored here —
 * they are computed by the location analyser from the data layers.
 */
export interface CatalogueSite extends SiteRef {
  kind: "catalogue";
  region: string;
  summary: string;
  tags: string[];
  /** Surface EVA terrain available (Access Mars, Gale crater). */
  evaSiteIds?: string[];
}

export const CATALOGUE_SITES: CatalogueSite[] = [
  { id: "jezero", name: "Jezero crater", point: { lat: 18.44, lon: 77.45 }, kind: "catalogue", region: "Isidis Planitia margin", summary: "Ancient lake basin with a preserved delta; Perseverance landing site (2021).", tags: ["delta", "clays", "carbonates", "rover"] },
  { id: "gale", name: "Gale crater", point: { lat: -4.59, lon: 137.44 }, kind: "catalogue", region: "Aeolis", summary: "Mount Sharp's layered strata; Curiosity landing site (2012). Real surface terrain available for EVA planning.", tags: ["clays", "sulfates", "rover", "eva"], evaSiteIds: ["landing_site", "pahrump_hills", "marias_pass", "murray_buttes"] },
  { id: "boxwork", name: "Mount Sharp boxwork (Gale)", point: { lat: -4.8057, lon: 137.3802 }, kind: "catalogue", region: "Aeolis Mons foothills, Gale crater", summary: "Spiderweb-like boxwork ridges Curiosity studied up close in 2025, possible records of ancient groundwater. Position from the rover's real waypoints.", tags: ["boxwork", "groundwater", "rover", "2025"] },
  { id: "utopia", name: "Utopia Planitia", point: { lat: 46.7, lon: 117.5 }, kind: "catalogue", region: "Northern lowlands", summary: "Broad, low plain near the Viking 2 and Zhurong landing sites; radar-detected buried ice to the west.", tags: ["ice", "plains", "lander"] },
  { id: "arcadia", name: "Arcadia Planitia", point: { lat: 40, lon: -165 }, kind: "catalogue", region: "Northern mid-latitudes", summary: "Shallow excess ice inferred from radar and fresh craters — a leading candidate for crewed ISRU.", tags: ["ice", "plains"] },
  { id: "deuteronilus", name: "Deuteronilus Mensae", point: { lat: 44, lon: 23 }, kind: "catalogue", region: "Dichotomy boundary", summary: "Mesas with lobate debris aprons interpreted as buried glaciers.", tags: ["ice", "mesas"] },
  { id: "hellas", name: "Hellas Planitia", point: { lat: -42.4, lon: 70.5 }, kind: "catalogue", region: "Hellas basin floor", summary: "Deepest major basin: the thickest atmospheric column on Mars, but a frequent dust-storm source.", tags: ["basin", "dust", "shielding"] },
  { id: "melas", name: "Melas Chasma", point: { lat: -10.4, lon: -72.3 }, kind: "catalogue", region: "Valles Marineris", summary: "Central Valles Marineris trough exposing kilometres of layered rock; steep walls.", tags: ["canyon", "layered deposits"] },
  { id: "olympus", name: "Olympus Mons summit", point: { lat: 18.65, lon: -133.8 }, kind: "catalogue", region: "Tharsis", summary: "The largest volcano in the Solar System — a stress test for any landing system.", tags: ["volcano", "high elevation"] },
  { id: "meridiani", name: "Meridiani Planum", point: { lat: -1.95, lon: -5.53 }, kind: "catalogue", region: "Terra Meridiani", summary: "Hematite-bearing plains explored by Opportunity (2004–2018).", tags: ["hematite", "plains", "rover"] },
  { id: "mawrth", name: "Mawrth Vallis", point: { lat: 24.0, lon: -19.0 }, kind: "catalogue", region: "Arabia Terra margin", summary: "Some of the most extensive layered clay exposures on Mars.", tags: ["clays", "valley"] },
  { id: "nili", name: "Nili Fossae", point: { lat: 22.0, lon: 75.0 }, kind: "catalogue", region: "Isidis rim", summary: "Olivine, carbonate and clay detections from orbit; close to Jezero.", tags: ["olivine", "carbonates"] },
  { id: "elysium", name: "Elysium Planitia (InSight)", point: { lat: 4.5, lon: 135.62 }, kind: "catalogue", region: "Elysium", summary: "Flat volcanic plain chosen for InSight; near the Cerberus Fossae marsquake source.", tags: ["plains", "seismic"] },
  { id: "gusev", name: "Gusev crater (Spirit)", point: { lat: -14.57, lon: 175.47 }, kind: "catalogue", region: "Aeolis Mensae", summary: "Spirit found opaline silica in the Columbia Hills.", tags: ["silica", "rover"] },
  { id: "phoenix", name: "Phoenix landing site", point: { lat: 68.22, lon: -125.75 }, kind: "catalogue", region: "Vastitas Borealis", summary: "Polygonal terrain where Phoenix exposed water ice a few centimetres down.", tags: ["ice", "polar"] },
];

export function findCatalogueSite(id: string): CatalogueSite | undefined {
  return CATALOGUE_SITES.find((site) => site.id === id);
}

export function customSite(lat: number, lon: number): SiteRef {
  return { id: `custom-${lat.toFixed(2)}-${lon.toFixed(2)}`, name: `Site ${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`, point: { lat, lon }, kind: "custom" };
}
