/**
 * Mars Trek · Emisión de la Directiva de Navegación por estado de salud y compositor de equipo
 * (ASTRONAUT_HEALTH_STATE_MACHINE §7 y §9.1).
 */
import type {
  CauseFlag,
  ConfidenceClass,
  EmergencyProtocolId,
  GoalPolicy,
  NavigationDirective,
  NavigationLimits,
  ZoneClass,
} from "../contracts";
import { confidenceRank, healthRank } from "../contracts";
import { TREK_PARAMS } from "../params";
import type { FsmState } from "./fsm";

export interface DirectiveContext {
  readonly returnMarginPct?: number;
  readonly zeroMobility?: boolean;
}

const PHYSIOLOGICAL_CAUSES: ReadonlySet<CauseFlag> = new Set([
  "fatiga",
  "termica",
  "cardiaca",
  "traje",
  "sensores",
]);

function selectProtocol(causes: readonly CauseFlag[], zeroMobility = false): EmergencyProtocolId {
  if (zeroMobility) return "zero-mobility-rescue";
  if (causes.includes("radiacion")) return "sep-shelter";
  if (causes.includes("traje")) return "suit-depressurization";
  if (causes.includes("termica") || causes.includes("cardiaca")) return "thermal-cardiac";
  if (causes.includes("ambiente")) return "dust-storm";
  return "suit-depressurization";
}

/**
 * Construye la NavigationDirective a partir del estado de la máquina de salud (ASTRONAUT_HEALTH_STATE_MACHINE §7.2).
 * Todos los multiplicadores de peso son >= 1 (INV-H2) y la escalera de degradación de CRITICAL/EMERGENCY
 * termina siempre en 'hold-position'.
 */
