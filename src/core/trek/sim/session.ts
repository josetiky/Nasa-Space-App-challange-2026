/**
 * Mars Trek · Ciclo de sesión de simulación y navegación (Tarea 10, ARCHITECTURE §4.3).
 * Orden fijo de evaluación en cada ciclo:
 * 1. Costmap (instantánea versionada con tormentas, SEP, polvo, radiación y zonas)
 * 2. Recursos (consumo y margen de regreso con la directiva vigente)
 * 3. Salud (reglas biomédicas HUELLA + fatiga + misión -> FSM -> nueva directiva; si cambia, recalcula margen)
 * 4. Seguridad (composeEnvelope con la directiva vigente)
 * 5. Replanificación (planRoute + decideReplan con regla de estabilidad δ = 10 %)
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
}

/** Orden canónico de eventos para que múltiples eventos simultáneos produzcan exactamente el mismo resultado en cualquier orden (Foco 5 / T-11). */
const EVENT_ORDER: Readonly<Record<SimEvent["kind"], number>> = {
  "set-origin": 1,
  "set-goal": 2,
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
  const estimatedReturnMin = prev.activeRoute ? prev.activeRoute.durationMin : 30;
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

  // 4. Seguridad: componer la envolvente con la directiva nueva y la instantánea actual
  const nextEnvelope = composeEnvelope(
    prev.missionProfile,
    prev.vehicle,
    {},
    nextDirective,
    prev.resources,
    snapshot,
  );

  // 5. Replanificación: planRoute + decideReplan
  const req = {
    requestId: `req-${prev.replanSeq + 1}-${nextClockS}`,
    origin: prev.origin,
    goal: prev.goal,
    missionProfile: prev.missionProfile,
    weightProfile: prev.weightProfile,
    ...(prev.customWeights ? { customWeights: prev.customWeights } : {}),
    vehicle: prev.vehicle,
  };

  const candidateResult = planRoute(req, nextEnvelope, snapshot, {
    resources: prev.resources,
  });

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
    causes: causes.length > 0 ? causes : [`state:${nextDirective.state}`],
    forceImmediate: forceImmediateReplan || directiveChanged,
    simulated: snapshot.simulated || nextDirective.simulated,
  });

  return {
    ...prev,
    clockS: nextClockS,
    snapshot,
    fsm: nextFsm,
    directive: nextDirective,
    envelope: nextEnvelope,
    routeResult: candidateResult,
    activeWeights,
    activeRoute: replanDecision.activeRoute,
    proposedRoute: replanDecision.proposedRoute,
    replanLog: [...prev.replanLog, replanDecision.record],
    replanSeq: prev.replanSeq + 1,
  };
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

  const snapshot = buildSnapshot(config.terrain, { shelters });
  const resources = createInitialResourceState("EVA1");
  const telemetry = createTelemetry({ evId: "EVA1" }, config.seed ?? 42);
  const fsm = createInitialFsmState("EVA1", true);
  const directive = directiveFor(fsm, { returnMarginPct: 100 });
  const envelope = composeEnvelope(missionProfile, vehicle, {}, directive, resources, snapshot);

  const routeResult = planRoute(
    {
      requestId: "req-init",
      origin: config.origin,
      goal: config.goal,
      missionProfile,
      weightProfile,
      ...(customWeights ? { customWeights } : {}),
      vehicle,
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
    baseDustTau: 0.5,
    baseDoseRateMsvPerSol: 0.64,
    sunElevationDeg: 35,
    sepAlertActive: false,
    storms: [],
    manualZones: [],
    shelters,
    snapshot,
    resources,
    telemetry,
    latestTelemetryRow: null,
    fsm,
    directive,
    envelope,
    routeResult,
    activeRoute: initialRoute,
    proposedRoute: null,
    replanLog: [],
    replanSeq: 0,
  };
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
        working = { ...working, origin: ev.origin };
        causes.push(`origin:(${ev.origin.x.toFixed(0)},${ev.origin.z.toFixed(0)})`);
        forceImmediate = true;
        break;
      case "set-goal":
        working = { ...working, goal: ev.goal };
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

/** Avanza el reloj de la sesión dtS segundos, actualizando telemetría, recursos, salud y replanificación. */
export function tick(session: TrekSessionState, dtS: number): TrekSessionState {
  if (dtS <= 0) return session;
  const nextClockS = session.clockS + dtS;
  const stepTel = stepTelemetry(session.telemetry, {
    dtS,
    incident: session.telemetry.incident,
  });
  const metabolicW = (Number(stepTel.row["metabolic_rate_kj_h"]) || 1000) / 3.6;
  const nextResources = stepResources(
    session.resources,
    dtS,
    metabolicW,
    session.baseDoseRateMsvPerSol,
  );

  const preSession: TrekSessionState = {
    ...session,
    clockS: nextClockS,
    resources: nextResources,
    telemetry: stepTel.state,
    latestTelemetryRow: stepTel.row,
    fsm: {
      ...session.fsm,
      fatigueIndex: stepTel.row.fatigueIndex,
    },
  };

  return evaluateCycle(preSession, nextClockS, [`tick:+${dtS}s`], false, stepTel.state.incident);
}
