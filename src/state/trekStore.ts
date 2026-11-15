/**
 * Mars Trek · Store reactivo de la pantalla /trek (Tarea 11, Decisión D-A3).
 * Sigue el patrón de missionStore (reductor puro + useSyncExternalStore + persistencia defensiva)
 * con su propia clave para no alterar el esquema persistido mars-survive:mission:v1.
 */
import { useSyncExternalStore } from "react";
import type {
  LocalPoint,
  MissionProfileId,
  SimEvent,
  WeightProfileId,
} from "@/core/trek/contracts";
import { buildStaticTerrain } from "@/core/trek/costmap/terrain";
import { twoCorridorField } from "@/core/trek/costmap/synthetic";
import {
  createSession,
  dispatch as dispatchSession,
  setHuellaReplay,
  setMarsEnv,
  tick as tickSession,
  updateLive,
  type LiveConfig,
  type LivePatch,
  type TrekSessionState,
} from "@/core/trek/sim/session";
import { DEFAULT_CREW } from "@/core/trek/health/liveSuit";
import type { MarsEnvSnapshot } from "@/core/trek/env/marsEnv";
import type { HuellaReplayTrace } from "@/core/trek/health/huellaReplay";
import { TREK_SCENARIOS } from "@/core/trek/sim/scenarios";
import { getTrekSite, type SiteManifest, type TrekSiteInfo } from "@/services/trek/sites";
import type { HeightGrid } from "@/core/science/routing";
import type { TrekLang } from "@/components/trek/i18n";

export const TREK_STORAGE_KEY = "mars-survive:trek:v1";

export type MapLayerId = "elevation" | "slope" | "zones" | "confidence" | "dust" | "radiation";
export type MapPickMode = "inspect" | "origin" | "goal" | "storm";

export interface TrekStoreState {
  readonly version: 1;
  readonly lang: TrekLang;
  readonly siteId: string;
  readonly siteInfo: TrekSiteInfo;
  readonly manifest: SiteManifest | null;
  /** Sitio cuya tesela ya construyó la sesión actual; evita recrear la sesión al remontar una vista. */
  readonly loadedSiteId: string | null;
  readonly loadingTile: boolean;
  readonly loadError: string | null;
  readonly activeLayer: MapLayerId;
  readonly visibleOverlays: {
    readonly zones: boolean;
    readonly confidence: boolean;
    readonly route: boolean;
    readonly alternatives: boolean;
    readonly shelters: boolean;
    readonly pois: boolean;
  };
  readonly pickMode: MapPickMode;
  readonly inspectedPoint: LocalPoint;
  readonly activeScenarioId: string | null;
  readonly scenarioStepIdx: number;
  readonly session: TrekSessionState;
}

export type TrekStoreAction =
  | { readonly type: "setLang"; readonly lang: TrekLang }
  | {
      readonly type: "setSiteLoaded";
      readonly site: TrekSiteInfo;
      readonly grid: HeightGrid;
      readonly manifest: SiteManifest | null;
    }
  | { readonly type: "setSiteLoading"; readonly siteId: string }
  | { readonly type: "setSiteError"; readonly error: string }
  | { readonly type: "setActiveLayer"; readonly layer: MapLayerId }
  | {
      readonly type: "toggleOverlay";
      readonly overlay: keyof TrekStoreState["visibleOverlays"];
    }
  | { readonly type: "setPickMode"; readonly mode: MapPickMode }
  | { readonly type: "inspectPoint"; readonly point: LocalPoint }
  | { readonly type: "setMissionProfile"; readonly profile: MissionProfileId }
  | { readonly type: "setWeightProfile"; readonly profile: WeightProfileId }
  | { readonly type: "simEvent"; readonly event: SimEvent | readonly SimEvent[] }
  | { readonly type: "simTick"; readonly dtS: number }
  | { readonly type: "acceptProposedRoute" }
  | { readonly type: "clearStorms" }
  | { readonly type: "runScenarioStep"; readonly scenarioId: string }
  /**
   * Fuente de telemetría: caminata HUELLA de "metricas de vida" (reinicia el reloj a T+0 salvo con el
   * candado humano activo) o null para volver al generador determinista.
   */
  | { readonly type: "setHuellaReplay"; readonly trace: HuellaReplayTrace | null }
  /** Misión individual: parámetros del astronauta, fallas en el camino y protocolo (liveSuit.ts). */
  | { readonly type: "updateLive"; readonly patch: LivePatch }
  /** Entorno de Marte (reloj real + REMS + DONKI) o null para volver a los valores fijos. */
  | { readonly type: "setMarsEnv"; readonly env: MarsEnvSnapshot | null }
  | { readonly type: "resetSession" };

