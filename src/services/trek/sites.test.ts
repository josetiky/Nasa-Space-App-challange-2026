import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildStaticTerrain } from "@/core/trek/costmap/terrain";
import { createSession } from "@/core/trek/sim/session";
import { TREK_SITES } from "./sites";
import { decodeElevationTile, type SiteManifest } from "./tiles";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");

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

describe("Sitios de Gale: valores por defecto y ortofoto", () => {
  it.each(TREK_SITES.filter((s) => !s.simulated).map((s) => s.id))(
    "%s: el origen y el destino por defecto dan una ruta admisible al abrir la pantalla",
    (siteId) => {
      const { site, terrain } = loadTerrain(siteId);
      const session = createSession({
        terrain,
        origin: site.defaultOrigin,
        goal: site.defaultGoal,
        shelters: site.shelters,
      });
      if (!session.routeResult.ok) throw new Error(`${siteId}: ${session.routeResult.message}`);
      expect(session.routeResult.ok).toBe(true);
    },
  );

  it.each(TREK_SITES.filter((s) => !s.simulated).map((s) => s.id))(
    "%s: la ortofoto existe, es REAL y cubre la misma extensión que la rejilla de elevación",
    (siteId) => {
      const site = TREK_SITES.find((s) => s.id === siteId)!;
      expect(site.orthophotoUrl).toBe(`/data/trek/gale/${siteId}/orthophoto.jpg`);
      const dir = path.join(PUBLIC_DIR, "data/trek/gale", siteId);
      const meta = JSON.parse(fs.readFileSync(path.join(dir, "orthophoto.json"), "utf8"));
      const manifest = JSON.parse(
        fs.readFileSync(path.join(dir, "manifest.json"), "utf8"),
      ) as SiteManifest;
      expect(meta.dataType).toBe("REAL");
      expect(meta.coveragePct).toBeGreaterThanOrEqual(99);
      expect(meta.extentM.x0).toBe(manifest.grid.x0);
      expect(meta.extentM.x1).toBe(manifest.grid.x0 + (manifest.grid.nx - 1) * manifest.grid.cell);
      expect(fs.statSync(path.join(PUBLIC_DIR, site.orthophotoUrl!.slice(1))).size).toBeGreaterThan(
        100_000,
      );
    },
  );
});
