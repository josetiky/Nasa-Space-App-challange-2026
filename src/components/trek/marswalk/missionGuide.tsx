/**
 * MarsWalk · Tutorial y barra de navegación por etapas (solo interfaz).
 *
 * Acompaña al usuario paso a paso:
 * - Bienvenida en la primera visita: ofrece abrir el Tutorial interactivo.
 * - Tutorial interactivo: explica cada pantalla y control en palabras simples.
 * - Barra superior de progreso: botón para SUBIR a la vista anterior, indicador del paso actual,
 *   botón para BAJAR a la siguiente vista (bloqueado hasta completar la vista actual) y botón
 *   destacado de TUTORIAL.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TrekLang } from "../i18n";
import "./guide.css";

export const GUIDE_SEEN_KEY = "miyh.guide.v1";

type Tx = { es: string; en: string };

/** Etiqueta y botón "siguiente" de cada vista (mismo orden que DECK_TAB_IDS). */
const STEPS: ReadonlyArray<{ step: string; label: Tx; next: Tx; nextTab: number }> = [
  {
    step: "",
    label: { es: "Bienvenida y aterrizaje", en: "Welcome & landing" },
    next: { es: "Bajar a Planeación", en: "Go down to Planning" },
    nextTab: 1,
  },
  {
    step: "1",
    label: { es: "Planea tu caminata", en: "Plan your walk" },
    next: { es: "Bajar a Simulación en vivo", en: "Go down to Live simulation" },
    nextTab: 2,
  },
  {
    step: "2",
    label: { es: "Simulación en vivo", en: "Live simulation" },
    next: { es: "Bajar a Exploración 3D (Unity)", en: "Go down to 3D Exploration (Unity)" },
    nextTab: 3,
  },
  {
    step: "3",
    label: { es: "Explora Marte en 3D", en: "Explore Mars in 3D" },
    next: { es: "Bajar a Historia de los rovers", en: "Go down to Story of the rovers" },
    nextTab: 4,
  },
  {
    step: "4",
    label: { es: "La historia de los rovers", en: "The story of the rovers" },
    next: { es: "Bajar a ¿Cómo lo hicimos?", en: "Go down to How we built it" },
    nextTab: 5,
  },
  {
    step: "5",
    label: { es: "Cómo lo hicimos", en: "How we built it" },
    next: { es: "Bajar a Fuentes y datos", en: "Go down to Sources & data" },
    nextTab: 6,
  },
  {
    step: "+",
    label: { es: "Fuentes y material de apoyo", en: "Sources and supporting material" },
    next: { es: "Volver al inicio", en: "Back to the start" },
    nextTab: 0,
  },
];

