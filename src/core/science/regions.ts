import type { GeoPoint } from "../types";

/**
 * Knowledge-based regional catalogues used by the Survival Atlas proxies.
 * Locations are approximate centres of regions described in the cited
 * literature; the derived layers are QUALITATIVE and labelled as such.
 */

export interface Region {
  id: string;
  name: string;
  center: GeoPoint;
  radiusKm: number;
  weight: number;
  reference: string;
}

/** Mid-latitude ground-ice regions reported by radar/imaging studies. */
export const ICE_REGIONS: Region[] = [
  { id: "arcadia", name: "Arcadia Planitia", center: { lat: 40, lon: -165 }, radiusKm: 900, weight: 0.75, reference: "Bramson et al. (2015) GRL; Morgan et al. (2021) Nature Astronomy (SWIM)" },
  { id: "utopia", name: "Utopia Planitia (SHARAD deposit)", center: { lat: 45, lon: 95 }, radiusKm: 750, weight: 0.7, reference: "Stuurman et al. (2016) GRL" },
  { id: "deuteronilus", name: "Deuteronilus Mensae", center: { lat: 44, lon: 23 }, radiusKm: 600, weight: 0.6, reference: "Plaut et al. (2009) GRL" },
  { id: "phlegra", name: "Phlegra Montes", center: { lat: 40, lon: 163 }, radiusKm: 400, weight: 0.5, reference: "Morgan et al. (2021) Nature Astronomy (SWIM)" },
  { id: "hellas-east", name: "Eastern Hellas debris aprons", center: { lat: -40, lon: 104 }, radiusKm: 500, weight: 0.5, reference: "Holt et al. (2008) Science" },
];

/** Commonly reported dust-storm genesis regions / storm tracks. */
export const DUST_REGIONS: Region[] = [
  { id: "acidalia-chryse", name: "Acidalia–Chryse storm track", center: { lat: 35, lon: -35 }, radiusKm: 1300, weight: 0.8, reference: "Wang & Richardson (2015) Icarus; Battalio & Wang (2021) Icarus (MDAD)" },
  { id: "utopia-isidis", name: "Utopia–Isidis storm track", center: { lat: 35, lon: 95 }, radiusKm: 1300, weight: 0.65, reference: "Wang & Richardson (2015) Icarus" },
  { id: "arcadia-amazonis", name: "Arcadia–Amazonis storm track", center: { lat: 30, lon: -150 }, radiusKm: 1300, weight: 0.6, reference: "Wang & Richardson (2015) Icarus" },
  { id: "hellas", name: "Hellas basin", center: { lat: -42, lon: 70 }, radiusKm: 1100, weight: 0.75, reference: "Battalio & Wang (2021) Icarus (MDAD)" },
  { id: "argyre-noachis", name: "Argyre–Noachis", center: { lat: -45, lon: -30 }, radiusKm: 1200, weight: 0.65, reference: "Battalio & Wang (2021) Icarus (MDAD)" },
];

export interface ScienceTarget {
  id: string;
  name: string;
  point: GeoPoint;
  kind: "mineral" | "ice" | "hazard";
  detail: string;
  reference: string;
}

