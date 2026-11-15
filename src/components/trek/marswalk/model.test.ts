import { describe, expect, it } from "vitest";
import type { HealthTransition, ReplanRecord } from "@/core/trek/contracts";
import { initialTrekState, trekReducer } from "@/state/trekStore";
import { layerProvenance, MAP_LAYER_IDS, UNAVAILABLE_DECOUPLED_LAYERS } from "../layerCatalog";
import {
  buildAssistantFeed,
  canSubmitHumanConfirmation,
  formatLatLon,
  MIN_JUSTIFICATION_CHARS,
  missionClock,
  niceGridStep,
  vitalsFromRow,
} from "./model";

const replan = (seq: number, atS: number, decision: ReplanRecord["decision"]): ReplanRecord => ({
  seq,
  atS,
  decision,
  causes: [],
  previousCostM: null,
  newCostM: null,
  improvementPct: null,
  summary: `r${seq}`,
  simulated: true,
});

const transition = (
  seq: number,
  t: number,
  to: HealthTransition["to"],
  confirmed = false,
): HealthTransition => ({
  seq,
  missionTimeS: t,
  subjectId: "EVA1",
  from: "NORMAL",
  to,
  causes: [],
  triggers: [{ ruleId: "VEN-01", level: "ABORTAR", value: 0, message: "fan" }],
  dataQuality: {},
  latch: "none",
  directiveId: "d",
  simulated: true,
  ...(confirmed ? { humanConfirmed: { by: "HAB-IV1", justification: "ok", atS: t } } : {}),
});

describe("MarsWalk view model", () => {
  it("merges replan log and FSM history chronologically with engine-derived levels", () => {
    const feed = buildAssistantFeed(
      [replan(1, 0, "keep"), replan(2, 120, "emergency")],
      [transition(1, 60, "FATIGUE"), transition(2, 180, "CRITICAL", true)],
    );
    expect(feed.map((f) => f.atS)).toEqual([0, 60, 120, 180]);
    expect(feed.map((f) => f.level)).toEqual(["info", "warn", "crit", "crit"]);
    expect(feed[3]!.text).toContain("VEN-01");
    expect(feed[3]!.text).toContain("HAB-IV1");
  });

  it("orders same-time entries numerically and puts the health cause before the replan effect", () => {
    const feed = buildAssistantFeed(
      [replan(10, 0, "keep"), replan(9, 0, "replan")],
      [transition(1, 0, "FATIGUE")],
    );
    expect(feed.map((f) => f.key)).toEqual(["h-1", "r-9", "r-10"]);
  });

  it("caps the feed length", () => {
    const many = Array.from({ length: 60 }, (_, i) => replan(i, i, "keep"));
    expect(buildAssistantFeed(many, [], 40)).toHaveLength(40);
  });

  it("only allows the human confirmation when the FSM requires it and a justification is written", () => {
    const longText = "x".repeat(MIN_JUSTIFICATION_CHARS);
    expect(
      canSubmitHumanConfirmation({
        requiresHumanConfirmation: false,
        by: "HAB-IV1",
        justification: longText,
      }),
    ).toBe(false);
    expect(
      canSubmitHumanConfirmation({
        requiresHumanConfirmation: true,
        by: "HAB-IV1",
        justification: "corto",
      }),
    ).toBe(false);
    expect(
      canSubmitHumanConfirmation({
        requiresHumanConfirmation: true,
        by: " ",
        justification: longText,
      }),
    ).toBe(false);
    expect(
      canSubmitHumanConfirmation({
        requiresHumanConfirmation: true,
        by: "HAB-IV1",
        justification: longText,
      }),
    ).toBe(true);
  });

  it("reads vitals from the simulated row without thresholds and flags missing channels", () => {
    expect(vitalsFromRow(null).every((v) => v.value === null && v.quality === "missing")).toBe(
      true,
    );
    let s = trekReducer(initialTrekState, { type: "simTick", dtS: 5 });
    const row = s.session.latestTelemetryRow;
    expect(row?.dataType).toBe("SIMULATED");
    const vit = vitalsFromRow(row);
    expect(vit.find((v) => v.id === "hr")?.value).toBeTypeOf("number");
    s = trekReducer(s, {
      type: "simEvent",
      event: { kind: "health-incident", incident: "perdida_sensores", simulated: true },
    });
    const cut = vitalsFromRow(s.session.latestTelemetryRow);
    expect(cut.find((v) => v.id === "spo2")?.quality).toBe("missing");
  });

  it("formats clock, hemispheres and nice grid steps", () => {
    expect(missionClock(3725)).toBe("T+ 01:02:05");
    expect(formatLatLon({ lat: -4.6, lon: 137.4 })).toBe("4.6000° S · 137.4000° E");
    expect(niceGridStep(120)).toBe(20);
    expect(niceGridStep(96)).toBe(10);
  });

  it("labels every base layer with an honest provenance and keeps unavailable rasters as no_disponible", () => {
    const st = initialTrekState;
    const tags = MAP_LAYER_IDS.map((l) => layerProvenance(l, st));
    expect(tags).toHaveLength(6);
    expect(layerProvenance("dust", st)).toBe("MODELLED");
    const withSep = trekReducer(st, {
      type: "simEvent",
      event: { kind: "sep-alert", active: true, simulated: true },
    });
    expect(layerProvenance("radiation", withSep)).toBe("SIMULATED");
    expect(UNAVAILABLE_DECOUPLED_LAYERS.every((u) => u.status === "no_disponible")).toBe(true);
    expect(UNAVAILABLE_DECOUPLED_LAYERS.map((u) => u.id)).toEqual(
      expect.arrayContaining(["themis-ti-100m", "crism-hydrous", "mola-hrsc-dem-200m"]),
    );
  });
});
