import { describe, expect, it } from "vitest";
import { computeEvaPlan } from "./eva";
import { buildWalkTimeline, sampleWalk } from "./evaWalk";

const waypoints = [
  { id: "a", x: 0, y: 0, z: 0 },
  { id: "b", x: 30, y: 0, z: 0, poiId: "rock" },
  { id: "c", x: 30, y: 6, z: 40 },
];
const leg = (from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, n: number) =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n, z: from.z + ((to.z - from.z) * i) / n }));
const samples = [leg(waypoints[0]!, waypoints[1]!, 30), leg(waypoints[1]!, waypoints[2]!, 40)];
const pois = [{ id: "rock", title: "Layered outcrop", weight: 1 }];
const plan = computeEvaPlan({ siteId: "test", siteName: "Test", waypoints, segmentSamples: samples, pois, crew: 2 });

describe("EVA walk timeline (HUD)", () => {
  const timeline = buildWalkTimeline(samples, waypoints, pois, 2);

  it("ends with exactly the plan's distance, duration and suit O₂", () => {
    const last = timeline.frames[timeline.frames.length - 1]!;
    expect(last.distanceM).toBeCloseTo(plan.distanceM, 6);
    expect(timeline.totalMinutes).toBeCloseTo(plan.durationMin, 6);
    expect(last.o2Kg).toBeCloseTo(plan.o2Kg, 6);
  });

  it("starts at the first waypoint and finishes at the last", () => {
    expect(sampleWalk(timeline, 0)).toMatchObject({ distanceM: 0, done: false, stop: null });
    const end = sampleWalk(timeline, timeline.totalMinutes + 5);
    expect(end.done).toBe(true);
    expect(end.position).toEqual([30, 6, 40]);
  });

  it("holds position during the science stop at a point of interest", () => {
    const arrival = timeline.frames.find((f) => f.stop === "Layered outcrop")!;
    const during = sampleWalk(timeline, arrival.minutes + 10);
    expect(during.stop).toBe("Layered outcrop");
    expect(during.position).toEqual([30, 0, 0]);
    expect(during.o2Kg).toBeGreaterThan(arrival.o2Kg);
  });

  it("interpolates position, distance and slope while walking", () => {
    const halfFlat = timeline.frames.find((f) => f.distanceM >= 15)!;
    const s = sampleWalk(timeline, halfFlat.minutes);
    expect(s.position[0]).toBeCloseTo(halfFlat.distanceM, 6);
    expect(s.slopeDeg).toBeCloseTo(0, 6);
    const climbing = sampleWalk(timeline, timeline.totalMinutes - 1);
    expect(climbing.slopeDeg).toBeCloseTo((Math.atan2(6, 40) * 180) / Math.PI, 3);
    expect(climbing.nextLabel).toBe("Waypoint 3");
  });
});
