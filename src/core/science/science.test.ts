import { describe, expect, it } from "vitest";
import { RADIATION } from "./constants";
import { backgroundTau, dailyTemperature, describeEnvironment, gcrDosePerSol, pressureAt, REMS_CALIBRATION, shieldingColumn } from "./environment";
import { distanceKm, greatCirclePoints, latLonToXYZ, normalizeLon, xyzToLatLon } from "./geo";
import { analyzeLocation, scoreLocation } from "./habitability";
import { dailyMeanToaInsolation, dustTransmission, heliocentricDistanceAU } from "./insolation";
import { localMeanSolarTime, lsFromMsd, marsTimeFromDate } from "./marsTime";
import { computeEvaPlan, walkingSpeedKmh } from "./eva";
import { createGrid, reliefAt, sampleElevation, slopeAt } from "./terrain";

describe("Mars time (Mars24)", () => {
  it("matches the Allison & McEwen reference epoch (2000-01-06 00:00 UTC)", () => {
    const t = marsTimeFromDate(new Date(Date.UTC(2000, 0, 6, 0, 0, 0)), 64.184);
    expect(t.msd).toBeCloseTo(44795.9998, 3);
    expect(t.ls).toBeCloseTo(277.19, 1);
  });

  it("inverts MSD to Ls consistently", () => {
    const t = marsTimeFromDate(new Date(Date.UTC(2026, 10, 9, 12, 0, 0)));
    expect(lsFromMsd(t.msd)).toBeCloseTo(t.ls, 6);
  });

  it("computes local mean solar time from east longitude", () => {
    expect(localMeanSolarTime(10, 90)).toBeCloseTo(16, 6);
    expect(localMeanSolarTime(22, 60)).toBeCloseTo(2, 6);
  });
});

describe("geometry", () => {
  it("normalises longitudes", () => {
    expect(normalizeLon(190)).toBe(-170);
    expect(normalizeLon(-190)).toBe(170);
    expect(normalizeLon(360)).toBe(0);
  });

  it("computes great-circle distances on the Mars sphere", () => {
    // A quarter of the equator ≈ π·R/2.
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 })).toBeCloseTo((Math.PI * 3389.5) / 2, 0);
    const path = greatCirclePoints({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }, 8);
    expect(path).toHaveLength(9);
    expect(path[4]!.lon).toBeCloseTo(45, 6);
  });

  it("round-trips lat/lon through sphere coordinates", () => {
    for (const p of [{ lat: 18.44, lon: 77.45 }, { lat: -4.59, lon: 137.44 }, { lat: 60, lon: -120 }]) {
      const [x, y, z] = latLonToXYZ(p);
      const back = xyzToLatLon(x, y, z);
      expect(back.lat).toBeCloseTo(p.lat, 6);
      expect(back.lon).toBeCloseTo(p.lon, 6);
    }
  });
});

describe("insolation and atmosphere", () => {
  it("places perihelion near Ls 251° (closest distance)", () => {
    expect(heliocentricDistanceAU(251)).toBeLessThan(heliocentricDistanceAU(71));
    expect(heliocentricDistanceAU(251)).toBeCloseTo(1.381, 2);
  });

  it("returns zero insolation in polar night and positive at the equator", () => {
    expect(dailyMeanToaInsolation(-85, 90)).toBe(0);
    expect(dailyMeanToaInsolation(0, 0)).toBeGreaterThan(130);
    expect(dustTransmission(10)).toBeLessThan(0.02);
  });

  it("anchors the GCR dose to MSL-RAD at the reference pressure", () => {
    const perSol = gcrDosePerSol(RADIATION.referencePressurePa);
    expect(perSol).toBeCloseTo(RADIATION.radGaleDoseEqMsvPerDay * (88775.244 / 86400), 6);
    expect(gcrDosePerSol(400)).toBeGreaterThan(gcrDosePerSol(900));
  });

  it("decreases pressure with elevation (scale height 11.1 km)", () => {
    expect(pressureAt(-4450)).toBeCloseTo(REMS_CALIBRATION.meanPressurePa, 6);
    expect(pressureAt(-4450 + 11100) / pressureAt(-4450)).toBeCloseTo(Math.exp(-1), 6);
    expect(shieldingColumn(850)).toBeCloseTo(850 / 3.71 / 10, 6);
  });

  it("produces plausible temperatures", () => {
    const gale = dailyTemperature(-4.6, -4450, 270, backgroundTau(270));
    expect(gale.maxC).toBeGreaterThan(-40);
    expect(gale.minC).toBeLessThan(-50);
    const pole = dailyTemperature(-85, 2500, 90, 0.5);
    expect(pole.meanC).toBeLessThanOrEqual(-120);
  });
});

