/**
 * Safe EVA routing on a terrain height grid (pure, unit-tested).
 *
 * - rasterizeTriangles: terrain mesh → height grid (nodes every `cell` metres).
 * - findSafePath: A* over 8-connected nodes. A step is impassable at or above the
 *   no-go slope (default 25°) or over unknown terrain; slopes in the caution band
 *   (≥ 15°) cost `cautionWeight`× more, so gentle detours win when they are short.
 *   Diagonals may not cut the corner of an impassable neighbour.
 * - The node path is then simplified by line of sight, without ever making the
 *   route steeper than the raw A* path (checked by sampling every half cell).
 */
export interface HeightGrid {
  x0: number;
  z0: number;
  cell: number;
  nx: number;
  nz: number;
  /** Heights at nodes (x0 + i·cell, z0 + j·cell), row-major by j; NaN = unknown. */
  h: Float32Array;
}

export interface Point2 {
  x: number;
  z: number;
}

export function createHeightGrid(x0: number, z0: number, cell: number, nx: number, nz: number): HeightGrid {
  return { x0, z0, cell, nx, nz, h: new Float32Array(nx * nz).fill(Number.NaN) };
}

/** Rasterise triangles (flat xyz positions, optional index buffer) into the grid; overlapping surfaces keep the highest. */
export function rasterizeTriangles(grid: HeightGrid, positions: ArrayLike<number>, index?: ArrayLike<number>): void {
  const count = index ? index.length : positions.length / 3;
  const vertex = (k: number) => {
    const v = (index ? index[k]! : k) * 3;
    return [positions[v]!, positions[v + 1]!, positions[v + 2]!] as const;
  };
  for (let t = 0; t + 2 < count; t += 3) {
    const [ax, ay, az] = vertex(t);
    const [bx, by, bz] = vertex(t + 1);
    const [cx, cy, cz] = vertex(t + 2);
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-12) continue;
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - grid.x0) / grid.cell - 1e-9));
    const i1 = Math.min(grid.nx - 1, Math.floor((Math.max(ax, bx, cx) - grid.x0) / grid.cell + 1e-9));
    const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - grid.z0) / grid.cell - 1e-9));
    const j1 = Math.min(grid.nz - 1, Math.floor((Math.max(az, bz, cz) - grid.z0) / grid.cell + 1e-9));
    for (let j = j0; j <= j1; j += 1) {
      const z = grid.z0 + j * grid.cell;
      for (let i = i0; i <= i1; i += 1) {
        const x = grid.x0 + i * grid.cell;
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
        const y = l1 * ay + l2 * by + l3 * cy;
        const k = j * grid.nx + i;
        const prev = grid.h[k]!;
        if (Number.isNaN(prev) || y > prev) grid.h[k] = y;
      }
    }
  }
}

/** Bilinear height at (x, z); NaN outside the grid or next to unknown nodes. */
export function heightAt(grid: HeightGrid, x: number, z: number): number {
  const fx = (x - grid.x0) / grid.cell;
  const fz = (z - grid.z0) / grid.cell;
  if (fx < -1e-9 || fz < -1e-9 || fx > grid.nx - 1 + 1e-9 || fz > grid.nz - 1 + 1e-9) return Number.NaN;
  const i = Math.min(grid.nx - 2, Math.max(0, Math.floor(fx)));
  const j = Math.min(grid.nz - 2, Math.max(0, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - i));
  const tz = Math.min(1, Math.max(0, fz - j));
  const h = (a: number, b: number) => grid.h[b * grid.nx + a]!;
  const top = h(i, j) * (1 - tx) + h(i + 1, j) * tx;
  const bottom = h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx;
  return top * (1 - tz) + bottom * tz;
}

const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Steepest slope (deg) along a polyline, sampling every half cell; Infinity over unknown terrain. */
export function polylineMaxSlope(grid: HeightGrid, points: Point2[]): number {
  let max = 0;
  for (let s = 1; s < points.length; s += 1) {
    const a = points[s - 1]!;
    const b = points[s]!;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-9) continue;
    const n = Math.max(1, Math.ceil(length / (grid.cell / 2)));
    let prev = heightAt(grid, a.x, a.z);
    for (let k = 1; k <= n; k += 1) {
      const t = k / n;
      const y = heightAt(grid, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
      if (Number.isNaN(y) || Number.isNaN(prev)) return Number.POSITIVE_INFINITY;
      max = Math.max(max, toDeg(Math.atan2(Math.abs(y - prev), length / n)));
      prev = y;
    }
  }
  return max;
}

export interface RouteOptions {
  cautionDeg?: number;
  noGoDeg?: number;
  /** Cost multiplier for steps in the caution band. */
  cautionWeight?: number;
}

