import type { EvaPlan, EvaWaypoint } from "../types";
import { EVA } from "./constants";
import { computeEvaPlan } from "./eva";

/**
 * EVA planning along a rover's real traverse (e.g. Curiosity's 2025 boxwork campaign).
 *
 * REAL inputs: end-of-drive positions, elevations, IMU tilt and odometry published by NASA/JPL MMGIS.
 * The walk follows the rover's proven path stop to stop. Each leg is as long as the rover's measured
 * drive when that was longer than the straight line between stops (detours around ridges), and keeps
 * the straight-line grade (the steeper, conservative value). Time and O₂ use the documented EVA model.
 */

/** Sphere radius NASA/JPL MMGIS uses for MSL easting/northing (IAU 2000 Mars equatorial radius, metres). */
export const MMGIS_SPHERE_RADIUS_M = 3_396_190;

const DEG = Math.PI / 180;

export interface RoverWaypoint {
  sol: number;
  site: number;
  drive: number;
  lat: number;
  lon: number;
  /** Elevation above the areoid (m), as published with the waypoint. */
  elevationM: number;
  /** Rover tilt at the end of the drive (deg, from pitch and roll): the ground slope under the wheelbase. */
  tiltDeg: number;
  /** Distance driven to reach this waypoint from the previous one (m). */
  driveM: number;
  /** Mission odometer at this waypoint (m). */
  odometerM: number;
}

export interface TraverseStop {
  id: string;
  sol: number;
  title: string;
  kind: "context" | "outcrop" | "hollow" | "ridge" | "drill";
  /** Science weight used by the EVA plan (MODEL ASSUMPTION, 0..1). */
  weight: number;
  text: string;
  source: { label: string; url: string };
  alsoSee?: Array<{ label: string; url: string }>;
  /** Rover images of the stop (NASA Image and Video Library assets). */
  images?: Array<{ src: string; caption: string; href: string }>;
}

/** Local metres around `origin` on the MMGIS sphere: x east, z south (north is −z), y = elevation. */
export function toLocalMetres(points: Array<{ lat: number; lon: number; elevationM: number }>, origin: { lat: number; lon: number }): Array<{ x: number; y: number; z: number }> {
  const metresPerDeg = MMGIS_SPHERE_RADIUS_M * DEG;
  const cosLat = Math.cos(origin.lat * DEG);
  return points.map((p) => ({ x: (p.lon - origin.lon) * metresPerDeg * cosLat, y: p.elevationM, z: (origin.lat - p.lat) * metresPerDeg }));
}

export interface RoverEvaOptions {
  fromSol: number;
  toSol: number;
  /** Walk back to the start along the same path. */
  returnToStart?: boolean;
  crew?: number;
  siteId?: string;
  siteName?: string;
}

export interface RoverEvaResult {
  plan: EvaPlan;
  /** Rover waypoints walked on the way out, in walking order. */
  outbound: RoverWaypoint[];
  /** Sum of straight 3D legs between the outbound stops (m). */
  straightM: number;
  /** Distance Curiosity actually drove over the same outbound span (m). */
  odometryM: number;
  maxTiltDeg: number;
  /** Outbound stops where the rover's measured tilt reached the suited-walking caution threshold. */
  steepStops: RoverWaypoint[];
  /** Science stops reached on the way out. */
  stops: TraverseStop[];
}

function indexOfSol(all: RoverWaypoint[], sol: number): number {
  const index = all.findIndex((w) => w.sol === sol);
  if (index < 0) throw new Error(`Unknown sol ${sol} on this traverse`);
  return index;
}

const length3d = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

