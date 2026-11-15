import { describe, expect, it } from "vitest";
import type { LocalPoint, SimEvent } from "../contracts";
import { twoCorridorField } from "../costmap/synthetic";
import { advanceAlongRoute, createSession, dispatch, tick, type TrekSessionState } from "./session";

const dist = (a: LocalPoint, b: LocalPoint) => Math.hypot(a.x - b.x, a.z - b.z);

function stormAt(center: LocalPoint, id: string, radiusM = 8): SimEvent {
  return {
    kind: "storm-appear",
    storm: { id, name: id, center, radiusM, tau: 2.8, active: true, dataType: "SIMULATED" },
    simulated: true,
  };
}

function setup() {
  const field = twoCorridorField();
  const session = createSession({
    terrain: field.terrain,
    origin: field.origin,
    goal: field.goal,
    shelters: [field.shelter],
  });
  return { field, session };
}

function walk(s: TrekSessionState, seconds: number, dt = 15): TrekSessionState {
  let out = s;
  for (let t = 0; t < seconds; t += dt) out = tick(out, dt);
  return out;
}

describe("Caminata con posición real y regreso al punto de partida", () => {
  it("advanceAlongRoute interpola la posición y devuelve el tramo restante", () => {
    const { session } = setup();
    const r = session.activeRoute!;
    const half = advanceAlongRoute(r, r.durationMin / 2);
    expect(half.walkedM).toBeGreaterThan(0);
    expect(half.walkedM).toBeLessThan(r.distanceM);
    expect(half.remaining[0]).toEqual(half.position);
    const end = advanceAlongRoute(r, r.durationMin * 2);
    expect(dist(end.position, r.points[r.points.length - 1]!)).toBeLessThan(1e-6);
  });

  it("el astronauta avanza y la ruta activa empieza donde va", () => {
    const { field, session } = setup();
    const s = walk(session, 120);
    expect(s.walkedM).toBeGreaterThan(5);
    expect(dist(s.position, field.origin)).toBeGreaterThan(5);
    expect(s.trail.length).toBeGreaterThan(1);
    expect(s.activeRoute).not.toBeNull();
    expect(dist(s.activeRoute!.points[0]!, s.position)).toBeLessThan(1.5);
    expect(s.returning).toBe(false);
  });

  it("si el destino se vuelve inadmisible a mitad de camino, regresa al punto de partida en vez de abortar", () => {
    const { field, session } = setup();
    let s = walk(session, 120);
    s = dispatch(s, stormAt(field.goal, "storm-on-goal", 10));
    expect(s.returning).toBe(true);
    expect(s.activeRoute).not.toBeNull();
    const end = s.activeRoute!.points[s.activeRoute!.points.length - 1]!;
    expect(dist(end, field.origin)).toBeLessThan(2);
    expect(s.replanLog[s.replanLog.length - 1]!.summary).toMatch(/regreso/i);

    // Sigue caminando de regreso hasta llegar a la base
    s = walk(s, 60 * 60);
    expect(dist(s.position, field.origin)).toBeLessThan(2);
    expect(s.returning).toBe(true);
  });

  it("antes de salir no hay regreso: la ruta inadmisible se informa como antes", () => {
    const { field, session } = setup();
    const s = dispatch(session, stormAt(field.goal, "storm-on-goal", 10));
    expect(s.returning).toBe(false);
    expect(s.routeResult.ok).toBe(false);
  });

  it("'Calcular con A*' (request-replan) vuelve a intentar el destino cuando ya es admisible", () => {
    const { field, session } = setup();
    let s = walk(session, 120);
    s = dispatch(s, stormAt(field.goal, "storm-on-goal", 10));
    expect(s.returning).toBe(true);
    s = dispatch(s, { kind: "storm-clear", stormId: "storm-on-goal", simulated: true });
    s = dispatch(s, { kind: "request-replan", simulated: false });
    expect(s.returning).toBe(false);
    expect(s.routeResult.ok).toBe(true);
    const end = s.activeRoute!.points[s.activeRoute!.points.length - 1]!;
    expect(dist(end, field.goal)).toBeLessThan(2);
  });

  it("si la tormenta cubre al astronauta, regresa por el camino ya recorrido", () => {
    const { field, session } = setup();
    // A mitad de la ruta
    let s = walk(session, Math.round((session.activeRoute!.durationMin * 60) / 2 / 15) * 15);
    const here = s.position;
    expect(dist(here, field.origin)).toBeGreaterThan(5);
    expect(dist(here, field.goal)).toBeGreaterThan(5);
    s = dispatch(s, [stormAt(here, "storm-on-me", 20), stormAt(field.goal, "storm-on-goal", 10)]);
    expect(s.returning).toBe(true);
    expect(s.activeRoute).not.toBeNull();
    const end = s.activeRoute!.points[s.activeRoute!.points.length - 1]!;
    expect(dist(end, field.origin)).toBeLessThan(2);

    // Y de verdad llega a la base sin quedarse yendo y viniendo
    const startDist = dist(s.position, field.origin);
    s = walk(s, 60);
    expect(dist(s.position, field.origin)).toBeLessThan(startDist);
    s = walk(s, 60 * 60);
    expect(dist(s.position, field.origin)).toBeLessThan(2);
  });
});
