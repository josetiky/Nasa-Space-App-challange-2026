/**
 * Deterministic pseudo-random numbers.
 *
 * mulberry32 is the same generator used by the original Sol-by-Sol simulator
 * (public/sol-simulator/app.js), so seeds behave comparably across both tools.
 * `streamRng` derives an independent stream from (seed, sol, channel) so that
 * every alternative evaluated by the decision engine sees the same future
 * environment ("common random numbers").
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit FNV-1a style hash of a list of integers/strings. */
export function hashSeed(...parts: Array<number | string>): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x2f;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function streamRng(seed: number, sol: number, channel: string): Rng {
  return mulberry32(hashSeed(seed, sol, channel));
}

/** Uniform draw in [min, max). */
export function uniform(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function pickWeighted<T>(rng: Rng, items: ReadonlyArray<{ item: T; weight: number }>): T | null {
  const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return null;
  let threshold = rng() * total;
  for (const entry of items) {
    threshold -= Math.max(0, entry.weight);
    if (threshold <= 0) return entry.item;
  }
  return items[items.length - 1]?.item ?? null;
}
