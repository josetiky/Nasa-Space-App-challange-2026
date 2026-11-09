import type { GeoPoint, SiteEnvironment } from "../types";
import { DUST, MARS, RADIATION } from "./constants";
import { distanceKm } from "./geo";
import { annualMeanSurfaceInsolation, dailyMeanToaInsolation, surfaceInsolation } from "./insolation";
import { DUST_REGIONS, ICE_REGIONS, SCIENCE_TARGETS, regionInfluence } from "./regions";
import { reliefAt, sampleElevation, slopeAt, type TerrainGrid } from "./terrain";

/**
 * Empirical calibration against Curiosity REMS (Gale crater).
 * Values below are fitted by `scripts/calibrate-rems.mjs` from the bundled
 * REMS snapshot (public/data/nasa/rems). See docs/SIMULATION_MODEL.md.
 */
export const REMS_CALIBRATION = {
  /** Rover elevation band of the calibration window (m, MOLA). */
  referenceElevationM: -4450,
  /** Annual-mean surface pressure at the reference elevation (Pa). */
  meanPressurePa: 845,
  /** Seasonal pressure harmonics: P(Ls)/P̄ = 1 + Σ a_k cos(kLs) + b_k sin(kLs). */
  pressureHarmonics: [
    { k: 1, a: -0.0255, b: -0.0637 },
    { k: 2, a: 0.0383, b: 0.0246 },
  ],
  /** Daily-mean air temperature: T̄ = a + b·Q_TOA^¼ − c·(lat/90)² − lapse·Δz − d·max(0, τ − 0.5), floored at 148 K. */
  tempA: -70,
  tempB: 83,
  tempLatC: 52,
  /** Diurnal range at τ = 0.5 (K) and its dust sensitivity. */
  diurnalRangeK: 72,
  diurnalTauSensitivity: 0.22,
  /** Near-surface lapse correction relative to the reference elevation (K/km). ASSUMPTION. */
  lapseKPerKm: 1.5,
  /** Net cooling of the daily mean per unit of optical depth above 0.5 (K). ASSUMPTION. */
  dustMeanCoolingKPerTau: 2,
  calibrated: false as boolean,
  sample: "default (pre-calibration)" as string,
};

/** Seasonal background optical depth outside storms (MODEL, qualitative climatology). */
export function backgroundTau(ls: number): number {
  const value = ((ls % 360) + 360) % 360;
  const dusty = value >= 180 ? Math.sin(((value - 180) * Math.PI) / 180) : 0;
  return DUST.clearSeasonTau + DUST.dustySeasonExtraTau * dusty;
}

export function pressureAt(elevationM: number, ls?: number): number {
  const base = REMS_CALIBRATION.meanPressurePa * Math.exp(-(elevationM - REMS_CALIBRATION.referenceElevationM) / MARS.scaleHeightM);
  if (ls === undefined) return base;
  const rad = (ls * Math.PI) / 180;
  let factor = 1;
  for (const h of REMS_CALIBRATION.pressureHarmonics) factor += h.a * Math.cos(h.k * rad) + h.b * Math.sin(h.k * rad);
  return base * factor;
}

/** Atmospheric column (g/cm²) = P / g. */
export function shieldingColumn(pressurePa: number): number {
  return pressurePa / MARS.gravity / 10;
}

/** Modelled GCR dose equivalent (mSv per sol), anchored to MSL-RAD at Gale. */
export function gcrDosePerSol(pressurePa: number): number {
  const perDay = RADIATION.radGaleDoseEqMsvPerDay * (RADIATION.referencePressurePa / Math.max(50, pressurePa)) ** RADIATION.pressureExponent;
  return perDay * (MARS.solSeconds / 86400);
}

export interface DailyTemperature {
  meanC: number;
  minC: number;
  maxC: number;
}

