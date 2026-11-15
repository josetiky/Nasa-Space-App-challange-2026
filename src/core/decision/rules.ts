import type { ActionOption, MissionEvent, RuleHit, SimState } from "../types";
import { POWER, RADIATION } from "../science/constants";
import { MARS } from "../science/constants";
import { optionFeasibility } from "../sim/engine";
import { combineMods, demandKw, reserveSols } from "../sim/resources";

/**
 * Deterministic rule base. Rules never compute a score by themselves; they
 * veto infeasible/unsafe actions or add small, explicit adjustments that are
 * shown to the user next to the quantitative criteria.
 */
export interface Rule {
  id: string;
  title: string;
  evaluate: (state: SimState, event: MissionEvent, option: ActionOption) => RuleHit | null;
}

const hasTag = (option: ActionOption, tag: ActionOption["tags"][number]) => option.tags.includes(tag);
const addsDemand = (option: ActionOption) => (option.ongoing?.mods.demandKw ?? 0) > 0;
const usesSpares = (option: ActionOption) => (option.immediate.resources?.spareParts ?? 0) < 0;
const usesOxygen = (option: ActionOption) => (option.immediate.resources?.oxygenKg ?? 0) < 0;

function baseDemandPerSol(state: SimState): number {
  const mods = combineMods(state.effects);
  const d = demandKw(state, mods, (state.env.tempMinC + state.env.tempMaxC) / 2);
  return (d.base + d.heating) * MARS.solHours;
}

