/**
 * M.I.Y.H. · Eventos automáticos por precedentes reales (puente UI ↔ core/trek/sim/historicalEvents).
 *
 * Después de cada simTick evalúa el catálogo con el estado actual y despacha los mismos
 * dispatchTrek(...) que los botones manuales (simEvent / updateLive). Guarda una bitácora
 * con la referencia histórica de cada disparo para mostrarla en la consola 03.
 */
import { useSyncExternalStore } from "react";
import type { SimEvent } from "@/core/trek/contracts";
import {
  rollHistoricalIncidents,
  type HistoricalContext,
  type HistoricalFiring,
  type HistoricalIntensity,
} from "@/core/trek/sim/historicalEvents";
import { dispatchTrek, isHumanLockActive, trekStore } from "@/state/trekStore";

export interface HistoricalBusState {
  readonly enabled: boolean;
  readonly intensity: HistoricalIntensity;
  readonly log: readonly HistoricalFiring[];
}

// "Realista" por defecto: el recorrido científico por defecto dura ~2.6 h, así que las tasas
// históricas ya dan ~2 incidentes esperados por EVA; "Demo ×12" queda para caminatas cortas.
let state: HistoricalBusState = { enabled: true, intensity: "realistic", log: [] };
let fired = new Set<string>();
let lastClock = 0;
const listeners = new Set<() => void>();

function set(next: Partial<HistoricalBusState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export function setHistoricalEnabled(enabled: boolean) {
  set({ enabled });
}
export function setHistoricalIntensity(intensity: HistoricalIntensity) {
  set({ intensity });
}

export function useHistoricalBus(): HistoricalBusState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** Llamar justo después de cada simTick. */
export function evaluateHistorical(dtS: number) {
  const s = trekStore.getState();
  const session = s.session;
  // Reinicio de la caminata → bitácora nueva
  if (session.clockS < lastClock || session.clockS === 0) {
    fired = new Set();
    if (state.log.length) set({ log: [] });
  }
  lastClock = session.clockS;
  if (!state.enabled || isHumanLockActive(s)) return;

  const env = session.env;
  const solo = session.missionProfile === "solo" && session.live !== null;
  const ctx: HistoricalContext = {
    clockS: session.clockS,
    dtS,
    seed: 7,
    solo,
    evaElapsedMin: session.resources.evaElapsedMin,
    routePoints: session.activeRoute?.points ?? [session.origin, session.goal],
    maxSlopeDeg: session.activeRoute?.maxSlopeDeg ?? 0,
    ls: env ? env.ls.value : null,
    tau: env ? env.tau.value : null,
    airMinC: env?.airMinC ? env.airMinC.value : null,
    // Solo un SEP que DONKI reportó de verdad fuerza el disparo inmediato
    sepRealActive: env ? env.sep.value && env.sep.source === "REAL" : false,
    sepAlreadyOn: session.sepAlertActive,
    stormActive: session.storms.some((st) => st.active),
  };
  const firings = rollHistoricalIncidents(ctx, fired, state.intensity);
  if (firings.length === 0) return;

  const batch: SimEvent[] = [];
  for (const f of firings) {
    fired.add(f.id);
    const viaLive = solo && f.incident.livePatch !== undefined;
    if (viaLive) dispatchTrek({ type: "updateLive", patch: f.incident.livePatch!(ctx) });
    // En misión individual, las fallas de traje van por updateLive (no duplicar con health-incident)
    for (const e of f.incident.events(ctx))
      if (!(viaLive && e.kind === "health-incident")) batch.push(e);
  }
  if (batch.length) dispatchTrek({ type: "simEvent", event: batch });
  set({ log: [...state.log, ...firings] });
}
