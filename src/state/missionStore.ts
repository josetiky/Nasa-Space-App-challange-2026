/**
 * Single shared mission state: selected site → analysis → plan → simulation →
 * decisions → report. A pure reducer (unit-tested) behind a tiny external
 * store, persisted to localStorage and read with useSyncExternalStore.
 */
import { useSyncExternalStore } from "react";
import { chooseOption, createInitialState, runUntilDecision } from "@/core/sim/engine";
import { buildReport } from "@/core/sim/outcome";
import type { DecisionAnalysis, EvaPlan, GeoPoint, LocationAnalysis, MissionPlan, MissionReport, SimState, SiteRef } from "@/core/types";

export const STORAGE_KEY = "mars-survive:mission:v1";
const MAX_COMPARISON = 3;
const MAX_REPORTS = 12;
const MAX_TRAVERSE = 12;

export interface MissionStoreState {
  version: 1;
  selectedSite: SiteRef | null;
  analysis: LocationAnalysis | null;
  comparison: LocationAnalysis[];
  /** Planned regional traverse (great-circle legs between waypoints). */
  traverse: GeoPoint[];
  evaPlan: EvaPlan | null;
  plan: MissionPlan | null;
  sim: SimState | null;
  activeRunId: string | null;
  lastAnalysis: DecisionAnalysis | null;
  reports: MissionReport[];
  lastError: string | null;
}

export type MissionAction =
  | { type: "selectSite"; analysis: LocationAnalysis }
  | { type: "clearSite" }
  | { type: "pinComparison"; analysis: LocationAnalysis }
  | { type: "unpinComparison"; siteId: string }
  | { type: "clearComparison" }
  | { type: "addTraversePoint"; point: GeoPoint }
  | { type: "removeTraversePoint"; index: number }
  | { type: "clearTraverse" }
  | { type: "setEvaPlan"; plan: EvaPlan | null }
  | { type: "savePlan"; plan: MissionPlan }
  | { type: "startSimulation" }
  | { type: "advance"; sols: number }
  | { type: "setDecisionAnalysis"; analysis: DecisionAnalysis | null }
  | { type: "choose"; optionId: string }
  | { type: "abortSimulation" }
  | { type: "deleteReport"; id: string }
  | { type: "clearError" }
  | { type: "reset" };

export const initialMissionState: MissionStoreState = {
  version: 1,
  selectedSite: null,
  analysis: null,
  comparison: [],
  traverse: [],
  evaPlan: null,
  plan: null,
  sim: null,
  activeRunId: null,
  lastAnalysis: null,
  reports: [],
  lastError: null,
};

const isTerminal = (sim: SimState | null) => !!sim && (sim.status === "success" || sim.status === "compromised" || sim.status === "failed");

/** File the run's report once, when the simulation reaches an outcome. */
function fileReportIfDone(state: MissionStoreState): MissionStoreState {
  if (!isTerminal(state.sim) || !state.activeRunId) return state;
  if (state.reports.some((report) => report.id === state.activeRunId)) return state;
  const report = { ...buildReport(state.sim!), id: state.activeRunId };
  return { ...state, reports: [report, ...state.reports].slice(0, MAX_REPORTS) };
}

