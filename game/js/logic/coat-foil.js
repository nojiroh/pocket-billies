// @ts-check
'use strict';
/* ===== THE COAT'S FOIL IN THE WORLD (style track SY-6) =====
   A Billie with a coat (a rare recolour, logic/coats.js) gets a foil sheen on the maps and in battle, as its Coat tag
   has a prism in menus (units.css .u-tag.coat). A band of light sweeps across the sprite once every few seconds, held
   on the 24 fps grid, its edges dithered in art pixels, only on the brighter pixels, its colour the pixel's own (the
   coat's colours) turned round the hue wheel. The sprite fragment shader draws it (walk/walk-shaders.js `uFoil`);
   this works out when and where. Between sweeps a Billie has no foil at all, so it stays in its batch.
   A regional form's coat is not a coat a Billie carries (it is the form's own look), so it has no foil.
   Off under Reduced motion, with Flashes off, with Graphics Off and at battle quality level 2 and up.
   Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  FOIL_CELL_MS: [() => FOIL_CELL_MS],
  FOIL_HALF: [() => FOIL_HALF],
  FOIL_PERIOD_MS: [() => FOIL_PERIOD_MS],
  FOIL_SPAN: [() => FOIL_SPAN],
  FOIL_STRENGTH: [() => FOIL_STRENGTH],
  FOIL_SWEEP_MS: [() => FOIL_SWEEP_MS],
  // @ts-expect-error -- replaced on purpose
  coatFoil: [() => coatFoil, v => (coatFoil = v)],
  // @ts-expect-error -- replaced on purpose
  foilBand: [() => foilBand, v => (foilBand = v)],
  // @ts-expect-error -- replaced on purpose
  foilHash: [() => foilHash, v => (foilHash = v)],
  // @ts-expect-error -- replaced on purpose
  foilHue: [() => foilHue, v => (foilHue = v)],
  // @ts-expect-error -- replaced on purpose
  foilOn: [() => foilOn, v => (foilOn = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a sweep starts every 3.5 s (the track: every 3-4 s) */
export const FOIL_PERIOD_MS = 3500;
/** and crosses the sprite in 0.7 s */
export const FOIL_SWEEP_MS = 700;
/** the band moves on the 24 fps grid: one place a cell */
export const FOIL_CELL_MS = 1000 / 24;
/** the band runs along x + 0.6 y of the sprite (0..1 each way), so across 0..1.6 */
export const FOIL_SPAN = 1.6;
/** its half width in that measure; the outer 40 % of it is dithered */
export const FOIL_HALF = 0.2;
/** how far a lit pixel goes to the sheen colour */
export const FOIL_STRENGTH = 0.55;

/** whether the foil shows at all
 * @param {{ reduced?: boolean, flashesOff?: boolean, graphicsOff?: boolean, level?: number }} o */
export function foilOn(o) {
  return !o.reduced && !o.flashesOff && !o.graphicsOff && !((o.level || 0) >= 2);
}

/** a small whole-number hash of a string @param {string} s */
export function foilHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** how far the sheen turns a pixel's hue, in turns (0.2-0.45): each coat its own, the same every time
 * @param {string} coat */
export function foilHue(coat) {
  return 0.2 + (foilHash(String(coat)) % 1000) / 4000;
}

/** SY-8: the Studio's foil dials (uiTheme.json style foilPeriod, foilSweep, foilHalf); left out, today's numbers
 * @typedef {{ foilPeriod?: number, foilSweep?: number, foilHalf?: number }} FoilTune */

/** where the band is at time t (ms), or null between sweeps. seed spreads Billies out so they don't flash together.
 * Returns the band's middle along the sprite (FOIL_SPAN measure; it starts and ends just off the picture)
 * @param {number} t @param {number | string} [seed] @param {FoilTune} [tune] */
export function foilBand(t, seed = 0, tune = {}) {
  if (!Number.isFinite(t)) return null;
  const period = tune.foilPeriod || FOIL_PERIOD_MS,
    sweep = tune.foilSweep || FOIL_SWEEP_MS,
    half = tune.foilHalf || FOIL_HALF;
  const off = (foilHash(String(seed)) % 1000) * (period / 1000),
    cell = Math.floor((t + off) / FOIL_CELL_MS) * FOIL_CELL_MS,
    at = ((cell % period) + period) % period;
  if (at >= sweep) return null;
  return -half + (at / sweep) * (FOIL_SPAN + 2 * half);
}

/** the sprite shader's uFoil for a Billie with this coat at time t, or null for none:
 * [strength, the band's middle, its half width, the hue turn]
 * @param {string | null | undefined} coat @param {Record<string, { form?: boolean }>} coats
 * @param {number} t @param {number | string} seed @param {boolean} on (foilOn) @param {FoilTune} [tune]
 * @returns {number[] | null} */
export function coatFoil(coat, coats, t, seed, on, tune = {}) {
  if (!on || !coat) return null;
  const C = coats && coats[coat];
  if (!C || C.form) return null;
  const pos = foilBand(t, `${coat}:${seed}`, tune);
  return pos == null ? null : [FOIL_STRENGTH, pos, tune.foilHalf || FOIL_HALF, foilHue(coat)];
}
