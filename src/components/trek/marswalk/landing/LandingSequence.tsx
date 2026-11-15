/**
 * M.I.Y.H. · Secuencia de aterrizaje (≈50 s): escena 3D + HUD + subtítulos + sonido.
 * Esc o "Saltar" terminan en cualquier momento. Al final llama onDone() y la cubierta abre el planeador.
 * Solo vista: no lee ni escribe el estado del motor.
 */
import { useEffect, useRef, useState } from "react";
import type { TrekLang } from "../../i18n";
import type { LandingAudio } from "./landingAudio";
import { LandingScene } from "./LandingScene";
import {
  CALLOUTS,
  COCKPIT_START_S,
  FADE_OUT_S,
  FINAL_TEXT_S,
  GROUND_START_S,
  LANDING_TOTAL_S,
  PHASES,
  TOUCHDOWN_S,
  UI_TEXT,
  envelope,
  formatAltitude,
  formatVelocity,
  phaseIndexAt,
  sampleFlight,
} from "./script";
import { ensureReadableFonts } from "./fonts";
import "./landing.css";

interface Hud {
  t: number;
  phase: number;
  alt: string;
  unit: string;
  vel: string;
  altFrac: number;
}

const SUB_HOLD_S = 3.4;

const smooth = (a: number, b: number, x: number) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

