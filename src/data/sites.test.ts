import { describe, expect, it } from "vitest";
import { distanceKm } from "@/core/science/geo";
import { SCIENCE_TARGETS } from "@/core/science/regions";
import { CATALOGUE_SITES, findCatalogueSite } from "./sites";

describe("site catalogue", () => {
  it("has unique ids and valid planetocentric coordinates", () => {
    expect(new Set(CATALOGUE_SITES.map((s) => s.id)).size).toBe(CATALOGUE_SITES.length);
    for (const s of CATALOGUE_SITES) {
      expect(Math.abs(s.point.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(s.point.lon)).toBeLessThanOrEqual(180);
    }
  });

  it("includes the Mount Sharp boxwork Curiosity explored in 2025, inside Gale crater", () => {
    const boxwork = findCatalogueSite("boxwork");
    expect(boxwork).toBeDefined();
    expect(distanceKm(boxwork!.point, findCatalogueSite("gale")!.point)).toBeLessThan(30);
    const target = SCIENCE_TARGETS.find((t) => t.id === "mount-sharp-boxwork");
    expect(target).toBeDefined();
    expect(distanceKm(target!.point, boxwork!.point)).toBeLessThan(1);
    expect(target!.reference).toMatch(/MMGIS/);
  });
});
