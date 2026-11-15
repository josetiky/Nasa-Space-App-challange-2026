/**
 * Mars Trek · Ciclo de sesión de simulación y navegación (Tarea 10, ARCHITECTURE §4.3).
 * Orden fijo de evaluación en cada ciclo:
 * 1. Costmap (instantánea versionada con tormentas, SEP, polvo, radiación y zonas)
 * 2. Recursos (consumo y margen de regreso con la directiva vigente)
 * 3. Salud (reglas biomédicas HUELLA + fatiga + misión -> FSM -> nueva directiva; si cambia, recalcula margen)
 * 4. Seguridad (composeEnvelope con la directiva vigente)
 * 5. Replanificación (planRoute + decideReplan con regla de estabilidad δ = 10 %)
 *
 * Entre 3 y 4, los pesos fisiológicos dinámicos (health/physio.ts) combinan por máximo los multiplicadores
 * de la directiva de la FSM con los que piden las necesidades del astronauta en la fila de telemetría
 * (generador determinista o caminata HUELLA de "metricas de vida"). La FSM conserva los límites duros.
 */
import type {
  CauseFlag,
  LocalPoint,
  MissionProfileId,
  NavigationDirective,
  ReplanRecord,
  ResourceState,
  Route,
  RouteResult,
  SafetyEnvelope,
  ShelterPoint,
  SimEvent,
  StormPolygon,
  TourStop,
  VehicleProfileId,
  WeightProfileId,
  WeightVector,
  ZoneCircle,
} from "../contracts";
import { HUELLA_LEVELS } from "../health/rules";
import { buildSnapshot, type CostmapSnapshot } from "../costmap/snapshot";
import type { StaticTerrain } from "../costmap/terrain";
import { applyMultipliers, resolveBaseWeights, validateWeights } from "../cost/weights";
import { directiveFor } from "../health/directive";
import { evaluateFatigueRules, stepFatigue } from "../health/fatigue";
import { createInitialFsmState, stepFsm, type FsmState, type FsmTrigger } from "../health/fsm";
import { evaluateMissionRules } from "../health/missionRules";
import { replayHealthAt, replayRowAt, type HuellaReplayTrace } from "../health/huellaReplay";
import {
  createLiveSuit,
  DEFAULT_PROTOCOL,
  fcMaxTanaka,
  liveRow,
  liveTriggers,
  NOMINAL_FAULTS,
  stepLiveSuit,
  type CrewParams,
  type LiveSuitState,
  type ProtocolSettings,
  type SuitFaults,
} from "../health/liveSuit";
import { PSI_TO_KPA } from "../health/rules";
import { ambientCoolingFactor, envAtMissionTime, type MarsEnvSnapshot } from "../env/marsEnv";
import {
  applyPhysioToDirective,
  formatMultipliers,
  initialPhysioState,
  sameMultipliers,
  stepPhysio,
  type PhysioWeightState,
} from "../health/physio";
import {
  createTelemetry,
  stepTelemetry,
  type TelemetryIncidentId,
  type TelemetrySampleRow,
  type TelemetrySimState,
} from "../health/telemetry";
import { TREK_PARAMS } from "../params";
import { createInitialResourceState, returnMargin, stepResources } from "../resources/consumables";
import { planRoute } from "../routing/planner";
import { tracePolyline } from "../routing/trace";
import { composeEnvelope } from "../safety/envelope";
import { decideReplan } from "./replanner";

export interface SessionConfig {
  readonly terrain: StaticTerrain;
  readonly origin: LocalPoint;
  readonly goal: LocalPoint;
  readonly shelters?: readonly ShelterPoint[];
  readonly missionProfile?: MissionProfileId;
  readonly weightProfile?: WeightProfileId;
  readonly customWeights?: WeightVector | null;
  readonly vehicle?: VehicleProfileId;
  readonly seed?: number;
  /** Caminata HUELLA de "metricas de vida" como fuente de telemetría (null/omitido = generador). */
  readonly huellaReplay?: HuellaReplayTrace | null;
  /** Astronauta en vivo (misión individual): parámetros del tripulante, fallas y protocolo. */
  readonly live?: LiveConfig | null;
  /** Entorno de Marte (reloj real, REMS, DONKI) que fija Sol, polvo, dosis y SEP. */
  readonly env?: MarsEnvSnapshot | null;
  /** Paradas científicas en orden (origen → paradas → destino). */
  readonly stops?: readonly TourStop[];
}

/** Registro de lo que pasó en cada parada científica. */
export interface StopLogEntry {
  readonly stopId: string;
  readonly name: string;
  /** done = trabajo completo · skipped = sin corredor admisible · interrupted = salida por seguridad. */
  readonly status: "done" | "skipped" | "interrupted";
  /** Minuto de EVA del registro. */
  readonly atMin: number;
  readonly reason?: string;
}

export interface LiveConfig {
  readonly params: CrewParams;
  readonly faults?: SuitFaults;
  readonly protocol?: ProtocolSettings;
  readonly seed?: number;
}

/** Astronauta en vivo de la misión individual (health/liveSuit.ts, port de simulador_huella.html). */
export interface LiveSession {
  readonly params: CrewParams;
  readonly faults: SuitFaults;
  readonly protocol: ProtocolSettings;
  readonly suit: LiveSuitState;
}

/** Cambios del operador sobre el astronauta en vivo; se aplican en el reloj actual. */
export interface LivePatch {
  readonly params?: Partial<CrewParams>;
  readonly faults?: Partial<SuitFaults>;
  readonly protocol?: Partial<ProtocolSettings>;
  /** Susto: +35 lpm transitorio (no debería escalar). */
  readonly scare?: boolean;
  /** Restaura todas las fallas a nominal. */
  readonly nominal?: boolean;
}

