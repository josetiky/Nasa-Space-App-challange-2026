/**
 * M.I.Y.H. · 02 MarsWalk como CONSOLA DE LA NAVE (solo presentación).
 *
 * Reorganiza la información de planeación en formato claro y guiado, permitiendo hacer scroll
 * vertical dentro de este apartado sin cambiar de vista:
 *   arriba     Guía rápida de 3 pasos para entender qué hacer sin saturar
 *   izquierda  TU MISIÓN — 6 tareas en orden con explicación clara de cada una
 *   centro     el mismo MarsWalkMap + explicación breve de sus herramientas
 *   derecha    ESTADO DE LA RUTA — margen de regreso, prioridades A*, métricas, paradas y salud
 *   abajo      controles para subir/bajar de vista y botón principal que siempre dice lo que sigue
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import type { ConfidenceClass, MissionProfileId } from "@/core/trek/contracts";
import { healthRank } from "@/core/trek/contracts";
import { TREK_SITES } from "@/services/trek/sites";
import { dispatchTrek, isHumanLockActive, useTrek } from "@/state/trekStore";
import { TREK_TEXTS } from "../i18n";
import { MW_TEXTS } from "./i18n";
import { ensureReadableFonts } from "./landing/fonts";
import { MarsWalkMap } from "./MarsWalkMap";
import { KnownPoints, WeightTuner } from "./plannerControls";
import { DataProvenance } from "./provenance";
import { CrewParamsPanel, RadiationPanel } from "./SoloConsole";
import { computeOptimalRoute, onRouteComputed } from "./routeBus";
import { engineText } from "./engineText";
import { ScienceTargets } from "./scienceCard";
import { formatHm } from "./model";
import { TourPanel } from "./tourPanel";
import { ConfChip, ProvChip } from "./ui";
import "./planner-console.css";

type StepId = "zone" | "team" | "points" | "route" | "safe" | "go";
type Status = "done" | "warn" | "crit" | "progress" | "todo";

const C = {
  es: {
    plate: "NAVE M.I.Y.H. · CONSOLA 2 · PLANEACIÓN",
    title: "MarsWalk",
    subtitle: "Planea tu caminata paso a paso",
    help: "Ver globos de ayuda",
    guideToggleHide: "Ocultar explicación rápida ▴",
    guideToggleShow: "¿Qué debo hacer aquí? Ver explicación ▾",
    guideTitle: "¿Cómo funciona la Planeación? (Haz scroll hacia abajo para ver cada apartado sin salir de esta vista)",
    guideCards: [
      {
        n: "1",
        title: "Configura tu ruta (Columna izquierda)",
        desc: "Revisa los puntos del 1 al 6 en «Tu misión». Puedes cambiar la zona del cráter Gale, el tipo de equipo y los puntos de Inicio y Destino.",
      },
      {
        n: "2",
        title: "Usa el mapa interactivo (Centro)",
        desc: "La línea muestra el camino seguro que esquiva pendientes peligrosas (>15°). Con los botones del mapa puedes inspeccionar alturas o tocar dónde iniciar y terminar.",
      },
      {
        n: "3",
        title: "Verifica el oxígeno y avanza (Derecha / Abajo)",
        desc: "Revisa cuántos minutos de oxígeno te sobran, ajusta las prioridades del algoritmo A* si quieres, y pulsa «Empezar caminata» para desbloquear la Simulación en Vivo.",
      },
    ],
    mission: "1 · Tu misión (Paso a paso)",
    missionExplain:
      "Toca cualquier paso para abrir sus controles. El que tiene la etiqueta «AHORA» te indica qué sigue.",
    of: "de",
    now: "Ahora",
    steps: {
      zone: "Zona de trabajo",
      team: "Equipo",
      points: "Inicio y destino",
      route: "Ruta segura",
      safe: "¿Es segura?",
      go: "A caminar",
    },
    stepDesc: {
      zone: "Elige qué región real del cráter Gale (fotografiada por Curiosity) vas a recorrer.",
      team: "Selecciona si camina una cuadrilla en equipo, un astronauta individual en vivo o un rover.",
      points: "Define de dónde sale el astronauta (Origen), a qué punto quiere llegar (Destino) y sus paradas.",
      route: "El algoritmo A* analiza miles de cuadros del terreno y traza el camino de menor riesgo.",
      safe: "Verifica que el oxígeno alcance para ir y regresar al hábitat sin poner en riesgo al equipo.",
      go: "Cuando los pasos 1 al 5 estén en verde, pulsa «Empezar caminata» para ir a la Simulación en Vivo.",
    },
    sub: {
      zoneLoading: "Cargando el terreno real…",
      zoneError: "No se pudo cargar el terreno.",
      pointsHelp:
        "Elige un punto conocido de la lista o usa las herramientas Origen y Destino a la izquierda del mapa.",
      pointsOk: "Inicio y destino listos y sobre terreno caminable.",
      routeHelp:
        "El sistema prueba muchos caminos sobre el terreno real y elige el más seguro. Nunca cruza pendientes ni zonas prohibidas.",
      routeTodo: "Falta calcular la ruta.",
      safeOk: "La ruta cabe en el oxígeno disponible y el equipo está en buen estado.",
      safeWarn: "Se puede salir, pero el equipo tiene una alerta leve.",
      safeCrit: "No es segura todavía: revisa el margen de oxígeno y la salud.",
      go: "Manda la ruta a la simulación: verás la caminata en tiempo real con los signos del equipo.",
    },
    mapHeaderTitle: "2 · Mapa topográfico real (Cráter Gale)",
    mapHeaderDesc:
      "Usa los botones junto al mapa: «Inspeccionar» mide altura y pendiente; «Origen» y «Destino» mueven los puntos al hacer clic en el terreno; arriba del mapa puedes cambiar la capa visual (Elevación, Pendiente, Zonas o Confianza).",
    compute: "Calcular ruta con A*",
    recompute: "⟳ Recalcular la ruta",
    tune: "Ajustar prioridades",
    tuneClose: "Ocultar prioridades",
    why: "¿Por qué esta ruta?",
    send: "Empezar caminata → Ir a Simulación",
    loadingBtn: "Cargando terreno…",
    next: "Qué sigue",
    hint: {
      zone: "Espera a que termine de cargar el terreno real.",
      points: "Mueve el inicio o el destino a un lugar permitido del mapa.",
      route: "Pulsa «Calcular ruta con A*» para trazar el camino seguro.",
      safeCrit: "La ruta no es segura: elige un destino más cercano o cambia las prioridades.",
      go: "Ruta lista y verificada. Pulsa «Empezar caminata» para desbloquear y bajar a la Simulación en Vivo.",
    },
    status: "3 · Estado de la ruta y prioridades",
    statusExplain:
      "Aquí ves si el aire te alcanza para volver, cómo decide el algoritmo A* y el resumen numérico de tu caminata.",
    heroQ: "¿Te alcanza el oxígeno para ir y volver al hábitat?",
    heroOk: "Sí. Regresan al hábitat con oxígeno de reserva seguro.",
    heroBad: "No. Con esta ruta no alcanza el oxígeno para volver: acorta el recorrido.",
    heroNone: "Se calcula automáticamente en cuanto trazas una ruta.",
    minLeft: "min de oxígeno de sobra",
    minShort: "min",
    statsTitle: "Resumen de la caminata (¿Qué significa cada dato?)",
    stats: {
      distance: "Distancia total",
      ascent: "Subida acumulada",
      slope: "Pendiente máx.",
      duration: "Duración total",
      o2: "Oxígeno usado",
      conf: "Confianza del mapa",
    },
    statsHelp: {
      distance: "Metros totales que caminará el astronauta.",
      ascent: "Metros totales de desnivel hacia arriba.",
      slope: "Inclinación más fuerte del camino (máx. seguro: 15°).",
      duration: "Tiempo estimado sumando caminata y paradas.",
      o2: "Gramos de oxígeno que consumirá el traje.",
      conf: "Calidad de la medición satelital de la NASA (K1 alta – K5 baja).",
    },
    ofLimit: "de máx.",
    conf: { high: "alta", mid: "media", low: "baja", none: "sin datos" },
    health: "Salud inicial del equipo",
    healthOk: "Sin alertas médicas antes de salir.",
    modelled: "Valores calculados por el modelo físico y fisiológico",
    tips: {
      quest: "Tu lista de tareas. Síguela de arriba hacia abajo; la que dice AHORA es la que toca.",
      map: "Herramientas: elige Origen o Destino y toca el mapa. Inspeccionar solo mide el terreno.",
      status: "Lo más importante: cuánto oxígeno te sobra al volver.",
      foot: "El botón grande siempre dice lo que sigue. A la izquierda ves por qué.",
    },
  },
  en: {
    plate: "M.I.Y.H. SHIP · CONSOLE 2 · PLANNING",
    title: "MarsWalk",
    subtitle: "Plan your walk step by step",
    help: "Show screen tips",
    guideToggleHide: "Hide quick guide ▴",
    guideToggleShow: "What should I do here? Show guide ▾",
    guideTitle: "How does Planning work? (Scroll down inside this console to explore every section without leaving this view)",
    guideCards: [
      {
        n: "1",
        title: "Configure your route (Left column)",
        desc: "Follow items 1 to 6 in “Your mission”. You can change the Gale crater site, crew profile, and Start / Goal points.",
      },
      {
        n: "2",
        title: "Use the interactive map (Center)",
        desc: "The line shows the safe path avoiding dangerous slopes (>15°). Use the map buttons to inspect elevation or click where to start and finish.",
      },
      {
        n: "3",
        title: "Check oxygen & advance (Right / Below)",
        desc: "Verify how many minutes of spare oxygen you have on return, tune A* priorities if you like, and press “Start the walk” to unlock Live Simulation.",
      },
    ],
    mission: "1 · Your mission (Step by step)",
    missionExplain:
      "Tap any step to open its controls. The step marked “NOW” tells you what to do next.",
    of: "of",
    now: "Now",
    steps: {
      zone: "Work area",
      team: "Crew",
      points: "Start and goal",
      route: "Safe route",
      safe: "Is it safe?",
      go: "Let's walk",
    },
    stepDesc: {
      zone: "Choose which real Gale crater region (photographed by Curiosity) you want to explore.",
      team: "Select whether a full crew, a live solo astronaut, or a rover is doing the traverse.",
      points: "Pick where the astronaut starts (Origin), where to reach (Goal), and science stops.",
      route: "The A* algorithm evaluates thousands of terrain cells and traces the lowest-risk path.",
      safe: "Confirms you have enough oxygen to go and return to the habitat safely.",
      go: "Once steps 1 to 5 are green, press “Start the walk” to move on to Live Simulation.",
    },
    sub: {
      zoneLoading: "Loading the real terrain…",
      zoneError: "The terrain could not be loaded.",
      pointsHelp: "Pick a known point from the list, or use the Origin and Goal tools next to the map.",
      pointsOk: "Start and goal are set on walkable terrain.",
      routeHelp:
        "The system tries many paths over the real terrain and keeps the lowest-risk one. It never crosses forbidden slopes or zones.",
      routeTodo: "The route still needs to be computed.",
      safeOk: "The route fits the available oxygen and the crew is fine.",
      safeWarn: "You can go, but the crew has a mild alert.",
      safeCrit: "Not safe yet: check oxygen margin and health.",
      go: "Send the route to the simulation to watch the walk in real time with crew vitals.",
    },
    mapHeaderTitle: "2 · Real topographic map (Gale Crater)",
    mapHeaderDesc:
      "Use the buttons next to the map: “Inspect” measures elevation and slope; “Origin” and “Goal” move the endpoints when you click the terrain; above the map you can switch visual layers (Elevation, Slope, Zones, or Confidence).",
    compute: "Compute route with A*",
    recompute: "⟳ Recalculate the route",
    tune: "Adjust priorities",
    tuneClose: "Hide priorities",
    why: "Why this route?",
    send: "Start the walk → Go to Simulation",
    loadingBtn: "Loading terrain…",
    next: "What's next",
    hint: {
      zone: "Wait for the real terrain to finish loading.",
      points: "Move the start or goal to an allowed spot on the map.",
      route: "Press “Compute route with A*” to trace a safe path.",
      safeCrit: "The route is not safe: pick a closer goal or adjust priorities.",
      go: "Route ready and verified. Press “Start the walk” to unlock and go down to Live Simulation.",
    },
    status: "3 · Route status & priorities",
    statusExplain:
      "Here you see whether you have enough air to return, how the A* algorithm decides, and the numerical summary of your walk.",
    heroQ: "Is there enough oxygen to go and return to the habitat?",
    heroOk: "Yes. You return to the habitat with safe reserve oxygen.",
    heroBad: "No. With this route there is not enough oxygen to get back: shorten the walk.",
    heroNone: "Calculated automatically once a route is traced.",
    minLeft: "min of spare oxygen",
    minShort: "min",
    statsTitle: "Walk summary (What each metric means)",
    stats: {
      distance: "Total distance",
      ascent: "Total climb",
      slope: "Max slope",
      duration: "Total duration",
      o2: "Oxygen used",
      conf: "Map confidence",
    },
    statsHelp: {
      distance: "Total meters the astronaut will walk.",
      ascent: "Cumulative uphill elevation gain.",
      slope: "Steepest incline along the path (safe max: 15°).",
      duration: "Estimated time including walking and science stops.",
      o2: "Grams of oxygen consumed by the suit.",
      conf: "NASA satellite measurement quality (K1 high – K5 low).",
    },
    ofLimit: "of max",
    conf: { high: "high", mid: "medium", low: "low", none: "no data" },
    health: "Initial crew health",
    healthOk: "No medical alerts before departure.",
    modelled: "Values computed by the physical and physiological model",
    tips: {
      quest: "Your task list. Follow it top to bottom; the one marked NOW is next.",
      map: "Tools: choose Origin or Goal, then tap the map. Inspect only measures the terrain.",
      status: "Most important: how much oxygen is left when you get back.",
      foot: "The big button always says what comes next. The left side tells you why.",
    },
  },
} as const;

const fmt0 = (n: number) => (Number.isFinite(n) ? n.toFixed(0) : "—");
const fmt1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "—");

function confWord(
  cls: ConfidenceClass,
  w: { high: string; mid: string; low: string; none: string },
) {
  if (cls === "K1" || cls === "K2") return w.high;
  if (cls === "K4") return w.low;
  if (cls === "K5") return w.none;
  return w.mid;
}

function StepBadge({ n, status }: { n: number; status: Status }) {
  return (
    <span className="mwc__badge" data-status={status} aria-hidden="true">
      {status === "done" ? (
        <svg viewBox="0 0 18 18">
          <path d="M4 9.5l3.2 3.2L14 5.5" />
        </svg>
      ) : status === "crit" ? (
        "!"
      ) : (
        n
      )}
    </span>
  );
}

export function PlannerConsoleTab({
  onSend,
  onOpenWhy,
  onRouteConfirmed,
  onGoUp,
}: {
  onSend: () => void;
  onOpenWhy: () => void;
  onRouteConfirmed?: () => void;
  onGoUp?: () => void;
}) {
  const state = useTrek();
  const lang = state.lang;
  const c = C[lang];
  const t = MW_TEXTS[lang];
  const tt = TREK_TEXTS[lang];
  const { session, siteInfo, loadingTile, loadError } = state;
  const rr = session.routeResult;
  const r = session.activeRoute;
  const st = session.fsm.state;
  const locked = isHumanLockActive(state);

  const [open, setOpen] = useState<StepId | null>("points");
  const [help, setHelp] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [fineTune, setFineTune] = useState(false);

  useEffect(() => ensureReadableFonts(), []);
  useEffect(
    () =>
      onRouteComputed(() => {
        setOpen("points");
        onRouteConfirmed?.();
      }),
    [onRouteConfirmed],
  );

  const computeAndShow = () => {
    flushSync(() => setOpen("points"));
    computeOptimalRoute();
    onRouteConfirmed?.();
  };

  // ---- Estados de las tareas ----
  const marginMin = rr.ok ? rr.resourcePlan.returnMarginMin : Number.NaN;
  const healthCrit = healthRank(st) >= healthRank("CRITICAL");
  const tileStatus: Status = loadError ? "crit" : loadingTile ? "progress" : "done";
  const pointsStatus: Status = loadingTile || loadError ? "todo" : rr.ok ? "done" : "crit";
  const routeStatus: Status = rr.ok && r ? "done" : "todo";
  const safeStatus: Status =
    routeStatus !== "done"
      ? "todo"
      : marginMin < 0 || healthCrit
        ? "crit"
        : healthRank(st) > 0
          ? "warn"
          : "done";

  const statuses: Record<StepId, Status> = {
    zone: tileStatus,
    team: "done",
    points: pointsStatus,
    route: routeStatus,
    safe: safeStatus,
    go: "todo",
  };
  const order: StepId[] = ["zone", "team", "points", "route", "safe", "go"];
  const isDone = (s: Status) => s === "done" || s === "warn";
  const currentIdx = Math.max(
    0,
    order.findIndex((id) => !isDone(statuses[id])),
  );
  const current = order[currentIdx]!;
  const expanded = open ?? current;
  const doneCount = order.filter((id) => isDone(statuses[id])).length;

  const subtitle: Record<StepId, string> = {
    zone: loadError ? c.sub.zoneError : loadingTile ? c.sub.zoneLoading : `${siteInfo.name}`,
    team: t.missionProfiles[session.missionProfile],
    points: rr.ok ? c.sub.pointsOk : loadingTile ? c.sub.pointsHelp : engineText(rr.message, lang),
    route:
      routeStatus === "done"
        ? rr.ok && rr.tour
          ? `${fmt0(r?.distanceM ?? Number.NaN)} m · ${session.stops.length} ${lang === "es" ? "paradas" : "stops"} · ${formatHm(rr.tour.totalMin)}`
          : `${fmt0(r?.distanceM ?? Number.NaN)} m · ${fmt1(r?.durationMin ?? Number.NaN)} min`
        : c.sub.routeTodo,
    safe:
      safeStatus === "done"
        ? c.sub.safeOk
        : safeStatus === "warn"
          ? c.sub.safeWarn
          : safeStatus === "crit"
            ? c.sub.safeCrit
            : "—",
    go: c.sub.go,
  };

  const body: Partial<Record<StepId, ReactNode>> = {
    zone: (
      <div className="mwc__stepbody">
        <p className="mwc__help">{c.stepDesc.zone}</p>
        <label className="mwc__field">
          <span>{t.site}</span>
          <select
            value={state.siteId}
            disabled={locked}
            title={locked ? t.lockedByHuman : siteInfo.source}
            onChange={(e) => dispatchTrek({ type: "setSiteLoading", siteId: e.target.value })}
          >
            {TREK_SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} · {s.dataType}
              </option>
            ))}
          </select>
        </label>
        <span className="chip chip--mars">
          • {siteInfo.dataType} · {siteInfo.subtitle}
        </span>
      </div>
    ),
    team: (
      <div className="mwc__stepbody">
        <p className="mwc__help">{c.stepDesc.team}</p>
        <label className="mwc__field">
          <span>{t.mission}</span>
          <select
            value={session.missionProfile}
            disabled={locked}
            title={locked ? t.lockedByHuman : undefined}
            onChange={(e) =>
              dispatchTrek({
                type: "setMissionProfile",
                profile: e.target.value as MissionProfileId,
              })
            }
          >
            {(Object.keys(t.missionProfiles) as MissionProfileId[]).map((p) => (
              <option key={p} value={p}>
                {t.missionProfiles[p]}
              </option>
            ))}
          </select>
        </label>
        {session.missionProfile === "solo" && session.live !== null ? (
          <div className="solo-planner">
            <CrewParamsPanel />
            <RadiationPanel />
          </div>
        ) : null}
      </div>
    ),
    points: (
      <div className="mwc__stepbody">
        <p className="mwc__help">{c.stepDesc.points}</p>
        {!rr.ok && !loadingTile && !loadError ? (
          <p className="mwc__alert" role="alert">
            <b>{lang === "es" ? "¡Alto!" : "Stop!"}</b> {engineText(rr.message, lang)}
          </p>
        ) : null}
        <p className="mwc__help">{c.sub.pointsHelp}</p>
        <KnownPoints />
      </div>
    ),
    route: (
      <div className="mwc__stepbody">
        <p className="mwc__help">{c.stepDesc.route}</p>
        <div className="mwc__row">
          <button type="button" className="btn btn--ghost mwc__btn" onClick={computeAndShow}>
            {r ? c.recompute : c.compute}
          </button>
        </div>
      </div>
    ),
    safe: (
      <div className="mwc__stepbody">
        <p className="mwc__help">{c.stepDesc.safe}</p>
        <button type="button" className="btn btn--ghost mwc__btn" onClick={onOpenWhy}>
          {c.why}
        </button>
      </div>
    ),
    go: (
      <div className="mwc__stepbody">
        <p className="mwc__help">{c.stepDesc.go}</p>
      </div>
    ),
  };

  // ---- Botón principal ----
  let cta: { label: string; onClick?: () => void; disabled: boolean; send: boolean };
  let hint: string;
  if (loadingTile || loadError) {
    cta = { label: c.loadingBtn, disabled: true, send: false };
    hint = loadError ? c.sub.zoneError : c.hint.zone;
  } else if (!r || !rr.ok) {
    cta = { label: c.compute, onClick: computeAndShow, disabled: false, send: false };
    hint = rr.ok ? c.hint.route : c.hint.points;
  } else {
    cta = {
      label: c.send,
      onClick: () => {
        onRouteConfirmed?.();
        onSend();
      },
      disabled: safeStatus === "crit",
      send: true,
    };
    hint = !rr.ok ? c.hint.points : safeStatus === "crit" ? c.hint.safeCrit : c.hint.go;
  }

  const slopePct = r ? Math.min(100, (r.maxSlopeDeg / session.envelope.maxSlopeDeg) * 100) : 0;
  const stats: Array<{ k: string; help: string; v: ReactNode; bar?: number | undefined }> = [
    {
      k: c.stats.distance,
      help: c.statsHelp.distance,
      v: r ? (
        r.distanceM >= 1000 ? (
          <>
            {(r.distanceM / 1000).toFixed(2)}
            <small>km</small>
          </>
        ) : (
          <>
            {fmt0(r.distanceM)}
            <small>m</small>
          </>
        )
      ) : (
        "—"
      ),
    },
    {
      k: c.stats.ascent,
      help: c.statsHelp.ascent,
      v: r ? (
        <>
          +{fmt1(r.elevationGainM)}
          <small>m</small>
        </>
      ) : (
        "—"
      ),
    },
    {
      k: c.stats.slope,
      help: c.statsHelp.slope,
      v: r ? (
        <>
          {fmt1(r.maxSlopeDeg)}°
          <small>
            {c.ofLimit} {session.envelope.maxSlopeDeg}°
          </small>
        </>
      ) : (
        "—"
      ),
      bar: r ? slopePct : undefined,
    },
    {
      k: c.stats.duration,
      help: c.statsHelp.duration,
      v:
        rr.ok && rr.tour ? (
          <>
            {formatHm(rr.tour.totalMin)}
            <small>
              {fmt1(rr.tour.walkMin)} min {lang === "es" ? "caminando" : "walking"}
            </small>
          </>
        ) : r ? (
          <>
            {fmt1(r.durationMin)}
            <small>min</small>
          </>
        ) : (
          "—"
        ),
    },
    {
      k: c.stats.o2,
      help: c.statsHelp.o2,
      v: rr.ok ? (
        <>
          {fmt1(rr.resourcePlan.totals.o2Kg * 1000)}
          <small>g</small>
        </>
      ) : (
        "—"
      ),
    },
    {
      k: c.stats.conf,
      help: c.statsHelp.conf,
      v: r ? (
        <span className="mwc__conf">
          <ConfChip cls={r.minConfidence} />
          <small>{confWord(r.minConfidence, c.conf)}</small>
        </span>
      ) : (
        "—"
      ),
    },
  ];

  const heroState = !rr.ok ? "none" : marginMin < 0 ? "bad" : "ok";

  return (
    <div className="mwc" data-help={help ? "true" : undefined}>
      <div className="mwc__plate">
        <span className="mwc__screw" aria-hidden="true" />
        <span aria-hidden="true">{c.plate}</span>
        <span className="mwc__simnote">REAL · NASA + SIMULATED</span>
        <span className="mwc__tag" aria-hidden="true">
          MWK-PLN-02
        </span>
        <span className="mwc__led" aria-hidden="true" />
        <span className="mwc__screw" aria-hidden="true" />
      </div>

      <div className="mwc__screen">
        <header className="mwc__head">
          <div className="mwc__brand">
            <h2 className="mwc__title">{c.title}</h2>
            <span className="mwc__subtitle">{c.subtitle}</span>
          </div>
          <span className="mwc__site">
            <span aria-hidden="true" className="mwc__sitedot" />
            {siteInfo.name} · {siteInfo.dataType}
          </span>
          <div className="mwc__headbtns">
            <button
              type="button"
              className="mwc__chipbtn"
              aria-expanded={showGuide}
              onClick={() => setShowGuide((v) => !v)}
            >
              {showGuide ? c.guideToggleHide : c.guideToggleShow}
            </button>
            <button
              type="button"
              className="mwc__helpbtn"
              aria-pressed={help}
              onClick={() => setHelp((v) => !v)}
            >
              <span aria-hidden="true">?</span>
              {c.help}
            </button>
          </div>
          <DataProvenance />
        </header>

        <div className="mwc__scroll" data-scroll-lock>
          {showGuide ? (
            <section className="mwc__guide-strip" aria-label={c.guideTitle}>
              <p className="mwc__guide-heading">{c.guideTitle}</p>
              <div className="mwc__guide-grid">
                {c.guideCards.map((g) => (
                  <div key={g.n} className="mwc__guide-card">
                    <span className="mwc__guide-num">{g.n}</span>
                    <div>
                      <b>{g.title}</b>
                      <p>{g.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mwc__body">
            {/* ---------------- 1. TU MISIÓN ---------------- */}
            <section className="mwc__quest" aria-label={c.mission}>
              <div className="mwc__colhead">
                <h3>{c.mission}</h3>
                <span>
                  {doneCount} {c.of} {order.length}
                </span>
              </div>
              <p className="mwc__sec-explain">{c.missionExplain}</p>
              <span className="mwc__progress" aria-hidden="true">
                <i style={{ width: `${(doneCount / order.length) * 100}%` }} />
              </span>
              {help ? (
                <p className="mwc__tip mwc__tip--inline">
                  <b>1</b> {c.tips.quest}
                </p>
              ) : null}
              <ol className="mwc__steps">
                {order.map((id, i) => {
                  const status = statuses[id];
                  const isOpen = expanded === id;
                  const isCurrent = current === id;
                  return (
                    <li
                      key={id}
                      className="mwc__step"
                      data-status={status}
                      data-current={isCurrent ? "true" : undefined}
                      data-open={isOpen ? "true" : undefined}
                    >
                      <button
                        type="button"
                        className="mwc__stephead"
                        aria-expanded={body[id] ? isOpen : undefined}
                        onClick={() => setOpen(isOpen ? (id === current ? null : current) : id)}
                      >
                        <StepBadge n={i + 1} status={status} />
                        <span className="mwc__steptext">
                          <span className="mwc__steptitle">{c.steps[id]}</span>
                          <span className="mwc__stepsub">{subtitle[id]}</span>
                        </span>
                        {isCurrent ? <span className="mwc__now">{c.now}</span> : null}
                      </button>
                      {isOpen && body[id] ? body[id] : null}
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* ---------------- 2. MAPA ---------------- */}
            <section className="mwc__map-wrap" aria-label={t.workspace}>
              <div className="mwc__map-explain">
                <h3>{c.mapHeaderTitle}</h3>
                <p>{c.mapHeaderDesc}</p>
              </div>
              <div className="mwc__map">
                <MarsWalkMap />
                {help ? (
                  <p className="mwc__tip mwc__tip--map">
                    <b>2</b> {c.tips.map}
                  </p>
                ) : null}
              </div>
            </section>

            {/* ---------------- 3. ESTADO ---------------- */}
            <section className="mwc__status" aria-label={c.status}>
              <div className="mwc__colhead">
                <h3>{c.status}</h3>
              </div>
              <p className="mwc__sec-explain">{c.statusExplain}</p>
              {help ? (
                <p className="mwc__tip mwc__tip--inline">
                  <b>3</b> {c.tips.status}
                </p>
              ) : null}
              <div className="mwc__hero" data-state={heroState}>
                <span className="mwc__heroq">{c.heroQ}</span>
                <span className="mwc__herov">
                  <b>{rr.ok ? fmt0(marginMin) : "—"}</b>
                  {rr.ok ? <small>{c.minLeft}</small> : null}
                </span>
                <span className="mwc__heron">
                  {heroState === "ok" ? c.heroOk : heroState === "bad" ? c.heroBad : c.heroNone}
                </span>
              </div>
              <div className="mwc__goal">
                <div className="mwc__colhead">
                  <h3>{lang === "es" ? "Prioridad de la ruta (A*)" : "Route priority (A*)"}</h3>
                </div>
                <p className="mwc__help">
                  {lang === "es"
                    ? "Elige qué debe priorizar el algoritmo A* al buscar el camino (más rápido, más seguro, ahorrar oxígeno…) o despliega el ajuste fino:"
                    : "Choose what the A* algorithm should prioritize when finding a path (fastest, safest, save oxygen…) or expand fine tuning:"}
                </p>
                <div className="mw-weights__presets">
                  {(
                    [
                      "balanced",
                      "fastest",
                      "safest",
                      "resource-saving",
                      "known",
                      "emergency",
                    ] as const
                  ).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="chip mw-weights__preset"
                      aria-pressed={!session.customWeights && session.weightProfile === p}
                      disabled={locked}
                      title={locked ? t.lockedByHuman : undefined}
                      onClick={() => dispatchTrek({ type: "setWeightProfile", profile: p })}
                    >
                      {tt.weightProfiles[p]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn--ghost mwc__btn"
                  aria-expanded={fineTune}
                  onClick={() => setFineTune((v) => !v)}
                >
                  {fineTune
                    ? lang === "es"
                      ? "Ocultar ajuste fino ▴"
                      : "Hide fine tuning ▴"
                    : lang === "es"
                      ? "Ajuste fino de pesos (distancia, tiempo, riesgo, energía…) ▾"
                      : "Fine-tune weights (distance, time, risk, energy…) ▾"}
                </button>
                {fineTune ? <WeightTuner /> : null}
                <button
                  type="button"
                  className="btn mwc__btn mwc__astar"
                  disabled={loadingTile || !!loadError}
                  onClick={computeAndShow}
                >
                  {r ? c.recompute : c.compute}
                </button>
              </div>
              <div className="mwc__stats-block">
                <h4 className="mwc__subh">{c.statsTitle}</h4>
                <dl className="mwc__stats">
                  {stats.map((s) => (
                    <div key={s.k}>
                      <dt>{s.k}</dt>
                      <dd>{s.v}</dd>
                      <small className="mwc__stat-help">{s.help}</small>
                      {s.bar !== undefined ? (
                        <span className="mwc__bar" aria-hidden="true">
                          <i
                            style={{ width: `${s.bar}%` }}
                            data-high={s.bar > 85 ? "true" : undefined}
                          />
                        </span>
                      ) : null}
                    </div>
                  ))}
                </dl>
              </div>
              <TourPanel />
              <ScienceTargets />
              <div className="mwc__health" data-state={st}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12h4l2-5 4 10 2-5h6" />
                </svg>
                <span>
                  <b>
                    {c.health}: {tt.healthStates[st]}
                  </b>
                  <small>
                    {session.fsm.requiresHumanConfirmation
                      ? t.awaitingHuman
                      : healthRank(st) === 0
                        ? c.healthOk
                        : session.directive.goalPolicy}
                  </small>
                </span>
              </div>
              <p className="mwc__prov">
                <ProvChip type="MODELLED" /> {c.modelled}
              </p>
            </section>
          </div>
        </div>

        <footer className="mwc__foot">
          <p className="mwc__hint" aria-live="polite">
            <span className="mwc__nexttag">{c.next}</span>
            {hint}
          </p>
          <div className="mwc__actions">
            {onGoUp ? (
              <button type="button" className="btn btn--ghost mwc__btn" onClick={onGoUp}>
                ↑ {lang === "es" ? "Subir a Inicio" : "Go up to Home"}
              </button>
            ) : null}
            {r ? (
              <button type="button" className="btn btn--ghost mwc__btn" onClick={onOpenWhy}>
                {c.why}
              </button>
            ) : null}
            {r ? (
              <button type="button" className="btn btn--ghost mwc__btn" onClick={computeAndShow}>
                {c.recompute}
              </button>
            ) : null}
            <button
              type="button"
              className={`mwc__cta${cta.disabled ? "" : " is-live"}`}
              disabled={cta.disabled}
              onClick={cta.onClick}
            >
              {cta.label}
              {cta.send ? (
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 1.8v8.4L10 6z" />
                </svg>
              ) : null}
            </button>
          </div>
          {help ? (
            <p className="mwc__tip mwc__tip--foot">
              <b>4</b> {c.tips.foot}
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
