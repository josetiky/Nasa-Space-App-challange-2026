/**
 * Mars Trek · Decodificación y validación de teselas de elevación (Tarea 1).
 */
import type { HeightGrid } from "@/core/science/routing";
import type { GridSpec } from "@/core/trek/contracts";

export interface SiteManifest {
  readonly siteId: string;
  readonly grid: GridSpec;
  readonly file: string;
  readonly encoding: "float32-le";
  readonly noData: "NaN";
  readonly sha256: string;
  readonly source: string;
  readonly license: string;
  readonly generatedAt: string;
  readonly meshNodes: "TYPE_TILE";
  readonly vertexSpacingM: {
    readonly min: number;
    readonly median: number;
    readonly max: number;
  };
  readonly elevationRangeM: readonly [number, number];
}

/**
 * Decodifica un búfer binario float32 little-endian a un HeightGrid según su manifiesto.
 * Lanza un error si el tamaño del búfer no coincide exactamente con nx × nz × 4 bytes.
 */
export function decodeElevationTile(buffer: ArrayBuffer, manifest: SiteManifest): HeightGrid {
  const { x0, z0, cell, nx, nz } = manifest.grid;
  const expectedBytes = nx * nz * 4;
  if (buffer.byteLength !== expectedBytes) {
    throw new Error(
      `Invalid elevation tile buffer size for '${manifest.siteId}': expected ${expectedBytes} bytes (${nx}x${nz} float32), got ${buffer.byteLength}`,
    );
  }

  const h = new Float32Array(nx * nz);
  const view = new DataView(buffer);
  for (let i = 0; i < nx * nz; i += 1) {
    h[i] = view.getFloat32(i * 4, true);
  }

  return {
    x0,
    z0,
    cell,
    nx,
    nz,
    h,
  };
}