export function missionReducer(state: MissionStoreState, action: MissionAction): MissionStoreState {
  switch (action.type) {
    case "selectSite":
      return { ...state, selectedSite: action.analysis.site, analysis: action.analysis, lastError: null };
    case "clearSite":
      return { ...state, selectedSite: null, analysis: null };
    case "pinComparison": {
      const index = state.comparison.findIndex((item) => item.site.id === action.analysis.site.id);
      if (index >= 0) return { ...state, comparison: state.comparison.map((item, i) => (i === index ? action.analysis : item)) };
      return { ...state, comparison: [...state.comparison, action.analysis].slice(-MAX_COMPARISON) };
    }
    case "unpinComparison":
      return { ...state, comparison: state.comparison.filter((item) => item.site.id !== action.siteId) };
    case "clearComparison":
      return { ...state, comparison: [] };
    case "addTraversePoint":
      return { ...state, traverse: [...state.traverse, action.point].slice(-MAX_TRAVERSE) };
    case "removeTraversePoint":
      return { ...state, traverse: state.traverse.filter((_, i) => i !== action.index) };
    case "clearTraverse":
      return { ...state, traverse: [] };
    case "setEvaPlan":
      return { ...state, evaPlan: action.plan };
    case "savePlan":
      return { ...state, plan: action.plan, lastError: null };
    case "startSimulation": {
      if (!state.plan) return { ...state, lastError: "Create and save a mission plan before starting the simulation." };
      const sim = createInitialState(state.plan);
      const runId = `run-${state.plan.id}-${state.plan.seed}-${Date.now().toString(36)}`;
      return { ...state, sim, activeRunId: runId, lastAnalysis: null, lastError: null };
    }
    case "advance": {
      if (!state.sim || state.sim.status !== "running") return fileReportIfDone(state);
      const sols = Math.max(1, Math.floor(action.sols));
      return fileReportIfDone({ ...state, sim: runUntilDecision(state.sim, sols), lastError: null });
    }
    case "setDecisionAnalysis":
      return { ...state, lastAnalysis: action.analysis };
    case "choose": {
      const sim = state.sim;
      if (!sim || sim.status !== "awaiting-decision" || !sim.pending) return { ...state, lastError: "There is no pending decision." };
      const recommended = state.lastAnalysis && state.lastAnalysis.eventId === sim.pending.id ? state.lastAnalysis.recommendedId : null;
      try {
        const next = chooseOption(sim, action.optionId, recommended);
        return fileReportIfDone({ ...state, sim: next, lastAnalysis: null, lastError: null });
      } catch (error) {
        return { ...state, lastError: error instanceof Error ? error.message : String(error) };
      }
    }
    case "abortSimulation":
      return { ...state, sim: null, activeRunId: null, lastAnalysis: null };
    case "deleteReport":
      return { ...state, reports: state.reports.filter((report) => report.id !== action.id) };
    case "clearError":
      return { ...state, lastError: null };
    case "reset":
      return initialMissionState;
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Persistence                                                          */
/* ------------------------------------------------------------------ */

export function serializeMission(state: MissionStoreState): string {
  return JSON.stringify({ ...state, lastError: null });
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const looksLikeSim = (value: unknown) => isObject(value) && isObject(value["ctx"]) && isObject(value["resources"]) && Array.isArray(value["history"]) && typeof value["sol"] === "number";
const looksLikePlan = (value: unknown) => isObject(value) && isObject(value["site"]) && isObject(value["environment"]) && typeof value["durationSols"] === "number";
const looksLikeAnalysis = (value: unknown) => isObject(value) && isObject(value["site"]) && isObject(value["scores"]) && isObject(value["environment"]);

/** Parse persisted state defensively: anything unexpected is dropped, never trusted. */
export function deserializeMission(raw: string | null): MissionStoreState {
  if (!raw) return initialMissionState;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return initialMissionState;
  }
  if (!isObject(parsed) || parsed["version"] !== 1) return initialMissionState;
  const analysis = looksLikeAnalysis(parsed["analysis"]) ? (parsed["analysis"] as unknown as LocationAnalysis) : null;
  const sim = looksLikeSim(parsed["sim"]) ? (parsed["sim"] as unknown as SimState) : null;
  return {
    version: 1,
    selectedSite: analysis ? analysis.site : null,
    analysis,
    traverse: Array.isArray(parsed["traverse"])
      ? (parsed["traverse"].filter((p) => isObject(p) && typeof p["lat"] === "number" && typeof p["lon"] === "number" && Math.abs(p["lat"]) <= 90 && Math.abs(p["lon"]) <= 180) as GeoPoint[]).slice(-MAX_TRAVERSE)
      : [],
    comparison: Array.isArray(parsed["comparison"]) ? (parsed["comparison"].filter(looksLikeAnalysis) as LocationAnalysis[]).slice(-MAX_COMPARISON) : [],
    evaPlan: isObject(parsed["evaPlan"]) && Array.isArray(parsed["evaPlan"]["waypoints"]) ? (parsed["evaPlan"] as unknown as EvaPlan) : null,
    plan: looksLikePlan(parsed["plan"]) ? (parsed["plan"] as unknown as MissionPlan) : null,
    sim,
    activeRunId: sim && typeof parsed["activeRunId"] === "string" ? parsed["activeRunId"] : null,
    lastAnalysis: sim && isObject(parsed["lastAnalysis"]) && Array.isArray(parsed["lastAnalysis"]["alternatives"]) ? (parsed["lastAnalysis"] as unknown as DecisionAnalysis) : null,
    reports: Array.isArray(parsed["reports"]) ? (parsed["reports"].filter((r) => isObject(r) && typeof r["id"] === "string" && Array.isArray(r["history"])) as MissionReport[]).slice(0, MAX_REPORTS) : [],
    lastError: null,
  };
}

/* ------------------------------------------------------------------ */
/* External store + React binding                                       */
/* ------------------------------------------------------------------ */

type Listener = () => void;

function createMissionStore() {
  let state: MissionStoreState | null = null;
  const listeners = new Set<Listener>();

  const load = (): MissionStoreState => {
    if (state) return state;
    if (typeof window === "undefined") return initialMissionState;
    try {
      state = deserializeMission(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      state = initialMissionState;
    }
    return state;
  };

  const persist = (next: MissionStoreState) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeMission(next));
    } catch {
      // Storage full or blocked (private mode): the session keeps working in memory.
    }
  };

  return {
    getState: load,
    getServerState: () => initialMissionState,
    dispatch(action: MissionAction) {
      const current = load();
      const next = missionReducer(current, action);
      if (next === current) return;
      state = next;
      persist(next);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key !== STORAGE_KEY) return;
        state = deserializeMission(event.newValue);
        listener();
      };
      if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export const missionStore = createMissionStore();
export const dispatchMission = (action: MissionAction) => missionStore.dispatch(action);

/** Read the shared mission state (optionally a slice; selectors must return stored references). */
export function useMission(): MissionStoreState;
export function useMission<T>(selector: (state: MissionStoreState) => T): T;
export function useMission<T>(selector?: (state: MissionStoreState) => T) {
  const snapshot = useSyncExternalStore(missionStore.subscribe, missionStore.getState, missionStore.getServerState);
  return selector ? selector(snapshot) : snapshot;
}
