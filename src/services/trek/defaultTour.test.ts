import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { LocalPoint } from "@/core/trek/contracts";
import { buildStaticTerrain } from "@/core/trek/costmap/terrain";
import { createSession } from "@/core/trek/sim/session";
import { TREK_SITES } from "./sites";
import { decodeElevationTile, type SiteManifest } from "./tiles";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const near = (a: LocalPoint, b: LocalPoint, tol = 1.5) => Math.hypot(a.x - b.x, a.z - b.z) <= tol;

function loadTerrain(siteId: string) {
  const dir = path.join(PUBLIC_DIR, "data/trek/gale", siteId);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dir, "manifest.json"), "utf8"),
  ) as SiteManifest;
  const raw = fs.readFileSync(path.join(dir, "elevation.f32"));
  const grid = decodeElevationTile(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    manifest,
  );
  const site = TREK_SITES.find((s) => s.id === siteId)!;
  return {
    site,
    terrain: buildStaticTerrain(grid, {
      siteId,
      baseConfidence: site.baseConfidence,
      baseResolutionM: site.resolutionM,
      roverTraversePoints: site.roverTraversePoints,
      simulated: site.simulated,
    }),
  };
}

const TOUR_SITES = TREK_SITES.filter((s) => !s.simulated && s.defaultStops.length > 0).map(
  (s) => s.id,
);

describe("Recorrido científico por defecto", () => {
  it("Murray Buttes (sitio inicial) tiene recorrido por defecto", () => {
    expect(TOUR_SITES).toContain("murray_buttes");
  });

  it.each(TOUR_SITES)(
    "%s: rover → estaciones → rover, todas alcanzables y de ~2–3 h de EVA",
    (siteId) => {
      const { site, terrain } = loadTerrain(siteId);
      const session = createSession({
        terrain,
        origin: site.defaultOrigin,
        goal: site.defaultGoal,
        shelters: site.shelters,
        stops: site.defaultStops,
      });
      const r = session.routeResult;
      if (!r.ok) throw new Error(`${siteId}: ${r.message}`);
      const tour = r.tour!;
      expect(tour.skipped).toEqual([]);
      expect(tour.legs.map((l) => l.toStopId)).toEqual([
        ...site.defaultStops.map((s) => s.id),
        null,
      ]);
      for (const stop of site.defaultStops) {
        expect(r.route.points.some((p) => near(p, stop.point))).toBe(true);
        // La estación está junto al objetivo real de Curiosity que estudia
        const poi = site.pois.find((p) => p.id === stop.poiId)!;
        expect(Math.hypot(poi.point.x - stop.point.x, poi.point.z - stop.point.z)).toBeLessThan(12);
      }
      // La EVA regresa al punto de partida (el rover)
      expect(near(r.route.points[r.route.points.length - 1]!, site.defaultOrigin)).toBe(true);
      expect(tour.totalMin).toBeGreaterThan(120);
      expect(tour.totalMin).toBeLessThan(200);
      expect(r.resourcePlan.returnMarginMin).toBeGreaterThan(0);
      expect(r.route.maxSlopeDeg).toBeLessThan(session.envelope.maxSlopeDeg);
    },
  );
});
