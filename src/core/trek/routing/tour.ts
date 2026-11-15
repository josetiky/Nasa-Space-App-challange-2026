/**
 * Mars Trek · Recorrido con paradas científicas (origen → paradas → destino).
 *
 * Cada tramo es una búsqueda A* normal bajo la misma envolvente de seguridad, así que ninguna
 * parada relaja un límite. Una parada que no tiene corredor admisible se omite con su motivo y el
 * recorrido sigue a la siguiente. El tiempo de trabajo en cada parada no mueve al astronauta, pero
 * sí consume oxígeno, batería y dosis: entra en los totales y en el margen de regreso.
 *
 * Solo aplica con la política "keep-goal". En CRITICAL/EMERGENCY la directiva manda al refugio y las
 * paradas se ignoran (seguridad > ciencia).
 */
import type {
  ConfidenceClass,
  LocalPoint,
  ResourcePlan,
  Route,
  RouteExplanation,
  RouteRequest,
  RouteResult,
  SafetyEnvelope,
  TourLeg,
  TourPlan,
  TourSkip,
  TourStop,
} from "../contracts";
import { confidenceRank } from "../contracts";
import type { CostmapSnapshot } from "../costmap/snapshot";
import { TREK_PARAMS } from "../params";
import { consumptionRates, returnMargin } from "../resources/consumables";
import type { PlannerContext } from "./planner";

type PlanFn = (
  request: RouteRequest,
  envelope: SafetyEnvelope,
  snapshot: CostmapSnapshot,
  context?: PlannerContext,
) => RouteResult;
type OkResult = Extract<RouteResult, { ok: true }>;

/** Tolerancia para considerar que un tramo llegó al punto pedido (1.5 celdas de 1 m). */
const ARRIVE_TOL_M = 1.5;
const SOL_MINUTES = 88_775.244 / 60;

const near = (a: LocalPoint, b: LocalPoint) => Math.hypot(a.x - b.x, a.z - b.z) <= ARRIVE_TOL_M;

/** Potencia del trabajo científico en una parada: referencia HUELLA de actividad en llano (1000 kJ/h). */
export function stationWorkW(): number {
  return TREK_PARAMS.flatMetabolicRefKjH.value / 3.6;
}

function sumKeys<K extends string>(
  list: ReadonlyArray<Readonly<Record<K, number>>>,
): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const rec of list) {
    for (const k of Object.keys(rec) as K[]) out[k] = (out[k] ?? 0) + rec[k];
  }
  return out;
}

function appendPoints(acc: LocalPoint[], pts: readonly LocalPoint[]): void {
  for (const p of pts) {
    const last = acc[acc.length - 1];
    if (last && Math.hypot(last.x - p.x, last.z - p.z) < 1e-6) continue;
    acc.push(p);
  }
}

/**
 * Planifica origen → paradas → destino encadenando tramos A*. `planLeg` es planRoute (se inyecta para
 * no crear una dependencia circular entre módulos).
 */
