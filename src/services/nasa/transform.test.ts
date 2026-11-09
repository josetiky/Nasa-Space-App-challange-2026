import { describe, expect, it } from "vitest";
import {
  MOLA_HEIGHT,
  MOLA_WIDTH,
  donkiEpisodes,
  int16FromLittleEndian,
  int16ToLittleEndian,
  latestValidSol,
  megdrToInt16,
  parseTraverse,
  simplifyLine,
  trimRems,
} from "./transform";

const CELLS = MOLA_WIDTH * MOLA_HEIGHT;

describe("MOLA MEGDR decoding", () => {
  it("decodes big-endian signed 16-bit heights", () => {
    const buffer = new ArrayBuffer(CELLS * 2);
    const view = new DataView(buffer);
    view.setInt16(0, -8068, false);
    view.setInt16(2, 21134, false);
    view.setInt16((CELLS - 1) * 2, 1234, false);
    const grid = megdrToInt16(buffer);
    expect(grid[0]).toBe(-8068);
    expect(grid[1]).toBe(21134);
    expect(grid[CELLS - 1]).toBe(1234);
  });

  it("rejects buffers that are not 1440×720 int16", () => {
    expect(() => megdrToInt16(new ArrayBuffer(100))).toThrow(/size/);
    expect(() => int16FromLittleEndian(new ArrayBuffer(100))).toThrow(/size/);
  });

  it("round-trips the little-endian snapshot format", () => {
    const data = new Int16Array(CELLS);
    data[5] = -32000;
    data[CELLS - 2] = 32000;
    const restored = int16FromLittleEndian(int16ToLittleEndian(data));
    expect(restored[5]).toBe(-32000);
    expect(restored[CELLS - 2]).toBe(32000);
  });
});

describe("REMS feed trimming", () => {
  const raw = {
    soles: [
      { sol: "4500", terrestrial_date: "2025-04-02", ls: "70", min_temp: "-80", max_temp: "-5", pressure: "860", atmo_opacity: "Sunny", local_uv_irradiance_index: "Moderate", min_gts_temp: "-88", max_gts_temp: "5", sunrise: "05:20", sunset: "17:40" },
      { sol: "4498", min_temp: "--", max_temp: "--", pressure: "--" },
      { sol: "x" },
      { sol: "4499", min_temp: "-79", max_temp: "-7", pressure: "858" },
    ],
  };

  it("keeps numeric fields, maps missing values to null and sorts by sol", () => {
    const snap = trimRems(raw, "test", "2026-01-01T00:00:00Z");
    expect(snap.count).toBe(3);
    expect(snap.soles.map((s) => s.sol)).toEqual([4498, 4499, 4500]);
    expect(snap.soles[0]!.minT).toBeNull();
    expect(snap.soles[2]).toMatchObject({ minT: -80, maxT: -5, pressurePa: 860, opacity: "Sunny", date: "2025-04-02" });
    expect(snap.credit).toMatch(/CSIC-INTA/);
  });

  it("returns an empty snapshot for malformed payloads", () => {
    expect(trimRems(null, "s", "t").count).toBe(0);
    expect(trimRems({ soles: "nope" }, "s", "t").soles).toEqual([]);
  });

  it("finds the latest sol with complete measurements", () => {
    const snap = trimRems({ soles: [{ sol: 1, min_temp: -70, max_temp: -10, pressure: 800 }, { sol: 2, min_temp: "--" }] }, "s", "t");
    expect(latestValidSol(snap)?.sol).toBe(1);
    expect(latestValidSol(trimRems({ soles: [] }, "s", "t"))).toBeNull();
  });
});

describe("traverse parsing", () => {
  it("drops collinear points but keeps endpoints and real bends", () => {
    const line: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 1],
      [4, 2],
    ];
    const simplified = simplifyLine(line, 0.01);
    expect(simplified[0]).toEqual([0, 0]);
    expect(simplified[simplified.length - 1]).toEqual([4, 2]);
    expect(simplified).toContainEqual([2, 0]);
    expect(simplified).not.toContainEqual([1, 0]);
  });

  it("reads LineString and MultiLineString features with their sol", () => {
    const lines = parseTraverse({
      features: [
        { properties: { sol: 12 }, geometry: { type: "LineString", coordinates: [[77.45, 18.44], [77.46, 18.45]] } },
        { properties: { Sol: "13" }, geometry: { type: "MultiLineString", coordinates: [[[77.46, 18.45], [77.47, 18.46]], [[77.47, 18.46]]] } },
        { properties: {}, geometry: { type: "Point", coordinates: [77, 18] } },
      ],
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ sol: 12 });
    expect(lines[1]!.sol).toBe(13);
    expect(lines[1]!.coordinates).toHaveLength(2);
  });
});

describe("DONKI SEP episodes", () => {
  it("clusters detections within 48 h and assigns a severity tier", () => {
    const episodes = donkiEpisodes([
      { eventTime: "2024-02-12T06:00Z", instruments: [{ displayName: "GOES-P: EPS >10 MeV" }] },
      { eventTime: "2024-02-13T06:00Z", instruments: [{ displayName: "GOES-P: EPS >100 MeV" }] },
      { eventTime: "2024-05-09T00:00Z", instruments: [] },
      { eventTime: "2024-05-09T10:00Z", instruments: [] },
      { eventTime: "2024-05-10T00:00Z", instruments: [] },
      { eventTime: "2024-05-10T12:00Z", instruments: [] },
      { eventTime: "not a date" },
    ]);
    expect(episodes).toHaveLength(2);
    expect(episodes[0]).toMatchObject({ dayOfYear: 43, tier: 3 });
    expect(episodes[1]).toMatchObject({ dayOfYear: 130, tier: 2 });
  });

  it("returns no episodes for a non-array payload", () => {
    expect(donkiEpisodes({ error: "rate limited" })).toEqual([]);
  });
});
