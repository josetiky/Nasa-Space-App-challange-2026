/**
 * Mars Trek · Integración de una polilínea sobre el costmap: métricas, validación de envolvente
 * y análisis de bloqueo del camino directo (ROUTING_ALGORITHM §5.1, §7, §8.1).
 */
import type {
  DirectLineSummary,
  BlockReason,
  ConfidenceClass,
  CostTermId,
  LocalPoint,
  ResourcePlan,
  ResourceState,
  Route,
  RouteSegment,
  SafetyEnvelope,
  WeightVector,
} from "../contracts";
import { confidenceRank } from "../contracts";
import type { CostmapSnapshot } from "../costmap/snapshot";
import { edgeCost } from "../cost/terms";
import { TREK_PARAMS } from "../params";
import { consumptionRates, returnMargin } from "../resources/consumables";
import { pandolfMars } from "../resources/locomotion";
import { checkNodeAdmissibility, isEdgePassable } from "./astar";

const RAD_TO_DEG = 180 / Math.PI;
const SOL_MINUTES = 88_775.244 / 60;
const DEFAULT_LOCOMOTION = pandolfMars();

export interface TraceResult {
  readonly route: Route;
  readonly contributions: Record<CostTermId, number>;
  readonly confidenceHistogramM: Record<ConfidenceClass, number>;
  readonly resourcePlan: ResourcePlan;
}

/**
 * Integra una polilínea (lista de puntos) sobre la instantánea del costmap,
 * muestreando subpasos de tamaño <= 1 celda para capturar fielmente pendientes y zonas intermedias.
 */