export interface TrekSessionState {
  readonly clockS: number;
  readonly terrain: StaticTerrain;
  readonly origin: LocalPoint;
  readonly goal: LocalPoint;
  readonly missionProfile: MissionProfileId;
  readonly weightProfile: WeightProfileId;
  /** Preferencia del operador (pesos D,T,R,E,U,H normalizados) o null si se usa el perfil nombrado. */
  readonly customWeights: WeightVector | null;
  /** Pesos efectivos del último ciclo: base (perfil o preferencia) × multiplicadores de la directiva de salud. */
  readonly activeWeights: WeightVector;
  readonly vehicle: VehicleProfileId;
  readonly baseDustTau: number;
  readonly baseDoseRateMsvPerSol: number;
  readonly sunElevationDeg: number;
  readonly sepAlertActive: boolean;
  readonly storms: readonly StormPolygon[];
  readonly manualZones: readonly ZoneCircle[];
  readonly shelters: readonly ShelterPoint[];
  readonly snapshot: CostmapSnapshot;
  readonly resources: ResourceState;
  readonly telemetry: TelemetrySimState;
  readonly latestTelemetryRow: TelemetrySampleRow | null;
  readonly fsm: FsmState;
  readonly directive: NavigationDirective;
  readonly envelope: SafetyEnvelope;
  readonly routeResult: RouteResult;
  readonly activeRoute: Route | null;
  readonly proposedRoute: Route | null;
  readonly replanLog: readonly ReplanRecord[];
  readonly replanSeq: number;
  /** Caminata HUELLA que alimenta la telemetría (null = generador determinista de telemetry.ts). */
  readonly huellaReplay: HuellaReplayTrace | null;
  /** Necesidades fisiológicas y multiplicadores dinámicos del A* calculados en el último ciclo. */
  readonly physio: PhysioWeightState;
  /** Astronauta en vivo (solo en misión individual); null en el resto. */
  readonly live: LiveSession | null;
  /** Entorno de Marte aplicado (null = valores fijos del costmap). */
  readonly env: MarsEnvSnapshot | null;
  /** Posición actual del astronauta sobre la ruta (= origin antes de salir). */
  readonly position: LocalPoint;
  /** Puntos ya recorridos (empieza en origin); camino conocido para regresar. */
  readonly trail: readonly LocalPoint[];
  /** Metros recorridos en la caminata. */
  readonly walkedM: number;
  /** Minuto de EVA en el que empezó el tramo de activeRoute (activeRoute empieza en position). */
  readonly legStartMin: number;
  /**
   * Regreso al punto de partida: la ruta al destino se volvió inadmisible a mitad de la caminata.
   * Mientras esté activo, A* planea hacia origin. "Calcular con A*" (request-replan) lo levanta.
   */
  readonly returning: boolean;
  /** Paradas científicas del recorrido, en orden. */
  readonly stops: readonly TourStop[];
  /** Índice de la siguiente parada pendiente (las anteriores están hechas, omitidas o interrumpidas). */
  readonly stopIdx: number;
  readonly stopLog: readonly StopLogEntry[];
  /** Trabajo científico en curso: el astronauta no camina hasta untilMin (minuto de EVA). */
  readonly dwell: { readonly stopId: string; readonly untilMin: number } | null;
}

const near = (a: LocalPoint, b: LocalPoint, tolM = 1) => Math.hypot(a.x - b.x, a.z - b.z) <= tolM;

/**
 * Avanza `minutes` sobre la ruta: punto alcanzado, metros recorridos, puntos pasados y lo que falta.
 * La ruta empieza en la posición actual (activeRoute siempre es el tramo restante).
 */
export function advanceAlongRoute(
  route: Route,
  minutes: number,
): {
  readonly position: LocalPoint;
  readonly walkedM: number;
  readonly passed: readonly LocalPoint[];
  readonly remaining: readonly LocalPoint[];
} {
  const start = route.points[0] ?? { x: 0, z: 0 };
  if (minutes <= 0 || route.segments.length === 0) {
    return { position: start, walkedM: 0, passed: [], remaining: route.points };
  }
  let t = 0;
  let walked = 0;
  const passed: LocalPoint[] = [];
  for (let i = 0; i < route.segments.length; i += 1) {
    const seg = route.segments[i]!;
    if (t + seg.durationMin >= minutes) {
      const f = seg.durationMin > 0 ? (minutes - t) / seg.durationMin : 1;
      const position = {
        x: seg.from.x + (seg.to.x - seg.from.x) * f,
        z: seg.from.z + (seg.to.z - seg.from.z) * f,
      };
      walked += seg.distanceM * f;
      const rest = route.segments.slice(i).map((sg) => sg.to);
      return { position, walkedM: walked, passed, remaining: [position, ...rest] };
    }
    t += seg.durationMin;
    walked += seg.distanceM;
    passed.push(seg.to);
  }
  const end = route.segments[route.segments.length - 1]!.to;
  return { position: end, walkedM: walked, passed, remaining: [end] };
}

/** Valores dinámicos del costmap que salen del entorno de Marte en el instante T+clockS. */
function envDynamics(env: MarsEnvSnapshot, clockS: number) {
  const sep = env.sep.value;
  return {
    baseDustTau: env.tau.value,
    baseDoseRateMsvPerSol: env.doseRateMsvPerSol.value * (sep ? 4 : 1),
    sepAlertActive: sep,
    sunElevationDeg: envAtMissionTime(env, clockS).sunElevationDeg,
  };
}

/** Orden canónico de eventos para que múltiples eventos simultáneos produzcan exactamente el mismo resultado en cualquier orden (Foco 5 / T-11). */
const EVENT_ORDER: Readonly<Record<SimEvent["kind"], number>> = {
  "set-origin": 1,
  "set-goal": 2,
  "set-stops": 2.5,
  "set-weight-profile": 3,
  "set-custom-weights": 3.5,
  "request-replan": 3.6,
  "storm-appear": 4,
  "storm-clear": 5,
  "sep-alert": 6,
  "dust-change": 7,
  "radiation-change": 8,
  "zone-add": 9,
  "battery-drop": 10,
  "o2-leak": 11,
  "health-incident": 12,
  "human-authorize": 13,
};

function canonicalizeEvents(events: readonly SimEvent[]): SimEvent[] {
  return [...events].sort((a, b) => {
    const oa = EVENT_ORDER[a.kind] ?? 99;
    const ob = EVENT_ORDER[b.kind] ?? 99;
    if (oa !== ob) return oa - ob;
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  });
}

