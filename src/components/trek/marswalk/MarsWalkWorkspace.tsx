/**
 * M.I.Y.H. — Mars In Your Hands · Cubierta principal con progresión guiada paso a paso:
 *
 *   01 Inicio      título M. I. Y. H., Marte 3D girable, "Comenzar la misión" → video y aterrizaje obligatorio
 *   02 MarsWalk    planificador sobre la malla real de Gale (A* + envolvente) con guía integrada y scroll interno
 *   03 Simulación  plano isométrico, vitales HUELLA (SIMULATED), asistente y guía integrada con scroll interno
 *   04 Exploración compuerta + guía amigable para niños + simulador de caminata 3D en Unity
 *   05 Misiones    carrusel cóncavo de 11 misiones + ficha con terreno 3D integrado
 *   06 Proyecto    tripulación, reto y créditos
 *   07 Recursos    fuentes y datos
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
import { evaluateHistorical } from "./historicalBus";
import { MarsEnvLoader, MarsEnvPanel } from "./MarsEnvPanel";
import { MarsGlobe, type GlobePreset } from "./MarsGlobe";
import { DeckSheet, HealthTab, HumanConfirmModal, type Speed, WhyTab } from "./panels";
import { PlannerConsoleTab } from "./plannerConsole";
import { ResourcesTab } from "./resourcesTab";
import { ExplorationTab } from "./explorationTab";
import { GUIDE_SEEN_KEY, GuideStepBar, GuideTour, GuideWelcome } from "./missionGuide";
import { SimConsoleTab } from "./simConsole";
import { walkComplete } from "@/core/trek/sim/session";
import "./marswalk.css";

// La escena 3D del aterrizaje solo se descarga cuando alguien presiona "Aterrizar".
const LandingSequence = lazy(() => import("./landing/LandingSequence"));

const HR_BUFFER = 120;
export const DECK_TAB_IDS = [
  "inicio",
  "marswalk",
  "simulacion",
  "exploracion",
  "misiones",
  "proyecto",
  "recursos",
] as const;
export type DeckTabId = (typeof DECK_TAB_IDS)[number];
const TAB_IDS = DECK_TAB_IDS;

/** Preset de Marte por pestaña. */
const GLOBE: readonly GlobePreset[] = [
  "hero",
  "corner",
  "corner",
  "hidden",
  "hidden",
  "behind",
  "hidden",
];
const SOUND_KEY = "miyh.sound";
const CINEMATIC_LANG = "en" as const;
const pad = (n: number) => String(n).padStart(2, "0");