export function tracePolyline(
  snapshot: CostmapSnapshot,
  envelope: SafetyEnvelope,
  weights: WeightVector,
  points: readonly LocalPoint[],
  rawPoints?: readonly LocalPoint[],
  resources?: ResourceState,
  legacySlopeCostOnly = false,
): TraceResult {
  const segments: RouteSegment[] = [];
  const contributions: Record<CostTermId, number> = { D: 0, T: 0, R: 0, E: 0, U: 0, H: 0 };
  const confidenceHistogramM: Record<ConfidenceClass, number> = {
    K1: 0,
    K2: 0,
    K3a: 0,
    K3b: 0,
    K3c: 0,
    K3d: 0,
    K4: 0,
    K5: 0,
  };

  let totalDistanceM = 0;
  let totalHorizontalM = 0;
  let elevationGainM = 0;
  let maxSlopeDeg = 0;
  let totalDurationMin = 0;
  let totalEnergyWh = 0;
  let totalO2Kg = 0;
  let totalDoseUSv = 0;
  let totalEquivalentCostM = 0;
  let minConfidence: ConfidenceClass = "K1";

  const perSegmentPlan: Array<{
    durationMin: number;
    energyWh: number;
    o2Kg: number;
    doseUSv: number;
    limitingAfterMin: number;
  }> = [];

  const initialLimitingMin = resources?.limiting.minutes ?? 360;
  let remainingLimitingMin = initialLimitingMin;
  let pointOfNoReturnAtM: number | null = null;

  const cellM = snapshot.grid.cell;

  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1]!;
    const to = points[i]!;
    const totalSegHoriz = Math.hypot(to.x - from.x, to.z - from.z);
    if (totalSegHoriz < 1e-9) continue;

    // Submuestrear tramos largos cada 1 celda para no saltar colinas ni zonas intermedias
    const subSteps = Math.max(1, Math.ceil(totalSegHoriz / cellM));
    let segDist3d = 0;
    let segDeltaZ = 0;
    let segMaxSlope = 0;
    let segDurationMin = 0;
    let segEnergyWh = 0;
    let segO2Kg = 0;
    let segDoseUSv = 0;
    let segEqCost = 0;
    let segZone = snapshot.zoneAt(to.x, to.z);
    let segConf = snapshot.confidenceAt(to.x, to.z);

    for (let s = 1; s <= subSteps; s += 1) {
      const t0 = (s - 1) / subSteps;
      const t1 = s / subSteps;
      const pA = { x: from.x + (to.x - from.x) * t0, z: from.z + (to.z - from.z) * t0 };
      const pB = { x: from.x + (to.x - from.x) * t1, z: from.z + (to.z - from.z) * t1 };
      const horiz = Math.hypot(pB.x - pA.x, pB.z - pA.z);
      if (horiz < 1e-9) continue;

      const idxA = snapshot.nodeIndexAt(pA);
      const idxB = snapshot.nodeIndexAt(pB);
      const zA =
        idxA >= 0 ? snapshot.terrain.elevation[idxA]! : snapshot.sample("elevation", pA.x, pA.z);
      const zB =
        idxB >= 0 ? snapshot.terrain.elevation[idxB]! : snapshot.sample("elevation", pB.x, pB.z);
      const dz = idxA === idxB || Number.isNaN(zA) || Number.isNaN(zB) ? 0 : zB - zA;
      const dist3d = Math.hypot(horiz, dz);
      const nodeHoriz =
        idxA >= 0 && idxB >= 0 && idxA !== idxB
          ? Math.hypot(
              snapshot.pointAtIndex(idxB).x - snapshot.pointAtIndex(idxA).x,
              snapshot.pointAtIndex(idxB).z - snapshot.pointAtIndex(idxA).z,
            )
          : horiz;
      const signedSlopeDeg =
        idxA === idxB ? 0 : Math.atan2(dz, Math.max(horiz, nodeHoriz)) * RAD_TO_DEG;
      const cellSlopeB = idxB >= 0 ? snapshot.terrain.slopeDeg[idxB]! : Number.NaN;
      const absSlopeDeg =
        envelope.slopeMode === "edge" || Number.isNaN(cellSlopeB)
          ? Math.abs(signedSlopeDeg)
          : Math.max(Math.abs(signedSlopeDeg), cellSlopeB);

      const conf = idxB >= 0 ? snapshot.confidenceClass[idxB]! : snapshot.confidenceAt(pB.x, pB.z);
      if (confidenceRank(conf) < confidenceRank(minConfidence)) {
        minConfidence = conf;
      }
      if (confidenceRank(conf) < confidenceRank(segConf)) {
        segConf = conf;
      }

      const zone = idxB >= 0 ? snapshot.zone[idxB]! : snapshot.zoneAt(pB.x, pB.z);
      segZone = zone;
      const rough = idxB >= 0 ? snapshot.terrain.roughness[idxB]! : 0;
      const soft = idxB >= 0 ? snapshot.terrain.softSoil[idxB]! : 0;
      const tau = idxB >= 0 ? snapshot.dustTau[idxB]! : snapshot.dynamic.baseDustTau;
      const doseRate =
        idxB >= 0 ? snapshot.doseRate[idxB]! : snapshot.dynamic.baseDoseRateMsvPerSol;
      const confScore = idxB >= 0 ? snapshot.terrain.confidenceScore[idxB]! : 0.8;

      const ec = edgeCost(
        {
          length3dM: dist3d,
          slopeDeg: signedSlopeDeg,
          roughness: rough,
          softSoilProb: soft,
          dustTau: tau,
          doseRateMsvPerSol: doseRate,
          sunElevationDeg: snapshot.dynamic.sunElevationDeg,
          confidenceScore: confScore,
          zone,
          speedFactor: envelope.speedFactor,
          strainFactor: envelope.strainFactor,
          capacityFactor: envelope.capacityFactor,
          comfortSlopeDeg: envelope.comfortSlopeDeg,
          payloadKg: resources?.payloadKg ?? TREK_PARAMS.refEquipmentKg.value,
          locomotion: DEFAULT_LOCOMOTION,
        },
        weights,
      );

      const eqCost = legacySlopeCostOnly
        ? horiz *
          (1 + (Math.abs(signedSlopeDeg) / 15) ** 2) *
          (Math.abs(signedSlopeDeg) >= 15 ? 4 : 1)
        : ec.totalCostM;

      if (legacySlopeCostOnly) {
        contributions.D += eqCost * weights.d;
        contributions.T += eqCost * (1 - weights.d);
      } else {
        contributions.D += ec.contributions.D;
        contributions.T += ec.contributions.T;
        contributions.R += ec.contributions.R;
        contributions.E += ec.contributions.E;
        contributions.U += ec.contributions.U;
        contributions.H += ec.contributions.H;
      }

      const speedMs = ec.intensities.speedMs;
      const durationMin = dist3d / speedMs / 60;
      const rates = consumptionRates(ec.intensities.metabolicW, DEFAULT_LOCOMOTION);
      const energyWh = (ec.intensities.metabolicW * durationMin) / 60;
      const o2Kg = rates.o2KgPerMin * durationMin;
      const doseUSv =
        ((Number.isNaN(doseRate) ? 0.64 : doseRate) / SOL_MINUTES) * durationMin * 1000;

      segDist3d += dist3d;
      segDeltaZ += dz;
      if (absSlopeDeg > segMaxSlope) segMaxSlope = absSlopeDeg;
      segDurationMin += durationMin;
      segEnergyWh += energyWh;
      segO2Kg += o2Kg;
      segDoseUSv += doseUSv;
      segEqCost += eqCost;

      if (dz > 0) elevationGainM += dz;
      confidenceHistogramM[conf] += dist3d;
    }

    totalDistanceM += segDist3d;
    totalHorizontalM += totalSegHoriz;
    if (segMaxSlope > maxSlopeDeg) maxSlopeDeg = segMaxSlope;
    totalDurationMin += segDurationMin;
    totalEnergyWh += segEnergyWh;
    totalO2Kg += segO2Kg;
    totalDoseUSv += segDoseUSv;
    totalEquivalentCostM += segEqCost;

    remainingLimitingMin = Math.max(0, remainingLimitingMin - segDurationMin);
    if (pointOfNoReturnAtM === null && remainingLimitingMin < totalDurationMin + 30) {
      pointOfNoReturnAtM = totalDistanceM;
    }

    segments.push({
      from,
      to,
      distanceM: segDist3d,
      horizontalM: totalSegHoriz,
      deltaZM: segDeltaZ,
      slopeDeg: segMaxSlope,
      durationMin: segDurationMin,
      energyWh: segEnergyWh,
      o2Kg: segO2Kg,
      doseUSv: segDoseUSv,
      zone: segZone,
      confidence: segConf,
      equivalentCostM: segEqCost,
    });

    perSegmentPlan.push({
      durationMin: segDurationMin,
      energyWh: segEnergyWh,
      o2Kg: segO2Kg,
      doseUSv: segDoseUSv,
      limitingAfterMin: remainingLimitingMin,
    });
  }

  let rawMaxSlopeDeg = maxSlopeDeg;
  const rawList = rawPoints ?? points;
  for (let i = 1; i < rawList.length; i += 1) {
    const a = rawList[i - 1]!;
    const b = rawList[i]!;
    const horiz = Math.hypot(b.x - a.x, b.z - a.z);
    if (horiz < 1e-9) continue;
    const ia = snapshot.nodeIndexAt(a);
    const ib = snapshot.nodeIndexAt(b);
    if (ia >= 0 && ib >= 0) {
      const dz = Math.abs(snapshot.terrain.elevation[ib]! - snapshot.terrain.elevation[ia]!);
      const edgeS = Math.atan2(dz, horiz) * RAD_TO_DEG;
      const cellS = snapshot.terrain.slopeDeg[ib]!;
      const s =
        envelope.slopeMode === "edge" || Number.isNaN(cellS) ? edgeS : Math.max(edgeS, cellS);
      if (s > rawMaxSlopeDeg) rawMaxSlopeDeg = s;
    }
  }

  const margin = returnMargin({
    limitingMin: initialLimitingMin,
    returnMin: totalDurationMin,
    reserveMin: TREK_PARAMS.secondaryO2ReserveMin.value,
  });

  const route: Route = {
    points: [...points],
    rawPoints: [...rawList],
    segments,
    distanceM: totalDistanceM,
    horizontalM: totalHorizontalM,
    elevationGainM,
    maxSlopeDeg,
    rawMaxSlopeDeg,
    durationMin: totalDurationMin,
    energyWh: totalEnergyWh,
    o2Kg: totalO2Kg,
    doseUSv: totalDoseUSv,
    minConfidence:
      points.length <= 1 && points[0]
        ? snapshot.confidenceAt(points[0].x, points[0].z)
        : minConfidence,
    equivalentCostM: totalEquivalentCostM,
  };

  const resourcePlan: ResourcePlan = {
    perSegment: perSegmentPlan,
    totals: {
      durationMin: totalDurationMin,
      energyWh: totalEnergyWh,
      o2Kg: totalO2Kg,
      doseUSv: totalDoseUSv,
    },
    returnMarginMin: margin.marginMin,
    returnMarginPct: margin.marginPct,
    pointOfNoReturnAtM,
    modelMarginPct: TREK_PARAMS.modelMarginPct.value,
    provenance: {
      dataType: "MODELLED",
      source: "Pandolf-Mars 0.38g + EMU consumables model (+25% SEXTANT margin)",
    },
  };

  return {
    route,
    contributions,
    confidenceHistogramM,
    resourcePlan,
  };
}

