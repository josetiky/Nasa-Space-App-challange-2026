/**
 * Mars Trek · Contratos congelados entre módulos (H1).
 * Ningún módulo de src/core/trek/ importa React, el store ni la red.
 */
import type { DataType, Provenance } from "@/core/types";

export interface LocalPoint {
  x: number;
  z: number;
}

export interface GridSpec {
  x0: number;
  z0: number;
  cell: number;
  nx: number;
  nz: number;
}

/** Clases de zona (DYNAMIC_COSTMAP §7): de Z0 (transitable) a Z5 (prohibida). */
export type ZoneClass = "Z0" | "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

const ZONE_ORDER: readonly ZoneClass[] = ["Z0", "Z1", "Z2", "Z3", "Z4", "Z5"];

/** Orden total de restricción de zona: Z0 (0) < Z1 (1) < Z2 (2) < Z3 (3) < Z4 (4) < Z5 (5). */
export function zoneRank(zone: ZoneClass): number {
  return ZONE_ORDER.indexOf(zone);
}

/** Devuelve la clase de zona más restrictiva entre dos. */
export function mostRestrictiveZone(a: ZoneClass, b: ZoneClass): ZoneClass {
  return zoneRank(a) >= zoneRank(b) ? a : b;
}

/** Clases de confianza científica (SCIENTIFIC_CONFIDENCE §2): K1 (recorrido) > ... > K5 (desconocido). */
export type ConfidenceClass = "K1" | "K2" | "K3a" | "K3b" | "K3c" | "K3d" | "K4" | "K5";

const CONFIDENCE_ORDER: readonly ConfidenceClass[] = [
  "K5",
  "K4",
  "K3d",
  "K3c",
  "K3b",
  "K3a",
  "K2",
  "K1",
];

/**
 * Orden total de confianza científica:
 * K1 (7) > K2 (6) > K3a (5) > K3b (4) > K3c (3) > K3d (2) > K4 (1) > K5 (0).
 */
export function confidenceRank(cls: ConfidenceClass): number {
  return CONFIDENCE_ORDER.indexOf(cls);
}

export function meetsMinConfidence(actual: ConfidenceClass, minRequired: ConfidenceClass): boolean {
  return confidenceRank(actual) >= confidenceRank(minRequired);
}

/** Estados de la máquina de salud de Mars Trek (ASTRONAUT_HEALTH_STATE_MACHINE §6.1). */
export type HealthState = "NORMAL" | "FATIGUE" | "CAUTION" | "CRITICAL" | "EMERGENCY";

const HEALTH_ORDER: readonly HealthState[] = [
  "NORMAL",
  "FATIGUE",
  "CAUTION",
  "CRITICAL",
  "EMERGENCY",
];

export function healthRank(state: HealthState): number {
  return HEALTH_ORDER.indexOf(state);
}

/** Niveles nativos del motor HUELLA (reglas.json). */
export type HuellaLevel = "NORMAL" | "PRECAUCION" | "SUPERVIVENCIA" | "ABORTAR";

export type CauseFlag =
  | "fatiga"
  | "termica"
  | "cardiaca"
  | "traje"
  | "ambiente"
  | "comunicaciones"
  | "radiacion"
  | "navegacion"
  | "sensores";

export type CostTermId = "D" | "T" | "R" | "E" | "U" | "H";

export interface WeightVector {
  readonly d: number;
  readonly t: number;
  readonly r: number;
  readonly e: number;
  readonly u: number;
  readonly h: number;
}

export type WeightProfileId =
  | "balanced"
  | "fastest"
  | "safest"
  | "known"
  | "resource-saving"
  | "autonomous-rover"
  | "emergency";

export type MissionProfileId = "solo" | "team" | "rover" | "rover-crew";

export type VehicleProfileId = "crew-foot" | "crew-loaded" | "rover-crewed" | "rover-auto";

export type GoalPolicy =
  "keep-goal" | "nearest-safe-waypoint" | "nearest-shelter" | "hold-position";

