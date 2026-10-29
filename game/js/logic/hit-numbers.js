// @ts-check
'use strict';
/* ===== NUMBERS YOU FEEL: THE DAMAGE NUMBER'S SIZE AND THE HP ROLL (style track SY-2) =====
   A damage number's size follows how much the hit took (battle-stage.js hitWeight: damage / max HP): small at a
   scratch, large at a one-shot, and the largest when it knocks the fighter out. The kind's colour (super effective,
   crit, not very effective) stays on top (battle-screen.css .pop).
   Your plate's HP number (and a boss's %) counts to its new value over the fill's .38 s instead of jumping. Display
   only: the battle engine's numbers never change.
   Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  POP_MAX: [() => POP_MAX],
  POP_MIN: [() => POP_MIN],
  ROLL_MS: [() => ROLL_MS],
  // @ts-expect-error -- replaced on purpose
  popSize: [() => popSize, v => (popSize = v)],
  // @ts-expect-error -- replaced on purpose
  rollValue: [() => rollValue, v => (rollValue = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the damage number's size in CSS px at a scratch and at a one-shot (and on a KO) */
export const POP_MIN = 24;
export const POP_MAX = 40;
/** the HP number's roll, as long as the fill's move (battle-screen.css .bplate .pl-hp .fill) */
export const ROLL_MS = 380;

/** the damage number's font size for a hit of weight w (0..1); a KO is always the largest. SY-8: min and max are the
 * Studio's dials (uiTheme.json style popMin, popMax)
 * @param {number} w @param {boolean} [ko] @param {number} [min] @param {number} [max] */
export function popSize(w, ko = false, min = POP_MIN, max = POP_MAX) {
  if (ko) return max;
  const x = Number.isFinite(w) ? Math.min(1, Math.max(0, w)) : 0.3;
  return Math.round(min + x * (max - min));
}

/** the number shown t ms into a roll from `from` to `to`: whole numbers, fast first and settling (an ease out), the
 * end value exactly at ROLL_MS
 * @param {number} from @param {number} to @param {number} t @param {number} [ms] */
export function rollValue(from, to, t, ms = ROLL_MS) {
  if (!(ms > 0) || t >= ms) return to;
  if (t <= 0) return from;
  const k = t / ms,
    e = 1 - (1 - k) * (1 - k) * (1 - k);
  return Math.round(from + (to - from) * e);
}