function evaluateCycle(
  prev: TrekSessionState,
  nextClockS: number,
  causes: readonly string[],
  forceImmediateReplan: boolean,
  incidentOverride?: TelemetryIncidentId,
  humanAuth?: { by: string; justification: string; atShelter?: boolean },
): TrekSessionState {
  // 1. Costmap: construir instantánea versionada
  const snapshot = buildSnapshot(
    prev.terrain,
    {
      missionTimeS: nextClockS,
      baseDustTau: prev.baseDustTau,
      baseDoseRateMsvPerSol: prev.baseDoseRateMsvPerSol,
      sunElevationDeg: prev.sunElevationDeg,
      sepAlertActive: prev.sepAlertActive,
      storms: prev.storms,
      manualZones: prev.manualZones,
      shelters: prev.shelters,
    },
    {
      maxSlopeDeg: TREK_PARAMS.maxSlopeFootNormalDeg.value,
      cautionSlopeDeg: TREK_PARAMS.cautionSlopeFootDeg.value,
      payloadKg: prev.resources.payloadKg,
    },
  );

  // 2. Recursos: calcular margen de regreso con la ruta actual
  const estimatedReturnMin =
    (prev.activeRoute ? prev.activeRoute.durationMin : 30) + remainingDwellMin(prev);
  const margin1 = returnMargin({
    limitingMin: prev.resources.limiting.minutes,
    returnMin: estimatedReturnMin,
    reserveMin: TREK_PARAMS.secondaryO2ReserveMin.value,
  });

  // 3. Salud: evaluar reglas derivadas de misión + fatiga + incidente biomédico
  // EVA-14 solo escala el estado fisiológico a SUPERVIVENCIA si la tormenta envuelve la posición actual del astronauta;
  // si la tormenta aparece delante sobre la ruta (T-03 / T-11), actúa como máscara dinámica Z5 del costmap.
  const astronautInStorm = prev.storms.some(
    (s) =>
      s.active && Math.hypot(prev.origin.x - s.center.x, prev.origin.z - s.center.z) <= s.radiusM,
  );
  const missionHits = evaluateMissionRules({
    returnMarginMin: margin1.marginMin,
    returnMarginPct: margin1.marginPct,
    sepAlertActive: prev.sepAlertActive,
    stormActive: astronautInStorm,
    batteryRemainingMin: prev.resources.batteryMin,
    safeReturnDurationMin: estimatedReturnMin,
    reserveMin: 15,
    coolantInReserve: prev.resources.coolantStoragePct < 25,
  });

  const triggers: FsmTrigger[] = missionHits.map((h) => ({
    ruleId: h.ruleId,
    level: h.level,
    cause: h.cause,
    value: h.value,
    message: h.message,
  }));

  let fatigueIndex = prev.fsm.fatigueIndex;
  let telemetryCut = prev.latestTelemetryRow?.telemetryCut ?? false;
  let huellaLevel: "NORMAL" | "PRECAUCION" | "SUPERVIVENCIA" | "ABORTAR" = "NORMAL";
  const extraCauses: CauseFlag[] = [];

  if (prev.resources.o2Source === "SEC") {
    huellaLevel = "ABORTAR";
    triggers.push({
      ruleId: "EVA-03",
      level: "ABORTAR",
      cause: "traje",
      value: "SEC",
      message: "Respirando del tanque secundario de O2",
    });
  }

  const activeIncident = incidentOverride ?? prev.telemetry.incident;
  if (activeIncident === "fatiga_progresiva") {
    fatigueIndex = Math.max(0.68, stepFatigue(fatigueIndex, 60, { metabolicW: 650 }));
  } else if (activeIncident === "recuperacion_descanso") {
    fatigueIndex = Math.min(
      0.32,
      stepFatigue(fatigueIndex, 180, { metabolicW: 160, resting: true }),
    );
  } else if (activeIncident === "falla_ventilador") {
    huellaLevel = "SUPERVIVENCIA";
    triggers.push({
      ruleId: "EVA-05",
      level: "SUPERVIVENCIA",
      cause: "traje",
      value: 18000,
      message: "Ventilador primario bajo (< 20 000 rpm): flujo insuficiente",
    });
  } else if (activeIncident === "fuga_traje") {
    huellaLevel = "SUPERVIVENCIA";
    triggers.push({
      ruleId: "EVA-02",
      level: "SUPERVIVENCIA",
      cause: "traje",
      value: 27.6,
      message: "Fuga de presión en traje espacial (> 1.72 kPa bajo setpoint)",
    });
  } else if (activeIncident === "estres_termico") {
    huellaLevel = HUELLA_LEVELS.indexOf(huellaLevel) < 1 ? "PRECAUCION" : huellaLevel;
    triggers.push({
      ruleId: "EVA-09",
      level: "PRECAUCION",
      cause: "termica",
      value: 38.2,
      message: "Temperatura central elevada (38.2 °C) por fallo LCVG",
    });
  } else if (activeIncident === "arritmia") {
    huellaLevel = "SUPERVIVENCIA";
    triggers.push({
      ruleId: "EVA-12",
      level: "SUPERVIVENCIA",
      cause: "cardiaca",
      value: 1,
      message: "El ECG muestra ritmo cardíaco irregular sostenido",
    });
  } else if (activeIncident === "perdida_comunicacion") {
    huellaLevel = HUELLA_LEVELS.indexOf(huellaLevel) < 1 ? "PRECAUCION" : huellaLevel;
    triggers.push({
      ruleId: "EVA-16",
      level: "PRECAUCION",
      cause: "comunicaciones",
      value: 0,
      message: "Más de 5 min sin contacto con el hábitat: regresar al último waypoint",
    });
  } else if (activeIncident === "perdida_sensores") {
    telemetryCut = true;
    extraCauses.push("sensores");
  } else if (activeIncident === "emergencia_medica") {
    huellaLevel = "ABORTAR";
    triggers.push(
      {
        ruleId: "EVA-08",
        level: "ABORTAR",
        cause: "traje",
        value: 83,
        message: "Hipoxia crítica: SpO2 83 % (< 85 %)",
      },
      {
        ruleId: "EVA-09",
        level: "ABORTAR",
        cause: "termica",
        value: 39.2,
        message: "Hipertermia crítica: Temperatura central 39.2 °C",
      },
    );
  }

  // Caminata HUELLA de "metricas de vida": nivel filtrado y reglas activas decididas por motor_reglas.py
  if (prev.huellaReplay) {
    const rh = replayHealthAt(prev.huellaReplay, nextClockS);
    if (HUELLA_LEVELS.indexOf(rh.level) > HUELLA_LEVELS.indexOf(huellaLevel))
      huellaLevel = rh.level;
    for (const tr of rh.triggers) {
      if (!triggers.some((x) => x.ruleId === tr.ruleId)) triggers.push(tr);
    }
  }

  // Astronauta en vivo (misión individual): nivel filtrado y reglas que lo justifican
  if (prev.live && !prev.huellaReplay) {
    const suit = prev.live.suit;
    if (HUELLA_LEVELS.indexOf(suit.level) > HUELLA_LEVELS.indexOf(huellaLevel)) {
      huellaLevel = suit.level;
    }
    for (const r of liveTriggers(suit)) {
      if (!triggers.some((x) => x.ruleId === r.ruleId)) {
        triggers.push({
          ruleId: r.ruleId,
          level: r.level,
          cause: r.cause,
          value: r.value,
          message: r.message,
        });
      }
    }
  }

  for (const h of missionHits) {
    if (HUELLA_LEVELS.indexOf(h.level) > HUELLA_LEVELS.indexOf(huellaLevel)) {
      huellaLevel = h.level;
    }
  }

  const fatEval = evaluateFatigueRules({
    fatigueIndex,
    wasFatigued: prev.fsm.state === "FATIGUE" || prev.fsm.causes.includes("fatiga"),
    evaElapsedMin: prev.resources.evaElapsedMin,
  });

  for (const r of fatEval.triggeredRules) {
    triggers.push({
      ruleId: r.ruleId,
      level: "FATIGUE",
      cause: "fatiga",
      value: r.value,
      message: r.message,
    });
  }

  const nextFsm = stepFsm(prev.fsm, {
    missionTimeS: nextClockS,
    huellaLevel,
    fatigueActive: fatEval.active,
    fatigueIndex,
    causes: extraCauses,
    triggers,
    telemetryCut,
    ...(humanAuth?.atShelter !== undefined ? { atShelter: humanAuth.atShelter } : {}),
    ...(humanAuth
      ? { humanAuthorization: { by: humanAuth.by, justification: humanAuth.justification } }
      : {}),
  });

  const nextDirective = directiveFor(nextFsm, { returnMarginPct: margin1.marginPct });

  // 3b. Pesos fisiológicos dinámicos: necesidades del astronauta en la fila vigente → multiplicadores ≥ 1,
  // combinados por máximo con los de la directiva de la FSM (que sigue mandando en límites, zonas y meta).
  const physio = stepPhysio(
    prev.physio,
    prev.latestTelemetryRow,
    {
      fatigueIndex,
      doseRateMsvPerSol: prev.baseDoseRateMsvPerSol,
      careerDoseMsv: prev.resources.doseCareerMSv + prev.resources.doseEvaMSv,
      ...(prev.live
        ? {
            fcMax: fcMaxTanaka(prev.live.params.ageY),
            setpointKpa: prev.live.params.setpointPsi * PSI_TO_KPA,
          }
        : {}),
    },
    nextClockS,
    prev.huellaReplay
      ? "huella-csv"
      : prev.live
        ? "live"
        : prev.latestTelemetryRow
          ? "generator"
          : "none",
  );
  const routingDirective = applyPhysioToDirective(nextDirective, physio);
  const physioChanged = !sameMultipliers(physio.multipliers, prev.physio.multipliers);

  // 4. Seguridad: componer la envolvente con la directiva nueva y la instantánea actual
  const nextEnvelope = composeEnvelope(
    prev.missionProfile,
    prev.vehicle,
    {},
    routingDirective,
    prev.resources,
    snapshot,
  );

  // 5. Replanificación: planRoute + decideReplan
  const req = {
    requestId: `req-${prev.replanSeq + 1}-${nextClockS}`,
    // Se planea desde donde va el astronauta; de regreso, hacia el punto de partida
    origin: prev.position,
    goal: prev.returning ? prev.origin : prev.goal,
    missionProfile: prev.missionProfile,
    weightProfile: prev.weightProfile,
    ...(prev.customWeights ? { customWeights: prev.customWeights } : {}),
    vehicle: prev.vehicle,
    // Paradas pendientes (de regreso no se visitan)
    ...(!prev.returning && prev.stopIdx < prev.stops.length
      ? { stops: prev.stops.slice(prev.stopIdx) }
      : {}),
  };

  let candidateResult = planRoute(req, nextEnvelope, snapshot, {
    resources: prev.resources,
  });

  // Si a mitad de la caminata la ruta al destino se vuelve inadmisible, no se aborta:
  // A* busca una ruta de regreso al punto de partida desde la posición actual.
  const departed = prev.walkedM > 0.5 && !near(prev.position, prev.origin);
  const arrived = near(prev.position, req.goal);
  let returning = prev.returning;
  let returnCause: string | null = null;
  if (
    !candidateResult.ok &&
    candidateResult.reason !== "hold-position" &&
    departed &&
    !arrived &&
    !prev.returning
  ) {
    const back = planRoute({ ...req, goal: prev.origin }, nextEnvelope, snapshot, {
      resources: prev.resources,
    });
    returning = true;
    returnCause = `return:${candidateResult.reason}`;
    if (back.ok) candidateResult = back;
  }

  // Paradas: la siguiente pendiente sin corredor admisible se omite (con su motivo); un trabajo en
  // curso se interrumpe si la directiva manda al refugio o se emprende el regreso.
  let stopIdx = prev.stopIdx;
  let stopLog = prev.stopLog;
  let dwell = prev.dwell;
  const nowMin = prev.resources.evaElapsedMin;
  if (candidateResult.ok && candidateResult.tour) {
    const skipped = new Map(candidateResult.tour.skipped.map((sk) => [sk.stopId, sk]));
    while (stopIdx < prev.stops.length && skipped.has(prev.stops[stopIdx]!.id)) {
      const stop = prev.stops[stopIdx]!;
      stopLog = [
        ...stopLog,
        {
          stopId: stop.id,
          name: stop.name,
          status: "skipped",
          atMin: nowMin,
          reason: skipped.get(stop.id)!.message,
        },
      ];
      stopIdx += 1;
    }
  }
  if (dwell && (returning || nextDirective.goalPolicy !== "keep-goal")) {
    const stop = prev.stops.find((x) => x.id === dwell!.stopId);
    stopLog = [
      ...stopLog,
      {
        stopId: dwell.stopId,
        name: stop?.name ?? dwell.stopId,
        status: "interrupted",
        atMin: nowMin,
        reason: returning
          ? "Regreso al punto de partida"
          : `Directiva ${nextDirective.state}: refugio`,
      },
    ];
    dwell = null;
  }

  const effectiveProfileId: WeightProfileId =
    nextDirective.state === "CRITICAL" || nextDirective.state === "EMERGENCY"
      ? "emergency"
      : prev.weightProfile;
  const activeWeights = applyMultipliers(
    resolveBaseWeights(effectiveProfileId, prev.customWeights),
    nextEnvelope.weightMultipliers,
  );

  const directiveChanged =
    nextDirective.state !== prev.directive.state ||
    nextDirective.goalPolicy !== prev.directive.goalPolicy;
  const replanDecision = decideReplan({
    seq: prev.replanSeq + 1,
    atS: nextClockS,
    currentRoute: prev.activeRoute,
    candidateResult,
    snapshot,
    envelope: nextEnvelope,
    weights: activeWeights,
    causes: [
      ...(causes.length > 0 ? causes : [`state:${nextDirective.state}`]),
      ...(physioChanged ? [`physio:${formatMultipliers(physio.multipliers)}`] : []),
      ...(returnCause ? [returnCause] : []),
    ],
    forceImmediate: forceImmediateReplan || directiveChanged || returnCause !== null,
    simulated: snapshot.simulated || nextDirective.simulated,
  });

  let activeRoute = replanDecision.activeRoute;
  let record = replanDecision.record;
  if (returnCause && candidateResult.ok) {
    record = {
      ...record,
      summary: `Ruta al destino inadmisible → regreso al punto de partida (${candidateResult.route.distanceM.toFixed(0)} m, máx ${candidateResult.route.maxSlopeDeg.toFixed(1)}°).`,
    };
  }
  // Último recurso: ni el destino ni el regreso tienen corredor A* admisible (p. ej. el astronauta
  // quedó dentro de la tormenta). Se regresa por el camino ya recorrido, que es terreno conocido.
  const prevEnd = prev.activeRoute?.points[prev.activeRoute.points.length - 1];
  if (
    !activeRoute &&
    prev.returning &&
    prev.activeRoute &&
    prevEnd &&
    near(prevEnd, prev.origin, 1.5)
  ) {
    // Ya va de regreso por terreno conocido: se conserva lo que falta de esa ruta (no se reconstruye
    // desde el rastro, que ahora incluye el tramo de vuelta)
    activeRoute = prev.activeRoute;
    record = {
      ...record,
      decision: "keep",
      summary: `Sin corredor A* admisible → continúa el regreso por el camino recorrido (${prev.activeRoute.distanceM.toFixed(0)} m restantes).`,
    };
  } else if (!activeRoute && (returning || returnCause) && departed && prev.trail.length > 0) {
    const back = [prev.position, ...[...prev.trail].reverse()].filter(
      (p, i, arr) => i === 0 || !near(p, arr[i - 1]!, 0.05),
    );
    if (back.length >= 2) {
      activeRoute = tracePolyline(
        snapshot,
        nextEnvelope,
        activeWeights,
        back,
        back,
        prev.resources,
      ).route;
      returning = true;
      record = {
        ...record,
        decision: "emergency",
        newCostM: activeRoute.equivalentCostM,
        summary: `Sin corredor A* admisible → regreso por el camino recorrido (${activeRoute.distanceM.toFixed(0)} m de terreno conocido).`,
      };
    }
  }

  return {
    ...prev,
    clockS: nextClockS,
    snapshot,
    fsm: nextFsm,
    directive: nextDirective,
    envelope: nextEnvelope,
    routeResult: candidateResult,
    activeWeights,
    activeRoute,
    proposedRoute: replanDecision.proposedRoute,
    replanLog: [...prev.replanLog, record],
    returning,
    replanSeq: prev.replanSeq + 1,
    physio,
    stopIdx,
    stopLog,
    dwell,
  };
}

