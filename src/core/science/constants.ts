/**
 * Physical, biological and engineering constants.
 *
 * Every value carries its origin. "ASSUMPTION" marks engineering choices made
 * for this planning sandbox; they are not NASA requirements and are listed in
 * docs/SIMULATION_MODEL.md so they can be challenged and replaced.
 */

export const MARS = {
  /** Mean volumetric radius (m) — NASA Mars Fact Sheet. */
  radiusM: 3_389_500,
  /** Equatorial radius used by MOLA MEGDR products (m) — PDS label A_AXIS_RADIUS. */
  molaReferenceRadiusM: 3_396_000,
  /** Surface gravity (m/s²) — NASA Mars Fact Sheet. */
  gravity: 3.71,
  /** Mean solar day (s) — Allison & McEwen (2000). */
  solSeconds: 88_775.244,
  /** Mean solar day (h). */
  solHours: 88_775.244 / 3600,
  /** Atmospheric scale height (m) — NASA Mars Fact Sheet (11.1 km). */
  scaleHeightM: 11_100,
  /** Obliquity (deg) — NASA Mars Fact Sheet. */
  obliquityDeg: 25.19,
  /** Orbital eccentricity — NASA Mars Fact Sheet. */
  eccentricity: 0.0934,
  /** Semi-major axis (AU) — NASA Mars Fact Sheet (1.52366 AU). */
  semiMajorAxisAU: 1.52366,
  /** Areocentric longitude of perihelion (deg) — Allison & McEwen (2000), Ls ≈ 251°. */
  perihelionLsDeg: 251,
} as const;

/** Total solar irradiance at 1 AU (W/m²) — Kopp & Lean (2011). */
export const SOLAR_CONSTANT_1AU = 1361;

/** Crew metabolic needs — NASA Life Support Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570/REV1 (Anderson et al., 2018). */
export const CREW_NEEDS = {
  oxygenKgPerDay: 0.816,
  potableWaterKgPerDay: 2.5,
  hygieneWaterKgPerDay: 0.4,
  /** Edible food mass (kg/crew-day); the simulator tracks food as crew-days. */
  foodKgPerDay: 1.51,
} as const;

export const RADIATION = {
  /** MSL-RAD surface dose equivalent rate at Gale, first 300 sols (mSv/day) — Hassler et al. (2014), Science 343. */
  radGaleDoseEqMsvPerDay: 0.64,
  radGaleDoseEqUncertainty: 0.12,
  /** Career effective dose limit (mSv) — NASA-STD-3001 Vol. 1 Rev. B. */
  careerLimitMsv: 600,
  /** Short-term SPE limit per event (mSv) — NASA-STD-3001 Vol. 1 Rev. B. */
  sepEventLimitMsv: 250,
  /**
   * ASSUMPTION: sensitivity of GCR dose to atmospheric column, D ∝ (P_ref / P)^k.
   * Guo et al. (2015, arXiv:1507.03473) report the anticorrelation between RAD dose and
   * surface pressure; k = 0.25 is a conservative planning value, not a fitted constant.
   */
  pressureExponent: 0.25,
  /** Reference pressure for the RAD baseline (Pa): Gale, early mission (REMS ~850 Pa). ASSUMPTION within the REMS range. */
  referencePressurePa: 850,
  /** SEP dose multipliers by tier — inherited from the original Sol-by-Sol model (MODEL ASSUMPTION). */
  sepMultipliers: { 1: 1, 2: 4, 3: 12 } as Record<1 | 2 | 3, number>,
  /** SEP episodes per Earth year in the bundled DONKI 2024 snapshot (25), halved for Mars geometry as in Sol by Sol. */
  sepEpisodesPerYear: 25,
} as const;

export const LIFE_SUPPORT = {
  /** Water recovery demonstrated on the ISS ECLSS in 2023 (fraction) — NASA, June 2023. */
  issWaterRecovery: 0.98,
  /** ASSUMPTION: fraction of metabolic O₂ regenerated from CO₂ (Sabatier-class closure). */
  oxygenRegeneration: 0.5,
  /** ASSUMPTION: stored O₂ reserve kept for emergencies, not counted as usable margin (sols). */
  reserveSolsWarning: 5,
} as const;

export const POWER = {
  /** ASSUMPTION: photovoltaic array efficiency (triple-junction class, end of life). */
  pvEfficiency: 0.25,
  /** Dust deposition on panels (fraction per sol) — Mars Pathfinder MAE, Landis & Jenkins (2000): ~0.28 %/sol. */
  dustDepositionPerSol: 0.0028,
  /** ASSUMPTION: 10 kWe-class fission unit (NASA Kilopower concept range 1–10 kWe). */
  fissionKwePerUnit: 10,
  /** ASSUMPTION: habitat base electrical load (kW) and per-crew load (kW). */
  habitatBaseKw: 6,
  perCrewKw: 1.2,
  /** ASSUMPTION: energy to produce 1 kg of O₂ by CO₂ electrolysis at scale (kWh/kg). MOXIE peaked at 12 g/h (NASA/JPL 2023). */
  isruOxygenKWhPerKg: 15,
  /** ASSUMPTION: energy to mine and purify 1 kg of water from ground ice (kWh/kg). */
  isruWaterKWhPerKg: 1.5,
  /** ASSUMPTION: habitat heat-loss coefficient UA (kW/K) by habitat type. */
  heatLossKwPerK: { surface: 0.08, regolith: 0.05, lavaTube: 0.03 } as Record<"surface" | "regolith" | "lavaTube", number>,
  /** Habitat set-point (°C). */
  habitatSetpointC: 21,
  /** ASSUMPTION: share of the base electrical load released as heat inside the habitat. */
  internalGainFraction: 0.7,
  /** Resting crew metabolic heat (kW per person, ~100 W — standard physiology). */
  crewMetabolicHeatKw: 0.1,
  /** ASSUMPTION: fraction of the gap to thermal equilibrium closed per sol (habitat thermal mass). */
  habitatThermalResponse: 0.3,
} as const;

export const HABITAT_SHIELDING = {
  /** Fraction of surface GCR dose removed by the habitat — inherited from Sol by Sol (MODEL ASSUMPTION). */
  surface: 0.1,
  regolith: 0.4,
  lavaTube: 0.7,
} as const;

export const EVA = {
  /** ASSUMPTION: flat-ground suited walking speed (km/h); Apollo lunar EVAs averaged a few km/h. */
  baseSpeedKmh: 3.0,
  /** Energy equivalent of oxygen ≈ 20.1 kJ per litre O₂ (standard physiology); 1 kg O₂ ≈ 700 L. */
  kjPerKgO2: 20.1 * 700,
  /** ASSUMPTION: metabolic rate walking on flat ground in a suit (W) and extra per degree of slope. */
  metabolicBaseW: 300,
  metabolicPerSlopeDegW: 12,
  /** ASSUMPTION: planning thresholds for suited traverse slopes (deg). */
  cautionSlopeDeg: 15,
  noGoSlopeDeg: 25,
  /** ASSUMPTION: minutes of science work per point of interest. */
  stopMinutes: 20,
} as const;

/** Dust optical depth baseline outside storms — qualitative climatology (Montabone et al. 2015): ~0.5 clear season, higher in Ls 180–360. MODEL. */
export const DUST = {
  clearSeasonTau: 0.5,
  dustySeasonExtraTau: 0.35,
} as const;