export default function LandingSequence({
  lang,
  audio,
  soundOn,
  onToggleSound,
  onDone,
}: {
  lang: TrekLang;
  audio: LandingAudio;
  soundOn: boolean;
  onToggleSound: () => void;
  onDone: () => void;
}) {
  const ui = UI_TEXT[lang];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const skipRef = useRef<HTMLButtonElement | null>(null);
  const doneRef = useRef(false);
  const finish = useRef(onDone);
  finish.current = onDone;
  const [hud, setHud] = useState<Hud>({ t: 0, phase: 0, alt: "400", unit: "km", vel: "", altFrac: 0 });
  const [sub, setSub] = useState<{ who: "crew" | "capcom"; text: string; until: number } | null>(null);
  const [webgl, setWebgl] = useState(true);

  const end = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    audio.fadeOut();
    finish.current();
  };

  useEffect(() => {
    audio.setMuted(!soundOn);
  }, [soundOn, audio]);

  useEffect(() => {
    ensureReadableFonts();
    skipRef.current?.focus({ preventScroll: true });
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let scene: LandingScene | null = null;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        scene = new LandingScene(canvas, { reducedMotion: reduced });
      } catch {
        setWebgl(false);
      }
    }
    const resize = () => {
      const el = rootRef.current;
      if (el && scene) scene.resize(el.clientWidth, el.clientHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    // La voz de radio siempre va en inglés; los subtítulos siguen el idioma de la página
    void audio.start(
      "en",
      CALLOUTS.map((c) => c.id),
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        end();
      }
    };
    window.addEventListener("keydown", onKey);

    const fired = new Set<string>();
    let thudDone = false;
    let raf = 0;
    let last = performance.now();
    const start = last;
    let lastHud = 0;

    const frame = (now: number) => {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const env = envelope(t);

      scene?.render(t, dt);
      audio.setLevels(env);
      if (!thudDone && t >= TOUCHDOWN_S) {
        thudDone = true;
        audio.thud();
      }
      for (const c of CALLOUTS) {
        if (t >= c.t && !fired.has(c.id)) {
          fired.add(c.id);
          void audio.say(c.id, c.text.en, c.who);
          setSub({ who: c.who, text: c.text[lang], until: t + SUB_HOLD_S });
        }
      }

      // Variables CSS por cuadro (sin re-render de React)
      const root = rootRef.current;
      if (root) {
        root.style.setProperty("--plasma", env.plasma.toFixed(3));
        root.style.setProperty("--dust", env.dust.toFixed(3));
        // Bruma que tapa suavemente el paso del espacio a la atmósfera (sin cortes ni destellos)
        const hazeIn = smooth(GROUND_START_S - 1.4, GROUND_START_S - 0.2, t);
        const hazeOut = 1 - smooth(GROUND_START_S + 0.3, GROUND_START_S + 2.2, t);
        root.style.setProperty("--haze", Math.min(hazeIn, hazeOut).toFixed(3));
        // La cabina "se acerca" alrededor de la cámara; la viñeta se oscurece al mismo tiempo
        root.style.setProperty("--cabin", smooth(COCKPIT_START_S - 1.6, COCKPIT_START_S, t).toFixed(3));
        root.style.setProperty("--fade", Math.max(0, Math.min(1, (t - FADE_OUT_S) / 1.4)).toFixed(3));
      }

      if (now - lastHud > 90) {
        lastHud = now;
        const { altM, velMs } = sampleFlight(t);
        const a = formatAltitude(altM);
        setHud({
          t,
          phase: phaseIndexAt(t),
          alt: a.value,
          unit: a.unit,
          vel: formatVelocity(velMs, lang),
          altFrac: 1 - Math.log10(altM + 1) / Math.log10(400_001),
        });
      }

      if (t >= LANDING_TOTAL_S) {
        end();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      scene?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSub = sub && hud.t < sub.until;
  const finalOn = hud.t >= FINAL_TEXT_S;
  const landed = hud.t >= TOUCHDOWN_S;
  const phase = PHASES[hud.phase]!;

  return (
    <div
      ref={rootRef}
      className={`ld${landed ? " is-landed" : ""}${finalOn ? " is-final" : ""}${webgl ? "" : " is-nogl"}`}
      role="dialog"
      aria-modal="true"
      aria-label={ui.dialog}
    >
      <canvas ref={canvasRef} className="ld__canvas" aria-hidden="true" />
      <div className="ld__plasma" aria-hidden="true" />
      <div className="ld__dust" aria-hidden="true" />
      <div className="ld__haze" aria-hidden="true" />
      <div className="ld__vignette" aria-hidden="true" />

      <header className="ld__top">
        <p className="ld__kicker">
          <span className="ld__dot" aria-hidden="true" />
          M.I.Y.H. · {String(hud.phase + 1).padStart(2, "0")} / {String(PHASES.length).padStart(2, "0")}
        </p>
        <div className="ld__actions">
          <button
            type="button"
            className="ld__btn"
            aria-pressed={!soundOn}
            onClick={onToggleSound}
            aria-label={soundOn ? ui.mute : ui.unmute}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4V5z" />
              {soundOn ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="M16 9l5 6M21 9l-5 6" />}
            </svg>
          </button>
          <button ref={skipRef} type="button" className="ld__btn ld__btn--skip" onClick={end}>
            {ui.skip} <kbd>Esc</kbd>
          </button>
        </div>
      </header>

      {!finalOn ? (
        <div className="ld__readout">
          <p className="ld__label">{ui.altitude}</p>
          <p className="ld__alt">
            <span>{hud.alt}</span>
            <small>{hud.unit}</small>
          </p>
          <p className="ld__vel">{hud.vel}</p>
          <p className="ld__phase" aria-live="polite">
            {phase.name[lang]}
          </p>
          <p className="ld__note">{phase.note[lang]}</p>
        </div>
      ) : null}

      <ol className="ld__phases" aria-hidden="true">
        {PHASES.map((p, i) => (
          <li key={i} data-state={i < hud.phase ? "done" : i === hud.phase ? "now" : "next"}>
            <span />
            {p.name[lang]}
          </li>
        ))}
      </ol>

      <div className="ld__alti" aria-hidden="true">
        <span>400 km</span>
        <span>10 km</span>
        <span>100 m</span>
        <span>0</span>
        <i style={{ top: `${(hud.altFrac * 100).toFixed(1)}%` }} />
      </div>

      <p className={`ld__sub${showSub ? " is-on" : ""}`} aria-live="polite">
        {showSub ? (
          <>
            <b>{sub.who === "crew" ? ui.crew : ui.capcom}</b> {sub.text}
          </>
        ) : null}
      </p>

      {finalOn ? (
        <div className="ld__final">
          <p className="ld__finalkick">{ui.finalKicker}</p>
          <h2 className="ld__finaltitle">
            {ui.final1}
            <br />
            <em>{ui.final2}</em>
          </h2>
        </div>
      ) : null}

      <div className="ld__fade" aria-hidden="true" />
    </div>
  );
}
