import { describe, expect, it } from "vitest";
import { createInitialState, simulateForward } from "@/core/sim/engine";
import { makePlan } from "@/core/sim/fixtures";
import { buildReport } from "@/core/sim/outcome";
import { historyToCsv, reportToMarkdown } from "./reportExport";

const report = buildReport(simulateForward(createInitialState(makePlan({ durationSols: 20, scenario: "training" })), 21, undefined, true));

describe("report exports", () => {
  it("writes one CSV row per recorded sol with a header", () => {
    const lines = historyToCsv(report.history).trim().split("\n");
    expect(lines[0]).toBe("sol,oxygen_kg,water_kg,food_crew_days,battery_kwh,energy_balance_kwh,health_pct,morale_pct,dose_msv,habitat_temp_c,tau,science,weakest_system_pct,habitat_integrity_pct");
    expect(lines).toHaveLength(report.history.length + 1);
    expect(lines[1]!.split(",")).toHaveLength(14);
  });

  it("summarises outcome, decisions and provenance in Markdown", () => {
    const md = reportToMarkdown(report);
    expect(md).toContain(`# Mission report — ${report.missionName}`);
    expect(md).toMatch(/Outcome: \*\*(SUCCESS|COMPROMISED|FAILED)\*\*/);
    expect(md).toContain("| Sol | Event | Decision | Engine |");
    expect(md).toMatch(/simulat/i);
    expect(md).toContain(`seed ${report.seed}`);
  });
});
