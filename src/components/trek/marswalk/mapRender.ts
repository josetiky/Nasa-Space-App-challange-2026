/**
 * MarsWalk · Render del mapa compartido por el plano 2D (pestaña MarsWalk) y el plano isométrico
 * (pestaña Simulación). Solo pinta lo que ya calculó el motor (`session.snapshot`, `routeResult`,
 * `activeRoute`, tormentas, refugios): no decide rutas, zonas ni costos.
 *
 * Capas, de abajo arriba:
 *   1. Ortofoto REAL de Gale (proyección cenital de las mallas texturizadas de Access Mars, 6.25 cm/px).
 *      Las zonas que la cámara del rover no vio vienen en gris en Access Mars: aquí se tiñen de ocre
 *      solo para continuidad visual (el dato de color no existe y no se inventa).
 *      Sin ortofoto (banco sintético o mientras carga): tinte hipsométrico + sombreado.
 *   2. Relieve sombreado (luz NO, 45°) a partir de la elevación del motor, en mezcla "overlay".
 *   3. Capa temática translúcida (pendiente, zonas, confianza, polvo, radiación) y velo de zonas.
 *   4. Curvas de nivel (marching squares) y retícula métrica.
 *   5. Vectores: tormentas, recta bloqueada, alternativas, propuesta, ruta, POIs, refugios, nodos.
 */
import { useEffect, useState } from "react";
import type { ConfidenceClass, LocalPoint } from "@/core/trek/contracts";
import { TREK_PARAMS } from "@/core/trek/params";
import type { TrekStoreState } from "@/state/trekStore";
import { zoneVisual } from "../viewHelpers";
import { buildContours, type ContourSet } from "./contours";

export const CANVAS_PX = 760;
/** Resolución de las capas derivadas de la elevación (relieve / hipsometría). */
const RELIEF_PX = 512;
/** Resolución del remuestreo de la capa temática. */
const THEMATIC_PX = 516;

const CONF_RGB: Readonly<Record<ConfidenceClass, readonly [number, number, number]>> = {
  K1: [143, 214, 176],
  K2: [143, 179, 240],
  K3a: [170, 160, 220],
  K3b: [150, 135, 200],
  K3c: [128, 112, 176],
  K3d: [108, 92, 150],
  K4: [223, 138, 93],
  K5: [120, 48, 40],
};

type Session = TrekStoreState["session"];
type Terrain = Session["snapshot"]["terrain"];

/* ------------------------------------------------------------------ */
/* Ortofoto                                                            */
/* ------------------------------------------------------------------ */

const orthoCache = new Map<string, Promise<HTMLCanvasElement>>();

/** Rampa ocre para el relleno gris (luminancia → color marciano). */
function marsTint(l: number): [number, number, number] {
  const stops: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, 38, 24, 20],
    [0.35, 120, 74, 50],
    [0.7, 196, 138, 96],
    [1, 240, 204, 164],
  ];
  for (let k = 1; k < stops.length; k += 1) {
    const [p1, r1, g1, b1] = stops[k]!;
    if (l <= p1) {
      const [p0, r0, g0, b0] = stops[k - 1]!;
      const f = (l - p0) / (p1 - p0);
      return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f];
    }
  }
  return [240, 204, 164];
}

/** Carga la ortofoto y tiñe de ocre los píxeles sin color (relleno gris de Access Mars). */
export function loadOrthophoto(url: string): Promise<HTMLCanvasElement> {
  let p = orthoCache.get(url);
  if (p) return p;
  p = new Promise<HTMLCanvasElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject(new Error("2D context unavailable"));
      ctx.drawImage(img, 0, 0);
      try {
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const d = data.data;
        for (let k = 0; k < d.length; k += 4) {
          const r = d[k]!;
          const g = d[k + 1]!;
          const b = d[k + 2]!;
          const mx = Math.max(r, g, b);
          const mn = Math.min(r, g, b);
          const sat = mx > 0 ? (mx - mn) / mx : 0;
          const w = Math.max(0, Math.min(1, 1 - sat / 0.12)) * 0.9;
          if (w <= 0) continue;
          const [tr, tg, tb] = marsTint((0.299 * r + 0.587 * g + 0.114 * b) / 255);
          d[k] = r + (tr - r) * w;
          d[k + 1] = g + (tg - g) * w;
          d[k + 2] = b + (tb - b) * w;
        }
        ctx.putImageData(data, 0, 0);
      } catch {
        /* lienzo contaminado (CORS): se usa la foto tal cual */
      }
      resolve(c);
    };
    img.onerror = () => reject(new Error(`No se pudo cargar la ortofoto ${url}`));
    img.src = url;
  });
  p.catch(() => orthoCache.delete(url));
  orthoCache.set(url, p);
  return p;
}

