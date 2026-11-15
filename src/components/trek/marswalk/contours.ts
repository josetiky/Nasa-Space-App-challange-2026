/**
 * MarsWalk · Curvas de nivel por "marching squares" sobre la rejilla de elevación del motor.
 * Puro (sin DOM): devuelve segmentos en coordenadas locales (x, z) en metros. Las celdas con algún
 * nodo sin dato (NaN) no generan curvas: nunca se inventa relieve.
 */
export interface ContourSet {
  readonly intervalM: number;
  /** Cada cuántas curvas hay una maestra. */
  readonly majorEvery: number;
  /** Segmentos [x1, z1, x2, z2, …] de curvas normales. */
  readonly minor: Float32Array;
  /** Segmentos de curvas maestras (múltiplos de intervalM · majorEvery). */
  readonly major: Float32Array;
  readonly minM: number;
  readonly maxM: number;
}

export interface ElevationGridLike {
  readonly x0: number;
  readonly z0: number;
  readonly cell: number;
  readonly nx: number;
  readonly nz: number;
  readonly elevation: ArrayLike<number>;
}

const STEPS = [0.25, 0.5, 1, 2, 5, 10, 20, 50];

/** Equidistancia "redonda" para ~targetLevels curvas en el rango de elevación. */
export function contourInterval(spanM: number, targetLevels = 18): number {
  const raw = Math.max(1e-6, spanM) / targetLevels;
  return STEPS.find((s) => s >= raw) ?? STEPS[STEPS.length - 1]!;
}

export function buildContours(
  g: ElevationGridLike,
  intervalM?: number,
  majorEvery = 5,
): ContourSet {
  const { x0, z0, cell, nx, nz, elevation: h } = g;
  let minM = Number.POSITIVE_INFINITY;
  let maxM = Number.NEGATIVE_INFINITY;
  for (let k = 0; k < nx * nz; k += 1) {
    const v = h[k]!;
    if (!Number.isNaN(v)) {
      if (v < minM) minM = v;
      if (v > maxM) maxM = v;
    }
  }
  const minor: number[] = [];
  const major: number[] = [];
  if (!Number.isFinite(minM)) {
    return {
      intervalM: intervalM ?? 1,
      majorEvery,
      minor: new Float32Array(),
      major: new Float32Array(),
      minM: 0,
      maxM: 0,
    };
  }
  const step = intervalM ?? contourInterval(maxM - minM);
  const at = (i: number, j: number) => h[j * nx + i]!;

  for (let j = 0; j < nz - 1; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      // Esquinas: a (i,j) · b (i+1,j) · c (i+1,j+1) · d (i,j+1)
      const a = at(i, j);
      const b = at(i + 1, j);
      const c = at(i + 1, j + 1);
      const d = at(i, j + 1);
      if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) continue;
      const lo = Math.min(a, b, c, d);
      const hi = Math.max(a, b, c, d);
      const xa = x0 + i * cell;
      const za = z0 + j * cell;
      for (let n = Math.ceil(lo / step); n * step <= hi; n += 1) {
        const L = n * step;
        if (L === lo && L === hi) continue;
        // Puntos donde la curva corta cada lado (interpolación lineal)
        const pts: number[] = [];
        const edge = (v1: number, v2: number, x1: number, z1: number, x2: number, z2: number) => {
          if ((v1 < L && v2 >= L) || (v1 >= L && v2 < L)) {
            const t = (L - v1) / (v2 - v1);
            pts.push(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t);
          }
        };
        edge(a, b, xa, za, xa + cell, za);
        edge(b, c, xa + cell, za, xa + cell, za + cell);
        edge(c, d, xa + cell, za + cell, xa, za + cell);
        edge(d, a, xa, za + cell, xa, za);
        const out = n % majorEvery === 0 ? major : minor;
        if (pts.length === 4) out.push(pts[0]!, pts[1]!, pts[2]!, pts[3]!);
        else if (pts.length === 8) {
          // Punto de silla: se resuelve con el valor medio de la celda
          const mid = (a + b + c + d) / 4;
          if (mid >= L === a >= L) {
            out.push(pts[0]!, pts[1]!, pts[6]!, pts[7]!, pts[2]!, pts[3]!, pts[4]!, pts[5]!);
          } else {
            out.push(pts[0]!, pts[1]!, pts[2]!, pts[3]!, pts[4]!, pts[5]!, pts[6]!, pts[7]!);
          }
        }
      }
    }
  }
  return {
    intervalM: step,
    majorEvery,
    minor: Float32Array.from(minor),
    major: Float32Array.from(major),
    minM,
    maxM,
  };
}
