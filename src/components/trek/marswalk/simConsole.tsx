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
import { healthRank } from "@/core/trek/contracts";
import { dispatchTrek, isHumanLockActive, useTrek } from "@/state/trekStore";
import { TREK_TEXTS } from "../i18n";
import { MW_TEXTS } from "./i18n";
import { IsoMap } from "./IsoMap";
import { ensureReadableFonts } from "./landing/fonts";
import { buildAssistantFeed, missionClock, vitalsFromRow, type VitalReading } from "./model";
import { SPEEDS, type Speed } from "./panels";
import { ProvChip } from "./ui";
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
    () => buildAssistantFeed(state.session.replanLog, state.session.fsm.history),
    [state.session.replanLog, state.session.fsm.history],
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
}: {
  onOpenHealth: () => void;
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
  const routeMin = session.activeRoute?.durationMin ?? 0;
  const progress = routeMin > 0 ? Math.max(0, Math.min(1, session.resources.evaElapsedMin / routeMin)) : 0;
  const marginPct = rr.ok ? rr.resourcePlan.returnMarginPct : Number.NaN;
  const rank = healthRank(fsm.state);
  const dynamic =
    session.storms.some((s) => s.active) || session.sepAlertActive || session.telemetry.incident !== "nominal";

  const hint =
    rank >= healthRank("CRITICAL")
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

  return (
    <div className="mwc mwc--sim" data-help={help ? "true" : undefined}>
      <div className="mwc__plate">
        <span className="mwc__screw" aria-hidden="true" />
        <span aria-hidden="true">{c.plate}</span>
        <span className="mwc__simnote">{dynamic ? t.simBand : t.simBandNominal}</span>
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
        </header>

        <div className="mws__body">
          {/* ---------- Mapa ---------- */}
          <section className="mws__map" aria-label={`${siteInfo.name}`}>
            <p className="mws__maptag">
              <b>{siteInfo.name}</b> · {siteInfo.dataType} · {siteInfo.resolutionM} m
            </p>
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
          </section>

          {/* ---------- Signos + asistente ---------- */}
          <div className="mws__side">
            <section className="mws__vitals" aria-label={t.healthTitle}>
              {hr ? (
                <div className="mws__hr">
                  <Vital v={hr} name={c.names.hr ?? hr.label} qualityWords={c.quality} wide />
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
            <AssistantLog title={c.assistant} voiceLabel={c.voice} />
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