/**
 * Valida que una ruta completa (incluyendo muestreo cada media celda en tramos suavizados)
 * respete todas las restricciones duras de la envolvente de seguridad (INV-S2).
 */
export function validateRoute(
  route: Route,
  snapshot: CostmapSnapshot,
  envelope: SafetyEnvelope,
): { ok: true } | { ok: false; violations: BlockReason[] } {
  const violations: BlockReason[] = [];
  const stepM = snapshot.grid.cell / 2;

  for (let i = 0; i < route.points.length; i += 1) {
    const pt = route.points[i]!;
    const idx = snapshot.nodeIndexAt(pt);
    if (idx < 0) {
      violations.push({
        kind: "out-of-bounds",
        at: pt,
        detail: `Punto fuera de la rejilla en (${pt.x.toFixed(1)}, ${pt.z.toFixed(1)})`,
      });
      continue;
    }
    if (envelope.slopeMode !== "edge") {
      const check = checkNodeAdmissibility(snapshot, envelope, idx);
      if (!check.ok) violations.push(check.reason);
    }
  }

  for (let s = 1; s < route.points.length; s += 1) {
    const a = route.points[s - 1]!;
    const b = route.points[s]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-9) continue;

    const steps = Math.max(1, Math.ceil(len / stepM));
    let prevIdx = snapshot.nodeIndexAt(a);
    for (let k = 1; k <= steps; k += 1) {
      const t = k / steps;
      const samplePt = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      const curIdx = snapshot.nodeIndexAt(samplePt);
      if (curIdx < 0) {
        violations.push({
          kind: "out-of-bounds",
          at: samplePt,
          detail: "Muestra de segmento fuera de la rejilla",
        });
        break;
      }
      if (envelope.slopeMode !== "edge") {
        const nodeCheck = checkNodeAdmissibility(snapshot, envelope, curIdx);
        if (!nodeCheck.ok) {
          violations.push(nodeCheck.reason);
          break;
        }
      }
      if (prevIdx >= 0 && curIdx !== prevIdx) {
        const pPrev = snapshot.pointAtIndex(prevIdx);
        const pCur = snapshot.pointAtIndex(curIdx);
        const hDist = Math.hypot(pCur.x - pPrev.x, pCur.z - pPrev.z);
        if (hDist > 0) {
          const edgeCheck = isEdgePassable(snapshot, envelope, prevIdx, curIdx, hDist);
          if (!edgeCheck.ok) {
            violations.push(edgeCheck.reason);
            break;
          }
        }
      }
      prevIdx = curIdx;
    }
  }

  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}

