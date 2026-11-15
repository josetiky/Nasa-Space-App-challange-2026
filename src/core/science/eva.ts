import type { EvaPlan, EvaSegment, EvaWaypoint } from "../types";
import { EVA } from "./constants";

/**
 * Suited traverse model (MODELLED, assumptions in constants.ts → EVA).
 * Speed vs grade uses a Tobler-type hiking function normalised so flat ground
 * equals the base speed; metabolic O₂ uses the energy equivalent of oxygen.
 */
export function walkingSpeedKmh(slopeDeg: number, uphill: boolean): number {
  const grade = Math.tan((Math.abs(slopeDeg) * Math.PI) / 180) * (uphill ? 1 : -1);
  const tobler = Math.exp(-3.5 * Math.abs(grade + 0.05));
  const flat = Math.exp(-3.5 * 0.05);
  return Math.max(0.3, EVA.baseSpeedKmh * (tobler / flat));
}

export function metabolicRateW(slopeDeg: number): number {
  return EVA.metabolicBaseW + EVA.metabolicPerSlopeDegW * Math.abs(slopeDeg);
}

/** O₂ (kg) consumed by one astronaut working at `watts` for `minutes`. */
export function oxygenForWork(watts: number, minutes: number): number {
  const kj = (watts * minutes * 60) / 1000;
  return kj / EVA.kjPerKgO2;
}

export interface EvaRouteInput {
  siteId: string;
  siteName: string;
  waypoints: EvaWaypoint[];
  /** Dense terrain-following polyline per segment (metres, y up), including both ends. */
  segmentSamples: Array<Array<{ x: number; y: number; z: number }>>;
  /** POI ids reached by the route and their science weight (0..1). */
  pois: Array<{ id: string; title: string; weight: number }>;
  crew?: number;
  /**
   * Optional path-length multiplier per segment (default 1): the walk follows a longer, winding path
   * than the sampled geometry (e.g. measured rover odometry ÷ straight leg). Length, time and O₂ scale;
   * the grade stays that of the sampled geometry, which is the steeper, conservative choice.
   */
  segmentLengthFactors?: number[];
  /** Report per-segment slope hazards (default true); callers with better segment names can word their own. */
  slopeHazards?: boolean;
}

export function computeEvaPlan(input: EvaRouteInput): EvaPlan {
  const crew = Math.max(1, input.crew ?? 2);
  const segments: EvaSegment[] = [];
  const profile: EvaPlan["profile"] = [];
  let total = 0;
  let gain = 0;
  let maxSlope = 0;
  let slopeWeighted = 0;
  let walkMinutes = 0;
  let o2 = 0;
  const hazards = new Set<string>();

  input.segmentSamples.forEach((samples, index) => {
    const from = input.waypoints[index];
    const to = input.waypoints[index + 1];
    if (!from || !to || samples.length < 2) return;
    let segDistance = 0;
    let segClimb = 0;
    let segMax = 0;
    let segMinutes = 0;
    const factor = Math.max(1, input.segmentLengthFactors?.[index] ?? 1);
    for (let i = 1; i < samples.length; i += 1) {
      const a = samples[i - 1]!;
      const b = samples[i]!;
      const horizontal = Math.hypot(b.x - a.x, b.z - a.z);
      if (horizontal < 1e-6) continue;
      const dy = b.y - a.y;
      const slope = (Math.atan2(Math.abs(dy), horizontal) * 180) / Math.PI;
      const length = Math.hypot(horizontal, dy) * factor;
      const minutes = (length / 1000 / walkingSpeedKmh(slope, dy > 0)) * 60;
      segDistance += length;
      segClimb += Math.max(0, dy);
      segMax = Math.max(segMax, slope);
      segMinutes += minutes;
      slopeWeighted += slope * length;
      o2 += oxygenForWork(metabolicRateW(slope), minutes) * crew;
      profile.push({ distanceM: total + segDistance, elevationM: b.y, slopeDeg: slope });
      if (input.slopeHazards === false) continue;
      if (slope >= EVA.noGoSlopeDeg) hazards.add(`Segment ${index + 1}: slope ${slope.toFixed(0)}° exceeds the ${EVA.noGoSlopeDeg}° no-go threshold`);
      else if (slope >= EVA.cautionSlopeDeg) hazards.add(`Segment ${index + 1}: slope ${slope.toFixed(0)}° above the ${EVA.cautionSlopeDeg}° caution threshold`);
    }
    if (index === 0) profile.unshift({ distanceM: 0, elevationM: samples[0]!.y, slopeDeg: 0 });
    segments.push({ fromId: from.id, toId: to.id, distanceM: segDistance, climbM: segClimb, maxSlopeDeg: segMax, minutes: segMinutes });
    total += segDistance;
    gain += segClimb;
    maxSlope = Math.max(maxSlope, segMax);
    walkMinutes += segMinutes;
  });

  const stopMinutes = input.pois.length * EVA.stopMinutes;
  o2 += oxygenForWork(EVA.metabolicBaseW, stopMinutes) * crew;
  const duration = walkMinutes + stopMinutes;
  if (duration > 7 * 60) hazards.add(`Planned EVA lasts ${(duration / 60).toFixed(1)} h — beyond a typical 7 h suit sortie (ASSUMPTION)`);
  if (total > 0 && input.waypoints.length > 1) {
    const last = input.waypoints[input.waypoints.length - 1]!;
    const first = input.waypoints[0]!;
    const straightBack = Math.hypot(last.x - first.x, last.z - first.z);
    if (straightBack > 800) hazards.add(`Route ends ${(straightBack / 1000).toFixed(2)} km from the start — plan the return leg`);
  }

  const science = Math.min(1, input.pois.reduce((sum, poi) => sum + poi.weight, 0) / 3);
  return {
    siteId: input.siteId,
    siteName: input.siteName,
    waypoints: input.waypoints,
    segments,
    profile,
    distanceM: total,
    elevationGainM: gain,
    maxSlopeDeg: maxSlope,
    meanSlopeDeg: total > 0 ? slopeWeighted / total : 0,
    durationMin: duration,
    o2Kg: o2,
    hazards: [...hazards],
    poisVisited: input.pois.map((poi) => poi.title),
    scienceValue: science,
  };
}
