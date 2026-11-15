/**
 * Mars Trek · Búsqueda A* multicapa sobre grafo dirigido 8-conexo (ROUTING_ALGORITHM §3–§5).
 * Las restricciones duras de SafetyEnvelope actúan como máscara del grafo (INV-R3, INV-S2).
 */
import type {
  BlockReason,
  LocalPoint,
  NoRouteReason,
  SafetyEnvelope,
  WeightVector,
} from "../contracts";
import { meetsMinConfidence } from "../contracts";
import type { CostmapSnapshot } from "../costmap/snapshot";
import { edgeCost } from "../cost/terms";
import { isSafetyEnvelope } from "../safety/envelope";
import { MinHeap } from "./heap";

const RAD_TO_DEG = 180 / Math.PI;

export interface SearchOptions {
  /** Multiplicadores adicionales de penalización por índice de nodo (para generar corredores alternativos). */
  readonly penalizedNodes?: ReadonlySet<number>;
  readonly nodePenaltyFactor?: number;
  /** Cuando true, usa h(n) = 0 (Dijkstra exacto) para validación de propiedad PT-01. */
  readonly dijkstraMode?: boolean;
  /** Cuando true, usa el costo exacto de findSafePath para prueba de equivalencia PT-08. */
  readonly legacySlopeCostOnly?: boolean;
  readonly legacyCautionDeg?: number;
  readonly legacyCautionWeight?: number;
}

export type SearchResult =
  | {
      readonly ok: true;
      readonly nodeIndices: readonly number[];
      readonly rawPoints: readonly LocalPoint[];
      readonly totalCostM: number;
      readonly expandedNodes: number;
    }
  | {
      readonly ok: false;
      readonly reason: NoRouteReason;
      readonly message: string;
      readonly blocked: readonly BlockReason[];
    };

/** Verifica si una celda individual cumple la máscara de la envolvente de seguridad. */
export function checkNodeAdmissibility(
  snapshot: CostmapSnapshot,
  envelope: SafetyEnvelope,
  nodeIdx: number,
): { ok: true } | { ok: false; reason: BlockReason } {
  const { terrain, zone, confidenceClass } = snapshot;
  const pt = snapshot.pointAtIndex(nodeIdx);
  const elev = terrain.elevation[nodeIdx]!;
  if (Number.isNaN(elev)) {
    return {
      ok: false,
      reason: {
        kind: "unknown-terrain",
        at: pt,
        detail: `Celda sin elevación válida (NaN / clase K5) en (${pt.x.toFixed(1)}, ${pt.z.toFixed(1)})`,
      },
    };
  }

  const conf = confidenceClass[nodeIdx]!;
  if (!meetsMinConfidence(conf, envelope.minConfidence)) {
    return {
      ok: false,
      reason: {
        kind: "confidence",
        at: pt,
        detail: `Confianza ${conf} inferior al mínimo requerido ${envelope.minConfidence}`,
        value: conf,
        limit: envelope.minConfidence,
      },
    };
  }

  const z = zone[nodeIdx]!;
  if (z === "Z5" || !envelope.allowedZones.has(z)) {
    // Distinguir si fue causado por tormenta activa
    for (const storm of snapshot.dynamic.storms) {
      if (
        storm.active &&
        Math.hypot(pt.x - storm.center.x, pt.z - storm.center.z) <= storm.radiusM
      ) {
        return {
          ok: false,
          reason: {
            kind: "storm",
            at: pt,
            detail: `Dentro de tormenta activa '${storm.name}' (zona Z5)`,
            value: storm.tau,
          },
        };
      }
    }
    const cellSlope = terrain.slopeDeg[nodeIdx]!;
    if (
      !Number.isNaN(cellSlope) &&
      cellSlope > envelope.maxSlopeDeg &&
      envelope.slopeMode !== "edge"
    ) {
      return {
        ok: false,
        reason: {
          kind: "slope",
          at: pt,
          detail: `Pendiente local ${cellSlope.toFixed(1)}° supera el límite ${envelope.maxSlopeDeg.toFixed(1)}°`,
          value: Number(cellSlope.toFixed(1)),
          limit: envelope.maxSlopeDeg,
        },
      };
    }
    return {
      ok: false,
      reason: {
        kind: "zone",
        at: pt,
        detail: `Zona ${z} excluida por la envolvente de seguridad`,
        value: z,
      },
    };
  }

  if (envelope.slopeMode !== "edge") {
    const cellSlope = terrain.slopeDeg[nodeIdx]!;
    if (!Number.isNaN(cellSlope) && cellSlope > envelope.maxSlopeDeg) {
      return {
        ok: false,
        reason: {
          kind: "slope",
          at: pt,
          detail: `Pendiente de celda ${cellSlope.toFixed(1)}° > límite ${envelope.maxSlopeDeg.toFixed(1)}°`,
          value: Number(cellSlope.toFixed(1)),
          limit: envelope.maxSlopeDeg,
        },
      };
    }
  }

  return { ok: true };
}

