import type { LocationAnalysis, LocationScores, SiteEnvironment, SiteRef } from "../types";
import { annualMeanSurfaceInsolation } from "./insolation";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp01 = (value: number, good: number, bad: number) => clamp01((value - bad) / (good - bad));

/** Score weights (documented in docs/SIMULATION_MODEL.md). */
export const HABITABILITY_WEIGHTS = {
  landingSafety: 0.25,
  radiationProtection: 0.15,
  thermal: 0.15,
  solarPower: 0.15,
  water: 0.2,
  science: 0.1,
} as const;

const MAX_ANNUAL_INSOLATION = annualMeanSurfaceInsolation(0, 0.5);

/**
 * Transparent location scoring (0–100). Every input is DERIVED or MODELLED;
 * the formulas are deliberately simple so judges and teammates can audit them.
 *
 * Landing safety follows the logic of past landing-site constraints: low
 * elevation gives the atmosphere more column to decelerate a lander (MSL
 * required sites below about −1 km MOLA — Golombek et al. 2012) and low slopes
 * and relief reduce touchdown hazards.
 */
export function scoreLocation(env: SiteEnvironment): LocationScores {
  const elevation = env.elevationM ?? 0;
  const elevationFactor = lerp01(elevation, -2500, 2000);
  const slopeFactor = env.slopeDeg === null ? 0.6 : lerp01(env.slopeDeg, 0.3, 4);
  const reliefFactor = env.reliefM === null ? 0.6 : lerp01(env.reliefM, 200, 3000);
  const landingSafety = 100 * (0.45 * elevationFactor + 0.35 * slopeFactor + 0.2 * reliefFactor);
  const radiationProtection = 100 * lerp01(env.shieldingGcm2, 26, 8);
  const thermal = 100 * lerp01(env.annualMeanTempC, -45, -105);
  const solarPower = 100 * clamp01(env.solarAnnualMeanWm2 / MAX_ANNUAL_INSOLATION) * (1 - 0.35 * env.dustActivity);
  const water = 100 * env.iceLikelihood;
  const science = 100 * env.scienceValue;
  const w = HABITABILITY_WEIGHTS;
  const habitability =
    landingSafety * w.landingSafety +
    radiationProtection * w.radiationProtection +
    thermal * w.thermal +
    solarPower * w.solarPower +
    water * w.water +
    science * w.science;
  const risk = 100 - (0.5 * landingSafety + 0.25 * radiationProtection + 0.25 * thermal);
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    landingSafety: round(landingSafety),
    radiationProtection: round(radiationProtection),
    thermal: round(thermal),
    solarPower: round(solarPower),
    water: round(water),
    science: round(science),
    habitability: round(habitability),
    risk: round(Math.max(0, Math.min(100, risk))),
  };
}

export function locationFlags(env: SiteEnvironment): LocationAnalysis["flags"] {
  const flags: LocationAnalysis["flags"] = [];
  if (env.elevationSource === "unavailable") flags.push({ level: "caution", text: "MOLA elevation grid not loaded — elevation-dependent values use the Gale reference." });
  if ((env.elevationM ?? 0) > 1000) flags.push({ level: "danger", text: "High elevation: thin atmosphere for entry, descent and landing." });
  if ((env.slopeDeg ?? 0) > 3) flags.push({ level: "caution", text: `Regional slope ${env.slopeDeg?.toFixed(1)}° at ~30 km baseline — expect steep local terrain.` });
  if ((env.reliefM ?? 0) > 2500) flags.push({ level: "caution", text: "Large local relief (scarps, canyon walls or volcanic flanks)." });
  if (Math.abs(env.point.lat) > 60) flags.push({ level: "caution", text: "Polar latitude: long winter nights limit solar power; CO₂ frost season." });
  if (env.dustActivity > 0.55) flags.push({ level: "caution", text: "Inside a commonly reported dust-storm track." });
  if (env.iceLikelihood > 0.6) flags.push({ level: "info", text: "Ground ice likely within reach (qualitative proxy)." });
  if (env.shieldingGcm2 > 22) flags.push({ level: "info", text: "Thick atmospheric column: better natural shielding than Gale." });
  if (env.nearestTarget && env.nearestTarget.distanceKm < 150) flags.push({ level: "info", text: env.nearestTarget.distanceKm < 5 ? `${env.nearestTarget.name} is at the site.` : `${env.nearestTarget.name} within ${Math.round(env.nearestTarget.distanceKm)} km.` });
  return flags;
}

export function analyzeLocation(site: SiteRef, env: SiteEnvironment, now: Date = new Date()): LocationAnalysis {
  return { site, environment: env, scores: scoreLocation(env), flags: locationFlags(env), computedAt: now.toISOString() };
}