export function planTour(
  request: RouteRequest,
  envelope: SafetyEnvelope,
  snapshot: CostmapSnapshot,
  context: PlannerContext,
  planLeg: PlanFn,
): RouteResult {
  const { stops = [], ...base } = request;
  const goal = request.goal;
  if (stops.length === 0 || envelope.goalPolicy !== "keep-goal" || goal === null) {
    return planLeg(base, envelope, snapshot, context);
  }
  const legContext: PlannerContext = { ...context, computeAlternatives: false };

  const legs: Array<{ result: OkResult; stop: TourStop | null }> = [];
  const skipped: TourSkip[] = [];
  let from = request.origin;
  for (const stop of stops) {
    const r = planLeg(
      { ...base, requestId: `${request.requestId}-${stop.id}`, origin: from, goal: stop.point },
      envelope,
      snapshot,
      legContext,
    );
    if (r.ok && near(r.effectiveGoal, stop.point)) {
      legs.push({ result: r, stop });
      from = r.route.points[r.route.points.length - 1] ?? stop.point;
    } else {
      skipped.push({
        stopId: stop.id,
        name: stop.name,
        reason: r.ok ? "no-safe-corridor" : r.reason,
        message: r.ok ? `Sin corredor admisible hasta la parada «${stop.name}».` : r.message,
      });
    }
  }

  const fin = planLeg(
    { ...base, requestId: `${request.requestId}-goal`, origin: from, goal },
    envelope,
    snapshot,
    legContext,
  );
  if (!fin.ok || !near(fin.effectiveGoal, goal)) {
    // El destino no se alcanza desde la última parada: plan directo de siempre (o su fallo)
    return planLeg(base, envelope, snapshot, context);
  }
  legs.push({ result: fin, stop: null });

  // Ruta caminada: tramos concatenados (sin el tiempo de las paradas)
  const points: LocalPoint[] = [];
  const rawPoints: LocalPoint[] = [];
  const segments: Route["segments"][number][] = [];
  let worst: ConfidenceClass = legs[0]!.result.route.minConfidence;
  for (const { result } of legs) {
    appendPoints(points, result.route.points);
    appendPoints(rawPoints, result.route.rawPoints);
    segments.push(...result.route.segments);
    if (confidenceRank(result.route.minConfidence) < confidenceRank(worst)) {
      worst = result.route.minConfidence;
    }
  }
  const sum = (f: (r: Route) => number) => legs.reduce((acc, l) => acc + f(l.result.route), 0);
  const max = (f: (r: Route) => number) => Math.max(...legs.map((l) => f(l.result.route)));
  const route: Route = {
    points,
    rawPoints,
    segments,
    distanceM: sum((r) => r.distanceM),
    horizontalM: sum((r) => r.horizontalM),
    elevationGainM: sum((r) => r.elevationGainM),
    maxSlopeDeg: max((r) => r.maxSlopeDeg),
    rawMaxSlopeDeg: max((r) => r.rawMaxSlopeDeg),
    durationMin: sum((r) => r.durationMin),
    energyWh: sum((r) => r.energyWh),
    o2Kg: sum((r) => r.o2Kg),
    doseUSv: sum((r) => r.doseUSv),
    minConfidence: worst,
    equivalentCostM: sum((r) => r.equivalentCostM),
  };

  // Recursos del recorrido completo: caminata + trabajo en cada parada
  const work = consumptionRates(stationWorkW());
  const initialLimitingMin = context.resources?.limiting.minutes ?? 360;
  const reserveMin = TREK_PARAMS.secondaryO2ReserveMin.value;
  const perSegment: Array<ResourcePlan["perSegment"][number]> = [];
  const tourLegs: TourLeg[] = [];
  let t = 0;
  let distanceSoFar = 0;
  let pointOfNoReturnAtM: number | null = null;
  let dwellEnergyWh = 0;
  let dwellO2Kg = 0;
  let dwellDoseUSv = 0;
  const checkPnr = () => {
    if (pointOfNoReturnAtM === null && initialLimitingMin - t < t + reserveMin) {
      pointOfNoReturnAtM = distanceSoFar;
    }
  };
  for (const { result, stop } of legs) {
    const legRoute = result.route;
    result.resourcePlan.perSegment.forEach((p, i) => {
      t += p.durationMin;
      distanceSoFar += legRoute.segments[i]?.distanceM ?? 0;
      perSegment.push({ ...p, limitingAfterMin: Math.max(0, initialLimitingMin - t) });
      checkPnr();
    });
    const arriveMin = t;
    const dwellMin = stop ? Math.max(0, stop.dwellMin) : 0;
    if (dwellMin > 0) {
      const dosePerMin =
        legRoute.durationMin > 0
          ? legRoute.doseUSv / legRoute.durationMin
          : (0.64 / SOL_MINUTES) * 1000;
      dwellEnergyWh += (work.metabolicW * dwellMin) / 60;
      dwellO2Kg += work.o2KgPerMin * dwellMin;
      dwellDoseUSv += dosePerMin * dwellMin;
      t += dwellMin;
      checkPnr();
    }
    tourLegs.push({
      toStopId: stop?.id ?? null,
      toName: stop?.name ?? "",
      point: stop?.point ?? goal,
      distanceM: legRoute.distanceM,
      walkMin: legRoute.durationMin,
      dwellMin,
      arriveMin,
      departMin: t,
      remainingAtDepartMin: initialLimitingMin - t,
    });
  }

  const totalMin = t;
  const margin = returnMargin({ limitingMin: initialLimitingMin, returnMin: totalMin, reserveMin });
  const totals = {
    durationMin: totalMin,
    energyWh: route.energyWh + dwellEnergyWh,
    o2Kg: route.o2Kg + dwellO2Kg,
    doseUSv: route.doseUSv + dwellDoseUSv,
  };
  const first = legs[0]!.result;
  const resourcePlan: ResourcePlan = {
    ...fin.resourcePlan,
    perSegment,
    totals,
    returnMarginMin: margin.marginMin,
    returnMarginPct: margin.marginPct,
    pointOfNoReturnAtM,
  };

  const explanation: RouteExplanation = {
    ...fin.explanation,
    totals: {
      distanceM: route.distanceM,
      durationMin: totalMin,
      energyWh: totals.energyWh,
      o2Kg: totals.o2Kg,
      doseUSv: totals.doseUSv,
      maxSlopeDeg: route.maxSlopeDeg,
      minConfidence: route.minConfidence,
      equivalentCostM: route.equivalentCostM,
    },
    contributions: sumKeys(
      legs.map((l) => l.result.explanation.contributions),
    ) as RouteExplanation["contributions"],
    blockedDirectPath: first.explanation.blockedDirectPath,
    ...(first.explanation.directLine ? { directLine: first.explanation.directLine } : {}),
    confidenceHistogramM: sumKeys(
      legs.map((l) => l.result.explanation.confidenceHistogramM),
    ) as RouteExplanation["confidenceHistogramM"],
    alternatives: [],
    deterministicKey: legs.map((l) => l.result.explanation.deterministicKey).join(" > "),
  };

  const tour: TourPlan = {
    legs: tourLegs,
    skipped,
    walkMin: route.durationMin,
    dwellMin: tourLegs.reduce((acc, l) => acc + l.dwellMin, 0),
    totalMin,
  };

  return {
    ok: true,
    route,
    explanation,
    resourcePlan,
    effectiveGoal: fin.effectiveGoal,
    strategy: "astar",
    epsilon: 1,
    ladderStep: Math.max(...legs.map((l) => l.result.ladderStep)),
    computeMs: legs.reduce((acc, l) => acc + l.result.computeMs, 0),
    tour,
  };
}