/** Verifica si una arista dirigida a -> b es transitable bajo la envolvente. */
export function isEdgePassable(
  snapshot: CostmapSnapshot,
  envelope: SafetyEnvelope,
  a: number,
  b: number,
  horizontalM: number,
):
  | { ok: true; signedSlopeDeg: number; absSlopeDeg: number; length3dM: number }
  | { ok: false; reason: BlockReason } {
  const ha = snapshot.terrain.elevation[a]!;
  const hb = snapshot.terrain.elevation[b]!;
  const ptB = snapshot.pointAtIndex(b);
  if (Number.isNaN(ha) || Number.isNaN(hb)) {
    return {
      ok: false,
      reason: {
        kind: "unknown-terrain",
        at: ptB,
        detail: "Terreno sin dato de elevación (NaN)",
      },
    };
  }

  const dz = hb - ha;
  const signedSlopeDeg = Math.atan2(dz, horizontalM) * RAD_TO_DEG;
  const edgeAbsSlope = Math.abs(signedSlopeDeg);

  if (envelope.slopeMode === "edge") {
    if (edgeAbsSlope >= envelope.maxSlopeDeg) {
      return {
        ok: false,
        reason: {
          kind: "slope",
          at: ptB,
          detail: `Pendiente de arista ${edgeAbsSlope.toFixed(1)}° >= ${envelope.maxSlopeDeg.toFixed(1)}°`,
          value: Number(edgeAbsSlope.toFixed(1)),
          limit: envelope.maxSlopeDeg,
        },
      };
    }
    return {
      ok: true,
      signedSlopeDeg,
      absSlopeDeg: edgeAbsSlope,
      length3dM: Math.hypot(horizontalM, dz),
    };
  }

  const nodeCheck = checkNodeAdmissibility(snapshot, envelope, b);
  if (!nodeCheck.ok) return nodeCheck;

  const cellSlopeB = snapshot.terrain.slopeDeg[b]!;
  const effectiveSlope = Number.isNaN(cellSlopeB)
    ? edgeAbsSlope
    : Math.max(edgeAbsSlope, cellSlopeB);

  if (effectiveSlope > envelope.maxSlopeDeg) {
    return {
      ok: false,
      reason: {
        kind: "slope",
        at: ptB,
        detail: `Pendiente máxima ${effectiveSlope.toFixed(1)}° supera el límite ${envelope.maxSlopeDeg.toFixed(1)}° (${envelope.directive.state})`,
        value: Number(effectiveSlope.toFixed(1)),
        limit: envelope.maxSlopeDeg,
      },
    };
  }

  return {
    ok: true,
    signedSlopeDeg,
    absSlopeDeg: effectiveSlope,
    length3dM: Math.hypot(horizontalM, dz),
  };
}

/**
 * Ejecuta búsqueda A* (o Dijkstra cuando dijkstraMode=true) sobre una instantánea del costmap.
 */