export type EmergencyProtocolId =
  | "sep-shelter"
  | "suit-depressurization"
  | "thermal-cardiac"
  | "dust-storm"
  | "zero-mobility-rescue";

export interface ConstraintSource {
  readonly module: "mission" | "vehicle" | "zones" | "health" | "resources" | "costmap";
  readonly ruleId: string;
  readonly summary: string;
}

export interface NavigationLimits {
  readonly maxSlopeDeg: number;
  readonly allowedZones: readonly ZoneClass[];
  readonly minConfidence: ConfidenceClass;
  readonly maxDistanceToShelterM?: number;
  readonly maxRemainingDurationMin?: number;
  readonly speedFactor: number;
  readonly requiredRest?: { everyMin: number; durationMin: number };
}

export interface NavigationDirective {
  readonly directiveId: string;
  readonly issuedAtS: number;
  readonly supersedes?: string;
  readonly subject: { kind: "crew" | "team" | "vehicle"; id: string };
  readonly state: HealthState;
  readonly causes: readonly CauseFlag[];
  readonly goalPolicy: GoalPolicy;
  readonly limits: NavigationLimits;
  readonly weightMultipliers: Partial<Record<"t" | "r" | "e" | "u" | "h", number>>;
  readonly strainFactor: number;
  /**
   * Fracción (0.3–1] de la capacidad metabólica sostenible que el astronauta conserva según sus
   * necesidades fisiológicas (health/physio.ts). Omitida = 1 (nominal). Solo afecta al término H.
   */
  readonly capacityFactor?: number;
  /**
   * Pendiente "cómoda" (grados) por necesidades fisiológicas: por encima se suma una penalización
   * cuadrática BLANDA al término T. Omitida = sin penalización extra. Nunca sustituye al límite duro.
   */
  readonly comfortSlopeDeg?: number;
  readonly fallbackLadder: ReadonlyArray<{ limits: NavigationLimits; goalPolicy: GoalPolicy }>;
  readonly protocol?: EmergencyProtocolId;
  readonly rationale: ReadonlyArray<{ ruleId: string; message: string }>;
  readonly latch: "none" | "return-mode" | "iv-lock";
  readonly requiresHumanConfirmation: boolean;
  readonly simulated: boolean;
}

/** Símbolo de marca para garantizar que SafetyEnvelope solo se construya mediante composeEnvelope (INV-S2). */
export declare const SAFETY_ENVELOPE_BRAND: unique symbol;

export interface ShelterPoint {
  readonly id: string;
  readonly name: string;
  readonly point: LocalPoint;
  readonly kind: "habitat" | "rover" | "natural-shelter" | "waypoint";
  readonly shielded: boolean;
}

export interface SafetyEnvelope {
  readonly [SAFETY_ENVELOPE_BRAND]: true;
  readonly envelopeId: string;
  readonly costmapVersion: string;
  readonly maxSlopeDeg: number;
  readonly allowedZones: ReadonlySet<ZoneClass>;
  readonly minConfidence: ConfidenceClass;
  readonly speedFactor: number;
  readonly strainFactor: number;
  /** Capacidad metabólica sostenible disponible (0.3–1], de la directiva. */
  readonly capacityFactor: number;
  /** Pendiente cómoda blanda de la directiva (Infinity = sin penalización extra). */
  readonly comfortSlopeDeg: number;
  readonly weightMultipliers: Partial<Record<"t" | "r" | "e" | "u" | "h", number>>;
  readonly goalPolicy: GoalPolicy;
  readonly shelters: readonly ShelterPoint[];
  readonly maxDistanceM?: number;
  readonly slopeMode?: "cell-and-edge" | "edge";
  readonly sources: readonly ConstraintSource[];
  readonly directive: NavigationDirective;
}

export interface EdgeContext {
  /** Pendiente en grados (positiva al subir, negativa al bajar). */
  readonly slopeDeg: number;
  /** Pendiente en porcentaje (si se omite, se deriva de slopeDeg). */
  readonly gradePct?: number;
  readonly roughness?: number;
  readonly softSoilProb?: number;
  readonly bodyMassKg?: number;
  readonly suitMassKg?: number;
  readonly payloadKg?: number;
  readonly speedFactor?: number;
}

