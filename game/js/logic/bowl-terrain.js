// @ts-check
'use strict';
/* ================= THE WORLD MAP'S GROUND, AS NUMBERS (load track, cutscenes session) =================
   The pieces of the world map's ground (world-bowl.js) that are plain numbers: a hash and a smooth noise for its
   patches, and the dither it blends regions with, and the ground's squares themselves (bowlTerrainRows). Logic only:
   no DOM, so the page and a helper thread (bowl-worker.js) share it. */
/* a hash in 0-1 for a square, and a smooth value noise (patches of ground) */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { bowlCoastAt, bowlGridHeight, bowlHeight, bowlWetAt } from './bowl.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_BAYER: [() => BOWL_BAYER],
  bowlHash: [() => bowlHash],
  // @ts-expect-error -- replaced on purpose
  bowlNoise: [() => bowlNoise, v => (bowlNoise = v)],
  // @ts-expect-error -- replaced on purpose
  bowlTerrainRows: [() => bowlTerrainRows, v => (bowlTerrainRows = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const bowlHash = (/** @type {number} */ i, /** @type {number} */ j) => {
  const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
export function bowlNoise(/** @type {number} */ x, /** @type {number} */ y) {
  const i = Math.floor(x),
    j = Math.floor(y),
    u = x - i,
    v = y - j,
    a = bowlHash(i, j),
    b = bowlHash(i + 1, j),
    c = bowlHash(i, j + 1),
    d = bowlHash(i + 1, j + 1),
    su = u * u * (3 - 2 * u),
    sv = v * v * (3 - 2 * v);
  return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
}
export const BOWL_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

/** LD-5 (cutscenes session): the world map's ground squares of rows j0 to j1 (world-bowl.js worldBowlTerrainStart's
 * fill, the same sums), each a ground kind's layer into idx (N x N). P holds what they read as plain numbers and
 * arrays, so a helper thread (bowl-worker.js) works them out as the page does
 * @param {any} P @param {number} j0 @param {number} j1 @param {Uint8Array} idx */
export function bowlTerrainRows(P, j0, j1, idx) {
  const { N, C, near, lists, S, G, slopeG, L, ox, oy, metres } = P;
  for (let j = j0; j < j1; j++)
    for (let i = P.i0; i < P.i1; i++) {
      const x = -1 + ((i + 0.5) / N) * 2,
        y = 1 - ((j + 0.5) / N) * 2,
        r = Math.hypot(x, y);
      if (r > 1.01) continue;
      /* the place this square belongs to: borders wander (a slow warp) and are dithered, so regions blend over a few
           squares in a pixel-art way, never along a straight line */
      const wx = (bowlNoise(x * 6 + 3.1, y * 6) - 0.5) * 7,
        wy = (bowlNoise(x * 6, y * 6 - 5.7) - 0.5) * 7,
        ci = Math.min(C - 1, Math.max(0, Math.floor(((x + 1) / 2) * C + wx + (bowlHash(i, j) - 0.5) * 3))),
        cj = Math.min(C - 1, Math.max(0, Math.floor(((1 - y) / 2) * C + wy + (bowlHash(j, i) - 0.5) * 3))),
        p = near[cj * C + ci],
        s = S[p],
        ls = lists[p],
        d = Math.hypot(x - s.x, y - s.y),
        rel = bowlGridHeight(G, x, y) - bowlHeight(Math.min(1, r)) /* the relief, read from the grid: cheap */,
        m = (x * metres) / 9 + ox,
        n = (y * metres) / 9 + oy,
        th = BOWL_BAYER[(j & 3) * 4 + (i & 3)],
        /* calm ground (fix 2026-10-19: it read as camouflage): mostly a list's first ground, the others in broad
             patches some 40 m across, their edges dithered over a few squares; no outline rings */
        patch = bowlNoise(m * 0.22 + p * 1.7, n * 0.22) * 0.75 + bowlNoise(m * 0.6, n * 0.6 + 9.1) * 0.25,
        pick = list =>
          list.length < 2 || patch < 0.58 + (th - 0.5) * 0.05
            ? list[0]
            : list[
                1 + Math.min(list.length - 2, Math.floor(bowlNoise(m * 0.1 + 4.4, n * 0.1 + p) * (list.length - 1)))
              ];
      let t = ls.k.length && d < 0.09 + bowlNoise(m * 0.3, n * 0.3) * 0.04 ? pick(ls.k) : pick(ls.r);
      /* away from the places' own ground: wet lowland, dry slopes, high ground, rock on the steep, snow on top */
      /* read smoothly between the grid's corners (not the nearest corner: that made blocks), changes dithered */
      const wet = G.wet ? bowlWetAt(G, x, y) : 0,
        steep = bowlGridHeight(slopeG, x, y),
        inPlace = d < 0.07,
        dz = (th - 0.5) * 0.12;
      if (!inPlace) {
        if (wet > 0.55 + dz && rel < 0.03 && ls.wet.length) t = pick(ls.wet);
        else if (wet < 0.08 + dz * 0.3 && rel > 0.014 && ls.dry.length) t = pick(ls.dry);
        if (rel > 0.048 + dz * 0.05 && ls.high.length) t = pick(ls.high);
      }
      if (steep > 1.6 + dz * 3) t = L.r ?? t;
      if (rel > 0.088 + dz * 0.05 && 'n' in L) t = L.n;
      /* the coast: a beach of dry then wet sand down to the water, and under it the sea floor (sand in the shallows,
           pebbles and rock further out, coral sand in the coral regions) */
      const cv = bowlCoastAt(G, x, y);
      if (cv > -0.012 + th * 0.004) {
        const coral = ls.r.includes(L.N);
        if (cv <= 0 && rel > 0.01) t = L.r ?? t; /* a cliff, no beach */
        else if (cv <= -0.004) t = L.s ?? t;
        else if (cv <= 0.006 + th * 0.004) t = L.S ?? t;
        else if (cv <= 0.03 + th * 0.01) t = (coral ? L.N : L.s) ?? t;
        else t = (bowlNoise(m * 0.2, n * 0.2) > 0.55 ? L.r : L.P) ?? t;
      }
      if (r > 0.985 && cv <= 0) t = L.r ?? t;
      idx[j * N + i] = t;
    }
}