/**
 * La EVA terminó: el astronauta llegó al destino con todas las paradas resueltas (o volvió al punto
 * de partida tras un regreso) y no queda tramo por caminar ni trabajo en curso.
 */
export function walkComplete(s: TrekSessionState): boolean {
  if (s.walkedM <= 0.5 || s.dwell) return false;
  if (s.activeRoute && s.activeRoute.distanceM > 0.5) return false;
  if (s.returning) return near(s.position, s.origin, 1.5);
  return s.stopIdx >= s.stops.length && near(s.position, s.goal, 1.5);
}

/** Minutos de trabajo científico que faltan: el de la parada en curso más el de las pendientes. */
export function remainingDwellMin(s: TrekSessionState): number {
  const now = s.resources.evaElapsedMin;
  const current = s.dwell ? Math.max(0, s.dwell.untilMin - now) : 0;
  if (s.returning) return current;
  return current + s.stops.slice(s.stopIdx).reduce((acc, x) => acc + Math.max(0, x.dwellMin), 0);
}

/** Crea una sesión de navegación y simulación lista para usar con su plan inicial calculado. */
export function createSession(config: SessionConfig): TrekSessionState {
  const missionProfile = config.missionProfile ?? "team";
  const weightProfile = config.weightProfile ?? "balanced";
  const vehicle = config.vehicle ?? "crew-foot";
  const customWeights = config.customWeights ? validateWeights(config.customWeights) : null;
  const shelters: readonly ShelterPoint[] = config.shelters ?? [
    {
      id: "hab-default",
      name: "Hábitat Base / Rover Presurizado",
      point: config.origin,
      kind: "habitat",
      shielded: true,
    },
  ];

  const env = config.env ?? null;
  const dyn = env
    ? envDynamics(env, 0)
    : { baseDustTau: 0.5, baseDoseRateMsvPerSol: 0.64, sepAlertActive: false, sunElevationDeg: 35 };
  const snapshot = buildSnapshot(config.terrain, {
    shelters,
    baseDustTau: dyn.baseDustTau,
    baseDoseRateMsvPerSol: dyn.baseDoseRateMsvPerSol,
    sepAlertActive: dyn.sepAlertActive,
    sunElevationDeg: dyn.sunElevationDeg,
  });
  const live: LiveSession | null = config.live
    ? {
        params: config.live.params,
        faults: config.live.faults ?? NOMINAL_FAULTS,
        protocol: config.live.protocol ?? DEFAULT_PROTOCOL,
        suit: createLiveSuit(config.live.params, config.live.seed ?? config.seed ?? 7),
      }
    : null;
  const resources = createInitialResourceState(
    "EVA1",
    live ? { payloadKg: live.params.payloadKg, doseCareerMSv: live.params.careerDoseMsv } : {},
  );
  const telemetry = createTelemetry({ evId: "EVA1" }, config.seed ?? 42);
  const fsm = createInitialFsmState("EVA1", true);
  const directive = directiveFor(fsm, { returnMarginPct: 100 });
  const huellaReplay = config.huellaReplay ?? null;
  const firstRow = huellaReplay
    ? replayRowAt(huellaReplay, 0, 0)
    : live
      ? liveRow(live.suit, live.params, { batteryPct: 100, coolantPct: 100, fatigueIndex: 0 })
      : null;
  const firstSource = huellaReplay ? "huella-csv" : "live";
  const physio = firstRow
    ? stepPhysio(
        initialPhysioState(0, firstSource),
        firstRow,
        { fatigueIndex: 0, doseRateMsvPerSol: 0.64 },
        0,
        firstSource,
      )
    : initialPhysioState(0, "none");
  const envelope = composeEnvelope(
    missionProfile,
    vehicle,
    {},
    applyPhysioToDirective(directive, physio),
    resources,
    snapshot,
  );

  const stops = config.stops ?? [];
  const routeResult = planRoute(
    {
      requestId: "req-init",
      origin: config.origin,
      goal: config.goal,
      missionProfile,
      weightProfile,
      ...(customWeights ? { customWeights } : {}),
      vehicle,
      ...(stops.length > 0 ? { stops } : {}),
    },
    envelope,
    snapshot,
    { resources },
  );

  const initialRoute = routeResult.ok ? routeResult.route : null;

  return {
    clockS: 0,
    terrain: config.terrain,
    origin: config.origin,
    goal: config.goal,
    missionProfile,
    weightProfile,
    customWeights,
    activeWeights: applyMultipliers(
      resolveBaseWeights(weightProfile, customWeights),
      envelope.weightMultipliers,
    ),
    vehicle,
    baseDustTau: dyn.baseDustTau,
    baseDoseRateMsvPerSol: dyn.baseDoseRateMsvPerSol,
    sunElevationDeg: dyn.sunElevationDeg,
    sepAlertActive: dyn.sepAlertActive,
    storms: [],
    manualZones: [],
    shelters,
    snapshot,
    resources,
    telemetry,
    latestTelemetryRow: firstRow,
    fsm,
    directive,
    envelope,
    routeResult,
    activeRoute: initialRoute,
    proposedRoute: null,
    replanLog: [],
    replanSeq: 0,
    huellaReplay,
    physio,
    live,
    env,
    position: config.origin,
    trail: [config.origin],
    walkedM: 0,
    legStartMin: 0,
    returning: false,
    stops,
    stopIdx: 0,
    stopLog: [],
    dwell: null,
  };
}

