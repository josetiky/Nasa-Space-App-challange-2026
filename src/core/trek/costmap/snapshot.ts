/**
 * Mars Trek · Instantánea inmutable y versionada del costmap y clasificación de zonas Z0–Z5 (DYNAMIC_COSTMAP §3–§7).
 */
import type {
  ConfidenceClass,
  GridSpec,
  LocalPoint,
  ShelterPoint,
  StormPolygon,
  ZoneCircle,
  ZoneClass,
} from "../contracts";
import { mostRestrictiveZone } from "../contracts";
import { TREK_PARAMS } from "../params";
import type { StaticTerrain } from "./terrain";

export interface DynamicEnvironment {
  readonly missionTimeS?: number;
  readonly baseDustTau?: number;
  readonly baseDoseRateMsvPerSol?: number;
  readonly sunElevationDeg?: number;
  readonly sepAlertActive?: boolean;
  readonly storms?: readonly StormPolygon[];
  readonly manualZones?: readonly ZoneCircle[];
  readonly shelters?: readonly ShelterPoint[];
}

export interface ZoneClassificationRules {
  readonly maxSlopeDeg?: number;
  readonly cautionSlopeDeg?: number;
  readonly payloadKg?: number;
  readonly commCenter?: LocalPoint;
  readonly commRangeM?: number;
}

export type SampleLayerId =
  "elevation" | "slopeDeg" | "roughness" | "softSoil" | "dustTau" | "doseRate" | "confidenceScore";

export interface CostmapSnapshot {
  readonly snapshotId: string;
  readonly version: string;
  readonly terrain: StaticTerrain;
  readonly grid: GridSpec;
  readonly dynamic: {
    readonly missionTimeS: number;
    readonly baseDustTau: number;
    readonly baseDoseRateMsvPerSol: number;
    readonly sunElevationDeg: number;
    readonly sepAlertActive: boolean;
    readonly storms: readonly StormPolygon[];
    readonly manualZones: readonly ZoneCircle[];
    readonly shelters: readonly ShelterPoint[];
  };
  readonly dustTau: Float32Array;
  readonly doseRate: Float32Array;
  readonly zone: readonly ZoneClass[];
  readonly confidenceClass: readonly ConfidenceClass[];
  readonly simulated: boolean;
  nodeIndexAt(p: LocalPoint): number;
  pointAtIndex(index: number): LocalPoint;
  sample(layer: SampleLayerId, x: number, z: number): number;
  zoneAt(x: number, z: number): ZoneClass;
  confidenceAt(x: number, z: number): ConfidenceClass;
}

function hashDynamicVersion(
  siteId: string,
  dyn: Required<DynamicEnvironment>,
  rules: Required<ZoneClassificationRules>,
): string {
  const activeStorms = dyn.storms
    .filter((s) => s.active)
    .map(
      (s) =>
        `${s.id}@${s.center.x.toFixed(1)},${s.center.z.toFixed(1)}:${s.radiusM.toFixed(1)}:${s.tau.toFixed(2)}`,
    )
    .join("|");
  const zones = dyn.manualZones
    .map(
      (z) =>
        `${z.id}:${z.zone}@${z.center.x.toFixed(1)},${z.center.z.toFixed(1)}:${z.radiusM.toFixed(1)}`,
    )
    .join("|");
  return [
    siteId,
    `tau=${dyn.baseDustTau.toFixed(3)}`,
    `dose=${dyn.baseDoseRateMsvPerSol.toFixed(3)}`,
    `sun=${dyn.sunElevationDeg.toFixed(1)}`,
    `sep=${dyn.sepAlertActive ? 1 : 0}`,
    `slope=${rules.cautionSlopeDeg.toFixed(1)}/${rules.maxSlopeDeg.toFixed(1)}`,
    `load=${rules.payloadKg.toFixed(1)}`,
    `storms=[${activeStorms}]`,
    `zones=[${zones}]`,
  ].join(";");
}

