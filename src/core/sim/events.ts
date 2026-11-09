import type { ActionOption, EffectMods, EventType, ImmediateEffect, MissionEvent, SimState } from "../types";
import type { Rng } from "../rng";
import { isDustySeason } from "../science/marsTime";
import { EVENT_BASE_PROBABILITY, SEP_DOSE_FACTOR } from "./config";

type Severity = 1 | 2 | 3;

export interface EventDefinition {
  type: EventType;
  label: string;
  /** Probability per sol before scenario multipliers. */
  probability: (state: SimState, evaToday: boolean) => number;
  severity: (rng: Rng, state: SimState) => Severity;
  build: (state: SimState, severity: Severity) => Omit<MissionEvent, "id" | "sol" | "type" | "severity">;
}

const pick = <T,>(severity: Severity, values: [T, T, T]): T => values[severity - 1] as T;
const healthFactor = (value: number, scale: number) => 1 + Math.max(0, 100 - value) / scale;

function sev(rng: Rng, p2: number, p3: number): Severity {
  const r = rng();
  if (r < p3) return 3;
  if (r < p3 + p2) return 2;
  return 1;
}

const option = (o: ActionOption) => o;
const mods = (m: EffectMods) => m;
const immediate = (e: ImmediateEffect) => e;

export const EVENT_DEFINITIONS: Record<EventType, EventDefinition> = {
  dustStorm: {
    type: "dustStorm",
    label: "Dust storm",
    probability: (state) => EVENT_BASE_PROBABILITY.dustStorm * (isDustySeason(state.env.ls) ? 1.8 : 0.4) * (0.5 + state.ctx.environment.dustActivity),
    severity: (rng, state) => sev(rng, 0.3, isDustySeason(state.env.ls) ? 0.12 : 0.03),
    build: (state, s) => {
      const sols = pick(s, [14, 25, 50]);
      return {
        title: pick(s, ["Regional dust storm", "Large regional dust storm", "Planet-encircling dust storm"]),
        description: `Orbital weather imagery shows a ${pick(s, ["regional", "large regional", "planet-encircling"])} storm reaching the site. Optical depth is expected to climb by about ${pick(s, [1.5, 3, 6])} for roughly ${sols} sols, cutting solar generation and abrading exposed hardware.`,
        eventEffect: { label: "Dust storm", sols, mods: mods({ tauAdd: pick(s, [1.5, 3, 6]), moralePerSol: -0.2, systemWearPerSol: { power: 0.15 * s, habitat: 0.05 * s } }) },
        defaultOptionId: "reduce",
        options: [
          option({
            id: "shelter",
            label: "Remain in the habitat",
            summary: "Suspend EVAs and outdoor work until the storm clears.",
            tags: ["shelter"],
            immediate: {},
            ongoing: { label: "Shelter in place", sols, mods: { demandKw: -1, sciencePerSol: -0.25, evaBlocked: true, moralePerSol: -0.2 } },
          }),
          option({
            id: "relocate",
            label: "Move to a protected zone",
            summary: "Drive the crew and portable equipment to a sheltered position in the lee of terrain.",
            tags: ["relocate", "eva"],
            requires: { systems: { rover: 40 } },
            immediate: immediate({ systems: { rover: -12 }, resources: { batteryKWh: -60 }, crew: { morale: -4 }, evaHours: 4 }),
            risk: { probability: 0.1 * s, label: "Rover stalled in low visibility", effect: { systems: { rover: -20 }, crew: { health: -6 } } },
            ongoing: { label: "Sheltered position", sols, mods: { heatLossFactor: 0.85, sciencePerSol: -0.35, systemWearPerSol: { power: -0.1 * s, habitat: -0.05 * s } } },
          }),
          option({
            id: "repair",
            label: "Attempt to repair the solar panels",
            summary: "EVA to clean, re-tension and re-orient the arrays during the storm.",
            tags: ["eva", "repair"],
            requires: { evaAllowed: true },
            immediate: immediate({ panelCleanliness: 0.25, resources: { oxygenKg: -2.4 }, evaHours: 3, systems: { power: 8 } }),
            risk: { probability: pick(s, [0.06, 0.12, 0.22]), label: "Crew member injured during the storm EVA", effect: { crew: { health: -12, morale: -6 } } },
            ongoing: { label: "Arrays re-tensioned", sols: Math.round(sols / 2), mods: { powerGenFactor: 1.12 } },
          }),
          option({
            id: "reduce",
            label: "Reduce energy consumption",
            summary: "Pause ISRU, dim non-critical loads and hold science operations.",
            tags: ["load-shed"],
            immediate: {},
            ongoing: { label: "Load shedding", sols, mods: { demandKw: -3.5, isruFactor: 0.35, sciencePerSol: -0.3, moralePerSol: -0.3 } },
          }),
        ],
      };
    },
  },

  powerFailure: {
    type: "powerFailure",
    label: "Power system fault",
    probability: (state) => EVENT_BASE_PROBABILITY.powerFailure * healthFactor(state.systems.power, 40) * (state.env.tau > 2 ? 1.5 : 1),
    severity: (rng) => sev(rng, 0.35, 0.12),
    build: (_state, s) => {
      const sols = pick(s, [10, 18, 30]);
      return {
        title: pick(s, ["Power converter fault", "Array string failure", "Main bus failure"]),
        description: `A ${pick(s, ["converter", "solar-array string", "main power bus"])} fault reduces generation to about ${Math.round(pick(s, [0.8, 0.6, 0.4]) * 100)} % of nominal.`,
        immediate: { systems: { power: -pick(s, [12, 22, 35]) } },
        eventEffect: { label: "Power fault", sols, mods: { powerGenFactor: pick(s, [0.8, 0.6, 0.4]) } },
        defaultOptionId: "battery-shed",
        options: [
          option({
            id: "repair-spares",
            label: "Replace the faulty unit",
            summary: "Swap in a spare converter (2 spare kits).",
            tags: ["repair"],
            requires: { spareParts: 2 },
            immediate: { resources: { spareParts: -2 }, systems: { power: 20 } },
            endsEventEffect: true,
            risk: { probability: 0.1, label: "Replacement unit faulty on installation", effect: { systems: { power: -8 } } },
          }),
          option({
            id: "battery-shed",
            label: "Ride it out on batteries",
            summary: "Shed loads and pause ISRU until the fault is isolated.",
            tags: ["load-shed"],
            immediate: {},
            ongoing: { label: "Load shedding", sols, mods: { demandKw: -3, isruFactor: 0.4, sciencePerSol: -0.25 } },
          }),
          option({
            id: "eva-inspect",
            label: "EVA to bypass the damaged string",
            summary: "Inspect the field and bypass the failed section.",
            tags: ["eva", "repair"],
            requires: { evaAllowed: true },
            immediate: { resources: { oxygenKg: -1.6 }, evaHours: 2.5, systems: { power: 12 } },
            shortensEventEffect: 0.5,
            risk: { probability: 0.08, label: "Electrical burn during the bypass", effect: { crew: { health: -8 } } },
          }),
          option({ id: "defer", label: "Defer the repair", summary: "Accept reduced generation for now.", tags: ["defer"], immediate: {} }),
        ],
      };
    },
  },

  commsLoss: {
    type: "commsLoss",
    label: "Communications loss",
    probability: (state) => EVENT_BASE_PROBABILITY.commsLoss * healthFactor(state.systems.comms, 50),
    severity: (rng) => sev(rng, 0.3, 0.1),
    build: (_state, s) => {
      const sols = pick(s, [4, 9, 18]);
      return {
        title: pick(s, ["Relay pass missed", "Relay link lost", "Extended communications blackout"]),
        description: `The orbital relay link is down for an expected ${sols} sols. Ground support, telemedicine and science downlink are unavailable.`,
        eventEffect: { label: "Comms down", sols, mods: { commsDown: true, moralePerSol: -0.6, sciencePerSol: -0.15 } },
        defaultOptionId: "wait",
        options: [
          option({ id: "wait", label: "Wait for the next relay window", summary: "Keep operating autonomously.", tags: ["defer"], immediate: {} }),
          option({
            id: "reconfigure",
            label: "Realign the high-gain antenna",
            summary: "EVA to inspect and realign the antenna.",
            tags: ["eva", "comms"],
            requires: { evaAllowed: true, systems: { comms: 20 } },
            immediate: { resources: { oxygenKg: -1.2 }, evaHours: 2, systems: { comms: 15 } },
            shortensEventEffect: 0.75,
            risk: { probability: 0.06, label: "Antenna actuator jammed", effect: { systems: { comms: -10 } } },
          }),
          option({
            id: "backup",
            label: "Switch to backup UHF",
            summary: "Lower data rate, higher power draw, partial contact.",
            tags: ["comms"],
            immediate: {},
            shortensEventEffect: 0.4,
            ongoing: { label: "Backup UHF", sols, mods: { demandKw: 0.8, moralePerSol: 0.4 } },
          }),
        ],
      };
    },
  },

  habitatDamage: {
    type: "habitatDamage",
    label: "Habitat damage",
    probability: (state) => EVENT_BASE_PROBABILITY.habitatDamage * healthFactor(state.systems.habitat, 40) * (state.env.tau > 2 ? 2 : 1),
    severity: (rng) => sev(rng, 0.35, 0.12),
    build: (_state, s) => {
      const sols = pick(s, [10, 20, 35]);
      const loss = pick(s, [0.8, 2, 4]);
      return {
        title: pick(s, ["Seal degradation", "Hull breach", "Structural breach"]),
        description: `Pressure telemetry shows a breach. The habitat is losing about ${loss} kg of O₂ per sol and heat loss is up ${Math.round((pick(s, [1.2, 1.5, 2]) - 1) * 100)} %.`,
        immediate: { systems: { habitat: -pick(s, [10, 20, 32]) } },
        eventEffect: { label: "Breach", sols, mods: { o2LossKgPerSol: loss, heatLossFactor: pick(s, [1.2, 1.5, 2]), moralePerSol: -0.4 } },
        defaultOptionId: "isolate",
        options: [
          option({
            id: "patch",
            label: "Patch the breach from inside",
            summary: "Fast internal patch (1 spare kit).",
            tags: ["repair"],
            requires: { spareParts: 1 },
            immediate: { resources: { spareParts: -1 }, systems: { habitat: 12 } },
            ...(s < 3 ? { endsEventEffect: true } : { shortensEventEffect: 0.6 }),
            risk: { probability: 0.15 * s, label: "Patch failed under pressure cycling", effect: { resources: { oxygenKg: -6 } } },
          }),
          option({
            id: "isolate",
            label: "Isolate the damaged module",
            summary: "Close hatches; lose volume but stop most of the leak.",
            tags: ["shelter"],
            immediate: {},
            ongoing: { label: "Module isolated", sols, mods: { o2LossKgPerSol: -loss * 0.75, heatLossFactor: 0.8, moralePerSol: -0.5, sciencePerSol: -0.2 } },
          }),
          option({
            id: "eva-repair",
            label: "External repair by EVA",
            summary: "Apply sealant panels from outside (2 spare kits).",
            tags: ["eva", "repair"],
            requires: { evaAllowed: true, spareParts: 2 },
            immediate: { resources: { spareParts: -2, oxygenKg: -2 }, evaHours: 3, systems: { habitat: 25 } },
            endsEventEffect: true,
            risk: { probability: 0.08 * s, label: "Suit puncture during the external repair", effect: { crew: { health: -10 }, resources: { oxygenKg: -3 } } },
          }),
          option({ id: "monitor", label: "Monitor the breach", summary: "Accept the loss and keep watching.", tags: ["defer"], immediate: {} }),
        ],
      };
    },
  },

  oxygenLeak: {
    type: "oxygenLeak",
    label: "Oxygen leak",
    probability: (state) => EVENT_BASE_PROBABILITY.oxygenLeak * healthFactor(state.systems.habitat, 50) * healthFactor(state.systems.lifeSupport, 80),
    severity: (rng) => sev(rng, 0.35, 0.12),
    build: (_state, s) => {
      const sols = pick(s, [12, 20, 30]);
      const loss = pick(s, [1.5, 3.5, 7]);
      return {
        title: pick(s, ["Minor O₂ leak", "O₂ leak in the life-support loop", "Major O₂ leak"]),
        description: `The atmosphere control system reports an O₂ loss of about ${loss} kg per sol from the distribution loop.`,
        eventEffect: { label: "O₂ leak", sols, mods: { o2LossKgPerSol: loss } },
        defaultOptionId: "seal",
        options: [
          option({
            id: "seal",
            label: "Locate and seal the leak",
            summary: "Leak hunt with ultrasonic detector (1 spare kit).",
            tags: ["repair"],
            requires: { spareParts: 1 },
            immediate: { resources: { spareParts: -1 }, systems: { lifeSupport: 5 } },
            endsEventEffect: true,
            risk: { probability: pick(s, [0.1, 0.25, 0.4]), label: "Leak only partially sealed", effect: { resources: { oxygenKg: -pick(s, [3, 6, 10]) } } },
          }),
          option({
            id: "isolate",
            label: "Isolate the compartment",
            summary: "Close off the leaking section of the loop.",
            tags: ["shelter"],
            immediate: {},
            ongoing: { label: "Compartment isolated", sols, mods: { o2LossKgPerSol: -loss * 0.7, moralePerSol: -0.4 } },
          }),
          option({
            id: "boost-isru",
            label: "Boost ISRU oxygen production",
            summary: "Run the CO₂ electrolysis plant at maximum.",
            tags: ["isru"],
            requires: { systems: { isru: 30 } },
            immediate: {},
            ongoing: { label: "ISRU boost", sols, mods: { isruFactor: 1.8, demandKw: 2.5, systemWearPerSol: { isru: 0.25 } } },
          }),
          option({
            id: "candles",
            label: "Burn emergency O₂ candles",
            summary: "Chemical oxygen generators buy time (1 spare kit).",
            tags: ["defer"],
            requires: { spareParts: 1 },
            immediate: { resources: { oxygenKg: pick(s, [8, 12, 16]), spareParts: -1 } },
          }),
        ],
      };
    },
  },

  waterFailure: {
    type: "waterFailure",
    label: "Water system failure",
    probability: (state) => EVENT_BASE_PROBABILITY.waterFailure * healthFactor(state.systems.lifeSupport, 40),
    severity: (rng) => sev(rng, 0.35, 0.12),
    build: (_state, s) => {
      const sols = pick(s, [10, 20, 35]);
      return {
        title: pick(s, ["Water processor degraded", "Water recovery fault", "Water processor failure"]),
        description: `Water recovery drops to about ${Math.round(pick(s, [0.7, 0.45, 0.2]) * 98)} % of the crew's daily use.`,
        immediate: { systems: { lifeSupport: -pick(s, [8, 15, 25]) } },
        eventEffect: { label: "Water recovery fault", sols, mods: { waterRecoveryFactor: pick(s, [0.7, 0.45, 0.2]) } },
        defaultOptionId: "repair",
        options: [
          option({
            id: "repair",
            label: "Repair the water processor",
            summary: "Replace filters and the distillation assembly (2 spare kits).",
            tags: ["repair"],
            requires: { spareParts: 2 },
            immediate: { resources: { spareParts: -2 }, systems: { lifeSupport: 15 } },
            endsEventEffect: true,
            risk: { probability: 0.1, label: "Distillation assembly still unstable", effect: { systems: { lifeSupport: -6 } } },
          }),
          option({
            id: "ration",
            label: "Ration water to 80 %",
            summary: "Cut hygiene water and tighten drinking allowances.",
            tags: ["ration"],
            immediate: {},
            ongoing: { label: "Water rationing", sols, mods: { waterUseFactor: 0.8, healthPerSol: -0.25, moralePerSol: -0.4 } },
          }),
          option({
            id: "ice",
            label: "Increase ice extraction",
            summary: "Double the ground-ice mining rate.",
            tags: ["isru"],
            requires: { systems: { isru: 30 } },
            immediate: {},
            ongoing: { label: "Ice extraction boost", sols, mods: { isruWaterFactor: 2, demandKw: 1.5, systemWearPerSol: { isru: 0.2 } } },
          }),
          option({ id: "defer", label: "Defer the repair", summary: "Live with the reduced recovery.", tags: ["defer"], immediate: {} }),
        ],
      };
    },
  },

  vehicleFailure: {
    type: "vehicleFailure",
    label: "Vehicle failure",
    probability: (state, evaToday) => EVENT_BASE_PROBABILITY.vehicleFailure * healthFactor(state.systems.rover, 40) * (evaToday ? 2.5 : 1),
    severity: (rng) => sev(rng, 0.3, 0.1),
    build: (_state, s) => {
      const sols = pick(s, [8, 16, 30]);
      return {
        title: pick(s, ["Rover wheel actuator fault", "Rover drivetrain failure", "Rover chassis damage"]),
        description: `The pressurized rover is out of service for an expected ${sols} sols. Long traverses are suspended.`,
        immediate: { systems: { rover: -pick(s, [15, 28, 45]) } },
        eventEffect: { label: "Rover out of service", sols, mods: { sciencePerSol: -0.25 } },
        defaultOptionId: "repair",
        options: [
          option({
            id: "repair",
            label: "Repair the rover",
            summary: "Replace the failed assembly (2 spare kits).",
            tags: ["repair"],
            requires: { spareParts: 2 },
            immediate: { resources: { spareParts: -2 }, systems: { rover: 30 } },
            endsEventEffect: true,
            risk: { probability: 0.08, label: "Repair took longer than planned", effect: { crew: { morale: -4 } } },
          }),
          option({
            id: "cannibalize",
            label: "Cannibalize ISRU spares",
            summary: "Borrow parts from the ISRU plant.",
            tags: ["repair"],
            requires: { systems: { isru: 25 } },
            immediate: { systems: { rover: 22, isru: -12 } },
            endsEventEffect: true,
          }),
          option({
            id: "on-foot",
            label: "Continue science on foot",
            summary: "Short walking traverses near the habitat.",
            tags: ["eva"],
            immediate: {},
            ongoing: { label: "Walking traverses", sols, mods: { sciencePerSol: 0.12, healthPerSol: -0.1 } },
          }),
        ],
      };
    },
  },

  medical: {
    type: "medical",
    label: "Medical emergency",
    probability: (state, evaToday) => EVENT_BASE_PROBABILITY.medical * (state.crew.health < 70 ? 2 : 1) * (evaToday ? 2 : 1),
    severity: (rng) => sev(rng, 0.3, 0.1),
    build: (_state, s) => {
      const sols = pick(s, [5, 10, 18]);
      return {
        title: pick(s, ["Crew injury", "Serious crew injury", "Medical emergency"]),
        description: `A crew member needs care and will be off duty for about ${sols} sols.`,
        immediate: { crew: { health: -pick(s, [8, 15, 25]) } },
        eventEffect: { label: "Crew member off duty", sols, mods: { sciencePerSol: -0.2, moralePerSol: -0.3, healthPerSol: -0.2 } },
        defaultOptionId: "treat",
        options: [
          option({
            id: "treat",
            label: "Treat in the medical bay",
            summary: "Use the habitat medical kit (1 spare kit).",
            tags: ["medical"],
            requires: { spareParts: 1 },
            immediate: { resources: { spareParts: -1 }, crew: { health: 8 } },
            shortensEventEffect: 0.5,
          }),
          option({
            id: "telemed",
            label: "Telemedicine with Earth",
            summary: "Flight surgeon guidance over the relay (needs comms).",
            tags: ["medical", "comms"],
            requires: { commsUp: true },
            immediate: { crew: { health: 5, morale: 3 } },
            shortensEventEffect: 0.6,
          }),
          option({
            id: "rest",
            label: "Reduce the crew workload",
            summary: "Lighter schedule for everyone until recovery.",
            tags: ["medical"],
            immediate: {},
            ongoing: { label: "Reduced workload", sols, mods: { healthPerSol: 0.6, sciencePerSol: -0.3, demandKw: -0.5 } },
          }),
          option({
            id: "continue",
            label: "Continue operations",
            summary: "Keep the schedule and accept the risk.",
            tags: ["defer"],
            immediate: {},
            risk: { probability: 0.2 * s, label: "Condition worsened", effect: { crew: { health: -10 } } },
          }),
        ],
      };
    },
  },

  sep: {
    type: "sep",
    label: "Solar particle event",
    probability: () => EVENT_BASE_PROBABILITY.sep,
    severity: (rng) => (rng() < 6 / 16 ? 3 : 2),
    build: (_state, s) => ({
      title: pick(s, ["Minor solar particle event", "Moderate solar particle event", "Severe solar particle event"]),
      description: `A ${pick(s, ["minor", "moderate", "severe"])} solar particle event is sweeping the site. Unsheltered dose rates climb about ${SEP_DOSE_FACTOR[s]}× for 2 sols.`,
      eventEffect: { label: "Solar particle event", sols: 2, mods: { doseFactor: SEP_DOSE_FACTOR[s] } },
      defaultOptionId: "storm-shelter",
      options: [
        option({
          id: "storm-shelter",
          label: "Move into the storm shelter",
          summary: "Crew stays in the shielded core for 2 sols.",
          tags: ["shelter"],
          immediate: {},
          ongoing: { label: "Storm shelter", sols: 2, mods: { doseFactor: 0.25, evaBlocked: true, sciencePerSol: -0.4, moralePerSol: -0.3 } },
        }),
        option({
          id: "partial",
          label: "Stay indoors behind water walls",
          summary: "Normal indoor work, rearranged water stores as shielding.",
          tags: ["shelter"],
          immediate: {},
          ongoing: { label: "Water-wall shielding", sols: 2, mods: { doseFactor: 0.6, sciencePerSol: -0.1 } },
        }),
        option({
          id: "continue",
          label: "Continue planned operations",
          summary: "Including outdoor work and EVAs.",
          tags: ["eva"],
          immediate: {},
          ongoing: { label: "Operations during SEP", sols: 2, mods: { doseFactor: 1.6, sciencePerSol: 0.3 } },
        }),
      ],
    }),
  },

  discovery: {
    type: "discovery",
    label: "Scientific discovery",
    probability: (state, evaToday) => EVENT_BASE_PROBABILITY.discovery * (0.5 + state.ctx.environment.scienceValue + (evaToday ? 1 : 0)) * (state.systems.rover / 100),
    severity: (rng) => sev(rng, 0.3, 0.1),
    build: (_state, s) => ({
      title: pick(s, ["Interesting outcrop", "Promising mineral signature", "Potential biosignature context"]),
      description: `Instruments flag a ${pick(s, ["layered outcrop", "hydrated-mineral signature", "fine-grained, organic-friendly mudstone"])} near the planned traverse.`,
      defaultOptionId: "rover-survey",
      options: [
        option({
          id: "sample-eva",
          label: "Dedicated sampling EVA",
          summary: "Two astronauts collect and document samples.",
          tags: ["eva", "science"],
          requires: { evaAllowed: true },
          immediate: { science: pick(s, [6, 10, 16]), resources: { oxygenKg: -1.8 }, evaHours: 3, crew: { morale: 6 } },
          risk: { probability: 0.06, label: "Minor injury on uneven terrain", effect: { crew: { health: -6 } } },
        }),
        option({
          id: "rover-survey",
          label: "Remote survey with the rover",
          summary: "Contact science without leaving the habitat.",
          tags: ["science"],
          requires: { systems: { rover: 30 } },
          immediate: { science: pick(s, [3, 5, 8]), systems: { rover: -5 }, crew: { morale: 3 } },
        }),
        option({ id: "log", label: "Log it for a later traverse", summary: "No resources spent now.", tags: ["defer"], immediate: { science: 1, crew: { morale: 1 } } }),
      ],
    }),
  },
};

export function eventLabel(type: EventType): string {
  return EVENT_DEFINITIONS[type].label;
}
