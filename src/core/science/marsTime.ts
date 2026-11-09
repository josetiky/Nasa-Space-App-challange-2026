/**
 * Mars time — implementation of the Mars24 algorithm
 * (Allison & McEwen 2000, Planet. Space Sci. 48; NASA GISS "Mars24 Sunclock" technical notes).
 */

const PERTURBERS: ReadonlyArray<[number, number, number]> = [
  [0.0071, 2.2353, 49.409],
  [0.0057, 2.7543, 168.173],
  [0.0039, 1.1177, 191.837],
  [0.0037, 15.7866, 21.736],
  [0.0021, 2.1354, 15.704],
  [0.002, 2.4694, 95.528],
  [0.0018, 32.8493, 49.095],
];

const DEG = Math.PI / 180;

/** TT − UTC in seconds (37 leap seconds + 32.184 s since 2017-01-01). */
export const TT_MINUS_UTC_S = 69.184;

export interface MarsTime {
  julianDateTT: number;
  /** Mars Sol Date. */
  msd: number;
  /** Coordinated Mars Time (hours, 0–24) — mean solar time at the prime meridian. */
  mtcHours: number;
  /** Areocentric solar longitude Ls (deg, 0–360). */
  ls: number;
  /** Equation of time (deg). */
  eotDeg: number;
  /** Mars year (Clancy et al. 2000 numbering, MY1 began 1955-04-11). */
  marsYear: number;
}

function mod(value: number, m: number): number {
  return ((value % m) + m) % m;
}

export function marsTimeFromDate(date: Date, ttMinusUtcS: number = TT_MINUS_UTC_S): MarsTime {
  const jdUT = 2440587.5 + date.getTime() / 8.64e7;
  const jdTT = jdUT + ttMinusUtcS / 86400;
  const dt = jdTT - 2451545.0;
  const M = 19.3871 + 0.52402073 * dt;
  const alphaFMS = 270.3871 + 0.524038496 * dt;
  let pbs = 0;
  for (const [A, tau, phi] of PERTURBERS) pbs += A * Math.cos(((0.985626 * dt) / tau + phi) * DEG);
  const nuMinusM =
    (10.691 + 3.0e-7 * dt) * Math.sin(M * DEG) +
    0.623 * Math.sin(2 * M * DEG) +
    0.05 * Math.sin(3 * M * DEG) +
    0.005 * Math.sin(4 * M * DEG) +
    0.0005 * Math.sin(5 * M * DEG) +
    pbs;
  const ls = mod(alphaFMS + nuMinusM, 360);
  const eotDeg = 2.861 * Math.sin(2 * ls * DEG) - 0.071 * Math.sin(4 * ls * DEG) + 0.002 * Math.sin(6 * ls * DEG) - nuMinusM;
  const msd = (jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626;
  const mtcHours = mod(24 * msd, 24);
  return { julianDateTT: jdTT, msd, mtcHours, ls, eotDeg, marsYear: marsYearFromMsd(msd, ls) };
}

/** Mean tropical Mars year (686.9726 days) in sols. */
const TROPICAL_YEAR_SOLS = 686.9726 / 1.0274912517;
/** MSD at 2022-12-26 00:00 UTC, the northern spring equinox that began MY 37 (Clancy et al. numbering). */
const MY37_START_MSD = 52961.52;

/**
 * Mars year number (Clancy et al. 2000; MY 1 began 1955-04-11). Counted from the
 * MY 37 equinox with the tropical year; when Ls is given, dates within ~10 % of a
 * year boundary are snapped to the side indicated by Ls (equinox at Ls = 0).
 */
export function marsYearFromMsd(msd: number, ls?: number): number {
  const estimate = 37 + (msd - MY37_START_MSD) / TROPICAL_YEAR_SOLS;
  let my = Math.floor(estimate);
  if (ls !== undefined) {
    const frac = estimate - my;
    if (frac < 0.1 && ls > 300) my -= 1;
    else if (frac > 0.9 && ls < 60) my += 1;
  }
  return my;
}

/**
 * Approximate Ls for a Mars Sol Date by inverting the Mars24 relations
 * (used by the simulator to advance seasons sol by sol).
 */
export function lsFromMsd(msd: number): number {
  const jdTT = (msd - 44796.0 + 0.0009626) * 1.0274912517 + 2451549.5;
  const dt = jdTT - 2451545.0;
  const M = 19.3871 + 0.52402073 * dt;
  const alphaFMS = 270.3871 + 0.524038496 * dt;
  let pbs = 0;
  for (const [A, tau, phi] of PERTURBERS) pbs += A * Math.cos(((0.985626 * dt) / tau + phi) * DEG);
  const nuMinusM =
    (10.691 + 3.0e-7 * dt) * Math.sin(M * DEG) +
    0.623 * Math.sin(2 * M * DEG) +
    0.05 * Math.sin(3 * M * DEG) +
    0.005 * Math.sin(4 * M * DEG) +
    0.0005 * Math.sin(5 * M * DEG) +
    pbs;
  return mod(alphaFMS + nuMinusM, 360);
}

/** Local mean solar time (hours) at an east longitude. */
export function localMeanSolarTime(mtcHours: number, lonEastDeg: number): number {
  return mod(mtcHours + lonEastDeg / 15, 24);
}

/** Local true solar time (hours). */
export function localTrueSolarTime(mtcHours: number, lonEastDeg: number, eotDeg: number): number {
  return mod(localMeanSolarTime(mtcHours, lonEastDeg) + eotDeg / 15, 24);
}

export function formatHours(hours: number): string {
  const total = Math.floor(mod(hours, 24) * 3600);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Northern-hemisphere season name for an Ls value. */
export function seasonName(ls: number, latitude = 0): string {
  const northern = ["Spring", "Summer", "Autumn", "Winter"];
  const index = Math.floor(mod(ls, 360) / 90);
  const name = latitude >= 0 ? northern[index] : northern[(index + 2) % 4];
  return `${latitude >= 0 ? "Northern" : "Southern"} ${(name ?? "Spring").toLowerCase()}`;
}

/** Dusty season (Ls 180–360) — perihelion season with most regional/global storms. */
export function isDustySeason(ls: number): boolean {
  const value = mod(ls, 360);
  return value >= 180 && value < 360;
}
