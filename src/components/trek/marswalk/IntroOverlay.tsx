/**
 * M.I.Y.H. · Intro narrada (intro/intro.js + timeline.js del front): video pre-grabado con la voz,
 * tarjeta negra con el texto al ritmo de la narración, subtítulos, barra de progreso y final "MarsWalk".
 * Al terminar (o con "Saltar intro" / Esc) se pasa a la pestaña MarsWalk.
 */
import { useEffect, useRef, useState } from "react";
import type { TrekLang } from "../i18n";

interface Beat {
  readonly kicker: string;
  readonly text: Readonly<Record<TrekLang, string>>;
  readonly retro?: boolean;
  readonly final?: boolean;
}

const BEATS: readonly Beat[] = [
  {
    kicker: "Archive · 1965",
    retro: true,
    text: {
      en: "In July 1965, Mariner 4 sent back our first close-up look at Mars.",
      es: "En julio de 1965, Mariner 4 nos envió la primera mirada de cerca a Marte.",
    },
  },
  {
    kicker: "Orbiters · 1971 → today",
    text: {
      en: "For decades, orbiters mapped its canyons, craters, and buried water ice.",
      es: "Durante décadas, los orbitadores cartografiaron sus cañones, cráteres y hielo enterrado.",
    },
  },
  {
    kicker: "Entry · descent · landing",
    text: {
      en: "Then, rovers touched down—lowered by rocket-powered sky cranes.",
      es: "Después llegaron los rovers, bajados por grúas aéreas propulsadas por cohetes.",
    },
  },
  {
    kicker: "Gale crater · 2013",
    text: {
      en: "Inside Gale Crater, Curiosity drilled into ancient rock, proving Mars could once support life.",
      es: "Dentro del cráter Gale, Curiosity perforó roca antigua y demostró que Marte pudo albergar vida.",
    },
  },
  {
    kicker: "Jezero crater · 2021",
    text: {
      en: "Today, we’ve scouted its skies, produced oxygen, and charted the terrain.",
      es: "Hoy hemos explorado su cielo, producido oxígeno y cartografiado el terreno.",
    },
  },
  {
    kicker: "Next",
    text: {
      en: "Robots led the way. The next footprint is ours.",
      es: "Los robots abrieron el camino. La próxima huella es nuestra.",
    },
  },
  { kicker: "MarsWalk", final: true, text: { en: "This is MarsWalk.", es: "Esto es MarsWalk." } },
];

const PROMPT: Readonly<Record<TrekLang, string>> = {
  en: "> plan your walk on Mars",
  es: "> planea tu caminata en Marte",
};

interface TimelineJson {
  readonly beats: ReadonlyArray<{ start: number; dur: number; voice: number; cardShare: number }>;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function IntroOverlay({
  lang,
  muted,
  onDone,
}: {
  lang: TrekLang;
  muted: boolean;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [variant] = useState<"landscape" | "portrait">(() =>
    typeof window !== "undefined" && window.innerHeight > window.innerWidth
      ? "portrait"
      : "landscape",
  );
  const [timeline, setTimeline] = useState<TimelineJson | null>(null);
  const [t, setT] = useState(0);
  const doneRef = useRef(false);
  const finish = useRef(onDone);
  finish.current = onDone;

  const end = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    videoRef.current?.pause();
    finish.current();
  };

  useEffect(() => {
    let alive = true;
    fetch(`/miyh/intro/${variant}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<TimelineJson>) : null))
      .then((j) => {
        if (alive) setTimeline(j);
      })
      .catch(() => {
        if (alive) end();
      });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [variant]);

  // Reloj del video → texto, tarjeta y progreso
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !timeline) return;
    v.muted = muted;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => end());
    });
    let raf = 0;
    const frame = () => {
      setT(v.currentTime);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const beats = timeline?.beats ?? [];
  let i = beats.findIndex((b) => t < b.start + b.dur);
  if (i < 0) i = Math.max(0, beats.length - 1);
  const b = beats[i];
  const beat = BEATS[i] ?? BEATS[0]!;
  const bt = b ? t - b.start : 0;
  const text = beat.text[lang];
  const n = b ? Math.round(clamp01(bt / (b.voice * 0.9)) * text.length) : 0;
  const shown = text.slice(0, n);
  const cut = b ? b.dur * b.cardShare : 0;
  const cardA = beat.final ? 0 : bt < cut ? 1 : 1 - clamp01((bt - cut) / 0.45);
  const subA = beat.final ? 0 : clamp01((bt - cut - 0.15) / 0.45);
  const prompt = PROMPT[lang].slice(0, Math.round(clamp01((bt - 0.8) / 1.6) * PROMPT[lang].length));

  return (
    <div
      className={`intro${beat.retro ? " is-retro" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Intro narrada"
    >
      <video
        ref={videoRef}
        className="intro__video"
        src={`/miyh/intro/${variant}.mp4`}
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{
          filter: beat.retro ? "sepia(.55) contrast(1.15) saturate(.7) brightness(.95)" : undefined,
        }}
        onEnded={end}
        onError={end}
      />
      <div className="intro__retro" aria-hidden="true" />
      <header className="intro__hud">
        <p className="t-label">
          <span className="intro__kicker">{beat.kicker}</span>
        </p>
        <p className="t-label t-mono">
          {String(i + 1).padStart(2, "0")} / {String(BEATS.length).padStart(2, "0")}
        </p>
      </header>
      <div
        className="intro__card"
        style={{ opacity: cardA, visibility: cardA > 0 ? "visible" : "hidden" }}
      >
        <p className="intro__cardtext">{shown}</p>
      </div>
      <p className="intro__sub" style={{ opacity: subA }} aria-live="polite">
        {shown}
      </p>
      {beat.final ? (
        <div className="intro__final">
          <p className="intro__mw t-title">MarsWalk</p>
          <p className="intro__prompt t-mono">
            <span>{prompt}</span>
            <span className="intro__cursor" aria-hidden="true">
              _
            </span>
          </p>
        </div>
      ) : null}
      <div className="intro__progress" aria-hidden="true">
        {BEATS.map((_, j) => (
          <span key={j}>
            <i
              style={{ transform: `scaleX(${j < i ? 1 : j === i && b ? clamp01(bt / b.dur) : 0})` }}
            />
          </span>
        ))}
      </div>
      <button type="button" className="intro__skip" onClick={end}>
        {lang === "es" ? "Saltar intro" : "Skip intro"} <kbd>Esc</kbd>
      </button>
    </div>
  );
}
