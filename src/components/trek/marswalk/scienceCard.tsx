/**
 * MarsWalk · Ciencia en la ruta (solo presentación).
 *
 * El reto pide que el mapa ayude a "hacer ciencia nueva por el camino" y que muestre imágenes
 * de punto de vista del destino. Esta tarjeta lista los objetivos científicos reales del sitio
 * (POIs de Curiosity, de Access Mars) con su foto, dice cuáles quedan sobre la ruta planeada y
 * a cuántos metros de desvío están los demás, y permite fijar uno como destino.
 *
 * No añade reglas al motor: lee siteInfo.pois y session.activeRoute, y solo emite el mismo
 * evento set-goal que KnownPoints.
 */
import { useMemo, useState } from "react";
import type { LocalPoint } from "@/core/trek/contracts";
import { planRoute } from "@/core/trek/routing/planner";
import { EVA_SITES } from "@/data/evaSites";
import { dispatchTrek, isHumanLockActive, useTrek } from "@/state/trekStore";
import { ProvChip } from "./ui";

/** Radio para contar un objetivo como "en la ruta": alcance visual y de muestreo a pie. [diseño] */
export const ON_ROUTE_RADIUS_M = 5;

/** Distancia horizontal mínima (m) de un punto a una polilínea. NaN si la polilínea está vacía. */
export function distanceToRouteM(p: LocalPoint, pts: readonly LocalPoint[]): number {
  if (pts.length === 0) return Number.NaN;
  let best = Math.hypot(p.x - pts[0]!.x, p.z - pts[0]!.z);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)));
  }
  return best;
}

/** Tiempo de trabajo con el que entra un objetivo añadido como parada. [diseño] */
export const DEFAULT_POI_DWELL_MIN = 30;

/** Radio máximo para buscar dónde pararse junto a un objetivo que está en terreno prohibido. [diseño] */
export const APPROACH_SEARCH_M = 12;
/** Candidatos que se comprueban con el motor por objetivo (cada uno es una búsqueda A*). [diseño] */
export const APPROACH_MAX_PROBES = 10;

/**
 * Muchos objetivos están en la cara de una mesa (40°+): no se pueden pisar, se observan desde abajo.
 * Devuelve el punto de observación más cercano al objetivo, o null si no hay ninguno a
 * APPROACH_SEARCH_M. Un candidato debe (1) tener su celda y sus 8 vecinas dentro del límite de
 * pendiente y fuera de Z4/Z5, y (2) pasar `reachable`, que es el propio planificador A* desde el
 * origen: así nunca se propone una "isla" pisable a la que no se puede llegar.
 */