export function directiveFor(fsm: FsmState, context: DirectiveContext = {}): NavigationDirective {
  const marginPct = context.returnMarginPct ?? 100;
  const directiveId = `dir-${fsm.subjectId}-${fsm.seq}-${fsm.missionTimeS}`;
  const rationale =
    fsm.activeTriggers.length > 0
      ? fsm.activeTriggers.map((t) => ({ ruleId: t.ruleId, message: t.message }))
      : [{ ruleId: `STATE-${fsm.state}`, message: `Estado operativo ${fsm.state}` }];

  switch (fsm.state) {
    case "NORMAL": {
      const limits: NavigationLimits = {
        maxSlopeDeg: TREK_PARAMS.maxSlopeFootNormalDeg.value, // 20°
        allowedZones: ["Z0", "Z1"],
        minConfidence: "K3a",
        speedFactor: 1.0,
      };
      return {
        directiveId,
        issuedAtS: fsm.missionTimeS,
        subject: { kind: "crew", id: fsm.subjectId },
        state: "NORMAL",
        causes: fsm.causes,
        goalPolicy: "keep-goal",
        limits,
        weightMultipliers: { t: 1, r: 1, e: 1, u: 1, h: 1 },
        strainFactor: 1,
        fallbackLadder: [],
        rationale,
        latch: fsm.latch,
        requiresHumanConfirmation: fsm.requiresHumanConfirmation,
        simulated: fsm.simulated,
      };
    }

    case "FATIGUE": {
      const goalPolicy: GoalPolicy = marginPct >= 20 ? "keep-goal" : "nearest-safe-waypoint";
      const limits: NavigationLimits = {
        maxSlopeDeg: TREK_PARAMS.cautionSlopeFootDeg.value, // 15°
        allowedZones: ["Z0", "Z1"],
        minConfidence: "K3a",
        speedFactor: 0.8,
        requiredRest: { everyMin: 30, durationMin: 5 },
      };
      return {
        directiveId,
        issuedAtS: fsm.missionTimeS,
        subject: { kind: "crew", id: fsm.subjectId },
        state: "FATIGUE",
        causes: fsm.causes,
        goalPolicy,
        limits,
        weightMultipliers: { t: 2, r: 1, e: 1.5, u: 1, h: 3 },
        strainFactor: 2,
        fallbackLadder: [],
        rationale,
        latch: fsm.latch,
        requiresHumanConfirmation: fsm.requiresHumanConfirmation,
        simulated: fsm.simulated,
      };
    }

    case "CAUTION": {
      const hasPhysioCause = fsm.causes.some((c) => PHYSIOLOGICAL_CAUSES.has(c));
      const commsLoss = fsm.causes.includes("comunicaciones");
      const goalPolicy: GoalPolicy =
        commsLoss || marginPct < 20 ? "nearest-safe-waypoint" : "keep-goal";

      const limits: NavigationLimits = hasPhysioCause
        ? {
            maxSlopeDeg: TREK_PARAMS.cautionSlopeLoadedDeg.value, // 10°
            allowedZones: ["Z0", "Z1"],
            minConfidence: "K3a",
            maxDistanceToShelterM: 800,
            speedFactor: 0.7,
            requiredRest: { everyMin: 20, durationMin: 5 },
          }
        : {
            maxSlopeDeg: TREK_PARAMS.cautionSlopeFootDeg.value, // 15°
            allowedZones: ["Z0", "Z1"],
            minConfidence: "K3a",
            speedFactor: 1.0,
          };

      const weightMultipliers = hasPhysioCause
        ? { t: 2, r: 3, e: 1, u: 2, h: 3 }
        : { t: 1, r: 3, e: 1, u: 2, h: 1 };

      return {
        directiveId,
        issuedAtS: fsm.missionTimeS,
        subject: { kind: "crew", id: fsm.subjectId },
        state: "CAUTION",
        causes: fsm.causes,
        goalPolicy,
        limits,
        weightMultipliers,
        strainFactor: hasPhysioCause ? 3 : 1,
        fallbackLadder: [],
        rationale,
        latch: fsm.latch,
        requiresHumanConfirmation: fsm.requiresHumanConfirmation,
        simulated: fsm.simulated,
      };
    }

    case "CRITICAL": {
      const preferredLimits: NavigationLimits = {
        maxSlopeDeg: TREK_PARAMS.cautionSlopeFootDeg.value, // 15° preferente
        allowedZones: ["Z0", "Z1"],
        minConfidence: "K3a",
        speedFactor: 0.8,
      };
      const expandedLimits: NavigationLimits = {
        maxSlopeDeg: TREK_PARAMS.maxSlopeFootNormalDeg.value, // 20° límite absoluto vehículo
        allowedZones: ["Z0", "Z1"],
        minConfidence: "K3a",
        speedFactor: 0.8,
      };
      const holdLimits: NavigationLimits = {
        maxSlopeDeg: 0,
        allowedZones: ["Z0"],
        minConfidence: "K1",
        speedFactor: 0,
      };

      return {
        directiveId,
        issuedAtS: fsm.missionTimeS,
        subject: { kind: "crew", id: fsm.subjectId },
        state: "CRITICAL",
        causes: fsm.causes,
        goalPolicy: "nearest-shelter",
        limits: preferredLimits,
        weightMultipliers: { t: 2, r: 3, e: 1, u: 2, h: 3 },
        strainFactor: 3,
        fallbackLadder: [
          { limits: expandedLimits, goalPolicy: "nearest-shelter" },
          { limits: holdLimits, goalPolicy: "hold-position" },
        ],
        protocol: selectProtocol(fsm.causes),
        rationale,
        latch: fsm.latch,
        requiresHumanConfirmation: true,
        simulated: fsm.simulated,
      };
    }

    case "EMERGENCY": {
      const zeroMob = Boolean(context.zeroMobility);
      const preferredLimits: NavigationLimits = {
        maxSlopeDeg: zeroMob ? 0 : TREK_PARAMS.cautionSlopeFootDeg.value,
        allowedZones: ["Z0", "Z1"],
        minConfidence: "K3a",
        speedFactor: zeroMob ? 0 : 0.9,
      };
      const expandedLimits: NavigationLimits = {
        maxSlopeDeg: TREK_PARAMS.maxSlopeFootNormalDeg.value,
        allowedZones: ["Z0", "Z1"],
        minConfidence: "K3a",
        speedFactor: 0.9,
      };
      const holdLimits: NavigationLimits = {
        maxSlopeDeg: 0,
        allowedZones: ["Z0"],
        minConfidence: "K1",
        speedFactor: 0,
      };

      return {
        directiveId,
        issuedAtS: fsm.missionTimeS,
        subject: { kind: "crew", id: fsm.subjectId },
        state: "EMERGENCY",
        causes: fsm.causes,
        goalPolicy: zeroMob ? "hold-position" : "nearest-shelter",
        limits: preferredLimits,
        weightMultipliers: { t: 2, r: 4, e: 1, u: 2, h: 4 },
        strainFactor: 4,
        fallbackLadder: [
          { limits: expandedLimits, goalPolicy: "nearest-shelter" },
          { limits: holdLimits, goalPolicy: "hold-position" },
        ],
        protocol: selectProtocol(fsm.causes, zeroMob),
        rationale,
        latch: "iv-lock",
        requiresHumanConfirmation: true,
        simulated: fsm.simulated,
      };
    }
  }
}

