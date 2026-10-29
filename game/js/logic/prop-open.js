// @ts-check
'use strict';
/* ================= OPENING PROPS (intro track IN-3) =================
   A prop with opens ({ ms, frames: [{ img, ox, oy }] }, smallest first; its own picture is the last, full one) plays
   its frames when a placement gets open: the walk view's clock (walkView.t) when it starts. From its first frame to its
   own picture over ms (the Bureau's portal: a line pulled open into a square, a filing drawer). A placement's shut (the
   same clock) plays them backwards and then hides it. With reduced motion it is just there, or just gone. Logic only:
   no DOM, runs in Node (tools/test/prop-open.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  openingFrame: [() => openingFrame, v => (openingFrame = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * The picture a placement of an opening prop draws now: -1 its own (full) picture, a frame's index, or null: none
 * (shut).
 * @param {{ ms?: number, frames: any[] }} O the prop's opens
 * @param {{ open?: number, shut?: number }} p the placement
 * @param {number} t the walk view's clock, ms
 * @param {boolean} [still] reduced motion: no frames
 * @returns {number | null}
 */
export function openingFrame(O, p, t, still = false) {
  const n = O.frames.length,
    ms = Math.max(1, O.ms || 1);
  if (p.shut != null) {
    const k = (t - p.shut) / ms;
    if (still || k >= 1) return k >= 0 || still ? null : -1;
    if (k < 0 || !n) return -1;
    return Math.min(n - 1, Math.floor((1 - k) * n));
  }
  if (p.open == null || still || !n) return -1;
  const k = (t - p.open) / ms;
  return k >= 1 ? -1 : Math.max(0, Math.min(n - 1, Math.floor(k * n)));
}