/**
 * Construye una instantánea inmutable del costmap sin mutar las entradas.
 * Aplica las reglas ZN-01..ZN-11 de DYNAMIC_COSTMAP §7.2:
 * - Celda sin elevación (NaN) o clase K5 => Z3 (desconocida)
 * - Pendiente > maxSlopeDeg (por defecto 20°) => Z5 (prohibida)
 * - Pendiente >= cautionSlopeDeg (por defecto 15°, o 10° con carga > 0) => Z1 (precaución)
 * - Dentro de tormenta activa => Z5 mientras esté activa
 * - Zona manual Z5 (exclusión) => Z5; zona manual Z4 (Región Especial / restringida) => Z4
 */
export function buildSnapshot(
  terrain: StaticTerrain,
  dynamicInput: DynamicEnvironment = {},
  zoneRulesInput: ZoneClassificationRules = {},
): CostmapSnapshot {
  const { grid } = terrain;
  const total = grid.nx * grid.nz;

  const dyn: Required<DynamicEnvironment> = {
    missionTimeS: dynamicInput.missionTimeS ?? 0,
    baseDustTau: dynamicInput.baseDustTau ?? 0.5,
    baseDoseRateMsvPerSol: dynamicInput.baseDoseRateMsvPerSol ?? 0.64,
    sunElevationDeg: dynamicInput.sunElevationDeg ?? 35,
    sepAlertActive: dynamicInput.sepAlertActive ?? false,
    storms: dynamicInput.storms
      ? dynamicInput.storms.map((s) => ({ ...s, center: { ...s.center } }))
      : [],
    manualZones: dynamicInput.manualZones
      ? dynamicInput.manualZones.map((z) => ({ ...z, center: { ...z.center } }))
      : [],
    shelters: dynamicInput.shelters
      ? dynamicInput.shelters.map((sh) => ({ ...sh, point: { ...sh.point } }))
      : [
          {
            id: "hab-base",
            name: "Hábitat Base / Rover Presurizado",
            point: { x: 0, z: 0 },
            kind: "habitat",
            shielded: true,
          },
        ],
  };

  const payloadKg = zoneRulesInput.payloadKg ?? 0;
  const rules: Required<ZoneClassificationRules> = {
    maxSlopeDeg: zoneRulesInput.maxSlopeDeg ?? TREK_PARAMS.maxSlopeFootNormalDeg.value,
    cautionSlopeDeg:
      zoneRulesInput.cautionSlopeDeg ??
      (payloadKg > 0
        ? TREK_PARAMS.cautionSlopeLoadedDeg.value
        : TREK_PARAMS.cautionSlopeFootDeg.value),
    payloadKg,
    commCenter: zoneRulesInput.commCenter ?? { x: 0, z: 0 },
    commRangeM: zoneRulesInput.commRangeM ?? 2000,
  };

  const dustTau = new Float32Array(total).fill(dyn.baseDustTau);
  const doseRate = new Float32Array(total).fill(
    dyn.sepAlertActive ? dyn.baseDoseRateMsvPerSol * 4 : dyn.baseDoseRateMsvPerSol,
  );
  const zone: ZoneClass[] = new Array<ZoneClass>(total).fill("Z0");
  const confidenceClass: ConfidenceClass[] = [...terrain.confidenceClass];

  for (let j = 0; j < grid.nz; j += 1) {
    for (let i = 0; i < grid.nx; i += 1) {
      const k = j * grid.nx + i;
      const elev = terrain.elevation[k]!;
      const slope = terrain.slopeDeg[k]!;
      const soft = terrain.softSoil[k]!;
      const conf = confidenceClass[k]!;

      // ZN-01 / ZN-02: sin elevación o K5 => Z3 (nunca 0)
      if (Number.isNaN(elev) || Number.isNaN(slope) || conf === "K5") {
        zone[k] = "Z3";
        dustTau[k] = Number.NaN;
        doseRate[k] = Number.NaN;
        continue;
      }

      let cellZone: ZoneClass = "Z0";

      // ZN-03 / ZN-04: límites de pendiente
      if (slope > rules.maxSlopeDeg) {
        cellZone = mostRestrictiveZone(cellZone, "Z5");
      } else if (slope >= rules.cautionSlopeDeg) {
        cellZone = mostRestrictiveZone(cellZone, "Z1");
      }

      // ZN-05: suelo blando probable con carga
      if (!Number.isNaN(soft)) {
        if (soft >= 0.75 && rules.payloadKg > 10) {
          cellZone = mostRestrictiveZone(cellZone, "Z2");
        } else if (soft >= 0.55 && rules.payloadKg > 0) {
          cellZone = mostRestrictiveZone(cellZone, "Z1");
        }
      }

      const x = grid.x0 + i * grid.cell;
      const z = grid.z0 + j * grid.cell;

      // ZN-10: alcance de comunicaciones
      if (Math.hypot(x - rules.commCenter.x, z - rules.commCenter.z) > rules.commRangeM) {
        cellZone = mostRestrictiveZone(cellZone, "Z1");
      }

      // ZN-11: iluminación baja
      if (dyn.sunElevationDeg <= 0) {
        cellZone = mostRestrictiveZone(cellZone, "Z2");
      }

      // ZN-06: polígonos de tormenta (solo mientras active === true)
      for (const storm of dyn.storms) {
        if (!storm.active) continue;
        const d = Math.hypot(x - storm.center.x, z - storm.center.z);
        if (d <= storm.radiusM) {
          cellZone = mostRestrictiveZone(cellZone, "Z5");
          dustTau[k] = Math.max(dustTau[k]!, storm.tau);
        } else if (d <= storm.radiusM * 1.35) {
          // Penumbra de polvo alrededor de la tormenta
          const falloff = 1 - (d - storm.radiusM) / (storm.radiusM * 0.35);
          dustTau[k] = Math.max(
            dustTau[k]!,
            dyn.baseDustTau + (storm.tau - dyn.baseDustTau) * falloff,
          );
          cellZone = mostRestrictiveZone(cellZone, "Z1");
        }
      }

      // ZN-08 / ZN-09: zonas restringidas (Z4) y exclusiones manuales (Z5)
      for (const mz of dyn.manualZones) {
        const d = Math.hypot(x - mz.center.x, z - mz.center.z);
        if (d <= mz.radiusM) {
          cellZone = mostRestrictiveZone(cellZone, mz.zone);
        }
      }

      zone[k] = cellZone;
    }
  }

  const version = hashDynamicVersion(terrain.siteId, dyn, rules);
  const snapshotId = `snap-${terrain.siteId}-${version}`;
  const hasSimStorm = dyn.storms.some((s) => s.active && s.dataType === "SIMULATED");

  const nodeIndexAt = (p: LocalPoint): number => {
    const i = Math.round((p.x - grid.x0) / grid.cell);
    const j = Math.round((p.z - grid.z0) / grid.cell);
    if (i < 0 || j < 0 || i >= grid.nx || j >= grid.nz) return -1;
    return j * grid.nx + i;
  };

  const pointAtIndex = (index: number): LocalPoint => {
    const i = index % grid.nx;
    const j = Math.floor(index / grid.nx);
    return { x: grid.x0 + i * grid.cell, z: grid.z0 + j * grid.cell };
  };

  const sample = (layer: SampleLayerId, x: number, z: number): number => {
    const k = nodeIndexAt({ x, z });
    if (k < 0) return Number.NaN;
    switch (layer) {
      case "elevation":
        return terrain.elevation[k]!;
      case "slopeDeg":
        return terrain.slopeDeg[k]!;
      case "roughness":
        return terrain.roughness[k]!;
      case "softSoil":
        return terrain.softSoil[k]!;
      case "dustTau":
        return dustTau[k]!;
      case "doseRate":
        return doseRate[k]!;
      case "confidenceScore":
        return terrain.confidenceScore[k]!;
    }
  };

  return {
    snapshotId,
    version,
    terrain,
    grid,
    dynamic: dyn,
    dustTau,
    doseRate,
    zone,
    confidenceClass,
    simulated: terrain.simulated || hasSimStorm || dyn.sepAlertActive,
    nodeIndexAt,
    pointAtIndex,
    sample,
    zoneAt(x: number, z: number): ZoneClass {
      const k = nodeIndexAt({ x, z });
      return k < 0 ? "Z5" : zone[k]!;
    },
    confidenceAt(x: number, z: number): ConfidenceClass {
      const k = nodeIndexAt({ x, z });
      return k < 0 ? "K5" : confidenceClass[k]!;
    },
  };
}