/**
 * Aplica (o quita, con null) el entorno de Marte: Sol en la hora local real de Gale, τ, dosis GCR con la
 * presión de REMS y alerta SEP de DONKI. Reevalúa el ciclo en el reloj actual.
 */
export function setMarsEnv(
  session: TrekSessionState,
  env: MarsEnvSnapshot | null,
): TrekSessionState {
  const dyn = env
    ? envDynamics(env, session.clockS)
    : { baseDustTau: 0.5, baseDoseRateMsvPerSol: 0.64, sepAlertActive: false, sunElevationDeg: 35 };
  return evaluateCycle(
    { ...session, env, ...dyn },
    session.clockS,
    [env ? `env:${env.example}` : "env:off"],
    false,
  );
}

/** Pendiente (%) del tramo de la ruta activa en el que va el astronauta según el tiempo de EVA. */
export function routeProgress(session: TrekSessionState): {
  readonly fraction: number;
  readonly slopePct: number;
  readonly walking: boolean;
} {
  const route = session.activeRoute;
  if (session.dwell) return { fraction: 0, slopePct: 0, walking: false };
  if (!route || route.durationMin <= 0) return { fraction: 0, slopePct: 0, walking: false };
  const elapsed = session.resources.evaElapsedMin - session.legStartMin;
  const fraction = Math.min(1, elapsed / route.durationMin);
  if (fraction >= 1) return { fraction, slopePct: 0, walking: false };
  let acc = 0;
  for (const seg of route.segments) {
    acc += seg.durationMin;
    if (acc >= elapsed) {
      const grade = Math.tan((Math.abs(seg.slopeDeg) * Math.PI) / 180) * 100;
      return { fraction, slopePct: seg.deltaZM < 0 ? -grade : grade, walking: true };
    }
  }
  return { fraction, slopePct: 0, walking: true };
}

