/**
 * MarsWalk · Plano isométrico de la pestaña 03 de mars-space-rockstars (.iso), conectado al motor:
 * el plano es el ráster real del sitio con la ruta A* activa; etiquetas y astronauta van contrarrotados.
 * El astronauta se dibuja en `session.origin` (posición que usa el motor), nunca en una posición inventada.
 */
import { useEffect, useMemo, useRef } from "react";
import { healthRank, type LocalPoint } from "@/core/trek/contracts";
import { useTrek } from "@/state/trekStore";
import { MW_TEXTS } from "./i18n";
import { buildRaster, CANVAS_PX, drawScene, toUV } from "./mapRender";

export function IsoMap() {
  const state = useTrek();
  const t = MW_TEXTS[state.lang];
  const { session, activeLayer, visibleOverlays, siteInfo } = state;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Tamaño del plano: misma heurística que sizeIso() del front (huella ≈ 1.25·w × 0.67·w)
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      const w = Math.max(180, Math.min(r.width / 1.4, r.height / 0.86));
      el.style.setProperty("--w", `${Math.round(w)}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const raster = useMemo(
    () => buildRaster(session, activeLayer, visibleOverlays.zones),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.snapshot, activeLayer, visibleOverlays.zones, session.envelope.maxSlopeDeg],
  );

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, raster, session, {
      zoom: 1,
      panX: 0,
      panY: 0,
      overlays: visibleOverlays,
      pois: siteInfo.pois,
      inspected: null,
      labels: false,
    });
  }, [raster, session, visibleOverlays, siteInfo.pois]);

  const pos = (p: LocalPoint) => {
    const [u, v] = toUV(session, p);
    return { left: `${(u * 100).toFixed(2)}%`, top: `${(v * 100).toFixed(2)}%` };
  };
  const elevAt = (p: LocalPoint) => {
    const e = session.snapshot.sample("elevation", p.x, p.z);
    return Number.isNaN(e) ? null : e;
  };
  const goalElev = elevAt(session.goal);
  const originElev = elevAt(session.origin);
  const dz = goalElev !== null && originElev !== null ? goalElev - originElev : null;
  const offNominal = healthRank(session.fsm.state) >= healthRank("CAUTION");

  return (
    <div className="iso" ref={boxRef}>
      <div className="iso__base" aria-hidden="true" />
      <div className="iso__plane">
        <canvas
          ref={canvasRef}
          className="iso__svg"
          width={CANVAS_PX}
          height={CANVAS_PX}
          aria-hidden="true"
        />
        <div className="iso__labels">
          <span className="iso-lbl" style={pos(session.origin)}>
            {t.pick.origin.toUpperCase()}
          </span>
          <span className="iso-lbl" style={pos(session.goal)}>
            {t.pick.goal.toUpperCase()}
            {dz !== null ? (
              <small>
                {dz > 0 ? "+" : ""}
                {dz.toFixed(1)} m
              </small>
            ) : null}
          </span>
          {visibleOverlays.shelters
            ? session.shelters
                .filter(
                  (s) => Math.hypot(s.point.x - session.origin.x, s.point.z - session.origin.z) > 4,
                )
                .map((s) => (
                  <span key={s.id} className="iso-lbl iso-lbl--shelter" style={pos(s.point)}>
                    ◆ {s.kind.toUpperCase()}
                  </span>
                ))
            : null}
          {session.storms
            .filter((s) => s.active)
            .map((s) => (
              <span key={s.id} className="iso-lbl iso-lbl--storm" style={pos(s.center)}>
                {state.lang === "es" ? "TORMENTA DE POLVO" : "DUST STORM"} · SIM
              </span>
            ))}
        </div>
        <div className={`iso__astro${offNominal ? " is-off" : ""}`} style={pos(session.origin)}>
          <span className="iso__astro-ring" />
          <span className="iso__astro-pin">
            <span className="iso__astro-tag t-label">EVA1</span>
          </span>
        </div>
      </div>
    </div>
  );
}