function createInitialStoreState(): TrekStoreState {
  const synSite = getTrekSite("synthetic_two_corridors");
  const synField = twoCorridorField();
  const session = createSession({
    terrain: synField.terrain,
    origin: synSite.defaultOrigin,
    goal: synSite.defaultGoal,
    shelters: synSite.shelters,
    missionProfile: "team",
    weightProfile: "balanced",
    vehicle: "crew-foot",
  });

  return {
    version: 1,
    lang: "es",
    siteId: "murray_buttes",
    siteInfo: getTrekSite("murray_buttes"),
    manifest: null,
    loadedSiteId: null,
    loadingTile: false,
    loadError: null,
    activeLayer: "elevation",
    visibleOverlays: {
      zones: true,
      confidence: true,
      route: true,
      alternatives: true,
      shelters: true,
      pois: true,
    },
    pickMode: "goal",
    inspectedPoint: { x: 0, z: 0 },
    activeScenarioId: null,
    scenarioStepIdx: 0,
    session,
  };
}

export const initialTrekState: TrekStoreState = createInitialStoreState();

/** Configuración del astronauta en vivo a conservar al recrear la sesión (el estado físico se reinicia). */
function liveConfigOf(s: TrekSessionState): LiveConfig | null {
  return s.live
    ? { params: s.live.params, faults: s.live.faults, protocol: s.live.protocol }
    : null;
}

/**
 * Candado de confirmación humana (ASTRONAUT_HEALTH_STATE_MACHINE): mientras la FSM lo exige,
 * ninguna acción puede recrear la sesión (reset, cambio de sitio o de misión), porque eso
 * devolvería la FSM a NORMAL sin la autorización registrada. Solo `human-authorize` lo libera.
 */
export function isHumanLockActive(state: Pick<TrekStoreState, "session">): boolean {
  return state.session.fsm.requiresHumanConfirmation;
}

/** ¿Hay que (re)cargar la tesela del sitio seleccionado? Falso si la sesión ya se construyó con ella. */
export function needsSiteLoad(state: Pick<TrekStoreState, "siteId" | "loadedSiteId">): boolean {
  return state.loadedSiteId !== state.siteId;
}