/**
 * Cambia parámetros del tripulante, fallas o protocolo del astronauta en vivo (misión individual) y
 * reevalúa el ciclo en el reloj actual. Las fallas actúan sobre la física en los siguientes segundos.
 */
export function updateLive(session: TrekSessionState, patch: LivePatch): TrekSessionState {
  const live = session.live;
  if (!live) return session;
  const params: CrewParams = { ...live.params, ...(patch.params ?? {}) };
  const faults: SuitFaults = patch.nominal
    ? { ...NOMINAL_FAULTS, ...(patch.faults ?? {}) }
    : { ...live.faults, ...(patch.faults ?? {}) };
  const protocol: ProtocolSettings = { ...live.protocol, ...(patch.protocol ?? {}) };
  const suit: LiveSuitState = patch.scare ? { ...live.suit, scareAtS: live.suit.tS } : live.suit;
  const resources =
    params.payloadKg !== live.params.payloadKg || params.careerDoseMsv !== live.params.careerDoseMsv
      ? createInitialResourceState(session.resources.subjectId, {
          ...session.resources,
          payloadKg: params.payloadKg,
          doseCareerMSv: params.careerDoseMsv,
        })
      : session.resources;
  const causes: string[] = [];
  if (patch.params) causes.push(`crew:${Object.keys(patch.params).join(",")}`);
  if (patch.faults || patch.nominal) {
    causes.push(
      patch.nominal ? "faults:nominal" : `faults:${Object.keys(patch.faults ?? {}).join(",")}`,
    );
  }
  if (patch.protocol) causes.push(`protocol:${Object.keys(patch.protocol).join(",")}`);
  if (patch.scare) causes.push("crew:scare");
  return evaluateCycle(
    { ...session, resources, live: { params, faults, protocol, suit } },
    session.clockS,
    causes,
    false,
  );
}

/**
 * Cambia la fuente de telemetría: una caminata HUELLA de "metricas de vida" o, con null, el generador
 * determinista. Reevalúa el ciclo en el reloj actual (la FSM y los pesos fisiológicos ven la fila nueva).
 */
export function setHuellaReplay(
  session: TrekSessionState,
  trace: HuellaReplayTrace | null,
): TrekSessionState {
  const next: TrekSessionState = {
    ...session,
    huellaReplay: trace,
    latestTelemetryRow: trace
      ? replayRowAt(trace, session.clockS, session.fsm.fatigueIndex)
      : session.latestTelemetryRow,
  };
  return evaluateCycle(
    next,
    session.clockS,
    [trace ? `telemetry:huella:${trace.scenarioId}` : "telemetry:generator"],
    false,
  );
}

/**
 * Despacha uno o varios eventos simultáneos en un mismo ciclo (Foco 5 / T-11).
 * Ordena canónicamente los eventos antes de aplicarlos y ejecuta una única replanificación,
 * garantizando que el resultado sea independiente del orden de llegada.
 */