/** Documented science / ISRU-relevant targets (orbital or in-situ detections). */
export const SCIENCE_TARGETS: ScienceTarget[] = [
  { id: "jezero-delta", name: "Jezero crater delta", point: { lat: 18.44, lon: 77.45 }, kind: "mineral", detail: "Clays and carbonates in a preserved delta", reference: "Ehlmann et al. (2008) Nat. Geosci.; Horgan et al. (2020) Icarus" },
  { id: "nili-fossae", name: "Nili Fossae", point: { lat: 22.0, lon: 75.0 }, kind: "mineral", detail: "Olivine, carbonates and phyllosilicates", reference: "Ehlmann et al. (2008) Science" },
  { id: "mawrth", name: "Mawrth Vallis", point: { lat: 24.0, lon: -19.0 }, kind: "mineral", detail: "Layered phyllosilicates (clays)", reference: "Bishop et al. (2008) Science" },
  { id: "gale-sharp", name: "Gale crater / Mount Sharp", point: { lat: -5.4, lon: 137.8 }, kind: "mineral", detail: "Clay- and sulfate-bearing strata", reference: "Milliken et al. (2010) GRL; Vaniman et al. (2014) Science" },
  {
    id: "mount-sharp-boxwork",
    name: "Mount Sharp boxwork ridges",
    point: { lat: -4.8057, lon: 137.3802 },
    kind: "mineral",
    detail: "Boxwork ridges and hollows (a fracture network 10–20 km across seen from orbit) explored up close by Curiosity from May 2025 into 2026 (campaign sols 4534–4805), interpreted as hardened by ancient groundwater. Rover elevation −3660 to −3605 m on sols 4530–4711.",
    reference: "Centroid of Curiosity's MMGIS waypoints, sols 4575–4711; NASA Curiosity blog (campaign phases, sols 4804–4811); Photojournal PIA26552, PIA26558, PIA26560",
  },
  { id: "meridiani", name: "Meridiani Planum", point: { lat: -1.95, lon: -5.53 }, kind: "mineral", detail: "Hematite concretions and sulfate sandstones", reference: "Christensen et al. (2000) JGR; Squyres et al. (2004) Science" },
  { id: "columbia-hills", name: "Columbia Hills, Gusev", point: { lat: -14.57, lon: 175.47 }, kind: "mineral", detail: "Opaline silica and carbonates", reference: "Squyres et al. (2008) Science; Morris et al. (2010) Science" },
  { id: "eberswalde", name: "Eberswalde delta", point: { lat: -24.0, lon: -33.0 }, kind: "mineral", detail: "Fan-delta deposits with clays", reference: "Malin & Edgett (2003) Science" },
  { id: "phoenix-ice", name: "Phoenix landing site", point: { lat: 68.22, lon: -125.75 }, kind: "ice", detail: "Ground ice exposed a few cm below the surface", reference: "Smith et al. (2009) Science" },
  { id: "utopia-ice", name: "Utopia Planitia ice deposit", point: { lat: 45, lon: 95 }, kind: "ice", detail: "Buried water ice detected by SHARAD radar", reference: "Stuurman et al. (2016) GRL" },
  { id: "arcadia-ice", name: "Arcadia Planitia", point: { lat: 40, lon: -165 }, kind: "ice", detail: "Shallow excess ice (radar + crater exposures)", reference: "Bramson et al. (2015) GRL" },
  { id: "cerberus", name: "Cerberus Fossae", point: { lat: 9.0, lon: 165.0 }, kind: "hazard", detail: "Main marsquake source region detected by InSight", reference: "Giardini et al. (2020) Nat. Geosci." },
];

export interface LandingSite {
  id: string;
  mission: string;
  agency: string;
  year: number;
  point: GeoPoint;
  region: string;
}

/** Historical landing sites (published landing coordinates, planetocentric). */
export const LANDING_SITES: LandingSite[] = [
  { id: "viking1", mission: "Viking 1", agency: "NASA", year: 1976, point: { lat: 22.27, lon: -47.95 }, region: "Chryse Planitia" },
  { id: "viking2", mission: "Viking 2", agency: "NASA", year: 1976, point: { lat: 47.64, lon: 134.29 }, region: "Utopia Planitia" },
  { id: "pathfinder", mission: "Mars Pathfinder", agency: "NASA", year: 1997, point: { lat: 19.13, lon: -33.22 }, region: "Ares Vallis" },
  { id: "spirit", mission: "Spirit (MER-A)", agency: "NASA", year: 2004, point: { lat: -14.57, lon: 175.47 }, region: "Gusev crater" },
  { id: "opportunity", mission: "Opportunity (MER-B)", agency: "NASA", year: 2004, point: { lat: -1.95, lon: -5.53 }, region: "Meridiani Planum" },
  { id: "phoenix", mission: "Phoenix", agency: "NASA", year: 2008, point: { lat: 68.22, lon: -125.75 }, region: "Vastitas Borealis" },
  { id: "curiosity", mission: "Curiosity (MSL)", agency: "NASA", year: 2012, point: { lat: -4.59, lon: 137.44 }, region: "Gale crater" },
  { id: "insight", mission: "InSight", agency: "NASA", year: 2018, point: { lat: 4.5, lon: 135.62 }, region: "Elysium Planitia" },
  { id: "perseverance", mission: "Perseverance (Mars 2020)", agency: "NASA", year: 2021, point: { lat: 18.44, lon: 77.45 }, region: "Jezero crater" },
  { id: "zhurong", mission: "Zhurong (Tianwen-1)", agency: "CNSA", year: 2021, point: { lat: 25.07, lon: 109.93 }, region: "Utopia Planitia" },
];

/** Gaussian influence of a region at a point (0..weight). */
export function regionInfluence(region: Region, distanceKm: number): number {
  return region.weight * Math.exp(-0.5 * (distanceKm / (region.radiusKm * 0.6)) ** 2);
}
