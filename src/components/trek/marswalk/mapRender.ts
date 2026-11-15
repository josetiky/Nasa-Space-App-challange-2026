/**
 * MarsWalk · Render del mapa compartido por el plano 2D (pestaña MarsWalk) y el plano isométrico
 * (pestaña Simulación). Solo pinta lo que ya calculó el motor (`session.snapshot`, `routeResult`,
 * `activeRoute`, tormentas, refugios): no decide rutas, zonas ni costos.
 */
import type { ConfidenceClass, LocalPoint } from "@/core/trek/contracts";
import { TREK_PARAMS } from "@/core/trek/params";
import type { TrekStoreState } from "@/state/trekStore";
import { hillshadeAt, zoneVisual } from "../viewHelpers";

export const CANVAS_PX = 760;

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

/** Ráster base: un píxel por nodo de la rejilla, con la capa activa y la trama de zonas opcional. */
export function buildRaster(
  session: Session,
  activeLayer: TrekStoreState["activeLayer"],
  zonesOverlay: boolean,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const { snapshot, envelope } = session;
  const { nx, nz, cell } = snapshot.grid;
  const elevation = snapshot.terrain.elevation;
  const off = document.createElement("canvas");
  off.width = nx;
  off.height = nz;
  const octx = off.getContext("2d");
  if (!octx) return null;
  const img = octx.createImageData(nx, nz);

  let minE = Number.POSITIVE_INFINITY;
  let maxE = Number.NEGATIVE_INFINITY;
  for (let k = 0; k < elevation.length; k += 1) {
    const v = elevation[k]!;
    if (!Number.isNaN(v)) {
      if (v < minE) minE = v;
      if (v > maxE) maxE = v;
    }
  }
  const span = Math.max(0.5, maxE - minE);
  const caution = TREK_PARAMS.cautionSlopeFootDeg.value;

  for (let j = 0; j < nz; j += 1) {
    const row = nz - 1 - j; // +Z (norte) arriba
    for (let i = 0; i < nx; i += 1) {
      const k = j * nx + i;
      const px = (row * nx + i) * 4;
      const e = elevation[k]!;
      if (Number.isNaN(e)) {
        // Sin dato (NaN): gris neutro uniforme, nunca se rellena con valores inventados
        img.data[px] = 34;
        img.data[px + 1] = 34;
        img.data[px + 2] = 40;
        img.data[px + 3] = 255;
        continue;
      }
      const hs = hillshadeAt(elevation, nx, nz, cell, i, j);
      const n = (e - minE) / span;
      const shade = 0.38 + 0.72 * hs;
      let r = (70 + n * 128) * shade;
      let g = (46 + n * 86) * shade;
      let b = (36 + n * 54) * shade;

      if (activeLayer === "slope") {
        const sl = snapshot.terrain.slopeDeg[k]!;
        if (sl > envelope.maxSlopeDeg) [r, g, b] = [255, 107, 74];
        else if (sl >= caution) [r, g, b] = [223, 138, 93];
        else {
          const f = Math.min(1, sl / caution);
          [r, g, b] = [60 + f * 150, 96 + f * 90, 88 - f * 20];
        }
        r *= 0.7 + 0.3 * hs;
        g *= 0.7 + 0.3 * hs;
        b *= 0.7 + 0.3 * hs;
      } else if (activeLayer === "zones") {
        const zv = zoneVisual(snapshot.zone[k]!);
        [r, g, b] = [zv.rgba[0], zv.rgba[1], zv.rgba[2]];
      } else if (activeLayer === "confidence") {
        const c = CONF_RGB[snapshot.confidenceClass[k]!];
        [r, g, b] = [c[0] * shade, c[1] * shade, c[2] * shade];
      } else if (activeLayer === "dust") {
        const f = Math.min(1, Math.max(0, (snapshot.dustTau[k]! - 0.3) / 2.5));
        [r, g, b] = [(90 + f * 160) * shade, (70 + f * 90) * shade, (60 + f * 20) * shade];
      } else if (activeLayer === "radiation") {
        const f = Math.min(1, Math.max(0, (snapshot.doseRate[k]! - 0.5) / 2.2));
        [r, g, b] = [(60 + f * 190) * shade, (80 - f * 30) * shade, (150 + f * 80) * shade];
      }

      if (zonesOverlay && activeLayer !== "zones") {
        // Velo translúcido por zona (sin tramas de cuadros): se suaviza al escalar el ráster
        const z = snapshot.zone[k]!;
        const tint = (c: readonly [number, number, number], a: number) => {
          r = r * (1 - a) + c[0] * a;
          g = g * (1 - a) + c[1] * a;
          b = b * (1 - a) + c[2] * a;
        };
        if (z === "Z5") tint([255, 92, 64], 0.5);
        else if (z === "Z4") tint([143, 179, 240], 0.32);
        else if (z === "Z2") tint([240, 150, 70], 0.22);
        else if (z === "Z1") tint([240, 190, 110], 0.12);
        else if (z === "Z3") tint([30, 30, 40], 0.3);
      }

      img.data[px] = Math.max(0, Math.min(255, Math.round(r)));
      img.data[px + 1] = Math.max(0, Math.min(255, Math.round(g)));
      img.data[px + 2] = Math.max(0, Math.min(255, Math.round(b)));
      img.data[px + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return off;
}

/** Fracción (u, v) de un punto local dentro del ráster (u: este, v: hacia abajo = sur). */
export function toUV(session: Session, p: LocalPoint): [number, number] {
  const { x0, z0, nx, nz, cell } = session.snapshot.grid;
  const ex = Math.max(1e-6, (nx - 1) * cell);
  const ez = Math.max(1e-6, (nz - 1) * cell);
  return [(p.x - x0) / ex, 1 - (p.z - z0) / ez];
}

export interface DrawOptions {
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
  raster: HTMLCanvasElement | null,
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

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0d0b0a";
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(o.zoom, 0, 0, o.zoom, o.panX, o.panY);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (raster) ctx.drawImage(raster, 0, 0, W, H);

  const toS = (p: LocalPoint): [number, number] => {
    const [u, v] = toUV(session, p);
    return [u * W, v * H];
  };
  const lw = (px: number) => px / o.zoom;
  const path = (pts: readonly LocalPoint[]) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [sx, sy] = toS(p);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
  };

  // Cuadrícula del front (líneas marfil al 7 %)
  ctx.strokeStyle = "rgba(238,229,202,0.07)";
  ctx.lineWidth = lw(1);
  for (let k = 1; k < 10; k += 1) {
    ctx.beginPath();
    ctx.moveTo((k * W) / 10, 0);
    ctx.lineTo((k * W) / 10, H);
    ctx.moveTo(0, (k * H) / 10);
    ctx.lineTo(W, (k * H) / 10);
    ctx.stroke();
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
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = lw(14);
    path(activeRoute.points);
    ctx.stroke();
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
