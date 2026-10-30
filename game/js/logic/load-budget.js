// @ts-check
'use strict';
/* ================= THE ONE-OFF WORK'S BUDGET (fluid track FL-4b, with the load track's LD-5) =================
   The frame's one-off work (the ground's preparing, the near ring, model meshes, buildings, solid props, picture
   uploads, the next place's warm-up) shares one budget a frame (walk/quality-cull.js frameBudgetLeft). LD-5 made it
   8 ms on phones and 10 elsewhere, whatever the rate; the owner's answer (2026-10-30): it follows the set rate, about
   a quarter of the paced slot (quality.slotBudget). Plain numbers, no browser. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  SLOT_WORK_MAX_MS: [() => SLOT_WORK_MAX_MS],
  SLOT_WORK_MIN_MS: [() => SLOT_WORK_MIN_MS],
  SLOT_WORK_SHARE: [() => SLOT_WORK_SHARE],
  TEXTURE_AGE_MS: [() => TEXTURE_AGE_MS],
  // @ts-expect-error -- replaced on purpose
  slotWorkMs: [() => slotWorkMs, v => ((slotWorkMs = v), provide({ slotWorkMs }))],
  // @ts-expect-error -- replaced on purpose
  textureTrimOrder: [() => textureTrimOrder, v => ((textureTrimOrder = v), provide({ textureTrimOrder }))],
});
/* eslint-enable no-func-assign */
provide({ slotWorkMs, textureTrimOrder });
/* to-module: end */
/** the share of the paced slot the one-off work may take */
export const SLOT_WORK_SHARE = 0.25;
/** never less than this (120 a second: 2 ms), so a fast screen still gets its jobs done */
export const SLOT_WORK_MIN_MS = 2;
/** never more than this (a slow rate behind a window, 20 a second: 12, not 12.5) */
export const SLOT_WORK_MAX_MS = 12;
/**
 * The one-off work's budget for a paced slot: a quarter of it, 2 to 12 ms (60 a second: 4.2 ms; 30: 8.3; 120: 2.1).
 * @param {number} slotMs the walk's paced slot (its refreshes a frame times the refresh period), ms
 * @returns {number} ms
 */
export function slotWorkMs(slotMs) {
  const s = +slotMs;
  if (!(s > 0)) return SLOT_WORK_MAX_MS;
  return Math.min(SLOT_WORK_MAX_MS, Math.max(SLOT_WORK_MIN_MS, s * SLOT_WORK_SHARE));
}
/** a picture unused this long may leave the graphics card when it is over its cap (was 600 frames: 10 s at 60) */
export const TEXTURE_AGE_MS = 10000;
/**
 * Which pictures leave the card first (quality.texAge): those unused for longer than `age` ms, the longest unused
 * first; by time, so a 30 fps frame or a battle (whose frames didn't count) ages a picture as a walk at 60 does.
 * @param {Array<[any, {ut?: number}]>} entries [key, entry] with ut, when it was last used (ms)
 * @param {number} now ms
 * @param {number} [age] ms
 * @returns {Array<[any, {ut?: number}]>}
 */
export function textureTrimOrder(entries, now, age = TEXTURE_AGE_MS) {
  return entries.filter(([, e]) => now - (e.ut || 0) > age).sort((a, b) => (a[1].ut || 0) - (b[1].ut || 0));
}