export function trekReducer(state: TrekStoreState, action: TrekStoreAction): TrekStoreState {
  switch (action.type) {
    case "setLang":
      return { ...state, lang: action.lang };

    case "setSiteLoading":
      if (isHumanLockActive(state) && action.siteId !== state.loadedSiteId) return state;
      return {
        ...state,
        siteId: action.siteId,
        siteInfo: getTrekSite(action.siteId),
        loadingTile: true,
        loadError: null,
      };

    case "setSiteError":
      return { ...state, loadingTile: false, loadError: action.error };

    case "setSiteLoaded": {
      if (isHumanLockActive(state)) return { ...state, loadingTile: false };
      const terrain =
        action.site.id === "synthetic_two_corridors"
          ? twoCorridorField().terrain
          : buildStaticTerrain(action.grid, {
              siteId: action.site.id,
              baseConfidence: action.site.baseConfidence,
              baseResolutionM: action.site.resolutionM,
              roverTraversePoints: action.site.roverTraversePoints,
              simulated: action.site.simulated,
            });
      const session = createSession({
        terrain,
        origin: action.site.defaultOrigin,
        goal: action.site.defaultGoal,
        stops: action.site.defaultStops,
        shelters: action.site.shelters,
        missionProfile: state.session.missionProfile,
        weightProfile: state.session.weightProfile,
        customWeights: state.session.customWeights,
        vehicle: state.session.vehicle,
        huellaReplay: state.session.huellaReplay,
        live: liveConfigOf(state.session),
        env: state.session.env,
      });
      return {
        ...state,
        siteId: action.site.id,
        siteInfo: action.site,
        manifest: action.manifest,
        loadedSiteId: action.site.id,
        loadingTile: false,
        loadError: null,
        inspectedPoint: action.site.defaultOrigin,
        activeScenarioId: null,
        scenarioStepIdx: 0,
        session,
      };
    }

    case "setActiveLayer":
      return { ...state, activeLayer: action.layer };

    case "toggleOverlay":
      return {
        ...state,
        visibleOverlays: {
          ...state.visibleOverlays,
          [action.overlay]: !state.visibleOverlays[action.overlay],
        },
      };

    case "setPickMode":
      return { ...state, pickMode: action.mode };

    case "inspectPoint":
      return { ...state, inspectedPoint: action.point };

    case "setMissionProfile": {
      if (isHumanLockActive(state)) return state;
      const vehicle =
        action.profile === "rover"
          ? "rover-auto"
          : action.profile === "rover-crew"
            ? "rover-crewed"
            : "crew-foot";
      const nextSession = createSession({
        terrain: state.session.terrain,
        origin: state.session.origin,
        goal: state.session.goal,
        stops: state.session.stops,
        shelters: state.session.shelters,
        missionProfile: action.profile,
        weightProfile: state.session.weightProfile,
        customWeights: state.session.customWeights,
        vehicle,
        huellaReplay: state.session.huellaReplay,
        // La misión individual trae al astronauta en vivo con parámetros y fallas editables
        live:
          action.profile === "solo"
            ? (liveConfigOf(state.session) ?? { params: DEFAULT_CREW })
            : null,
        env: state.session.env,
      });
      return { ...state, session: nextSession };
    }

    case "setWeightProfile":
      return {
        ...state,
        session: dispatchSession(state.session, {
          kind: "set-weight-profile",
          profileId: action.profile,
          simulated: false,
        }),
      };

    case "simEvent":
      return {
        ...state,
        session: dispatchSession(state.session, action.event),
      };

    case "simTick":
      return {
        ...state,
        session: tickSession(state.session, action.dtS),
      };

    case "acceptProposedRoute": {
      if (!state.session.proposedRoute) return state;
      return {
        ...state,
        session: {
          ...state.session,
          activeRoute: state.session.proposedRoute,
          proposedRoute: null,
        },
      };
    }

    case "clearStorms": {
      const clearEvents = state.session.storms
        .filter((s) => s.active)
        .map((s): SimEvent => ({ kind: "storm-clear", stormId: s.id, simulated: true }));
      if (clearEvents.length === 0 && !state.session.sepAlertActive) return state;
      return {
        ...state,
        session: dispatchSession(state.session, [
          ...clearEvents,
          { kind: "sep-alert", active: false, simulated: true },
        ]),
      };
    }

    case "runScenarioStep": {
      const sc = TREK_SCENARIOS.find((s) => s.id === action.scenarioId);
      if (!sc) return state;
      const isSame = state.activeScenarioId === sc.id;
      const stepIdx = isSame ? state.scenarioStepIdx : 0;
      const step = sc.steps[stepIdx] ?? sc.steps[0];
      if (!step) return state;
      const nextSession = dispatchSession(state.session, step.events);
      return {
        ...state,
        activeScenarioId: sc.id,
        scenarioStepIdx: (stepIdx + 1) % sc.steps.length,
        session: nextSession,
      };
    }

    case "resetSession": {
      if (isHumanLockActive(state)) return state;
      const nextSession = createSession({
        terrain: state.session.terrain,
        origin: state.siteInfo.defaultOrigin,
        goal: state.siteInfo.defaultGoal,
        stops: state.siteInfo.defaultStops,
        shelters: state.siteInfo.shelters,
        missionProfile: state.session.missionProfile,
        weightProfile: state.session.weightProfile,
        customWeights: state.session.customWeights,
        vehicle: state.session.vehicle,
        huellaReplay: state.session.huellaReplay,
        live: liveConfigOf(state.session),
        env: state.session.env,
      });
      return {
        ...state,
        activeScenarioId: null,
        scenarioStepIdx: 0,
        session: nextSession,
      };
    }

    case "setMarsEnv":
      return { ...state, session: setMarsEnv(state.session, action.env) };

    case "updateLive": {
      if (!state.session.live) return state;
      let session = updateLive(state.session, action.patch);
      // "Todo nominal" también apaga un evento solar simulado
      if (action.patch.nominal && session.sepAlertActive) {
        session = dispatchSession(session, { kind: "sep-alert", active: false, simulated: true });
      }
      return { ...state, session };
    }

    case "setHuellaReplay": {
      if (!action.trace || isHumanLockActive(state)) {
        // Volver al generador, o cambiar de caminata con el candado puesto: sin recrear la sesión
        return { ...state, session: setHuellaReplay(state.session, action.trace) };
      }
      const nextSession = createSession({
        terrain: state.session.terrain,
        origin: state.session.origin,
        goal: state.session.goal,
        stops: state.session.stops,
        shelters: state.session.shelters,
        missionProfile: state.session.missionProfile,
        weightProfile: state.session.weightProfile,
        customWeights: state.session.customWeights,
        vehicle: state.session.vehicle,
        huellaReplay: action.trace,
        live: liveConfigOf(state.session),
        env: state.session.env,
      });
      return { ...state, activeScenarioId: null, scenarioStepIdx: 0, session: nextSession };
    }

    default:
      return state;
  }
}

type Listener = () => void;

function createTrekStore() {
  let state: TrekStoreState = initialTrekState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    getServerState: () => initialTrekState,
    dispatch(action: TrekStoreAction) {
      const next = trekReducer(state, action);
      if (next === state) return;
      state = next;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            TREK_STORAGE_KEY,
            JSON.stringify({
              version: 1,
              lang: state.lang,
              siteId: state.siteId,
              activeLayer: state.activeLayer,
            }),
          );
        } catch {
          /* storage unavailable */
        }
      }
      listeners.forEach((l) => l());
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const trekStore = createTrekStore();
export const dispatchTrek = (action: TrekStoreAction) => trekStore.dispatch(action);

export function useTrek(): TrekStoreState;
export function useTrek<T>(selector: (s: TrekStoreState) => T): T;
export function useTrek<T>(selector?: (s: TrekStoreState) => T) {
  const snap = useSyncExternalStore(
    trekStore.subscribe,
    trekStore.getState,
    trekStore.getServerState,
  );
  return selector ? selector(snap) : snap;
}
