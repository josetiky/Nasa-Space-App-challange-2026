/**
 * MarsWalk · Itinerario científico (recorrido con varias paradas).
 *
 * Lista las estaciones en orden (origen → paradas → destino) con su tarea y su tiempo de trabajo,
 * permite reordenarlas, quitarlas y cambiar el tiempo de cada una, y muestra el plan que devuelve
 * A* (routing/tour.ts): cuándo se llega y se sale de cada parada, cuánto consumible queda y qué
 * paradas se omitieron por no tener corredor admisible. Durante la caminata marca la parada en curso.
 * Toda edición emite el evento set-stops del motor; no hay lógica de rutas aquí.
 */
import type { TourStop } from "@/core/trek/contracts";
import { walkComplete } from "@/core/trek/sim/session";
import { dispatchTrek, isHumanLockActive, useTrek } from "@/state/trekStore";
import type { TrekStation } from "@/services/trek/sites";
import { engineText } from "./engineText";
import { formatHm } from "./model";
import { ProvChip } from "./ui";

/** Paso para ajustar el tiempo de una parada y su máximo. [diseño] */
const DWELL_STEP_MIN = 5;
const DWELL_MAX_MIN = 180;

function setStops(stops: readonly TourStop[]) {
  dispatchTrek({ type: "simEvent", event: { kind: "set-stops", stops, simulated: false } });
}

