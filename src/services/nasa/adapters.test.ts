import { describe, expect, it } from "vitest";
import { firstAvailable } from "./http";
import { trekTemplate, trekTileUrl } from "./adapters";

describe("firstAvailable", () => {
  it("returns the first loader that succeeds, with the earlier failures", async () => {
    const result = await firstAvailable([
      { origin: "live", load: () => Promise.reject(new Error("CORS")) },
      { origin: "snapshot", load: () => Promise.resolve(42) },
      { origin: "bundled", load: () => Promise.resolve(7) },
    ]);
    expect(result).toEqual({ value: 42, origin: "snapshot", failures: ["live: CORS"] });
  });

  it("throws with every reason when all loaders fail", async () => {
    await expect(firstAvailable([
      { origin: "live", load: () => Promise.reject(new Error("timeout")) },
      { origin: "snapshot", load: () => Promise.reject(new Error("404")) },
    ])).rejects.toThrow("live: timeout · snapshot: 404");
  });
});

describe("Mars Trek tiles", () => {
  it("orders WMTS paths as zoom/row/column", () => {
    expect(trekTileUrl("viking", 2, 1, 5)).toBe("https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/2/1/5.jpg");
    expect(trekTemplate("molaShade")).toMatch(/Mars_MGS_MOLA_ClrShade_merge_global_463m\/1\.0\.0\/default\/default028mm\/\{z\}\/\{y\}\/\{x\}\.jpg$/);
  });
});
