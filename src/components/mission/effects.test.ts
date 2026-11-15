import { describe, expect, it } from "vitest";
import { createInitialState } from "@/core/sim/engine";
import { makePlan } from "@/core/sim/fixtures";
import { activeProtocols, effectChips } from "./effects";

describe("effect chips", () => {
  it("describes resource, system and crew deltas with their direction", () => {
    const chips = effectChips({ resources: { oxygenKg: -12.5, spareParts: -1 }, systems: { power: 20 }, crew: { morale: -5 }, science: 3 });
    expect(chips).toEqual([
      { text: "O₂ −12.5 kg", good: false },
      { text: "Spares −1", good: false },
      { text: "Power +20", good: true },
      { text: "Morale −5", good: false },
      { text: "Science +3.0", good: true },
    ]);
    expect(effectChips(undefined)).toEqual([]);
  });
});

describe("protocol monitor", () => {
  it("is quiet for a healthy, well-supplied mission", () => {
    expect(activeProtocols(createInitialState(makePlan()))).toEqual([]);
  });

  it("triggers O₂, thermal, dust and system protocols from the state", () => {
    const s = createInitialState(makePlan());
    const stressed = { ...s, resources: { ...s.resources, oxygenKg: 6 }, habitatTempC: -3, env: { ...s.env, tau: 3.4 }, systems: { ...s.systems, isru: 15 } };
    const ids = activeProtocols(stressed).map((a) => `${a.id}:${a.level}`);
    expect(ids).toEqual(expect.arrayContaining(["o2:danger", "thermal:danger", "dust:caution", "sys-isru:danger"]));
  });
});