/** Hook: ortofoto procesada del sitio (null mientras carga o si el sitio no tiene). */
export function useOrthophoto(url: string | null): HTMLCanvasElement | null {
  const [img, setImg] = useState<{ url: string; canvas: HTMLCanvasElement } | null>(null);
  useEffect(() => {
    if (!url || typeof document === "undefined") return;
    let cancelled = false;
    loadOrthophoto(url)
      .then((canvas) => {
        if (!cancelled) setImg({ url, canvas });
      })
      .catch(() => {
        /* sin ortofoto: el mapa cae al tinte hipsométrico */
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return url && img?.url === url ? img.canvas : null;
}

/* ------------------------------------------------------------------ */
/* Relieve, hipsometría y curvas (dependen solo de la elevación)       */
/* ------------------------------------------------------------------ */

export interface TerrainLayers {
  /** Gris centrado en 0.5 (llano) para mezclar en "overlay" sobre la ortofoto. */
  readonly relief: HTMLCanvasElement;
  /** Tinte hipsométrico × sombreado (base sin ortofoto). */
  readonly hypso: HTMLCanvasElement;
  readonly contours: ContourSet;
}

const terrainCache = new WeakMap<Terrain, TerrainLayers>();

/** Catmull-Rom 1D. */
function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/** Muestreo bicúbico de un campo nodal (NaN se sustituye por el vecino central; si este es NaN → NaN). */
function bicubic(f: Float32Array, nx: number, nz: number, fi: number, fj: number): number {
  const i = Math.floor(fi);
  const j = Math.floor(fj);
  const tx = fi - i;
  const tz = fj - j;
  const c = f[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))]!;
  if (Number.isNaN(c)) return Number.NaN;
  const rows: number[] = [];
  for (let dj = -1; dj <= 2; dj += 1) {
    const jj = Math.min(nz - 1, Math.max(0, j + dj));
    const v: number[] = [];
    for (let di = -1; di <= 2; di += 1) {
      const ii = Math.min(nx - 1, Math.max(0, i + di));
      const x = f[jj * nx + ii]!;
      v.push(Number.isNaN(x) ? c : x);
    }
    rows.push(cr(v[0]!, v[1]!, v[2]!, v[3]!, tx));
  }
  return cr(rows[0]!, rows[1]!, rows[2]!, rows[3]!, tz);
}

/** Sombreado de Horn por nodo (luz azimut 315°, altura 45°); NaN donde falta elevación. */
function nodeHillshade(h: ArrayLike<number>, nx: number, nz: number, cell: number): Float32Array {
  const out = new Float32Array(nx * nz);
  const azMath = (((360 - 315 + 90) % 360) * Math.PI) / 180;
  const alt = (45 * Math.PI) / 180;
  const at = (i: number, j: number, fb: number) => {
    const v = h[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))]!;
    return Number.isNaN(v) ? fb : v;
  };
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const c = h[j * nx + i]!;
      if (Number.isNaN(c)) {
        out[j * nx + i] = Number.NaN;
        continue;
      }
      // Ventana 3×3 de Horn; +z = norte (fila superior del mapa)
      const z1 = at(i - 1, j + 1, c);
      const z2 = at(i, j + 1, c);
      const z3 = at(i + 1, j + 1, c);
      const z4 = at(i - 1, j, c);
      const z6 = at(i + 1, j, c);
      const z7 = at(i - 1, j - 1, c);
      const z8 = at(i, j - 1, c);
      const z9 = at(i + 1, j - 1, c);
      // Fórmula de ESRI: dz/dy positiva hacia el sur (filas crecientes), acimut en convención matemática
      const dzdx = (z3 + 2 * z6 + z9 - (z1 + 2 * z4 + z7)) / (8 * cell);
      const dzdy = (z7 + 2 * z8 + z9 - (z1 + 2 * z2 + z3)) / (8 * cell);
      const slope = Math.atan(Math.hypot(dzdx, dzdy));
      const aspect = Math.atan2(dzdy, -dzdx);
      const hs =
        Math.sin(alt) * Math.cos(slope) +
        Math.cos(alt) * Math.sin(slope) * Math.cos(azMath - aspect);
      out[j * nx + i] = Math.max(0, Math.min(1, hs));
    }
  }
  return out;
}

