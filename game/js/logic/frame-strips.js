// @ts-check
'use strict';
/* ================= FRAME STRIPS (Studio art track SA-2a) =================
   Which pictures are animations: a row of frames side by side, each the picture's full height, played left to right.
   No picture carries its own layout beside it; the frames are where the game reads them:
     the walk effects (art/scene/fx/<kind>.png): walk-view.js EFFECT_FRAMES, [frame width, height, frames]
     the animals and cars (art/scene/life/*.png): the data's scenery.life rows, { img, w, h, frames }
   (art/scene/fx.json misses four of the effects; the game never reads it.)
   The Studio's strip player (studio/js/strip-player.js) and the Art browser use this.
   Logic only: no DOM, runs in Node (tools/test/frame-strips.test.mjs). Every table comes in as an argument. */
/** @typedef {{ w: number, h: number, n: number, from: string, name?: string, where?: string }} Strip */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  stripFrameAt: [() => stripFrameAt, v => (stripFrameAt = v)],
  // @ts-expect-error -- replaced on purpose
  stripOf: [() => stripOf, v => (stripOf = v)],
  // @ts-expect-error -- replaced on purpose
  stripProblem: [() => stripProblem, v => (stripProblem = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a picture's frames, or null when it isn't a strip the game animates
 * @param {string} path under art/ (scene/fx/bee.png), or with art/ in front (the file list's)
 * @param {{ effects?: Record<string, number[]>, life?: Record<string, { img?: string, w?: number, h?: number, frames?: number, name?: string, where?: string }> }} tables
 * @returns {Strip | null} */
export function stripOf(path, tables) {
  const p = String(path || '').replace(/^art\//, '');
  const fx = /^scene\/fx\/([\w-]+)\.png$/.exec(p),
    E = fx && tables.effects && tables.effects[fx[1]];
  if (E && E[2] > 1) return { w: E[0], h: E[1], n: E[2], from: 'effects' };
  for (const [id, r] of Object.entries(tables.life || {}))
    if (r && r.img === p && (r.frames || 0) > 1 && r.w && r.h)
      return { w: r.w, h: r.h, n: /** @type {number} */ (r.frames), from: 'life', name: r.name || id, where: r.where };
  return null;
}

/** the frame shown at time t (seconds) at fps frames a second
 * @param {number} t @param {number} fps @param {number} n */
export function stripFrameAt(t, fps, n) {
  if (!(n > 1) || !(fps > 0) || !(t > 0)) return 0;
  return Math.floor(t * fps) % n;
}

/** what is wrong with a strip against its picture's size (a frame cut off, the height not the frame's), or ''
 * @param {Strip} s @param {{ w: number, h: number }} size */
export function stripProblem(s, size) {
  if (!s || !size) return '';
  if (size.w !== s.w * s.n) return `${s.n} frames of ${s.w} px make ${s.w * s.n} px, the picture is ${size.w} px wide`;
  if (size.h !== s.h) return `the frames are ${s.h} px high, the picture ${size.h} px`;
  return '';
}