export function searchPath(
  snapshot: CostmapSnapshot,
  envelope: SafetyEnvelope,
  weights: WeightVector,
  origin: LocalPoint,
  goal: LocalPoint,
  options: SearchOptions = {},
): SearchResult {
  if (!isSafetyEnvelope(envelope) || envelope.costmapVersion !== snapshot.version) {
    return {
      ok: false,
      reason: "envelope-mismatch",
      message:
        "La envolvente de seguridad no corresponde a la versión actual de la instantánea del costmap.",
      blocked: [],
    };
  }

  const { nx, nz, cell } = snapshot.grid;
  const s = snapshot.nodeIndexAt(origin);
  if (s < 0) {
    return {
      ok: false,
      reason: "origin-out-of-bounds",
      message: `El origen (${origin.x.toFixed(1)}, ${origin.z.toFixed(1)}) está fuera de los límites de la rejilla.`,
      blocked: [{ kind: "out-of-bounds", at: origin, detail: "Origen fuera de la rejilla" }],
    };
  }
  const g = snapshot.nodeIndexAt(goal);
  if (g < 0) {
    return {
      ok: false,
      reason: "goal-out-of-bounds",
      message: `El destino (${goal.x.toFixed(1)}, ${goal.z.toFixed(1)}) está fuera de los límites de la rejilla.`,
      blocked: [{ kind: "out-of-bounds", at: goal, detail: "Destino fuera de la rejilla" }],
    };
  }

  if (envelope.slopeMode !== "edge") {
    const startCheck = checkNodeAdmissibility(snapshot, envelope, s);
    if (!startCheck.ok) {
      return {
        ok: false,
        reason: "origin-inadmissible",
        message: `El origen es inadmisible: ${startCheck.reason.detail}`,
        blocked: [startCheck.reason],
      };
    }
    const goalCheck = checkNodeAdmissibility(snapshot, envelope, g);
    if (!goalCheck.ok) {
      return {
        ok: false,
        reason: "goal-inadmissible",
        message: `El destino es inadmisible: ${goalCheck.reason.detail}`,
        blocked: [goalCheck.reason],
      };
    }
  } else {
    if (Number.isNaN(snapshot.terrain.elevation[s]!)) {
      return {
        ok: false,
        reason: "origin-inadmissible",
        message: "El origen no tiene dato de elevación.",
        blocked: [{ kind: "unknown-terrain", at: origin, detail: "Origen con elevación NaN" }],
      };
    }
    if (Number.isNaN(snapshot.terrain.elevation[g]!)) {
      return {
        ok: false,
        reason: "goal-inadmissible",
        message: "El destino no tiene dato de elevación.",
        blocked: [{ kind: "unknown-terrain", at: goal, detail: "Destino con elevación NaN" }],
      };
    }
  }

  const gi = g % nx;
  const gj = Math.floor(g / nx);
  const heuristic = (k: number): number => {
    if (options.dijkstraMode) return 0;
    const dEuclid = Math.hypot((k % nx) - gi, Math.floor(k / nx) - gj) * cell;
    return options.legacySlopeCostOnly ? dEuclid : weights.d * dEuclid;
  };

  const totalNodes = nx * nz;
  const cost = new Float64Array(totalNodes).fill(Number.POSITIVE_INFINITY);
  const from = new Int32Array(totalNodes).fill(-1);
  const closed = new Uint8Array(totalNodes);
  const heap = new MinHeap();

  cost[s] = 0;
  heap.push(s, heuristic(s), 0);

  const moves: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  let expandedNodes = 0;
  const firstBlocks: BlockReason[] = [];

  while (heap.size > 0) {
    const item = heap.pop()!;
    const k = item.node;
    if (closed[k]) continue;
    if (k === g) break;
    closed[k] = 1;
    expandedNodes += 1;

    const i = k % nx;
    const j = Math.floor(k / nx);

    for (const [di, dj] of moves) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
      const n = nj * nx + ni;
      if (closed[n]) continue;

      const diagonal = di !== 0 && dj !== 0;
      const horizontal = diagonal ? cell * Math.SQRT2 : cell;

      const edgeCheck = isEdgePassable(snapshot, envelope, k, n, horizontal);
      if (!edgeCheck.ok) {
        if (firstBlocks.length < 5) firstBlocks.push(edgeCheck.reason);
        continue;
      }

      if (diagonal) {
        const c1 = isEdgePassable(snapshot, envelope, k, j * nx + ni, cell);
        const c2 = isEdgePassable(snapshot, envelope, k, nj * nx + i, cell);
        if (!c1.ok || !c2.ok) continue;
      }

      let stepCost: number;
      if (options.legacySlopeCostOnly) {
        const caution = options.legacyCautionDeg ?? 15;
        const cautionWeight = options.legacyCautionWeight ?? 4;
        const slope = edgeCheck.absSlopeDeg;
        stepCost =
          horizontal * (1 + (slope / caution) ** 2) * (slope >= caution ? cautionWeight : 1);
      } else {
        const ec = edgeCost(
          {
            length3dM: edgeCheck.length3dM,
            slopeDeg: edgeCheck.signedSlopeDeg,
            roughness: snapshot.terrain.roughness[n]!,
            softSoilProb: snapshot.terrain.softSoil[n]!,
            dustTau: snapshot.dustTau[n]!,
            doseRateMsvPerSol: snapshot.doseRate[n]!,
            sunElevationDeg: snapshot.dynamic.sunElevationDeg,
            confidenceScore: snapshot.terrain.confidenceScore[n]!,
            zone: snapshot.zone[n]!,
            speedFactor: envelope.speedFactor,
            strainFactor: envelope.strainFactor,
            capacityFactor: envelope.capacityFactor,
            comfortSlopeDeg: envelope.comfortSlopeDeg,
          },
          weights,
        );
        stepCost = ec.totalCostM;
      }

      if (options.penalizedNodes?.has(n)) {
        stepCost *= options.nodePenaltyFactor ?? 2.5;
      }

      const nextG = cost[k]! + stepCost;
      if (nextG + 1e-12 < cost[n]!) {
        cost[n] = nextG;
        from[n] = k;
        heap.push(n, nextG + heuristic(n), nextG);
      }
    }
  }

  if (!Number.isFinite(cost[g]!)) {
    return {
      ok: false,
      reason: "no-safe-corridor",
      message:
        "No existe ningún corredor admisible entre origen y destino que cumpla la envolvente de seguridad.",
      blocked: firstBlocks,
    };
  }

  const nodeIndices: number[] = [];
  for (let cur = g; cur >= 0; cur = cur === s ? -1 : from[cur]!) {
    nodeIndices.push(cur);
  }
  nodeIndices.reverse();
  const rawPoints = nodeIndices.map((idx) => snapshot.pointAtIndex(idx));

  return {
    ok: true,
    nodeIndices,
    rawPoints,
    totalCostM: cost[g]!,
    expandedNodes,
  };
}
