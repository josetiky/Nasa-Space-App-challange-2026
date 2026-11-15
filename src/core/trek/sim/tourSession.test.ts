import { describe, expect, it } from "vitest";
import type { LocalPoint, SimEvent, TourStop } from "../contracts";
import { twoCorridorField } from "../costmap/synthetic";
import { createSession, dispatch, tick, walkComplete, type TrekSessionState } from "./session";

const near = (a: LocalPoint, b: LocalPoint, tol = 1.5) => Math.hypot(a.x - b.x, a.z - b.z) <= tol;

const NORTH: TourStop = {
  id: "north",
  name: "Corredor norte",
  point: { x: 0, z: 36 },
  dwellMin: 10,
};
const EAST: TourStop = { id: "east", name: "Brazo este", point: { x: 43, z: 20 }, dwellMin: 5 };

function setup(stops: readonly TourStop[]) {
  const field = twoCorridorField();
  const session = createSession({
    terrain: field.terrain,
    origin: field.origin,
    goal: field.goal,
    shelters: [field.shelter],
    stops,
  });
  return { field, session };
}

function run(s: TrekSessionState, seconds: number, dt = 15, each?: (s: TrekSessionState) => void) {
  let out = s;
  for (let t = 0; t < seconds; t += dt) {
    out = tick(out, dt);
    each?.(out);
  }
  return out;
}

describe("Sesión con paradas científicas", () => {
  it("se detiene en la parada el tiempo de ciencia y después sigue al destino", () => {
    const { field, session } = setup([NORTH]);
    expect(session.routeResult.ok && session.routeResult.tour?.legs.length).toBe(2);
    const totalMin = session.routeResult.ok ? session.routeResult.tour!.totalMin : 0;
    const positionsWhileDwelling: LocalPoint[] = [];
    const end = run(session, (totalMin + 3) * 60, 15, (s) => {
      if (s.dwell) positionsWhileDwelling.push(s.position);
    });
    expect(positionsWhileDwelling.length).toBeGreaterThan(30);
    for (const p of positionsWhileDwelling) expect(near(p, NORTH.point)).toBe(true);
    expect(end.stopLog.map((e) => [e.stopId, e.status])).toEqual([["north", "done"]]);
    expect(end.stopIdx).toBe(1);
    expect(end.dwell).toBeNull();
    expect(near(end.position, field.goal)).toBe(true);
    expect(end.returning).toBe(false);
    expect(walkComplete(end)).toBe(true);
    expect(walkComplete(session)).toBe(false);
  });

  it("no da la EVA por terminada mientras se trabaja en una parada", () => {
    const { session } = setup([NORTH]);
    let s = session;
    while (!s.dwell && s.clockS < 3600) s = tick(s, 15);
    expect(s.dwell).not.toBeNull();
    expect(walkComplete(s)).toBe(false);
  });

  it("una tormenta sobre una parada pendiente la omite y la caminata sigue al destino", () => {
    const { field, session } = setup([NORTH, EAST]);
    const storm: SimEvent = {
      kind: "storm-appear",
      storm: {
        id: "s-east",
        name: "s-east",
        center: EAST.point,
        radiusM: 6,
        tau: 2.8,
        active: true,
        dataType: "SIMULATED",
      },
      simulated: true,
    };
    let s = run(session, 60);
    s = dispatch(s, storm);
    const end = run(s, 120 * 60);
    expect(end.stopLog.find((e) => e.stopId === "east")?.status).toBe("skipped");
    expect(end.stopLog.find((e) => e.stopId === "north")?.status).toBe("done");
    expect(near(end.position, field.goal)).toBe(true);
    expect(end.returning).toBe(false);
  });

  it("set-stops cambia las paradas pendientes y se replanifica", () => {
    const { session } = setup([]);
    expect(session.routeResult.ok && session.routeResult.tour).toBeUndefined();
    const s = dispatch(session, { kind: "set-stops", stops: [NORTH], simulated: false });
    expect(s.stops.map((x) => x.id)).toEqual(["north"]);
    expect(s.routeResult.ok && s.routeResult.tour?.legs[0]?.toStopId).toBe("north");
    expect(s.activeRoute?.points.some((p) => near(p, NORTH.point))).toBe(true);
  });

  it("los recursos bajan también durante la parada", () => {
    const { session } = setup([{ ...NORTH, dwellMin: 30 }]);
    let s = session;
    while (!s.dwell && s.clockS < 3600) s = tick(s, 15);
    const o2Start = s.resources.o2PrimaryPsi;
    const posStart = s.position;
    s = run(s, 20 * 60);
    expect(s.dwell).not.toBeNull();
    expect(s.resources.o2PrimaryPsi).toBeLessThan(o2Start);
    expect(near(s.position, posStart, 0.01)).toBe(true);
  });
});