/** Barra superior: botón Subir, en qué paso vas, botón Bajar (con candado si falta completar) y botón Tutorial. */
export function GuideStepBar({
  lang,
  tab,
  maxUnlockedTab,
  lockReason,
  go,
  highlightNext,
  onOpenGuide,
}: {
  lang: TrekLang;
  tab: number;
  maxUnlockedTab: number;
  lockReason?: string | null;
  go: (i: number) => void;
  /** Hace latir el botón "Bajar" cuando la etapa actual acaba de completarse. */
  highlightNext: boolean;
  onOpenGuide: () => void;
}) {
  const s = STEPS[tab] ?? STEPS[0]!;
  const es = lang === "es";
  const canGoUp = tab > 0;
  const canGoDown = s.nextTab === 0 ? true : s.nextTab <= maxUnlockedTab;

  return (
    <div
      className="mw-stepbar glass"
      role="navigation"
      aria-label={es ? "Progreso y navegación de misión" : "Mission progress and navigation"}
    >
      <button
        type="button"
        className="mw-stepbar__prev"
        disabled={!canGoUp}
        onClick={() => canGoUp && go(tab - 1)}
        title={
          canGoUp
            ? es
              ? "Subir a la vista anterior"
              : "Go up to previous view"
            : es
              ? "Estás en la primera vista"
              : "You are on the first view"
        }
      >
        <span aria-hidden="true">↑</span>
        <span className="mw-stepbar__prevlabel">{es ? "Subir" : "Go up"}</span>
      </button>

      <span className="mw-stepbar__where">
        {s.step && s.step !== "+" ? (
          <b>
            {es ? "Paso" : "Step"} {s.step} {es ? "de" : "of"} 5
          </b>
        ) : null}
        <span className="mw-stepbar__label">{s.label[lang]}</span>
      </span>

      <button
        type="button"
        className={`mw-stepbar__next${!canGoDown ? " is-locked" : ""}`}
        data-pulse={highlightNext && canGoDown ? "true" : undefined}
        disabled={!canGoDown}
        onClick={() => canGoDown && go(s.nextTab)}
        title={
          !canGoDown && lockReason
            ? lockReason
            : es
              ? "Avanzar a la siguiente vista"
              : "Advance to the next view"
        }
      >
        <span aria-hidden="true">{!canGoDown ? "🔒" : s.nextTab === 0 ? "↺" : "↓"}</span>
        <span className="mw-stepbar__nextlabel">
          {!canGoDown && lockReason ? lockReason : s.next[lang]}
        </span>
      </button>

      <button
        type="button"
        className="mw-guidebtn"
        onClick={onOpenGuide}
        title={
          es
            ? "Abrir el Tutorial interactivo paso a paso"
            : "Open the step-by-step interactive Tutorial"
        }
      >
        <span className="mw-guidebtn__icon" aria-hidden="true">
          ✦
        </span>
        <span>Tutorial</span>
      </button>
    </div>
  );
}

/** Tarjeta de bienvenida (primera visita): ofrece el Tutorial. */
export function GuideWelcome({
  lang,
  onStart,
  onSkip,
}: {
  lang: TrekLang;
  onStart: () => void;
  onSkip: () => void;
}) {
  const es = lang === "es";
  return (
    <div
      className="mw-guide-welcome glass"
      role="dialog"
      aria-modal="false"
      aria-labelledby="mw-gw-title"
    >
      <Helmet />
      <div className="mw-guide-welcome__text">
        <h2 id="mw-gw-title">
          {es
            ? "Hola, astronauta. Bienvenido al Tutorial de misión."
            : "Hi, astronaut. Welcome to the Mission Tutorial."}
        </h2>
        <p>
          {es
            ? "Cada etapa se desbloquea al completar la anterior: primero vive el video de aterrizaje, luego planea tu ruta, corre la simulación en vivo y finalmente abre la compuerta hacia el simulador 3D en Unity."
            : "Each stage unlocks as you complete the previous one: first watch the landing animation, then plan your route, run the live simulation, and finally open the hatch to the Unity 3D simulator."}
        </p>
        <div className="mw-guide-welcome__actions">
          <button type="button" className="btn btn--primary" onClick={onStart}>
            {es ? "Ver Tutorial rápido" : "See quick Tutorial"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onSkip}>
            {es ? "Entendido, empezar" : "Got it, let's start"}
          </button>
        </div>
        <small>
          {es
            ? "Puedes abrir el tutorial cuando quieras con el botón naranja «Tutorial» de arriba."
            : "You can open the tutorial anytime with the orange “Tutorial” button at the top."}
        </small>
      </div>
    </div>
  );
}

function Helmet() {
  return (
    <svg className="mw-guide-helmet" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="30" r="22" fill="#eee5ca" />
      <rect x="16" y="20" width="32" height="20" rx="10" fill="#0b1018" />
      <path
        d="M21 26c4-3 9-4 14-3"
        stroke="#8fb3f0"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="20" y="50" width="24" height="8" rx="3" fill="#df8a5d" />
    </svg>
  );
}

/* ------------------------------ Tutorial guiado ------------------------------ */

interface TourStep {
  readonly tab: number;
  /** Elemento a resaltar (dentro de la vista activa o en el marco). null = tarjeta centrada. */
  readonly target: string | null;
  readonly title: Tx;
  readonly body: Tx;
}

