/**
 * Calibration dataset: Curiosity REMS daily weather at Gale crater, aggregated
 * into 10° solar-longitude bins (medians across all Mars years in the record).
 *
 * Source (REAL): NASA/JPL-Caltech/CAB(CSIC-INTA) REMS feed
 *   https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json
 * Rover elevation per sol: MMGIS MSL waypoints (elev_geoid), linearly interpolated
 *   https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json
 * Retrieved 2026-11-09 · sols 1–4995 (2012-08 → 2026-08) · 4717 valid sols, 28 rejected
 * (non-numeric, min ≥ max, T outside −140…40 °C or p outside 400…1300 Pa).
 *
 * Processing: daily mean = (min + max)/2. Values are referred to the model's reference
 * elevation (−4450 m): T_ref = T + 1.5 K/km · (z − z_ref), p_ref = p · exp((z − z_ref)/11.1 km),
 * so the rover's ~1 km climb up Mount Sharp does not bias the seasonal cycle.
 */
export interface RemsLsBin {
  /** Bin centre (°). */
  ls: number;
  /** Sols in the bin. */
  n: number;
  /** Median daily-mean air temperature referred to −4450 m (°C). */
  meanC: number;
  /** Median diurnal air-temperature range, max − min (K). */
  rangeK: number;
  /** Median pressure referred to −4450 m (Pa). */
  pressurePa: number;
  /** Median rover elevation in the bin (m, MOLA areoid). */
  roverElevationM: number;
  /** Median raw daily minimum / maximum air temperature (°C). */
  minC: number;
  maxC: number;
}

export const REMS_GALE_META = {
  latDeg: -4.59,
  lonDeg: 137.44,
  referenceElevationM: -4450,
  retrieved: "2026-11-09",
  sols: "1–4995",
  validSols: 4717,
  source: "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json",
  elevationSource: "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json",
  credit: "NASA/JPL-Caltech/CAB(CSIC-INTA)",
} as const;

const row = (ls: number, n: number, meanC: number, rangeK: number, pressurePa: number, roverElevationM: number, minC: number, maxC: number): RemsLsBin => ({ ls, n, meanC, rangeK, pressurePa, roverElevationM, minC, maxC });

export const REMS_GALE_LS_BINS: RemsLsBin[] = [
  row(5, 128, -43.83, 60, 853, -4157, -74, -14),
  row(15, 137, -44.71, 60, 863.4, -4158, -76, -14),
  row(25, 138, -47.57, 58.5, 875.8, -4158, -77, -18),
  row(35, 148, -48.95, 56, 887.3, -4154, -77, -22),
  row(45, 131, -50.09, 56, 895.4, -4143, -79, -23),
  row(55, 149, -51.64, 55, 902.3, -4136, -79, -25),
  row(65, 148, -53.11, 54, 899.3, -4133, -80, -28),
  row(75, 156, -54.1, 55, 888.3, -4132, -81, -28),
  row(85, 154, -54.02, 54, 867.3, -4130, -81, -28),
  row(95, 154, -53.06, 55, 839.1, -4126, -80, -27),
  row(105, 147, -51.85, 57, 811.9, -4121, -80, -25),
  row(115, 141, -50.05, 58, 785.4, -4120, -79, -22),
  row(125, 140, -47.25, 61, 764.3, -4108, -78, -18),
  row(135, 138, -45.04, 63, 748, -4109, -77.5, -14),
  row(145, 110, -43, 65, 737.4, -4152, -76, -11),
  row(155, 128, -40.97, 64, 736.6, -4124, -74, -10),
  row(165, 139, -38.47, 68, 741.4, -4093, -74, -5),
  row(175, 138, -37.13, 69, 753.5, -4090, -73, -4),
  row(185, 127, -36.51, 71, 770.6, -4106, -72, -2),
  row(195, 130, -36.1, 69, 791.1, -4187, -71, -1),
  row(205, 123, -34.51, 70, 817.9, -4164, -69, 1),
  row(215, 128, -33.13, 70, 846.6, -4134, -68, 2.5),
  row(225, 122, -34.1, 66.5, 877.2, -4164, -67, -0.5),
  row(235, 123, -33.4, 65, 899.8, -4162, -67, -1),
  row(245, 117, -35.01, 64, 913.3, -4150, -68, -2),
  row(255, 110, -35.28, 67, 917.6, -4128, -69, -2),
  row(265, 103, -35.02, 67, 914.1, -4128, -69, -2),
  row(275, 103, -35.61, 68, 906.1, -4128, -70, -2),
  row(285, 115, -36.02, 69, 892.1, -4128, -71, -3),
  row(295, 124, -35.6, 69, 879.8, -4146, -70, -2),
  row(305, 127, -37.11, 67, 868.3, -4123, -71, -4),
  row(315, 124, -37.61, 65, 857.8, -4112, -71, -6),
  row(325, 135, -38.04, 64, 848.6, -4101, -71, -7),
  row(335, 142, -38.99, 64.5, 843.5, -4141, -72, -7),
  row(345, 119, -40.5, 65, 842.2, -4150, -74, -8),
  row(355, 121, -42.26, 63, 845.7, -4152, -74, -11),
];
