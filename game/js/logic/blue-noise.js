// @ts-check
'use strict';
/* ================= BLUE NOISE (air track AIR-4) =================
   A 64 x 64 tile of blue noise: every value 0..255 the same number of times, and neighbours as different as they can
   be (no clumps, no low frequencies). The light-in-air march starts each pixel's steps at this tile's value instead of
   a hash, so the leftover grain is fine and even and the blur after it takes it away (Ulichney's void-and-cluster,
   1993). Made once by tools/make-blue-noise.mjs into BLUE_NOISE_64 below; tools/test/blue-noise.test.mjs checks the
   table is what blueNoiseMake makes. Plain numbers, no graphics. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BLUE_NOISE_64: [() => BLUE_NOISE_64],
  // @ts-expect-error -- replaced on purpose
  blueNoiseMake: [() => blueNoiseMake, v => (blueNoiseMake = v)],
  // @ts-expect-error -- replaced on purpose
  blueNoiseRandom: [() => blueNoiseRandom, v => (blueNoiseRandom = v)],
  // @ts-expect-error -- replaced on purpose
  blueNoiseTable: [() => blueNoiseTable, v => (blueNoiseTable = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* a small seeded random number maker (mulberry32): the same seed, the same tile */
export function blueNoiseRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* void-and-cluster on an n x n tile that wraps round: each pixel's rank (0..n*n-1), as values 0..255 */
export function blueNoiseMake(n = 64, seed = 1, sigma = 1.9) {
  const N = n * n,
    K = new Float64Array(N);
  /* the Gaussian round a pixel, on the wrapped tile */
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = Math.min(x, n - x),
        dy = Math.min(y, n - y);
      K[y * n + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  /* add (s 1) or take away (s -1) pixel q's Gaussian from the energy E */
  const splat = (E, q, s) => {
    const qx = q % n,
      qy = (q / n) | 0;
    for (let y = 0; y < n; y++) {
      const ky = ((y - qy + n) % n) * n,
        row = y * n;
      for (let x = 0; x < n; x++) E[row + x] += s * K[ky + ((x - qx + n) % n)];
    }
  };
  /* the tightest cluster: the set pixel with the most energy; the largest void: the empty one with the least */
  const pick = (E, B, want, most) => {
    let best = -1,
      bv = most ? -Infinity : Infinity;
    for (let i = 0; i < N; i++)
      if (B[i] === want && (most ? E[i] > bv : E[i] < bv)) {
        bv = E[i];
        best = i;
      }
    return best;
  };
  const rnd = blueNoiseRandom(seed),
    B0 = new Uint8Array(N),
    E0 = new Float64Array(N);
  /* a random start of about a tenth of the pixels, then evened out: the tightest cluster moved to the largest void
     until that is where it came from */
  const ones = Math.max(1, Math.round(N / 10));
  for (let c = 0; c < ones;) {
    const i = Math.floor(rnd() * N);
    if (!B0[i]) {
      B0[i] = 1;
      splat(E0, i, 1);
      c++;
    }
  }
  for (;;) {
    const c = pick(E0, B0, 1, true);
    B0[c] = 0;
    splat(E0, c, -1);
    const v = pick(E0, B0, 0, false);
    if (v === c) {
      B0[c] = 1;
      splat(E0, c, 1);
      break;
    }
    B0[v] = 1;
    splat(E0, v, 1);
  }
  const R = new Int32Array(N);
  /* phase 1: the start's pixels ranked from the top down, tightest cluster first out */
  {
    const B = B0.slice(),
      E = E0.slice();
    for (let r = ones - 1; r >= 0; r--) {
      const c = pick(E, B, 1, true);
      B[c] = 0;
      splat(E, c, -1);
      R[c] = r;
    }
  }
  /* phase 2: up to half, each new pixel into the largest void */
  const B = B0.slice(),
    E = E0.slice();
  let r = ones;
  for (; r < N / 2; r++) {
    const v = pick(E, B, 0, false);
    B[v] = 1;
    splat(E, v, 1);
    R[v] = r;
  }
  /* phase 3: past half the empty pixels are the few, so the tightest cluster of empty ones is filled next */
  const Z = new Float64Array(N);
  for (let i = 0; i < N; i++) if (!B[i]) splat(Z, i, 1);
  for (; r < N; r++) {
    const c = pick(Z, B, 0, true);
    B[c] = 1;
    splat(Z, c, -1);
    R[c] = r;
  }
  const out = new Uint8Array(N);
  for (let i = 0; i < N; i++) out[i] = Math.floor((R[i] * 256) / N);
  return out;
}

/* the tile the game uses (64 x 64, seed 1, made by tools/make-blue-noise.mjs), base64 */
export const BLUE_NOISE_64 =
  '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';

/* the tile as 4096 values 0..255, row by row */
export function blueNoiseTable() {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    s = BLUE_NOISE_64.replace(/=+$/, ''),
    t = new Uint8Array(Math.floor((s.length * 3) / 4));
  /* base64 by hand: the logic runs in plain Node too, with no atob */
  let bits = 0,
    nb = 0,
    k = 0;
  for (let i = 0; i < s.length; i++) {
    bits = (bits << 6) | A.indexOf(s[i]);
    nb += 6;
    if (nb >= 8) {
      nb -= 8;
      t[k++] = (bits >> nb) & 255;
    }
  }
  return t;
}