export default function MarsWalkWorkspace({
  variantSwitch,
}: {
  variantSwitch?: ReactNode;
  initialTab?: DeckTabId;
}) {
  const state = useTrek();
  const t = MW_TEXTS[state.lang];
  const d = DECK_TEXTS[state.lang];
  const { session } = state;
  const { fsm, directive, envelope } = session;

  // Al inicio SIEMPRE arranca en "inicio" (tab 0) para que lo único que deje hacer sea ver la animación de video y aterrizar.
  const [tab, setTab] = useState(0);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  // Estados de desbloqueo progresivo (no deja bajar a la siguiente vista hasta completar la anterior)
  const [hasLanded, setHasLanded] = useState(false);
  const [planningDone, setPlanningDone] = useState(false);
  const [simDone, setSimDone] = useState(false);
  const [unityDone, setUnityDone] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(15);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheet, setSheet] = useState<"why" | "health" | "env" | null>(null);
  const [missionOpen, setMissionOpen] = useState<number | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [warpOpen, setWarpOpen] = useState(false);
  const [resWindow, setResWindow] = useState(false);

  // Tutorial de misión
  const [guideOpen, setGuideOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(GUIDE_SEEN_KEY) !== "1") setWelcomeOpen(true);
    } catch {
      setWelcomeOpen(true);
    }
  }, []);
  const markGuideSeen = useCallback(() => {
    setWelcomeOpen(false);
    try {
      window.localStorage.setItem(GUIDE_SEEN_KEY, "1");
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  // Secuencia de aterrizaje: null → "ready" → "flying" → planeador
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
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setPortalTarget(document.body), []);

  // Cuando la caminata simulada concluye, queda desbloqueado permanentemente el paso a Unity (tab 3)
  const isWalkFinished = walkComplete(session);
  useEffect(() => {
    if (isWalkFinished && !simDone) {
      setSimDone(true);
    }
  }, [isWalkFinished, simDone]);

  const routeValid = Boolean(
    session.activeRoute && session.routeResult.ok && !state.loadingTile && !state.loadError,
  );
  const canLeavePlanning = hasLanded && (planningDone || false) && routeValid;

  // Cálculo de la pestaña máxima desbloqueada según lo que el usuario ya completó
  const maxUnlockedTab = !hasLanded
    ? 0
    : !canLeavePlanning
      ? 1
      : !(simDone || isWalkFinished)
        ? 2
        : !unityDone
          ? 3
          : TAB_IDS.length - 1;

  const maxUnlockedRef = useRef(maxUnlockedTab);
  maxUnlockedRef.current = maxUnlockedTab;

  // Explicación clara cuando el botón de Bajar está bloqueado
  const es = state.lang === "es";
  let lockReason: string | null = null;
  if (tab === 0 && !hasLanded) {
    lockReason = es
      ? "Primero ve la animación y aterriza"
      : "Watch the video & land first";
  } else if (tab === 1 && maxUnlockedTab < 2) {
    lockReason = es
      ? "Calcula tu ruta o pulsa «Empezar caminata»"
      : "Compute route or press “Start the walk”";
  } else if (tab === 2 && maxUnlockedTab < 3) {
    lockReason = es
      ? "Completa la simulación en vivo al 100%"
      : "Complete the live simulation to 100%";
  } else if (tab === 3 && maxUnlockedTab < 4) {
    lockReason = es
      ? "Abre Unity y pulsa «Finalizar recorrido»"
      : "Open Unity and press “Finish walk”";
  }

  const go = useCallback((i: number, force = false) => {
    const limit = force ? TAB_IDS.length - 1 : maxUnlockedRef.current;
    const next = Math.max(0, Math.min(limit, Math.min(TAB_IDS.length - 1, i)));
    setTab(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${TAB_IDS[next]}`,
      );
    }
  }, []);

  // Al cargar al inicio, mantenemos el hash sincronizado con #inicio hasta que aterrice
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${TAB_IDS[0]}`,
      );
    }
  }, []);

  // Si alguien cambia el hash manualmente en la URL, respeta el candado de etapa actual
  useEffect(() => {
    const onHash = () => {
      const idx = TAB_IDS.indexOf(window.location.hash.slice(1) as DeckTabId);
      if (idx >= 0) {
        const clamped = Math.min(idx, maxUnlockedRef.current);
        setTab(clamped);
        if (clamped !== idx) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}#${TAB_IDS[clamped]}`,
          );
        }
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // La página abre en inglés por defecto; el selector ES/EN cambia toda la UI
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

  // Carga de la tesela real
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

  // Tecla Escape para volver a modo inspección en el mapa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatchTrek({ type: "setPickMode", mode: "inspect" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Bucle de reproducción: 1 tick de simulación por segundo real
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      dispatchTrek({ type: "simTick", dtS: speed });
      evaluateHistorical(speed);
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  // Fin de la EVA: pausa automática al terminar la caminata
  useEffect(() => {
    if (playing && walkComplete(session)) setPlaying(false);
  }, [playing, session]);

  // Buffer de vista para la minigráfica de FC
  useEffect(() => {
    if (session.clockS < lastClockRef.current) setHrHistory([]);
    lastClockRef.current = session.clockS;
    const v = session.latestTelemetryRow?.["heart_rate_bpm"];
    if (typeof v === "number" && Number.isFinite(v))
      setHrHistory((h) => [...h, v].slice(-HR_BUFFER));
  }, [session.latestTelemetryRow, session.clockS]);

  // Candado de confirmación humana
  const prevRequiresRef = useRef(fsm.requiresHumanConfirmation);
  useEffect(() => {
    if (fsm.requiresHumanConfirmation && !prevRequiresRef.current) {
      setConfirmOpen(true);
    }
    prevRequiresRef.current = fsm.requiresHumanConfirmation;
  }, [fsm.requiresHumanConfirmation]);

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

  /** Fin o salto del aterrizaje → desbloquea Planeación y enciende la consola. */
  const finishLanding = useCallback(() => {
    landingAudioRef.current?.dispose();
    landingAudioRef.current = null;
    setLanding(null);
    setHasLanded(true);
    maxUnlockedRef.current = Math.max(maxUnlockedRef.current, 1);
    go(1, true);
    setBooting(true);
    window.setTimeout(() => setBooting(false), 1700);
  }, [go]);

  const critical = fsm.state === "CRITICAL" || fsm.state === "EMERGENCY";
  const dynamicEvents =
    session.storms.some((s) => s.active) ||
    session.sepAlertActive ||
    session.telemetry.incident !== "nominal";
  const simNote = dynamicEvents
    ? t.simBand
    : session.huellaReplay
      ? t.simBandReplay
      : session.live
        ? t.simBandLive
        : t.simBandNominal;
  const showSimBadge = tab === 1 || tab === 2 || dynamicEvents;

  if (!portalTarget) return null;

  const tabs: ReactNode[] = [
    <InicioTab
      key="i"
      lang={state.lang}
      active={tab === 0}
      onStartTour={() => {
        markGuideSeen();
        setWarpOpen(true);
      }}
    />,
    <PlannerConsoleTab
      key="p"
      onOpenWhy={() => setSheet("why")}
      onRouteConfirmed={() => setPlanningDone(true)}
      onGoUp={() => go(0)}
      onSend={() => {
        setPlanningDone(true);
        maxUnlockedRef.current = Math.max(maxUnlockedRef.current, 2);
        go(2, true);
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
      simDone={simDone || isWalkFinished}
      onGoUp={() => go(1)}
      onGoNext={() => {
        setSimDone(true);
        maxUnlockedRef.current = Math.max(maxUnlockedRef.current, 3);
        go(3, true);
      }}
      onOpenHealth={() => setSheet("health")}
      onOpenConfirm={() => setConfirmOpen(true)}
      onOpenEnv={() => setSheet("env")}
      onRunScenario={runScenario}
    />,
    <ExplorationTab
      key="x"
      lang={state.lang}
      active={TAB_IDS[tab] === "exploracion"}
      onFinish={() => {
        setUnityDone(true);
        maxUnlockedRef.current = TAB_IDS.length - 1;
        go(TAB_IDS.indexOf("misiones"), true);
      }}
      onBackToWalk={() => go(TAB_IDS.indexOf("simulacion"))}
    />,
    <MissionsTab
      key="m"
      lang={state.lang}
      active={TAB_IDS[tab] === "misiones"}
      onOpen={(i) => setMissionOpen(i)}
      onNext={() => go(TAB_IDS.indexOf("proyecto"))}
    />,
    <ProjectTab
      key="pj"
      lang={state.lang}
      classicLink={variantSwitch}
      onOpenSources={() => go(TAB_IDS.indexOf("recursos"))}
    />,
    <ResourcesTab key="r" lang={state.lang} onWindowChange={setResWindow} />,
  ];

  return createPortal(
    <div
      className="mw-ui mw-deck"
      ref={deckRef}
      data-tab={TAB_IDS[tab]}
      data-boot={booting ? "true" : undefined}
    >
      <div className="mw-sky" aria-hidden="true" />
      <MarsEnvLoader />
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
        {showSimBadge ? (
          <span className="chip chip--crit mw-simchip" role="note" title={simNote}>
            <span className="chip__dot chip__dot--pulse" /> SIMULATED
          </span>
        ) : null}
        {maxUnlockedTab >= TAB_IDS.indexOf("recursos") ? (
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
        ) : null}
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
      {showSimBadge ? <p className="mw-simnote t-label">{simNote}</p> : null}

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

      {/* El rail y el paginador se activan después de aterrizar, respetando las vistas desbloqueadas */}
      {hasLanded ? (
        <>
          <nav className="rail glass" aria-label="Secciones">
            <span className="rail__dot" aria-hidden="true" />
            {TAB_IDS.map((id, i) => {
              const unlocked = i <= maxUnlockedTab;
              return (
                <button
                  key={id}
                  type="button"
                  className="rail__item"
                  aria-current={i === tab}
                  aria-label={d.railTips[i]}
                  disabled={!unlocked}
                  onClick={() => unlocked && go(i)}
                >
                  {unlocked ? pad(i + 1) : "🔒"}
                  <span className="rail__tip">
                    {unlocked
                      ? d.railTips[i]
                      : es
                        ? `${d.railTips[i]} (Completa la vista anterior)`
                        : `${d.railTips[i]} (Complete previous view)`}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="pager glass">
            <button
              type="button"
              className="pager__btn"
              aria-label={d.prev}
              title={es ? "Subir a la vista anterior" : "Go up to previous view"}
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
              title={
                tab + 1 <= maxUnlockedTab
                  ? es
                    ? "Bajar a la siguiente vista"
                    : "Go down to next view"
                  : (lockReason ?? (es ? "Completa esta vista primero" : "Complete this view first"))
              }
              disabled={tab >= maxUnlockedTab || tab === TAB_IDS.length - 1}
              onClick={() => go(tab + 1)}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 6 8 10.5 12.5 6" />
              </svg>
            </button>
          </div>
        </>
      ) : null}

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
      {sheet === "env" ? (
        <DeckSheet
          label={state.lang === "es" ? "Entorno de Marte" : "Mars environment"}
          onClose={closeSheet}
        >
          <MarsEnvPanel />
        </DeckSheet>
      ) : null}
      {sheet === "health" ? (
        <DeckSheet label={t.consoleTitle} onClose={closeSheet}>
          <HealthTab onRunScenario={runScenario} onOpenConfirm={() => setConfirmOpen(true)} />
        </DeckSheet>
      ) : null}
      {missionOpen !== null ? (
        <MissionSheet
          key={`${missionOpen}`}
          index={missionOpen}
          lang={state.lang}
          onClose={closeMission}
        />
      ) : null}

      {/* Barra superior de pasos y botón Tutorial (visible siempre fuera de cinemáticas) */}
      {!critical && !introOpen && !warpOpen && landing === null && !resWindow ? (
        <GuideStepBar
          lang={state.lang}
          tab={tab}
          maxUnlockedTab={maxUnlockedTab}
          lockReason={lockReason}
          go={go}
          highlightNext={
            (TAB_IDS[tab] === "marswalk" && canLeavePlanning) ||
            (TAB_IDS[tab] === "simulacion" && (simDone || isWalkFinished))
          }
          onOpenGuide={() => {
            markGuideSeen();
            setGuideOpen(true);
          }}
        />
      ) : null}
      {welcomeOpen && tab === 0 && !introOpen && !warpOpen && landing === null && !guideOpen ? (
        <GuideWelcome
          lang={state.lang}
          onStart={() => {
            markGuideSeen();
            setGuideOpen(true);
          }}
          onSkip={markGuideSeen}
        />
      ) : null}
      {guideOpen ? (
        <GuideTour
          lang={state.lang}
          tabIds={TAB_IDS}
          currentTab={tab}
          go={go}
          onClose={() => setGuideOpen(false)}
        />
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
