// @ts-check
'use strict';
/* ===== THE STYLE TRACK'S DIALS AND WHAT RAN (style track SY-8) =====
   The dials: the Bureau's stamp (its size and slant), the HP roll's time, the damage number's sizes and the coat foil's
   speed and width live in uiTheme.json `style` (the Studio's UI section, Style group). The theme sheet writes them as
   CSS variables (styleVarsCss); pb-stamp and the HP fill read them in CSS, battle.js and the foil through
   theme-sheet.js styleDials(). Left out of the data, each is today's number (STYLE_DIALS).
   What ran: counts of the flashes, stamps, pops, rolls and foil frames, kept apart for each Flashes and Animation state
   they ran under, for the debug log (debug-log.js state().style). Numbers only: never save data, names or places.
   Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  STYLE_DIALS: [() => STYLE_DIALS],
  STYLE_RANGES: [() => STYLE_RANGES],
  STYLE_VARS: [() => STYLE_VARS],
  // @ts-expect-error -- replaced on purpose
  styleCount: [() => styleCount, v => (styleCount = v)],
  // @ts-expect-error -- replaced on purpose
  styleDialsOf: [() => styleDialsOf, v => (styleDialsOf = v)],
  styleRan: [() => styleRan],
  // @ts-expect-error -- replaced on purpose
  styleReport: [() => styleReport, v => (styleReport = v)],
  // @ts-expect-error -- replaced on purpose
  styleStateOf: [() => styleStateOf, v => (styleStateOf = v)],
  // @ts-expect-error -- replaced on purpose
  styleVarsCss: [() => styleVarsCss, v => (styleVarsCss = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{stampScale: number, stampSlant: number, rollMs: number, popMin: number, popMax: number,
 *   foilPeriod: number, foilSweep: number, foilHalf: number}} StyleDials */

/** today's numbers (SY-2, SY-3, SY-6): what each dial is when the data leaves it out */
export const STYLE_DIALS = /** @type {StyleDials} */ ({
  /** the stamp's size, times its page's own (pb-stamp size sm 14 px, normal 22 px, lg 34 px) */
  stampScale: 1,
  /** the stamp's slant in degrees: a page's tilt of -8 turns this far (and -7 a little less) */
  stampSlant: 8,
  /** the HP number's roll and the fill's move, ms */
  rollMs: 380,
  /** the damage number at a scratch and at a one-shot (and a KO), px */
  popMin: 24,
  popMax: 40,
  /** the foil: a sweep starts every foilPeriod ms and crosses the sprite in foilSweep ms */
  foilPeriod: 3500,
  foilSweep: 700,
  /** the band's half width (the sprite is 1.6 across along the band's way) */
  foilHalf: 0.2,
});

/** each dial's range (the schema's; tools/test/style-dials.test.mjs keeps them equal) */
export const STYLE_RANGES = /** @type {Record<keyof StyleDials, [number, number]>} */ ({
  stampScale: [0.5, 2],
  stampSlant: [0, 20],
  rollMs: [0, 1500],
  popMin: [12, 48],
  popMax: [16, 72],
  foilPeriod: [1000, 10000],
  foilSweep: [200, 3000],
  foilHalf: [0.05, 0.6],
});

/** the dial, its CSS variable and the unit written after it (pb-stamp's calc needs bare numbers; a transition needs ms) */
export const STYLE_VARS = /** @type {[keyof StyleDials, string, string][]} */ ([
  ['stampScale', '--stamp-scale', ''],
  ['stampSlant', '--stamp-slant', ''],
  ['rollMs', '--hp-roll', 'ms'],
  ['popMin', '--pop-min', ''],
  ['popMax', '--pop-max', ''],
  ['foilPeriod', '--foil-period', ''],
  ['foilSweep', '--foil-sweep', ''],
  ['foilHalf', '--foil-half', ''],
]);

/** the dials from a reader (a data object's key, or a CSS variable), each kept inside its range; a missing or broken
 * one is today's. A pop's largest size is never under its smallest; a sweep is always shorter than its period.
 * @param {(k: keyof StyleDials) => unknown} read @returns {StyleDials} */
export function styleDialsOf(read) {
  const o = /** @type {StyleDials} */ ({ ...STYLE_DIALS });
  for (const k of /** @type {(keyof StyleDials)[]} */ (Object.keys(STYLE_DIALS))) {
    const v = typeof read === 'function' ? read(k) : undefined,
      n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    if (!Number.isFinite(n)) continue;
    const [lo, hi] = STYLE_RANGES[k];
    o[k] = Math.min(hi, Math.max(lo, n));
  }
  if (o.popMax < o.popMin) o.popMax = o.popMin;
  if (o.foilSweep >= o.foilPeriod) o.foilSweep = Math.round(o.foilPeriod / 2);
  return o;
}

/** the theme sheet's lines for a look's `style` group (only the dials it sets)
 * @param {Partial<StyleDials> | undefined} style */
export function styleVarsCss(style) {
  const out = [];
  if (!style || typeof style !== 'object') return out;
  for (const [k, v, unit] of STYLE_VARS) if (typeof style[k] === 'number') out.push(`${v}: ${style[k]}${unit};`);
  return out;
}

/* ---------- what ran ---------- */
/** counts by the state they ran under ("flashes on, full"), then by what: flash (shown at its strength), flashHeld
 * (held to 15% by Flashes off), flashSkipped (none: Reduced), stamp, pop, roll, foil (frames a Billie had its band) */
export const styleRan = { states: /** @type {Record<string, Record<string, number>>} */ ({}) };

/** the state's name: the Flashes setting and the Animation level the page plays at
 * @param {boolean} flashesOff @param {string | undefined} level full, calm or reduced */
export function styleStateOf(flashesOff, level) {
  const l = level === 'calm' || level === 'reduced' ? level : 'full';
  return `flashes ${flashesOff ? 'off' : 'on'}, ${l}`;
}

/** one more of `what` under `state` @param {string} state @param {string} what @param {number} [n] */
export function styleCount(state, what, n = 1) {
  const s = styleRan.states[state] || (styleRan.states[state] = {});
  s[what] = (s[what] || 0) + n;
}

/** the debug log's line: the state now and what ran under each state so far (a copy)
 * @param {string} now (styleStateOf) */
export function styleReport(now) {
  /** @type {Record<string, Record<string, number>>} */
  const ran = {};
  for (const [k, v] of Object.entries(styleRan.states)) ran[k] = { ...v };
  return { now, ran };
}
