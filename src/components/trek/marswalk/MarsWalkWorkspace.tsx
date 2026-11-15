/**
 * M.I.Y.H. — Mars In Your Hands · Cubierta principal con la UX/UI de mars-space-rockstars
 * (casco index.html + shared/css + pestañas 01–05), conectada al motor científico, de ruteo A*
 * y de salud vía trekStore.
 *
 *   01 Inicio      título M. I. Y. H., Marte 3D girable, "Iniciar recorrido" → intro narrada
 *   02 MarsWalk    planificador sobre la malla real de Gale (A* + envolvente) · ficha "Por qué esta ruta"
 *   03 Simulación  plano isométrico, vitales HUELLA (SIMULATED), asistente · ficha "Salud y contingencias"
 *   04 Misiones    carrusel cóncavo de 11 misiones + ficha
 *   05 Proyecto    tripulación, reto y créditos
 *
 * Se conserva: pestañas a pantalla completa, rail 01–05, paginador, marca, cielo + Marte por preset,
 * vidrio, Syncopate/Inter/JetBrains Mono, rueda con compuerta anti-inercia, teclado y swipe.
 * Se reemplaza: sample-route.js → session.activeRoute · sim/engine.js → latestTelemetryRow ·
 * alerts.js → fsm + replanLog · "viabilidad" → margen de regreso · jezero-base.jpg → ráster de Gale ·
 * puente Unity → dispatchTrek(...).
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { TREK_SCENARIOS } from "@/core/trek/sim/scenarios";
import { loadSiteElevationGrid } from "@/services/trek/sites";
import { dispatchTrek, needsSiteLoad, trekStore, useTrek } from "@/state/trekStore";
import { DECK_TEXTS } from "./deckText";
import { InicioTab, MissionSheet, MissionsTab, ProjectTab } from "./homeTabs";
import { MW_TEXTS } from "./i18n";
import { IntroOverlay } from "./IntroOverlay";
import { LandingAudio } from "./landing/landingAudio";
import { ReadyToLand } from "./landing/ReadyToLand";
import { WarpTransition } from "./landing/WarpTransition";
import { MarsGlobe, type GlobePreset } from "./MarsGlobe";
import {
  DeckSheet,
  HealthTab,
  HumanConfirmModal,
  type Speed,
  WhyTab,
} from "./panels";
import { PlannerConsoleTab } from "./plannerConsole";
import { ResourcesTab } from "./resourcesTab";
import { SimConsoleTab } from "./simConsole";
import "./marswalk.css";

// La escena 3D del aterrizaje solo se descarga cuando alguien presiona "Aterrizar".
const LandingSequence = lazy(() => import("./landing/LandingSequence"));

const HR_BUFFER = 120;
export const DECK_TAB_IDS = [
  "inicio",
  "marswalk",
  "simulacion",
  "misiones",
  "recursos",
  "proyecto",
] as const;
export type DeckTabId = (typeof DECK_TAB_IDS)[number];
const TAB_IDS = DECK_TAB_IDS;
/** Preset de Marte por pestaña (shared/js/scene/presets.js del front). */
const GLOBE: readonly GlobePreset[] = ["hero", "corner", "corner", "hidden", "hidden", "behind"];
const WHEEL_THRESHOLD = 60;
const WHEEL_LOCK_MS = 900;
const SOUND_KEY = "miyh.sound";
/**
 * La intro, el salto, "¿Listo para aterrizar?" y el aterrizaje tienen audio en inglés,
 * así que su texto también va siempre en inglés (no cambia con el botón ES/EN).
 */
const CINEMATIC_LANG = "en" as const;
const pad = (n: number) => String(n).padStart(2, "0");

function tabFromHash(fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const i = TAB_IDS.indexOf(window.location.hash.slice(1) as DeckTabId);
  return i >= 0 ? i : fallback;
}