export interface RouteResult {
  found: boolean;
  points: Point2[];
  /** Horizontal length of the simplified route (m). */
  lengthM: number;
  maxSlopeDeg: number;
  rawMaxSlopeDeg: number;
  rawCells: number;
}

/** Minimal binary heap keyed by f-score. */
class Heap {
  private items: Array<[number, number]> = [];
  get size() {
    return this.items.length;
  }
  push(node: number, f: number) {
    const a = this.items;
    a.push([f, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]![0] <= a[i]![0]) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]![0] < a[m]![0]) m = l;
        if (r < a.length && a[r]![0] < a[m]![0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top[1];
  }
}

export function findSafePath(grid: HeightGrid, start: Point2, goal: Point2, options: RouteOptions = {}): RouteResult {
  const caution = options.cautionDeg ?? 15;
  const noGo = options.noGoDeg ?? 25;
  const cautionWeight = options.cautionWeight ?? 4;
  const { nx, nz, cell } = grid;
  const fail: RouteResult = { found: false, points: [], lengthM: 0, maxSlopeDeg: Number.POSITIVE_INFINITY, rawMaxSlopeDeg: Number.POSITIVE_INFINITY, rawCells: 0 };
  const node = (p: Point2) => {
    const i = Math.round((p.x - grid.x0) / cell);
    const j = Math.round((p.z - grid.z0) / cell);
    return i >= 0 && j >= 0 && i < nx && j < nz ? j * nx + i : -1;
  };
  const s = node(start);
  const g = node(goal);
  if (s < 0 || g < 0 || Number.isNaN(grid.h[s]!) || Number.isNaN(grid.h[g]!)) return fail;

  const stepSlope = (a: number, b: number, horizontal: number) => {
    const ha = grid.h[a]!;
    const hb = grid.h[b]!;
    return Number.isNaN(ha) || Number.isNaN(hb) ? Number.POSITIVE_INFINITY : toDeg(Math.atan2(Math.abs(hb - ha), horizontal));
  };
  const passable = (a: number, b: number, horizontal: number) => stepSlope(a, b, horizontal) < noGo;
  const gi = g % nx;
  const gj = Math.floor(g / nx);
  const heuristic = (k: number) => Math.hypot((k % nx) - gi, Math.floor(k / nx) - gj) * cell;

  const cost = new Float64Array(nx * nz).fill(Number.POSITIVE_INFINITY);
  const from = new Int32Array(nx * nz).fill(-1);
  const closed = new Uint8Array(nx * nz);
  const heap = new Heap();
  cost[s] = 0;
  heap.push(s, heuristic(s));
  const moves: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (heap.size) {
    const k = heap.pop();
    if (closed[k]) continue;
    if (k === g) break;
    closed[k] = 1;
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
      if (!passable(k, n, horizontal)) continue;
      if (diagonal && (!passable(k, j * nx + ni, cell) || !passable(k, nj * nx + i, cell))) continue;
      const slope = stepSlope(k, n, horizontal);
      const step = horizontal * (1 + (slope / caution) ** 2) * (slope >= caution ? cautionWeight : 1);
      const next = cost[k]! + step;
      if (next < cost[n]!) {
        cost[n] = next;
        from[n] = k;
        heap.push(n, next + heuristic(n));
      }
    }
  }
  if (!Number.isFinite(cost[g]!)) return fail;

  const raw: Point2[] = [];
  for (let k = g; k >= 0; k = k === s ? -1 : from[k]!) raw.push({ x: grid.x0 + (k % nx) * cell, z: grid.z0 + Math.floor(k / nx) * cell });
  raw.reverse();
  const rawMax = polylineMaxSlope(grid, raw);

  // Line-of-sight simplification that never exceeds the raw route's steepest slope.
  const points: Point2[] = [raw[0]!];
  let i = 0;
  while (i < raw.length - 1) {
    let next = i + 1;
    for (let j = raw.length - 1; j > i + 1; j -= 1) {
      const m = polylineMaxSlope(grid, [raw[i]!, raw[j]!]);
      if (m <= rawMax + 1e-9 && m < noGo) {
        next = j;
        break;
      }
    }
    points.push(raw[next]!);
    i = next;
  }
  let lengthM = 0;
  for (let k = 1; k < points.length; k += 1) lengthM += Math.hypot(points[k]!.x - points[k - 1]!.x, points[k]!.z - points[k - 1]!.z);
  return { found: true, points, lengthM, maxSlopeDeg: polylineMaxSlope(grid, points), rawMaxSlopeDeg: rawMax, rawCells: raw.length };
}
