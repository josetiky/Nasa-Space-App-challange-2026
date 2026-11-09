/**
 * EVA walk timeline for the helmet HUD: the same accounting as computeEvaPlan
 * (3-D step length, Tobler speed by slope and direction, metabolic O₂, 20-minute
 * science stops at points of interest), expressed as keyframes in mission time.
 */
import { EVA } from "./constants";
import { metabolicRateW, oxygenForWork, walkingSpeedKmh } from "./eva";

type Point = { x: number; y: number; z: number };
type Waypoint = Point & { id: string; poiId?: string };

export interface WalkFrame {
  /** Mission minutes since the start of the EVA. */
  minutes: number;
  distanceM: number;
  /** Suit O₂ consumed by the whole crew (kg). */
  o2Kg: number;
  position: [number, number, number];
  /** Slope of the step that ends at this frame (deg). */
  slopeDeg: number;
  /** When set, the crew is stopped here (science stop) until the next frame. */
  stop: string | null;
  /** Index of the waypoint the crew is heading to. */
  target: number;
}

export interface WalkTimeline {
  frames: WalkFrame[];
  totalMinutes: number;
  totalDistanceM: number;
  labels: string[];
  /** Cumulative distance at which each waypoint is reached. */
  waypointDistanceM: number[];
}

export function buildWalkTimeline(segmentSamples: Point[][], waypoints: Waypoint[], pois: Array<{ id: string; title: string }>, crew: number): WalkTimeline {
  const titles = new Map(pois.map((p) => [p.id, p.title]));
  const labels = waypoints.map((w, i) => (w.poiId && titles.get(w.poiId)) || `Waypoint ${i + 1}`);
  const frames: WalkFrame[] = [];
  const waypointDistanceM = waypoints.map(() => 0);
  let minutes = 0;
  let distance = 0;
  let o2 = 0;
  const first = segmentSamples[0]?.[0] ?? waypoints[0] ?? { x: 0, y: 0, z: 0 };
  let position: [number, number, number] = [first.x, first.y, first.z];

  const stopAt = (index: number) => {
    const poiId = waypoints[index]?.poiId;
    const title = poiId ? titles.get(poiId) : undefined;
    if (!title) return;
    frames.push({ minutes, distanceM: distance, o2Kg: o2, position, slopeDeg: 0, stop: title, target: Math.min(index + 1, waypoints.length - 1) });
    minutes += EVA.stopMinutes;
    o2 += oxygenForWork(EVA.metabolicBaseW, EVA.stopMinutes) * crew;
  };

  frames.push({ minutes, distanceM: distance, o2Kg: o2, position, slopeDeg: 0, stop: null, target: Math.min(1, waypoints.length - 1) });
  stopAt(0);
  segmentSamples.forEach((samples, index) => {
    if (!waypoints[index] || !waypoints[index + 1] || samples.length < 2) return;
    if (frames[frames.length - 1]!.stop) frames.push({ minutes, distanceM: distance, o2Kg: o2, position, slopeDeg: 0, stop: null, target: index + 1 });
    for (let i = 1; i < samples.length; i += 1) {
      const a = samples[i - 1]!;
      const b = samples[i]!;
      const horizontal = Math.hypot(b.x - a.x, b.z - a.z);
      if (horizontal < 1e-6) continue;
      const dy = b.y - a.y;
      const slope = (Math.atan2(Math.abs(dy), horizontal) * 180) / Math.PI;
      const length = Math.hypot(horizontal, dy);
      const stepMinutes = (length / 1000 / walkingSpeedKmh(slope, dy > 0)) * 60;
      minutes += stepMinutes;
      distance += length;
      o2 += oxygenForWork(metabolicRateW(slope), stepMinutes) * crew;
      position = [b.x, b.y, b.z];
      frames.push({ minutes, distanceM: distance, o2Kg: o2, position, slopeDeg: slope, stop: null, target: index + 1 });
    }
    waypointDistanceM[index + 1] = distance;
    stopAt(index + 1);
  });
  if (frames[frames.length - 1]!.stop) frames.push({ minutes, distanceM: distance, o2Kg: o2, position, slopeDeg: 0, stop: null, target: waypoints.length - 1 });
  return { frames, totalMinutes: minutes, totalDistanceM: distance, labels, waypointDistanceM };
}

export interface WalkState {
  minutes: number;
  position: [number, number, number];
  distanceM: number;
  o2Kg: number;
  slopeDeg: number;
  stop: string | null;
  done: boolean;
  target: number;
  nextLabel: string;
  toNextM: number;
}

/** State of the walk at mission minute `t` (linear interpolation between keyframes). */
export function sampleWalk(timeline: WalkTimeline, t: number): WalkState {
  const { frames } = timeline;
  const last = frames[frames.length - 1]!;
  const make = (a: WalkFrame, b: WalkFrame, alpha: number, done: boolean): WalkState => {
    const lerp = (x: number, y: number) => x + (y - x) * alpha;
    const distanceM = lerp(a.distanceM, b.distanceM);
    const target = done ? last.target : b.target;
    return {
      minutes: done ? timeline.totalMinutes : lerp(a.minutes, b.minutes),
      position: [lerp(a.position[0], b.position[0]), lerp(a.position[1], b.position[1]), lerp(a.position[2], b.position[2])],
      distanceM,
      o2Kg: lerp(a.o2Kg, b.o2Kg),
      slopeDeg: a.stop ? 0 : b.slopeDeg,
      stop: done ? null : a.stop,
      done,
      target,
      nextLabel: timeline.labels[target] ?? "",
      toNextM: Math.max(0, (timeline.waypointDistanceM[target] ?? timeline.totalDistanceM) - distanceM),
    };
  };
  if (frames.length < 2 || t >= timeline.totalMinutes) return make(last, last, 0, frames.length >= 2 || t > 0);
  if (t <= 0) return make(frames[0]!, frames[1]!, 0, false);
  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid]!.minutes <= t) lo = mid;
    else hi = mid;
  }
  const a = frames[lo]!;
  const b = frames[hi]!;
  const span = b.minutes - a.minutes;
  return make(a, b, span > 0 ? (t - a.minutes) / span : 0, false);
}
