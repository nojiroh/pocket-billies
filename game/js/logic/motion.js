// @ts-check
'use strict';
/* ================= MOTION (UI track, UI-16a) =================
   The Animation setting's levels and the feedback motions' numbers (docs/phases/ui-track.md, "Alive, without
   clutter": Timings and Settings). Device plays Full unless the phone asks for reduced motion (the owner's answer 8);
   Calm is Full without idle loops; Reduced keeps fades only. The page writes the level on <html data-motion> (settings-
   screen.js applyPreferences); motion.css and the kit read it there. Logic only: no DOM, runs in Node
   (tools/test/motion.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MOTION_CHOICES: [() => MOTION_CHOICES],
  MOTION_LEVELS: [() => MOTION_LEVELS],
  MOTION_TIMES: [() => MOTION_TIMES],
  // @ts-expect-error -- replaced on purpose
  motionCountAt: [() => motionCountAt, v => (motionCountAt = v)],
  // @ts-expect-error -- replaced on purpose
  motionCountMs: [() => motionCountMs, v => (motionCountMs = v)],
  // @ts-expect-error -- replaced on purpose
  motionLevelOf: [() => motionLevelOf, v => (motionLevelOf = v)],
  // @ts-expect-error -- replaced on purpose
  motionStaggerCap: [() => motionStaggerCap, v => (motionStaggerCap = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the levels a page can be at, from most to least motion */
export const MOTION_LEVELS = ['full', 'calm', 'reduced'];

/** the Animation setting's choices (preferences.motion), in the order Settings shows them */
export const MOTION_CHOICES = ['system', 'full', 'calm', 'reduced'];

/**
 * the level the page plays at
 * @param {string | undefined | null} pref preferences.motion: system (Device), full, calm or reduced
 * @param {boolean} phoneReduces the phone asks for reduced motion (prefers-reduced-motion: reduce)
 * @returns {'full' | 'calm' | 'reduced'}
 */
export function motionLevelOf(pref, phoneReduces) {
  if (pref === 'full' || pref === 'calm' || pref === 'reduced') return pref;
  return phoneReduces ? 'reduced' : 'full';
}

/** the timings, in ms (the doc's ranges, from NN/g and the research; tokens.css and uiTheme.json motion hold the
 * page's own copies, which the unit test keeps inside these) */
export const MOTION_TIMES = {
  press: [80, 120],
  enter: [220, 280],
  stagger: [30, 40],
  enterMax: 400,
  exit: [150, 200],
  pop: 150,
  float: [500, 700],
  tick: [400, 700],
};

/**
 * how long a number ticks from one value to another: longer for bigger changes, always inside the tick range
 * @param {number} from
 * @param {number} to
 */
export function motionCountMs(from, to) {
  const [lo, hi] = MOTION_TIMES.tick,
    d = Math.abs((to || 0) - (from || 0));
  if (!(d > 0)) return 0;
  return Math.round(Math.min(hi, lo + Math.log10(d + 1) * 75));
}

/**
 * the eased value a count shows at time k (0 to 1): fast at first, settling into the last digits
 * @param {number} from
 * @param {number} to
 * @param {number} k
 */
export function motionCountAt(from, to, k) {
  const q = Math.min(1, Math.max(0, k));
  return from + (to - from) * (1 - (1 - q) ** 3);
}

/**
 * the last row index that still staggers: past it, rows enter together, so the last one lands by enterMax
 * @param {number} enterMs the enter's own length
 * @param {number} staggerMs the gap between rows
 */
export function motionStaggerCap(enterMs, staggerMs) {
  if (!(staggerMs > 0)) return 0;
  return Math.max(0, Math.floor((MOTION_TIMES.enterMax - enterMs) / staggerMs));
}
