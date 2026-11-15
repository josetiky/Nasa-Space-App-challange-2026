/**
 * MarsWalk · 03b Exploración (compuerta + guía amigable para niños + simulador Unity 3D).
 *
 * Flujo paso a paso después de completar la Simulación en Vivo:
 *   1. "closed": compuerta cerrada; el usuario pulsa "Abrir la compuerta" (sin el botón de
 *      "Watch the simulated walk first", porque solo se llega aquí tras completar la simulación).
 *   2. "opening" → "briefing": las hojas de la compuerta se abren y aparece una explicación
 *      súper clara y amigable (pensada para que hasta un niño de 8 años la entienda al instante)
 *      sobre qué puede hacer ahí, qué va a encontrar y cómo desplazarse, seguida del botón
 *      "Ir al simulador de caminata".
 *   3. "open": abre el simulador topográfico en Unity WebGL y muestra abajo el botón
 *      "Finalizar recorrido" para avanzar a la historia de los rovers.
 */
import { useEffect, useRef, useState } from "react";
import type { TrekLang } from "../i18n";
import { TOPO_SIM_URL } from "./resourcesTab";
import "./exploration.css";

type Phase = "closed" | "opening" | "briefing" | "open" | "closing";

/** Duración de la animación de apertura de la compuerta (coincide con exploration.css). */
const DOOR_MS = 2200;

