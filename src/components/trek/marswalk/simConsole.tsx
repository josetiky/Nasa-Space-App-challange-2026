/**
 * M.I.Y.H. · 03 Simulación como CONSOLA DE LA NAVE (solo presentación).
 *
 * Misma información que SimTab (panels.tsx), reorganizada para leerse de un vistazo:
 *   izquierda  el mismo IsoMap + avance de la ruta y margen de regreso
 *   derecha    signos del cuerpo y del traje con nombres claros + bitácora del asistente
 *   abajo      reproducir/pausar, velocidad, reiniciar y salud
 *
 * Lee useTrek() y solo emite los mismos eventos que SimTab (onTogglePlay, onSpeed, resetSession).
 * No aplica umbrales: el nivel de alerta lo decide la FSM HUELLA, aquí solo se muestra.
 * SimTab sigue existiendo en panels.tsx por si se quiere volver a la vista anterior.
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
    plate: "NAVE M.I.Y.H. · CONSOLA 3 · CAMINATA",
    title: "Caminata",
    subtitle: "Simulación en vivo",
    help: "Ayuda",
    clock: "Tiempo de caminata",
    health: "Salud",
    openHealth: "Salud y contingencias",
    locked: "bloqueado",
    progress: "Avance de la ruta",
    margin: "Oxígeno de sobra al volver",
    body: "Cuerpo",
    suit: "Traje",
    env: "Ambiente",
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
    noSample: "Aún no hay datos: pulsa INICIAR.",
    assistant: "Asistente",
    voice: "Guía por voz",
    start: "Iniciar caminata",
    resume: "Continuar",
    pause: "Pausar",
    speed: "Velocidad",
    speedHelp: (s: number) => `1 s real = ${s} s de misión`,
    reset: "Reiniciar",
    next: "Ahora",
    hint: {
      idle: "Pulsa INICIAR para ver la caminata simulada.",
      paused: "Caminata en pausa.",
      normal: "La caminata avanza. Observa el pulso y el oxígeno.",
      fatigue: "Fatiga detectada: el sistema ajusta la ruta.",
      caution: "Precaución: revisa la salud del equipo.",
      critical: "Emergencia: abre Salud y contingencias.",
      done: "EVA terminada: el equipo llegó con todas las paradas resueltas.",
      doneEarly: "EVA terminada antes de lo planeado: el equipo volvió al punto de partida.",
    },
    tips: {
      map: "El astronauta camina sobre el terreno real de Gale. La línea es su ruta.",
      vitals: "Signos del cuerpo y del traje. Si algo se sale de lo normal, el estado de salud de arriba cambia.",
      assistant: "El asistente narra cada decisión del sistema. Activa la voz para escucharla.",
      foot: "Aquí controlas la simulación: iniciar o pausar, la velocidad y reiniciar.",
    },
  },
  en: {
    plate: "M.I.Y.H. SHIP · CONSOLE 3 · WALK",
    title: "The walk",
    subtitle: "Live simulation",
    help: "Help",
    clock: "Walk time",
    health: "Health",
    openHealth: "Health & contingencies",
    locked: "locked",
    progress: "Route progress",
    margin: "Oxygen to spare on return",
    body: "Body",
    suit: "Suit",
    env: "Environment",
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
    noSample: "No data yet: press START.",
    assistant: "Assistant",
    voice: "Voice guide",
    start: "Start the walk",
    resume: "Resume",
    pause: "Pause",
    speed: "Speed",
    speedHelp: (s: number) => `1 real s = ${s} mission s`,
    reset: "Reset",
    next: "Now",
    hint: {
      idle: "Press START to watch the simulated walk.",
      paused: "Walk paused.",
      normal: "The walk is under way. Watch heart rate and oxygen.",
      fatigue: "Fatigue detected: the system adjusts the route.",
      caution: "Caution: check the crew's health.",
      critical: "Emergency: open Health & contingencies.",
      done: "EVA complete: the crew arrived with every stop resolved.",
      doneEarly: "EVA ended early: the crew went back to the start.",
    },
    tips: {
      map: "The astronaut walks over Gale's real terrain. The line is the route.",
      vitals: "Body and suit readings. If something goes out of normal, the health status at the top changes.",
      assistant: "The assistant narrates every system decision. Turn on the voice to hear it.",
      foot: "Control the simulation here: start or pause, speed and reset.",
    },
  },
} as const;

const GROUPS: ReadonlyArray<["body" | "suit" | "env", readonly string[]]> = [
  ["body", ["spo2", "core"]],
  ["suit", ["co2", "press", "o2pri", "fan", "batt"]],
  ["env", ["dose"]],
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

/** Bitácora del asistente (misma fuente que AssistantPanel: replanLog + historial de la FSM). */
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
}: {
  onOpenHealth: () => void;
  onRunScenario?: (id: string) => void;
  onOpenConfirm?: () => void;
  onOpenEnv?: () => void;
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
  useEffect(() => ensureReadableFonts(), []);

  const vitals = vitalsFromRow(latestTelemetryRow);
  const byId = new Map(vitals.map((v) => [v.id, v]));
  const hr = byId.get("hr");
  const homeAgain =
    session.returning &&
    Math.hypot(session.position.x - session.origin.x, session.position.z - session.origin.z) < 1.5;
  // Avance real: metros recorridos sobre (recorridos + lo que falta de la ruta activa). Con paradas
  // científicas cuenta el tiempo de EVA: el trabajo en las paradas también es avance de la misión.
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
  // Misión individual: astronauta en vivo con máquina de estados visible y fallas en el camino
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

        <div className="mws__body">
          {/* ---------- Mapa ---------- */}
          <section className="mws__map" aria-label={`${siteInfo.name}`}>
            <p className="mws__maptag">
              <b>{siteInfo.name}</b> · {siteInfo.dataType} · {siteInfo.resolutionM} m
            </p>
            {session.returning ? (
              <p className="mws__returning" role="status" data-home={homeAgain ? "true" : undefined}>
                {homeAgain
                  ? lang === "es"
                    ? "✓ De vuelta en el punto de partida. Pulsa «Recalcular con A*» para intentar el destino otra vez."
                    : "✓ Back at the starting point. Press «Recompute with A*» to try the goal again."
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
              </div>
            </div>
            {session.stops.length > 0 ? <TourPanel compact /> : null}
          </section>

          {/* ---------- Signos + asistente ---------- */}
          <div className="mws__side">
            <section className="mws__vitals" aria-label={t.healthTitle}>
              <HuellaSourcePicker />
              {hr ? (
                <div className="mws__hr">
                  <Vital v={hr} name={c.names["hr"] ?? hr.label} qualityWords={c.quality} wide />
                  <Spark values={hrHistory} />
                </div>
              ) : null}
              {GROUPS.map(([g, ids]) => (
                <div key={g} className="mws__group">
                  <h3 className="mws__ghead">{c[g]}</h3>
                  <div className="mws__grid">
                    {ids.map((id) => {
                      const v = byId.get(id);
                      return v ? <Vital key={id} v={v} name={c.names[id] ?? v.label} qualityWords={c.quality} /> : null;
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

        <footer className="mwc__foot">
          <p className="mwc__hint" aria-live="polite">
            <span className="mwc__nexttag">{c.next}</span>
            {hint}
          </p>
          <div className="mwc__actions">
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
              {lang === "es" ? "⟳ Recalcular con A*" : "⟳ Recompute with A*"}
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

/**
 * Datos dinámicos de la caminata, siempre visibles en la consola 03:
 *   Asistente     bitácora de replanificación + FSM (misión individual)
 *   Eventos       escenarios e inyección de eventos SIMULADOS → el mapa y A* reaccionan en vivo
 *   Salud         parámetros del astronauta en vivo (editables) o activarlo
 *   A*            pesos fisiológicos dinámicos + perfil de pesos del costo
 * Solo emite los mismos dispatchTrek(...) que HealthTab / SoloConsole / WeightTuner.
 */
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

  return (
    <section className="mws__dock" aria-label={es ? "Datos dinámicos" : "Dynamic data"}>
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
                ? "Datos SIMULADOS: cada evento cambia el mapa, la salud y la ruta A* en tiempo real."
                : "SIMULATED data: each event changes the map, health and the A* route in real time."}
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