/**
 * Compositor de equipo (ASTRONAUT_HEALTH_STATE_MACHINE §9.1, T-12):
 * Manda siempre el integrante más restrictivo en cada límite, velocidad y margen; nunca el promedio.
 */
export function composeTeamDirective(
  directives: readonly NavigationDirective[],
): NavigationDirective {
  if (directives.length === 0) {
    throw new Error("composeTeamDirective requires at least one crew directive");
  }
  if (directives.length === 1) return directives[0]!;

  let worstState = directives[0]!.state;
  let minSlope = directives[0]!.limits.maxSlopeDeg;
  let slopeImposedBy = directives[0]!.subject.id;
  let minSpeed = directives[0]!.limits.speedFactor;
  let speedImposedBy = directives[0]!.subject.id;
  let strictestConf: ConfidenceClass = directives[0]!.limits.minConfidence;
  let maxStrain = directives[0]!.strainFactor;
  let goalPolicy: GoalPolicy = directives[0]!.goalPolicy;

  const GOAL_ORDER: Record<GoalPolicy, number> = {
    "keep-goal": 0,
    "nearest-safe-waypoint": 1,
    "nearest-shelter": 2,
    "hold-position": 3,
  };

  const causeSet = new Set<CauseFlag>();
  const zoneIntersection = new Set<ZoneClass>(directives[0]!.limits.allowedZones);
  const mults: Record<"t" | "r" | "e" | "u" | "h", number> = { t: 1, r: 1, e: 1, u: 1, h: 1 };
  const rationale: Array<{ ruleId: string; message: string }> = [];

  for (const d of directives) {
    if (healthRank(d.state) > healthRank(worstState)) {
      worstState = d.state;
    }
    if (d.limits.maxSlopeDeg < minSlope) {
      minSlope = d.limits.maxSlopeDeg;
      slopeImposedBy = d.subject.id;
    }
    if (d.limits.speedFactor < minSpeed) {
      minSpeed = d.limits.speedFactor;
      speedImposedBy = d.subject.id;
    }
    if (confidenceRank(d.limits.minConfidence) > confidenceRank(strictestConf)) {
      strictestConf = d.limits.minConfidence;
    }
    if (d.strainFactor > maxStrain) {
      maxStrain = d.strainFactor;
    }
    if (GOAL_ORDER[d.goalPolicy] > GOAL_ORDER[goalPolicy]) {
      goalPolicy = d.goalPolicy;
    }
    for (const c of d.causes) causeSet.add(c);
    for (const z of [...zoneIntersection]) {
      if (!d.limits.allowedZones.includes(z)) zoneIntersection.delete(z);
    }
    for (const k of ["t", "r", "e", "u", "h"] as const) {
      mults[k] = Math.max(mults[k], d.weightMultipliers[k] ?? 1);
    }
    for (const r of d.rationale) {
      rationale.push({
        ruleId: `${d.subject.id}:${r.ruleId}`,
        message: `[${d.subject.id}] ${r.message}`,
      });
    }
  }

  rationale.unshift({
    ruleId: "TEAM-ENVELOPE",
    message: `Límite de pendiente (${minSlope}°) impuesto por ${slopeImposedBy}; velocidad (×${minSpeed}) impuesta por ${speedImposedBy}`,
  });

  const mostSevereDirective = [...directives].sort(
    (a, b) => healthRank(b.state) - healthRank(a.state),
  )[0]!;

  return {
    directiveId: `dir-team-${directives.map((d) => d.directiveId).join("+")}`,
    issuedAtS: Math.max(...directives.map((d) => d.issuedAtS)),
    subject: { kind: "team", id: "TEAM" },
    state: worstState,
    causes: [...causeSet],
    goalPolicy,
    limits: {
      maxSlopeDeg: minSlope,
      allowedZones: [...zoneIntersection],
      minConfidence: strictestConf,
      speedFactor: minSpeed,
    },
    weightMultipliers: mults,
    strainFactor: maxStrain,
    fallbackLadder: mostSevereDirective.fallbackLadder,
    ...(mostSevereDirective.protocol !== undefined
      ? { protocol: mostSevereDirective.protocol }
      : {}),
    rationale,
    latch: mostSevereDirective.latch,
    requiresHumanConfirmation: directives.some((d) => d.requiresHumanConfirmation),
    simulated: directives.some((d) => d.simulated),
  };
}
