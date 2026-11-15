import type { MissionEvent, MissionPlan, SimState, SiteEnvironment } from "../types";
import { describeEnvironment } from "../science/environment";
import { EVENT_DEFINITIONS } from "./events";
import { createInitialState } from "./engine";

/** Reference environment used by tests and the Decision Intelligence sandbox (Jezero crater). */
export function referenceEnvironment(overrides: Partial<SiteEnvironment> = {}): SiteEnvironment {
  const base = describeEnvironment({ lat: 18.44, lon: 77.45 }, null);
  return { ...base, elevationM: -2600, slopeDeg: 0.6, reliefM: 400, elevationSource: "unavailable", ...overrides };
}

export function makePlan(overrides: Partial<MissionPlan> = {}): MissionPlan {
  const environment = overrides.environment ?? referenceEnvironment();
  return {
    id: "plan-test",
    name: "ARES Test Mission",
    objective: "Sample the Jezero delta front",
    site: { id: "jezero", name: "Jezero crater", point: environment.point, kind: "catalogue" },
    environment,
    durationSols: 60,
    crewSize: 4,
    habitat: "regolith",
    power: { source: "hybrid", solarAreaM2: 250, fissionUnits: 1, batteryKWh: 300 },
    supplies: { oxygenKg: 120, waterKg: 600, foodCrewDays: 280, spareParts: 8 },
    isru: { oxygenKgPerSol: 2, waterKgPerSol: 8 },
    eva: null,
    evaEverySols: 7,
    riskPosture: "balanced",
    scenario: "nominal",
    eventMultipliers: {},
    seed: 42,
    startMsd: 54000,
    createdAt: "2026-11-09T00:00:00.000Z",
    ...overrides,
  };
}

/** Build a state with a specific pending event (e.g. the dust-storm example). */
export function stateWithEvent(state: SimState, type: MissionEvent["type"], severity: 1 | 2 | 3 = 2): SimState {
  const def = EVENT_DEFINITIONS[type];
  const built = def.build(state, severity);
  const event: MissionEvent = { ...built, id: `ev-${state.sol}-${type}`, sol: state.sol, type, severity };
  const effects = event.eventEffect ? [...state.effects, { id: event.id, source: type, label: event.eventEffect.label, remainingSols: event.eventEffect.sols, mods: event.eventEffect.mods }] : state.effects;
  return { ...state, effects, pending: event, status: "awaiting-decision", incidents: [...state.incidents, { sol: state.sol, type, title: event.title, severity }] };
}

/** The dust-storm scenario described in the project brief (alternatives A–D). */
export function dustStormScenario(planOverrides: Partial<MissionPlan> = {}, severity: 1 | 2 | 3 = 2): SimState {
  const plan = makePlan({ scenario: "training", ...planOverrides });
  const state = createInitialState(plan);
  return stateWithEvent({ ...state, sol: 12 }, "dustStorm", severity);
}
