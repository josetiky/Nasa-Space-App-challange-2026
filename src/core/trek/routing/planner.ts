/**
 * Mars Trek · Planificador principal de rutas: escalera de degradación, selección de refugios,
 * suavizado seguro por línea de vista, alternativas por intención y explicación (ROUTING_ALGORITHM §5–§8).
 */
import type {
  AlternativeSummary,
  BlockReason,
  LocalPoint,
  ResourceState,
  RouteExplanation,
  RouteRequest,
  RouteResult,
  SafetyEnvelope,
  WeightProfileId,
} from "../contracts";
import type { CostmapSnapshot } from "../costmap/snapshot";
import { applyMultipliers, resolveBaseWeights, WEIGHT_PROFILES } from "../cost/weights";
import { composeEnvelope, isSafetyEnvelope } from "../safety/envelope";
import { createInitialResourceState } from "../resources/consumables";
import { searchPath } from "./astar";
import { planTour } from "./tour";
import { inspectDirectPath, measureDirectLine, tracePolyline, validateRoute } from "./trace";

export interface PlannerContext {
  readonly resources?: ResourceState;
  readonly computeAlternatives?: boolean;
  readonly smooth?: boolean;
  readonly legacySlopeCostOnly?: boolean;
}

/**
 * Simplifica por línea de vista una ruta de nodos, garantizando que nunca aumente la pendiente máxima,
 * no viole la envolvente ni aumente el costo equivalente (PT-06).
 */
function smoothPolylineSafe(
  rawPoints: readonly LocalPoint[],
  snapshot: CostmapSnapshot,
  envelope: SafetyEnvelope,
  weights: ReturnType<typeof applyMultipliers>,
  resources: ResourceState,
  rawTrace: ReturnType<typeof tracePolyline>,
  legacySlopeCostOnly: boolean,
): ReturnType<typeof tracePolyline> {
  if (rawPoints.length <= 2) return rawTrace;

  const simplified: LocalPoint[] = [rawPoints[0]!];
  let i = 0;
  while (i < rawPoints.length - 1) {
    let next = i + 1;
    for (let j = rawPoints.length - 1; j > i + 1; j -= 1) {
      const candidateSeg = [rawPoints[i]!, rawPoints[j]!];
      const subTrace = tracePolyline(
        snapshot,
        envelope,
        weights,
        candidateSeg,
        candidateSeg,
        resources,
        legacySlopeCostOnly,
      );
      if (subTrace.route.maxSlopeDeg > rawTrace.route.rawMaxSlopeDeg + 1e-6) continue;
      if (subTrace.route.maxSlopeDeg >= envelope.maxSlopeDeg) continue;

      const val = validateRoute(subTrace.route, snapshot, envelope);
      if (!val.ok) continue;

      // Comprobar que el atajo no cuesta más que el subcamino original entre i y j
      const origSlice = rawPoints.slice(i, j + 1);
      const origSubTrace = tracePolyline(
        snapshot,
        envelope,
        weights,
        origSlice,
        origSlice,
        resources,
        legacySlopeCostOnly,
      );
      if (subTrace.route.equivalentCostM <= origSubTrace.route.equivalentCostM + 1e-6) {
        next = j;
        break;
      }
    }
    simplified.push(rawPoints[next]!);
    i = next;
  }

  const candidate = tracePolyline(
    snapshot,
    envelope,
    weights,
    simplified,
    rawPoints,
    resources,
    legacySlopeCostOnly,
  );
  if (
    candidate.route.equivalentCostM <= rawTrace.route.equivalentCostM + 1e-6 &&
    candidate.route.maxSlopeDeg <= rawTrace.route.rawMaxSlopeDeg + 1e-6 &&
    validateRoute(candidate.route, snapshot, envelope).ok
  ) {
    return candidate;
  }
  return rawTrace;
}

