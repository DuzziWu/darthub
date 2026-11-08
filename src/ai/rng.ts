import type { Rng } from "./types";

/**
 * Small, fast, deterministic PRNG (mulberry32). Seeded RNG keeps statistical
 * tests stable without pulling in any external dependency.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Two independent standard-normal samples via Box-Muller. */
export function gaussianPair(rng: Rng): [number, number] {
  let u1 = rng();
  while (u1 <= 0) {
    u1 = rng();
  }
  const u2 = rng();
  const radius = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;
  return [radius * Math.cos(theta), radius * Math.sin(theta)];
}
