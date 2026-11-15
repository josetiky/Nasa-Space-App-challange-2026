/**
 * Mars Trek · Envolvente de seguridad (ROUTING_ALGORITHM §5.1).
 * Invariantes:
 * - INV-S1: gana siempre lo más restrictivo (mínimo para límites numéricos, intersección para zonas, máximo rango de confianza).
 * - INV-S2: tipo opaco que exige una NavigationDirective vigente; Z5 nunca entra en allowedZones.
 */
import type {
  ConfidenceClass,
  ConstraintSource,
  GoalPolicy,
  MissionProfileId,
  NavigationDirective,
  ResourceState,
  SafetyEnvelope,
  SAFETY_ENVELOPE_BRAND,
  VehicleProfileId,
  ZoneClass,
} from "../contracts";
import { confidenceRank } from "../contracts";
import { MIN_CONFIDENCE_FOR_PROFILE } from "../confidence/score";
import type { CostmapSnapshot } from "../costmap/snapshot";
import { TREK_PARAMS } from "../params";

export interface VehicleLimitsConfig {
  readonly vehicleId?: VehicleProfileId;
  readonly maxSlopeDeg: number;
  readonly allowedZones?: readonly ZoneClass[];
}

export interface ZonePolicyConfig {
  readonly allowedZones?: readonly ZoneClass[];
  readonly allowRestrictedZ4?: boolean;
  readonly allowHighRiskZ2?: boolean;
  readonly slopeMode?: "cell-and-edge" | "edge";
}

export const VEHICLE_LIMITS: Readonly<Record<VehicleProfileId, VehicleLimitsConfig>> = {
  "crew-foot": {
    vehicleId: "crew-foot",
    maxSlopeDeg: TREK_PARAMS.maxSlopeFootNormalDeg.value,
    allowedZones: ["Z0", "Z1"],
  },
  "crew-loaded": {
    vehicleId: "crew-loaded",
    maxSlopeDeg: TREK_PARAMS.maxSlopeFootNormalDeg.value,
    allowedZones: ["Z0", "Z1"],
  },
  "rover-crewed": {
    vehicleId: "rover-crewed",
    maxSlopeDeg: TREK_PARAMS.maxSlopeFootNormalDeg.value, // INV-S1: min(30° rover, 20° tripulación)
    allowedZones: ["Z0", "Z1"],
  },
  "rover-auto": {
    vehicleId: "rover-auto",
    maxSlopeDeg: TREK_PARAMS.maxSlopeRoverAutoDeg.value,
    allowedZones: ["Z0", "Z1", "Z2"],
  },
};

const GOAL_POLICY_PRIORITY: Readonly<Record<GoalPolicy, number>> = {
  "keep-goal": 0,
  "nearest-safe-waypoint": 1,
  "nearest-shelter": 2,
  "hold-position": 3,
};

function mostRestrictiveGoalPolicy(a: GoalPolicy, b: GoalPolicy): GoalPolicy {
  return GOAL_POLICY_PRIORITY[a] >= GOAL_POLICY_PRIORITY[b] ? a : b;
}

function stricterConfidence(a: ConfidenceClass, b: ConfidenceClass): ConfidenceClass {
  return confidenceRank(a) >= confidenceRank(b) ? a : b;
}

const RUNTIME_ENVELOPE_SYMBOL = Symbol.for("mars-trek:safety-envelope");

export function isSafetyEnvelope(value: unknown): value is SafetyEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[RUNTIME_ENVELOPE_SYMBOL] === true
  );
}

/**
 * Compone la envolvente de seguridad a partir del perfil de misión, límites del vehículo,
 * reglas de zona, directiva de salud (obligatoria), recursos e instantánea del costmap.
 * Gana siempre la restricción más estricta (INV-S1) y Z5 queda excluida siempre.
 */