export function approachPoint(
  target: LocalPoint,
  maxSlopeDeg: number,
  slopeAt: (x: number, z: number) => number,
  zoneAt: (x: number, z: number) => string,
  reachable: (p: LocalPoint) => boolean,
): LocalPoint | null {
  const flat = (x: number, z: number) => {
    const zone = zoneAt(x, z);
    if (zone === "Z4" || zone === "Z5") return false;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const s = slopeAt(x + dx, z + dz);
        if (!(s <= maxSlopeDeg)) return false; // NaN (sin dato) tampoco pasa
      }
    }
    return true;
  };
  const cx = Math.round(target.x);
  const cz = Math.round(target.z);
  const candidates: Array<{ p: LocalPoint; d: number }> = [];
  for (let dx = -APPROACH_SEARCH_M; dx <= APPROACH_SEARCH_M; dx++) {
    for (let dz = -APPROACH_SEARCH_M; dz <= APPROACH_SEARCH_M; dz++) {
      const p = { x: cx + dx, z: cz + dz };
      const d = Math.hypot(p.x - target.x, p.z - target.z);
      if (d <= APPROACH_SEARCH_M && flat(p.x, p.z)) candidates.push({ p, d });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  // Se prueban candidatos repartidos de cerca a lejos, no solo los 10 más cercanos (que suelen
  // ser la misma isla): paso proporcional al número de candidatos.
  const step = Math.max(1, Math.ceil(candidates.length / APPROACH_MAX_PROBES));
  for (let i = 0; i < candidates.length; i += step) {
    if (reachable(candidates[i]!.p)) return candidates[i]!.p;
  }
  return null;
}

export function ScienceTargets() {
  const state = useTrek();
  const es = state.lang === "es";
  const { siteInfo, session } = state;
  const locked = isHumanLockActive(state);
  const [openId, setOpenId] = useState<string | null>(null);

  const images = useMemo(() => {
    const site = EVA_SITES.find((s) => s.id === siteInfo.id);
    return new Map((site?.pois ?? []).map((p) => [p.id, p.image]));
  }, [siteInfo.id]);

  const route = session.activeRoute;
  const { snapshot, envelope, origin, missionProfile, weightProfile, vehicle, resources } = session;
  const maxSlope = envelope.maxSlopeDeg;
  const rows = useMemo(
    () =>
      siteInfo.pois
        .map((poi) => {
          const stand = approachPoint(
            poi.point,
            maxSlope,
            (x, z) => snapshot.sample("slopeDeg", x, z),
            (x, z) => snapshot.zoneAt(x, z),
            (goal) =>
              planRoute(
                {
                  requestId: "science-probe",
                  origin,
                  goal,
                  missionProfile,
                  weightProfile,
                  vehicle,
                },
                envelope,
                snapshot,
                { resources },
              ).ok,
          );
          return {
            poi,
            stand,
            standoffM: stand
              ? Math.hypot(stand.x - poi.point.x, stand.z - poi.point.z)
              : Number.NaN,
            distM: route ? distanceToRouteM(stand ?? poi.point, route.points) : Number.NaN,
          };
        })
        .sort(
          (a, b) => (Number.isNaN(a.distM) ? 0 : a.distM) - (Number.isNaN(b.distM) ? 0 : b.distM),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resources cambia en cada tick; no afecta a la admisibilidad
    [
      siteInfo.pois,
      route,
      snapshot,
      envelope,
      maxSlope,
      origin,
      missionProfile,
      weightProfile,
      vehicle,
    ],
  );

  if (siteInfo.pois.length === 0) return null;
  const onRoute = rows.filter((r) => r.distM <= ON_ROUTE_RADIUS_M).length;

  return (
    <div className="mwc__sci">
      <div className="mwc__colhead">
        <h3>{es ? "Ciencia en la ruta" : "Science on this route"}</h3>
        <span>{route ? `${onRoute} ${es ? "de" : "of"} ${rows.length}` : "—"}</span>
      </div>
      <p className="mwc__help">
        {es
          ? `Objetivos que estudió Curiosity aquí. "En ruta" = a ${ON_ROUTE_RADIUS_M} m o menos del camino.`
          : `Targets Curiosity studied here. "On route" = within ${ON_ROUTE_RADIUS_M} m of the path.`}
      </p>
      <ul className="mwc__scilist">
        {rows.map(({ poi, stand, standoffM, distM }) => {
          const hit = distM <= ON_ROUTE_RADIUS_M;
          const isGoal =
            stand !== null &&
            Math.abs(session.goal.x - stand.x) < 0.01 &&
            Math.abs(session.goal.z - stand.z) < 0.01;
          const img = images.get(poi.id);
          const open = openId === poi.id;
          // ¿Ya es parada del itinerario? (por objetivo o por el mismo punto de observación)
          const stopIdx = session.stops.findIndex(
            (s) =>
              s.id === `poi-${poi.id}` ||
              ("poiId" in s && (s as { poiId?: string }).poiId === poi.id) ||
              (stand !== null && Math.hypot(s.point.x - stand.x, s.point.z - stand.z) < 1.5),
          );
          const inTour = stopIdx >= 0;
          const resolved =
            inTour &&
            (stopIdx < session.stopIdx ||
              session.stopLog.some((e) => e.stopId === session.stops[stopIdx]!.id));
          return (
            <li key={poi.id} className="mwc__sciitem" data-hit={hit ? "true" : undefined}>
              <button
                type="button"
                className="mwc__scihead"
                aria-expanded={open}
                onClick={() => {
                  setOpenId(open ? null : poi.id);
                  dispatchTrek({ type: "inspectPoint", point: poi.point });
                }}
              >
                {img ? (
                  <img src={img} alt="" loading="lazy" />
                ) : (
                  <span className="mwc__sciph" aria-hidden="true" />
                )}
                <span className="mwc__scitext">
                  <b>{poi.title}</b>
                  <small>
                    {Number.isNaN(distM)
                      ? es
                        ? "Calcula una ruta para medir el desvío"
                        : "Compute a route to measure the detour"
                      : hit
                        ? es
                          ? "✓ En ruta"
                          : "✓ On route"
                        : es
                          ? `Desvío de ${distM.toFixed(0)} m`
                          : `${distM.toFixed(0)} m off route`}
                  </small>
                </span>
              </button>
              {open ? (
                <div className="mwc__scibody">
                  {img ? <img src={img} alt={poi.title} loading="lazy" /> : null}
                  <p>{poi.description}</p>
                  <p className="mwc__scinote">
                    {stand === null
                      ? es
                        ? `Sin punto seguro y alcanzable a ${APPROACH_SEARCH_M} m: solo se observa a distancia.`
                        : `No safe, reachable spot within ${APPROACH_SEARCH_M} m: observe from a distance only.`
                      : standoffM < 0.5
                        ? es
                          ? "El objetivo se puede pisar."
                          : "The target itself is walkable."
                        : es
                          ? `El objetivo está en pendiente prohibida. Punto de observación seguro a ${standoffM.toFixed(0)} m.`
                          : `The target sits on a forbidden slope. Safe observation point ${standoffM.toFixed(0)} m away.`}
                  </p>
                  <button
                    type="button"
                    className="btn mwc__btn"
                    disabled={locked || stand === null || resolved}
                    onClick={() => {
                      if (!stand) return;
                      const stops = inTour
                        ? session.stops.filter((_, i) => i !== stopIdx)
                        : [
                            ...session.stops,
                            {
                              id: `poi-${poi.id}`,
                              name: poi.title,
                              point: stand,
                              dwellMin: DEFAULT_POI_DWELL_MIN,
                            },
                          ];
                      dispatchTrek({
                        type: "simEvent",
                        event: { kind: "set-stops", stops, simulated: false },
                      });
                    }}
                  >
                    {inTour
                      ? es
                        ? `Quitar del itinerario (parada ${stopIdx + 1})`
                        : `Remove from itinerary (stop ${stopIdx + 1})`
                      : es
                        ? `Añadir como parada (${DEFAULT_POI_DWELL_MIN} min de trabajo)`
                        : `Add as a stop (${DEFAULT_POI_DWELL_MIN} min of work)`}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost mwc__btn"
                    disabled={locked || isGoal || stand === null}
                    onClick={() => {
                      if (!stand) return;
                      dispatchTrek({
                        type: "simEvent",
                        event: { kind: "set-goal", goal: stand, simulated: false },
                      });
                      dispatchTrek({ type: "inspectPoint", point: stand });
                    }}
                  >
                    {isGoal
                      ? es
                        ? "Ya es el destino"
                        : "Already the goal"
                      : es
                        ? "Usarlo como destino final"
                        : "Use it as the final goal"}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mwc__prov">
        <ProvChip type="REAL" /> {es ? "Fotos y textos" : "Photos and text"}: NASA/JPL-Caltech ·
        Access Mars
      </p>
    </div>
  );
}