/**Sugiere hasta 3 puntos admisibles cercanos cuando el destino está bloqueado. */
function findReachableSuggestions(
  snapshot: CostmapSnapshot,
  envelope: SafetyEnvelope,
  target: LocalPoint,
): LocalPoint[] {
  const suggestions: LocalPoint[] = [];
  const { cell } = snapshot.grid;
  for (let r = 3; r <= 24 && suggestions.length < 3; r += 3) {
    for (const [dx, dz] of [
      [-r, 0],
      [r, 0],
      [0, -r],
      [0, r],
      [-r, -r],
      [r, r],
    ] as const) {
      const pt = { x: target.x + dx * cell, z: target.z + dz * cell };
      const idx = snapshot.nodeIndexAt(pt);
      if (idx >= 0 && snapshot.zone[idx] === "Z0") {
        suggestions.push(pt);
        if (suggestions.length >= 3) break;
      }
    }
  }
  return suggestions;
}

/**
 * Genera rutas alternativas por intención ("más rápido", "más seguro", "más conocido" y corredor alternativo)
 * y documenta explícitamente por qué una alternativa (p. ej. el Corredor A en FATIGUE) fue descartada.
 */
export function planAlternatives(
  request: RouteRequest,
  envelope: SafetyEnvelope,
  snapshot: CostmapSnapshot,
  primaryRawNodes: readonly number[],
  effectiveGoal: LocalPoint,
  resources: ResourceState,
): AlternativeSummary[] {
  const summaries: AlternativeSummary[] = [];

  // 1. Evaluar si el camino directo o corredor corto A fue bloqueado por la envolvente actual (ej. FATIGUE 15°)
  const directBlocks = inspectDirectPath(snapshot, envelope, request.origin, effectiveGoal);
  if (directBlocks.length > 0 && envelope.maxSlopeDeg < 20) {
    // Probar si con el límite nominal del vehículo (20°) existiría ese corredor corto (Corredor A)
    const nominalDirective = {
      ...envelope.directive,
      state: "NORMAL" as const,
      limits: {
        ...envelope.directive.limits,
        maxSlopeDeg: 20,
      },
    };
    const nominalEnv = composeEnvelope(
      request.missionProfile,
      request.vehicle,
      { slopeMode: envelope.slopeMode ?? "cell-and-edge" },
      nominalDirective,
      resources,
      snapshot,
    );
    const baseWeights = resolveBaseWeights(request.weightProfile, request.customWeights);
    const nominalSearch = searchPath(
      snapshot,
      nominalEnv,
      baseWeights,
      request.origin,
      effectiveGoal,
    );
    if (nominalSearch.ok) {
      const nomTrace = tracePolyline(snapshot, nominalEnv, baseWeights, nominalSearch.rawPoints);
      if (nomTrace.route.maxSlopeDeg > envelope.maxSlopeDeg) {
        summaries.push({
          id: "alt-corridor-a-discarded",
          label: "Corredor Directo A (Descartado por Salud)",
          profileId: "fastest",
          status: "discarded",
          route: nomTrace.route,
          totals: {
            distanceM: nomTrace.route.distanceM,
            durationMin: nomTrace.route.durationMin,
            energyWh: nomTrace.route.energyWh,
            o2Kg: nomTrace.route.o2Kg,
            doseUSv: nomTrace.route.doseUSv,
            maxSlopeDeg: nomTrace.route.maxSlopeDeg,
            minConfidence: nomTrace.route.minConfidence,
            equivalentCostM: nomTrace.route.equivalentCostM,
          },
          contributions: nomTrace.contributions,
          discardReasons: [
            {
              kind: "slope",
              at: directBlocks[0]?.at ?? request.origin,
              detail: `Pendiente máxima ${nomTrace.route.maxSlopeDeg.toFixed(1)}° supera el límite ${envelope.maxSlopeDeg.toFixed(1)}° impuesto por salud (${envelope.directive.state})`,
              value: Number(nomTrace.route.maxSlopeDeg.toFixed(1)),
              limit: envelope.maxSlopeDeg,
            },
          ],
          summary: `Descartada: pendiente de ${nomTrace.route.maxSlopeDeg.toFixed(1)}° > ${envelope.maxSlopeDeg.toFixed(1)}° (${envelope.directive.state}).`,
        });
      }
    }
  }

  // 2. Corredor alternativo penalizando los nodos interiores de la ruta primaria (para descubrir Corredor B en NORMAL)
  if (primaryRawNodes.length > 4) {
    const interior = new Set<number>(primaryRawNodes.slice(2, -2));
    const altWeights = applyMultipliers(WEIGHT_PROFILES.safest, envelope.weightMultipliers);
    const altSearch = searchPath(snapshot, envelope, altWeights, request.origin, effectiveGoal, {
      penalizedNodes: interior,
      nodePenaltyFactor: 4.0,
    });
    if (altSearch.ok) {
      // Evaluar su costo real sin la penalización artificial de exploración de corredor
      const curWeights = applyMultipliers(
        resolveBaseWeights(request.weightProfile, request.customWeights),
        envelope.weightMultipliers,
      );
      const altTrace = tracePolyline(
        snapshot,
        envelope,
        curWeights,
        altSearch.rawPoints,
        altSearch.rawPoints,
        resources,
      );
      const OverlapCount = altSearch.nodeIndices.filter((n) => interior.has(n)).length;
      if (OverlapCount < primaryRawNodes.length * 0.5) {
        summaries.push({
          id: "alt-corridor-b",
          label: "Corredor Alternativo B (Menor Pendiente)",
          profileId: "safest",
          status: "admissible",
          route: altTrace.route,
          totals: {
            distanceM: altTrace.route.distanceM,
            durationMin: altTrace.route.durationMin,
            energyWh: altTrace.route.energyWh,
            o2Kg: altTrace.route.o2Kg,
            doseUSv: altTrace.route.doseUSv,
            maxSlopeDeg: altTrace.route.maxSlopeDeg,
            minConfidence: altTrace.route.minConfidence,
            equivalentCostM: altTrace.route.equivalentCostM,
          },
          contributions: altTrace.contributions,
          discardReasons: [],
          summary: `Admisible: ${altTrace.route.distanceM.toFixed(0)} m · máx ${altTrace.route.maxSlopeDeg.toFixed(1)}° · ${altTrace.route.equivalentCostM.toFixed(0)} m-eq.`,
        });
      }
    }
  }

  // 3. Perfiles de intención ("fastest", "safest", "known")
  const candidateProfiles: Array<{ id: WeightProfileId; label: string }> = [
    { id: "fastest", label: "Perfil Más Rápido" },
    { id: "safest", label: "Perfil Más Seguro" },
    { id: "known", label: "Perfil Más Conocido" },
  ];

  for (const cand of candidateProfiles) {
    if (!request.customWeights && cand.id === request.weightProfile) continue;
    const w = applyMultipliers(WEIGHT_PROFILES[cand.id], envelope.weightMultipliers);
    const res = searchPath(snapshot, envelope, w, request.origin, effectiveGoal);
    if (res.ok) {
      const tr = tracePolyline(snapshot, envelope, w, res.rawPoints, res.rawPoints, resources);
      summaries.push({
        id: `alt-${cand.id}`,
        label: cand.label,
        profileId: cand.id,
        status: "admissible",
        route: tr.route,
        totals: {
          distanceM: tr.route.distanceM,
          durationMin: tr.route.durationMin,
          energyWh: tr.route.energyWh,
          o2Kg: tr.route.o2Kg,
          doseUSv: tr.route.doseUSv,
          maxSlopeDeg: tr.route.maxSlopeDeg,
          minConfidence: tr.route.minConfidence,
          equivalentCostM: tr.route.equivalentCostM,
        },
        contributions: tr.contributions,
        discardReasons: [],
        summary: `${tr.route.distanceM.toFixed(0)} m · máx ${tr.route.maxSlopeDeg.toFixed(1)}° · ${tr.route.durationMin.toFixed(1)} min`,
      });
    }
  }

  return summaries;
}