export function composeEnvelope(
  mission: MissionProfileId,
  vehicle: VehicleLimitsConfig | VehicleProfileId,
  zoneRules: ZonePolicyConfig,
  directive: NavigationDirective,
  resources: ResourceState,
  snapshot: CostmapSnapshot,
): SafetyEnvelope {
  if (!directive || typeof directive.directiveId !== "string" || !directive.limits) {
    throw new Error("INV-S2 violation: composeEnvelope requires a valid NavigationDirective");
  }

  const veh: VehicleLimitsConfig = typeof vehicle === "string" ? VEHICLE_LIMITS[vehicle] : vehicle;

  const sources: ConstraintSource[] = [];

  // 1. Pendiente máxima: mínimo entre vehículo y directiva de salud
  const maxSlopeDeg = Math.min(veh.maxSlopeDeg, directive.limits.maxSlopeDeg);
  if (directive.limits.maxSlopeDeg <= veh.maxSlopeDeg) {
    sources.push({
      module: "health",
      ruleId: `FSM-${directive.state}`,
      summary: `Límite de pendiente ${directive.limits.maxSlopeDeg}° impuesto por estado ${directive.state}`,
    });
  } else {
    sources.push({
      module: "vehicle",
      ruleId: veh.vehicleId ?? "vehicle-slope",
      summary: `Límite físico de pendiente ${veh.maxSlopeDeg}° del vehículo`,
    });
  }

  // 2. Zonas permitidas: intersección entre vehículo, misión/reglas y directiva de salud; Z5 nunca permitida
  const missionZones = new Set<ZoneClass>(
    zoneRules.allowedZones ?? [
      "Z0",
      "Z1",
      ...(zoneRules.allowHighRiskZ2 ? (["Z2"] as const) : []),
      ...(zoneRules.allowRestrictedZ4 ? (["Z4"] as const) : []),
    ],
  );
  const vehZones = new Set<ZoneClass>(veh.allowedZones ?? ["Z0", "Z1"]);
  const healthZones = new Set<ZoneClass>(directive.limits.allowedZones);

  const allowedZones = new Set<ZoneClass>();
  for (const z of ["Z0", "Z1", "Z2", "Z3", "Z4"] as const) {
    if (missionZones.has(z) && vehZones.has(z) && healthZones.has(z)) {
      allowedZones.add(z);
    }
  }
  // Garantizar que Z5 jamás entre en allowedZones (INV-R3 / DYNAMIC_COSTMAP §7.1)
  allowedZones.delete("Z5");

  sources.push({
    module: "zones",
    ruleId: "ZN-MASK",
    summary: `Zonas admitidas: ${[...allowedZones].join(", ") || "ninguna"} (Z5 prohibida siempre)`,
  });

  // 3. Confianza mínima: la más estricta entre perfil de misión y directiva de salud
  const profileMinConf = MIN_CONFIDENCE_FOR_PROFILE[mission];
  const minConfidence = stricterConfidence(profileMinConf, directive.limits.minConfidence);
  sources.push({
    module:
      confidenceRank(directive.limits.minConfidence) >= confidenceRank(profileMinConf)
        ? "health"
        : "mission",
    ruleId: "CONF-MIN",
    summary: `Confianza mínima requerida ${minConfidence}`,
  });

  // 4. Política de meta: directiva de salud, alerta SEP en costmap o agotamiento de recursos
  let goalPolicy: GoalPolicy = directive.goalPolicy;
  if (snapshot.dynamic.sepAlertActive && mission !== "rover") {
    goalPolicy = mostRestrictiveGoalPolicy(goalPolicy, "nearest-shelter");
    sources.push({
      module: "costmap",
      ruleId: "ZN-07 / EVA-13",
      summary: "Alerta de partículas solares activa: desvío obligatorio a refugio blindado",
    });
  }
  if (resources.o2Source === "SEC" || resources.limiting.minutes <= 15) {
    goalPolicy = mostRestrictiveGoalPolicy(goalPolicy, "nearest-shelter");
    sources.push({
      module: "resources",
      ruleId: "EVA-01 / EVA-03",
      summary: `Recurso limitante crítico (${resources.limiting.resource}: ${resources.limiting.minutes.toFixed(0)} min)`,
    });
  }

  // 5. Alcance máximo estimado según consumible limitante y velocidad
  const speedFactor = Math.max(0.1, Math.min(1, directive.limits.speedFactor));
  const usableMin = Math.max(0, resources.limiting.minutes - 15);
  const maxWalkDistanceM =
    usableMin * (TREK_PARAMS.flatSpeedPandolfKmh.value / 60) * 1000 * speedFactor;
  const maxDistanceM =
    directive.limits.maxDistanceToShelterM !== undefined
      ? Math.min(maxWalkDistanceM, directive.limits.maxDistanceToShelterM * 2)
      : maxWalkDistanceM;

  const envelopeId = `env-${snapshot.version}-${directive.directiveId}-${maxSlopeDeg.toFixed(1)}-${minConfidence}-${goalPolicy}`;

  const envObj = {
    [RUNTIME_ENVELOPE_SYMBOL]: true,
    envelopeId,
    costmapVersion: snapshot.version,
    maxSlopeDeg,
    allowedZones,
    minConfidence,
    speedFactor,
    strainFactor: Math.max(1, directive.strainFactor),
    weightMultipliers: { ...directive.weightMultipliers },
    goalPolicy,
    shelters: snapshot.dynamic.shelters,
    maxDistanceM,
    slopeMode: zoneRules.slopeMode ?? "cell-and-edge",
    sources,
    directive,
  };

  return envObj as unknown as SafetyEnvelope;
}