/** ¿El elemento (o un ancestro desplazable) todavía puede desplazarse en esa dirección? */
function canScroll(target: EventTarget | null, dir: number): boolean {
  let el = target instanceof Element ? target : null;
  while (el && !el.classList.contains("mw-deck")) {
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 1) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY)) {
        if (dir > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
        if (dir < 0 && el.scrollTop > 0) return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

export default function MarsWalkWorkspace({
  variantSwitch,
  initialTab = "inicio",
}: {
  variantSwitch?: ReactNode;
  initialTab?: DeckTabId;
}) {
  const state = useTrek();
  const t = MW_TEXTS[state.lang];
  const d = DECK_TEXTS[state.lang];
  const { session } = state;
  const { fsm, directive, envelope } = session;
  const fallbackTab = Math.max(0, TAB_IDS.indexOf(initialTab));

  const [tab, setTab] = useState(() => tabFromHash(fallbackTab));
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(15);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheet, setSheet] = useState<"why" | "health" | null>(null);
  const [missionOpen, setMissionOpen] = useState<number | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [warpOpen, setWarpOpen] = useState(false);
  const [resWindow, setResWindow] = useState(false);
  // Después de la intro: null → "ready" (¿Listo para aterrizar?) → "flying" (secuencia 3D) → planeador
  const [landing, setLanding] = useState<null | "ready" | "flying">(null);
  const [booting, setBooting] = useState(false);
  const landingAudioRef = useRef<LandingAudio | null>(null);
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return window.localStorage.getItem(SOUND_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [hrHistory, setHrHistory] = useState<number[]>([]);
  const [pendingScenario, setPendingScenario] = useState<string | null>(null);
  const lastClockRef = useRef(session.clockS);
  const deckRef = useRef<HTMLDivElement | null>(null);
  // La cubierta es inmersiva como el front original: se monta en <body> por encima del AppShell.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setPortalTarget(document.body), []);

  const overlayOpen =
    confirmOpen ||
    sheet !== null ||
    missionOpen !== null ||
    introOpen ||
    warpOpen ||
    resWindow ||
    landing !== null;

  const go = useCallback((i: number) => {
    const next = Math.max(0, Math.min(TAB_IDS.length - 1, i));
    setTab(next);
    if (typeof window !== "undefined")
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${TAB_IDS[next]}`,
      );
  }, []);

  // Enlaces directos a una pestaña (#inicio, #marswalk, #simulacion, #misiones, #proyecto)
  useEffect(() => {
    const onHash = () => setTab((cur) => tabFromHash(cur));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // La página siempre abre en inglés (regla de Space Apps); el botón ES/EN cambia el resto de la UI
  useEffect(() => {
    if (trekStore.getState().lang !== "en") dispatchTrek({ type: "setLang", lang: "en" });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0");
    } catch {
      /* almacenamiento no disponible */
    }
  }, [soundOn]);

  // Carga de la tesela real. Si la sesión ya se construyó con este sitio no se recarga (recrearla
  // reiniciaría la FSM y saltaría el candado humano).
  useEffect(() => {
    if (!needsSiteLoad(trekStore.getState())) return;
    let cancelled = false;
    dispatchTrek({ type: "setSiteLoading", siteId: state.siteId });
    loadSiteElevationGrid(state.siteId)
      .then(({ site, grid, manifest }) => {
        if (!cancelled) dispatchTrek({ type: "setSiteLoaded", site, grid, manifest });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          dispatchTrek({
            type: "setSiteError",
            error: err instanceof Error ? err.message : String(err),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [state.siteId]);

  // Navegación del front: rueda con compuerta anti-inercia, teclado y swipe vertical
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    let acc = 0;
    let lockedUntil = 0;
    let touchY: number | null = null;
    // Fuera del render: actualizar el hash dentro de un updater de setState notificaría al router a mitad de render.
    const step = (dir: number) => go(tabRef.current + dir);
    const onWheel = (e: WheelEvent) => {
      if (overlayOpen) return;
      const target = e.target as Element | null;
      if (target?.closest("canvas.mw__canvas, select")) return;
      const dir = Math.sign(e.deltaY);
      if (!dir || Math.abs(e.deltaX) > Math.abs(e.deltaY) || canScroll(e.target, dir)) return;
      e.preventDefault();
      const now = performance.now();
      if (now < lockedUntil) return;
      acc += e.deltaY;
      if (Math.abs(acc) >= WHEEL_THRESHOLD) {
        step(Math.sign(acc));
        acc = 0;
        lockedUntil = now + WHEEL_LOCK_MS;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (overlayOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") dispatchTrek({ type: "setPickMode", mode: "inspect" });
      if (e.key === "PageDown" || e.key === "ArrowDown") {
        if (
          canScroll(e.target, 1) ||
          (e.target as HTMLElement | null)?.getAttribute?.("role") === "slider"
        )
          return;
        e.preventDefault();
        step(1);
      }
      if (e.key === "PageUp" || e.key === "ArrowUp") {
        if (
          canScroll(e.target, -1) ||
          (e.target as HTMLElement | null)?.getAttribute?.("role") === "slider"
        )
          return;
        e.preventDefault();
        step(-1);
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY === null || overlayOpen) return;
      const dy = touchY - (e.changedTouches[0]?.clientY ?? touchY);
      touchY = null;
      if (Math.abs(dy) < 60) return;
      const dir = Math.sign(dy);
      if (canScroll(e.target, dir)) return;
      if ((e.target as Element | null)?.closest?.(".mis__stage, .mw-globe")) return;
      step(dir);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [overlayOpen, portalTarget, go]);

  // Bucle de reproducción: 1 tick de simulación por segundo real
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => dispatchTrek({ type: "simTick", dtS: speed }), 1000);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  // Buffer de vista para la minigráfica de FC (no participa en ninguna decisión)
  useEffect(() => {
    if (session.clockS < lastClockRef.current) setHrHistory([]);
    lastClockRef.current = session.clockS;
    const v = session.latestTelemetryRow?.["heart_rate_bpm"];
    if (typeof v === "number" && Number.isFinite(v))
      setHrHistory((h) => [...h, v].slice(-HR_BUFFER));
  }, [session.latestTelemetryRow, session.clockS]);

  // Al entrar en un estado que exige confirmación humana: pausar y abrir el candado
  const prevRequiresRef = useRef(fsm.requiresHumanConfirmation);
  useEffect(() => {
    if (fsm.requiresHumanConfirmation && !prevRequiresRef.current) {
      setPlaying(false);
      setConfirmOpen(true);
    }
    prevRequiresRef.current = fsm.requiresHumanConfirmation;
  }, [fsm.requiresHumanConfirmation]);

  /** Paso de escenario; si vive en otro sitio, primero se carga el sitio y luego se ejecuta. */
  const runScenario = useCallback((id: string) => {
    const sc = TREK_SCENARIOS.find((s) => s.id === id);
    if (!sc) return;
    const s = trekStore.getState();
    if (s.siteId !== sc.siteId || s.loadingTile) {
      setPendingScenario(id);
      if (s.siteId !== sc.siteId) dispatchTrek({ type: "setSiteLoading", siteId: sc.siteId });
      return;
    }
    if (s.activeScenarioId !== sc.id) {
      if (s.session.missionProfile !== sc.missionProfile)
        dispatchTrek({ type: "setMissionProfile", profile: sc.missionProfile });
      dispatchTrek({
        type: "simEvent",
        event: [
          { kind: "set-weight-profile", profileId: sc.weightProfile, simulated: true },
          ...(sc.origin
            ? [{ kind: "set-origin" as const, origin: sc.origin, simulated: true }]
            : []),
          ...(sc.goal ? [{ kind: "set-goal" as const, goal: sc.goal, simulated: true }] : []),
        ],
      });
    }
    dispatchTrek({ type: "runScenarioStep", scenarioId: sc.id });
  }, []);

  useEffect(() => {
    if (!pendingScenario) return;
    const sc = TREK_SCENARIOS.find((s) => s.id === pendingScenario);
    if (!sc) return setPendingScenario(null);
    if (state.siteId === sc.siteId && !state.loadingTile && !state.loadError) {
      setPendingScenario(null);
      runScenario(sc.id);
    } else if (state.loadError) {
      setPendingScenario(null);
    }
  }, [pendingScenario, state.siteId, state.loadingTile, state.loadError, runScenario]);

  const closeConfirm = useCallback(() => setConfirmOpen(false), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeMission = useCallback(() => setMissionOpen(null), []);
  const endIntro = useCallback(() => {
    setIntroOpen(false);
    setLanding("ready");
  }, []);
  /** Clic en "Aterrizar": el audio se desbloquea dentro del gesto del usuario. */
  const startLanding = useCallback(() => {
    const audio = new LandingAudio();
    audio.unlock(!soundOn);
    landingAudioRef.current = audio;
    setLanding("flying");
  }, [soundOn]);
  /** Fin o salto del aterrizaje → se enciende la consola del planeador. */
  const finishLanding = useCallback(() => {
    landingAudioRef.current?.dispose();
    landingAudioRef.current = null;
    setLanding(null);
    go(1);
    setBooting(true);
    window.setTimeout(() => setBooting(false), 1700);
  }, [go]);
  const critical = fsm.state === "CRITICAL" || fsm.state === "EMERGENCY";
  const dynamicEvents =
    session.storms.some((s) => s.active) ||
    session.sepAlertActive ||
    session.telemetry.incident !== "nominal";
  // La insignia SIMULATED se muestra en las pestañas con datos de misión (02 y 03) y siempre que haya eventos.
  const showSimBadge = tab === 1 || tab === 2 || dynamicEvents;

  if (!portalTarget) return null;

  const tabs: ReactNode[] = [
    <InicioTab
      key="i"
      lang={state.lang}
      active={tab === 0}
      onStartTour={() => setWarpOpen(true)}
    />,
    <PlannerConsoleTab
      key="p"
      onOpenWhy={() => setSheet("why")}
      onSend={() => {
        go(2);
        setPlaying(true);
      }}
    />,
    <SimConsoleTab
      key="s"
      playing={playing}
      onTogglePlay={() => setPlaying((p) => !p)}
      speed={speed}
      onSpeed={setSpeed}
      hrHistory={hrHistory}
      onOpenHealth={() => setSheet("health")}
    />,
    <MissionsTab key="m" lang={state.lang} active={tab === 3} onOpen={setMissionOpen} />,
    <ResourcesTab key="r" lang={state.lang} onWindowChange={setResWindow} />,
    <ProjectTab key="pj" lang={state.lang} classicLink={variantSwitch} />,
  ];

  return createPortal(
    <div
      className="mw-ui mw-deck"
      ref={deckRef}
      data-tab={TAB_IDS[tab]}
      data-boot={booting ? "true" : undefined}
    >
      <div className="mw-sky" aria-hidden="true" />
      <MarsGlobe preset={introOpen || landing !== null ? "hidden" : GLOBE[tab]!} />
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <header className="brand">
        <button type="button" className="brand__home" title={d.back} onClick={() => go(0)}>
          <span className="brand__planet" aria-hidden="true" />
          <span className="brand__name">M.I.Y.H.</span>
        </button>
        <span className="brand__sep" aria-hidden="true">
          /
        </span>
        <span className="brand__tab">
          {pad(tab + 1)} · {d.brandTab[tab]}
        </span>
      </header>

      <div className="mw-topright">
        {/* Transparencia de simulación: visible en las pestañas con datos de misión y con eventos simulados */}
        {showSimBadge ? (
          <span
            className="chip chip--crit mw-simchip"
            role="note"
            title={dynamicEvents ? t.simBand : t.simBandNominal}
          >
            <span className="chip__dot chip__dot--pulse" /> SIMULATED
          </span>
        ) : null}
        <button
          type="button"
          className="chip mw-maps__btn"
          aria-current={TAB_IDS[tab] === "recursos" ? "page" : undefined}
          onClick={() => go(TAB_IDS.indexOf("recursos"))}
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          >
            <path d="M2.5 2.5h4l1.5 1.5h5.5v9.5h-11Z" />
            <path d="M5 8h6M5 10.5h4" />
          </svg>
          {state.lang === "es" ? "Referencias" : "References"}
        </button>
        <div className="mw-lang" role="group" aria-label="Idioma / Language">
          {(["es", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={state.lang === l}
              onClick={() => dispatchTrek({ type: "setLang", lang: l })}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {showSimBadge ? (
        <p className="mw-simnote t-label">{dynamicEvents ? t.simBand : t.simBandNominal}</p>
      ) : null}

      {critical ? (
        <button
          type="button"
          className="mw-alertband"
          role="alert"
          aria-live="assertive"
          onClick={() => setSheet("health")}
        >
          <b>
            ■ {fsm.state} · {directive.goalPolicy}
          </b>{" "}
          · {t.slopeLimit} {envelope.maxSlopeDeg}° · {t.latch} {fsm.latch}
          {directive.protocol ? ` · ${directive.protocol}` : ""}
          {fsm.requiresHumanConfirmation ? ` · ${t.awaitingHuman}` : ""}
        </button>
      ) : null}

      <main className="tabs">
        {tabs.map((node, i) => (
          <section
            key={TAB_IDS[i]}
            id={`tab-${TAB_IDS[i]}`}
            className={`tab${i === tab ? " is-active" : ""}${i < tab ? " is-before" : ""}`}
            aria-label={d.railTips[i]}
            aria-hidden={i !== tab}
            inert={i !== tab ? true : undefined}
          >
            {node}
          </section>
        ))}
      </main>

      <nav className="rail glass" aria-label="Secciones">
        <span className="rail__dot" aria-hidden="true" />
        {TAB_IDS.map((id, i) => (
          <button
            key={id}
            type="button"
            className="rail__item"
            aria-current={i === tab}
            aria-label={d.railTips[i]}
            onClick={() => go(i)}
          >
            {pad(i + 1)}
            <span className="rail__tip">{d.railTips[i]}</span>
          </button>
        ))}
      </nav>

      <div className="pager glass">
        <button
          type="button"
          className="pager__btn"
          aria-label={d.prev}
          disabled={tab === 0}
          onClick={() => go(tab - 1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 10 8 5.5 12.5 10" />
          </svg>
        </button>
        <span className="pager__count">
          <b>{pad(tab + 1)}</b> / {pad(TAB_IDS.length)}
        </span>
        <button
          type="button"
          className="pager__btn"
          aria-label={d.next}
          disabled={tab === TAB_IDS.length - 1}
          onClick={() => go(tab + 1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 6 8 10.5 12.5 6" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        className="sound-toggle glass"
        aria-pressed={soundOn}
        aria-label={
          soundOn
            ? state.lang === "es"
              ? "Silenciar"
              : "Mute sound"
            : state.lang === "es"
              ? "Activar sonido"
              : "Turn sound on"
        }
        onClick={() => setSoundOn((v) => !v)}
      >
        <span className="eq" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </button>

      {sheet === "why" ? (
        <DeckSheet label={t.why} onClose={closeSheet}>
          <WhyTab />
        </DeckSheet>
      ) : null}
      {sheet === "health" ? (
        <DeckSheet label={t.consoleTitle} onClose={closeSheet}>
          <HealthTab onRunScenario={runScenario} onOpenConfirm={() => setConfirmOpen(true)} />
        </DeckSheet>
      ) : null}
      {missionOpen !== null ? (
        <MissionSheet index={missionOpen} lang={state.lang} onClose={closeMission} />
      ) : null}
      {warpOpen ? (
        <WarpTransition
          lang={CINEMATIC_LANG}
          muted={!soundOn}
          onDone={() => {
            setWarpOpen(false);
            setIntroOpen(true);
          }}
        />
      ) : null}
      {introOpen ? <IntroOverlay lang={CINEMATIC_LANG} muted={!soundOn} onDone={endIntro} /> : null}
      {landing === "ready" ? (
        <ReadyToLand lang={CINEMATIC_LANG} onLand={startLanding} onSkip={finishLanding} />
      ) : null}
      {landing === "flying" && landingAudioRef.current ? (
        <Suspense fallback={<div className="ld" aria-busy="true" />}>
          <LandingSequence
            lang={CINEMATIC_LANG}
            audio={landingAudioRef.current}
            soundOn={soundOn}
            onToggleSound={() => setSoundOn((v) => !v)}
            onDone={finishLanding}
          />
        </Suspense>
      ) : null}
      {confirmOpen && fsm.requiresHumanConfirmation ? (
        <HumanConfirmModal onClose={closeConfirm} />
      ) : null}
    </div>,
    portalTarget,
  );
}