/**
 * Planifica la ruta óptima y segura bajo la envolvente de seguridad compuesta (ROUTING_ALGORITHM §5–§8).
 * Recorre la escalera de degradación de la directiva si el primer peldaño no encuentra corredor al refugio.
 */
export function planRoute(
  request: RouteRequest,
  envelope: SafetyEnvelope,
  snapshot: CostmapSnapshot,
  context: PlannerContext = {},
): RouteResult {
  // Recorrido con paradas científicas: tramos A* encadenados (ver routing/tour.ts)
  if (request.stops && request.stops.length > 0) {
    return planTour(request, envelope, snapshot, context, planRoute);
  }
  const t0 = performance.now();

  if (!isSafetyEnvelope(envelope) || envelope.costmapVersion !== snapshot.version) {
    return {
      ok: false,
      reason: "envelope-mismatch",
      message:
        "La envolvente de seguridad no coincide con la versión de la instantánea del costmap.",
      blocked: [],
      suggestions: [],
      envelopeId: envelope?.envelopeId ?? "invalid",
      costmapVersion: snapshot.version,
    };
  }

  const resources = context.resources ?? createInitialResourceState("EVA1");

  // Construir la lista de peldaños (peldaño 0 = envolvente principal, peldaños 1..k = fallbackLadder)
  const envelopesToTry: Array<{ env: SafetyEnvelope; step: number }> = [{ env: envelope, step: 0 }];
  envelope.directive.fallbackLadder.forEach((rung, idx) => {
    const rungDirective = {
      ...envelope.directive,
      directiveId: `${envelope.directive.directiveId}-ladder-${idx + 1}`,
      goalPolicy: rung.goalPolicy,
      limits: rung.limits,
    };
    const rungEnv = composeEnvelope(
      request.missionProfile,
      request.vehicle,
      { slopeMode: envelope.slopeMode ?? "cell-and-edge" },
      rungDirective,
      resources,
      snapshot,
    );
    envelopesToTry.push({ env: rungEnv, step: idx + 1 });
  });

  let lastFailure: { reason: RouteResult & { ok: false } } | null = null;

  for (const { env, step } of envelopesToTry) {
    if (env.goalPolicy === "hold-position") {
      return {
        ok: false,
        reason: "hold-position",
        message: "Directiva hold-position activa: mantener posición actual y solicitar rescate.",
        blocked: [],
        suggestions: [request.origin],
        envelopeId: env.envelopeId,
        costmapVersion: snapshot.version,
      };
    }

    const activeProfileId: WeightProfileId =
      env.directive.state === "CRITICAL" || env.directive.state === "EMERGENCY"
        ? "emergency"
        : request.weightProfile;
    const weights = applyMultipliers(
      resolveBaseWeights(activeProfileId, request.customWeights),
      env.weightMultipliers,
    );

    // Determinar candidatos de destino según goalPolicy
    const candidateGoals: LocalPoint[] = [];
    if (env.goalPolicy === "nearest-shelter" || env.goalPolicy === "nearest-safe-waypoint") {
      for (const sh of env.shelters) {
        candidateGoals.push(sh.point);
      }
      if (candidateGoals.length === 0 && request.goal) {
        candidateGoals.push(request.goal);
      }
    } else if (request.goal) {
      candidateGoals.push(request.goal);
    } else if (env.shelters[0]) {
      candidateGoals.push(env.shelters[0].point);
    }

    if (candidateGoals.length === 0) {
      return {
        ok: false,
        reason: "goal-out-of-bounds",
        message: "No se especificó ningún destino ni refugio disponible.",
        blocked: [],
        suggestions: [],
        envelopeId: env.envelopeId,
        costmapVersion: snapshot.version,
      };
    }

    // Buscar la mejor ruta entre los destinos candidatos (p. ej. el refugio válido más cercano)
    let bestSearch: {
      search: Extract<ReturnType<typeof searchPath>, { ok: true }>;
      goal: LocalPoint;
    } | null = null;
    let firstFail: Extract<ReturnType<typeof searchPath>, { ok: false }> | null = null;

    for (const candGoal of candidateGoals) {
      const res = searchPath(
        snapshot,
        env,
        weights,
        request.origin,
        candGoal,
        context.legacySlopeCostOnly ? { legacySlopeCostOnly: true } : {},
      );
      if (res.ok) {
        if (!bestSearch || res.totalCostM < bestSearch.search.totalCostM) {
          bestSearch = { search: res, goal: candGoal };
        }
      } else if (!firstFail) {
        firstFail = res;
      }
    }

    if (!bestSearch) {
      const fail = firstFail!;
      lastFailure = {
        reason: {
          ok: false,
          reason: fail.reason,
          message: fail.message,
          blocked: fail.blocked,
          suggestions: findReachableSuggestions(
            snapshot,
            env,
            request.goal ?? candidateGoals[0] ?? request.origin,
          ),
          envelopeId: env.envelopeId,
          costmapVersion: snapshot.version,
        },
      };
      // Si el fallo es por corredor bloqueado y hay más peldaños en la escalera, probar el siguiente
      if (fail.reason === "no-safe-corridor" || fail.reason === "goal-inadmissible") {
        continue;
      }
      return lastFailure.reason;
    }

    const rawTrace = tracePolyline(
      snapshot,
      env,
      weights,
      bestSearch.search.rawPoints,
      bestSearch.search.rawPoints,
      resources,
      context.legacySlopeCostOnly ?? false,
    );

    const finalTrace =
      context.smooth === false
        ? rawTrace
        : smoothPolylineSafe(
            bestSearch.search.rawPoints,
            snapshot,
            env,
            weights,
            resources,
            rawTrace,
            context.legacySlopeCostOnly ?? false,
          );

    // Validación final obligatoria (INV-S2)
    const validation = validateRoute(finalTrace.route, snapshot, env);
    if (!validation.ok) {
      lastFailure = {
        reason: {
          ok: false,
          reason: "no-safe-corridor",
          message: "La ruta calculada no superó la validación final de la envolvente de seguridad.",
          blocked: validation.violations,
          suggestions: [],
          envelopeId: env.envelopeId,
          costmapVersion: snapshot.version,
        },
      };
      continue;
    }

    const blockedDirectPath = inspectDirectPath(snapshot, env, request.origin, bestSearch.goal);

    const alternatives =
      context.computeAlternatives === false
        ? []
        : planAlternatives(
            request,
            env,
            snapshot,
            bestSearch.search.nodeIndices,
            bestSearch.goal,
            resources,
          );

    const deterministicKey = [
      snapshot.version,
      env.envelopeId,
      request.missionProfile,
      activeProfileId,
      `${request.origin.x.toFixed(2)},${request.origin.z.toFixed(2)}`,
      `${bestSearch.goal.x.toFixed(2)},${bestSearch.goal.z.toFixed(2)}`,
      `step=${step}`,
      `pts=${finalTrace.route.points.length}`,
      `cost=${finalTrace.route.equivalentCostM.toFixed(3)}`,
    ].join("|");

    const explanation: RouteExplanation = {
      totals: {
        distanceM: finalTrace.route.distanceM,
        durationMin: finalTrace.route.durationMin,
        energyWh: finalTrace.route.energyWh,
        o2Kg: finalTrace.route.o2Kg,
        doseUSv: finalTrace.route.doseUSv,
        maxSlopeDeg: finalTrace.route.maxSlopeDeg,
        minConfidence: finalTrace.route.minConfidence,
        equivalentCostM: finalTrace.route.equivalentCostM,
      },
      contributions: finalTrace.contributions,
      bindingConstraints: env.sources,
      blockedDirectPath,
      directLine: measureDirectLine(snapshot, env, request.origin, bestSearch.goal),
      confidenceHistogramM: finalTrace.confidenceHistogramM,
      alternatives,
      envelopeId: env.envelopeId,
      costmapVersion: snapshot.version,
      deterministicKey,
    };

    const computeMs = Math.max(0.01, performance.now() - t0);

    return {
      ok: true,
      route: finalTrace.route,
      explanation,
      resourcePlan: finalTrace.resourcePlan,
      effectiveGoal: bestSearch.goal,
      strategy: "astar",
      epsilon: 1,
      ladderStep: step,
      computeMs,
    };
  }

  return (
    lastFailure?.reason ?? {
      ok: false,
      reason: "no-safe-corridor",
      message: "No se encontró ninguna ruta segura tras agotar la escalera de degradación.",
      blocked: [],
      suggestions: [],
      envelopeId: envelope.envelopeId,
      costmapVersion: snapshot.version,
    }
  );
}