/** Empirical temperature model (MODELLED). Floors at the CO₂ frost point (~148 K). */
export function dailyTemperature(latDeg: number, elevationM: number, ls: number, tau: number): DailyTemperature {
  // Daily mean follows top-of-atmosphere forcing; dust mostly compresses the diurnal cycle
  // (cooler days, warmer nights — Viking lander storm records) with a small net cooling.
  const q = dailyMeanToaInsolation(latDeg, ls);
  const c = REMS_CALIBRATION;
  const lapse = (c.lapseKPerKm * (elevationM - c.referenceElevationM)) / 1000;
  const dustCooling = c.dustMeanCoolingKPerTau * Math.max(0, tau - 0.5);
  const meanK = Math.max(148, c.tempA + c.tempB * Math.pow(Math.max(0, q), 0.25) - c.tempLatC * (latDeg / 90) ** 2 - lapse - dustCooling);
  const range = c.diurnalRangeK * Math.exp(-c.diurnalTauSensitivity * Math.max(0, tau - 0.5));
  const minK = Math.max(140, meanK - range / 2);
  const maxK = meanK + range / 2;
  return { meanC: meanK - 273.15, minC: minK - 273.15, maxC: maxK - 273.15 };
}

export function annualMeanTemperature(latDeg: number, elevationM: number, steps = 36): DailyTemperature {
  let mean = 0;
  let min = 0;
  let max = 0;
  for (let i = 0; i < steps; i += 1) {
    const ls = (i / steps) * 360;
    const t = dailyTemperature(latDeg, elevationM, ls, backgroundTau(ls));
    mean += t.meanC;
    min += t.minC;
    max += t.maxC;
  }
  return { meanC: mean / steps, minC: min / steps, maxC: max / steps };
}

/** Ground-ice likelihood proxy: latitude stability band + documented mid-latitude regions. */
export function iceLikelihood(point: GeoPoint): number {
  const latitudeTerm = 1 / (1 + Math.exp(-(Math.abs(point.lat) - 52) / 4));
  let regional = 0;
  for (const region of ICE_REGIONS) regional = Math.max(regional, regionInfluence(region, distanceKm(point, region.center)));
  return Math.min(1, Math.max(latitudeTerm, regional));
}

/** Dust-storm activity proxy from literature storm tracks (qualitative). */
export function dustActivity(point: GeoPoint): number {
  let value = 0.12;
  for (const region of DUST_REGIONS) value = Math.max(value, regionInfluence(region, distanceKm(point, region.center)));
  return Math.min(1, value);
}

export function nearestScienceTarget(point: GeoPoint): { name: string; distanceKm: number; value: number } | null {
  let best: { name: string; distanceKm: number; value: number } | null = null;
  for (const target of SCIENCE_TARGETS) {
    if (target.kind === "hazard") continue;
    const d = distanceKm(point, target.point);
    if (!best || d < best.distanceKm) best = { name: target.name, distanceKm: d, value: Math.exp(-d / 350) };
  }
  return best;
}

/** Full environment description for a location (elevation-dependent values need the MOLA grid). */
export function describeEnvironment(point: GeoPoint, grid: TerrainGrid | null): SiteEnvironment {
  const elevation = grid ? sampleElevation(grid, point) : null;
  const elevationForModels = elevation ?? REMS_CALIBRATION.referenceElevationM;
  const pressure = pressureAt(elevationForModels);
  const temps = annualMeanTemperature(point.lat, elevationForModels);
  const target = nearestScienceTarget(point);
  return {
    point,
    elevationM: elevation,
    slopeDeg: grid ? slopeAt(grid, point) : null,
    reliefM: grid ? reliefAt(grid, point) : null,
    meanPressurePa: pressure,
    shieldingGcm2: shieldingColumn(pressure),
    gcrDoseMsvPerSol: gcrDosePerSol(pressure),
    annualMeanTempC: temps.meanC,
    diurnalRangeK: temps.maxC - temps.minC,
    solarAnnualMeanWm2: annualMeanSurfaceInsolation(point.lat, 0.5),
    iceLikelihood: iceLikelihood(point),
    dustActivity: dustActivity(point),
    scienceValue: target?.value ?? 0,
    nearestTarget: target ? { name: target.name, distanceKm: target.distanceKm } : null,
    elevationSource: grid ? "mola" : "unavailable",
  };
}

/** Environment of one sol at a site (used by the simulator). */
export function solEnvironment(site: SiteEnvironment, ls: number, tau: number) {
  const elevation = site.elevationM ?? REMS_CALIBRATION.referenceElevationM;
  const pressure = pressureAt(elevation, ls);
  const temps = dailyTemperature(site.point.lat, elevation, ls, tau);
  return {
    ls,
    tau,
    insolationWm2: surfaceInsolation(site.point.lat, ls, tau),
    tempMinC: temps.minC,
    tempMaxC: temps.maxC,
    pressurePa: pressure,
    doseRateMsv: gcrDosePerSol(pressure),
  };
}