export function ExplorationTab({
  lang,
  active,
  onFinish,
  onBackToWalk,
}: {
  lang: TrekLang;
  active: boolean;
  onFinish: () => void;
  onBackToWalk: () => void;
}) {
  const es = lang === "es";
  const [phase, setPhase] = useState<Phase>("closed");
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number | null>(null);

  // Al salir de la vista se cierra la compuerta y se descarga el simulador
  useEffect(() => {
    if (!active) {
      setPhase("closed");
      setLoaded(false);
    }
  }, [active]);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const openHatch = () => {
    setPhase("opening");
    timer.current = window.setTimeout(() => setPhase("briefing"), reduceMotion ? 0 : DOOR_MS);
  };

  const launchUnity = () => {
    setPhase("open");
  };

  const finishWalk = () => {
    setPhase("closing");
    timer.current = window.setTimeout(
      () => {
        setPhase("closed");
        setLoaded(false);
        onFinish();
      },
      reduceMotion ? 0 : 900,
    );
  };

  const showSim = phase === "open" || phase === "closing";

  return (
    <div className="xp" data-phase={phase}>
      {showSim && active ? (
        <div className="xp__sim">
          {!loaded ? (
            <p className="xp__loading t-label" aria-live="polite">
              {es ? "Cargando el simulador de caminata en Unity 3D…" : "Loading the Unity 3D walk simulator…"}
            </p>
          ) : null}
          <iframe
            title={es ? "Simulador de caminata en 3D (Unity)" : "3D Walk Simulator (Unity)"}
            src={TOPO_SIM_URL}
            onLoad={() => setLoaded(true)}
            data-loaded={loaded ? "true" : undefined}
            allow="fullscreen; autoplay; gamepad; xr-spatial-tracking"
            allowFullScreen
          />
          <div className="xp__bar">
            <span className="xp__barinfo">
              <b>{es ? "Simulador de caminata en Marte (Unity 3D)" : "Mars Walk Simulator (Unity 3D)"}</b>
              <small>
                {es
                  ? "Usa W, A, S, D o las flechas (↑ ↓ ← →) para caminar y mueve el ratón para mirar. Pulsa Esc para liberar el ratón."
                  : "Use W, A, S, D or arrow keys (↑ ↓ ← →) to walk and move the mouse to look around. Press Esc to release the mouse."}
              </small>
            </span>
            <div className="xp__baractions">
              <button
                type="button"
                className="btn btn--ghost xp__howto-btn"
                onClick={() => setPhase("briefing")}
              >
                {es ? "📖 Ver guía de controles" : "📖 See controls guide"}
              </button>
              <button type="button" className="btn btn--primary xp__finish" onClick={finishWalk}>
                {es ? "Finalizar recorrido" : "Finish walk"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Compuerta de la nave: dos hojas que se abren */}
      <div
        className="xp__doors"
        aria-hidden={phase === "briefing" || phase === "open" ? true : undefined}
      >
        <span className="xp__door xp__door--l" />
        <span className="xp__door xp__door--r" />
        <span className="xp__seam" />
        <span className="xp__light" />
      </div>

      {/* Paso 1: Compuerta cerrada */}
      {phase === "closed" ? (
        <div className="xp__intro">
          <p className="t-label">
            <b>03</b> / {es ? "Exploración 3D" : "3D Exploration"}
          </p>
          <h2 className="xp__title t-title">
            {es
              ? "Simulación completada. Ahora sí: sal a Marte."
              : "Simulation complete. Now, step out onto Mars."}
          </h2>
          <p className="xp__lead">
            {es
              ? "Ya planeaste y completaste tu caminata simulada. Abre la compuerta de la nave para conocer cómo explorar el planeta rojo en 3D."
              : "You planned and completed your simulated walk. Open the ship's hatch to learn how to explore the Red Planet in 3D."}
          </p>
          <div className="xp__actions">
            <button type="button" className="btn btn--ghost" onClick={onBackToWalk}>
              ↑ {es ? "Subir a Simulación" : "Go up to Simulation"}
            </button>
            <button type="button" className="btn btn--primary xp__hatch-btn" onClick={openHatch}>
              {es ? "Abrir la compuerta" : "Open the hatch"}
              <span aria-hidden="true">⇥</span>
            </button>
          </div>
          <p className="xp__note t-label">
            {es
              ? "Simulador 3D del equipo (Unity WebGL) · terreno real de la NASA"
              : "Team 3D simulator (Unity WebGL) · real NASA terrain"}
          </p>
        </div>
      ) : null}

      {/* Paso 2: Puerta abierta → Explicación amigable para un niño de 8 años antes de abrir Unity */}
      {phase === "briefing" ? (
        <div className="xp__briefing glass" data-scroll-lock>
          <header className="xp__brief-head">
            <span className="chip chip--mars">
              {es ? "✦ Compuerta abierta · Guía de explorador" : "✦ Hatch open · Explorer's guide"}
            </span>
            <h2 className="xp__brief-title t-title">
              {es
                ? "¡Bienvenido a Marte! Guía súper fácil antes de caminar"
                : "Welcome to Mars! Super easy guide before you walk"}
            </h2>
            <p className="xp__brief-sub">
              {es
                ? "Imagina que estás dentro de un videojuego espacial de verdad. Aquí tienes todo lo que necesitas saber para explorar Marte como un astronauta experto:"
                : "Imagine you are inside a real space video game. Here is everything you need to know to explore Mars like an expert astronaut:"}
            </p>
          </header>

          <div className="xp__brief-grid">
            <article className="xp__brief-card">
              <div className="xp__brief-icon" aria-hidden="true">
                🚀
              </div>
              <h3>
                {es ? "1. ¿Qué puedes hacer ahí?" : "1. What can you do in there?"}
              </h3>
              <ul>
                <li>
                  {es
                    ? "Caminar libremente en 3D por las montañas, dunas y cráteres reales que fotografiaron los robots de la NASA."
                    : "Walk freely in 3D across the real mountains, dunes, and craters photographed by NASA robots."}
                </li>
                <li>
                  {es
                    ? "Seguir la línea brillante de tu ruta segura para llegar a cada estación científica sin resbalar."
                    : "Follow the glowing line of your safe route to reach every science station without slipping."}
                </li>
                <li>
                  {es
                    ? "Cambiar entre 25 lugares famosos de Marte (como el volcán gigante Monte Olimpo o el cañón Valles Marineris) usando el menú de arriba."
                    : "Jump between 25 famous places on Mars (like the giant Olympus Mons volcano or Valles Marineris canyon) using the top menu."}
                </li>
              </ul>
            </article>

            <article className="xp__brief-card">
              <div className="xp__brief-icon" aria-hidden="true">
                🔍
              </div>
              <h3>
                {es ? "2. ¿Qué vas a encontrar?" : "2. What will you find?"}
              </h3>
              <ul>
                <li>
                  {es
                    ? "Rovers y helicópteros reales: podrás acercarte a ver a Curiosity, Perseverance y al pequeño helicóptero Ingenuity."
                    : "Real rovers and helicopters: walk right up to Curiosity, Perseverance, and the Ingenuity helicopter."}
                </li>
                <li>
                  {es
                    ? "Banderas y rocas misteriosas: puntos marcados en el suelo donde antes hubo agua líquida y ríos antiguos."
                    : "Flags and mysterious rocks: glowing markers on the ground where liquid water and ancient rivers once flowed."}
                </li>
                <li>
                  {es
                    ? "El casco de tu traje: verás tu brújula, a qué velocidad caminas y cuánto aire tienes mientras flotas un poquito más ligero que en la Tierra."
                    : "Your spacesuit visor: see your compass, walking speed, and oxygen level while feeling lighter than on Earth."}
                </li>
              </ul>
            </article>

            <article className="xp__brief-card">
              <div className="xp__brief-icon" aria-hidden="true">
                🎮
              </div>
              <h3>
                {es ? "3. ¿Cómo desplazarte? (Controles)" : "3. How do you move around? (Controls)"}
              </h3>
              <ul>
                <li>
                  <b>{es ? "Caminar:" : "Walk:"}</b>{" "}
                  {es
                    ? "Presiona las teclas W, A, S, D o las Flechas del teclado (↑ ↓ ← →) para ir adelante, atrás o a los lados."
                    : "Press the W, A, S, D keys or the Arrow keys (↑ ↓ ← →) to move forward, backward, or sideways."}
                </li>
                <li>
                  <b>{es ? "Mirar alrededor:" : "Look around:"}</b>{" "}
                  {es
                    ? "Haz clic dentro del paisaje 3D y mueve el ratón (mouse) para girar la cabeza de tu astronauta."
                    : "Click inside the 3D landscape and move your mouse to turn your astronaut's head."}
                </li>
                <li>
                  <b>{es ? "Correr y hacer zoom:" : "Run & zoom:"}</b>{" "}
                  {es
                    ? "Mantén presionada la tecla Shift para ir más rápido y usa la rueda del ratón para acercar o alejar la cámara."
                    : "Hold Shift to move faster, and scroll the mouse wheel to zoom the camera in or out."}
                </li>
                <li>
                  <b>{es ? "Soltar el ratón:" : "Release the mouse:"}</b>{" "}
                  {es
                    ? "Toca la tecla Esc cuando quieras que reaparezca la flechita del ratón para presionar otros botones."
                    : "Press the Esc key anytime you want your mouse cursor back to click other buttons."}
                </li>
              </ul>
            </article>
          </div>

          <footer className="xp__brief-foot">
            <button type="button" className="btn btn--ghost" onClick={onBackToWalk}>
              ↑ {es ? "Subir a Simulación" : "Go up to Simulation"}
            </button>
            <button type="button" className="btn btn--primary xp__launch-btn" onClick={launchUnity}>
              {es ? "Ir al simulador de caminata" : "Go to the walk simulator"}
              <span className="btn__icon" aria-hidden="true">
                <svg viewBox="0 0 12 12">
                  <path d="M3 1.8v8.4L10 6z" />
                </svg>
              </span>
            </button>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
