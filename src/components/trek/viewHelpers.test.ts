import { describe, expect, it } from "vitest";
import type { HealthState, ZoneClass } from "@/core/trek/contracts";
import { TREK_TEXTS } from "./i18n";
import {
  asciiSparkBar,
  confidenceVisual,
  healthVisual,
  hillshadeAt,
  localToPlanetocentric,
  whyBarSegments,
  zoneVisual,
} from "./viewHelpers";

describe("Mars Trek pure view helpers & i18n (Task 11)", () => {
  it("provides distinct text + shape + pattern/color encoding for all zones Z0–Z5 and health states S1–S5", () => {
    const zones: ZoneClass[] = ["Z0", "Z1", "Z2", "Z3", "Z4", "Z5"];
    for (const z of zones) {
      const v = zoneVisual(z);
      expect(v.shapeGlyph.length).toBeGreaterThan(0);
      expect(v.fillHex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(zoneVisual("Z5").pattern).toBe("crosshatch");
    expect(zoneVisual("Z3").pattern).toBe("dots");

    const states: HealthState[] = ["NORMAL", "FATIGUE", "CAUTION", "CRITICAL", "EMERGENCY"];
    const shapes = new Set(states.map((s) => healthVisual(s).shapeName));
    expect(shapes.size).toBe(5);
    expect(healthVisual("EMERGENCY").fullWidthBanner).toBe(true);
  });

  it("computes whyBarSegments whose percentages sum to 100 %", () => {
    const segs = whyBarSegments({ D: 48.2, T: 21.4, R: 8.1, E: 9.7, U: 7.3, H: 5.3 });
    expect(segs).toHaveLength(6);
    const totalPct = segs.reduce((acc, s) => acc + s.pct, 0);
    expect(totalPct).toBeCloseTo(100, 5);

    const zeroSegs = whyBarSegments({ D: 0, T: 0, R: 0, E: 0, U: 0, H: 0 });
    expect(zeroSegs.reduce((acc, s) => acc + s.pct, 0)).toBeCloseTo(100, 5);
  });

  it("computes bounded hillshade values in [0.12, 1] and handles NaN cells", () => {
    const elev = new Float32Array(9);
    for (let i = 0; i < 9; i += 1) elev[i] = i * 0.5;
    const hs = hillshadeAt(elev, 3, 3, 1, 1, 1);
    expect(hs).toBeGreaterThanOrEqual(0.12);
    expect(hs).toBeLessThanOrEqual(1);

    elev[4] = Number.NaN;
    expect(hillshadeAt(elev, 3, 3, 1, 1, 1)).toBe(0.25);
  });

  it("converts local metric coordinates to planetocentric IAU_2015:49900 using Martian radius 3,396,190 m", () => {
    const base = { lat: -4.7031, lon: 137.3912 };
    const p0 = localToPlanetocentric({ x: 0, z: 0 }, base);
    expect(p0.lat).toBeCloseTo(base.lat, 5);
    expect(p0.lon).toBeCloseTo(base.lon, 5);

    const northEast = localToPlanetocentric({ x: 50, z: 50 }, base);
    expect(northEast.lat).toBeGreaterThan(base.lat);
    expect(northEast.lon).toBeGreaterThan(base.lon);
  });

  it("provides complete Spanish and English dictionaries and confidence visual styles", () => {
    expect(TREK_TEXTS.es.brandTitle).toContain("MARS TREK");
    expect(TREK_TEXTS.en.brandTitle).toContain("MARS TREK");
    expect(Object.keys(TREK_TEXTS.es.healthStates)).toEqual(Object.keys(TREK_TEXTS.en.healthStates));
    expect(confidenceVisual("K1").strokeStyle).toBe("solid");
    expect(confidenceVisual("K3a").strokeStyle).toBe("dashed");
    expect(confidenceVisual("K4").strokeStyle).toBe("dotted");
    expect(asciiSparkBar(50, 0, 100, 10)).toBe("#####.....");
  });
});