export const RULES: Rule[] = [
  {
    id: "R-FEASIBLE",
    title: "Requirements must be met",
    evaluate: (state, _event, option) => {
      const f = optionFeasibility(state, option);
      return f.feasible ? null : { ruleId: "R-FEASIBLE", effect: "veto", weight: 0, message: f.reasons.join(" ") };
    },
  },
  {
    id: "R-SEP-EVA",
    title: "No EVA during a solar particle event",
    evaluate: (state, event, option) => {
      const sep = event.type === "sep" || state.effects.some((effect) => effect.source === "sep");
      if (!sep || !hasTag(option, "eva")) return null;
      return { ruleId: "R-SEP-EVA", effect: "veto", weight: 0, message: `Outdoor work during an SEP risks acute exposure; NASA-STD-3001 limits SPE dose to ${RADIATION.sepEventLimitMsv} mSv per event.` };
    },
  },
  {
    id: "R-DUST-EVA",
    title: "Avoid EVA in heavy dust",
    evaluate: (state, event, option) => {
      const projectedTau = state.env.tau + (event.type === "dustStorm" ? (event.eventEffect?.mods.tauAdd ?? 0) : 0);
      if (projectedTau < 3 || !hasTag(option, "eva")) return null;
      return { ruleId: "R-DUST-EVA", effect: "penalty", weight: -0.08, message: `EVA with projected dust optical depth ${projectedTau.toFixed(1)} (≥ 3) raises injury, navigation and suit-contamination risk.` };
    },
  },
  {
    id: "R-POWER-CRITICAL",
    title: "Protect the battery when energy is critical",
    evaluate: (state, _event, option) => {
      const perSol = baseDemandPerSol(state);
      if (state.resources.batteryKWh >= 0.6 * perSol) return null;
      if (hasTag(option, "load-shed")) return { ruleId: "R-POWER-CRITICAL", effect: "bonus", weight: 0.06, message: `Battery holds ${Math.round(state.resources.batteryKWh)} kWh, less than 0.6 sol of base demand — shedding load protects life support.` };
      if (addsDemand(option)) return { ruleId: "R-POWER-CRITICAL", effect: "penalty", weight: -0.06, message: "Adds electrical demand while the battery is below 0.6 sol of base demand." };
      return null;
    },
  },
  {
    id: "R-O2-LOW",
    title: "Prioritise oxygen when reserves are low",
    evaluate: (state, event, option) => {
      const sols = reserveSols(state).oxygen;
      if (sols >= 10) return null;
      const helpsO2 = ["oxygenLeak", "habitatDamage"].includes(event.type) && (hasTag(option, "repair") || option.endsEventEffect) || (option.immediate.resources?.oxygenKg ?? 0) > 0 || (option.ongoing?.mods.isruFactor ?? 1) > 1;
      if (helpsO2) return { ruleId: "R-O2-LOW", effect: "bonus", weight: 0.06, message: `O₂ stock covers only ${sols.toFixed(1)} sols of crew demand — this action restores or protects oxygen.` };
      if (usesOxygen(option)) return { ruleId: "R-O2-LOW", effect: "penalty", weight: -0.04, message: `Spends O₂ while the stock covers only ${sols.toFixed(1)} sols.` };
      return null;
    },
  },
  {
    id: "R-HEALTH-LOW",
    title: "Protect a weakened crew",
    evaluate: (state, _event, option) => {
      if (state.crew.health >= 55) return null;
      if (hasTag(option, "eva")) return { ruleId: "R-HEALTH-LOW", effect: "penalty", weight: -0.06, message: `Crew health is ${Math.round(state.crew.health)} % — strenuous EVA is discouraged.` };
      if (hasTag(option, "medical") || hasTag(option, "shelter")) return { ruleId: "R-HEALTH-LOW", effect: "bonus", weight: 0.04, message: `Crew health is ${Math.round(state.crew.health)} % — recovery-oriented action preferred.` };
      return null;
    },
  },
  {
    id: "R-SPARES-LOW",
    title: "Keep a contingency reserve of spare kits",
    evaluate: (state, _event, option) => {
      if (state.resources.spareParts > 2 || !usesSpares(option)) return null;
      return { ruleId: "R-SPARES-LOW", effect: "penalty", weight: -0.03, message: `Only ${state.resources.spareParts} spare kits left; using them leaves no contingency.` };
    },
  },
  {
    id: "R-SHELTER-CAPACITY",
    title: "Restore shelter capacity",
    evaluate: (state, _event, option) => {
      if (state.systems.habitat >= 40) return null;
      if (hasTag(option, "repair") || hasTag(option, "relocate")) return { ruleId: "R-SHELTER-CAPACITY", effect: "bonus", weight: 0.05, message: `Habitat integrity is ${Math.round(state.systems.habitat)} % — shelter capacity is compromised.` };
      return null;
    },
  },
  {
    id: "R-ISRU-WEAR",
    title: "Do not overdrive a worn ISRU plant",
    evaluate: (state, _event, option) => {
      const boosts = (option.ongoing?.mods.isruFactor ?? 1) > 1 || (option.ongoing?.mods.isruWaterFactor ?? 1) > 1;
      if (!boosts || state.systems.isru >= 40) return null;
      return { ruleId: "R-ISRU-WEAR", effect: "penalty", weight: -0.05, message: `ISRU plant health is ${Math.round(state.systems.isru)} % — boosting accelerates its failure.` };
    },
  },
  {
    id: "R-PROTOCOL",
    title: "Survival protocols",
    evaluate: (_state, event, option) => {
      if (event.type === "sep" && option.id === "storm-shelter") return { ruleId: "R-PROTOCOL", effect: "bonus", weight: 0.04, message: "Protocol P-01: shelter when solar particle flux rises." };
      if (event.type === "dustStorm" && (option.id === "shelter" || option.id === "reduce")) return { ruleId: "R-PROTOCOL", effect: "bonus", weight: 0.03, message: "Protocol P-05: seal intakes and shelter on storm approach." };
      if (event.type === "oxygenLeak" && option.id === "seal") return { ruleId: "R-PROTOCOL", effect: "bonus", weight: 0.03, message: "Protocol P-03: restore the O₂ loop before the reserve drops." };
      return null;
    },
  },
  {
    id: "R-HEATING",
    title: "Keep the habitat warm",
    evaluate: (state, _event, option) => {
      if (state.habitatTempC >= 12) return null;
      if (hasTag(option, "load-shed") && (option.ongoing?.mods.demandKw ?? 0) < 0) return { ruleId: "R-HEATING", effect: "note", weight: 0, message: `Habitat at ${state.habitatTempC.toFixed(0)} °C (set-point ${POWER.habitatSetpointC} °C): freed power goes to heating first.` };
      return null;
    },
  },
];

export function evaluateRules(state: SimState, event: MissionEvent, option: ActionOption): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const rule of RULES) {
    const hit = rule.evaluate(state, event, option);
    if (hit) hits.push(hit);
  }
  return hits;
}