export interface LocomotionModel {
  readonly id: "tobler-linear" | "pandolf-mars";
  speedMs(ctx: EdgeContext): number;
  metabolicW(ctx: EdgeContext): number;
  readonly provenance: Provenance;
}

export interface ResourceState {
  readonly subjectId: string;
  readonly missionTimeS: number;
  readonly o2PrimaryPsi: number;
  readonly o2PrimaryMin: number;
  readonly o2SecondaryPsi: number;
  readonly o2SecondaryMin: number;
  readonly o2Source: "PRI" | "SEC";
  readonly co2ScrubberPct: number;
  readonly co2CapacityMin: number;
  readonly coolantStoragePct: number;
  readonly coolantMin: number;
  readonly batteryWh: number;
  readonly batteryMin: number;
  readonly evaElapsedMin: number;
  readonly doseCareerMSv: number;
  readonly doseEvaMSv: number;
  readonly payloadKg: number;
  readonly limiting: {
    readonly resource: "o2" | "co2" | "coolant" | "battery";
    readonly minutes: number;
  };
  readonly simulated: boolean;
}

export interface ResourcePlan {
  readonly perSegment: ReadonlyArray<{
    readonly durationMin: number;
    readonly energyWh: number;
    readonly o2Kg: number;
    readonly doseUSv: number;
    readonly limitingAfterMin: number;
  }>;
  readonly totals: {
    readonly durationMin: number;
    readonly energyWh: number;
    readonly o2Kg: number;
    readonly doseUSv: number;
  };
  readonly returnMarginMin: number;
  readonly returnMarginPct: number;
  readonly pointOfNoReturnAtM: number | null;
  readonly modelMarginPct: number;
  readonly provenance: Provenance;
}

export interface RouteSegment {
  readonly from: LocalPoint;
  readonly to: LocalPoint;
  readonly distanceM: number;
  readonly horizontalM: number;
  readonly deltaZM: number;
  readonly slopeDeg: number;
  readonly durationMin: number;
  readonly energyWh: number;
  readonly o2Kg: number;
  readonly doseUSv: number;
  readonly zone: ZoneClass;
  readonly confidence: ConfidenceClass;
  readonly equivalentCostM: number;
}

export interface Route {
  readonly points: readonly LocalPoint[];
  readonly rawPoints: readonly LocalPoint[];
  readonly segments: readonly RouteSegment[];
  readonly distanceM: number;
  readonly horizontalM: number;
  readonly elevationGainM: number;
  readonly maxSlopeDeg: number;
  readonly rawMaxSlopeDeg: number;
  readonly durationMin: number;
  readonly energyWh: number;
  readonly o2Kg: number;
  readonly doseUSv: number;
  readonly minConfidence: ConfidenceClass;
  readonly equivalentCostM: number;
}

export interface BlockReason {
  readonly kind:
    | "slope"
    | "zone"
    | "confidence"
    | "unknown-terrain"
    | "out-of-bounds"
    | "storm"
    | "sep"
    | "reachability";
  readonly at: LocalPoint;
  readonly detail: string;
  readonly value?: number | string;
  readonly limit?: number | string;
}

export type NoRouteReason =
  | "origin-out-of-bounds"
  | "goal-out-of-bounds"
  | "origin-inadmissible"
  | "goal-inadmissible"
  | "no-safe-corridor"
  | "hold-position"
  | "envelope-mismatch";

export interface AlternativeSummary {
  readonly id: string;
  readonly label: string;
  readonly profileId: WeightProfileId;
  readonly status: "admissible" | "discarded";
  readonly route?: Route;
  readonly totals?: RouteExplanation["totals"];
  readonly contributions?: Record<CostTermId, number>;
  readonly discardReasons: readonly BlockReason[];
  readonly summary: string;
}

