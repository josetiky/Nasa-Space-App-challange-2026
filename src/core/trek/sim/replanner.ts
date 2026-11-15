/**
 * Mars Trek · Controlador de replanificación y regla de estabilidad (Tarea 10, ROUTING_ALGORITHM §6.4–§6.5).
 * Regla de estabilidad:
 * - En CRITICAL o EMERGENCY: la nueva ruta al refugio (o hold-position) se impone siempre ("emergency" / "hold-position").
 * - Si la ruta activa deja de ser válida bajo la nueva envolvente o el usuario cambió origen/destino/perfil: "replan" inmediato.
 * - Si la ruta activa sigue válida sobre la nueva instantánea: solo se "propose" cuando el nuevo costo mejora en > 10 % (δ = 10 %); de lo contrario "keep".
 */
import type { ReplanRecord, Route, RouteResult, SafetyEnvelope, WeightVector } from "../contracts";
import type { CostmapSnapshot } from "../costmap/snapshot";
import { TREK_PARAMS } from "../params";
import { tracePolyline, validateRoute } from "../routing/trace";

export interface DecideReplanInput {
  readonly seq: number;
  readonly atS: number;
  readonly currentRoute: Route | null;
  readonly candidateResult: RouteResult;
  readonly snapshot: CostmapSnapshot;
  readonly envelope: SafetyEnvelope;
  readonly weights: WeightVector;
  readonly causes: readonly string[];
  readonly forceImmediate?: boolean;
  readonly improvementThresholdPct?: number;
  readonly simulated?: boolean;
}

export interface DecideReplanOutput {
  readonly decision: ReplanRecord["decision"];
  readonly activeRoute: Route | null;
  readonly proposedRoute: Route | null;
  readonly record: ReplanRecord;
}

export function decideReplan(input: DecideReplanInput): DecideReplanOutput {
  const thresholdPct =
    input.improvementThresholdPct ?? TREK_PARAMS.replanImprovementThresholdPct.value;
  const isEmergencyState =
    input.envelope.directive.state === "CRITICAL" ||
    input.envelope.directive.state === "EMERGENCY" ||
    input.envelope.goalPolicy === "nearest-shelter" ||
    input.envelope.goalPolicy === "hold-position";

  if (!input.candidateResult.ok) {
    const decision: ReplanRecord["decision"] =
      input.candidateResult.reason === "hold-position" ? "hold-position" : "replan";
    return {
      decision,
      activeRoute: null,
      proposedRoute: null,
      record: {
        seq: input.seq,
        atS: input.atS,
        decision,
        causes: input.causes,
        previousCostM: input.currentRoute?.equivalentCostM ?? null,
        newCostM: null,
        improvementPct: null,
        summary: input.candidateResult.message,
        simulated: input.simulated ?? true,
      },
    };
  }

  const newRoute = input.candidateResult.route;

  // 1. En CRITICAL / EMERGENCY o primera ruta o cambio explícito (origen/destino/perfil) se impone
  if (isEmergencyState) {
    return {
      decision: "emergency",
      activeRoute: newRoute,
      proposedRoute: null,
      record: {
        seq: input.seq,
        atS: input.atS,
        decision: "emergency",
        causes: input.causes,
        previousCostM: input.currentRoute?.equivalentCostM ?? null,
        newCostM: newRoute.equivalentCostM,
        improvementPct: null,
        summary: `Modo ${input.envelope.directive.state}: ruta impuesta hacia refugio (${newRoute.distanceM.toFixed(0)} m, máx ${newRoute.maxSlopeDeg.toFixed(1)}°).`,
        simulated: input.simulated ?? true,
      },
    };
  }

  if (!input.currentRoute || input.forceImmediate) {
    return {
      decision: "replan",
      activeRoute: newRoute,
      proposedRoute: null,
      record: {
        seq: input.seq,
        atS: input.atS,
        decision: "replan",
        causes: input.causes,
        previousCostM: input.currentRoute?.equivalentCostM ?? null,
        newCostM: newRoute.equivalentCostM,
        improvementPct: null,
        summary: `Ruta calculada (${newRoute.distanceM.toFixed(0)} m, costo ${newRoute.equivalentCostM.toFixed(0)} m-eq).`,
        simulated: input.simulated ?? true,
      },
    };
  }

  // 2. Revalidar la ruta actual contra la nueva envolvente y la nueva instantánea
  const validity = validateRoute(input.currentRoute, input.snapshot, input.envelope);
  if (!validity.ok) {
    const firstViolation = validity.violations[0]?.detail ?? "restricción de seguridad";
    return {
      decision: "replan",
      activeRoute: newRoute,
      proposedRoute: null,
      record: {
        seq: input.seq,
        atS: input.atS,
        decision: "replan",
        causes: input.causes,
        previousCostM: input.currentRoute.equivalentCostM,
        newCostM: newRoute.equivalentCostM,
        improvementPct: null,
        summary: `Ruta anterior invalidada (${firstViolation}) → nueva ruta segura (${newRoute.distanceM.toFixed(0)} m, máx ${newRoute.maxSlopeDeg.toFixed(1)}°).`,
        simulated: input.simulated ?? true,
      },
    };
  }

  // 3. La ruta actual sigue siendo admisible: evaluar su costo sobre la nueva instantánea y nuevos pesos
  const reevalCurrent = tracePolyline(
    input.snapshot,
    input.envelope,
    input.weights,
    input.currentRoute.points,
    input.currentRoute.rawPoints,
  );
  const currentCostOnNewSnap = reevalCurrent.route.equivalentCostM;
  const newCost = newRoute.equivalentCostM;
  const improvementPct =
    currentCostOnNewSnap > 1e-6
      ? ((currentCostOnNewSnap - newCost) / currentCostOnNewSnap) * 100
      : 0;

  if (improvementPct > thresholdPct) {
    return {
      decision: "propose",
      activeRoute: reevalCurrent.route,
      proposedRoute: newRoute,
      record: {
        seq: input.seq,
        atS: input.atS,
        decision: "propose",
        causes: input.causes,
        previousCostM: currentCostOnNewSnap,
        newCostM: newCost,
        improvementPct,
        summary: `Propuesta de desvío: mejora el costo en ${improvementPct.toFixed(1)} % (> ${thresholdPct} %). Ruta actual sigue siendo válida.`,
        simulated: input.simulated ?? true,
      },
    };
  }

  return {
    decision: "keep",
    activeRoute: reevalCurrent.route,
    proposedRoute: null,
    record: {
      seq: input.seq,
      atS: input.atS,
      decision: "keep",
      causes: input.causes,
      previousCostM: currentCostOnNewSnap,
      newCostM: newCost,
      improvementPct,
      summary: `Ruta actual conservada (mejora de alternativa ${improvementPct.toFixed(1)} % ≤ umbral ${thresholdPct} %).`,
      simulated: input.simulated ?? true,
    },
  };
}
