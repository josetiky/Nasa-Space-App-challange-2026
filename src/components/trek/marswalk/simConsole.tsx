/**
 * M.I.Y.H. · 03 Simulación como CONSOLA DE LA NAVE (solo presentación).
 *
 * Incluye guía paso a paso integrada y explicaciones claras de cada panel sin saturar,
 * permitiendo hacer scroll vertical dentro de la vista sin cambiar de apartado:
 *   arriba     Guía rápida de 3 pasos para entender cómo correr y completar la simulación
 *   izquierda  IsoMap 3D + barras explicadas de avance de la ruta y margen de regreso
 *   derecha    signos del cuerpo, del traje y ambiente explicados + centro de control dinámico
 *   abajo      controles para subir a Planeación, reproducir/pausar, velocidad, reiniciar y bajar a Unity al terminar
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { healthRank } from "@/core/trek/contracts";
import { dispatchTrek, isHumanLockActive, useTrek } from "@/state/trekStore";
import { TREK_TEXTS } from "../i18n";
import { MW_TEXTS } from "./i18n";
import { IsoMap } from "./IsoMap";
import { ensureReadableFonts } from "./landing/fonts";
import { buildAssistantFeed, missionClock, vitalsFromRow, type VitalReading } from "./model";
import { MarsEnvChip } from "./MarsEnvPanel";
import { SPEEDS, type Speed } from "./panels";
import { HuellaSourcePicker, PhysioWeightsPanel } from "./PhysioPanel";
import { FsmDiagram, SoloConsole } from "./SoloConsole";
import { DataProvenance } from "./provenance";
import { computeOptimalRoute } from "./routeBus";
import {
  setHistoricalEnabled,
  setHistoricalIntensity,
  useHistoricalBus,
} from "./historicalBus";
import { HISTORICAL_INCIDENTS } from "@/core/trek/sim/historicalEvents";
import { WeightTuner } from "./plannerControls";
import { TREK_SCENARIOS } from "@/core/trek/sim/scenarios";
import { remainingDwellMin, walkComplete } from "@/core/trek/sim/session";
import { TourPanel } from "./tourPanel";
import { ProvChip } from "./ui";
import { engineText } from "./engineText";
import "./planner-console.css";

const C = {
  es: {
    plate: "NAVE M.I.Y.H. · CONSOLA 3 · CAMINATA EN VIVO",
    title: "Caminata",
    subtitle: "Simulación en vivo paso a paso",
    help: "Ver globos de ayuda",
    guideToggleHide: "Ocultar explicación rápida ▴",
    guideToggleShow: "¿Qué debo hacer aquí? Ver explicación ▾",
    guideTitle:
      "¿Cómo funciona la Simulación en Vivo? (Puedes hacer scroll dentro de esta pantalla sin salirte de este apartado)",
    guideCards: [
      {
        n: "1",
        title: "Inicia y acelera el tiempo (Barra inferior)",
        desc: "Pulsa el botón grande «Iniciar caminata» abajo a la derecha y usa los botones de Velocidad (×15, ×60 o ×300) para que la caminata avance rápido.",
      },
      {
        n: "2",
        title: "Vigila el Mapa 3D y los Signos Vitales",
        desc: "A la izquierda ves al astronauta avanzar sobre el cráter Gale y cuánto oxígeno le queda. A la derecha ves en tiempo real el pulso, el oxígeno y el estado del traje.",
      },
      {
        n: "3",
        title: "Prueba emergencias y desbloquea Unity",
        desc: "En el panel inferior derecho puedes provocar tormentas o fallas para ver cómo A* recalcula la ruta. Cuando la caminata llegue al 100%, se desbloqueará el paso al Simulador 3D en Unity.",
      },
    ],
    clock: "Tiempo de caminata",
    health: "Salud",
    openHealth: "Salud y contingencias",
    locked: "bloqueado",
    mapTitle: "1 · Mapa isométrico 3D en vivo y progreso",
    mapExplain:
      "El marcador muestra la posición exacta del astronauta sobre el terreno real de Gale. Debajo del mapa puedes vigilar el porcentaje de ruta completada y el oxígeno de reserva.",
    progress: "Avance de la ruta",
    progressHelp: "Llega al 100% para desbloquear la Exploración 3D en Unity.",
    margin: "Oxígeno de sobra al volver",
    marginHelp: "Si baja demasiado (<25%), el sistema ordenará regresar al hábitat.",
    vitalsTitle: "2 · Monitor biométrico y del traje (HUELLA)",
    vitalsExplain:
      "Lecturas en vivo del astronauta. Si algún valor sale del rango seguro, la Máquina de Estados (arriba) cambia de NORMAL a PRECAUCIÓN o EMERGENCIA.",
    body: "Cuerpo (Fisiología del astronauta)",
    bodyExplain: "Latidos por minuto, saturación de oxígeno en sangre y temperatura interna.",
    suit: "Traje espacial (Soporte vital)",
    suitExplain: "Limpieza de CO₂ en el casco, presión del traje, reserva del tanque O₂, ventilador y batería.",
    env: "Ambiente marciano",
    envExplain: "Dosis de radiación acumulada durante esta salida extravehicular (EVA).",
    names: {
      hr: "Pulso",
      spo2: "Oxígeno en la sangre",
      core: "Temperatura del cuerpo",
      co2: "CO₂ en el casco",
      press: "Presión del traje",
      o2pri: "Tanque de oxígeno",
      fan: "Ventilador del traje",
      batt: "Batería del traje",
      dose: "Radiación en esta caminata",
    } as Record<string, string>,
    quality: { stale: "dato viejo", missing: "sin señal", implausible: "dato dudoso" } as Record<string, string>,
    noSample: "Aún no hay lecturas en movimiento: pulsa «Iniciar caminata» abajo a la derecha.",
    assistant: "Bitácora del asistente",
    voice: "Guía por voz",
    start: "Iniciar caminata",
    resume: "Continuar caminata",
    pause: "Pausar",
    speed: "Velocidad",
    speedHelp: (s: number) => `1 s real = ${s} s de misión`,
    reset: "Empezar de nuevo",
    next: "Ahora",
    goToUnity: "↓ Bajar a Exploración 3D (Unity)",
    hint: {
      idle: "Pulsa «Iniciar caminata» (y elige velocidad ×60 o ×300) para correr la simulación y desbloquear Unity.",
      paused: "Caminata en pausa. Pulsa «Continuar caminata» para terminar el recorrido.",
      normal: "La caminata avanza. Observa el pulso, el oxígeno y el avance hacia el 100%.",
      fatigue: "Fatiga detectada: el sistema reduce el ritmo y ajusta la ruta automáticamente.",
      caution: "Precaución activa: revisa los signos del equipo o abre Salud y contingencias.",
      critical: "Emergencia: abre Salud y contingencias para autorizar la decisión humana.",
      done: "¡Simulación completada! Ya puedes pulsar «Bajar a Exploración 3D (Unity)» para salir a caminar en 3D.",
      doneEarly: "EVA concluida con retorno seguro al punto de partida. Ya puedes avanzar a Exploración 3D (Unity).",
    },
    tips: {
      map: "El astronauta camina sobre el terreno real de Gale. La línea es su ruta.",
      vitals: "Signos del cuerpo y del traje. Si algo se sale de lo normal, el estado de salud de arriba cambia.",
      assistant: "El asistente narra cada decisión del sistema. Activa la voz para escucharla.",
      foot: "Aquí controlas la simulación: iniciar o pausar, la velocidad y reiniciar.",
    },
  },
  en: {
    plate: "M.I.Y.H. SHIP · CONSOLE 3 · LIVE WALK",
    title: "The walk",
    subtitle: "Step-by-step live simulation",
    help: "Show screen tips",
    guideToggleHide: "Hide quick guide ▴",
    guideToggleShow: "What should I do here? Show guide ▾",
    guideTitle:
      "How does Live Simulation work? (You can scroll inside this screen without leaving this section)",
    guideCards: [
      {
        n: "1",
        title: "Start & speed up time (Bottom bar)",
        desc: "Press the big “Start the walk” button at the bottom right and use the Speed buttons (×15, ×60, or ×300) to fast-forward the walk.",
      },
      {
        n: "2",
        title: "Watch the 3D Map & Vital Signs",
        desc: "On the left, watch the astronaut move across Gale crater and track spare oxygen. On the right, monitor heart rate, blood oxygen, and suit status in real time.",
      },
      {
        n: "3",
        title: "Test emergencies & unlock Unity",
        desc: "In the bottom-right panel you can trigger storms or suit faults to see how A* replans automatically. When progress reaches 100%, the Unity 3D Simulator unlocks.",
      },
    ],
    clock: "Walk time",
    health: "Health",
    openHealth: "Health & contingencies",
    locked: "locked",
    mapTitle: "1 · Live 3D isometric map & progress",
    mapExplain:
      "The pin shows the astronaut's exact position on real Gale terrain. Below the map you can track route completion percentage and reserve oxygen.",
    progress: "Route progress",
    progressHelp: "Reach 100% to unlock 3D Exploration in Unity.",
    margin: "Oxygen to spare on return",
    marginHelp: "If it drops too low (<25%), the system orders a return to the habitat.",
    vitalsTitle: "2 · Biometric & suit monitor (HUELLA)",
    vitalsExplain:
      "Live readings from the astronaut. If any value leaves the safe range, the State Machine (top) shifts from NORMAL to CAUTION or EMERGENCY.",
    body: "Body (Astronaut physiology)",
    bodyExplain: "Heart rate (bpm), blood oxygen saturation, and core body temperature.",
    suit: "Spacesuit (Life support)",
    suitExplain: "Helmet CO₂ scrubbing, suit pressure, O₂ tank reserve, fan, and battery.",
    env: "Martian environment",
    envExplain: "Cumulative radiation dose absorbed during this extravehicular activity (EVA).",
    names: {
      hr: "Heart rate",
      spo2: "Blood oxygen",
      core: "Body temperature",
      co2: "Helmet CO₂",
      press: "Suit pressure",
      o2pri: "Oxygen tank",
      fan: "Suit fan",
      batt: "Suit battery",
      dose: "Radiation this walk",
    } as Record<string, string>,
    quality: { stale: "old data", missing: "no signal", implausible: "doubtful" } as Record<string, string>,
    noSample: "No live readings yet: press “Start the walk” at the bottom right.",
    assistant: "Assistant log",
    voice: "Voice guide",
    start: "Start the walk",
    resume: "Resume walk",
    pause: "Pause",
    speed: "Speed",
    speedHelp: (s: number) => `1 real s = ${s} mission s`,
    reset: "Start over",
    next: "Now",
    goToUnity: "↓ Go down to 3D Exploration (Unity)",
    hint: {
      idle: "Press “Start the walk” (and pick ×60 or ×300 speed) to run the simulation and unlock Unity.",
      paused: "Walk paused. Press “Resume walk” to complete the traverse.",
      normal: "The walk is under way. Watch heart rate, oxygen, and progress toward 100%.",
      fatigue: "Fatigue detected: the system slows the pace and adjusts the route automatically.",
      caution: "Caution active: check crew vitals or open Health & contingencies.",
      critical: "Emergency: open Health & contingencies to authorize the human decision.",
      done: "Simulation complete! You can now press “Go down to 3D Exploration (Unity)” to step out in 3D.",
      doneEarly: "EVA concluded with a safe return to start. You can now advance to 3D Exploration (Unity).",
    },
    tips: {
      map: "The astronaut walks over Gale's real terrain. The line is the route.",
      vitals: "Body and suit readings. If something goes out of normal, the health status at the top changes.",
      assistant: "The assistant narrates every system decision. Turn on the voice to hear it.",
      foot: "Control the simulation here: start or pause, speed and reset.",
    },
  },
} as const;

const GROUPS: ReadonlyArray<["body" | "suit" | "env", "bodyExplain" | "suitExplain" | "envExplain", readonly string[]]> = [
  ["body", "bodyExplain", ["spo2", "core"]],
  ["suit", "suitExplain", ["co2", "press", "o2pri", "fan", "batt"]],
  ["env", "envExplain", ["dose"]],
];

const fmt0 = (n: number) => (Number.isFinite(n) ? n.toFixed(0) : "—");

function Spark({ values }: { values: readonly number[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    if (values.length < 2) return;
    const lo = Math.min(...values) - 5;
    const hi = Math.max(...values) + 5;
    g.lineWidth = 3;
    g.strokeStyle = "#df8a5d";
    g.beginPath();
    values.forEach((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * c.width;
      const y = c.height - ((v - lo) / Math.max(1, hi - lo)) * (c.height - 8) - 4;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.stroke();
  }, [values]);
  return <canvas ref={ref} className="mws__spark" width={600} height={90} aria-hidden="true" />;
}

function Vital({ v, name, qualityWords, wide }: { v: VitalReading; name: string; qualityWords: Record<string, string>; wide?: boolean }) {
  const bad = v.quality !== "valid";
  return (
    <div className={`mws__vital${wide ? " mws__vital--wide" : ""}`} data-quality={v.quality}>
      <span className="mws__vname">
        {name} <small>{v.label}</small>
      </span>
      <span className="mws__vval">
        <b>{v.value === null ? "—" : v.value.toFixed(v.digits)}</b>
        <small>{v.unit}</small>
      </span>
      {bad ? <span className="mws__vq">{qualityWords[v.quality] ?? v.quality}</span> : null}
    </div>
  );
}

/** Bitácora del asistente (replanLog + historial de la FSM). */
function AssistantLog({ title, voiceLabel }: { title: string; voiceLabel: string }) {
  const state = useTrek();
  const t = MW_TEXTS[state.lang];
  const feed = useMemo(
    () =>
      buildAssistantFeed(state.session.replanLog, state.session.fsm.history).map((f) => ({
        ...f,
        text: engineText(f.text, state.lang),
      })),
    [state.session.replanLog, state.session.fsm.history, state.lang],
  );
  const [voiceOn, setVoiceOn] = useState(false);
  const spokenRef = useRef<string | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const last = feed[feed.length - 1];
    if (!last || last.key === spokenRef.current) return;
    spokenRef.current = last.key;
    if (!voiceOn || last.level === "info" || !("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(last.text.replace(/\[[^\]]*\]\s*/g, ""));
      u.lang = state.lang === "es" ? "es-MX" : "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* voz no disponible */
    }
  }, [feed, voiceOn, state.lang]);

  return (
    <section className="mws__assist" aria-label={title}>
      <div className="mwc__colhead">
        <h3>{title}</h3>
        <span className="mws__assistctl">
          <ProvChip type="SIMULATED" />
          <button
            type="button"
            className="mwc__chipbtn"
            aria-pressed={voiceOn}
            onClick={() => {
              setVoiceOn((v) => !v);
              if (voiceOn && "speechSynthesis" in window) window.speechSynthesis.cancel();
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 6v4h2.5L9 13V3L5.5 6z" />
              <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5" />
            </svg>
            {voiceLabel}
          </button>
        </span>
      </div>
      <ol ref={listRef} className="mws__log" aria-live="polite">
        {feed.length === 0 ? (
          <li data-level="info">
            <time>{missionClock(0).slice(3)}</time>
            <span>{t.assistantIdle}</span>
          </li>
        ) : (
          feed.map((f) => (
            <li key={f.key} data-level={f.level}>
              <time>{missionClock(f.atS).slice(3)}</time>
              <span>{f.text}</span>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

export function SimConsoleTab({
  playing,
  onTogglePlay,
  speed,
  onSpeed,
  hrHistory,
  onOpenHealth,
  onOpenConfirm,
  onOpenEnv,
  onRunScenario,
  onGoUp,
  onGoNext,
  simDone,
}: {
  onOpenHealth: () => void;
  onRunScenario?: (id: string) => void;
  onOpenConfirm?: () => void;
  onOpenEnv?: () => void;
  onGoUp?: () => void;
  onGoNext?: () => void;
  simDone?: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  hrHistory: readonly number[];
}) {
  const state = useTrek();
  const lang = state.lang;
  const c = C[lang];
  const t = MW_TEXTS[lang];
  const tt = TREK_TEXTS[lang];
  const { session, siteInfo } = state;
  const { fsm, latestTelemetryRow, clockS, routeResult: rr } = session;
  const locked = isHumanLockActive(state);
  const [help, setHelp] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  useEffect(() => ensureReadableFonts(), []);

  const vitals = vitalsFromRow(latestTelemetryRow);
  const byId = new Map(vitals.map((v) => [v.id, v]));
  const hr = byId.get("hr");
  const homeAgain =
    session.returning &&
    Math.hypot(session.position.x - session.origin.x, session.position.z - session.origin.z) < 1.5;
  const remainingM = session.activeRoute?.distanceM ?? 0;
  const elapsedMin = session.resources.evaElapsedMin;
  const remainingMin = (session.activeRoute?.durationMin ?? 0) + remainingDwellMin(session);
  const progress =
    session.stops.length > 0
      ? elapsedMin + remainingMin > 0
        ? Math.max(0, Math.min(1, elapsedMin / (elapsedMin + remainingMin)))
        : 0
      : session.walkedM + remainingM > 0
        ? Math.max(0, Math.min(1, session.walkedM / (session.walkedM + remainingM)))
        : 0;
  const marginPct = rr.ok ? rr.resourcePlan.returnMarginPct : Number.NaN;
  const rank = healthRank(fsm.state);
  const isComplete = walkComplete(session) || Boolean(simDone);

  const hint = walkComplete(session)
    ? session.returning || session.stopIdx < session.stops.length
      ? c.hint.doneEarly
      : c.hint.done
    : rank >= healthRank("CRITICAL")
      ? c.hint.critical
      : fsm.state === "CAUTION"
        ? c.hint.caution
        : fsm.state === "FATIGUE"
          ? c.hint.fatigue
          : playing
            ? c.hint.normal
            : clockS > 0
              ? c.hint.paused
              : c.hint.idle;
  const ctaLabel = playing ? c.pause : clockS > 0 ? c.resume : c.start;
  const solo = session.missionProfile === "solo" && session.live !== null;

  return (
    <div className={`mwc mwc--sim${solo ? " sim--solo" : ""}`} data-help={help ? "true" : undefined}>
      <div className="mwc__plate">
        <span className="mwc__screw" aria-hidden="true" />
        <span aria-hidden="true">{c.plate}</span>
        <span className="mwc__simnote">REAL · NASA + SIMULATED</span>
        <span className="mwc__tag" aria-hidden="true">
          MWK-EVA-03
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
          <span className="mws__clock" aria-label={c.clock}>
            <small>{c.clock}</small>
            <b>{missionClock(clockS)}</b>
          </span>
          <div className="mws__headright">
            <button
              type="button"
              className="mwc__chipbtn"
              aria-expanded={showGuide}
              onClick={() => setShowGuide((v) => !v)}
            >
              {showGuide ? c.guideToggleHide : c.guideToggleShow}
            </button>
            <button type="button" className="mws__healthbtn" data-state={fsm.state} onClick={onOpenHealth}>
              <span className="mws__shape" aria-hidden="true" />
              <span>
                <b>
                  {c.health}: {tt.healthStates[fsm.state]}
                  {fsm.requiresHumanConfirmation ? ` · ${c.locked}` : ""}
                </b>
                <small>{c.openHealth} →</small>
              </span>
            </button>
            <button type="button" className="mwc__helpbtn" aria-pressed={help} onClick={() => setHelp((v) => !v)}>
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

          <div className="mws__body">
            {/* ---------- 1. Mapa Isométrico ---------- */}
            <section className="mws__map-wrap" aria-label={`${siteInfo.name}`}>
              <div className="mwc__map-explain">
                <h3>{c.mapTitle}</h3>
                <p>{c.mapExplain}</p>
              </div>
              <div className="mws__map">
                <p className="mws__maptag">
                  <b>{siteInfo.name}</b> · {siteInfo.dataType} · {siteInfo.resolutionM} m
                </p>
                {session.returning ? (
                  <p className="mws__returning" role="status" data-home={homeAgain ? "true" : undefined}>
                    {homeAgain
                      ? lang === "es"
                        ? "✓ De vuelta en el punto de partida. Pulsa «Recalcular la ruta» para intentar el destino otra vez."
                        : "✓ Back at the starting point. Press «Recalculate the route» to try the goal again."
                      : lang === "es"
                        ? "↩ Regresando al punto de partida: la ruta al destino se volvió inadmisible"
                        : "↩ Returning to start: the route to the goal became inadmissible"}
                  </p>
                ) : null}
                {onOpenEnv ? (
                  <div className="mws__envchip">
                    <MarsEnvChip onOpen={onOpenEnv} />
                  </div>
                ) : null}
                <IsoMap />
                {help ? (
                  <p className="mwc__tip mwc__tip--map">
                    <b>1</b> {c.tips.map}
                  </p>
                ) : null}
                <div className="mws__meters">
                  <div className="mws__meter">
                    <span>
                      {c.progress} <b>{Math.round(progress * 100)} %</b>
                    </span>
                    <span className="mwc__bar" aria-hidden="true">
                      <i style={{ width: `${progress * 100}%` }} />
                    </span>
                    <small className="mwc__stat-help">{c.progressHelp}</small>
                  </div>
                  <div className="mws__meter">
                    <span>
                      {c.margin} <b>{rr.ok ? `${fmt0(marginPct)} %` : "—"}</b>
                    </span>
                    <span className="mwc__bar" aria-hidden="true">
                      <i
                        style={{ width: `${rr.ok ? Math.max(0, Math.min(100, marginPct)) : 0}%` }}
                        data-high={rr.ok && marginPct < 25 ? "true" : undefined}
                      />
                    </span>
                    <small className="mwc__stat-help">{c.marginHelp}</small>
                  </div>
                </div>
                {session.stops.length > 0 ? <TourPanel compact /> : null}
              </div>
            </section>

            {/* ---------- 2. Signos + 3. Centro de Control Dinámico ---------- */}
            <div className="mws__side">
              <section className="mws__vitals" aria-label={t.healthTitle}>
                <div className="mwc__colhead">
                  <h3>{c.vitalsTitle}</h3>
                </div>
                <p className="mwc__sec-explain">{c.vitalsExplain}</p>
                <HuellaSourcePicker />
                {hr ? (
                  <div className="mws__hr">
                    <Vital v={hr} name={c.names["hr"] ?? hr.label} qualityWords={c.quality} wide />
                    <Spark values={hrHistory} />
                  </div>
                ) : null}
                {GROUPS.map(([g, explainKey, ids]) => (
                  <div key={g} className="mws__group">
                    <h3 className="mws__ghead">{c[g]}</h3>
                    <p className="mwc__stat-help">{c[explainKey]}</p>
                    <div className="mws__grid">
                      {ids.map((id) => {
                        const v = byId.get(id);
                        return v ? (
                          <Vital key={id} v={v} name={c.names[id] ?? v.label} qualityWords={c.quality} />
                        ) : null;
                      })}
                    </div>
                  </div>
                ))}
                {latestTelemetryRow ? null : <p className="mwc__help">{c.noSample}</p>}
                {help ? (
                  <p className="mwc__tip mwc__tip--inline">
                    <b>2</b> {c.tips.vitals}
                  </p>
                ) : null}
              </section>
              <DynamicDock
                solo={solo}
                assistant={<AssistantLog title={c.assistant} voiceLabel={c.voice} />}
                {...(onOpenConfirm ? { onOpenConfirm } : {})}
                {...(onRunScenario ? { onRunScenario } : {})}
              />
              {help ? (
                <p className="mwc__tip mwc__tip--inline">
                  <b>3</b> {c.tips.assistant}
                </p>
              ) : null}
            </div>
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
                ↑ {lang === "es" ? "Subir a Planeación" : "Go up to Planning"}
              </button>
            ) : null}
            <div className="mws__speed" role="group" aria-label={c.speed}>
              <span>{c.speed}</span>
              {SPEEDS.map((s) => (
                <button key={s} type="button" aria-pressed={speed === s} title={c.speedHelp(s)} onClick={() => onSpeed(s)}>
                  ×{s}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn--ghost mwc__btn"
              onClick={() => computeOptimalRoute()}
            >
              {lang === "es" ? "⟳ Recalcular la ruta" : "⟳ Recalculate the route"}
            </button>
            <button
              type="button"
              className="btn btn--ghost mwc__btn"
              disabled={locked}
              title={locked ? t.resetLocked : t.reset}
              onClick={() => dispatchTrek({ type: "resetSession" })}
            >
              {c.reset}
            </button>
            <button type="button" className="mwc__cta is-live" onClick={onTogglePlay} aria-pressed={playing}>
              {playing ? (
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 2h2v8H3zM7 2h2v8H7z" />
                </svg>
              ) : (
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 1.8v8.4L10 6z" />
                </svg>
              )}
              {ctaLabel}
            </button>
            {isComplete && onGoNext ? (
              <button type="button" className="mwc__cta is-live mwc__cta--next" onClick={onGoNext}>
                {c.goToUnity}
              </button>
            ) : null}
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

const INCIDENTS = [
  "fatiga_progresiva",
  "estres_termico",
  "falla_ventilador",
  "emergencia_medica",
  "perdida_sensores",
] as const;

type DockTab = "assistant" | "events" | "health" | "astar";

function DynamicDock({
  solo,
  assistant,
  onOpenConfirm,
  onRunScenario,
}: {
  solo: boolean;
  assistant: ReactNode;
  onOpenConfirm?: () => void;
  onRunScenario?: (id: string) => void;
}) {
  const state = useTrek();
  const es = state.lang === "es";
  const t = MW_TEXTS[state.lang];
  const { session, activeScenarioId, scenarioStepIdx } = state;
  const locked = isHumanLockActive(state);
  const [tab, setTab] = useState<DockTab>("assistant");
  const tabs: ReadonlyArray<[DockTab, string]> = [
    ["assistant", es ? "Asistente" : "Assistant"],
    ["events", es ? "Eventos simulados" : "Simulated events"],
    ["health", es ? "Salud · parámetros" : "Health · params"],
    ["astar", es ? "A* · pesos" : "A* · weights"],
  ];

  const tabExplain: Record<DockTab, string> = {
    assistant: es
      ? "Aquí el sistema registra y narra en tiempo real cada cambio de salud o desvío de ruta."
      : "Here the system logs and narrates every health change or route detour in real time.",
    events: es
      ? "Pon a prueba al sistema disparando tormentas solares, fallas del traje o escenarios guiados."
      : "Stress-test the system by triggering solar storms, suit faults, or guided scenarios.",
    health: es
      ? "Ajusta las características físicas del astronauta o cambia la fuente de datos HUELLA."
      : "Adjust the astronaut's physical parameters or switch the HUELLA telemetry source.",
    astar: es
      ? "Observa cómo los pesos del algoritmo A* se adaptan solos cuando sube el cansancio o el riesgo."
      : "Watch how the A* algorithm weights adapt automatically when fatigue or risk rises.",
  };

  return (
    <section className="mws__dock" aria-label={es ? "3 · Centro de control dinámico" : "3 · Dynamic control center"}>
      <div className="mws__dockhead">
        <h3>{es ? "3 · Centro de control dinámico (Opcional)" : "3 · Dynamic control center (Optional)"}</h3>
        <p>{tabExplain[tab]}</p>
      </div>
      <div className="mws__docktabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mws__dockbody" role="tabpanel">
        {tab === "assistant" ? (
          solo ? (
            <div className="mws__dockstack">
              <FsmDiagram {...(onOpenConfirm ? { onOpenConfirm } : {})} />
              {assistant}
            </div>
          ) : (
            assistant
          )
        ) : null}

        {tab === "events" ? (
          <div className="mws__dockstack">
            <AutoEvents es={es} />
            <h4 className="mws__dockh">{es ? "Eventos manuales" : "Manual events"}</h4>
            <p className="mwc__help">
              {es
                ? "Datos SIMULADOS: toca cualquier botón para inyectar un incidente y ver cómo reaccionan el mapa, la salud y la ruta A* en vivo."
                : "SIMULATED data: tap any button to inject an incident and see how the map, health, and A* route react live."}
            </p>
            {onRunScenario ? (
              <>
                <h4 className="mws__dockh">{t.scenarios}</h4>
                <div className="mws__dockbtns">
                  {TREK_SCENARIOS.map((sc) => {
                    const idx = activeScenarioId === sc.id ? scenarioStepIdx : 0;
                    const next = sc.steps[idx];
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        className="mws__dockbtn"
                        aria-pressed={activeScenarioId === sc.id}
                        disabled={locked}
                        title={locked ? t.resetLocked : undefined}
                        onClick={() => onRunScenario(sc.id)}
                      >
                        <b>▶ {es ? sc.titleEs : sc.titleEn}</b>
                        <small>
                          {t.nextStep} {idx + 1}/{sc.steps.length}:{" "}
                          {next ? (es ? next.labelEs : next.labelEn) : "—"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
            <h4 className="mws__dockh">{t.inject}</h4>
            <div className="mws__dockchips">
              {INCIDENTS.map((inc) => (
                <button
                  key={inc}
                  type="button"
                  className="mwc__chipbtn"
                  onClick={() =>
                    dispatchTrek({
                      type: "simEvent",
                      event: { kind: "health-incident", incident: inc, simulated: true },
                    })
                  }
                >
                  + {t.incidents[inc]}
                </button>
              ))}
              <button
                type="button"
                className="mwc__chipbtn"
                aria-pressed={session.sepAlertActive}
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
              >
                ☀ {t.sep}: {session.sepAlertActive ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                className="mwc__chipbtn"
                onClick={() =>
                  dispatchTrek({
                    type: "simEvent",
                    event: { kind: "battery-drop", dropPct: 25, simulated: true },
                  })
                }
              >
                {t.battery}
              </button>
              <button
                type="button"
                className="mwc__chipbtn"
                onClick={() => dispatchTrek({ type: "clearStorms" })}
              >
                {t.clearStorms}
              </button>
            </div>
          </div>
        ) : null}

        {tab === "health" ? (
          solo ? (
            <SoloConsole assistant={assistant} />
          ) : (
            <div className="mws__dockstack">
              <p className="mwc__help">
                {es
                  ? "Activa al astronauta en vivo para editar edad, masa, consumo, presión del traje, fallas y radiación. Los signos vitales se recalculan en cada tick."
                  : "Turn on the live astronaut to edit age, mass, consumption, suit pressure, faults and radiation. Vitals are recomputed every tick."}
              </p>
              <button
                type="button"
                className="mws__dockbtn"
                disabled={locked}
                title={locked ? t.lockedByHuman : undefined}
                onClick={() => dispatchTrek({ type: "setMissionProfile", profile: "solo" })}
              >
                <b>{es ? "▶ Activar astronauta en vivo" : "▶ Turn on live astronaut"}</b>
                <small>{t.missionProfiles.solo}</small>
              </button>
              <h4 className="mws__dockh">{es ? "Fuente de telemetría" : "Telemetry source"}</h4>
              <HuellaSourcePicker />
            </div>
          )
        ) : null}

        {tab === "astar" ? (
          <div className="mws__dockstack">
            <PhysioWeightsPanel />
            <WeightTuner />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Eventos automáticos según precedentes reales (core/trek/sim/historicalEvents.ts). */
function AutoEvents({ es }: { es: boolean }) {
  const bus = useHistoricalBus();
  const [showCatalog, setShowCatalog] = useState(false);
  return (
    <div className="mws__auto">
      <div className="mws__autohead">
        <h4 className="mws__dockh">
          {es ? "Eventos automáticos · precedentes reales" : "Automatic events · real precedents"}
        </h4>
        <button
          type="button"
          className="mwc__chipbtn"
          aria-pressed={bus.enabled}
          onClick={() => setHistoricalEnabled(!bus.enabled)}
        >
          {bus.enabled ? "ON" : "OFF"}
        </button>
      </div>
      <p className="mwc__help">
        {es
          ? "Durante la caminata, los incidentes ocurren solos según lo que ya pasó en EVAs reales y en Marte. Su probabilidad sube con la estación de polvo (Ls), la opacidad τ de Gale, los SEP de DONKI, el tiempo de EVA y la pendiente."
          : "During the walk, incidents happen on their own based on what already happened in real EVAs and on Mars. Their odds rise with the dust season (Ls), Gale opacity τ, DONKI SEPs, EVA time and slope."}
      </p>
      <div className="mws__dockchips" role="group" aria-label={es ? "Intensidad" : "Intensity"}>
        <button
          type="button"
          className="mwc__chipbtn"
          aria-pressed={bus.intensity === "realistic"}
          onClick={() => setHistoricalIntensity("realistic")}
          title={es ? "Tasas históricas por hora de misión" : "Historical rates per mission hour"}
        >
          {es ? "Realista" : "Realistic"}
        </button>
        <button
          type="button"
          className="mwc__chipbtn"
          aria-pressed={bus.intensity === "demo"}
          onClick={() => setHistoricalIntensity("demo")}
          title={
            es
              ? "Tasas ×12 para que ocurran en caminatas cortas de demostración"
              : "Rates ×12 so they happen in short demo walks"
          }
        >
          {es ? "Demo (×12)" : "Demo (×12)"}
        </button>
        <button
          type="button"
          className="mwc__chipbtn"
          aria-expanded={showCatalog}
          onClick={() => setShowCatalog((v) => !v)}
        >
          {es ? "Ver catálogo" : "See catalogue"} ({HISTORICAL_INCIDENTS.length})
        </button>
      </div>
      {bus.log.length === 0 ? (
        <p className="mwc__help">
          {es
            ? "Aún no ocurre ningún incidente. Inicia la caminata."
            : "No incident yet. Start the walk."}
        </p>
      ) : (
        <ol className="mws__autolog">
          {bus.log.map((f) => (
            <li key={`${f.id}-${f.atS}`}>
              <b>
                {missionClock(f.atS).slice(3)} · {es ? f.incident.titleEs : f.incident.titleEn}
              </b>
              <small>{es ? f.incident.refEs : f.incident.refEn}</small>
              {f.realTrigger ? (
                <small className="mws__autoreal">
                  REAL · {es ? "disparado por DONKI" : "triggered by DONKI"}
                </small>
              ) : (
                <small className="mws__autosim">SIMULATED</small>
              )}
            </li>
          ))}
        </ol>
      )}
      {showCatalog ? (
        <ul className="mws__autolog mws__autolog--cat">
          {HISTORICAL_INCIDENTS.map((i) => (
            <li key={i.id}>
              <b>
                {es ? i.titleEs : i.titleEn}
                {i.soloOnly ? (es ? " · solo astronauta en vivo" : " · live astronaut only") : ""}
              </b>
              <small>{es ? i.refEs : i.refEn}</small>
              {i.liveDataEs ? (
                <small className="mws__autoreal">
                  REAL · {es ? i.liveDataEs : i.liveDataEn}
                </small>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
