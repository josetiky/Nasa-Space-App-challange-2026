import { describe, expect, it } from "vitest";
import { buildWalkTimeline } from "@/core/science/evaWalk";
import { BOXWORK_META, BOXWORK_STOPS, planBoxworkEva } from "@/data/boxwork";
import { buildEvaCard, formatMissionTime } from "./evaCard";

function card(fromSol: number, toSol: number, returnToStart: boolean) {
  const result = planBoxworkEva({ fromSol, toSol, returnToStart, crew: 2 });
  const timeline = buildWalkTimeline(result.segmentSamples, result.plan.waypoints, result.stops, 2, result.segmentLengthFactors);
  return { result, md: buildEvaCard({ result, timeline, crew: 2, returnToStart, allStops: BOXWORK_STOPS, credit: BOXWORK_META.credit }) };
}

const rowTimes = (md: string) =>
  md
    .split("\n")
    .filter((line) => /^\| \d+:\d\d \|/.test(line))
    .map((line) => {
      const [h, m] = line.slice(2).split(" ")[0]!.split(":").map(Number);
      return h! * 60 + m!;
    });

describe("mission time format", () => {
  it("writes hours and zero-padded minutes, rounding to the minute", () => {
    expect(formatMissionTime(0)).toBe("0:00");
    expect(formatMissionTime(59.6)).toBe("1:00");
    expect(formatMissionTime(99.2)).toBe("1:39");
  });
});

describe("EVA cuff card", () => {
  it("lists start, every stop in walking order, the turn-around and the return", () => {
    const { result, md } = card(4641, 4711, true);
    expect(md).toContain("# EVA card — Mount Sharp boxwork (Gale)");
    expect(md).toContain("| 0:00 | Start at sol 4641");
    for (const stop of result.stops) expect(md).toContain(`Stop ${BOXWORK_STOPS.indexOf(stop) + 1} · ${stop.title}`);
    expect(md).toContain("Turn-around at sol 4711");
    expect(md).toContain(`| ${formatMissionTime(result.plan.durationMin)} | Back at start`);
    const times = rowTimes(md);
    expect(times.length).toBeGreaterThanOrEqual(result.stops.length + 3);
    times.slice(1).forEach((t, i) => expect(t).toBeGreaterThanOrEqual(times[i]!));
  });

  it("carries the plan's hazards, the stop sources and the data credit", () => {
    const { result, md } = card(4641, 4711, true);
    for (const hazard of result.plan.hazards) expect(md).toContain(hazard);
    for (const stop of result.stops) expect(md).toContain(stop.source.url);
    expect(md).toContain(BOXWORK_META.credit);
    expect(md).toMatch(/MODELLED/);
  });

  it("ends at the far stop on a one-way walk", () => {
    const { md } = card(4530, 4560, false);
    expect(md).not.toContain("Turn-around");
    expect(md).toContain("End at sol 4560");
  });
});
