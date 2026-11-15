/**
 * Mars Trek · Campo sintético de dos corredores (escenario T-06, ASTRONAUT_HEALTH_STATE_MACHINE §8).
 * Rotulado explícitamente como SIMULATED (nunca se presenta como terreno real de Marte).
 *
 * Geometría:
 * - Origen en (-42, 0), Destino en (42, 0), Refugio en (-42, -20).
 * - Barrera central intransitable (pendiente > 28°) que separa dos corredores:
 *   - Corredor A (Directo, z ≈ 0): corto (84 m horizontales) con un paso corto de ~17° entre x = -3 y x = +3.
 *     En estado NORMAL (límite 20°) es admisible y de menor costo equivalente que el rodeo B;
 *     en FATIGUE (límite 15°) el paso de 17° queda excluido del grafo.
 *   - Corredor B (Rodeo Norte por z ≈ +36): más largo (~156 m), con rampa suave máxima de ~8.5° (≤ 9°).
 *     Permanece admisible tanto en NORMAL como en FATIGUE.
 */
import { createHeightGrid, type HeightGrid } from "@/core/science/routing";
import type { LocalPoint, ShelterPoint } from "../contracts";
import { buildStaticTerrain, type StaticTerrain } from "./terrain";

export interface TwoCorridorField {
  readonly heightGrid: HeightGrid;
  readonly terrain: StaticTerrain;
  readonly origin: LocalPoint;
  readonly goal: LocalPoint;
  readonly shelter: ShelterPoint;
  readonly corridorAMidpoint: LocalPoint;
  readonly corridorBMidpoint: LocalPoint;
}

export interface TwoCorridorOptions {
  /** Pendiente máxima del corredor A en grados (por defecto 17°; T-06 variante usa 14°). */
  readonly corridorASlopeDeg?: number;
  /** Pendiente máxima del corredor B en grados (por defecto 8.5°, ≤ 9°). */
  readonly corridorBSlopeDeg?: number;
}

export function twoCorridorField(options: TwoCorridorOptions = {}): TwoCorridorField {
  const slopeADeg = options.corridorASlopeDeg ?? 17.0;
  const slopeBDeg = options.corridorBSlopeDeg ?? 8.5;

  const x0 = -64;
  const z0 = -64;
  const cell = 1;
  const nx = 129;
  const nz = 129;
  const grid = createHeightGrid(x0, z0, cell, nx, nz);

  const tanA = Math.tan((slopeADeg * Math.PI) / 180);
  const tanB = Math.tan((slopeBDeg * Math.PI) / 180);
  const tanWall = Math.tan((32 * Math.PI) / 180);

  for (let j = 0; j < nz; j += 1) {
    const z = z0 + j * cell;
    for (let i = 0; i < nx; i += 1) {
      const x = x0 + i * cell;
      const k = j * nx + i;

      // Corredor A: banda directa z en [-4, 4] con un paso corto de pendiente slopeADeg en x in [-4, 4]
      if (z >= -4 && z <= 4 && x >= -48 && x <= 48) {
        if (Math.abs(x) <= 4) {
          grid.h[k] = (4 - Math.abs(x)) * tanA;
        } else {
          grid.h[k] = 0;
        }
        continue;
      }

      // Corredor B: banda norte z en [32, 42] con pendiente moderada slopeBDeg (<= 9°) en x in [-16, 16]
      if (z >= 32 && z <= 42 && x >= -48 && x <= 48) {
        if (Math.abs(x) <= 16) {
          grid.h[k] = (16 - Math.abs(x)) * tanB;
        } else {
          grid.h[k] = 0;
        }
        continue;
      }

      // Brazos conectores laterales entre z = -4 y z = 32 en x in [-48, -38] y x in [38, 48]
      if (z > -4 && z < 32 && ((x >= -48 && x <= -38) || (x >= 38 && x <= 48))) {
        grid.h[k] = 0;
        continue;
      }

      // Corredor sur hacia el refugio en (-42, -20) desde (-42, 0)
      if (x >= -48 && x <= -36 && z >= -26 && z < -4) {
        grid.h[k] = 0;
        continue;
      }

      // Barrera escarpada (> 28°) en el interior entre Corredor A y Corredor B y bordes exteriores
      const distFromWallEdge = Math.min(
        Math.abs(z - 4),
        Math.abs(z - 32),
        Math.abs(x + 38),
        Math.abs(x - 38),
      );
      grid.h[k] = 15 + (distFromWallEdge % 4) * tanWall * 2;
    }
  }

  const terrain = buildStaticTerrain(grid, {
    siteId: "synthetic_two_corridors",
    baseConfidence: "K2",
    baseResolutionM: 1,
    simulated: true,
  });

  return {
    heightGrid: grid,
    terrain,
    origin: { x: -42, z: 0 },
    goal: { x: 42, z: 0 },
    shelter: {
      id: "shelter-hab",
      name: "Refugio Hábitat (Simulado)",
      point: { x: -42, z: -20 },
      kind: "habitat",
      shielded: true,
    },
    corridorAMidpoint: { x: -2, z: 0 },
    corridorBMidpoint: { x: -8, z: 36 },
  };
}
