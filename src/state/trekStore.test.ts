import { describe, expect, it } from "vitest";
import { twoCorridorField } from "@/core/trek/costmap/synthetic";
import { getTrekSite } from "@/services/trek/sites";
import {
  initialTrekState,
  isHumanLockActive,
  needsSiteLoad,
  trekReducer,
  type TrekStoreState,
} from "./trekStore";

function loadedSynthetic(): TrekStoreState {
  const site = getTrekSite("synthetic_two_corridors");
  const s1 = trekReducer(initialTrekState, { type: "setSiteLoading", siteId: site.id });
  return trekReducer(s1, {
    type: "setSiteLoaded",
    site,
    grid: twoCorridorField().heightGrid,
    manifest: null,
  });
}

function locked(): TrekStoreState {
  const s = trekReducer(loadedSynthetic(), {
    type: "simEvent",
    event: { kind: "health-incident", incident: "emergencia_medica", simulated: true },
  });
  expect(s.session.fsm.state).toBe("EMERGENCY");
  expect(isHumanLockActive(s)).toBe(true);
  return s;
}

describe("trekStore · site load bookkeeping", () => {
  it("needs a load at start and not after the site tile built the session", () => {
    expect(needsSiteLoad(initialTrekState)).toBe(true);
    const s = loadedSynthetic();
    expect(s.loadedSiteId).toBe("synthetic_two_corridors");
    expect(needsSiteLoad(s)).toBe(false);
    expect(needsSiteLoad(trekReducer(s, { type: "setSiteLoading", siteId: "murray_buttes" }))).toBe(
      true,
    );
  });
});

describe("trekStore · human-confirmation lock cannot be bypassed by recreating the session", () => {
  it("ignores resetSession, setMissionProfile and a site change while locked", () => {
    const s = locked();
    expect(trekReducer(s, { type: "resetSession" })).toBe(s);
    expect(trekReducer(s, { type: "setMissionProfile", profile: "solo" })).toBe(s);
    expect(trekReducer(s, { type: "setSiteLoading", siteId: "murray_buttes" })).toBe(s);
  });

  it("does not rebuild the session when a tile finishes loading while locked", () => {
    const s = locked();
    const site = getTrekSite("synthetic_two_corridors");
    const next = trekReducer(s, {
      type: "setSiteLoaded",
      site,
      grid: twoCorridorField().heightGrid,
      manifest: null,
    });
    expect(next.session).toBe(s.session);
    expect(next.session.fsm.state).toBe("EMERGENCY");
  });

  it("only a recorded human-authorize starts the descent, keeping the justification", () => {
    const s = locked();
    const next = trekReducer(s, {
      type: "simEvent",
      event: {
        kind: "human-authorize",
        by: "HAB-IV1",
        justification: "Crew stable for 10 min, secondary O2 verified",
        atShelter: false,
        simulated: true,
      },
    });
    expect(next.session.fsm.state).toBe("CRITICAL");
    const last = next.session.fsm.history.at(-1);
    expect(last?.humanConfirmed?.justification).toBe(
      "Crew stable for 10 min, secondary O2 verified",
    );
  });
});