/** Medición de la línea recta origen→destino sobre el mismo costmap (para comparar con la ruta A*). */
export interface DirectLineSummary {
  readonly distanceM: number;
  readonly horizontalM: number;
  readonly maxSlopeDeg: number;
  readonly elevationGainM: number;
  /** Fracción de muestras sin dato de elevación (NaN) a lo largo de la recta. */
  readonly noDataFraction: number;
  readonly admissible: boolean;
}

export interface RouteExplanation {
  readonly totals: {
    readonly distanceM: number;
    readonly durationMin: number;
    readonly energyWh: number;
    readonly o2Kg: number;
    readonly doseUSv: number;
    readonly maxSlopeDeg: number;
    readonly minConfidence: ConfidenceClass;
    readonly equivalentCostM: number;
  };
  readonly contributions: Record<CostTermId, number>;
  readonly bindingConstraints: readonly ConstraintSource[];
  readonly blockedDirectPath: readonly BlockReason[];
  readonly directLine?: DirectLineSummary;
  readonly confidenceHistogramM: Record<ConfidenceClass, number>;
  readonly alternatives: readonly AlternativeSummary[];
  readonly envelopeId: string;
  readonly costmapVersion: string;
  readonly deterministicKey: string;
}

export interface RouteRequest {
  readonly requestId: string;
  readonly origin: LocalPoint;
  readonly goal: LocalPoint | null;
  readonly missionProfile: MissionProfileId;
  readonly weightProfile: WeightProfileId;
  /**
   * Preferencia del operador (pesos D,T,R,E,U,H) que sustituye al perfil base. Se valida con
   * validateWeights (INV-R1/R5) y la directiva de salud la sigue modulando: en CRITICAL/EMERGENCY
   * el planificador ignora la preferencia y usa el perfil "emergency" (seguridad > preferencia).
   */
  readonly customWeights?: WeightVector;
  readonly vehicle: VehicleProfileId;
  readonly waypoints?: readonly LocalPoint[];
  /**
   * Paradas científicas en orden (origen → paradas → destino). Solo se usan con la política
   * "keep-goal": en CRITICAL/EMERGENCY la directiva manda al refugio y las paradas se ignoran.
   */
  readonly stops?: readonly TourStop[];
}

/** Parada científica del recorrido: punto de observación seguro y tiempo de trabajo en él. */
export interface TourStop {
  readonly id: string;
  readonly name: string;
  readonly point: LocalPoint;
  /** Minutos de trabajo científico en la parada (el astronauta no camina). */
  readonly dwellMin: number;
  /** Tarea en la parada (texto libre para la interfaz). */
  readonly task?: string;
}

/** Un tramo del recorrido: de la parada anterior (o el origen) a la siguiente parada (o al destino). */
export interface TourLeg {
  /** Parada a la que llega el tramo; null = destino final. */
  readonly toStopId: string | null;
  readonly toName: string;
  readonly point: LocalPoint;
  readonly distanceM: number;
  readonly walkMin: number;
  readonly dwellMin: number;
  /** Minuto del recorrido (desde la salida) en que se llega y en que se sale de la parada. */
  readonly arriveMin: number;
  readonly departMin: number;
  /** Minutos del consumible limitante que quedan al salir de la parada (o al llegar al destino). */
  readonly remainingAtDepartMin: number;
}

export interface TourSkip {
  readonly stopId: string;
  readonly name: string;
  readonly reason: NoRouteReason;
  readonly message: string;
}

/** Plan de un recorrido con paradas: tramos, paradas omitidas y totales con el tiempo de ciencia. */
export interface TourPlan {
  readonly legs: readonly TourLeg[];
  readonly skipped: readonly TourSkip[];
  readonly walkMin: number;
  readonly dwellMin: number;
  readonly totalMin: number;
}