export function dispatch(
  session: TrekSessionState,
  eventOrEvents: SimEvent | readonly SimEvent[],
): TrekSessionState {
  const rawList: readonly SimEvent[] = Array.isArray(eventOrEvents)
    ? eventOrEvents
    : [eventOrEvents as SimEvent];
  if (rawList.length === 0) return session;

  const sorted = canonicalizeEvents(rawList);
  let working: TrekSessionState = { ...session };
  const causes: string[] = [];
  let forceImmediate = false;
  let incidentOverride: TelemetryIncidentId | undefined;
  let humanAuth: { by: string; justification: string; atShelter?: boolean } | undefined;

  for (const ev of sorted) {
    switch (ev.kind) {
      case "set-origin":
        // Mover el punto de partida reubica al astronauta (nueva caminata desde ahí)
        working = {
          ...working,
          origin: ev.origin,
          position: ev.origin,
          trail: [ev.origin],
          walkedM: 0,
          returning: false,
          stopIdx: 0,
          stopLog: [],
          dwell: null,
        };
        causes.push(`origin:(${ev.origin.x.toFixed(0)},${ev.origin.z.toFixed(0)})`);
        forceImmediate = true;
        break;
      case "set-stops": {
        // Las paradas ya resueltas (hechas, omitidas o interrumpidas) que sigan al principio de la
        // lista nueva cuentan como pasadas; el resto queda pendiente en el orden recibido.
        const keepDwell =
          working.dwell && ev.stops.some((x) => x.id === working.dwell!.stopId)
            ? working.dwell
            : null;
        const resolved = new Set(working.stopLog.map((e) => e.stopId));
        if (keepDwell) resolved.add(keepDwell.stopId);
        let idx = 0;
        while (idx < ev.stops.length && resolved.has(ev.stops[idx]!.id)) idx += 1;
        working = { ...working, stops: ev.stops, stopIdx: idx, dwell: keepDwell };
        causes.push(`stops:${ev.stops.map((x) => x.id).join(",") || "none"}`);
        forceImmediate = true;
        break;
      }
      case "set-goal":
        working = { ...working, goal: ev.goal, returning: false };
        causes.push(`goal:(${ev.goal.x.toFixed(0)},${ev.goal.z.toFixed(0)})`);
        forceImmediate = true;
        break;
      case "set-weight-profile":
        // Elegir un perfil nombrado descarta la preferencia manual
        working = { ...working, weightProfile: ev.profileId, customWeights: null };
        causes.push(`profile:${ev.profileId}`);
        forceImmediate = true;
        break;
      case "request-replan":
        // Petición explícita del operador ("Calcular ruta óptima"): replanificación inmediata
        causes.push("manual:replan");
        // "Calcular con A*" vuelve a intentar el destino aunque se estuviera regresando
        working = { ...working, returning: false };
        forceImmediate = true;
        break;
      case "set-custom-weights": {
        if (ev.weights === null) {
          working = { ...working, customWeights: null };
          causes.push("weights:profile");
        } else {
          try {
            const w = validateWeights(ev.weights);
            working = { ...working, customWeights: w };
            causes.push(
              `weights:D${w.d.toFixed(2)}·T${w.t.toFixed(2)}·R${w.r.toFixed(2)}·E${w.e.toFixed(2)}·U${w.u.toFixed(2)}·H${w.h.toFixed(2)}`,
            );
          } catch {
            // Vector inválido (INV-R1/R5): se rechaza sin tocar la sesión
            causes.push("weights:rejected");
            break;
          }
        }
        forceImmediate = true;
        break;
      }
      case "storm-appear": {
        const filtered = working.storms.filter((s) => s.id !== ev.storm.id);
        working = {
          ...working,
          storms: [...filtered, ev.storm].sort((a, b) => a.id.localeCompare(b.id)),
        };
        causes.push(`storm:${ev.storm.id}`);
        break;
      }
      case "storm-clear":
        working = {
          ...working,
          storms: working.storms.map((s) => (s.id === ev.stormId ? { ...s, active: false } : s)),
        };
        causes.push(`storm-clear:${ev.stormId}`);
        break;
      case "sep-alert":
        working = {
          ...working,
          sepAlertActive: ev.active,
          baseDoseRateMsvPerSol: ev.active ? 0.64 * (ev.doseRateMultiplier ?? 4) : 0.64,
        };
        causes.push(`sep:${ev.active ? "on" : "off"}`);
        break;
      case "dust-change":
        working = { ...working, baseDustTau: Math.max(0.1, ev.tau) };
        causes.push(`dust:${ev.tau.toFixed(2)}`);
        break;
      case "radiation-change":
        working = { ...working, baseDoseRateMsvPerSol: Math.max(0.1, ev.doseRateMsvPerSol) };
        causes.push(`rad:${ev.doseRateMsvPerSol.toFixed(2)}`);
        break;
      case "zone-add": {
        const filtered = working.manualZones.filter((z) => z.id !== ev.zone.id);
        working = {
          ...working,
          manualZones: [...filtered, ev.zone].sort((a, b) => a.id.localeCompare(b.id)),
        };
        causes.push(`zone:${ev.zone.id}:${ev.zone.zone}`);
        break;
      }
      case "battery-drop": {
        const dropWh =
          (Math.max(0, Math.min(100, ev.dropPct)) / 100) * TREK_PARAMS.suitBatteryWh.value;
        const nextBatWh = Math.max(0, working.resources.batteryWh - dropWh);
        const updatedRes = createInitialResourceState(working.resources.subjectId, {
          ...working.resources,
          batteryWh: nextBatWh,
        });
        working = { ...working, resources: updatedRes };
        causes.push(`battery-drop:${ev.dropPct}%`);
        break;
      }
      case "o2-leak": {
        const nextPsi = Math.max(0, working.resources.o2PrimaryPsi - ev.dropPsi);
        const updatedRes = createInitialResourceState(working.resources.subjectId, {
          ...working.resources,
          o2PrimaryPsi: nextPsi,
          o2Source: ev.useSecondary || nextPsi <= 0 ? "SEC" : working.resources.o2Source,
        });
        working = { ...working, resources: updatedRes };
        causes.push(`o2-leak:${ev.dropPsi}psi`);
        break;
      }
      case "health-incident": {
        const inc = ev.incident as TelemetryIncidentId;
        incidentOverride = inc;
        working = {
          ...working,
          telemetry: {
            ...working.telemetry,
            incident: inc,
            incidentElapsedS: 0,
          },
          latestTelemetryRow:
            inc === "perdida_sensores"
              ? ({
                  ...(working.latestTelemetryRow ?? {}),
                  t_s: working.clockS,
                  ev_id: "EVA1",
                  simulated: true,
                  dataType: "SIMULATED",
                  telemetryCut: true,
                  fatigueIndex: working.fsm.fatigueIndex,
                  dataQuality: { ecg: "missing", spo2: "missing", coreTemp: "missing" },
                } as TelemetrySampleRow)
              : working.latestTelemetryRow,
        };
        causes.push(`health:${inc}`);
        break;
      }
      case "human-authorize":
        humanAuth = {
          by: ev.by,
          justification: ev.justification,
          ...(ev.atShelter !== undefined ? { atShelter: ev.atShelter } : {}),
        };
        if (working.telemetry.incident !== "nominal") {
          incidentOverride = "nominal";
          working = {
            ...working,
            telemetry: { ...working.telemetry, incident: "nominal", incidentElapsedS: 0 },
            latestTelemetryRow: working.latestTelemetryRow
              ? { ...working.latestTelemetryRow, telemetryCut: false }
              : null,
          };
        }
        causes.push(`auth:${ev.by}`);
        forceImmediate = true;
        break;
    }
  }

  return evaluateCycle(
    working,
    working.clockS,
    causes,
    forceImmediate,
    incidentOverride,
    humanAuth,
  );
}

