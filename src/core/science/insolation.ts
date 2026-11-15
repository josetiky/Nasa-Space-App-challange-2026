import { MARS, SOLAR_CONSTANT_1AU } from "./constants";

const DEG = Math.PI / 180;

/** Solar declination (deg) for an areocentric solar longitude. */
export function solarDeclinationDeg(ls: number): number {
  return Math.asin(Math.sin(MARS.obliquityDeg * DEG) * Math.sin(ls * DEG)) / DEG;
}

/** Heliocentric distance (AU) from Ls using the perihelion at Ls ≈ 251°. */
export function heliocentricDistanceAU(ls: number): number {
  const e = MARS.eccentricity;
  return (MARS.semiMajorAxisAU * (1 - e * e)) / (1 + e * Math.cos((ls - MARS.perihelionLsDeg) * DEG));
}

/** Daily-mean top-of-atmosphere insolation on a horizontal surface (W/m²). */
export function dailyMeanToaInsolation(latDeg: number, ls: number): number {
  const phi = latDeg * DEG;
  const delta = solarDeclinationDeg(ls) * DEG;
  const r = heliocentricDistanceAU(ls);
  const cosH0 = -Math.tan(phi) * Math.tan(delta);
  let h0: number;
  if (cosH0 >= 1) h0 = 0; // polar night
  else if (cosH0 <= -1) h0 = Math.PI; // polar day
  else h0 = Math.acos(cosH0);
  const q = (SOLAR_CONSTANT_1AU / (r * r) / Math.PI) * (h0 * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(h0));
  return Math.max(0, q);
}

/**
 * Global (direct + diffuse) transmission of a dusty atmosphere for daily-mean
 * insolation. MODEL ASSUMPTION: T(τ) = exp(−0.45 τ), chosen so that τ ≈ 0.5 keeps
 * ~80 % of the flux while a planet-encircling storm (τ ≳ 10, Opportunity 2018)
 * leaves only a few percent.
 */
export function dustTransmission(tau: number): number {
  return Math.exp(-0.45 * Math.max(0, tau));
}

export function surfaceInsolation(latDeg: number, ls: number, tau: number): number {
  return dailyMeanToaInsolation(latDeg, ls) * dustTransmission(tau);
}

/** Annual mean of daily insolation at a latitude for a fixed optical depth (W/m²). */
export function annualMeanSurfaceInsolation(latDeg: number, tau = 0.5, steps = 72): number {
  let sum = 0;
  for (let i = 0; i < steps; i += 1) sum += surfaceInsolation(latDeg, (i / steps) * 360, tau);
  return sum / steps;
}
