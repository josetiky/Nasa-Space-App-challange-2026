/**
 * Mars Trek · Máquina de estados de salud del astronauta S1..S5 (ASTRONAUT_HEALTH_STATE_MACHINE §6).
 * Garantías (INV-H4, INV-H5, INV-H6, PT-11):
 * - Subida inmediata a la severidad requerida; bajada de a lo sumo 1 nivel por transición.
 * - CRITICAL (return-mode) y EMERGENCY (iv-lock) están enclavados: requieren llegada a refugio o confirmación humana con justificación registrada.
 * - Sin telemetría o con sensor fallado: nunca produce NORMAL ni permite bajar de estado.
 */
import type {
  CauseFlag,
  DataQualityStatus,
  HealthState,
  HealthTransition,
  HuellaLevel,
} from "../contracts";
import { healthRank } from "../contracts";

const ORDERED_STATES: readonly HealthState[] = [
  "NORMAL",
  "FATIGUE",
  "CAUTION",
  "CRITICAL",
  "EMERGENCY",
];

export interface FsmTrigger {
  readonly ruleId: string;
  readonly level: HuellaLevel | "FATIGUE" | "SEN";
  readonly cause?: CauseFlag;
  readonly value: number | string;
  readonly message: string;
}

export interface FsmState {
  readonly subjectId: string;
  readonly missionTimeS: number;
  readonly state: HealthState;
  readonly causes: readonly CauseFlag[];
  readonly latch: "none" | "return-mode" | "iv-lock";
  readonly requiresHumanConfirmation: boolean;
  readonly fatigueIndex: number;
  readonly activeTriggers: readonly FsmTrigger[];
  readonly dataQuality: Readonly<Record<string, DataQualityStatus>>;
  readonly history: readonly HealthTransition[];
  readonly seq: number;
  readonly simulated: boolean;
}

export interface FsmStepInput {
  readonly missionTimeS: number;
  readonly huellaLevel?: HuellaLevel;
  readonly activeRulesCountAtSupervivencia?: number;
  readonly fatigueActive?: boolean;
  readonly fatigueIndex?: number;
  readonly causes?: readonly CauseFlag[];
  readonly triggers?: readonly FsmTrigger[];
  readonly dataQuality?: Readonly<Record<string, DataQualityStatus>>;
  readonly telemetryCut?: boolean;
  readonly atShelter?: boolean;
  readonly humanAuthorization?: {
    readonly by: string;
    readonly justification: string;
  };
  readonly scenarioId?: string;
}

export function createInitialFsmState(subjectId = "EVA1", simulated = true): FsmState {
  return {
    subjectId,
    missionTimeS: 0,
    state: "NORMAL",
    causes: [],
    latch: "none",
    requiresHumanConfirmation: false,
    fatigueIndex: 0,
    activeTriggers: [],
    dataQuality: {
      ecg: "valid",
      spo2: "valid",
      coreTemp: "valid",
      suitPressure: "valid",
      co2: "valid",
    },
    history: [],
    seq: 0,
    simulated,
  };
}

function inferCauseFromRuleId(ruleId: string): CauseFlag {
  if (ruleId.startsWith("FAT")) return "fatiga";
  if (ruleId.startsWith("SEN")) return "sensores";
  switch (ruleId) {
    case "EVA-01":
    case "EVA-02":
    case "EVA-03":
    case "EVA-04":
    case "EVA-05":
    case "EVA-20":
    case "EVA-21":
      return "traje";
    case "EVA-06":
    case "EVA-07":
    case "EVA-12":
      return "cardiaca";
    case "EVA-09":
    case "EVA-10":
    case "EVA-19":
      return "termica";
    case "EVA-13":
      return "radiacion";
    case "EVA-14":
    case "EVA-18":
      return "ambiente";
    case "EVA-15":
      return "navegacion";
    case "EVA-16":
      return "comunicaciones";
    default:
      return "traje";
  }
}

/**
 * Avanza un paso de la máquina de estados de salud aplicando agregación, sensores,
 * enclavamientos (CRITICAL / EMERGENCY) y desescalamiento gradual de un solo nivel (PT-11).
 */