/**
 * Recorre la recta directa origen -> destino y devuelve las primeras violaciones de la envolvente
 * que explican por qué no se puede ir en línea recta (ROUTING_ALGORITHM §8.1).
 */
export function inspectDirectPath(
  snapshot: CostmapSnapshot,
  envelope: SafetyEnvelope,
  origin: LocalPoint,
  goal: LocalPoint,
): BlockReason[] {
  const reasons: BlockReason[] = [];
  const seenKinds = new Set<string>();
  const dist = Math.hypot(goal.x - origin.x, goal.z - origin.z);
  if (dist < 1e-6) return reasons;

  const steps = Math.max(2, Math.ceil(dist / (snapshot.grid.cell / 2)));
  let prevIdx = snapshot.nodeIndexAt(origin);

  for (let k = 1; k <= steps; k += 1) {
    const t = k / steps;
    const pt = { x: origin.x + (goal.x - origin.x) * t, z: origin.z + (goal.z - origin.z) * t };
    const idx = snapshot.nodeIndexAt(pt);
    if (idx < 0) {
      if (!seenKinds.has("out-of-bounds")) {
        seenKinds.add("out-of-bounds");
        reasons.push({
          kind: "out-of-bounds",
          at: pt,
          detail: "La línea directa sale de la rejilla",
        });
      }
      continue;
    }

    const nodeCheck = checkNodeAdmissibility(snapshot, envelope, idx);
    if (!nodeCheck.ok && !seenKinds.has(nodeCheck.reason.kind)) {
      seenKinds.add(nodeCheck.reason.kind);
      reasons.push(nodeCheck.reason);
    }

    if (prevIdx >= 0 && idx !== prevIdx) {
      const pPrev = snapshot.pointAtIndex(prevIdx);
      const pCur = snapshot.pointAtIndex(idx);
      const hDist = Math.hypot(pCur.x - pPrev.x, pCur.z - pPrev.z);
      if (hDist > 0) {
        const edgeCheck = isEdgePassable(snapshot, envelope, prevIdx, idx, hDist);
        if (!edgeCheck.ok && !seenKinds.has(edgeCheck.reason.kind)) {
          seenKinds.add(edgeCheck.reason.kind);
          reasons.push(edgeCheck.reason);
        }
      }
    }
    prevIdx = idx;
    if (reasons.length >= 4) break;
  }

  return reasons;
}