export function planRoverTraverseEva(all: RoverWaypoint[], stops: TraverseStop[], opts: RoverEvaOptions): RoverEvaResult {
  const i0 = indexOfSol(all, opts.fromSol);
  const i1 = indexOfSol(all, opts.toSol);
  const order = i0 <= i1 ? Array.from({ length: i1 - i0 + 1 }, (_, k) => i0 + k) : Array.from({ length: i0 - i1 + 1 }, (_, k) => i0 - k);
  const outbound = order.map((i) => all[i]!);
  // A leg between two consecutive waypoints was driven by the later drive in time.
  const legOdometry = order.slice(1).map((i, k) => all[Math.max(i, order[k]!)]!.driveM);

  const local = toLocalMetres(outbound, outbound[0]!);
  const stopBySol = new Map(stops.map((s) => [s.sol, s]));
  const outWaypoints: EvaWaypoint[] = outbound.map((w, k) => {
    const stop = stopBySol.get(w.sol);
    return { id: `sol-${w.sol}`, ...local[k]!, ...(stop ? { poiId: stop.id } : {}) };
  });

  const legsOut = outWaypoints.slice(1).map((b, k) => length3d(outWaypoints[k]!, b));
  const factorsOut = legsOut.map((len, k) => (len > 1e-6 ? legOdometry[k]! / len : 1));

  let waypoints = outWaypoints;
  let factors = factorsOut;
  if (opts.returnToStart && outWaypoints.length > 1) {
    const back = outWaypoints.slice(0, -1).reverse().map((w) => ({ id: `${w.id}-return`, x: w.x, y: w.y, z: w.z }));
    waypoints = [...outWaypoints, ...back];
    factors = [...factorsOut, ...[...factorsOut].reverse()];
  }

  const visited = outbound.map((w) => stopBySol.get(w.sol)).filter((s): s is TraverseStop => !!s);
  const base = computeEvaPlan({
    siteId: opts.siteId ?? "rover-traverse",
    siteName: opts.siteName ?? "Rover traverse",
    waypoints,
    segmentSamples: waypoints.slice(1).map((b, k) => [waypoints[k]!, b]),
    pois: visited.map((s) => ({ id: s.id, title: s.title, weight: s.weight })),
    crew: opts.crew ?? 2,
    segmentLengthFactors: factors,
    slopeHazards: false,
  });

  // Mean grade of each outbound leg from the rover's elevations (a return walk crosses the same legs).
  // Short legs exaggerate small elevation errors, so the wording says where the number comes from.
  const legHazards: string[] = [];
  outWaypoints.slice(1).forEach((b, k) => {
    const a = outWaypoints[k]!;
    const horizontal = Math.hypot(b.x - a.x, b.z - a.z);
    if (horizontal < 1e-6) return;
    const grade = (Math.atan2(Math.abs(b.y - a.y), horizontal) * 180) / Math.PI;
    if (grade < EVA.cautionSlopeDeg) return;
    const leg = `Leg sol ${outbound[k]!.sol} → sol ${outbound[k + 1]!.sol}: mean grade ${grade.toFixed(0)}° from rover elevations over ${horizontal.toFixed(0)} m`;
    legHazards.push(grade >= EVA.noGoSlopeDeg ? `${leg} — at or beyond the ${EVA.noGoSlopeDeg}° no-go threshold` : `${leg} — above the ${EVA.cautionSlopeDeg}° caution threshold`);
  });

  const steepStops = outbound.filter((w) => w.tiltDeg >= EVA.cautionSlopeDeg);
  const tiltHazards = steepStops.map((w) =>
    w.tiltDeg >= EVA.noGoSlopeDeg
      ? `Stop at sol ${w.sol}: Curiosity measured ${w.tiltDeg.toFixed(1)}° of tilt, beyond the ${EVA.noGoSlopeDeg}° no-go threshold for suited walking`
      : `Stop at sol ${w.sol}: Curiosity measured ${w.tiltDeg.toFixed(1)}° of tilt, above the ${EVA.cautionSlopeDeg}° caution threshold for suited walking`,
  );

  return {
    plan: { ...base, hazards: [...legHazards, ...tiltHazards, ...base.hazards] },
    outbound,
    straightM: legsOut.reduce((sum, len) => sum + len, 0),
    odometryM: legOdometry.reduce((sum, d) => sum + d, 0),
    maxTiltDeg: Math.max(...outbound.map((w) => w.tiltDeg)),
    steepStops,
    stops: visited,
  };
}
