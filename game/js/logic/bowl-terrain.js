// @ts-check
'use strict';
/* ================= THE WORLD MAP'S GROUND, AS NUMBERS (load track, cutscenes session) =================
   The pieces of the world map's ground (world-bowl.js) that are plain numbers: a hash and a smooth noise for its
   patches, and the dither it blends regions with. Logic only: no DOM, so the page and a helper thread share it. */
/* a hash in 0-1 for a square, and a smooth value noise (patches of ground) */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_BAYER: [() => BOWL_BAYER],
  bowlHash: [() => bowlHash],
  // @ts-expect-error -- replaced on purpose
  bowlNoise: [() => bowlNoise, v => (bowlNoise = v)],
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
