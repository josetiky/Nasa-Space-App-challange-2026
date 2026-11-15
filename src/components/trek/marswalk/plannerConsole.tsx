/**
 * M.I.Y.H. · 02 MarsWalk como CONSOLA DE LA NAVE (solo presentación).
 *
 * Reorganiza la misma información de PlannerTab (panels.tsx) en formato de "misión de juego":
 *   izquierda  TU MISIÓN — 6 tareas en orden (la "cadena" de antes, más clara)
 *   centro     el mismo MarsWalkMap
 *   derecha    ESTADO DE LA RUTA — margen de regreso, métricas y salud
 *   abajo      un solo botón principal que siempre dice lo que sigue
 *
 * Lee useTrek() y solo emite los mismos dispatchTrek(...) / computeOptimalRoute() que PlannerTab.
 * No hay umbrales, costos ni reglas nuevas aquí: los estados de cada tarea salen de los mismos
 * valores que mostraba la "cadena" (loadingTile, routeResult.ok, activeRoute, returnMarginMin, FSM).
 * PlannerTab sigue existiendo en panels.tsx por si se quiere volver a la vista anterior.
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
import { computeOptimalRoute, onRouteComputed } from "./routeBus";
import { ConfChip, ProvChip } from "./ui";
import "./planner-console.css";

type StepId = "zone" | "team" | "points" | "route" | "safe" | "go";
type Status = "done" | "warn" | "crit" | "progress" | "todo";

const C = {
  es: {
    plate: "NAVE M.I.Y.H. · CONSOLA 2 · PLANEACIÓN",
    title: "MarsWalk",
    subtitle: "Planea tu caminata",
    help: "Ayuda",
    mission: "Tu misión",
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
    sub: {
      zoneLoading: "Cargando el terreno real…",
      zoneError: "No se pudo cargar el terreno.",
      pointsHelp:
        "Elige un punto conocido o usa las herramientas Origen y Destino del mapa y toca el terreno.",
      pointsOk: "Inicio y destino se pueden pisar.",
      routeHelp:
        "El sistema prueba muchos caminos sobre el terreno real y se queda con el de menos riesgo. Nunca usa pendientes ni zonas prohibidas.",
      routeTodo: "Falta calcular la ruta.",
      safeOk: "La ruta cabe en el oxígeno y el equipo está bien.",
      safeWarn: "Se puede salir, pero el equipo tiene una alerta leve.",
      safeCrit: "No es segura todavía: revisa el margen y la salud.",
      go: "Manda la ruta a la simulación: verás la caminata con los signos del equipo.",
    },
    compute: "Calcular ruta segura",
    recompute: "Recalcular",
    tune: "Ajustar prioridades",
    tuneClose: "Ocultar prioridades",
    why: "¿Por qué esta ruta?",
    send: "Empezar caminata",
    loadingBtn: "Cargando terreno…",
    next: "Siguiente",
    hint: {
      zone: "Espera a que cargue el terreno.",
      points: "Mueve el inicio o el destino a un lugar permitido.",
      route: "Pulsa CALCULAR RUTA SEGURA.",
      safeCrit: "La ruta no es segura: cambia el destino o las prioridades.",
      go: "Todo listo. Puedes empezar la caminata.",
    },
    status: "Estado de la ruta",
    heroQ: "¿Te alcanza el oxígeno para volver?",
    heroOk: "Sí. Vuelven al hábitat con oxígeno de reserva.",
    heroBad: "No. Con esta ruta no alcanza para volver.",
    heroNone: "Se llena cuando hay una ruta.",
    minLeft: "min de sobra",
    minShort: "min",
    stats: {
      distance: "Distancia",
      ascent: "Subida",
      slope: "Pendiente máx.",
      duration: "Duración",
      o2: "Oxígeno",
      conf: "Confianza del mapa",
    },
    ofLimit: "de",
    conf: { high: "alta", mid: "media", low: "baja", none: "sin datos" },
    health: "Salud del equipo",
    healthOk: "Nadie tiene alertas.",
    modelled: "Valores calculados por el modelo",
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
    subtitle: "Plan your walk",
    help: "Help",
    mission: "Your mission",
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
    sub: {
      zoneLoading: "Loading the real terrain…",
      zoneError: "The terrain could not be loaded.",
      pointsHelp: "Pick a known point, or use the map's Origin and Goal tools and tap the terrain.",
      pointsOk: "Start and goal are walkable.",
      routeHelp:
        "The system tries many paths over the real terrain and keeps the lowest-risk one. It never uses forbidden slopes or zones.",
      routeTodo: "The route still needs to be computed.",
      safeOk: "The route fits the oxygen and the crew is fine.",
      safeWarn: "You can go, but the crew has a mild alert.",
      safeCrit: "Not safe yet: check the margin and health.",
      go: "Send the route to the simulation to watch the walk with the crew's vitals.",
    },
    compute: "Compute safe route",
    recompute: "Recompute",
    tune: "Adjust priorities",
    tuneClose: "Hide priorities",
    why: "Why this route?",
    send: "Start the walk",
    loadingBtn: "Loading terrain…",
    next: "Next",
    hint: {
      zone: "Wait for the terrain to load.",
      points: "Move the start or goal to an allowed spot.",
      route: "Press COMPUTE SAFE ROUTE.",
      safeCrit: "The route is not safe: change the goal or the priorities.",
      go: "All set. You can start the walk.",
    },
    status: "Route status",
    heroQ: "Is there enough oxygen to get back?",
    heroOk: "Yes. You return to the habitat with oxygen to spare.",
    heroBad: "No. With this route there is not enough to get back.",
    heroNone: "Fills in once there is a route.",
    minLeft: "min to spare",
    minShort: "min",
    stats: {
      distance: "Distance",
      ascent: "Climb",
      slope: "Max slope",
      duration: "Duration",
      o2: "Oxygen",
      conf: "Map confidence",
    },
    ofLimit: "of",
    conf: { high: "high", mid: "medium", low: "low", none: "no data" },
    health: "Crew health",
    healthOk: "Nobody has alerts.",
    modelled: "Values computed by the model",
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

/** Misma agrupación visual que ConfChip (K1–K2 sólido, K4–K5 débil), dicha en palabras. */
function confWord(cls: ConfidenceClass, w: { high: string; mid: string; low: string; none: string }) {
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
}: {
  onSend: () => void;
  onOpenWhy: () => void;
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

  const [open, setOpen] = useState<StepId | null>(null);
  const [tuner, setTuner] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => ensureReadableFonts(), []);
  // Al calcular, se abre "Inicio y destino" para que se vea la tarjeta de resultado (vive en KnownPoints)
  useEffect(() => onRouteComputed(() => setOpen("points")), []);

  /** Igual que el botón de antes, pero primero monta KnownPoints para que reciba el aviso. */
  const computeAndShow = () => {
    flushSync(() => setOpen("points"));
    computeOptimalRoute();
  };

  // ---- Estados de las tareas (mismos datos que la "cadena") ----
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
  const currentIdx = Math.max(0, order.findIndex((id) => !isDone(statuses[id])));
  const current = order[currentIdx]!;
  const expanded = open ?? current;
  const doneCount = order.filter((id) => isDone(statuses[id])).length;

  const subtitle: Record<StepId, string> = {
    zone: loadError ? c.sub.zoneError : loadingTile ? c.sub.zoneLoading : `${siteInfo.name}`,
    team: t.missionProfiles[session.missionProfile],
    points: rr.ok ? c.sub.pointsOk : loadingTile ? c.sub.pointsHelp : rr.message,
    route: routeStatus === "done" ? `${fmt0(r?.distanceM ?? Number.NaN)} m · ${fmt1(r?.durationMin ?? Number.NaN)} min` : c.sub.routeTodo,
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
        <label className="mwc__field">
          <span>{t.mission}</span>
          <select
            value={session.missionProfile}
            disabled={locked}
            title={locked ? t.lockedByHuman : undefined}
            onChange={(e) =>
              dispatchTrek({ type: "setMissionProfile", profile: e.target.value as MissionProfileId })
            }
          >
            {(Object.keys(t.missionProfiles) as MissionProfileId[]).map((p) => (
              <option key={p} value={p}>
                {t.missionProfiles[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
    ),
    points: (
      <div className="mwc__stepbody">
        {!rr.ok && !loadingTile && !loadError ? (
          <p className="mwc__alert" role="alert">
            <b>{lang === "es" ? "¡Alto!" : "Stop!"}</b> {rr.message}
          </p>
        ) : null}
        <p className="mwc__help">{c.sub.pointsHelp}</p>
        <KnownPoints />
      </div>
    ),
    route: (
      <div className="mwc__stepbody">
        <p className="mwc__help">{c.sub.routeHelp}</p>
        <div className="mwc__row">
          <button type="button" className="btn btn--ghost mwc__btn" onClick={computeAndShow}>
            {r ? c.recompute : c.compute}
          </button>
          <button
            type="button"
            className="btn btn--ghost mwc__btn"
            aria-expanded={tuner}
            onClick={() => setTuner((v) => !v)}
          >
            {tuner ? c.tuneClose : c.tune}
          </button>
        </div>
        {tuner ? <WeightTuner /> : null}
      </div>
    ),
    safe: (
      <div className="mwc__stepbody">
        <button type="button" className="btn btn--ghost mwc__btn" onClick={onOpenWhy}>
          {c.why}
        </button>
      </div>
    ),
  };

  // ---- Botón principal (misma disponibilidad que antes: enviar requiere una ruta activa) ----
  let cta: { label: string; onClick?: () => void; disabled: boolean; send: boolean };
  let hint: string;
  if (loadingTile || loadError) {
    cta = { label: c.loadingBtn, disabled: true, send: false };
    hint = loadError ? c.sub.zoneError : c.hint.zone;
  } else if (!r) {
    cta = { label: c.compute, onClick: computeAndShow, disabled: false, send: false };
    hint = rr.ok ? c.hint.route : c.hint.points;
  } else {
    cta = { label: c.send, onClick: onSend, disabled: false, send: true };
    hint = !rr.ok ? c.hint.points : safeStatus === "crit" ? c.hint.safeCrit : c.hint.go;
  }

  const slopePct = r ? Math.min(100, (r.maxSlopeDeg / session.envelope.maxSlopeDeg) * 100) : 0;
  const stats: Array<{ k: string; v: ReactNode; bar?: number }> = [
    {
      k: c.stats.distance,
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
      v: r ? (
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
  const dynamic =
    session.storms.some((s) => s.active) || session.sepAlertActive || session.telemetry.incident !== "nominal";

  return (
    <div className="mwc" data-help={help ? "true" : undefined}>
      <div className="mwc__plate">
        <span className="mwc__screw" aria-hidden="true" />
        <span aria-hidden="true">{c.plate}</span>
        <span className="mwc__simnote">{dynamic ? t.simBand : t.simBandNominal}</span>
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
          <button
            type="button"
            className="mwc__helpbtn"
            aria-pressed={help}
            onClick={() => setHelp((v) => !v)}
          >
            <span aria-hidden="true">?</span>
            {c.help}
          </button>
        </header>

        <div className="mwc__body">
          {/* ---------------- TU MISIÓN ---------------- */}
          <section className="mwc__quest" aria-label={c.mission}>
            <div className="mwc__colhead">
              <h3>{c.mission}</h3>
              <span>
                {doneCount} {c.of} {order.length}
              </span>
            </div>
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

          {/* ---------------- MAPA ---------------- */}
          <section className="mwc__map" aria-label={t.workspace}>
            <MarsWalkMap />
            {help ? (
              <p className="mwc__tip mwc__tip--map">
                <b>2</b> {c.tips.map}
              </p>
            ) : null}
          </section>

          {/* ---------------- ESTADO ---------------- */}
          <section className="mwc__status" aria-label={c.status}>
            <div className="mwc__colhead">
              <h3>{c.status}</h3>
            </div>
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
            <dl className="mwc__stats">
              {stats.map((s) => (
                <div key={s.k}>
                  <dt>{s.k}</dt>
                  <dd>{s.v}</dd>
                  {s.bar !== undefined ? (
                    <span className="mwc__bar" aria-hidden="true">
                      <i style={{ width: `${s.bar}%` }} data-high={s.bar > 85 ? "true" : undefined} />
                    </span>
                  ) : null}
                </div>
              ))}
            </dl>
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

        <footer className="mwc__foot">
          <p className="mwc__hint" aria-live="polite">
            <span className="mwc__nexttag">{c.next}</span>
            {hint}
          </p>
          <div className="mwc__actions">
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
