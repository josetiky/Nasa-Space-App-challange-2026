/**
 * Shared domain types for MARS // SURVIVE — Intelligent Mission Control.
 * Coordinates are planetocentric degrees, east-positive, longitude in [-180, 180).
 */

export type DataType = "REAL" | "DERIVED" | "MODELLED" | "SIMULATED";

export interface Provenance {
  dataType: DataType;
  source: string;
  period?: string;
  resolution?: string;
  url?: string;
  notes?: string;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface SiteRef {
  id: string;
  name: string;
  point: GeoPoint;
  kind: "catalogue" | "custom";
  region?: string;
}

/* ------------------------------------------------------------------ */
/* Site environment and location analysis                              */
/* ------------------------------------------------------------------ */

export interface SiteEnvironment {
  point: GeoPoint;
  /** MOLA MEGDR elevation relative to the areoid (m); null when the grid is unavailable. */
  elevationM: number | null;
  /** Regional slope from the 4 px/deg grid (deg, ~15 km baseline). */
  slopeDeg: number | null;
  /** Max − min elevation in the 3×3 neighbourhood (m). */
  reliefM: number | null;
  meanPressurePa: number;
  /** Atmospheric column above the site (g/cm²) = P / g. */
  shieldingGcm2: number;
  /** Modelled GCR dose equivalent rate (mSv/sol). */
  gcrDoseMsvPerSol: number;
  annualMeanTempC: number;
  /** Typical diurnal temperature range (K). */
  diurnalRangeK: number;
  /** Annual-mean surface insolation on a horizontal surface, clear season (W/m²). */
  solarAnnualMeanWm2: number;
  /** 0..1 qualitative proxy (latitude stability + documented mid-latitude ice regions). */
  iceLikelihood: number;
  /** 0..1 qualitative storm-activity proxy (literature storm tracks). */
  dustActivity: number;
  /** 0..1 proximity to documented science / resource targets. */
  scienceValue: number;
  nearestTarget: { name: string; distanceKm: number } | null;
  elevationSource: "mola" | "unavailable";
}

export interface LocationScores {
  landingSafety: number;
  radiationProtection: number;
  thermal: number;
  solarPower: number;
  water: number;
  science: number;
  habitability: number;
  risk: number;
}

export interface LocationAnalysis {
  site: SiteRef;
  environment: SiteEnvironment;
  scores: LocationScores;
  flags: Array<{ level: "info" | "caution" | "danger"; text: string }>;
  computedAt: string;
}

/* ------------------------------------------------------------------ */
/* EVA planning (Access Mars terrain, metres in the site frame)        */
/* ------------------------------------------------------------------ */

export interface EvaWaypoint {
  id: string;
  x: number;
  y: number;
  z: number;
  poiId?: string;
}

export interface EvaSegment {
  fromId: string;
  toId: string;
  distanceM: number;
  climbM: number;
  maxSlopeDeg: number;
  minutes: number;
}

export interface EvaPlan {
  siteId: string;
  siteName: string;
  waypoints: EvaWaypoint[];
  segments: EvaSegment[];
  profile: Array<{ distanceM: number; elevationM: number; slopeDeg: number }>;
  distanceM: number;
  elevationGainM: number;
  maxSlopeDeg: number;
  meanSlopeDeg: number;
  durationMin: number;
  o2Kg: number;
  hazards: string[];
  poisVisited: string[];
  scienceValue: number;
}

/* ------------------------------------------------------------------ */
/* Mission plan                                                         */
/* ------------------------------------------------------------------ */

export type HabitatType = "surface" | "regolith" | "lavaTube";
export type PowerSource = "solar" | "fission" | "hybrid";
export type RiskPosture = "conservative" | "balanced" | "aggressive";
export type ScenarioId = "nominal" | "dust-season" | "harsh" | "training";

export interface PowerConfig {
  source: PowerSource;
  solarAreaM2: number;
  fissionUnits: number;
  batteryKWh: number;
}

export interface MissionPlan {
  id: string;
  name: string;
  objective: string;
  site: SiteRef;
  environment: SiteEnvironment;
  durationSols: number;
  crewSize: number;
  habitat: HabitatType;
  power: PowerConfig;
  supplies: { oxygenKg: number; waterKg: number; foodCrewDays: number; spareParts: number };
  isru: { oxygenKgPerSol: number; waterKgPerSol: number };
  eva: EvaPlan | null;
  evaEverySols: number;
  riskPosture: RiskPosture;
  scenario: ScenarioId;
  eventMultipliers: Partial<Record<EventType, number>>;
  seed: number;
  startMsd: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Simulation                                                           */
/* ------------------------------------------------------------------ */

export type SystemId = "lifeSupport" | "power" | "habitat" | "comms" | "rover" | "isru";

export type EventType =
  | "dustStorm"
  | "powerFailure"
  | "commsLoss"
  | "habitatDamage"
  | "oxygenLeak"
  | "waterFailure"
  | "vehicleFailure"
  | "medical"
  | "sep"
  | "discovery";

export interface Resources {
  oxygenKg: number;
  waterKg: number;
  foodCrewDays: number;
  batteryKWh: number;
  spareParts: number;
}

export interface CrewState {
  size: number;
  health: number;
  morale: number;
  doseMsv: number;
}

export interface EnvironmentToday {
  ls: number;
  tau: number;
  insolationWm2: number;
  tempMinC: number;
  tempMaxC: number;
  pressurePa: number;
  doseRateMsv: number;
  sepActive: boolean;
  commsUp: boolean;
}

export interface EffectMods {
  powerGenFactor?: number;
  demandKw?: number;
  o2LossKgPerSol?: number;
  waterLossKgPerSol?: number;
  isruFactor?: number;
  isruWaterFactor?: number;
  eclssFactor?: number;
  waterRecoveryFactor?: number;
  waterUseFactor?: number;
  foodUseFactor?: number;
  doseFactor?: number;
  healthPerSol?: number;
  moralePerSol?: number;
  sciencePerSol?: number;
  commsDown?: boolean;
  evaBlocked?: boolean;
  tauAdd?: number;
  heatLossFactor?: number;
  systemWearPerSol?: Partial<Record<SystemId, number>>;
}

export interface ActiveEffect {
  id: string;
  source: EventType | "action";
  label: string;
  remainingSols: number;
  mods: EffectMods;
}

export interface ImmediateEffect {
  resources?: Partial<Resources>;
  systems?: Partial<Record<SystemId, number>>;
  crew?: Partial<Pick<CrewState, "health" | "morale" | "doseMsv">>;
  science?: number;
  evaHours?: number;
  /** Panel cleanliness change (0..1 scale, additive). */
  panelCleanliness?: number;
}

export type ActionTag =
  | "eva"
  | "repair"
  | "load-shed"
  | "relocate"
  | "shelter"
  | "medical"
  | "science"
  | "isru"
  | "ration"
  | "defer"
  | "comms";

export interface ActionOption {
  id: string;
  label: string;
  summary: string;
  tags: ActionTag[];
  immediate: ImmediateEffect;
  ongoing?: { label: string; sols: number; mods: EffectMods };
  /** Stochastic complication resolved with the seeded RNG. */
  risk?: { probability: number; label: string; effect: ImmediateEffect };
  /** Removes the event's own ongoing effect (e.g. a repair). */
  endsEventEffect?: boolean;
  /** Shortens the event's ongoing effect by a fraction (0..1). */
  shortensEventEffect?: number;
  requires?: { systems?: Partial<Record<SystemId, number>>; spareParts?: number; commsUp?: boolean; evaAllowed?: boolean };
}

export interface MissionEvent {
  id: string;
  type: EventType;
  sol: number;
  severity: 1 | 2 | 3;
  title: string;
  description: string;
  options: ActionOption[];
  defaultOptionId: string;
  eventEffect?: { label: string; sols: number; mods: EffectMods };
  immediate?: ImmediateEffect;
}

export type LogKind = "info" | "event" | "decision" | "warning" | "critical" | "success";

export interface LogEntry {
  sol: number;
  kind: LogKind;
  text: string;
}

export interface SolSnapshot {
  sol: number;
  oxygenKg: number;
  waterKg: number;
  foodCrewDays: number;
  batteryKWh: number;
  energyBalanceKWh: number;
  health: number;
  morale: number;
  doseMsv: number;
  habitatTempC: number;
  tau: number;
  science: number;
  systemsMin: number;
  integrity: number;
}

export type SimStatus = "running" | "awaiting-decision" | "success" | "compromised" | "failed";

export interface DecisionRecord {
  sol: number;
  eventType: EventType;
  eventTitle: string;
  optionId: string;
  optionLabel: string;
  recommendedId: string | null;
  followedRecommendation: boolean | null;
  complication: string | null;
}

export interface SimContext {
  missionName: string;
  siteName: string;
  crewSize: number;
  habitat: HabitatType;
  power: PowerConfig;
  isru: MissionPlan["isru"];
  environment: SiteEnvironment;
  startMsd: number;
  evaEverySols: number;
  evaPlan: EvaPlan | null;
  scenario: ScenarioId;
  eventMultipliers: Partial<Record<EventType, number>>;
  riskPosture: RiskPosture;
  capacities: { oxygenKg: number; waterKg: number; batteryKWh: number };
  initial: Resources;
}

export interface SimState {
  planId: string;
  seed: number;
  sol: number;
  durationSols: number;
  status: SimStatus;
  resources: Resources;
  systems: Record<SystemId, number>;
  crew: CrewState;
  habitatTempC: number;
  panelCleanliness: number;
  science: number;
  scienceTarget: number;
  env: EnvironmentToday;
  effects: ActiveEffect[];
  pending: MissionEvent | null;
  log: LogEntry[];
  history: SolSnapshot[];
  decisions: DecisionRecord[];
  incidents: Array<{ sol: number; type: EventType; title: string; severity: number }>;
  consumption: {
    oxygenKg: number;
    waterKg: number;
    foodCrewDays: number;
    energyKWh: number;
    producedOxygenKg: number;
    producedWaterKg: number;
    sparePartsUsed: number;
  };
  failureCause: string | null;
  lowMarginSols: number;
  evaHours: number;
  ctx: SimContext;
}

/* ------------------------------------------------------------------ */
/* Decision engine                                                      */
/* ------------------------------------------------------------------ */

export type CriterionId = "survival" | "reserves" | "health" | "morale" | "cost" | "science" | "risk";

export interface RuleHit {
  ruleId: string;
  effect: "veto" | "penalty" | "bonus" | "note";
  weight: number;
  message: string;
}

export interface TrajectoryPoint {
  sol: number;
  oxygenSols: number;
  waterSols: number;
  batteryKWh: number;
  health: number;
}

export interface AlternativeEvaluation {
  optionId: string;
  label: string;
  feasible: boolean;
  rules: RuleHit[];
  metrics: {
    survivalProbability: number;
    minReserveSols: number;
    expectedHealth: number;
    expectedMorale: number;
    resourceCost: number;
    scienceDelta: number;
    riskIndex: number;
    complicationProbability: number;
  };
  normalized: Record<CriterionId, number>;
  contributions: Record<CriterionId, number>;
  ruleAdjustment: number;
  score: number;
  trajectory: TrajectoryPoint[];
  consequences: string[];
}

export interface DecisionAnalysis {
  eventId: string;
  eventType: EventType;
  eventTitle: string;
  sol: number;
  horizonSols: number;
  samples: number;
  posture: RiskPosture;
  weights: Record<CriterionId, number>;
  risks: Array<{ level: "info" | "caution" | "danger"; text: string }>;
  criticalResources: string[];
  alternatives: AlternativeEvaluation[];
  recommendedId: string;
  rationale: string[];
  computedAt: string;
  deterministicKey: string;
}

/* ------------------------------------------------------------------ */
/* Reports                                                              */
/* ------------------------------------------------------------------ */

export interface MissionReport {
  id: string;
  planId: string;
  missionName: string;
  siteName: string;
  outcome: "success" | "compromised" | "failed";
  solsCompleted: number;
  durationSols: number;
  crewSize: number;
  finalHealth: number;
  finalMorale: number;
  doseMsv: number;
  science: number;
  scienceTarget: number;
  failureCause: string | null;
  decisions: DecisionRecord[];
  incidents: SimState["incidents"];
  consumption: SimState["consumption"];
  finalResources: Resources;
  keyFactors: string[];
  history: SolSnapshot[];
  generatedAt: string;
  seed: number;
}
