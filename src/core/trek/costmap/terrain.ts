/**
 * Mars Trek · Terreno estático derivado de la rejilla de elevación (DYNAMIC_COSTMAP §2–§5).
 * Sin dato no es cero: toda celda sin elevación conserva NaN, clase K5 y zona Z3 (INV-R4).
 */
import type { HeightGrid } from "@/core/science/routing";
import type { ConfidenceClass, GridSpec, LocalPoint } from "../contracts";
import { confidenceScore } from "../confidence/score";

const RAD_TO_DEG = 180 / Math.PI;

export interface StaticTerrain {
  readonly siteId: string;
  readonly grid: GridSpec;
  /** Elevación en metros (NaN = sin dato). */
  readonly elevation: Float32Array;
  /** Pendiente local en grados (NaN si falta elevación en la celda o sus vecinos). */
  readonly slopeDeg: Float32Array;
  /** Rugosidad normalizada [0, 1] a escala local (NaN si falta dato). */
  readonly roughness: Float32Array;
  /** Probabilidad de suelo blando [0, 1] (NaN si falta dato). */
  readonly softSoil: Float32Array;
  /** Clase de confianza por celda. */
  readonly confidenceClass: readonly ConfidenceClass[];
  /** Puntuación de confianza [0, 1] por celda (0 en K5). */
  readonly confidenceScore: Float32Array;
  readonly baseDataResolutionM: number;
  readonly simulated: boolean;
}

export interface BuildStaticTerrainOptions {
  readonly siteId: string;
  readonly baseConfidence?: ConfidenceClass;
  readonly baseResolutionM?: number;
  readonly roverTraversePoints?: readonly LocalPoint[];
  readonly roverCorridorRadiusM?: number;
  readonly softSoilPatches?: ReadonlyArray<{
    center: LocalPoint;
    radiusM: number;
    probability: number;
  }>;
  readonly simulated?: boolean;
}

export function buildStaticTerrain(
  heightGrid: HeightGrid,
  options: BuildStaticTerrainOptions,
): StaticTerrain {
  const { x0, z0, cell, nx, nz, h } = heightGrid;
  const total = nx * nz;
  const elevation = new Float32Array(h);
  const slopeDeg = new Float32Array(total).fill(Number.NaN);
  const roughness = new Float32Array(total).fill(Number.NaN);
  const softSoil = new Float32Array(total).fill(Number.NaN);
  const confClasses: ConfidenceClass[] = new Array<ConfidenceClass>(total).fill("K5");
  const confScores = new Float32Array(total).fill(0);

  const baseCls: ConfidenceClass = options.baseConfidence ?? "K2";
  const baseRes = options.baseResolutionM ?? cell;
  const traversePts = options.roverTraversePoints ?? [];
  const corridorR = options.roverCorridorRadiusM ?? 3.5;
  const patches = options.softSoilPatches ?? [];

  const idx = (i: number, j: number) => j * nx + i;

  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const k = idx(i, j);
      const y = elevation[k]!;
      if (Number.isNaN(y)) {
        // INV-R4: sin dato nunca es 0; queda NaN y K5
        confClasses[k] = "K5";
        confScores[k] = 0;
        continue;
      }

      // Derivadas por diferencias finitas o máxima pendiente a vecinos cardinales válidos
      let dzdx = 0;
      let dzdz = 0;
      const yL = i > 0 ? elevation[idx(i - 1, j)]! : Number.NaN;
      const yR = i < nx - 1 ? elevation[idx(i + 1, j)]! : Number.NaN;
      const yD = j > 0 ? elevation[idx(i, j - 1)]! : Number.NaN;
      const yU = j < nz - 1 ? elevation[idx(i, j + 1)]! : Number.NaN;

      if (!Number.isNaN(yL) && !Number.isNaN(yR)) {
        dzdx = (yR - yL) / (2 * cell);
      } else if (!Number.isNaN(yR)) {
        dzdx = (yR - y) / cell;
      } else if (!Number.isNaN(yL)) {
        dzdx = (y - yL) / cell;
      }

      if (!Number.isNaN(yD) && !Number.isNaN(yU)) {
        dzdz = (yU - yD) / (2 * cell);
      } else if (!Number.isNaN(yU)) {
        dzdz = (yU - y) / cell;
      } else if (!Number.isNaN(yD)) {
        dzdz = (y - yD) / cell;
      }

      const grad = Math.hypot(dzdx, dzdz);
      slopeDeg[k] = Math.atan(grad) * RAD_TO_DEG;

      // Cobertura y residuo en ventana 3×3 para rugosidad
      let validCount = 0;
      let sumDiff = 0;
      for (let dj = -1; dj <= 1; dj += 1) {
        const nj = j + dj;
        if (nj < 0 || nj >= nz) continue;
        for (let di = -1; di <= 1; di += 1) {
          const ni = i + di;
          if (ni < 0 || ni >= nx) continue;
          const ny = elevation[idx(ni, nj)]!;
          if (!Number.isNaN(ny)) {
            validCount += 1;
            const planePred = y + dzdx * (di * cell) + dzdz * (dj * cell);
            sumDiff += Math.abs(ny - planePred);
          }
        }
      }
      const meanRes = validCount > 0 ? sumDiff / validCount : 0;
      roughness[k] = Math.min(1, meanRes / 0.35);

      const x = x0 + i * cell;
      const z = z0 + j * cell;
      let soft = 0.08;
      for (const patch of patches) {
        const d = Math.hypot(x - patch.center.x, z - patch.center.z);
        if (d <= patch.radiusM) {
          soft = Math.max(soft, patch.probability);
        }
      }
      softSoil[k] = Math.min(1, soft);

      // ¿Cae dentro del corredor K1 recorrido por el rover?
      let cls: ConfidenceClass = baseCls;
      for (const tp of traversePts) {
        if (Math.hypot(x - tp.x, z - tp.z) <= corridorR) {
          cls = "K1";
          break;
        }
      }
      confClasses[k] = cls;
      confScores[k] = confidenceScore({
        cls,
        dataResolutionM: baseRes,
        coverageFraction: validCount / 9,
      });
    }
  }

  return {
    siteId: options.siteId,
    grid: { x0, z0, cell, nx, nz },
    elevation,
    slopeDeg,
    roughness,
    softSoil,
    confidenceClass: confClasses,
    confidenceScore: confScores,
    baseDataResolutionM: baseRes,
    simulated: options.simulated ?? false,
  };
}
