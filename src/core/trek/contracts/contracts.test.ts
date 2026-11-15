import { describe, expect, it } from "vitest";
import {
  confidenceRank,
  healthRank,
  meetsMinConfidence,
  mostRestrictiveZone,
  zoneRank,
  type ConfidenceClass,
  type ZoneClass,
} from "./index";
import { TREK_PARAMS, type ParamOrigin } from "../params";

describe("Mars Trek contracts & params (Task 2)", () => {
  it("orders confidence classes strictly K1 > K2 > K3a > K3b > K3c > K3d > K4 > K5", () => {
    const ordered: ConfidenceClass[] = ["K1", "K2", "K3a", "K3b", "K3c", "K3d", "K4", "K5"];
    for (let i = 0; i < ordered.length - 1; i += 1) {
      expect(confidenceRank(ordered[i]!)).toBeGreaterThan(confidenceRank(ordered[i + 1]!));
    }
    expect(meetsMinConfidence("K1", "K3a")).toBe(true);
    expect(meetsMinConfidence("K3a", "K3a")).toBe(true);
    expect(meetsMinConfidence("K3b", "K3a")).toBe(false);
    expect(meetsMinConfidence("K5", "K4")).toBe(false);
  });

  it("orders zone classes so Z5 is the most restrictive and Z0 the least", () => {
    const zones: ZoneClass[] = ["Z0", "Z1", "Z2", "Z3", "Z4", "Z5"];
    for (let i = 0; i < zones.length - 1; i += 1) {
      expect(zoneRank(zones[i]!)).toBeLessThan(zoneRank(zones[i + 1]!));
    }
    expect(mostRestrictiveZone("Z1", "Z5")).toBe("Z5");
    expect(mostRestrictiveZone("Z4", "Z2")).toBe("Z4");
  });

  it("orders health states from NORMAL to EMERGENCY", () => {
    expect(healthRank("NORMAL")).toBeLessThan(healthRank("FATIGUE"));
    expect(healthRank("FATIGUE")).toBeLessThan(healthRank("CAUTION"));
    expect(healthRank("CAUTION")).toBeLessThan(healthRank("CRITICAL"));
    expect(healthRank("CRITICAL")).toBeLessThan(healthRank("EMERGENCY"));
  });

  it("requires every parameter in params.ts to declare a valid origin and non-empty note", () => {
    const validOrigins = new Set<ParamOrigin>(["diseño", "HUELLA", "verificado", "proyecto"]);
    const entries = Object.entries(TREK_PARAMS);
    expect(entries.length).toBeGreaterThan(15);
    for (const [key, param] of entries) {
      expect(validOrigins.has(param.origin), `${key} origin`).toBe(true);
      expect(param.note.trim().length, `${key} note`).toBeGreaterThan(10);
      expect(Number.isFinite(param.value), `${key} finite value`).toBe(true);
    }
  });

  it("sets foot normal max slope to 20 deg and minimum distance weight to 0.05", () => {
    expect(TREK_PARAMS.maxSlopeFootNormalDeg.value).toBe(20);
    expect(TREK_PARAMS.cautionSlopeFootDeg.value).toBe(15);
    expect(TREK_PARAMS.minDistanceWeight.value).toBe(0.05);
  });
});
