/** Mission report exports (pure string builders; the page turns them into downloads). */
import type { MissionReport, SolSnapshot } from "@/core/types";

const COLUMNS: Array<[string, keyof SolSnapshot, number]> = [
  ["sol", "sol", 0],
  ["oxygen_kg", "oxygenKg", 2],
  ["water_kg", "waterKg", 2],
  ["food_crew_days", "foodCrewDays", 1],
  ["battery_kwh", "batteryKWh", 1],
  ["energy_balance_kwh", "energyBalanceKWh", 1],
  ["health_pct", "health", 1],
  ["morale_pct", "morale", 1],
  ["dose_msv", "doseMsv", 2],
  ["habitat_temp_c", "habitatTempC", 1],
  ["tau", "tau", 2],
  ["science", "science", 2],
  ["weakest_system_pct", "systemsMin", 1],
  ["habitat_integrity_pct", "integrity", 1],
];

export function historyToCsv(history: SolSnapshot[]): string {
  const header = COLUMNS.map(([name]) => name).join(",");
  const rows = history.map((s) => COLUMNS.map(([, key, digits]) => (Number.isFinite(s[key]) ? (s[key] as number).toFixed(digits) : "")).join(","));
  return [header, ...rows].join("\n") + "\n";
}

const n = (v: number, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export function reportToMarkdown(r: MissionReport): string {
  const lines = [
    `# Mission report — ${r.missionName}`,
    "",
    `Site: ${r.siteName} · crew ${r.crewSize} · ${r.solsCompleted}/${r.durationSols} sols · seed ${r.seed}`,
    `Outcome: **${r.outcome.toUpperCase()}**${r.failureCause ? ` — ${r.failureCause}` : ""}`,
    `Generated ${r.generatedAt} by MARS // SURVIVE. All values are simulation outputs (seeded, reproducible) built on NASA-sourced site data; they are not mission-certified figures.`,
    "",
    "## Final state",
    "",
    `- Crew health ${n(r.finalHealth)} %, morale ${n(r.finalMorale)} %, cumulative dose ${n(r.doseMsv, 1)} mSv`,
    `- Science ${n(r.science, 1)} of ${r.scienceTarget} target`,
    `- Remaining: O₂ ${n(r.finalResources.oxygenKg, 1)} kg, water ${n(r.finalResources.waterKg, 1)} kg, food ${n(r.finalResources.foodCrewDays)} crew-days, battery ${n(r.finalResources.batteryKWh)} kWh, spares ${r.finalResources.spareParts}`,
    "",
    "## Consumption",
    "",
    `- O₂ consumed ${n(r.consumption.oxygenKg, 1)} kg (ISRU produced ${n(r.consumption.producedOxygenKg, 1)} kg)`,
    `- Water used ${n(r.consumption.waterKg, 1)} kg (ISRU produced ${n(r.consumption.producedWaterKg, 1)} kg)`,
    `- Food ${n(r.consumption.foodCrewDays)} crew-days · energy ${n(r.consumption.energyKWh)} kWh · spare parts used ${r.consumption.sparePartsUsed}`,
    "",
    "## Key factors",
    "",
    ...(r.keyFactors.length ? r.keyFactors.map((k) => `- ${k}`) : ["- —"]),
    "",
    "## Decisions",
    "",
    "| Sol | Event | Decision | Engine |",
    "| --- | --- | --- | --- |",
    ...(r.decisions.length
      ? r.decisions.map((d) => `| ${d.sol} | ${d.eventTitle} | ${d.optionLabel}${d.complication ? ` (complication: ${d.complication})` : ""} | ${d.followedRecommendation === null ? "not consulted" : d.followedRecommendation ? "followed" : "overridden"} |`)
      : ["| — | — | — | — |"]),
    "",
    "## Incidents",
    "",
    ...(r.incidents.length ? r.incidents.map((i) => `- Sol ${i.sol}: ${i.title} (severity ${i.severity})`) : ["- None"]),
    "",
  ];
  return lines.join("\n");
}
