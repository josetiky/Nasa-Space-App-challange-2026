/**
 * Mars Trek · Pantalla operativa principal (/trek y /martian-map) (Tarea 11, UX_UI_GUIDELINES §3–§8).
 *
 * Disposición de 3 columnas + línea de tiempo inferior:
 * - Izquierda: Selector de sitio y perfil, Panel de Capas Científicas (con procedencia y capas no_disponible desacopladas),
 *   Panel de Salud del Astronauta (HUELLA + FSM, minigráfica ASCII, candado de confirmación humana con justificación).
 * - Centro: Mapa 2D interactivo (zoom, pan, coordenadas planetocéntricas IAU_2015:49900 y métricas locales,
 *   tramas por zona Z0–Z5, trazos por confianza K1–K5, clic para origen/destino/tormenta/evidencia) y Perfil de Elevación/Confianza.
 * - Derecha: Ruta Activa, Barra de Porqués (D, T, R, E, U, H suman 100 %), Bloqueos del Camino Directo,
 *   Comparación de Alternativas (admisibles y descartadas) y Margen de Regreso (Walkback).
 * - Inferior: Consola de Simulación Determinista, inyección de contingencias y bitácora de replanificación.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { DataBadge } from "@/components/mission/ui";
import type { EvaPlan } from "@/core/types";
import type {
  CostTermId,
  LocalPoint,
  MissionProfileId,
  WeightProfileId,
  ZoneClass,
} from "@/core/trek/contracts";
import { TREK_SCENARIOS } from "@/core/trek/sim/scenarios";
import { loadSiteElevationGrid, TREK_SITES } from "@/services/trek/sites";
import { dispatchMission } from "@/state/missionStore";
import {
  dispatchTrek,
  isHumanLockActive,
  needsSiteLoad,
  trekStore,
  useTrek,
  type MapLayerId,
  type MapPickMode,
} from "@/state/trekStore";
import { TREK_TEXTS } from "./i18n";
import { UNAVAILABLE_DECOUPLED_LAYERS } from "./layerCatalog";
import {
  asciiSparkBar,
  confidenceVisual,
  healthVisual,
  hillshadeAt,
  localToPlanetocentric,
  whyBarSegments,
  zoneVisual,
} from "./viewHelpers";


export default function TrekWorkspace() {
  const state = useTrek();
  const t = TREK_TEXTS[state.lang];
  const { session, siteInfo, activeLayer, visibleOverlays, pickMode, inspectedPoint } = state;
  const { snapshot, directive, envelope, routeResult, activeRoute, proposedRoute, resources, fsm } =
    session;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverPoint, setHoverPoint] = useState<LocalPoint | null>(null);
  const [authBy, setAuthBy] = useState("HAB-IV1 (Control Hábitat)");
  const [authReason, setAuthReason] = useState("");
  const [exportedNotice, setExportedNotice] = useState(false);

  // Cargar tesela real cuando cambia siteId (sin recrear la sesión si ya se construyó con ese sitio)
  useEffect(() => {
    if (!needsSiteLoad(trekStore.getState())) return;
    let cancelled = false;
    dispatchTrek({ type: "setSiteLoading", siteId: state.siteId });
    loadSiteElevationGrid(state.siteId)
      .then(({ site, grid, manifest }) => {
        if (cancelled) return;
        dispatchTrek({ type: "setSiteLoaded", site, grid, manifest });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        dispatchTrek({
          type: "setSiteError",
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [state.siteId]);

  // Tecla Escape vuelve a modo inspección
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatchTrek({ type: "setPickMode", mode: "inspect" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Dibujar el costmap, tramas de zona, refugios, POIs, alternativas y ruta activa en el lienzo 2D
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const { nx, nz, x0, z0, cell } = snapshot.grid;

    ctx.save();
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, W, H);

    // Crear imagen base del costmap de nx × nz píxeles
    const offscreen = document.createElement("canvas");
    offscreen.width = nx;
    offscreen.height = nz;
    const offCtx = offscreen.getContext("2d")!;
    const img = offCtx.createImageData(nx, nz);

    let minElev = Number.POSITIVE_INFINITY;
    let maxElev = Number.NEGATIVE_INFINITY;
    for (let k = 0; k < snapshot.terrain.elevation.length; k += 1) {
      const v = snapshot.terrain.elevation[k]!;
      if (!Number.isNaN(v)) {
        if (v < minElev) minElev = v;
        if (v > maxElev) maxElev = v;
      }
    }
    const elevSpan = Math.max(0.5, maxElev - minElev);

    for (let j = 0; j < nz; j += 1) {
      // Invertir eje Z en pantalla para que +Z (Norte) quede arriba
      const row = nz - 1 - j;
      for (let i = 0; i < nx; i += 1) {
        const k = j * nx + i;
        const px = (row * nx + i) * 4;
        const elev = snapshot.terrain.elevation[k]!;
        const hs = hillshadeAt(snapshot.terrain.elevation, nx, nz, cell, i, j);

        if (Number.isNaN(elev)) {
          // Trama de puntos para celda desconocida K5 / NaN
          const dot = (i + j) % 3 === 0 ? 78 : 34;
          img.data[px] = dot;
          img.data[px + 1] = dot + 6;
          img.data[px + 2] = dot + 16;
          img.data[px + 3] = 255;
          continue;
        }

        const normElev = (elev - minElev) / elevSpan;
        // Base marciana ocre/basalto modulada por hillshade
        let r = (75 + normElev * 115) * (0.45 + 0.65 * hs);
        let g = (52 + normElev * 78) * (0.45 + 0.65 * hs);
        let b = (42 + normElev * 56) * (0.45 + 0.65 * hs);

        if (activeLayer === "slope") {
          const sl = snapshot.terrain.slopeDeg[k]!;
          if (sl > envelope.maxSlopeDeg) {
            r = 235;
            g = 62;
            b = 88;
          } else if (sl >= 15) {
            r = 245;
            g = 158;
            b = 11;
          } else {
            const tSl = Math.min(1, sl / 15);
            r = 24 + tSl * 140;
            g = 165 - tSl * 30;
            b = 115 - tSl * 60;
          }
        } else if (activeLayer === "zones") {
          const zv = zoneVisual(snapshot.zone[k]!);
          r = zv.rgba[0];
          g = zv.rgba[1];
          b = zv.rgba[2];
        } else if (activeLayer === "confidence") {
          const sc = snapshot.terrain.confidenceScore[k]!;
          const cls = snapshot.confidenceClass[k]!;
          if (cls === "K1") {
            r = 16;
            g = 215;
            b = 150;
          } else if (cls === "K2") {
            r = 56;
            g = 189;
            b = 248;
          } else {
            r = 180 * sc;
            g = 140 * sc;
            b = 220 * sc;
          }
        } else if (activeLayer === "dust") {
          const tau = snapshot.dustTau[k]!;
          const normTau = Math.min(1, Math.max(0, (tau - 0.3) / 2.5));
          r = 90 + normTau * 155;
          g = 75 + normTau * 70;
          b = 60 - normTau * 30;
        } else if (activeLayer === "radiation") {
          const dose = snapshot.doseRate[k]!;
          const normDose = Math.min(1, Math.max(0, (dose - 0.5) / 2.2));
          r = 70 + normDose * 180;
          g = 90 - normDose * 45;
          b = 180 + normDose * 60;
        }

        // Superposición de zonas (con trama cruzada en Z5 y diagonal en Z1/Z2)
        if (visibleOverlays.zones && activeLayer !== "zones") {
          const z = snapshot.zone[k]!;
          if (z === "Z5") {
            const hatch = (i + j) % 4 === 0 || Math.abs(i - j) % 4 === 0;
            r = hatch ? 248 : r * 0.45 + 120;
            g = hatch ? 55 : g * 0.35;
            b = hatch ? 85 : b * 0.35 + 25;
          } else if (z === "Z1" || z === "Z2") {
            const stripe = (i + j) % 5 === 0;
            if (stripe) {
              r = Math.min(255, r * 0.6 + 100);
              g = Math.min(255, g * 0.6 + 65);
              b = b * 0.5;
            }
          } else if (z === "Z4") {
            if (i % 4 === 0) {
              r = 56;
              g = 189;
              b = 248;
            }
          }
        }

        img.data[px] = Math.max(0, Math.min(255, Math.round(r)));
        img.data[px + 1] = Math.max(0, Math.min(255, Math.round(g)));
        img.data[px + 2] = Math.max(0, Math.min(255, Math.round(b)));
        img.data[px + 3] = 255;
      }
    }
    offCtx.putImageData(img, 0, 0);

    // Transformación de vista (zoom + pan)
    ctx.translate(W / 2 + pan.x, H / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, W, H);

    const toScreen = (pt: LocalPoint): [number, number] => {
      const fx = (pt.x - x0) / ((nx - 1) * cell);
      const fz = (pt.z - z0) / ((nz - 1) * cell);
      return [fx * W, (1 - fz) * H];
    };

    // Cuadrícula métrica cada 16 m
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1 / zoom;
    for (let m = -48; m <= 48; m += 16) {
      const [sx] = toScreen({ x: m, z: 0 });
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
      ctx.stroke();

      const [, sy] = toScreen({ x: 0, z: m });
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
      ctx.stroke();
    }

    // Dibujar polígonos de tormenta activa
    for (const storm of session.storms) {
      if (!storm.active) continue;
      const [cx, cy] = toScreen(storm.center);
      const rPx = (storm.radiusM / ((nx - 1) * cell)) * W;
      ctx.save();
      ctx.strokeStyle = "#f43f5e";
      ctx.fillStyle = "rgba(244, 63, 94, 0.22)";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Dibujar alternativas (admisibles en discontinuo cian, descartadas en punteado rosa)
    if (visibleOverlays.alternatives && routeResult.ok) {
      for (const alt of routeResult.explanation.alternatives) {
        if (!alt.route || alt.route.points.length < 2) continue;
        ctx.save();
        ctx.strokeStyle =
          alt.status === "discarded" ? "rgba(244, 63, 94, 0.78)" : "rgba(56, 189, 248, 0.65)";
        ctx.lineWidth = 2.2 / zoom;
        ctx.setLineDash(
          alt.status === "discarded" ? [3 / zoom, 5 / zoom] : [8 / zoom, 5 / zoom],
        );
        ctx.beginPath();
        alt.route.points.forEach((p, idx) => {
          const [sx, sy] = toScreen(p);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
        ctx.restore();
      }
    }

    // Si hay ruta propuesta (>10% mejora), dibujarla en ámbar discontinuo
    if (proposedRoute && proposedRoute.points.length >= 2) {
      ctx.save();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3 / zoom;
      ctx.setLineDash([7 / zoom, 4 / zoom]);
      ctx.beginPath();
      proposedRoute.points.forEach((p, idx) => {
        const [sx, sy] = toScreen(p);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Dibujar ruta activa (continua en K1-K2, discontinua en K3, punteada en K4)
    if (visibleOverlays.route && activeRoute && activeRoute.points.length >= 2) {
      ctx.save();
      // Halo oscuro para legibilidad sobre cualquier capa
      ctx.strokeStyle = "rgba(8, 11, 18, 0.88)";
      ctx.lineWidth = 6.5 / zoom;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      activeRoute.points.forEach((p, idx) => {
        const [sx, sy] = toScreen(p);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();

      // Trazo principal coloreado según estado de salud
      ctx.strokeStyle =
        directive.state === "CRITICAL" || directive.state === "EMERGENCY"
          ? "#fb7185"
          : directive.state === "FATIGUE"
            ? "#38bdf8"
            : directive.state === "CAUTION"
              ? "#fbbf24"
              : "#34d399";
      ctx.lineWidth = 3.6 / zoom;
      if (
        visibleOverlays.confidence &&
        activeRoute.minConfidence !== "K1" &&
        activeRoute.minConfidence !== "K2"
      ) {
        ctx.setLineDash([8 / zoom, 4 / zoom]);
      }
      ctx.beginPath();
      activeRoute.points.forEach((p, idx) => {
        const [sx, sy] = toScreen(p);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Dibujar POIs científicos
    if (visibleOverlays.pois) {
      for (const poi of siteInfo.pois) {
        const [sx, sy] = toScreen(poi.point);
        ctx.save();
        ctx.fillStyle = "#38bdf8";
        ctx.strokeStyle = "#090d16";
        ctx.lineWidth = 1.5 / zoom;
        ctx.beginPath();
        ctx.arc(sx, sy, 4.5 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Dibujar refugios (<> rombo cian/menta)
    if (visibleOverlays.shelters) {
      for (const sh of session.shelters) {
        const [sx, sy] = toScreen(sh.point);
        const r = 6.5 / zoom;
        ctx.save();
        ctx.fillStyle = "#2dd4bf";
        ctx.strokeStyle = "#090d16";
        ctx.lineWidth = 1.8 / zoom;
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

    // Dibujar Origen (círculo verde) y Destino (triángulo ámbar)
    const [ox, oy] = toScreen(session.origin);
    ctx.save();
    ctx.fillStyle = "#10b981";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(ox, oy, 6.5 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const [gx, gy] = toScreen(session.goal);
    const gr = 7.5 / zoom;
    ctx.save();
    ctx.fillStyle = "#f59e0b";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(gx, gy - gr);
    ctx.lineTo(gx + gr, gy + gr);
    ctx.lineTo(gx - gr, gy + gr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Punto inspeccionado (retícula blanca)
    const [ix, iy] = toScreen(inspectedPoint);
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.arc(ix, iy, 5 / zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }, [
    snapshot,
    activeLayer,
    visibleOverlays,
    activeRoute,
    proposedRoute,
    routeResult,
    session.origin,
    session.goal,
    session.shelters,
    session.storms,
    siteInfo.pois,
    directive.state,
    envelope.maxSlopeDeg,
    inspectedPoint,
    zoom,
    pan,
  ]);

  const screenToLocal = (clientX: number, clientY: number): LocalPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;

    const W = canvas.width;
    const H = canvas.height;
    const ux = (px - W / 2 - pan.x) / zoom + W / 2;
    const uy = (py - H / 2 - pan.y) / zoom + H / 2;

    const { x0, z0, nx, nz, cell } = snapshot.grid;
    const x = Math.round(x0 + (ux / W) * ((nx - 1) * cell));
    const z = Math.round(z0 + (1 - uy / H) * ((nz - 1) * cell));
    if (x < x0 || z < z0 || x > x0 + (nx - 1) * cell || z > z0 + (nz - 1) * cell) {
      return null;
    }
    return { x, z };
  };

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = screenToLocal(e.clientX, e.clientY);
    if (!pt) return;
    dispatchTrek({ type: "inspectPoint", point: pt });

    if (pickMode === "origin") {
      dispatchTrek({
        type: "simEvent",
        event: { kind: "set-origin", origin: pt, simulated: false },
      });
    } else if (pickMode === "goal") {
      dispatchTrek({
        type: "simEvent",
        event: { kind: "set-goal", goal: pt, simulated: false },
      });
    } else if (pickMode === "storm") {
      dispatchTrek({
        type: "simEvent",
        event: {
          kind: "storm-appear",
          storm: {
            id: `storm-${Date.now().toString(36)}`,
            name: `Tormenta (${pt.x}, ${pt.z})`,
            center: pt,
            radiusM: 14,
            tau: 2.6,
            active: true,
            dataType: "SIMULATED",
          },
          simulated: true,
        },
      });
    }
  };

  const cursorPoint = hoverPoint ?? inspectedPoint;
  const cursorGeo = useMemo(
    () => localToPlanetocentric(cursorPoint, siteInfo.coord),
    [cursorPoint, siteInfo.coord],
  );
  const cursorElev = snapshot.sample("elevation", cursorPoint.x, cursorPoint.z);
  const cursorSlope = snapshot.sample("slopeDeg", cursorPoint.x, cursorPoint.z);
  const cursorConf = snapshot.confidenceAt(cursorPoint.x, cursorPoint.z);
  const cursorConfScore = snapshot.sample("confidenceScore", cursorPoint.x, cursorPoint.z);
  const cursorZone = snapshot.zoneAt(cursorPoint.x, cursorPoint.z);

  const whySegments = useMemo(() => {
    if (!routeResult.ok) {
      return whyBarSegments({ D: 1, T: 0, R: 0, E: 0, U: 0, H: 0 });
    }
    return whyBarSegments(routeResult.explanation.contributions);
  }, [routeResult]);

  const hStyle = healthVisual(fsm.state);
  const isCriticalOrEmergency = fsm.state === "CRITICAL" || fsm.state === "EMERGENCY";

  const handleExportToMission = () => {
    if (!activeRoute) return;
    const evaPlan: EvaPlan = {
      siteId: siteInfo.id,
      siteName: siteInfo.name,
      waypoints: activeRoute.points.map((p, idx) => ({
        id: `trek-wp-${idx}`,
        x: p.x,
        y: snapshot.sample("elevation", p.x, p.z) || 0,
        z: p.z,
      })),
      segments: activeRoute.segments.map((seg, idx) => ({
        fromId: `trek-wp-${idx}`,
        toId: `trek-wp-${idx + 1}`,
        distanceM: seg.distanceM,
        climbM: Math.max(0, seg.deltaZM),
        maxSlopeDeg: seg.slopeDeg,
        minutes: seg.durationMin,
      })),
      profile: activeRoute.segments.map((seg, idx) => ({
        distanceM: activeRoute.segments
          .slice(0, idx + 1)
          .reduce((acc, s) => acc + s.distanceM, 0),
        elevationM: snapshot.sample("elevation", seg.to.x, seg.to.z) || 0,
        slopeDeg: seg.slopeDeg,
      })),
      distanceM: activeRoute.distanceM,
      elevationGainM: activeRoute.elevationGainM,
      maxSlopeDeg: activeRoute.maxSlopeDeg,
      meanSlopeDeg:
        activeRoute.segments.length > 0
          ? activeRoute.segments.reduce((a, s) => a + s.slopeDeg, 0) /
            activeRoute.segments.length
          : 0,
      durationMin: activeRoute.durationMin,
      o2Kg: activeRoute.o2Kg,
      hazards: directive.rationale.map((r) => `${r.ruleId}: ${r.message}`),
      poisVisited: siteInfo.pois.map((p) => p.title),
      scienceValue: 0.85,
    };
    dispatchMission({ type: "setEvaPlan", plan: evaPlan });
    setExportedNotice(true);
    setTimeout(() => setExportedNotice(false), 3500);
  };

  const handleHumanAuthorize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authBy.trim() || !authReason.trim()) return;
    dispatchTrek({
      type: "simEvent",
      event: {
        kind: "human-authorize",
        by: authBy.trim(),
        justification: authReason.trim(),
        atShelter: true,
        simulated: true,
      },
    });
    setAuthReason("");
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-ink text-bright">
      {/* Banda superior fija de simulación y estado de emergencia */}
      <div className="border-b border-amber/35 bg-amber/10 px-4 py-1.5 font-mono text-[11px] text-amber">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-2">
          <span>
            <strong>[SIMULADO]</strong> {t.simulationBanner}
          </span>
          <span className="text-[10px] text-fog">{t.portalDisclaimer}</span>
        </div>
      </div>

      {isCriticalOrEmergency ? (
        <div
          role="alert"
          aria-live="assertive"
          className="border-b border-rose bg-rose/20 px-4 py-2 font-mono text-xs text-rose"
        >
          <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-2">
            <span>
              <strong>
                {hStyle.shapeGlyph} MODO {t.healthStates[fsm.state]} ACTIVO:
              </strong>{" "}
              Planificación ordinaria suspendida · Directiva:{" "}
              <strong>{directive.goalPolicy}</strong> · Límite pendiente:{" "}
              <strong>{envelope.maxSlopeDeg}°</strong> · Enclavamiento:{" "}
              <strong>{fsm.latch}</strong>
            </span>
            <span>
              Protocolo: <strong>{directive.protocol ?? "suit-depressurization"}</strong>
            </span>
          </div>
        </div>
      ) : null}

      {/* Barra de control superior */}
      <div className="border-b border-line bg-panel/80 px-4 py-2.5">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base font-bold tracking-tight text-bright">
                  {t.brandTitle}
                </h1>
                <DataBadge type={siteInfo.dataType} />
              </div>
              <p className="font-mono text-[10px] text-fog">{t.brandSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            {/* Selector de sitio */}
            <label className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-fog">{t.siteLabel}:</span>
              <select
                aria-label={t.siteLabel}
                value={state.siteId}
                disabled={isHumanLockActive(state)}
                onChange={(e) =>
                  dispatchTrek({ type: "setSiteLoading", siteId: e.target.value })
                }
                className="rounded-lg border border-line bg-ink2 px-2.5 py-1 text-xs text-bright"
              >
                {TREK_SITES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.simulated ? "SIMULATED" : "REAL 1m"})
                  </option>
                ))}
              </select>
            </label>

            {/* Selector de perfil de pesos */}
            <label className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-fog">
                {t.profileLabel}:
              </span>
              <select
                aria-label={t.profileLabel}
                value={session.weightProfile}
                onChange={(e) =>
                  dispatchTrek({
                    type: "setWeightProfile",
                    profile: e.target.value as WeightProfileId,
                  })
                }
                className="rounded-lg border border-line bg-ink2 px-2.5 py-1 text-xs text-bright"
              >
                {(Object.keys(t.weightProfiles) as WeightProfileId[]).map((pid) => (
                  <option key={pid} value={pid}>
                    {t.weightProfiles[pid]}
                  </option>
                ))}
              </select>
            </label>

            {/* Selector de modo de misión */}
            <label className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-fog">
                {t.missionModeLabel}:
              </span>
              <select
                aria-label={t.missionModeLabel}
                value={session.missionProfile}
                onChange={(e) =>
                  dispatchTrek({
                    type: "setMissionProfile",
                    profile: e.target.value as MissionProfileId,
                  })
                }
                className="rounded-lg border border-line bg-ink2 px-2.5 py-1 text-xs text-bright"
              >
                <option value="team">Equipo EVA (2 tripulantes)</option>
                <option value="solo">Astronauta Individual (Sim)</option>
                <option value="rover-crew">Rover + Tripulación</option>
                <option value="rover">Rover Autónomo</option>
              </select>
            </label>

            {/* Selector de idioma ES / EN */}
            <div className="flex rounded-lg border border-line bg-ink2 p-0.5">
              {(["es", "en"] as const).map((lng) => (
                <button
                  key={lng}
                  type="button"
                  onClick={() => dispatchTrek({ type: "setLang", lang: lng })}
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase transition-colors active:scale-[0.97] ${
                    state.lang === lng ? "bg-amber text-[#1a0f06]" : "text-fog hover:text-bright"
                  }`}
                >
                  {lng}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cuerpo principal de 3 columnas */}
      <div className="mx-auto grid w-full max-w-[1680px] flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-12">
        {/* COLUMNA IZQUIERDA (3 cols): Capas + Salud */}
        <div className="flex flex-col gap-3 lg:col-span-3">
          {/* Panel de Capas Científicas */}
          <section className="rounded-xl border border-line bg-panel/85 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-bright">
                {t.layersTitle}
              </h2>
              <DataBadge type={siteInfo.dataType} />
            </div>

            <div className="space-y-1">
              {(
                [
                  { id: "elevation", label: t.layers.elevation, badge: siteInfo.dataType },
                  { id: "slope", label: t.layers.slope, badge: "DERIVED" as const },
                  { id: "zones", label: t.layers.zones, badge: "DERIVED" as const },
                  { id: "confidence", label: t.layers.confidence, badge: "DERIVED" as const },
                  { id: "dust", label: t.layers.dust, badge: "MODELLED" as const },
                  { id: "radiation", label: t.layers.radiation, badge: "MODELLED" as const },
                ] as const
              ).map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() =>
                    dispatchTrek({ type: "setActiveLayer", layer: layer.id as MapLayerId })
                  }
                  className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors active:scale-[0.97] ${
                    activeLayer === layer.id
                      ? "border-amber/60 bg-amber/12 text-bright"
                      : "border-line/60 bg-ink2/50 text-fog hover:text-bright"
                  }`}
                >
                  <span className="truncate">{layer.label}</span>
                  <DataBadge type={layer.badge} />
                </button>
              ))}
            </div>

            {/* Casillas de superposición */}
            <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-line/60 pt-2 font-mono text-[10.5px]">
              {(
                [
                  ["zones", "Tramas Z0–Z5"],
                  ["confidence", "Trazo K1–K5"],
                  ["route", "Ruta A*"],
                  ["alternatives", "Alternativas"],
                  ["shelters", "Refugios <>"],
                  ["pois", "POIs Curiosity"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-1.5 rounded border border-line/50 bg-ink2/40 px-2 py-1 text-fog hover:text-bright"
                >
                  <input
                    type="checkbox"
                    checked={visibleOverlays[key]}
                    onChange={() => dispatchTrek({ type: "toggleOverlay", overlay: key })}
                    className="accent-amber-400"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {/* Leyenda de zonas con Texto + Forma + Color */}
            <div className="mt-2.5 border-t border-line/60 pt-2">
              <p className="mb-1 font-mono text-[9.5px] uppercase tracking-wider text-fog">
                Zonas (Texto + Forma + Trama):
              </p>
              <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                {(["Z0", "Z1", "Z2", "Z3", "Z4", "Z5"] as ZoneClass[]).map((z) => {
                  const zv = zoneVisual(z);
                  return (
                    <span
                      key={z}
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${zv.badgeClass}`}
                    >
                      <span>{zv.shapeGlyph}</span>
                      <span className="truncate">{t.zoneLabels[z]}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Capas desacopladas marcadas no_disponible (Restricción #3 del spec) */}
            <details className="mt-2.5 border-t border-line/60 pt-2 font-mono text-[10px] text-fog">
              <summary className="cursor-pointer font-semibold text-fog hover:text-bright">
                {t.unavailableLayersTitle} (3)
              </summary>
              <div className="mt-1.5 space-y-1.5">
                {UNAVAILABLE_DECOUPLED_LAYERS.map((ul) => (
                  <div
                    key={ul.id}
                    className="rounded border border-line/60 bg-ink2/40 p-1.5 text-[9.5px]"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-bright">{ul.title}</span>
                      <span className="rounded border border-line bg-ink px-1.5 py-0.5 text-[8.5px] uppercase text-fog">
                        {ul.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-fog/90">
                      {state.lang === "es" ? ul.reasonEs : ul.reasonEn}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </section>

          {/* Panel de Salud del Astronauta (HUELLA + FSM) */}
          <section className="rounded-xl border border-line bg-panel/85 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-bright">
                {t.healthTitle}
              </h2>
              <DataBadge type="SIMULATED" />
            </div>

            {/* Insignia de estado con tres canales: forma + texto + color */}
            <div
              className={`flex items-center justify-between rounded-lg border px-3 py-2 font-mono text-xs ${hStyle.badgeClass}`}
            >
              <span className="flex items-center gap-2 font-bold">
                <span className="text-base">{hStyle.shapeGlyph}</span>
                <span>
                  {fsm.state} ({t.healthStates[fsm.state]})
                </span>
              </span>
              <span className="text-[10px]">
                máx {envelope.maxSlopeDeg}° · ×{envelope.speedFactor.toFixed(1)}
              </span>
            </div>

            {/* Directiva activa y causas */}
            <div className="mt-2 space-y-1 rounded-lg border border-line/70 bg-ink2/60 p-2 font-mono text-[10.5px]">
              <div className="flex justify-between">
                <span className="text-fog">Directiva meta:</span>
                <span className="font-semibold text-bright">{directive.goalPolicy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fog">Límite pendiente (salud):</span>
                <span className="font-semibold text-amber">{directive.limits.maxSlopeDeg}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fog">Enclavamiento (Latch):</span>
                <span className="font-semibold text-cyan">{fsm.latch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fog">Causas activas:</span>
                <span className="text-bright">
                  {fsm.causes.length > 0 ? fsm.causes.join(", ") : "ninguna (nominal)"}
                </span>
              </div>
            </div>

            {/* Telemetría monoespaciada con minigráficas ASCII */}
            <div className="mt-2 space-y-1 rounded-lg border border-line/70 bg-ink/80 p-2 font-mono text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-fog">Fatiga F:</span>
                <span className="tabular-nums text-bright">
                  [{asciiSparkBar(fsm.fatigueIndex, 0, 1, 8)}] {(fsm.fatigueIndex * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fog">O₂ Primario:</span>
                <span className="tabular-nums text-bright">
                  [{asciiSparkBar(resources.o2PrimaryPsi, 0, 950, 8)}]{" "}
                  {resources.o2PrimaryPsi.toFixed(0)} psi ({resources.o2Source})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fog">Batería Traje:</span>
                <span className="tabular-nums text-bright">
                  [{asciiSparkBar(resources.batteryWh, 0, 500, 8)}] {resources.batteryWh.toFixed(0)}{" "}
                  Wh
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fog">Dosis EVA:</span>
                <span className="tabular-nums text-bright">
                  {(resources.doseEvaMSv * 1000).toFixed(1)} µSv (carrera{" "}
                  {resources.doseCareerMSv.toFixed(1)}/600 mSv)
                </span>
              </div>
            </div>

            {/* Reglas disparadas */}
            {fsm.activeTriggers.length > 0 ? (
              <div className="mt-2 space-y-1">
                {fsm.activeTriggers.map((tr, i) => (
                  <div
                    key={`${tr.ruleId}-${i}`}
                    className="rounded border border-amber/40 bg-amber/10 px-2 py-1 font-mono text-[10px] text-amber"
                  >
                    <strong>{tr.ruleId}</strong> ({tr.level}): {tr.message}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Formulario de confirmación humana obligatoria para salir de CRITICAL / EMERGENCY */}
            {fsm.requiresHumanConfirmation ? (
              <form
                onSubmit={handleHumanAuthorize}
                className="mt-2.5 space-y-2 rounded-lg border border-rose/50 bg-rose/10 p-2.5 font-mono text-[10.5px]"
              >
                <p className="font-semibold text-rose">{t.humanAuthTitle}</p>
                <input
                  type="text"
                  value={authBy}
                  onChange={(e) => setAuthBy(e.target.value)}
                  placeholder={t.humanAuthByPlaceholder}
                  className="w-full rounded border border-line bg-ink px-2 py-1 text-[11px] text-bright"
                  required
                />
                <input
                  type="text"
                  value={authReason}
                  onChange={(e) => setAuthReason(e.target.value)}
                  placeholder={t.humanAuthReasonPlaceholder}
                  className="w-full rounded border border-line bg-ink px-2 py-1 text-[11px] text-bright"
                  required
                />
                <button
                  type="submit"
                  className="w-full rounded bg-amber px-2.5 py-1.5 font-display text-xs font-semibold text-[#1a0f06] transition-transform active:scale-[0.97]"
                >
                  {t.humanAuthButton}
                </button>
              </form>
            ) : null}
          </section>
        </div>

        {/* COLUMNA CENTRAL (5 cols): Mapa 2D interactivo + Ficha de Evidencia + Perfil */}
        <div className="flex flex-col gap-3 lg:col-span-5">
          <section className="flex flex-1 flex-col rounded-xl border border-line bg-panel/85 p-3">
            {/* Barra de herramientas del mapa */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 font-mono text-[10.5px]">
                <span className="mr-1 text-fog">{t.pickModeLabel}:</span>
                {(["goal", "origin", "storm", "inspect"] as MapPickMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => dispatchTrek({ type: "setPickMode", mode: m })}
                    className={`rounded-lg border px-2 py-1 transition-colors active:scale-[0.97] ${
                      pickMode === m
                        ? "border-amber bg-amber/20 text-amber font-semibold"
                        : "border-line bg-ink2 text-fog hover:text-bright"
                    }`}
                  >
                    {t.pickModes[m]}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 font-mono text-[10.5px]">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))))}
                  className="rounded border border-line bg-ink2 px-2 py-0.5 text-bright hover:border-amber/40 active:scale-[0.97]"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <span className="px-1 tabular-nums text-fog">{(zoom * 100).toFixed(0)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                  className="rounded border border-line bg-ink2 px-2 py-0.5 text-bright hover:border-amber/40 active:scale-[0.97]"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="rounded border border-line bg-ink2 px-2 py-0.5 text-fog hover:text-bright active:scale-[0.97]"
                >
                  1:1
                </button>
              </div>
            </div>

            {/* Lienzo del Mapa 2D */}
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-ink">
              <canvas
                ref={canvasRef}
                width={516}
                height={516}
                onClick={handleMapClick}
                onMouseMove={(e) => {
                  const pt = screenToLocal(e.clientX, e.clientY);
                  if (pt) setHoverPoint(pt);
                }}
                onMouseLeave={() => setHoverPoint(null)}
                className="h-full w-full cursor-crosshair"
              />

              {/* HUD de coordenadas planetocéntricas IAU_2015:49900 y métricas locales */}
              <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/80 bg-ink/90 px-2.5 py-1.5 font-mono text-[10px] text-bright backdrop-blur-sm">
                <span>
                  <strong>IAU_2015:49900:</strong> {Math.abs(cursorGeo.lat).toFixed(4)}°S,{" "}
                  {cursorGeo.lon.toFixed(4)}°E
                </span>
                <span>
                  <strong>Local:</strong> X={cursorPoint.x} m, Z={cursorPoint.z} m
                </span>
                <span>
                  <strong>Elev:</strong>{" "}
                  {Number.isNaN(cursorElev) ? "NaN" : `${cursorElev.toFixed(2)} m`} ·{" "}
                  <strong>Pend:</strong>{" "}
                  {Number.isNaN(cursorSlope) ? "NaN" : `${cursorSlope.toFixed(1)}°`}
                </span>
                <span>
                  <strong>Zona:</strong> {cursorZone} · <strong>Conf:</strong> {cursorConf} (
                  {(cursorConfScore * 100).toFixed(0)}%)
                </span>
              </div>
            </div>

            {/* Ficha de Evidencia Científica de la celda seleccionada */}
            <div className="mt-2.5 rounded-lg border border-line/70 bg-ink2/60 p-2.5 font-mono text-[10.5px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-bright">
                  Ficha de Evidencia · Celda ({inspectedPoint.x} m, {inspectedPoint.z} m)
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[9.5px] ${confidenceVisual( snapshot.confidenceAt(inspectedPoint.x, inspectedPoint.z) ).badgeClass}`}
                  >
                    Clase {snapshot.confidenceAt(inspectedPoint.x, inspectedPoint.z)} ( Trazo{" "}
                    {
                      confidenceVisual(snapshot.confidenceAt(inspectedPoint.x, inspectedPoint.z))
                        .strokeStyle
                    }{" "}
                    )
                  </span>
                  <DataBadge type={siteInfo.dataType} />
                </div>
              </div>
              <p className="mt-1 text-fog">
                <strong>Fuente:</strong> {siteInfo.source} · <strong>Resolución:</strong>{" "}
                {siteInfo.resolutionM} m/nodo ({ state.manifest?.meshNodes ?? "TYPE_TILE" }) ·{" "}
                <strong>Captura:</strong> {siteInfo.capturedDate} ({siteInfo.solRange})
              </p>
            </div>
          </section>
        </div>

        {/* COLUMNA DERECHA (4 cols): Ruta Activa + Barra de Porqués + Alternativas + Recursos */}
        <div className="flex flex-col gap-3 lg:col-span-4">
          {/* Ruta Activa y Envolvente */}
          <section className="rounded-xl border border-line bg-panel/85 p-3" aria-live="polite">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-bright">
                {t.activeRouteTitle}
              </h2>
              <DataBadge type="MODELLED" />
            </div>

            {proposedRoute ? (
              <div className="mb-2.5 flex items-center justify-between gap-2 rounded-lg border border-amber/60 bg-amber/15 p-2 font-mono text-[11px] text-amber">
                <span>Nueva ruta propuesta (&gt; 10 % mejora de costo).</span>
                <button
                  type="button"
                  onClick={() => dispatchTrek({ type: "acceptProposedRoute" })}
                  className="rounded bg-amber px-2.5 py-1 font-semibold text-[#1a0f06] active:scale-[0.97]"
                >
                  {t.acceptProposalButton}
                </button>
              </div>
            ) : null}

            {routeResult.ok && activeRoute ? (
              <>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <div className="rounded-lg border border-line/70 bg-ink2/60 p-2">
                    <p className="text-[9px] uppercase text-fog">Distancia 3D</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-bright">
                      {activeRoute.distanceM.toFixed(0)} m
                    </p>
                  </div>
                  <div className="rounded-lg border border-line/70 bg-ink2/60 p-2">
                    <p className="text-[9px] uppercase text-fog">Duración (+25%)</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-bright">
                      {(activeRoute.durationMin * 1.25).toFixed(1)} min
                    </p>
                  </div>
                  <div className="rounded-lg border border-line/70 bg-ink2/60 p-2">
                    <p className="text-[9px] uppercase text-fog">Pendiente Máx</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-amber">
                      {activeRoute.maxSlopeDeg.toFixed(1)}° / {envelope.maxSlopeDeg}°
                    </p>
                  </div>
                  <div className="rounded-lg border border-line/70 bg-ink2/60 p-2">
                    <p className="text-[9px] uppercase text-fog">O₂ Estimado</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-mint">
                      {(activeRoute.o2Kg * 1000).toFixed(1)} g
                    </p>
                  </div>
                  <div className="rounded-lg border border-line/70 bg-ink2/60 p-2">
                    <p className="text-[9px] uppercase text-fog">Dosis Ruta</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-cyan">
                      {activeRoute.doseUSv.toFixed(2)} µSv
                    </p>
                  </div>
                  <div className="rounded-lg border border-line/70 bg-ink2/60 p-2">
                    <p className="text-[9px] uppercase text-fog">Costo Equiv.</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-bright">
                      {activeRoute.equivalentCostM.toFixed(0)} m-eq
                    </p>
                  </div>
                </div>

                {/* Barra de Porqués (D, T, R, E, U, H suman 100 %) */}
                <div className="mt-3 border-t border-line/60 pt-2.5">
                  <div className="mb-1.5 flex items-center justify-between font-mono text-[10.5px]">
                    <span className="font-semibold text-bright">{t.whyThisRouteTitle}</span>
                    <span className="text-fog">Σ = 100 %</span>
                  </div>

                  {/* Barra segmentada */}
                  <div className="flex h-3 w-full overflow-hidden rounded-full border border-line bg-ink">
                    {whySegments.map((seg) =>
                      seg.pct > 0 ? (
                        <div
                          key={seg.term}
                          style={{ width: `${seg.pct}%`, backgroundColor: seg.colorHex }}
                          title={`${seg.term}: ${seg.pct.toFixed(1)}% (${seg.metersEq.toFixed(1)} m-eq)`}
                        />
                      ) : null,
                    )}
                  </div>

                  {/* Desglose tabular monoespaciado */}
                  <div className="mt-2 space-y-1 font-mono text-[10px]">
                    {whySegments.map((seg) => (
                      <div key={seg.term} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-fog">
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: seg.colorHex }}
                          />
                          <strong className="text-bright">{seg.term}</strong> ·{" "}
                          {t.costTerms[seg.term as CostTermId].label}
                        </span>
                        <span className="tabular-nums text-bright">
                          {seg.metersEq.toFixed(1)} m-eq ({seg.pct.toFixed(1)} %)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Por qué no la línea directa */}
                {routeResult.explanation.blockedDirectPath.length > 0 ? (
                  <div className="mt-2.5 border-t border-line/60 pt-2 font-mono text-[10px]">
                    <p className="font-semibold text-amber">{t.directPathBlockedTitle}:</p>
                    <ul className="mt-1 space-y-1 text-fog">
                      {routeResult.explanation.blockedDirectPath.map((b, idx) => (
                        <li key={idx} className="rounded border border-amber/30 bg-amber/8 px-2 py-1">
                          • <strong>[{b.kind.toUpperCase()}]</strong> {b.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Botón para exportar al planificador de misión */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportToMission}
                    className="w-full rounded-lg bg-amber px-3 py-1.5 font-display text-xs font-semibold text-[#1a0f06] transition-transform active:scale-[0.97]"
                  >
                    {t.exportToMissionButton}
                  </button>
                </div>
                {exportedNotice ? (
                  <p className="mt-1 font-mono text-[10px] text-mint">
                    ✓ Ruta sincronizada con Mission Planner / Simulator (`setEvaPlan`).
                  </p>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-rose/50 bg-rose/12 p-3 font-mono text-xs text-rose">
                <p className="font-bold">
                  SIN RUTA ADMISIBLE ({!routeResult.ok ? routeResult.reason : "bloqueada"})
                </p>
                <p className="mt-1 text-[11px]">
                  {!routeResult.ok ? routeResult.message : "Restricción de seguridad activa."}
                </p>
                {!routeResult.ok && routeResult.suggestions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {routeResult.suggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          dispatchTrek({
                            type: "simEvent",
                            event: { kind: "set-goal", goal: sug, simulated: false },
                          })
                        }
                        className="rounded border border-mint/50 bg-mint/15 px-2 py-0.5 text-[10px] text-mint active:scale-[0.97]"
                      >
                        Usar destino sugerido ({sug.x}, {sug.z})
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {/* Comparación de Alternativas y Margen de Regreso */}
          <section className="rounded-xl border border-line bg-panel/85 p-3">
            <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-bright">
              {t.alternativesTitle}
            </h2>

            {routeResult.ok && routeResult.explanation.alternatives.length > 0 ? (
              <div className="space-y-1.5 font-mono text-[10.5px]">
                {routeResult.explanation.alternatives.map((alt) => (
                  <div
                    key={alt.id}
                    className={`rounded-lg border p-2 ${
                      alt.status === "discarded"
                        ? "border-rose/45 bg-rose/10 text-rose"
                        : "border-line/70 bg-ink2/60 text-bright"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{alt.label}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${
                          alt.status === "discarded"
                            ? "bg-rose/25 text-rose"
                            : "bg-mint/15 text-mint"
                        }`}
                      >
                        {alt.status === "discarded" ? "DESCARTADA" : "ADMISIBLE"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-fog">{alt.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-mono text-[10.5px] text-fog">
                No hay corredores alternativos distintos para la envolvente actual.
              </p>
            )}

            {/* Margen de regreso (walkback) */}
            {routeResult.ok ? (
              <div className="mt-3 border-t border-line/60 pt-2 font-mono text-[10.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-fog">{t.resourcesTitle}:</span>
                  <span
                    className={`font-bold tabular-nums ${
                      routeResult.resourcePlan.returnMarginMin < 0
                        ? "text-rose"
                        : routeResult.resourcePlan.returnMarginPct < 20
                          ? "text-amber"
                          : "text-mint"
                    }`}
                  >
                    {routeResult.resourcePlan.returnMarginMin.toFixed(0)} min (
                    {routeResult.resourcePlan.returnMarginPct.toFixed(0)} %)
                  </span>
                </div>
                <p className="mt-0.5 text-[9.5px] text-fog">
                  Consumible limitante: <strong>{resources.limiting.resource.toUpperCase()}</strong>{" "}
                  ({resources.limiting.minutes.toFixed(0)} min restantes · reserva O₂ sec 30 min).
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {/* CONSOLA INFERIOR DE SIMULACIÓN Y LÍNEA DE TIEMPO */}
      <div className="border-t border-line bg-panel/90 px-4 py-3">
        <div className="mx-auto max-w-[1680px] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-bright">
                {t.simConsoleTitle}
              </h2>
              <span className="rounded bg-ink2 px-2 py-0.5 font-mono text-[10.5px] tabular-nums text-cyan">
                T+{session.clockS} s
              </span>
              <DataBadge type="SIMULATED" />
            </div>

            {/* Controles rápidos de escenarios deterministas */}
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]">
              {TREK_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    if (state.siteId !== sc.siteId) {
                      dispatchTrek({ type: "setSiteLoading", siteId: sc.siteId });
                    }
                    dispatchTrek({ type: "runScenarioStep", scenarioId: sc.id });
                  }}
                  className="rounded-lg border border-cyan/40 bg-cyan/10 px-2.5 py-1 text-cyan hover:bg-cyan/20 active:scale-[0.97]"
                >
                  ▶ {state.lang === "es" ? sc.titleEs.split("·")[0] : sc.titleEn.split("·")[0]} (
                  {sc.id === "demo-fatigue-corridors"
                    ? "Fatiga A→B"
                    : sc.id === "demo-storm-and-sep"
                      ? "Tormenta+SEP"
                      : sc.id === "demo-simultaneous-stress"
                        ? "Triple Contingencia"
                        : "Corte Sensores"}
                  )
                </button>
              ))}
            </div>
          </div>

          {/* Botonera de inyección manual de eventos */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]">
            <button
              type="button"
              onClick={() => dispatchTrek({ type: "simTick", dtS: 60 })}
              className="rounded border border-line bg-ink2 px-2.5 py-1 text-bright hover:border-amber/40 active:scale-[0.97]"
            >
              ⏱ +60 s Marcha
            </button>
            <button
              type="button"
              onClick={() =>
                dispatchTrek({
                  type: "simEvent",
                  event: { kind: "health-incident", incident: "fatiga_progresiva", simulated: true },
                })
              }
              className="rounded border border-cyan/40 bg-cyan/10 px-2.5 py-1 text-cyan active:scale-[0.97]"
            >
              + Fatiga (15°)
            </button>
            <button
              type="button"
              onClick={() =>
                dispatchTrek({
                  type: "simEvent",
                  event: { kind: "health-incident", incident: "estres_termico", simulated: true },
                })
              }
              className="rounded border border-amber/40 bg-amber/10 px-2.5 py-1 text-amber active:scale-[0.97]"
            >
              + Estrés Térmico (10°)
            </button>
            <button
              type="button"
              onClick={() =>
                dispatchTrek({
                  type: "simEvent",
                  event: { kind: "health-incident", incident: "falla_ventilador", simulated: true },
                })
              }
              className="rounded border border-rose/40 bg-rose/10 px-2.5 py-1 text-rose active:scale-[0.97]"
            >
              + Falla Ventilador (CRITICAL)
            </button>
            <button
              type="button"
              onClick={() =>
                dispatchTrek({
                  type: "simEvent",
                  event: { kind: "health-incident", incident: "emergencia_medica", simulated: true },
                })
              }
              className="rounded border border-rose/60 bg-rose/20 px-2.5 py-1 font-semibold text-rose active:scale-[0.97]"
            >
              + Emergencia Médica (EMERGENCY)
            </button>
            <button
              type="button"
              onClick={() =>
                dispatchTrek({
                  type: "simEvent",
                  event: { kind: "health-incident", incident: "perdida_sensores", simulated: true },
                })
              }
              className="rounded border border-amber/40 bg-amber/10 px-2.5 py-1 text-amber active:scale-[0.97]"
            >
              + Corte Sensores (SEN-04)
            </button>
            <button
              type="button"
              onClick={() =>
                dispatchTrek({
                  type: "simEvent",
                  event: {
                    kind: "sep-alert",
                    active: !session.sepAlertActive,
                    doseRateMultiplier: 4,
                    simulated: true,
                  },
                })
              }
              className={`rounded border px-2.5 py-1 active:scale-[0.97] ${
                session.sepAlertActive
                  ? "border-rose bg-rose text-[#180609] font-bold"
                  : "border-line bg-ink2 text-fog hover:text-bright"
              }`}
            >
              ☀ Alerta Solar SEP: {session.sepAlertActive ? "ACTIVA" : "OFF"}
            </button>
            <button
              type="button"
              onClick={() =>
                dispatchTrek({
                  type: "simEvent",
                  event: { kind: "battery-drop", dropPct: 25, simulated: true },
                })
              }
              className="rounded border border-line bg-ink2 px-2.5 py-1 text-fog hover:text-bright active:scale-[0.97]"
            >
              🔋 Batería −25 %
            </button>
            <button
              type="button"
              onClick={() => dispatchTrek({ type: "clearStorms" })}
              className="rounded border border-line bg-ink2 px-2.5 py-1 text-fog hover:text-bright active:scale-[0.97]"
            >
              {t.clearStormsButton}
            </button>
            <button
              type="button"
              onClick={() => dispatchTrek({ type: "resetSession" })}
              disabled={isHumanLockActive(state)}
              title={isHumanLockActive(state) ? "Bloqueado hasta registrar la confirmación humana" : undefined}
              className="ml-auto rounded border border-line bg-ink2 px-2.5 py-1 text-bright hover:border-amber/40 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↺ {t.resetSessionButton}
            </button>
          </div>

          {/* Bitácora reciente de replanificación y transiciones de salud */}
          {session.replanLog.length > 0 || fsm.history.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 border-t border-line/60 pt-2 font-mono text-[10px] md:grid-cols-2">
              <div className="rounded border border-line/60 bg-ink/70 p-2">
                <p className="font-semibold text-cyan">Bitácora de Replanificación A*:</p>
                <div className="mt-1 max-h-20 space-y-0.5 overflow-y-auto text-fog">
                  {session.replanLog
                    .slice(-4)
                    .reverse()
                    .map((r) => (
                      <p key={r.seq}>
                        <strong className="text-bright">#{r.seq}</strong> [{r.decision.toUpperCase()}] (
                        {r.causes.join(", ")}): {r.summary}
                      </p>
                    ))}
                </div>
              </div>
              <div className="rounded border border-line/60 bg-ink/70 p-2">
                <p className="font-semibold text-amber">
                  Registro de Transiciones de Salud y Confirmaciones:
                </p>
                <div className="mt-1 max-h-20 space-y-0.5 overflow-y-auto text-fog">
                  {fsm.history.length === 0 ? (
                    <p>Sin transiciones registradas (estado inicial NORMAL).</p>
                  ) : (
                    fsm.history
                      .slice(-4)
                      .reverse()
                      .map((h) => (
                        <p key={h.seq}>
                          <strong className="text-bright">
                            {h.from} → {h.to}
                          </strong>{" "}
                          (T+{h.missionTimeS}s · causas: {h.causes.join(",") || "ninguna"})
                          {h.humanConfirmed
                            ? ` · Autorizado por ${h.humanConfirmed.by}: "${h.humanConfirmed.justification}"`
                            : ""}
                        </p>
                      ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