describe("terrain grid", () => {
  // 2 px/deg synthetic plane tilted east–west: z = 100 m per column (repeating every 100 columns).
  const width = 360 * 2;
  const height = 180 * 2;
  const data = new Int16Array(width * height);
  for (let row = 0; row < height; row += 1) for (let col = 0; col < width; col += 1) data[row * width + col] = (col % 100) * 100;
  const grid = createGrid(data, width, height, "synthetic");

  it("samples elevation bilinearly with pixel-centre registration", () => {
    // Column 10 centre is at lon (10 + 0.5) / 2 = 5.25°E.
    expect(sampleElevation(grid, { lat: 0.25, lon: 5.25 })).toBeCloseTo(1000, 6);
    expect(sampleElevation(grid, { lat: 0.25, lon: 5.5 })).toBeCloseTo(1050, 6);
  });

  it("computes slope and relief", () => {
    const slope = slopeAt(grid, { lat: 0.25, lon: 5.25 });
    // 200 m over two cells of ≈ 29.6 km → ≈ 0.19°
    expect(slope).toBeGreaterThan(0.15);
    expect(slope).toBeLessThan(0.25);
    expect(reliefAt(grid, { lat: 0.25, lon: 5.25 })).toBe(200);
  });
});

describe("location analysis", () => {
  it("scores low, flat, ice-rich sites above high volcano summits", () => {
    const utopia = describeEnvironment({ lat: 45, lon: 95 }, null);
    const lowland = scoreLocation({ ...utopia, elevationM: -4000, slopeDeg: 0.2, reliefM: 150, elevationSource: "mola" });
    const summit = scoreLocation({ ...utopia, elevationM: 18000, slopeDeg: 5, reliefM: 6000, shieldingGcm2: 2, elevationSource: "mola" });
    expect(lowland.landingSafety).toBeGreaterThan(summit.landingSafety);
    expect(lowland.habitability).toBeGreaterThan(summit.habitability);
    expect(lowland.risk).toBeLessThan(summit.risk);
  });

  it("flags missing elevation data instead of inventing it", () => {
    const env = describeEnvironment({ lat: 0, lon: 0 }, null);
    expect(env.elevationM).toBeNull();
    const analysis = analyzeLocation({ id: "x", name: "x", point: env.point, kind: "custom" }, env);
    expect(analysis.flags.some((f) => f.text.includes("MOLA elevation grid not loaded"))).toBe(true);
  });
});

describe("EVA model", () => {
  it("slows down on slopes and accounts O₂", () => {
    expect(walkingSpeedKmh(0, true)).toBeCloseTo(3, 6);
    expect(walkingSpeedKmh(20, true)).toBeLessThan(walkingSpeedKmh(0, true));
    const plan = computeEvaPlan({
      siteId: "test",
      siteName: "Test",
      waypoints: [
        { id: "a", x: 0, y: 0, z: 0 },
        { id: "b", x: 1000, y: 0, z: 0 },
      ],
      segmentSamples: [[{ x: 0, y: 0, z: 0 }, { x: 500, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }]],
      pois: [{ id: "p", title: "Outcrop", weight: 1 }],
      crew: 2,
    });
    expect(plan.distanceM).toBeCloseTo(1000, 6);
    expect(plan.durationMin).toBeCloseTo(20 + 20, 1);
    expect(plan.o2Kg).toBeGreaterThan(0);
    expect(plan.hazards.some((h) => h.includes("slope"))).toBe(false);
    expect(plan.hazards.some((h) => h.includes("return leg"))).toBe(true);
  });

  it("flags slopes above the no-go threshold", () => {
    const plan = computeEvaPlan({
      siteId: "test",
      siteName: "Test",
      waypoints: [
        { id: "a", x: 0, y: 0, z: 0 },
        { id: "b", x: 10, y: 8, z: 0 },
      ],
      segmentSamples: [[{ x: 0, y: 0, z: 0 }, { x: 10, y: 8, z: 0 }]],
      pois: [],
    });
    expect(plan.maxSlopeDeg).toBeGreaterThan(25);
    expect(plan.hazards.join(" ")).toMatch(/no-go/);
  });
});

describe("Mars year numbering (Clancy et al. / Piqueux et al. 2015)", () => {
  // Northern spring equinoxes: MY 37 began 2022-12-26, MY 38 2024-11-12, MY 39 2026-09-30; MY 1 began 1955-04-11.
  it.each([
    ["1955-04-20T00:00:00Z", 1],
    ["2022-12-20T00:00:00Z", 36],
    ["2022-12-30T00:00:00Z", 37],
    ["2024-11-01T00:00:00Z", 37],
    ["2024-11-20T00:00:00Z", 38],
    ["2026-09-25T00:00:00Z", 38],
    ["2026-11-09T00:00:00Z", 39],
  ])("%s is in MY %i", async (iso, my) => {
    const { marsTimeFromDate } = await import("./marsTime");
    expect(marsTimeFromDate(new Date(iso)).marsYear).toBe(my);
  });
});

describe("location flags", () => {
  it("says a documented target is at the site instead of 'within 0 km'", async () => {
    const { analyzeLocation } = await import("./habitability");
    const { describeEnvironment } = await import("./environment");
    const env = describeEnvironment({ lat: 18.44, lon: 77.45 }, null);
    const texts = analyzeLocation({ id: "j", name: "Jezero", point: { lat: 18.44, lon: 77.45 }, kind: "catalogue" }, env).flags.map((f) => f.text);
    expect(texts.join(" ")).not.toMatch(/within 0 km/);
    expect(texts.some((t) => /at the site/.test(t))).toBe(true);
  });
});