/**
 * Mide la línea recta origen→destino sobre el costmap (distancia 3D, pendiente máxima, ascenso)
 * para compararla con la ruta A*. Usa la misma envolvente que inspectDirectPath para la admisibilidad.
 */
export function measureDirectLine(
  snapshot: CostmapSnapshot,
  envelope: SafetyEnvelope,
  origin: LocalPoint,
  goal: LocalPoint,
): DirectLineSummary {
  const horizontalM = Math.hypot(goal.x - origin.x, goal.z - origin.z);
  const steps = Math.max(2, Math.ceil(horizontalM / (snapshot.grid.cell / 2)));
  const dh = horizontalM / steps;
  let distanceM = 0;
  let maxSlopeDeg = 0;
  let gain = 0;
  let noData = 0;
  let prev = snapshot.sample("elevation", origin.x, origin.z);
  for (let k = 1; k <= steps; k += 1) {
    const t = k / steps;
    const x = origin.x + (goal.x - origin.x) * t;
    const z = origin.z + (goal.z - origin.z) * t;
    const e = snapshot.sample("elevation", x, z);
    if (Number.isNaN(e) || Number.isNaN(prev)) {
      noData += 1;
      distanceM += dh;
    } else {
      const dz = e - prev;
      distanceM += Math.hypot(dh, dz);
      if (dz > 0) gain += dz;
      const cellSlope = snapshot.sample("slopeDeg", x, z);
      maxSlopeDeg = Math.max(maxSlopeDeg, Number.isNaN(cellSlope) ? 0 : cellSlope);
    }
    prev = e;
  }
  return {
    distanceM,
    horizontalM,
    maxSlopeDeg,
    elevationGainM: gain,
    noDataFraction: noData / steps,
    admissible: inspectDirectPath(snapshot, envelope, origin, goal).length === 0,
  };
}
