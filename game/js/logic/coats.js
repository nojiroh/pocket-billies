// @ts-check
'use strict';
/* ================= COATS (studio track ST-0) =================
   A coat is a recolour of a Billie's art, in place of the old Golden sheets (game/data/coats.json, keyed by id):
   whole palette ramps swapped step for step ("ember" -> "indigo", next/palette.js), then exact colours swapped, or a
   hand-painted sheet per species and view. A coat can turn up in the wild, in eggs or on the line once in its odds;
   without odds it never does. A Billie carries `coat: '<id>'` or nothing.
   Logic only: no DOM, runs in Node. The game, the Studio and the tests recolour the same way. */
/** @import { Coat } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  COAT_NEAR: [() => COAT_NEAR],
  // @ts-expect-error -- replaced on purpose
  coatArt: [() => coatArt, v => (coatArt = v)],
  // @ts-expect-error -- replaced on purpose
  coatColorMap: [() => coatColorMap, v => (coatColorMap = v)],
  // @ts-expect-error -- replaced on purpose
  coatRecolor: [() => coatRecolor, v => (coatRecolor = v)],
  // @ts-expect-error -- replaced on purpose
  coatRoll: [() => coatRoll, v => (coatRoll = v)],
  hex6: [() => hex6],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a pixel this close (RGB distance) to a palette shade counts as that shade, so art drawn slightly off the palette
 * still recolours; anything further stays as it is */
export const COAT_NEAR = 24;
/** '#ABC', '#aabbcc' -> 'aabbcc' @param {string} c */
export const hex6 = c => {
  const h = String(c).replace('#', '').toLowerCase();
  return h.length === 3 ? [...h].map(x => x + x).join('') : h;
};
/** the coat's colour swaps as 'rrggbb' -> 'rrggbb': its ramps step for step, then its exact swaps
 * @param {Coat | undefined} coat @param {{ ramps: Record<string, string[]> } | undefined} palette */
export function coatColorMap(coat, palette) {
  const out = new Map();
  if (!coat) return out;
  const R = (palette && palette.ramps) || {};
  for (const [a, b] of Object.entries(coat.ramps || {})) {
    const from = R[a],
      to = R[b];
    if (!from || !to) continue;
    from.forEach((c, i) => out.set(hex6(c), hex6(to[Math.min(i, to.length - 1)])));
  }
  for (const [a, b] of Object.entries(coat.swap || {})) out.set(hex6(a), hex6(b));
  return out;
}
/** recolour RGBA pixels in place (an ImageData's data). Each pixel is matched to the nearest palette shade or swapped
 * colour within COAT_NEAR; when that one is swapped the pixel takes the swap, otherwise (another palette shade, or
 * nothing near) it stays. Returns how many pixels changed.
 * @param {Uint8ClampedArray | number[]} d @param {Map<string, string>} map
 * @param {{ ramps: Record<string, string[]> } | undefined} palette */
export function coatRecolor(d, map, palette) {
  if (!map.size) return 0;
  const all = new Set(map.keys());
  for (const r of Object.values((palette && palette.ramps) || {})) for (const c of r) all.add(hex6(c));
  const keys = [...all].map(k => [
      k,
      parseInt(k.slice(0, 2), 16),
      parseInt(k.slice(2, 4), 16),
      parseInt(k.slice(4), 16),
    ]),
    seen = new Map();
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i],
      g = d[i + 1],
      b = d[i + 2],
      id = (r << 16) | (g << 8) | b;
    let to = seen.get(id);
    if (to === undefined) {
      to = null;
      let best = COAT_NEAR * COAT_NEAR + 1;
      for (const [k, kr, kg, kb] of keys) {
        const e = (r - +kr) ** 2 + (g - +kg) ** 2 + (b - +kb) ** 2;
        if (e < best) {
          best = e;
          to = map.get(/** @type {string} */ (k)) || null;
        }
      }
      seen.set(id, to);
    }
    if (!to) continue;
    d[i] = parseInt(to.slice(0, 2), 16);
    d[i + 1] = parseInt(to.slice(2, 4), 16);
    d[i + 2] = parseInt(to.slice(4), 16);
    n++;
  }
  return n;
}
/** which coat a new Billie wears, if any: each coat with odds for this kind is tried in turn (wild, egg or fish).
 * No odds means no roll, so a game without coat odds draws the same random numbers as one without coats.
 * @param {Record<string, Coat> | undefined} coats @param {'wild' | 'egg' | 'fish'} kind @param {() => number} rnd
 * @returns {string | undefined} */
export function coatRoll(coats, kind, rnd) {
  for (const [id, C] of Object.entries(coats || {})) {
    const n = C.odds && C.odds[kind];
    if (n && n >= 2 && rnd() < 1 / n) return id;
  }
  return undefined;
}
/** a hand-painted sheet for this species and view, or null (then the coat recolours the normal sheet)
 * @param {Coat | undefined} coat @param {string} sp @param {string} view */
export function coatArt(coat, sp, view) {
  const a = coat && coat.art && coat.art[sp];
  return (a && /** @type {Record<string, string>} */ (a)[view]) || null;
}
