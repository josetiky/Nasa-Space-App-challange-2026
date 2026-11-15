/**
 * MarsWalk · Panel "Área de trabajo" de la pestaña 02 de mars-space-rockstars, conectado al motor.
 * Reemplaza el SVG sobre jezero-base.jpg por el ráster real del sitio de Gale (session.snapshot) y la
 * ruta de ejemplo por la ruta A* activa. Zoom con rueda/botones, arrastre para desplazar y clic según
 * pickMode → dispatchTrek. No calcula rutas, zonas ni costos.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalPoint } from "@/core/trek/contracts";
import { dispatchTrek, trekStore, useTrek, type MapPickMode } from "@/state/trekStore";
import { layerProvenance, MAP_LAYER_IDS } from "../layerCatalog";
import { TREK_TEXTS } from "../i18n";
import { localToPlanetocentric } from "../viewHelpers";
import { DECK_TEXTS } from "./deckText";
import { MW_TEXTS } from "./i18n";
import { buildRaster, CANVAS_PX, drawScene, toUV } from "./mapRender";
import { onRouteComputed } from "./routeBus";
import { formatLatLon, niceGridStep } from "./model";
import { ConfChip, ProvChip } from "./ui";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

interface View {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

const IDENTITY: View = { zoom: 1, panX: 0, panY: 0 };

function clampView(v: View): View {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom));
  const minPan = CANVAS_PX - CANVAS_PX * zoom;
  return {
    zoom,
    panX: Math.max(minPan, Math.min(0, v.panX)),
    panY: Math.max(minPan, Math.min(0, v.panY)),
  };
}

const PICK_ICONS: Readonly<Record<MapPickMode, React.ReactNode>> = {
  inspect: <path d="M4 2.5l8 5-3.6.8L6.7 12z" />,
  origin: (
    <>
      <circle cx="8" cy="8" r="4.5" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  goal: (
    <>
      <path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z" />
      <circle cx="8" cy="6.5" r="1.6" />
    </>
  ),
  storm: (
    <path d="M2.5 6.5c2-2 4-2 6 0s4 2 5 0M2.5 9.5c2-2 4-2 6 0s4 2 5 0M4 12.5c1.5-1.2 3-1.2 4.5 0" />
  ),
};

export function MarsWalkMap() {
  const state = useTrek();
  const t = MW_TEXTS[state.lang];
  const d = DECK_TEXTS[state.lang];
  const tt = TREK_TEXTS[state.lang];
  const {
    session,
    siteInfo,
    activeLayer,
    visibleOverlays,
    pickMode,
    inspectedPoint,
    loadingTile,
    loadError,
  } = state;
  const { snapshot, routeResult: rr } = session;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<View>(IDENTITY);
  const [hover, setHover] = useState<LocalPoint | null>(null);
  const [cssWidth, setCssWidth] = useState(CANVAS_PX);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => setView(IDENTITY), [siteInfo.id]);

  // "Calcular ruta óptima": encuadrar ruta + origen + destino (la tarjeta vive en la columna izquierda)
  useEffect(
    () =>
      onRouteComputed(() => {
        const s = trekStore.getState().session;
        const pts = [s.origin, s.goal, ...(s.activeRoute?.points ?? [])];
        const uv = pts.map((p) => toUV(s, p));
        const us = uv.map((q) => q[0]);
        const vs = uv.map((q) => q[1]);
        const minU = Math.min(...us);
        const maxU = Math.max(...us);
        const minV = Math.min(...vs);
        const maxV = Math.max(...vs);
        const span = Math.max(0.04, maxU - minU, maxV - minV);
        const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, 0.62 / span));
        const cu = ((minU + maxU) / 2) * CANVAS_PX;
        const cv = ((minV + maxV) / 2) * CANVAS_PX;
        setView(
          clampView({ zoom, panX: CANVAS_PX / 2 - cu * zoom, panY: CANVAS_PX / 2 - cv * zoom }),
        );
      }),
    [],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setCssWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const raster = useMemo(
    () => buildRaster(session, activeLayer, visibleOverlays.zones),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, activeLayer, visibleOverlays.zones, session.envelope.maxSlopeDeg],
  );

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, raster, session, {
      ...view,
      overlays: visibleOverlays,
      pois: siteInfo.pois,
      inspected: inspectedPoint,
      labels: true,
    });
  }, [raster, session, view, visibleOverlays, siteInfo.pois, inspectedPoint]);

  const { x0, z0, nx, nz, cell } = snapshot.grid;
  const extentX = (nx - 1) * cell;

  const screenToLocal = (clientX: number, clientY: number): LocalPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cx = ((clientX - rect.left) / rect.width) * CANVAS_PX;
    const cy = ((clientY - rect.top) / rect.height) * CANVAS_PX;
    const u = (cx - view.panX) / view.zoom / CANVAS_PX;
    const v = (cy - view.panY) / view.zoom / CANVAS_PX;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    const i = Math.round(u * (nx - 1));
    const j = Math.round((1 - v) * (nz - 1));
    return { x: Number((x0 + i * cell).toFixed(2)), z: Number((z0 + j * cell).toFixed(2)) };
  };

  const applyPick = (pt: LocalPoint) => {
    dispatchTrek({ type: "inspectPoint", point: pt });
    if (pickMode === "origin") {
      dispatchTrek({
        type: "simEvent",
        event: { kind: "set-origin", origin: pt, simulated: false },
      });
    } else if (pickMode === "goal") {
      dispatchTrek({ type: "simEvent", event: { kind: "set-goal", goal: pt, simulated: false } });
    } else if (pickMode === "storm") {
      dispatchTrek({
        type: "simEvent",
        event: {
          kind: "storm-appear",
          storm: {
            id: `storm-${Date.now().toString(36)}`,
            name: `Tormenta (${pt.x}, ${pt.z})`,
            center: pt,
            radiusM: Math.max(6, Math.round(extentX * 0.12)),
            tau: 2.6,
            active: true,
            dataType: "SIMULATED",
          },
          simulated: true,
        },
      });
    }
  };

  const zoomAt = (factor: number, cx = CANVAS_PX / 2, cy = CANVAS_PX / 2) => {
    setView((v) => {
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * factor));
      const k = zoom / v.zoom;
      return clampView({ zoom, panX: cx - (cx - v.panX) * k, panY: cy - (cy - v.panY) * k });
    });
  };

  // Rueda: listener no pasivo para que el zoom no desplace la cubierta
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * CANVAS_PX;
      const cy = ((e.clientY - rect.top) / rect.height) * CANVAS_PX;
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, cx, cy);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const cursor = hover ?? inspectedPoint;
  const geo = localToPlanetocentric(cursor, siteInfo.coord);
  const elev = snapshot.sample("elevation", cursor.x, cursor.z);
  const slope = snapshot.sample("slopeDeg", cursor.x, cursor.z);
  const zone = snapshot.zoneAt(cursor.x, cursor.z);
  const conf = snapshot.confidenceAt(cursor.x, cursor.z);

  const metersPerCssPx = extentX / (cssWidth * view.zoom);
  const scaleM = niceGridStep(metersPerCssPx * 56, 1);
  const scalePx = scaleM / metersPerCssPx;
  const layerName = tt.layers[activeLayer];

  const showCard = loadingTile || !!loadError || !rr.ok;

  return (
    <>
      <header className="mw__bar">
        <p className="t-label">
          {d.workspace} · <b>{siteInfo.name}</b>
        </p>
        <div className="mw__tools">
          <span className="link-status" title={siteInfo.source}>
            <span className="chip__dot" aria-hidden="true" />
            {d.engineLink}
          </span>
          {(["inspect", "origin", "goal", "storm"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className="icon-btn"
              aria-pressed={pickMode === m}
              aria-label={`${t.pick[m]} · ${tt.pickModes[m]}`}
              title={`${t.pick[m]} · ${tt.pickModes[m]}`}
              onClick={() => dispatchTrek({ type: "setPickMode", mode: m })}
            >
              <svg viewBox="0 0 16 16">{PICK_ICONS[m]}</svg>
              <span className="icon-btn__label">{t.pick[m]}</span>
            </button>
          ))}
          <button
            type="button"
            className="icon-btn"
            onClick={() => zoomAt(1.25)}
            aria-label={t.zoomIn}
            title={t.zoomIn}
          >
            <svg viewBox="0 0 16 16">
              <path d="M8 3.5v9M3.5 8h9" />
            </svg>
            <span className="icon-btn__label">{t.zoomIn}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => zoomAt(1 / 1.25)}
            aria-label={t.zoomOut}
            title={t.zoomOut}
          >
            <svg viewBox="0 0 16 16">
              <path d="M3.5 8h9" />
            </svg>
            <span className="icon-btn__label">{t.zoomOut}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setView(IDENTITY)}
            aria-label={t.zoomReset}
            title={t.zoomReset}
          >
            <svg viewBox="0 0 16 16">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.7-4" />
              <path d="M13.5 2.5v3h-3" />
            </svg>
            <span className="icon-btn__label">{t.zoomReset}</span>
          </button>
        </div>
      </header>

      <div ref={wrapRef} className={`mw__map${dragging ? " is-dragging" : ""}`}>
        <canvas
          ref={canvasRef}
          className="mw__canvas"
          width={CANVAS_PX}
          height={CANVAS_PX}
          role="img"
          aria-label={`${siteInfo.name} · ${layerName}`}
          data-pick={pickMode}
          onPointerDown={(e) => {
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            dragRef.current = {
              x: e.clientX,
              y: e.clientY,
              panX: view.panX,
              panY: view.panY,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            const dr = dragRef.current;
            if (dr) {
              const dx = e.clientX - dr.x;
              const dy = e.clientY - dr.y;
              if (!dr.moved && Math.hypot(dx, dy) > 4 && view.zoom > 1) {
                dr.moved = true;
                setDragging(true);
              }
              if (dr.moved) {
                const k = CANVAS_PX / Math.max(1, cssWidth);
                setView((v) =>
                  clampView({ zoom: v.zoom, panX: dr.panX + dx * k, panY: dr.panY + dy * k }),
                );
                return;
              }
            }
            const pt = screenToLocal(e.clientX, e.clientY);
            if (pt) setHover(pt);
          }}
          onPointerUp={(e) => {
            const dr = dragRef.current;
            dragRef.current = null;
            setDragging(false);
            if (dr && !dr.moved) {
              const pt = screenToLocal(e.clientX, e.clientY);
              if (pt) applyPick(pt);
            }
          }}
          onPointerLeave={() => setHover(null)}
        />
        <div className="mw__scan" aria-hidden="true" />

        <div className="mw__hud mw__hud--tl">
          <label className="t-label mw__layer">
            <select
              aria-label={t.layersTitle}
              value={activeLayer}
              onChange={(e) =>
                dispatchTrek({
                  type: "setActiveLayer",
                  layer: e.target.value as typeof activeLayer,
                })
              }
            >
              {MAP_LAYER_IDS.map((id) => (
                <option key={id} value={id}>
                  {tt.layers[id]}
                </option>
              ))}
            </select>
          </label>
          <ProvChip type={layerProvenance(activeLayer, state)} />
        </div>

        <div className="mw__hud mw__hud--probe t-label">
          {t.local} X <b>{cursor.x}</b> · Z <b>{cursor.z}</b> m · {t.elev}{" "}
          <b>{Number.isNaN(elev) ? "NaN" : `${elev.toFixed(1)} m`}</b> · {t.slope}{" "}
          <b>{Number.isNaN(slope) ? "NaN" : `${slope.toFixed(1)}°`}</b> · <b>{zone}</b>{" "}
          <ConfChip cls={conf} />
        </div>

        {showCard ? (
          <div className="mw__card glass">
            <pre className="mw__ascii" aria-hidden="true">
              {loadingTile || loadError
                ? `${d.routeLoading}\n| f32 ···> GRID ···> A* |\n---`
                : `${d.routeDraft}\n| ${t.pick.origin.toUpperCase()} ···> ✕ ···> ${t.pick.goal.toUpperCase()} |\n---`}
            </pre>
            <span className={`chip ${loadError || !rr.ok ? "chip--crit" : "chip--mars"}`}>
              <span className="chip__dot" />{" "}
              {loadError ? t.error : loadingTile ? t.loading : rr.ok ? "" : rr.reason}
            </span>
            <p>
              {loadError
                ? `${t.loadError}: ${loadError}`
                : loadingTile
                  ? siteInfo.source
                  : rr.ok
                    ? ""
                    : rr.message}
            </p>
            {!loadingTile && !loadError && !rr.ok && rr.suggestions.length > 0 ? (
              <div className="mw__tools" style={{ justifyContent: "center" }}>
                {rr.suggestions.slice(0, 2).map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() =>
                      dispatchTrek({
                        type: "simEvent",
                        event: { kind: "set-goal", goal: s, simulated: false },
                      })
                    }
                  >
                    {t.useSuggestion} ({Number(s.x.toFixed(1))}, {Number(s.z.toFixed(1))})
                  </button>
                ))}
              </div>
            ) : null}
            {!loadingTile && !loadError && !rr.ok ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => dispatchTrek({ type: "setPickMode", mode: "origin" })}
              >
                {t.pick.origin} →
              </button>
            ) : null}
          </div>
        ) : null}

        <p className="mw__coords t-label">{formatLatLon(geo)} · IAU_2015:49900</p>
        <p className="mw__scale t-label">
          <span style={{ width: `${Math.round(scalePx)}px` }} aria-hidden="true" />
          {scaleM >= 1 ? `${scaleM} m` : `${(scaleM * 100).toFixed(0)} cm`}
        </p>
      </div>
    </>
  );
}
