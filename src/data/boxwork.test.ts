import { describe, expect, it } from "vitest";
import { planRoverTraverseEva, toLocalMetres } from "@/core/science/roverTraverse";
import { BOXWORK_STOPS, BOXWORK_WAYPOINTS, planBoxworkEva } from "./boxwork";

const bySol = (sol: number) => BOXWORK_WAYPOINTS.find((w) => w.sol === sol)!;

describe("Curiosity boxwork traverse data (MMGIS)", () => {
  it("holds the 62 end-of-drive waypoints from sol 4530 to 4711, one per sol, in order", () => {
    expect(BOXWORK_WAYPOINTS).toHaveLength(62);
    expect(BOXWORK_WAYPOINTS[0]!.sol).toBe(4530);
    expect(BOXWORK_WAYPOINTS.at(-1)!.sol).toBe(4711);
    BOXWORK_WAYPOINTS.slice(1).forEach((w, i) => expect(w.sol).toBeGreaterThan(BOXWORK_WAYPOINTS[i]!.sol));
  });

  it("has drive distances that agree with the mission odometer (published rounded to 1 m)", () => {
    BOXWORK_WAYPOINTS.slice(1).forEach((w, i) => {
      expect(Math.abs(w.odometerM - BOXWORK_WAYPOINTS[i]!.odometerM - w.driveM)).toBeLessThanOrEqual(1);
    });
  });

  it("places every science stop on a waypoint and cites a NASA source", () => {
    expect(BOXWORK_STOPS.length).toBeGreaterThanOrEqual(6);
    for (const stop of BOXWORK_STOPS) {
      expect(bySol(stop.sol), stop.id).toBeDefined();
      for (const link of [stop.source, ...(stop.alsoSee ?? [])]) expect(link.url).toMatch(/^https:\/\/(science\.nasa\.gov|www\.jpl\.nasa\.gov|photojournal\.jpl\.nasa\.gov)\//);
    }
  });

  it("matches the mission blog: the hollow and ridge drill sites are about 10 m apart, the ridge higher", () => {
    const hollow = BOXWORK_STOPS.find((s) => s.id === "valle-de-la-luna")!;
    const ridge = BOXWORK_STOPS.find((s) => s.id === "nevado-sajama")!;
    const [a, b] = toLocalMetres([bySol(hollow.sol), bySol(ridge.sol)], bySol(hollow.sol));
    expect(Math.hypot(b!.x - a!.x, b!.z - a!.z)).toBeGreaterThan(8);
    expect(Math.hypot(b!.x - a!.x, b!.z - a!.z)).toBeLessThan(12);
    expect(bySol(ridge.sol).elevationM).toBeGreaterThan(bySol(hollow.sol).elevationM);
  });

  it("plans a full-campaign walk at least as long as Curiosity's own drive", () => {
    const r = planBoxworkEva({ fromSol: 4530, toSol: 4711 });
    const driven = bySol(4711).odometerM - bySol(4530).odometerM;
    expect(r.odometryM).toBeCloseTo(driven, -1);
    expect(r.plan.distanceM).toBeGreaterThanOrEqual(driven - 1);
    expect(r.plan.siteId).toBe("boxwork");
    expect(r.stops.map((s) => s.id)).toEqual(BOXWORK_STOPS.map((s) => s.id));
  });

  it("is the generic rover-traverse planner applied to this campaign", () => {
    const viaGeneric = planRoverTraverseEva(BOXWORK_WAYPOINTS, BOXWORK_STOPS, { fromSol: 4641, toSol: 4711, returnToStart: true, siteId: "boxwork", siteName: "Mount Sharp boxwork (Gale)" });
    expect(planBoxworkEva({ fromSol: 4641, toSol: 4711, returnToStart: true }).plan).toEqual(viaGeneric.plan);
  });
});