/** Mueve al astronauta sobre activeRoute hasta el minuto de EVA `elapsedMin`. */
function advanceWalk(
  session: TrekSessionState,
  elapsedMin: number,
): Pick<
  TrekSessionState,
  "position" | "trail" | "walkedM" | "legStartMin" | "activeRoute" | "stopIdx" | "stopLog" | "dwell"
> {
  let route = session.activeRoute;
  let position = session.position;
  let trail = session.trail;
  let walkedM = session.walkedM;
  let stopIdx = session.stopIdx;
  let stopLog = session.stopLog;
  let dwell = session.dwell;
  // Minuto de EVA hasta el que ya se contabilizó el movimiento
  let t = session.legStartMin;
  const visitingStops = !session.returning && session.directive.goalPolicy === "keep-goal";

  for (let guard = 0; guard < 64 && t < elapsedMin - 1e-9; guard += 1) {
    if (dwell) {
      // Trabajo científico: el astronauta no se mueve hasta que termina
      if (elapsedMin < dwell.untilMin) break;
      const done = session.stops.find((x) => x.id === dwell!.stopId);
      stopLog = [
        ...stopLog,
        {
          stopId: dwell.stopId,
          name: done?.name ?? dwell.stopId,
          status: "done",
          atMin: dwell.untilMin,
        },
      ];
      t = Math.max(t, dwell.untilMin);
      dwell = null;
      continue;
    }
    if (!route || route.points.length < 2) break;

    // Tiempo sobre la ruta hasta la siguiente parada pendiente (si la ruta pasa por ella)
    const next = visitingStops ? session.stops[stopIdx] : undefined;
    let toStopMin = Number.POSITIVE_INFINITY;
    if (next) {
      if (near(position, next.point, 1.5)) {
        toStopMin = 0;
      } else {
        let acc = 0;
        for (const seg of route.segments) {
          acc += seg.durationMin;
          if (near(seg.to, next.point, 1.5)) {
            toStopMin = acc;
            break;
          }
        }
      }
    }

    const budget = elapsedMin - t;
    const move = Math.min(budget, toStopMin);
    if (move > 0) {
      const step = advanceAlongRoute(route, move);
      position = step.position;
      trail = [...trail, ...step.passed, step.position];
      walkedM += step.walkedM;
      route =
        step.remaining.length >= 2
          ? tracePolyline(
              session.snapshot,
              session.envelope,
              session.activeWeights,
              step.remaining,
              step.remaining,
              session.resources,
            ).route
          : null;
    }
    if (next && toStopMin <= budget) {
      t += toStopMin;
      dwell = { stopId: next.id, untilMin: t + Math.max(0, next.dwellMin) };
      stopIdx += 1;
      continue;
    }
    t = elapsedMin;
  }

  return {
    position,
    trail,
    walkedM,
    legStartMin: elapsedMin,
    // Al llegar al final no queda tramo: la caminata terminó en ese punto
    activeRoute: route,
    stopIdx,
    stopLog,
    dwell,
  };
}

/** Avanza el reloj de la sesión dtS segundos, actualizando telemetría, recursos, salud y replanificación. */
export function tick(session: TrekSessionState, dtS: number): TrekSessionState {
  if (dtS <= 0) return session;
  const nextClockS = session.clockS + dtS;
  const stepTel = stepTelemetry(session.telemetry, {
    dtS,
    incident: session.telemetry.incident,
  });
  // Con una caminata HUELLA activa, la fila sale del CSV de "metricas de vida" (el generador sigue
  // avanzando en paralelo para poder volver a él sin saltos); un corte de sensores inyectado se respeta.
  let row: TelemetrySampleRow = stepTel.row;
  let live = session.live;
  if (live && !session.huellaReplay) {
    // Misión individual: el astronauta en vivo avanza segundo a segundo con sus fallas
    const prog = routeProgress(session);
    let suit = live.suit;
    const steps = Math.max(1, Math.round(dtS));
    for (let i = 0; i < steps; i += 1) {
      suit = stepLiveSuit(suit, live.params, live.faults, {
        routeSlopePct: prog.slopePct,
        walking: prog.walking,
        speActive: session.sepAlertActive,
        doseRateMsvPerSol: session.baseDoseRateMsvPerSol,
        observationS: live.protocol.observationS,
        ...(session.env
          ? { coolingFactor: ambientCoolingFactor(session.env.pressurePa.value) }
          : {}),
      });
    }
    live = { ...live, suit };
    row = {
      ...liveRow(suit, live.params, {
        batteryPct: (100 * session.resources.batteryWh) / TREK_PARAMS.suitBatteryWh.value,
        coolantPct: session.resources.coolantStoragePct,
        fatigueIndex: stepFatigue(session.fsm.fatigueIndex, dtS, { metabolicW: suit.met / 3.6 }),
      }),
      telemetryCut: stepTel.row.telemetryCut,
    };
  } else if (session.huellaReplay) {
    const r0 = replayRowAt(session.huellaReplay, nextClockS, session.fsm.fatigueIndex);
    const metW = (Number(r0["metabolic_rate_kj_h"]) || 1000) / 3.6;
    row = {
      ...r0,
      fatigueIndex: stepFatigue(session.fsm.fatigueIndex, dtS, { metabolicW: metW }),
      telemetryCut: stepTel.row.telemetryCut,
    };
  }
  const metabolicW = (Number(row["metabolic_rate_kj_h"]) || 1000) / 3.6;
  const nextResources = stepResources(
    session.resources,
    dtS,
    metabolicW,
    session.baseDoseRateMsvPerSol,
  );

  // El astronauta avanza sobre el tramo activo; la ruta activa pasa a ser lo que falta desde ahí
  const walk = advanceWalk(session, nextResources.evaElapsedMin);

  const preSession: TrekSessionState = {
    ...session,
    ...walk,
    // Con entorno de Marte, el Sol avanza con el reloj de la misión (hora local de Gale)
    ...(session.env
      ? { sunElevationDeg: envAtMissionTime(session.env, nextClockS).sunElevationDeg }
      : {}),
    clockS: nextClockS,
    resources: nextResources,
    telemetry: stepTel.state,
    latestTelemetryRow: row,
    live,
    fsm: {
      ...session.fsm,
      fatigueIndex: row.fatigueIndex,
    },
  };

  return evaluateCycle(preSession, nextClockS, [`tick:+${dtS}s`], false, stepTel.state.incident);
}