const TOUR: readonly TourStep[] = [
  {
    tab: 0,
    target: null,
    title: { es: "Tutorial · Tu misión paso a paso", en: "Tutorial · Your step-by-step mission" },
    body: {
      es: "Esta experiencia avanza como una misión real: no puedes saltar a la siguiente etapa hasta completar la actual. Dentro de cada apartado puedes hacer scroll libremente sin salirte de él.",
      en: "This experience progresses like a real mission: you unlock the next stage by completing the current one. Inside each view you can scroll freely without leaving that section.",
    },
  },
  {
    tab: 0,
    target: ".inicio__cta .btn--primary",
    title: { es: "1 · Vive el video y aterriza en Marte", en: "1 · Watch the video and land on Mars" },
    body: {
      es: "Al inicio, lo único que debes hacer es pulsar «Comenzar la misión» para ver la cinemática de viaje y aterrizar en el cráter Gale. Al aterrizar se desbloquea la Planeación.",
      en: "At the start, simply press “Start the mission” to watch the travel cinematic and land in Gale crater. Once you land, Planning unlocks.",
    },
  },
  {
    tab: 1,
    target: ".mwc__guide-strip",
    title: { es: "2 · Planeación explicada paso a paso", en: "2 · Planning explained step by step" },
    body: {
      es: "En Planeación puedes hacer scroll hacia abajo dentro de la consola para leer qué hace cada bloque: elige tu sitio, origen y destino, revisa cuánto oxígeno te sobra y calcula la ruta segura con A*.",
      en: "In Planning you can scroll down inside the console to read what every block does: pick your site, start and goal, check how much oxygen is left, and compute the safe A* route.",
    },
  },
  {
    tab: 1,
    target: ".mwc__cta",
    title: { es: "Confirma tu ruta para avanzar", en: "Confirm your route to advance" },
    body: {
      es: "Cuando calcules tu ruta o pulses «Empezar caminata», se desbloqueará el paso siguiente: la Simulación en Vivo.",
      en: "Once you compute your route or press “Start the walk”, the next step unlocks: Live Simulation.",
    },
  },
  {
    tab: 2,
    target: ".mwc__guide-strip",
    title: { es: "3 · Simulación en vivo sin confusiones", en: "3 · Crystal-clear Live Simulation" },
    body: {
      es: "En la Simulación en vivo verás explicada cada sección: el mapa 3D con el avance del astronauta, los signos del cuerpo y del traje, y el panel para probar tormentas o fallas.",
      en: "In Live Simulation every section is clearly explained: the 3D map with the astronaut's progress, body and suit vitals, and the panel to test storms or suit faults.",
    },
  },
  {
    tab: 2,
    target: ".mws__speed",
    title: { es: "Acelera el tiempo y completa la caminata", en: "Speed up time and finish the walk" },
    body: {
      es: "Pulsa «Iniciar caminata» y usa la velocidad ×60 o ×300 para avanzar rápido. Cuando la caminata llegue al 100%, se desbloqueará la compuerta hacia el juego 3D en Unity.",
      en: "Press “Start the walk” and use ×60 or ×300 speed to fast-forward. When the walk reaches 100%, the hatch to the Unity 3D game unlocks.",
    },
  },
  {
    tab: 3,
    target: ".xp__hatch-btn",
    title: { es: "4 · Abre la compuerta hacia Unity 3D", en: "4 · Open the hatch to Unity 3D" },
    body: {
      es: "Al abrir la compuerta verás primero una guía súper sencilla (nivel niño de 8 años) que te explica qué encontrarás, cómo moverte y qué hacer antes de entrar al simulador de caminata en Unity.",
      en: "When you open the hatch, you'll first see a super friendly guide (8-year-old level) explaining what you'll find, how to move around, and what to do before entering the Unity walk simulator.",
    },
  },
  {
    tab: 0,
    target: ".mw-stepbar",
    title: { es: "Botones Subir, Bajar y Tutorial", en: "Go Up, Go Down, and Tutorial buttons" },
    body: {
      es: "En la barra superior siempre tienes el botón «↑ Subir» para regresar a una vista anterior, el botón «↓ Bajar» (que se activa al completar la etapa actual) y el botón naranja «Tutorial».",
      en: "In the top bar you always have the “↑ Go up” button to return to a previous view, the “↓ Go down” button (unlocked when the current stage is complete), and the orange “Tutorial” button.",
    },
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(selector: string, tabId: string): HTMLElement | null {
  const inTab = document.querySelector<HTMLElement>(`#tab-${tabId} ${selector}`);
  if (inTab) return inTab;
  return document.querySelector<HTMLElement>(`.mw-deck ${selector}`);
}

export function GuideTour({
  lang,
  tabIds,
  currentTab,
  go,
  onClose,
}: {
  lang: TrekLang;
  tabIds: readonly string[];
  currentTab: number;
  go: (i: number, force?: boolean) => void;
  onClose: () => void;
}) {
  const es = lang === "es";
  const originTabRef = useRef(currentTab);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = TOUR[i]!;

  const handleClose = useCallback(() => {
    go(originTabRef.current, true);
    onClose();
  }, [go, onClose]);

  const measure = useCallback(() => {
    if (!step.target) return setRect(null);
    const el = findTarget(step.target, tabIds[step.tab] ?? "");
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return setRect(null);
    const pad = 8;
    setRect({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }, [step, tabIds]);

  // Cambiar de vista en modo vista-previa del tutorial y medir el elemento
  useLayoutEffect(() => {
    go(step.tab, true);
    setRect(null);
    const t1 = window.setTimeout(measure, 120);
    const t2 = window.setTimeout(measure, 700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [i, step.tab, go, measure]);

  useEffect(() => {
    const onResize = () => measure();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") setI((v) => Math.min(TOUR.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [measure, handleClose]);

  const last = i === TOUR.length - 1;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const vw = typeof window === "undefined" ? 1200 : window.innerWidth;
  const cardW = Math.min(410, vw - 32);
  let cardStyle: React.CSSProperties = {};
  if (rect) {
    const below = rect.top + rect.height + 14;
    const left = Math.max(16, Math.min(vw - cardW - 16, rect.left + rect.width / 2 - cardW / 2));
    cardStyle =
      below + 240 < vh
        ? { top: below, left, width: cardW }
        : rect.top - 14 - 240 > 0
          ? { top: Math.max(16, rect.top - 14 - 240), left, width: cardW }
          : {
              top: Math.max(16, vh / 2 - 120),
              left:
                rect.left - cardW - 16 >= 16
                  ? rect.left - cardW - 16
                  : Math.min(vw - cardW - 16, rect.left + rect.width + 16),
              width: cardW,
            };
  }

  return (
    <div className="mw-tour" role="dialog" aria-modal="true" aria-labelledby="mw-tour-title">
      {rect ? (
        <span
          className="mw-tour__spot"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden="true"
        />
      ) : (
        <span className="mw-tour__dim" aria-hidden="true" />
      )}
      <div className={`mw-tour__card glass${rect ? "" : " is-center"}`} style={cardStyle}>
        <p className="mw-tour__count t-label">
          TUTORIAL · {i + 1} / {TOUR.length}
        </p>
        <h3 id="mw-tour-title">{step.title[lang]}</h3>
        <p>{step.body[lang]}</p>
        <div className="mw-tour__actions">
          <button type="button" className="mw-tour__skip" onClick={handleClose}>
            {es ? "Cerrar tutorial" : "Close tutorial"}
          </button>
          <span className="mw-tour__nav">
            {i > 0 ? (
              <button type="button" className="btn btn--ghost" onClick={() => setI(i - 1)}>
                {es ? "Atrás" : "Back"}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn--primary"
              autoFocus
              onClick={() => (last ? handleClose() : setI(i + 1))}
            >
              {last ? (es ? "¡Entendido!" : "Got it!") : es ? "Siguiente" : "Next"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