export function stepFsm(prev: FsmState, input: FsmStepInput): FsmState {
  const dq: Record<string, DataQualityStatus> = {
    ...prev.dataQuality,
    ...(input.dataQuality ?? {}),
  };

  if (input.telemetryCut) {
    dq["biomedical"] = "missing";
  }

  const hasSensorAnomaly =
    Boolean(input.telemetryCut) ||
    Object.values(dq).some((s) => s === "missing" || s === "stale" || s === "implausible");

  const triggers: FsmTrigger[] = [...(input.triggers ?? [])];
  if (hasSensorAnomaly && !triggers.some((t) => t.ruleId === "SEN-04")) {
    triggers.push({
      ruleId: "SEN-04",
      level: "SEN",
      cause: "sensores",
      value: "CUT",
      message: "Pérdida o degradación de telemetría biomédica: sin datos nunca se asume NORMAL",
    });
  }

  // Determinar severidad instantánea objetivo
  const hLevel: HuellaLevel = input.huellaLevel ?? "NORMAL";
  const supCount =
    input.activeRulesCountAtSupervivencia ??
    triggers.filter((t) => t.level === "SUPERVIVENCIA").length;

  let rawTarget: HealthState;
  if (hLevel === "ABORTAR" || supCount >= 2 || triggers.some((t) => t.level === "ABORTAR")) {
    rawTarget = "EMERGENCY";
  } else if (hLevel === "SUPERVIVENCIA" || triggers.some((t) => t.level === "SUPERVIVENCIA")) {
    rawTarget = "CRITICAL";
  } else if (
    hLevel === "PRECAUCION" ||
    hasSensorAnomaly ||
    triggers.some((t) => t.level === "PRECAUCION" || t.level === "SEN")
  ) {
    rawTarget = "CAUTION";
  } else if (input.fatigueActive || triggers.some((t) => t.level === "FATIGUE")) {
    rawTarget = "FATIGUE";
  } else {
    rawTarget = "NORMAL";
  }

  const prevRank = healthRank(prev.state);
  const targetRank = healthRank(rawTarget);

  const validHumanAuth =
    input.humanAuthorization !== undefined &&
    input.humanAuthorization.by.trim().length > 0 &&
    input.humanAuthorization.justification.trim().length > 0;

  let nextState: HealthState = prev.state;
  let nextLatch = prev.latch;

  if (targetRank > prevRank) {
    // Subida inmediata
    nextState = rawTarget;
    if (nextState === "EMERGENCY") {
      nextLatch = "iv-lock";
    } else if (nextState === "CRITICAL") {
      nextLatch = "return-mode";
    }
  } else if (targetRank < prevRank) {
    // Regla INV-H4: con anomalía de sensores nunca se baja de estado
    if (hasSensorAnomaly) {
      nextState = prev.state;
    } else if (prev.state === "EMERGENCY") {
      // EMERGENCY enclavado: solo baja con autorización explícita del hábitat y justificación registrada
      if (validHumanAuth) {
        // Bajada de a lo sumo 1 nivel por transición (PT-11)
        nextState = ORDERED_STATES[prevRank - 1]!;
        nextLatch = "return-mode";
      } else {
        nextState = "EMERGENCY";
        nextLatch = "iv-lock";
      }
    } else if (prev.state === "CRITICAL") {
      // CRITICAL enclavado: solo baja al llegar a refugio o con autorización humana registrada
      if (input.atShelter || validHumanAuth) {
        nextState = ORDERED_STATES[prevRank - 1]!;
        nextLatch = "none";
      } else {
        nextState = "CRITICAL";
        nextLatch = "return-mode";
      }
    } else {
      // Bajada gradual de 1 nivel cada vez (PT-11: CAUTION -> FATIGUE -> NORMAL)
      nextState = ORDERED_STATES[prevRank - 1]!;
      nextLatch = "none";
    }
  } else {
    // Mismo nivel
    if (nextState === "EMERGENCY") nextLatch = "iv-lock";
    else if (nextState === "CRITICAL") nextLatch = "return-mode";
  }

  // Garantía absoluta Foco 4 / PT-11: sin datos nunca es NORMAL
  if (hasSensorAnomaly && nextState === "NORMAL") {
    nextState = "CAUTION";
  }

  // Recopilar banderas de causa
  const causeSet = new Set<CauseFlag>(input.causes ?? []);
  for (const tr of triggers) {
    if (tr.cause) causeSet.add(tr.cause);
    else causeSet.add(inferCauseFromRuleId(tr.ruleId));
  }
  if (input.fatigueActive || nextState === "FATIGUE") {
    causeSet.add("fatiga");
  }
  if (hasSensorAnomaly) {
    causeSet.add("sensores");
  }
  if (nextState === "NORMAL") {
    causeSet.clear();
  }
  // Mientras un enclavamiento retiene CRITICAL/EMERGENCY sin disparadores nuevos, se conserva la
  // causa que lo provocó: el protocolo (p. ej. refugio SEP) no debe cambiar al apagarse el disparador.
  if (causeSet.size === 0 && nextState === prev.state && nextLatch !== "none") {
    for (const c of prev.causes) causeSet.add(c);
  }
  const causes = [...causeSet];

  const requiresHumanConfirmation =
    nextState === "CRITICAL" || nextState === "EMERGENCY" || nextLatch !== "none";

  let nextSeq = prev.seq;
  let nextHistory = prev.history;

  if (nextState !== prev.state || (validHumanAuth && prev.requiresHumanConfirmation)) {
    nextSeq += 1;
    const directiveId = `dir-${prev.subjectId}-${nextSeq}-${input.missionTimeS}`;
    const transition: HealthTransition = {
      seq: nextSeq,
      missionTimeS: input.missionTimeS,
      subjectId: prev.subjectId,
      from: prev.state,
      to: nextState,
      causes,
      triggers: triggers.map((t) => ({
        ruleId: t.ruleId,
        level: t.level,
        value: t.value,
        message: t.message,
      })),
      dataQuality: dq,
      latch: nextLatch,
      ...(validHumanAuth && input.humanAuthorization
        ? {
            humanConfirmed: {
              by: input.humanAuthorization.by.trim(),
              justification: input.humanAuthorization.justification.trim(),
              atS: input.missionTimeS,
            },
          }
        : {}),
      directiveId,
      simulated: prev.simulated,
      ...(input.scenarioId !== undefined ? { scenarioId: input.scenarioId } : {}),
    };
    nextHistory = [...prev.history, transition];
  }

  return {
    subjectId: prev.subjectId,
    missionTimeS: input.missionTimeS,
    state: nextState,
    causes,
    latch: nextLatch,
    requiresHumanConfirmation,
    fatigueIndex: input.fatigueIndex ?? prev.fatigueIndex,
    activeTriggers: triggers,
    dataQuality: dq,
    history: nextHistory,
    seq: nextSeq,
    simulated: prev.simulated,
  };
}
