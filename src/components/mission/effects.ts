import type { ActionOption, ImmediateEffect, SimState, SystemId } from "@/core/types";
import { RADIATION } from "@/core/science/constants";
import { reserveSols } from "@/core/sim/resources";

export const SYSTEM_LABEL: Record<SystemId, string> = { lifeSupport: "Life support", power: "Power", habitat: "Habitat", comms: "Comms", rover: "Rover", isru: "ISRU" };

const sign = (v: number, digits = 0) => `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;

/** Human-readable chips for an option's immediate effect (values come from the event model). */
export function effectChips(effect: ImmediateEffect | undefined): Array<{ text: string; good: boolean }> {
  if (!effect) return [];
  const chips: Array<{ text: string; good: boolean }> = [];
  const r = effect.resources ?? {};
  if (r.oxygenKg) chips.push({ text: `O₂ ${sign(r.oxygenKg, 1)} kg`, good: r.oxygenKg > 0 });
  if (r.waterKg) chips.push({ text: `Water ${sign(r.waterKg, 0)} kg`, good: r.waterKg > 0 });
  if (r.foodCrewDays) chips.push({ text: `Food ${sign(r.foodCrewDays, 0)} crew-days`, good: r.foodCrewDays > 0 });
  if (r.batteryKWh) chips.push({ text: `Battery ${sign(r.batteryKWh, 0)} kWh`, good: r.batteryKWh > 0 });
  if (r.spareParts) chips.push({ text: `Spares ${sign(r.spareParts, 0)}`, good: r.spareParts > 0 });
  for (const [id, v] of Object.entries(effect.systems ?? {})) if (v) chips.push({ text: `${SYSTEM_LABEL[id as SystemId]} ${sign(v)}`, good: v > 0 });
  if (effect.crew?.health) chips.push({ text: `Health ${sign(effect.crew.health)}`, good: effect.crew.health > 0 });
  if (effect.crew?.morale) chips.push({ text: `Morale ${sign(effect.crew.morale)}`, good: effect.crew.morale > 0 });
  if (effect.crew?.doseMsv) chips.push({ text: `Dose ${sign(effect.crew.doseMsv, 1)} mSv`, good: effect.crew.doseMsv < 0 });
  if (effect.science) chips.push({ text: `Science ${sign(effect.science, 1)}`, good: effect.science > 0 });
  if (effect.evaHours) chips.push({ text: `EVA ${effect.evaHours} h`, good: true });
  if (effect.panelCleanliness) chips.push({ text: `Panels ${sign(effect.panelCleanliness * 100)} %`, good: effect.panelCleanliness > 0 });
  return chips;
}

export function optionSummary(option: ActionOption): string[] {
  const out: string[] = [];
  if (option.ongoing) out.push(`${option.ongoing.label} for ${option.ongoing.sols} sols`);
  if (option.endsEventEffect) out.push("Ends the event's ongoing effect");
  if (option.shortensEventEffect) out.push(`Shortens the event by ${option.shortensEventEffect} sols`);
  if (option.risk) out.push(`${Math.round(option.risk.probability * 100)} % risk: ${option.risk.label}`);
  return out;
}

export interface ProtocolAlert {
  id: string;
  level: "caution" | "danger";
  title: string;
  action: string;
}

/** Deterministic protocol triggers from the current simulated state (shown in the live monitor). */
export function activeProtocols(sim: SimState): ProtocolAlert[] {
  const alerts: ProtocolAlert[] = [];
  const reserves = reserveSols(sim);
  const push = (id: string, level: ProtocolAlert["level"], title: string, action: string) => alerts.push({ id, level, title, action });
  if (reserves.oxygen < 10) push("o2", reserves.oxygen < 5 ? "danger" : "caution", `O₂ reserve ${reserves.oxygen.toFixed(1)} sols`, "O₂ conservation: suspend EVAs, prioritise ECLSS and ISRU power, check for leaks.");
  if (reserves.water < 10) push("water", reserves.water < 5 ? "danger" : "caution", `Water reserve ${reserves.water.toFixed(1)} sols`, "Water rationing: hygiene water to minimum, repair recovery loop, raise ISRU extraction.");
  if (reserves.food < 15) push("food", reserves.food < 7 ? "danger" : "caution", `Food ${reserves.food.toFixed(0)} sols`, "Food rationing plan; request resupply window.");
  if (sim.resources.batteryKWh < sim.ctx.capacities.batteryKWh * 0.15) push("power", "caution", "Battery below 15 %", "Load shedding: ISRU first, then heating; clean panels when τ allows.");
  if (sim.habitatTempC < 10) push("thermal", sim.habitatTempC < 0 ? "danger" : "caution", `Habitat at ${sim.habitatTempC.toFixed(0)} °C`, "Thermal protocol: consolidate crew in the core module, restore heating power.");
  if (sim.env.tau >= 3) push("dust", "caution", `Dust storm τ ${sim.env.tau.toFixed(1)}`, "Dust storm protocol: EVAs suspended, secure equipment, plan panel cleaning.");
  if (sim.env.sepActive) push("sep", "danger", "Solar particle event", "Shelter in the most shielded volume until the SEP alert clears.");
  if (!sim.env.commsUp) push("comms", "caution", "Earth link down", "Autonomous operations: follow the last approved plan and log decisions.");
  if (sim.crew.doseMsv > RADIATION.careerLimitMsv * 0.7) push("dose", "danger", `Dose ${sim.crew.doseMsv.toFixed(0)} mSv`, `Approaching NASA's ${RADIATION.careerLimitMsv} mSv career limit: minimise EVA exposure.`);
  if (sim.crew.health < 60) push("medical", sim.crew.health < 45 ? "danger" : "caution", `Crew health ${Math.round(sim.crew.health)} %`, "Medical watch: rest rotation, reduce workload.");
  if (sim.crew.morale < 40) push("morale", "caution", `Morale ${Math.round(sim.crew.morale)} %`, "Rest day and contact with family when comms allow.");
  for (const [id, v] of Object.entries(sim.systems)) if (v < 40) push(`sys-${id}`, v < 20 ? "danger" : "caution", `${SYSTEM_LABEL[id as SystemId]} at ${Math.round(v)} %`, "Schedule repair with available spare parts.");
  return alerts;
}