function hypsoColor(n: number): [number, number, number] {
  // Ocres de bajo a alto (sin verdes "terrestres")
  const stops: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, 70, 42, 34],
    [0.5, 150, 92, 62],
    [1, 222, 176, 132],
  ];
  const k = n < 0.5 ? 1 : 2;
  const [p0, r0, g0, b0] = stops[k - 1]!;
  const [p1, r1, g1, b1] = stops[k]!;
  const f = (n - p0) / (p1 - p0);
  return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f];
}

export function terrainLayers(session: Session): TerrainLayers | null {
  if (typeof document === "undefined") return null;
  const terrain = session.snapshot.terrain;
  const cached = terrainCache.get(terrain);
  if (cached) return cached;
  const { nx, nz, cell, x0, z0 } = session.snapshot.grid;
  const elevation = terrain.elevation;
  const hsNode = nodeHillshade(elevation, nx, nz, cell);
  const elevF = Float32Array.from(elevation as ArrayLike<number>);
  let minE = Number.POSITIVE_INFINITY;
  let maxE = Number.NEGATIVE_INFINITY;
  for (const v of elevF) {
    if (!Number.isNaN(v)) {
      if (v < minE) minE = v;
      if (v > maxE) maxE = v;
    }
  }
  const span = Math.max(0.5, maxE - minE);
  const flat = Math.sin(Math.PI / 4);

  const relief = document.createElement("canvas");
  const hypso = document.createElement("canvas");
  relief.width = relief.height = hypso.width = hypso.height = RELIEF_PX;
  const rctx = relief.getContext("2d");
  const hctx = hypso.getContext("2d");
  if (!rctx || !hctx) return null;
  const rimg = rctx.createImageData(RELIEF_PX, RELIEF_PX);
  const himg = hctx.createImageData(RELIEF_PX, RELIEF_PX);
  for (let py = 0; py < RELIEF_PX; py += 1) {
    const fj = (1 - (py + 0.5) / RELIEF_PX) * (nz - 1); // fila 0 = norte (+z)
    for (let px = 0; px < RELIEF_PX; px += 1) {
      const fi = ((px + 0.5) / RELIEF_PX) * (nx - 1);
      const o = (py * RELIEF_PX + px) * 4;
      const hs = bicubic(hsNode, nx, nz, fi, fj);
      const e = bicubic(elevF, nx, nz, fi, fj);
      if (Number.isNaN(hs) || Number.isNaN(e)) {
        rimg.data[o] = rimg.data[o + 1] = rimg.data[o + 2] = 128;
        rimg.data[o + 3] = 255;
        himg.data[o] = 34;
        himg.data[o + 1] = 34;
        himg.data[o + 2] = 40;
        himg.data[o + 3] = 255;
        continue;
      }
      const r = Math.max(0, Math.min(1, 0.5 + (hs - flat) * 1.25));
      rimg.data[o] = rimg.data[o + 1] = rimg.data[o + 2] = Math.round(r * 255);
      rimg.data[o + 3] = 255;
      const [cr0, cg0, cb0] = hypsoColor(Math.max(0, Math.min(1, (e - minE) / span)));
      const shade = 0.45 + 0.75 * hs;
      himg.data[o] = Math.min(255, cr0 * shade);
      himg.data[o + 1] = Math.min(255, cg0 * shade);
      himg.data[o + 2] = Math.min(255, cb0 * shade);
      himg.data[o + 3] = 255;
    }
  }
  rctx.putImageData(rimg, 0, 0);
  hctx.putImageData(himg, 0, 0);
  const layers: TerrainLayers = {
    relief,
    hypso,
    contours: buildContours({ x0, z0, cell, nx, nz, elevation }),
  };
  terrainCache.set(terrain, layers);
  return layers;
}

