/**
 * M.I.Y.H. · Pestañas 01 Inicio, 04 Misiones y 05 Proyecto, portadas de tabs/01-inicio, tabs/04-misiones
 * y tabs/05-proyecto de mars-space-rockstars (mismo HTML/CSS, lógica de carrusel reescrita en React).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { TrekLang } from "../i18n";
import { MISSIONS } from "./missions";

const pad = (n: number) => String(n).padStart(2, "0");

/* ================================================================== */
/* 01 · Inicio                                                         */
/* ================================================================== */
const TITLE = "M. I. Y. H.";

/** Pseudo-aleatorio determinista para que el título se ensamble igual en cada render. */
function rand(seed: number): number {
  const x = Math.sin(seed * 999.13) * 43758.5453;
  return x - Math.floor(x);
}

export function InicioTab({
  lang,
  active,
  onStartTour,
}: {
  lang: TrekLang;
  active: boolean;
  onStartTour: () => void;
}) {
  const [run, setRun] = useState(0);
  const chars = useMemo(() => {
    const letters = [...TITLE];
    const visible = letters.filter((c) => c !== " ").length;
    let k = 0;
    return letters.map((c, i) => {
      if (c === " ") return { c, i, style: undefined };
      const side = k - (visible - 1) / 2;
      k += 1;
      const style = {
        "--x": `${side * 46 + (rand(i + 1) * 160 - 80)}px`,
        "--y": `${rand(i + 7) * 260 - 140}px`,
        "--r": `${rand(i + 13) * 100 - 50}deg`,
        "--s": `${1.6 + rand(i + 21)}`,
        "--d": `${Math.abs(side) * 0.07 + rand(i + 31) * 0.12}s`,
        "--fd": `${(2.6 + rand(i + 41) * 1.6).toFixed(2)}s`,
        "--fy": `${(rand(i + 51) * 14 - 7).toFixed(1)}px`,
      } as CSSProperties;
      return { c, i, style };
    });
  }, []);

  return (
    <div className="inicio">
      <div className="inicio__head">
        <p className="inicio__kicker t-label inicio__reveal">
          <span className="inicio__kdot" aria-hidden="true" />
          <span>{lang === "es" ? "Intro narrada" : "Narrated intro"}</span>
          <span className="inicio__ksep" aria-hidden="true">
            ·
          </span>
          <b>{lang === "es" ? "De la Tierra a Marte" : "From Earth to Mars"}</b>
        </p>

        <h1
          key={`${run}-${active}`}
          className="inicio__title t-title"
          aria-label="M.I.Y.H. — Mars In Your Hands"
        >
          {chars.map(({ c, i, style }) =>
            c === " " ? (
              <span key={i} className="ch ch--space" aria-hidden="true">
                &nbsp;
              </span>
            ) : (
              <span
                key={i}
                className={`ch${c === "." ? " ch--dot" : ""}`}
                style={style}
                aria-hidden="true"
              >
                <span className="ch__in">{c}</span>
              </span>
            ),
          )}
        </h1>
        <p className="inicio__sub inicio__reveal" aria-hidden="true">
          <span>M</span>ars <span>I</span>n <span>Y</span>our <span>H</span>ands
        </p>

        <div className="inicio__cta inicio__reveal">
          <button type="button" className="btn btn--primary" onClick={onStartTour}>
            {lang === "es" ? "Iniciar recorrido" : "Start the journey"}
            <span className="btn__icon" aria-hidden="true">
              <svg viewBox="0 0 12 12">
                <path d="M3 1.8v8.4L10 6z" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            className="icon-btn inicio__replay"
            aria-label={
              lang === "es" ? "Repetir la animación del título" : "Replay the title animation"
            }
            title={lang === "es" ? "Repetir" : "Replay"}
            onClick={() => setRun((r) => r + 1)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
              <path d="M2.5 2.5v3h3" />
            </svg>
          </button>
        </div>
      </div>
      <p className="inicio__hint t-label inicio__reveal">
        <span aria-hidden="true">⟵</span>{" "}
        {lang === "es" ? "Arrastra para girar Marte" : "Drag to spin Mars"}{" "}
        <span aria-hidden="true">⟶</span>
      </p>
    </div>
  );
}

/* ================================================================== */
/* 04 · Misiones                                                       */
/* ================================================================== */
const N = MISSIONS.length;

export function MissionsTab({
  lang,
  active,
  onOpen,
}: {
  lang: TrekLang;
  active: boolean;
  onOpen: (index: number) => void;
}) {
  const [pos, setPos] = useState(7); // empieza en Perseverance, como el PDF de diseño
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));
  const posRef = useRef(pos);
  posRef.current = pos;
  const animRef = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const current = Math.round(Math.max(0, Math.min(N - 1, pos)));

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const goTo = useCallback((target: number, dur = 0.7) => {
    cancelAnimationFrame(animRef.current);
    const to = Math.max(0, Math.min(N - 1, target));
    const from = posRef.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / (dur * 1000));
      const e = 1 - Math.pow(1 - k, 3); // power3.out
      setPos(from + (to - from) * e);
      if (k < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  // Entrada: el arco se abre desde el centro
  const enteredRef = useRef(false);
  useEffect(() => {
    if (active && !enteredRef.current) {
      enteredRef.current = true;
      const target = Math.round(posRef.current);
      setPos(target + 1.4);
      posRef.current = target + 1.4;
      goTo(target, 1.2);
    }
    if (!active) enteredRef.current = false;
  }, [active, goTo]);

  // Flechas ← → / Enter mientras la pestaña está activa
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(Math.round(posRef.current) - 1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(Math.round(posRef.current) + 1);
      }
      if (e.key === "Enter" && !(e.target as HTMLElement | null)?.closest?.("button"))
        onOpen(Math.round(posRef.current));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo, onOpen]);

  // Arrastre del arco (con inercia) y rueda horizontal
  const dragRef = useRef<{
    x: number;
    y: number;
    pos: number;
    t: number;
    lastX: number;
    v: number;
    moved: boolean;
    card: number | null;
  } | null>(null);
  const spacing = () => (vw < 860 ? vw * 0.5 : Math.min(420, vw * 0.26));

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let acc = 0;
    let accT = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.stopPropagation();
      const now = performance.now();
      if (now - accT > 250) acc = 0;
      accT = now;
      acc += e.deltaX;
      if (Math.abs(acc) > 70) {
        goTo(Math.round(posRef.current) + Math.sign(acc));
        acc = 0;
      }
    };
    stage.addEventListener("wheel", onWheel, { passive: true });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [goTo]);

  const narrow = vw < 860;
  const stepA = narrow ? 0.62 : 0.4;
  const R = narrow ? vw * 0.95 : Math.min(1500, vw * 0.92);
  const k = pos / (N - 1);
  const m = MISSIONS[current]!;
  const mt = m.text[lang];

  return (
    <div className="mis">
      <p className="mis__eyebrow t-label">
        <b>04</b> / {lang === "es" ? "Misiones y rovers" : "Missions and rovers"}
      </p>

      <div
        ref={stageRef}
        className="mis__stage"
        data-interactive
        aria-roledescription="carousel"
        aria-label={lang === "es" ? "Misiones a Marte" : "Missions to Mars"}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          cancelAnimationFrame(animRef.current);
          const cardEl = (e.target as HTMLElement).closest<HTMLElement>(".mis-card");
          dragRef.current = {
            x: e.clientX,
            y: e.clientY,
            pos: posRef.current,
            t: performance.now(),
            lastX: e.clientX,
            v: 0,
            moved: false,
            card: cardEl ? Number(cardEl.dataset["i"]) : null,
          };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          if (!d.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
            d.moved = true;
            stageRef.current?.classList.add("is-dragging");
            stageRef.current?.setPointerCapture(e.pointerId);
          }
          if (!d.moved) return;
          const now = performance.now();
          d.v = (e.clientX - d.lastX) / Math.max(1, now - d.t);
          d.lastX = e.clientX;
          d.t = now;
          let p = d.pos - dx / spacing();
          if (p < 0) p *= 0.35;
          if (p > N - 1) p = N - 1 + (p - N + 1) * 0.35; // borde elástico
          setPos(p);
        }}
        onPointerUp={() => {
          const d = dragRef.current;
          dragRef.current = null;
          stageRef.current?.classList.remove("is-dragging");
          if (!d) return;
          if (d.moved) {
            goTo(Math.round(posRef.current - (d.v * 260) / spacing()), 0.8);
            return;
          }
          if (d.card !== null) {
            if (d.card === current) onOpen(d.card);
            else goTo(d.card);
          }
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          stageRef.current?.classList.remove("is-dragging");
        }}
      >
        <div className="mis__ring">
          {MISSIONS.map((mi, i) => {
            const o = i - pos;
            const a = o * stepA;
            const ao = Math.abs(o);
            const x = Math.sin(a) * R * 0.78;
            const z = (1 - Math.cos(a)) * R * 0.42; // los lados se acercan: arco cóncavo
            const s = 1 + Math.min(ao, 3) * 0.05;
            const blur = Math.round(Math.min(9, Math.pow(ao, 1.25) * 2.2) * 2) / 2;
            return (
              <div
                key={mi.id}
                data-i={i}
                className={`mis-card${mi.concept ? " mis-card--concept" : ""}${i === current ? " is-current" : ""}`}
                role="group"
                aria-label={`${mi.name}, ${mi.yearLabel ?? mi.year}`}
                aria-current={i === current}
                style={{
                  transform: `translate3d(${x.toFixed(1)}px, ${(ao * 6).toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${(-a * 0.92).toFixed(4)}rad) scale(${s.toFixed(3)})`,
                  opacity: ao > 3.6 ? Math.max(0, 1 - (ao - 3.6) * 1.6) : 1,
                  zIndex: 100 - Math.round(ao * 10),
                  filter: blur
                    ? `blur(${blur}px) brightness(${(1 - Math.min(0.45, ao * 0.12)).toFixed(2)})`
                    : "none",
                }}
              >
                <img
                  src={mi.img}
                  alt=""
                  loading={Math.abs(i - 7) < 4 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                  style={{ objectPosition: mi.imgPos }}
                />
                <span className="mis-card__year">{mi.yearLabel ?? mi.year}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={sliderRef}
        className="mis__slider"
        data-interactive
        role="slider"
        tabIndex={0}
        aria-label={lang === "es" ? "Elige una misión" : "Choose a mission"}
        aria-valuemin={1}
        aria-valuemax={N}
        aria-valuenow={current + 1}
        aria-valuetext={m.name}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.setPointerCapture(e.pointerId);
          cancelAnimationFrame(animRef.current);
          setPos(Math.max(0, Math.min(N - 1, ((e.clientX - r.left) / r.width) * (N - 1))));
          (e.currentTarget as HTMLElement).dataset["drag"] = "1";
        }}
        onPointerMove={(e) => {
          if ((e.currentTarget as HTMLElement).dataset["drag"] !== "1") return;
          const r = e.currentTarget.getBoundingClientRect();
          setPos(Math.max(0, Math.min(N - 1, ((e.clientX - r.left) / r.width) * (N - 1))));
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLElement).dataset["drag"] = "";
          goTo(Math.round(posRef.current), 0.45);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            goTo(current - 1);
          }
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            goTo(current + 1);
          }
          if (e.key === "Home") goTo(0);
          if (e.key === "End") goTo(N - 1);
        }}
      >
        <span className="mis__track" aria-hidden="true" />
        <span
          className="mis__fill"
          style={{ transform: `scaleX(${k.toFixed(3)})` }}
          aria-hidden="true"
        />
        <span
          className="mis__thumb"
          style={{ left: `${(k * 100).toFixed(2)}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="mis__info" aria-live="polite" key={current}>
        <p className="mis__meta t-label">
          {pad(current + 1)} / {pad(N)} · {mt.type} · <b>{m.agency}</b> · {m.yearLabel ?? m.year}
        </p>
        <h2 className="mis__name t-title">{m.name}</h2>
        <p className="mis__desc">{mt.short}</p>
        <button type="button" className="btn btn--ghost mis__open" onClick={() => onOpen(current)}>
          {lang === "es" ? "Abrir ficha completa" : "Open full profile"}
        </button>
      </div>
    </div>
  );
}

export function MissionSheet({
  index,
  lang,
  onClose,
}: {
  index: number;
  lang: TrekLang;
  onClose: () => void;
}) {
  const m = MISSIONS[index]!;
  const mt = m.text[lang];
  const headRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    headRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const cell = (k: string, v: ReactNode) => (
    <div className="mis-sheet__cell">
      <dt className="t-label">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
  const es = lang === "es";
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`${m.name}`}>
      <div className="modal__scrim" onClick={onClose} />
      <div className="modal__card glass">
        <button
          type="button"
          className="icon-btn modal__close"
          onClick={onClose}
          aria-label={es ? "Cerrar" : "Close"}
        >
          <svg viewBox="0 0 16 16">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <div className="mis-sheet">
          <div className="mis-sheet__media">
            <img
              src={m.img}
              alt={
                m.concept
                  ? "Mars Desert Research Station, Utah"
                  : es
                    ? `Foto real de ${m.name}`
                    : `Real photo of ${m.name}`
              }
              style={{ objectPosition: m.imgPos }}
            />
            <p className="mis-sheet__credit">{m.credit}</p>
          </div>
          <div className="mis-sheet__body" data-scroll-lock>
            <p className="t-label">
              {pad(index + 1)} / {pad(N)} · {mt.type} · <b>{m.agency}</b>
            </p>
            <h2 ref={headRef} tabIndex={-1} className="mis-sheet__name t-title">
              {m.name}
            </h2>
            <p className="t-lead">{mt.short}</p>
            <dl className="mis-sheet__grid">
              {cell(es ? "Lanzamiento" : "Launch", mt.launch)}
              {cell(es ? "Aterrizaje" : "Landing", mt.landing)}
              {cell(es ? "Fin de misión" : "Mission end", mt.end)}
              {cell(es ? "Lugar" : "Site", mt.site)}
            </dl>
            <div>
              <p className="t-label" style={{ marginBottom: 12 }}>
                {es ? "Logros clave" : "Key achievements"}
              </p>
              <ul className="mis-sheet__facts">
                {mt.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            <p className="mis-sheet__trivia">
              <b>{es ? "Dato curioso" : "Fun fact"}</b>
              {mt.trivia}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 05 · Proyecto                                                       */
/* ================================================================== */
const TEAM: ReadonlyArray<{
  name: string;
  bg1: string;
  bg2: string;
  visor: string;
  extra: ReactNode;
}> = [
  {
    name: "Grecia",
    bg1: "#df8a5d",
    bg2: "#7a3a22",
    visor: "#2b3a5c",
    extra: (
      <>
        <line
          x1="66"
          y1="28"
          x2="74"
          y2="14"
          stroke="#f4f0e6"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="74" cy="13" r="3.5" fill="#df8a5d" />
      </>
    ),
  },
  {
    name: "Lulú",
    bg1: "#6d8fd0",
    bg2: "#223149",
    visor: "#d79a3e",
    extra: <path d="M24.5 40a24 24 0 0 1 47 0" stroke="#df8a5d" strokeWidth="4" fill="none" />,
  },
  {
    name: "Tiky",
    bg1: "#c46a8e",
    bg2: "#4a1f3a",
    visor: "#1f2a3d",
    extra: (
      <path
        d="M30 86l1.6 3.4 3.7.4-2.8 2.5.8 3.7-3.3-1.9-3.3 1.9.8-3.7-2.8-2.5 3.7-.4Z"
        fill="#df8a5d"
      />
    ),
  },
  {
    name: "Pao",
    bg1: "#5fae9c",
    bg2: "#163c3a",
    visor: "#3a2b4f",
    extra: (
      <>
        <rect x="41" y="20" width="14" height="8" rx="3" fill="#c9c1b0" />
        <circle cx="48" cy="24" r="2.6" fill="#fff4c2" />
      </>
    ),
  },
];

export function ProjectTab({ lang, classicLink }: { lang: TrekLang; classicLink?: ReactNode }) {
  const es = lang === "es";
  return (
    <div className="pj" data-scroll-lock>
      <header className="pj__head">
        <p className="t-label" data-in>
          <b>06</b> / {es ? "Proyecto" : "Project"}
        </p>
        <h2 className="pj__title t-title" data-in>
          {es ? "La tripulación" : "The crew"}
        </h2>
      </header>

      <ul className="pj__team" aria-label={es ? "Integrantes del equipo" : "Team members"}>
        {TEAM.map((m, i) => (
          <li key={m.name} className="pj__member glass" data-in>
            <svg className="pj__avatar" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
              <defs>
                <radialGradient id={`pj-bg-${i}`} cx=".35" cy=".3" r=".9">
                  <stop offset="0" stopColor={m.bg1} />
                  <stop offset="1" stopColor={m.bg2} />
                </radialGradient>
              </defs>
              <circle cx="48" cy="48" r="48" fill={`url(#pj-bg-${i})`} />
              <path d="M22 96c2-16 12-24 26-24s24 8 26 24Z" fill="#e9e4d8" />
              <path d="M38 76h20v6H38Z" fill="#c9c1b0" />
              <circle cx="48" cy="46" r="24" fill="#f4f0e6" />
              {i === 1 ? m.extra : null}
              <rect x="31" y="35" width="34" height="23" rx="11.5" fill={m.visor} />
              <path
                d="M37 41c3-3 8-4 12-3"
                stroke="#fff"
                strokeOpacity=".55"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              {i !== 1 ? m.extra : null}
            </svg>
            <p className="pj__name">{m.name}</p>
          </li>
        ))}
      </ul>

      <section className="pj__about glass panel" data-in aria-labelledby="pj-about">
        <p className="t-label">
          NASA International Space Apps Challenge · <b>Martian Map</b>
        </p>
        <h3 id="pj-about" className="pj__h t-title">
          {es ? "Un mapa para la primera caminata en Marte" : "A map for the first walk on Mars"}
        </h3>
        <p>
          {es
            ? "M.I.Y.H. — Mars In Your Hands — es nuestra respuesta al reto Martian Map: ¿cómo debería ser un mapa para las primeras personas que exploren Marte a pie? Partimos de mallas de terreno reales del cráter Gale (Curiosity) y las convertimos en un mapa que un astronauta puede usar. MarsWalk planifica la ruta con A* dentro de una envolvente de seguridad (pendiente, zonas, confianza científica, consumibles) y explica por qué no va en línea recta; la simulación sigue a un tripulante con telemetría HUELLA simulada y una máquina de estados de salud que exige confirmación humana en estados críticos."
            : "M.I.Y.H. — Mars In Your Hands — is our answer to the Martian Map challenge: what should a map look like for the first people who explore Mars on foot? We start from real terrain meshes of Gale crater (Curiosity) and turn them into a map an astronaut can actually use. MarsWalk plans the route with A* inside a safety envelope (slope, zones, scientific confidence, consumables) and explains why it doesn't go straight; the simulation follows a crew member with simulated HUELLA telemetry and a health state machine that requires human confirmation in critical states."}
        </p>
      </section>

      <footer className="pj__foot" data-in>
        <span className="pj__brand t-title">Space Rockstars</span>
        <span>
          © 2026 ·{" "}
          {es
            ? "Prototipo educativo para el NASA International Space Apps Challenge · No respaldado por la NASA"
            : "Educational prototype for the NASA International Space Apps Challenge · Not endorsed by NASA"}
        </span>
        <span>
          {es ? "Fotos" : "Photos"}: NASA/JPL-Caltech, MSSS, Cornell, Univ. of Arizona, ASU,
          CNSA/PEC (CC BY 4.0), The Mars Society (CC BY-SA 4.0) · {es ? "Texturas" : "Textures"}:
          Solar System Scope (CC BY 4.0) · {es ? "Terreno" : "Terrain"}: NASA/JPL-Caltech MSL ·
          Access Mars (Apache-2.0)
        </span>
        {classicLink ? <span className="pj__classic">{classicLink}</span> : null}
      </footer>
    </div>
  );
}
