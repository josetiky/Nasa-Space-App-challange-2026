import { describe, expect, it } from "vitest";
import { analyzeLocation } from "@/core/science/habitability";
import { analyzeDecision } from "@/core/decision/engine";
import { makePlan, referenceEnvironment } from "@/core/sim/fixtures";
import type { LocationAnalysis } from "@/core/types";
import { deserializeMission, initialMissionState, missionReducer, serializeMission, type MissionStoreState } from "./missionStore";

const NOW = new Date("2026-11-09T00:00:00Z");

function analysisFor(id: string, lat = 18.44, lon = 77.45): LocationAnalysis {
  const env = referenceEnvironment({ point: { lat, lon } });
  return analyzeLocation({ id, name: id, point: { lat, lon }, kind: "catalogue" }, env, NOW);
}

function withPlan(overrides = {}): MissionStoreState {
  return missionReducer(initialMissionState, { type: "savePlan", plan: makePlan(overrides) });
}

describe("mission store — site selection and comparison", () => {
  it("stores the selected site with its analysis", () => {
    const s = missionReducer(initialMissionState, { type: "selectSite", analysis: analysisFor("jezero") });
    expect(s.selectedSite?.id).toBe("jezero");
    expect(s.analysis?.site.id).toBe("jezero");
  });

  it("pins at most three sites for comparison, without duplicates", () => {
    let s = initialMissionState;
    for (const id of ["a", "b", "a", "c", "d"]) s = missionReducer(s, { type: "pinComparison", analysis: analysisFor(id) });
    expect(s.comparison.map((a) => a.site.id)).toEqual(["b", "c", "d"]);
    s = missionReducer(s, { type: "unpinComparison", siteId: "c" });
    expect(s.comparison.map((a) => a.site.id)).toEqual(["b", "d"]);
  });
});

describe("mission store — planned traverse", () => {
  it("adds, removes and clears regional traverse waypoints (max 12)", () => {
    let s = initialMissionState;
    for (let i = 0; i < 14; i += 1) s = missionReducer(s, { type: "addTraversePoint", point: { lat: i, lon: i * 2 } });
    expect(s.traverse).toHaveLength(12);
    expect(s.traverse[0]).toEqual({ lat: 2, lon: 4 });
    s = missionReducer(s, { type: "removeTraversePoint", index: 0 });
    expect(s.traverse[0]).toEqual({ lat: 3, lon: 6 });
    s = missionReducer(s, { type: "clearTraverse" });
    expect(s.traverse).toEqual([]);
  });

  it("persists the traverse and drops malformed points", () => {
    const raw = JSON.stringify({ ...initialMissionState, traverse: [{ lat: 10, lon: 20 }, { lat: "x" }, { lat: 95, lon: 0 }] });
    expect(deserializeMission(raw).traverse).toEqual([{ lat: 10, lon: 20 }]);
  });
});

describe("mission store — simulation lifecycle", () => {
  it("does nothing when a simulation is started without a plan", () => {
    const s = missionReducer(initialMissionState, { type: "startSimulation" });
    expect(s.sim).toBeNull();
    expect(s.lastError).toMatch(/plan/i);
  });

  it("starts at sol 0 and advances until the next decision or the end", () => {
    let s = missionReducer(withPlan({ durationSols: 30 }), { type: "startSimulation" });
    expect(s.sim?.sol).toBe(0);
    expect(s.activeRunId).not.toBeNull();
    s = missionReducer(s, { type: "advance", sols: 200 });
    const sim = s.sim!;
    expect(sim.sol).toBeLessThanOrEqual(30);
    expect(sim.status === "awaiting-decision" || sim.sol === 30 || sim.status === "failed").toBe(true);
  });

  it("records whether the crew followed the engine recommendation", () => {
    let s = missionReducer(withPlan({ durationSols: 120, scenario: "harsh" }), { type: "startSimulation" });
    s = missionReducer(s, { type: "advance", sols: 120 });
    expect(s.sim?.status).toBe("awaiting-decision");
    const analysis = analyzeDecision(s.sim!, { samples: 6, horizonSols: 5, now: NOW });
    s = missionReducer(s, { type: "setDecisionAnalysis", analysis });
    s = missionReducer(s, { type: "choose", optionId: analysis.recommendedId });
    const last = s.sim!.decisions[s.sim!.decisions.length - 1]!;
    expect(last.recommendedId).toBe(analysis.recommendedId);
    expect(last.followedRecommendation).toBe(true);
    expect(s.lastAnalysis).toBeNull();
  });

  it("keeps the state and reports an error for an unknown option", () => {
    let s = missionReducer(withPlan({ durationSols: 120, scenario: "harsh" }), { type: "startSimulation" });
    s = missionReducer(s, { type: "advance", sols: 120 });
    const before = s.sim;
    const after = missionReducer(s, { type: "choose", optionId: "does-not-exist" });
    expect(after.sim).toBe(before);
    expect(after.lastError).toMatch(/does-not-exist/);
  });

  it("files exactly one report when the mission ends", () => {
    let s = missionReducer(withPlan({ durationSols: 20, scenario: "training" }), { type: "startSimulation" });
    for (let i = 0; i < 60 && s.sim && (s.sim.status === "running" || s.sim.status === "awaiting-decision"); i += 1) {
      if (s.sim.status === "awaiting-decision") s = missionReducer(s, { type: "choose", optionId: s.sim.pending!.defaultOptionId });
      else s = missionReducer(s, { type: "advance", sols: 20 });
    }
    expect(["success", "compromised", "failed"]).toContain(s.sim!.status);
    expect(s.reports).toHaveLength(1);
    expect(s.reports[0]!.id).toBe(s.activeRunId);
    const again = missionReducer(s, { type: "advance", sols: 5 });
    expect(again.reports).toHaveLength(1);
  });
});

describe("mission store — persistence", () => {
  it("round-trips through JSON", () => {
    const s = missionReducer(withPlan(), { type: "selectSite", analysis: analysisFor("gale", -4.59, 137.44) });
    const restored = deserializeMission(serializeMission(s));
    expect(restored.plan?.id).toBe("plan-test");
    expect(restored.selectedSite?.id).toBe("gale");
  });

  it("falls back to the initial state on corrupt or foreign data", () => {
    expect(deserializeMission(null)).toEqual(initialMissionState);
    expect(deserializeMission("{not json")).toEqual(initialMissionState);
    expect(deserializeMission(JSON.stringify({ version: 99 }))).toEqual(initialMissionState);
    expect(deserializeMission(JSON.stringify({ version: 1, sim: { nope: true } })).sim).toBeNull();
  });

  it("resets to the initial state", () => {
    expect(missionReducer(withPlan(), { type: "reset" })).toEqual(initialMissionState);
  });
});