export type RouteResult =
  | {
      readonly ok: true;
      readonly route: Route;
      readonly explanation: RouteExplanation;
      readonly resourcePlan: ResourcePlan;
      readonly effectiveGoal: LocalPoint;
      readonly strategy: "astar";
      readonly epsilon: number;
      readonly ladderStep: number;
      readonly computeMs: number;
      /** Presente cuando la ruta pasa por paradas científicas. */
      readonly tour?: TourPlan;
    }
  | {
      readonly ok: false;
      readonly reason: NoRouteReason;
      readonly message: string;
      readonly blocked: readonly BlockReason[];
      readonly suggestions: readonly LocalPoint[];
      readonly envelopeId: string;
      readonly costmapVersion: string;
    };

export type DataQualityStatus = "valid" | "stale" | "missing" | "implausible";

export interface HealthTransition {
  readonly seq: number;
  readonly missionTimeS: number;
  readonly subjectId: string;
  readonly from: HealthState;
  readonly to: HealthState;
  readonly causes: readonly CauseFlag[];
  readonly triggers: ReadonlyArray<{
    readonly ruleId: string;
    readonly level: string;
    readonly value: number | string;
    readonly message: string;
  }>;
  readonly dataQuality: Readonly<Record<string, DataQualityStatus>>;
  readonly latch: "none" | "return-mode" | "iv-lock";
  readonly humanConfirmed?: { by: string; justification: string; atS: number };
  readonly directiveId: string;
  readonly simulated: boolean;
  readonly scenarioId?: string;
}

export interface StormPolygon {
  readonly id: string;
  readonly name: string;
  readonly center: LocalPoint;
  readonly radiusM: number;
  readonly tau: number;
  readonly active: boolean;
  readonly dataType: DataType;
}

export interface ZoneCircle {
  readonly id: string;
  readonly name: string;
  readonly center: LocalPoint;
  readonly radiusM: number;
  readonly zone: "Z4" | "Z5";
  readonly reason: string;
}

export type SimEvent =
  | { readonly kind: "storm-appear"; readonly storm: StormPolygon; readonly simulated: boolean }
  | { readonly kind: "storm-clear"; readonly stormId: string; readonly simulated: boolean }
  | {
      readonly kind: "sep-alert";
      readonly active: boolean;
      readonly doseRateMultiplier?: number;
      readonly simulated: boolean;
    }
  | { readonly kind: "dust-change"; readonly tau: number; readonly simulated: boolean }
  | {
      readonly kind: "radiation-change";
      readonly doseRateMsvPerSol: number;
      readonly simulated: boolean;
    }
  | { readonly kind: "zone-add"; readonly zone: ZoneCircle; readonly simulated: boolean }
  | { readonly kind: "battery-drop"; readonly dropPct: number; readonly simulated: boolean }
  | {
      readonly kind: "o2-leak";
      readonly dropPsi: number;
      readonly useSecondary?: boolean;
      readonly simulated: boolean;
    }
  | { readonly kind: "health-incident"; readonly incident: string; readonly simulated: boolean }
  | {
      readonly kind: "human-authorize";
      readonly by: string;
      readonly justification: string;
      readonly atShelter?: boolean;
      readonly simulated: boolean;
    }
  | { readonly kind: "set-goal"; readonly goal: LocalPoint; readonly simulated: boolean }
  | {
      readonly kind: "set-stops";
      readonly stops: readonly TourStop[];
      readonly simulated: boolean;
    }
  | { readonly kind: "set-origin"; readonly origin: LocalPoint; readonly simulated: boolean }
  | {
      readonly kind: "set-weight-profile";
      readonly profileId: WeightProfileId;
      readonly simulated: boolean;
    }
  | {
      readonly kind: "set-custom-weights";
      readonly weights: WeightVector | null;
      readonly simulated: boolean;
    }
  | { readonly kind: "request-replan"; readonly simulated: boolean };

export interface ReplanRecord {
  readonly seq: number;
  readonly atS: number;
  readonly decision: "replan" | "propose" | "keep" | "emergency" | "hold-position";
  readonly causes: readonly string[];
  readonly previousCostM: number | null;
  readonly newCostM: number | null;
  readonly improvementPct: number | null;
  readonly summary: string;
  readonly simulated: boolean;
}
