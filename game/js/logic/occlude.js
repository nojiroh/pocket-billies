// @ts-check
'use strict';
/* ================= COVER (player visibility) =================
   Whether a tall picture standing nearer the camera covers the player on screen, so it can thin out. Logic only:
   screen points are passed in, runs in Node (tools/test/occlude.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  pictureCovers: [() => pictureCovers, v => (pictureCovers = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * Does a picture standing at screen point `q` (its foot; `q.d` its depth, `q.s` pixels a metre) cover the screen
 * point `me` (the player's middle; `me.d` its depth)? `halfW` and `hM` are the picture's half width and height in
 * metres. It counts only when the picture's foot is clearly nearer the camera than the player.
 * @param {{ x: number, y: number, d: number }} me
 * @param {{ x: number, y: number, d: number, s: number }} q
 * @param {number} halfW
 * @param {number} hM
 */
export function pictureCovers(me, q, halfW, hM) {
  if (!(q.d < me.d - 0.3)) return false;
  const half = halfW * q.s,
    top = q.y - hM * q.s;
  return me.x > q.x - half && me.x < q.x + half && me.y > top && me.y < q.y;
}
