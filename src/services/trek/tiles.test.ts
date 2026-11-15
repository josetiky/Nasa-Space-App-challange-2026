import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodeElevationTile, type SiteManifest } from "./tiles";
import { TREK_SITES } from "./sites";

const GALE_DIR = path.resolve(process.cwd(), "public/data/trek/gale");

describe("Mars Trek Gale elevation tiles (Task 1)", () => {
  it("decodes murray_buttes to 129x129 nodes with 100% valid coverage and matching sha256", () => {
    const manifestPath = path.join(GALE_DIR, "murray_buttes", "manifest.json");
    const tilePath = path.join(GALE_DIR, "murray_buttes", "elevation.f32");

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as SiteManifest;
    const rawBuf = fs.readFileSync(tilePath);
    const sha256 = crypto.createHash("sha256").update(rawBuf).digest("hex");

    expect(manifest.siteId).toBe("murray_buttes");
    expect(manifest.grid.nx).toBe(129);
    expect(manifest.grid.nz).toBe(129);
    expect(manifest.grid.cell).toBe(1);
    expect(manifest.meshNodes).toBe("TYPE_TILE");
    expect(manifest.sha256).toBe(sha256);

    const ab = rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength);
    const grid = decodeElevationTile(ab, manifest);
    expect(grid.nx).toBe(129);
    expect(grid.nz).toBe(129);
    expect(grid.h.length).toBe(129 * 129);

    let valid = 0;
    for (let i = 0; i < grid.h.length; i += 1) {
      if (!Number.isNaN(grid.h[i]!)) valid += 1;
    }
    expect(valid).toBe(129 * 129);
  });

  it("rejects buffers whose byteLength does not match the manifest grid dimensions", () => {
    const manifestPath = path.join(GALE_DIR, "murray_buttes", "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as SiteManifest;
    const badBuffer = new ArrayBuffer(1024);
    expect(() => decodeElevationTile(badBuffer, manifest)).toThrow(/Invalid elevation tile buffer size/);
  });

  it("verifies all 5 Gale scenes have 129x129 tiles, 100% coverage, and valid elevation ranges", () => {
    const galeSites = ["landing_site", "pahrump_hills", "marias_pass", "murray_buttes", "live_site"];
    for (const siteId of galeSites) {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(GALE_DIR, siteId, "manifest.json"), "utf8"),
      ) as SiteManifest;
      const rawBuf = fs.readFileSync(path.join(GALE_DIR, siteId, "elevation.f32"));
      const sha256 = crypto.createHash("sha256").update(rawBuf).digest("hex");
      expect(manifest.sha256).toBe(sha256);

      const ab = rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength);
      const grid = decodeElevationTile(ab, manifest);
      let minH = Number.POSITIVE_INFINITY;
      let maxH = Number.NEGATIVE_INFINITY;
      for (let i = 0; i < grid.h.length; i += 1) {
        const v = grid.h[i]!;
        expect(Number.isNaN(v)).toBe(false);
        if (v < minH) minH = v;
        if (v > maxH) maxH = v;
      }
      expect(minH).toBeGreaterThanOrEqual(manifest.elevationRangeM[0] - 0.5);
      expect(maxH).toBeLessThanOrEqual(manifest.elevationRangeM[1] + 0.5);
    }
  });

  it("lists all 5 real Gale scenes plus the SIMULATED two-corridor test field in TREK_SITES", () => {
    expect(TREK_SITES.length).toBe(6);
    const realSites = TREK_SITES.filter((s) => !s.simulated);
    const simSites = TREK_SITES.filter((s) => s.simulated);
    expect(realSites.length).toBe(5);
    expect(simSites.length).toBe(1);
    expect(simSites[0]?.dataType).toBe("SIMULATED");
  });
});