/* ------------------------------------------------------------------ */
/* Capa temática (depende de la instantánea y de la envolvente)        */
/* ------------------------------------------------------------------ */

/**
 * Ráster RGBA translúcido a resolución de nodo (se suaviza al escalar) con la capa activa; con
 * "elevation" solo lleva el velo de zonas (si está activo). null = nada que superponer.
 */
export function buildThematic(
  session: Session,
  activeLayer: TrekStoreState["activeLayer"],
  zonesOverlay: boolean,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (activeLayer === "elevation" && !zonesOverlay) return null;
  const { snapshot, envelope } = session;
  const { nx, nz } = snapshot.grid;
  // RGBA premultiplicado por nodo; luego se remuestrea bilineal a THEMATIC_PX (bordes suaves, sin escalones)
  const node = new Float32Array(nx * nz * 4);
  const caution = TREK_PARAMS.cautionSlopeFootDeg.value;

  for (let j = 0; j < nz; j += 1) {
    const row = nz - 1 - j; // +Z (norte) arriba
    for (let i = 0; i < nx; i += 1) {
      const k = j * nx + i;
      const px = (row * nx + i) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      if (Number.isNaN(snapshot.terrain.elevation[k]!)) {
        [r, g, b, a] = [20, 20, 26, 0.75];
      } else if (activeLayer === "slope") {
        const sl = snapshot.terrain.slopeDeg[k]!;
        if (sl > envelope.maxSlopeDeg) [r, g, b, a] = [255, 70, 50, 0.72];
        else if (sl >= caution) [r, g, b, a] = [255, 150, 60, 0.6];
        else {
          const f = Math.min(1, sl / caution);
          [r, g, b, a] = [80 + f * 175, 200 - f * 20, 120 - f * 70, 0.25 + 0.3 * f];
        }
      } else if (activeLayer === "zones") {
        const zv = zoneVisual(snapshot.zone[k]!);
        [r, g, b] = [zv.rgba[0], zv.rgba[1], zv.rgba[2]];
        a = snapshot.zone[k] === "Z0" ? 0.15 : 0.6;
      } else if (activeLayer === "confidence") {
        const c = CONF_RGB[snapshot.confidenceClass[k]!];
        [r, g, b, a] = [c[0], c[1], c[2], 0.55];
      } else if (activeLayer === "dust") {
        const f = Math.min(1, Math.max(0, (snapshot.dustTau[k]! - 0.3) / 2.5));
        [r, g, b, a] = [210, 170, 110, 0.1 + 0.7 * f];
      } else if (activeLayer === "radiation") {
        const f = Math.min(1, Math.max(0, (snapshot.doseRate[k]! - 0.5) / 2.2));
        [r, g, b, a] = [190, 90, 255, 0.08 + 0.7 * f];
      }

      if (zonesOverlay && activeLayer !== "zones") {
        const z = snapshot.zone[k]!;
        const tint = (c: readonly [number, number, number], alpha: number) => {
          const na = a + alpha * (1 - a);
          if (na <= 0) return;
          r = (r * a * (1 - alpha) + c[0] * alpha) / na;
          g = (g * a * (1 - alpha) + c[1] * alpha) / na;
          b = (b * a * (1 - alpha) + c[2] * alpha) / na;
          a = na;
        };
        if (z === "Z5") tint([255, 72, 52], 0.42);
        else if (z === "Z4") tint([143, 179, 240], 0.35);
        else if (z === "Z2") tint([240, 150, 70], 0.22);
        else if (z === "Z3") tint([24, 24, 32], 0.4);
      }
      const al = Math.max(0, Math.min(1, a));
      node[px] = r * al;
      node[px + 1] = g * al;
      node[px + 2] = b * al;
      node[px + 3] = al;
    }
  }
  // Desenfoque 3×3 (1-2-1) del campo premultiplicado: la isolínea del 50 % de una máscara en escalera
  // se vuelve una curva continua al remuestrear.
  {
    const tmp = new Float32Array(node.length);
    for (let y = 0; y < nz; y += 1) {
      for (let x = 0; x < nx; x += 1) {
        for (let c = 0; c < 4; c += 1) {
          let acc = 0;
          let wsum = 0;
          for (let dy = -1; dy <= 1; dy += 1) {
            const yy = y + dy;
            if (yy < 0 || yy >= nz) continue;
            for (let dx = -1; dx <= 1; dx += 1) {
              const xx = x + dx;
              if (xx < 0 || xx >= nx) continue;
              const w = (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
              acc += node[(yy * nx + xx) * 4 + c]! * w;
              wsum += w;
            }
          }
          tmp[(y * nx + x) * 4 + c] = acc / wsum;
        }
      }
    }
    node.set(tmp);
  }
  const off = document.createElement("canvas");
  off.width = off.height = THEMATIC_PX;
  const octx = off.getContext("2d");
  if (!octx) return null;
  const img = octx.createImageData(THEMATIC_PX, THEMATIC_PX);
  for (let py = 0; py < THEMATIC_PX; py += 1) {
    const fy = Math.max(0, Math.min(nz - 1, ((py + 0.5) / THEMATIC_PX) * nz - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(nz - 1, y0 + 1);
    const ty = fy - y0;
    for (let qx = 0; qx < THEMATIC_PX; qx += 1) {
      const fx = Math.max(0, Math.min(nx - 1, ((qx + 0.5) / THEMATIC_PX) * nx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(nx - 1, x0 + 1);
      const tx = fx - x0;
      const o = (py * THEMATIC_PX + qx) * 4;
      const i00 = (y0 * nx + x0) * 4;
      const i01 = (y0 * nx + x1) * 4;
      const i10 = (y1 * nx + x0) * 4;
      const i11 = (y1 * nx + x1) * 4;
      const w00 = (1 - tx) * (1 - ty);
      const w01 = tx * (1 - ty);
      const w10 = (1 - tx) * ty;
      const w11 = tx * ty;
      const al =
        node[i00 + 3]! * w00 + node[i01 + 3]! * w01 + node[i10 + 3]! * w10 + node[i11 + 3]! * w11;
      if (al <= 1e-3) continue;
      // Borde en la isolínea del 50 % (como marching squares): diagonales limpias, sin escalones de 1 m
      const peak = Math.max(node[i00 + 3]!, node[i01 + 3]!, node[i10 + 3]!, node[i11 + 3]!);
      const f = Math.max(0, Math.min(1, (al / peak - 0.35) / 0.3));
      const outA = peak * f * f * (3 - 2 * f);
      if (outA <= 1e-3) continue;
      for (let c = 0; c < 3; c += 1) {
        const v =
          node[i00 + c]! * w00 + node[i01 + c]! * w01 + node[i10 + c]! * w10 + node[i11 + c]! * w11;
        img.data[o + c] = Math.round(Math.min(255, v / al));
      }
      img.data[o + 3] = Math.round(outA * 255);
    }
  }
  octx.putImageData(img, 0, 0);
  return off;
}

export interface MapBase {
  readonly ortho: HTMLCanvasElement | null;
  readonly terrain: TerrainLayers | null;
  readonly thematic: HTMLCanvasElement | null;
}

/** Fracción (u, v) de un punto local dentro del ráster (u: este, v: hacia abajo = sur). */
export function toUV(session: Session, p: LocalPoint): [number, number] {
  const { x0, z0, nx, nz, cell } = session.snapshot.grid;
  const ex = Math.max(1e-6, (nx - 1) * cell);
  const ez = Math.max(1e-6, (nz - 1) * cell);
  return [(p.x - x0) / ex, 1 - (p.z - z0) / ez];
}

export interface DrawOptions {
  /** Curvas de nivel y retícula métrica. */
  readonly contours?: boolean;
  /** Píxeles de lienzo por píxel lógico (CANVAS_PX): el lienzo mide CANVAS_PX · pixelRatio. */
  readonly pixelRatio?: number;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
  readonly overlays: TrekStoreState["visibleOverlays"];
  readonly pois: TrekStoreState["siteInfo"]["pois"];
  readonly inspected: LocalPoint | null;
  /** En el plano isométrico se omiten textos (van como etiquetas DOM contrarrotadas). */
  readonly labels: boolean;
}

const ROUTE_ORANGE = "#df8a5d";

/** Dibuja ráster + superposiciones vectoriales sobre un canvas de CANVAS_PX × CANVAS_PX. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  base: MapBase,
  session: Session,
  o: DrawOptions,
): void {
  const W = CANVAS_PX;
  const H = CANVAS_PX;
  const { routeResult, activeRoute, proposedRoute, fsm } = session;
  const { extentX } = (() => {
    const { nx, cell } = session.snapshot.grid;
    return { extentX: Math.max(1e-6, (nx - 1) * cell) };
  })();

  const pr = o.pixelRatio ?? 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0d0b0a";
  ctx.fillRect(0, 0, W * pr, H * pr);
  ctx.setTransform(o.zoom * pr, 0, 0, o.zoom * pr, o.panX * pr, o.panY * pr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1–2. Base: ortofoto + relieve en "overlay", o hipsometría sombreada sin ortofoto
  if (base.ortho) {
    ctx.drawImage(base.ortho, 0, 0, W, H);
    if (base.terrain) {
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.6;
      ctx.drawImage(base.terrain.relief, 0, 0, W, H);
      ctx.restore();
    }
  } else if (base.terrain) {
    ctx.drawImage(base.terrain.hypso, 0, 0, W, H);
  }

  // 3. Capa temática / velo de zonas
  if (base.thematic) ctx.drawImage(base.thematic, 0, 0, W, H);

  const toS = (p: LocalPoint): [number, number] => {
    const [u, v] = toUV(session, p);
    return [u * W, v * H];
  };
  const lw = (px: number) => px / o.zoom;

  // 4. Curvas de nivel (maestras más marcadas) y retícula métrica de 10 m
  if (base.terrain && o.contours !== false) {
    const segs = (arr: Float32Array) => {
      ctx.beginPath();
      for (let k = 0; k < arr.length; k += 4) {
        const [ax, ay] = toS({ x: arr[k]!, z: arr[k + 1]! });
        const [bx, by] = toS({ x: arr[k + 2]!, z: arr[k + 3]! });
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
    };
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = base.ortho ? "rgba(255,236,210,0.2)" : "rgba(255,236,210,0.16)";
    ctx.lineWidth = lw(0.7);
    segs(base.terrain.contours.minor);
    ctx.stroke();
    ctx.strokeStyle = base.ortho ? "rgba(255,236,210,0.5)" : "rgba(255,236,210,0.4)";
    ctx.lineWidth = lw(1.2);
    segs(base.terrain.contours.major);
    ctx.stroke();
    ctx.restore();
  }

  const path = (pts: readonly LocalPoint[]) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [sx, sy] = toS(p);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
  };

  // Retícula métrica cada 10 m (coordenadas locales), marfil al 8 %
  {
    const { x0, z0, nx, nz, cell } = session.snapshot.grid;
    const x1 = x0 + (nx - 1) * cell;
    const z1 = z0 + (nz - 1) * cell;
    ctx.save();
    ctx.strokeStyle = "rgba(238,229,202,0.08)";
    ctx.lineWidth = lw(1);
    ctx.beginPath();
    for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) {
      const [sx] = toS({ x, z: z0 });
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
    }
    for (let z = Math.ceil(z0 / 10) * 10; z <= z1; z += 10) {
      const [, sy] = toS({ x: x0, z });
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Tormentas activas (SIMULATED) — mismo estilo que .iso__storm del front
  for (const s of session.storms) {
    if (!s.active) continue;
    const [cx, cy] = toS(s.center);
    const rPx = (s.radiusM / extentX) * W;
    ctx.save();
    ctx.fillStyle = "rgba(73,108,168,0.28)";
    ctx.strokeStyle = "rgba(238,229,202,0.55)";
    ctx.lineWidth = lw(2);
    ctx.setLineDash([lw(7), lw(6)]);
    ctx.beginPath();
    ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (o.labels) {
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(238,229,202,0.9)";
      ctx.font = `${lw(10)}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`TORMENTA · τ ${s.tau.toFixed(1)} · SIM`, cx, cy + lw(4));
    }
    ctx.restore();
  }

  // Línea recta origen→destino bloqueada (explicación visual de blockedDirectPath)
  if (routeResult.ok && routeResult.explanation.blockedDirectPath.length > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,107,74,0.6)";
    ctx.lineWidth = lw(1.5);
    ctx.setLineDash([lw(2), lw(6)]);
    path([session.origin, session.goal]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = lw(2);
    for (const b of routeResult.explanation.blockedDirectPath) {
      const [bx, by] = toS(b.at);
      const r = lw(5);
      ctx.beginPath();
      ctx.moveTo(bx - r, by - r);
      ctx.lineTo(bx + r, by + r);
      ctx.moveTo(bx + r, by - r);
      ctx.lineTo(bx - r, by + r);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Alternativas: admisibles (azul discontinuo) y descartadas (rojo punteado)
  if (o.overlays.alternatives && routeResult.ok) {
    for (const alt of routeResult.explanation.alternatives) {
      if (!alt.route || alt.route.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle =
        alt.status === "discarded" ? "rgba(255,107,74,0.8)" : "rgba(143,179,240,0.8)";
      ctx.lineWidth = lw(2);
      ctx.setLineDash(alt.status === "discarded" ? [lw(3), lw(5)] : [lw(9), lw(5)]);
      path(alt.route.points);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Propuesta del replanificador
  if (proposedRoute && proposedRoute.points.length >= 2) {
    ctx.save();
    ctx.strokeStyle = "#f3c27a";
    ctx.lineWidth = lw(3);
    ctx.setLineDash([lw(7), lw(4)]);
    path(proposedRoute.points);
    ctx.stroke();
    ctx.restore();
  }

  // Camino ya recorrido por el astronauta (marfil continuo, debajo de la ruta que falta)
  if (o.overlays.route && session.trail.length >= 2) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "#0b0807";
    ctx.lineWidth = lw(6);
    path(session.trail);
    ctx.stroke();
    ctx.strokeStyle = "#eee5ca";
    ctx.lineWidth = lw(3);
    path(session.trail);
    ctx.stroke();
    ctx.restore();
  }

  // Ruta activa con el trazo del front (resplandor + discontinuo naranja); color por estado de salud,
  // patrón por confianza científica cuando la superposición K1–K5 está activa.
  if (o.overlays.route && activeRoute && activeRoute.points.length >= 2) {
    const st = fsm.state;
    const color =
      st === "CRITICAL" || st === "EMERGENCY"
        ? "#ff6b4a"
        : st === "FATIGUE"
          ? "#8fb3f0"
          : ROUTE_ORANGE;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = lw(14);
    path(activeRoute.points);
    ctx.stroke();
    // Casco oscuro: la ruta se lee sobre la ortofoto clara u oscura
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "#0b0807";
    ctx.lineWidth = lw(7);
    path(activeRoute.points);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 1;
    ctx.lineWidth = lw(4);
    if (o.overlays.confidence) {
      for (const seg of activeRoute.segments) {
        const c = seg.confidence;
        ctx.setLineDash(
          c === "K1" || c === "K2"
            ? [lw(9), lw(7)]
            : c === "K4"
              ? [lw(2), lw(5)]
              : c === "K5"
                ? [lw(1), lw(6)]
                : [lw(5), lw(7)],
        );
        path([seg.from, seg.to]);
        ctx.stroke();
      }
    } else {
      ctx.setLineDash([lw(9), lw(7)]);
      path(activeRoute.points);
      ctx.stroke();
    }
    ctx.restore();
  }

  // POIs de Curiosity
  if (o.overlays.pois) {
    for (const poi of o.pois) {
      const [sx, sy] = toS(poi.point);
      ctx.save();
      ctx.fillStyle = "#8fb3f0";
      ctx.strokeStyle = "#04060b";
      ctx.lineWidth = lw(1.5);
      ctx.beginPath();
      ctx.arc(sx, sy, lw(4.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // Refugios (rombo)
  if (o.overlays.shelters) {
    for (const sh of session.shelters) {
      const [sx, sy] = toS(sh.point);
      const r = lw(7);
      ctx.save();
      ctx.fillStyle = "#8fd6b0";
      ctx.strokeStyle = "#04060b";
      ctx.lineWidth = lw(1.8);
      ctx.beginPath();
      ctx.moveTo(sx, sy - r);
      ctx.lineTo(sx + r, sy);
      ctx.lineTo(sx, sy + r);
      ctx.lineTo(sx - r, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // Nodos de origen y destino con el estilo .rt-node del front (aro + núcleo marfil)
  const node = (p: LocalPoint, ring: string) => {
    const [x, y] = toS(p);
    ctx.save();
    ctx.fillStyle = "rgba(223,138,93,0.14)";
    ctx.beginPath();
    ctx.arc(x, y, lw(16), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#04060b";
    ctx.strokeStyle = ring;
    ctx.lineWidth = lw(3);
    ctx.beginPath();
    ctx.arc(x, y, lw(7), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#eee5ca";
    ctx.beginPath();
    ctx.arc(x, y, lw(2.8), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  node(session.origin, "#eee5ca");
  node(session.goal, ROUTE_ORANGE);

  // Estaciones científicas del recorrido: número de orden; verde = hecha, gris tachada = omitida
  const stopStatus = new Map(session.stopLog.map((e) => [e.stopId, e.status]));
  session.stops.forEach((stop, i) => {
    const [x, y] = toS(stop.point);
    const status = stopStatus.get(stop.id);
    const working = session.dwell?.stopId === stop.id;
    const r = lw(9);
    ctx.save();
    ctx.fillStyle =
      status === "done"
        ? "#9fd8b8"
        : status === "skipped" || status === "interrupted"
          ? "#6b6f78"
          : working
            ? "#ffd27a"
            : "#eee5ca";
    ctx.strokeStyle = "#04060b";
    ctx.lineWidth = lw(2.2);
    ctx.beginPath();
    ctx.roundRect(x - r, y - r, r * 2, r * 2, lw(3));
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#04060b";
    ctx.font = `700 ${lw(11)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x, y + lw(0.5));
    if (status === "skipped") {
      ctx.strokeStyle = "#ff6b4a";
      ctx.lineWidth = lw(2);
      ctx.beginPath();
      ctx.moveTo(x - r, y + r);
      ctx.lineTo(x + r, y - r);
      ctx.stroke();
    }
    ctx.restore();
  });

  // Astronauta: posición real sobre la ruta (verde nominal, rojo si va de regreso)
  if (session.walkedM > 0.5) {
    const [ax, ay] = toS(session.position);
    ctx.save();
    ctx.fillStyle = session.returning ? "#ff6b4a" : "#9fd8b8";
    ctx.strokeStyle = "#04060b";
    ctx.lineWidth = lw(3);
    ctx.beginPath();
    ctx.arc(ax, ay, lw(8), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Retícula de inspección
  if (o.inspected) {
    const [ix, iy] = toS(o.inspected);
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = lw(1.5);
    ctx.beginPath();
    ctx.arc(ix, iy, lw(6), 0, Math.PI * 2);
    ctx.moveTo(ix - lw(10), iy);
    ctx.lineTo(ix - lw(3), iy);
    ctx.moveTo(ix + lw(3), iy);
    ctx.lineTo(ix + lw(10), iy);
    ctx.stroke();
    ctx.restore();
  }
}