export function TourPanel({ compact = false }: { compact?: boolean }) {
  const state = useTrek();
  const es = state.lang === "es";
  const { session, siteInfo } = state;
  const locked = isHumanLockActive(state);
  const rr = session.routeResult;
  const tour = rr.ok ? rr.tour : undefined;
  const stops = session.stops;
  const defaults = siteInfo.defaultStops;
  const log = new Map(session.stopLog.map((e) => [e.stopId, e]));
  const legs = new Map((tour?.legs ?? []).map((l) => [l.toStopId, l]));
  const now = session.resources.evaElapsedMin;
  const taskOf = (stop: TourStop) => {
    const st = defaults.find((d) => d.id === stop.id) as TrekStation | undefined;
    if (st) return es ? st.task : st.taskEn;
    return stop.task ?? null;
  };
  const isDefault =
    stops.length === defaults.length &&
    stops.every((s, i) => s.id === defaults[i]!.id && s.dwellMin === defaults[i]!.dwellMin);
  const returnsToStart =
    Math.hypot(session.goal.x - session.origin.x, session.goal.z - session.origin.z) < 1.5;

  const edit = (i: number, change: "up" | "down" | "remove" | number) => {
    const next = [...stops];
    if (change === "remove") next.splice(i, 1);
    else if (change === "up" && i > 0) [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
    else if (change === "down" && i < next.length - 1)
      [next[i + 1], next[i]] = [next[i]!, next[i + 1]!];
    else if (typeof change === "number") {
      const s = next[i]!;
      next[i] = { ...s, dwellMin: Math.max(0, Math.min(DWELL_MAX_MIN, s.dwellMin + change)) };
    }
    setStops(next);
  };

  const lastLeg = tour?.legs[tour.legs.length - 1];
  const dwellNow = session.dwell;
  // El plan de A* se rehace en cada ciclo desde la posición actual: sus minutos cuentan desde ahora
  // (o desde que termina el trabajo en curso). Se muestran como tiempo de misión T+.
  const dwellLeft = dwellNow ? Math.max(0, dwellNow.untilMin - now) : 0;
  const planStart = now + dwellLeft;
  // EVA terminada: lo que quedó pendiente ya no se hará en esta caminata
  const ended = walkComplete(session);
  const notDone = es ? "sin hacer" : "not done";
  const dwellStop = dwellNow ? stops.find((s) => s.id === dwellNow.stopId) : undefined;

  if (compact) {
    // Consola de caminata: una sola fila de fichas para no quitarle alto al mapa 3D
    return (
      <ol
        className="mwc__tourstrip"
        aria-label={es ? "Itinerario científico" : "Science itinerary"}
      >
        {stops.map((stop, i) => {
          const entry = log.get(stop.id);
          const leg = legs.get(stop.id);
          const working = dwellNow?.stopId === stop.id;
          const status = working ? "working" : entry ? entry.status : "pending";
          const when = working
            ? `${es ? "faltan" : "left"} ${formatHm(dwellLeft)}`
            : entry?.status === "done"
              ? `✓ T+${formatHm(entry.atMin)}`
              : entry
                ? entry.status === "skipped"
                  ? es
                    ? "omitida"
                    : "skipped"
                  : es
                    ? "interrumpida"
                    : "interrupted"
                : ended
                  ? notDone
                  : leg
                    ? `T+${formatHm(planStart + leg.arriveMin)}`
                    : "—";
          return (
            <li
              key={stop.id}
              data-status={status}
              title={
                entry?.reason ? engineText(entry.reason, state.lang) : (taskOf(stop) ?? stop.name)
              }
            >
              <span className="mwc__tourn" aria-hidden="true">
                {i + 1}
              </span>
              <span className="mwc__tourchip">
                <b>{stop.name}</b>
                <small>{when}</small>
              </span>
            </li>
          );
        })}
        <li data-status="goal">
          <span className="mwc__tourn" aria-hidden="true">
            ⌂
          </span>
          <span className="mwc__tourchip">
            <b>{returnsToStart ? (es ? "Rover" : "Rover") : es ? "Destino" : "Goal"}</b>
            <small>
              {ended
                ? `✓ T+${formatHm(now)}`
                : lastLeg
                  ? `T+${formatHm(planStart + lastLeg.arriveMin)}`
                  : "—"}
            </small>
          </span>
        </li>
      </ol>
    );
  }

  return (
    <div className="mwc__tour">
      <div className="mwc__colhead">
        <h3>{es ? "Itinerario científico" : "Science itinerary"}</h3>
        <span>
          {stops.length}{" "}
          {es ? (stops.length === 1 ? "parada" : "paradas") : stops.length === 1 ? "stop" : "stops"}
          {tour ? ` · ${formatHm(planStart + tour.totalMin)}` : ""}
        </span>
      </div>

      {dwellNow && dwellStop ? (
        <p className="mwc__tournow" aria-live="polite">
          {es ? "Trabajando en" : "Working at"} <b>{dwellStop.name}</b> · {es ? "faltan" : "left"}{" "}
          {formatHm(dwellNow.untilMin - now)}
        </p>
      ) : null}

      {stops.length === 0 ? (
        <p className="mwc__help">
          {es
            ? "Sin paradas: la caminata va directo al destino. Añade objetivos desde «Ciencia en la ruta»."
            : "No stops: the walk goes straight to the goal. Add targets from “Science on this route”."}
        </p>
      ) : (
        <ol className="mwc__tourlist">
          {stops.map((stop, i) => {
            const entry = log.get(stop.id);
            const leg = legs.get(stop.id);
            const working = dwellNow?.stopId === stop.id;
            const pending = !entry && !working && i >= session.stopIdx;
            const skippedPlan = tour?.skipped.find((sk) => sk.stopId === stop.id);
            const task = taskOf(stop);
            const status = working
              ? "working"
              : entry
                ? entry.status
                : skippedPlan
                  ? "unreachable"
                  : "pending";
            return (
              <li key={stop.id} className="mwc__tourstop" data-status={status}>
                <span className="mwc__tourn" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="mwc__tourtext">
                  <b>{stop.name}</b>
                  {task && !compact ? <small>{task}</small> : null}
                  <small className="mwc__tourwhen">
                    {status === "done"
                      ? `✓ ${es ? "hecha" : "done"} · T+${formatHm(entry!.atMin)}`
                      : status === "working"
                        ? `${es ? "en curso" : "in progress"} · ${formatHm(stop.dwellMin)}`
                        : status === "skipped" || status === "interrupted"
                          ? `${status === "skipped" ? (es ? "omitida" : "skipped") : es ? "interrumpida" : "interrupted"}: ${engineText(entry!.reason ?? "", state.lang)}`
                          : ended
                            ? notDone
                            : skippedPlan
                              ? `${es ? "inalcanzable" : "unreachable"}: ${engineText(skippedPlan.message, state.lang)}`
                              : leg
                                ? `${es ? "llega" : "arrive"} T+${formatHm(planStart + leg.arriveMin)} · ${formatHm(stop.dwellMin)} ${es ? "de trabajo" : "of work"}`
                                : `${formatHm(stop.dwellMin)} ${es ? "de trabajo" : "of work"}`}
                  </small>
                </span>
                {pending && !compact ? (
                  <span className="mwc__tourctl">
                    <button
                      type="button"
                      disabled={locked || stop.dwellMin <= 0}
                      aria-label={es ? `Menos tiempo en ${stop.name}` : `Less time at ${stop.name}`}
                      onClick={() => edit(i, -DWELL_STEP_MIN)}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      disabled={locked || stop.dwellMin >= DWELL_MAX_MIN}
                      aria-label={es ? `Más tiempo en ${stop.name}` : `More time at ${stop.name}`}
                      onClick={() => edit(i, DWELL_STEP_MIN)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      disabled={locked || i === 0 || i - 1 < session.stopIdx}
                      aria-label={es ? `Subir ${stop.name}` : `Move ${stop.name} up`}
                      onClick={() => edit(i, "up")}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={locked || i === stops.length - 1}
                      aria-label={es ? `Bajar ${stop.name}` : `Move ${stop.name} down`}
                      onClick={() => edit(i, "down")}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={locked}
                      aria-label={es ? `Quitar ${stop.name}` : `Remove ${stop.name}`}
                      onClick={() => edit(i, "remove")}
                    >
                      ×
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
          <li className="mwc__tourstop" data-status="goal">
            <span className="mwc__tourn" aria-hidden="true">
              ⌂
            </span>
            <span className="mwc__tourtext">
              <b>
                {returnsToStart
                  ? es
                    ? "Regreso al rover"
                    : "Back to the rover"
                  : es
                    ? "Destino"
                    : "Goal"}
              </b>
              {lastLeg ? (
                <small className="mwc__tourwhen">
                  T+{formatHm(planStart + lastLeg.arriveMin)} · {es ? "quedan" : "left"}{" "}
                  {formatHm(lastLeg.remainingAtDepartMin - dwellLeft)}{" "}
                  {es ? "del consumible limitante" : "of the limiting consumable"}
                </small>
              ) : null}
            </span>
          </li>
        </ol>
      )}

      {tour && !compact ? (
        <p className="mwc__toursum">
          {es ? "Caminando" : "Walking"} {formatHm(tour.walkMin)} · {es ? "ciencia" : "science"}{" "}
          {formatHm(tour.dwellMin)} · {es ? "EVA total" : "total EVA"}{" "}
          <b>{formatHm(planStart + tour.totalMin)}</b>
        </p>
      ) : null}

      {!compact ? (
        <div className="mwc__tourbtns">
          {defaults.length > 0 && !isDefault ? (
            <button
              type="button"
              className="btn btn--ghost mwc__btn"
              disabled={locked}
              onClick={() =>
                dispatchTrek({
                  type: "simEvent",
                  event: [
                    { kind: "set-stops", stops: defaults, simulated: false },
                    { kind: "set-goal", goal: siteInfo.defaultGoal, simulated: false },
                  ],
                })
              }
            >
              {es ? "Restaurar recorrido sugerido" : "Restore suggested tour"}
            </button>
          ) : null}
          {stops.length > 0 ? (
            <button
              type="button"
              className="btn btn--ghost mwc__btn"
              disabled={locked}
              onClick={() => setStops([])}
            >
              {es ? "Quitar todas las paradas" : "Remove all stops"}
            </button>
          ) : null}
        </div>
      ) : null}

      {!compact ? (
        <p className="mwc__prov">
          <ProvChip type="MODELLED" />{" "}
          {es
            ? "Tiempos de trabajo [diseño], del orden de las estaciones de Apollo 15–17. Consumo en parada: 1000 kJ/h (HUELLA)."
            : "Work times [design], on the order of Apollo 15–17 stations. Consumption at a stop: 1000 kJ/h (HUELLA)."}
        </p>
      ) : null}
    </div>
  );
}
