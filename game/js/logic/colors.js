// @ts-check
'use strict';
/* ================= COLOURS (phase 06-4) =================
   Contrast between two colours (WCAG 2), and a type colour deepened just enough for its label to read (owner,
   2026-10-19: type pills keep their hue, a darker shade behind white text, 4.5:1). The type colours in the data stay
   as they are; only the pills use the deepened shade. Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  contrastRatio: [() => contrastRatio, v => (contrastRatio = v)],
  // @ts-expect-error -- replaced on purpose
  hexRgb: [() => hexRgb, v => (hexRgb = v)],
  // @ts-expect-error -- replaced on purpose
  luminance: [() => luminance, v => (luminance = v)],
  // @ts-expect-error -- replaced on purpose
  readableBg: [() => readableBg, v => (readableBg = v)],
  rgbHex: [() => rgbHex],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @param {string} hex #rgb or #rrggbb @returns {[number, number, number]} */
export function hexRgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.replace(/./g, c => c + c);
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** @param {[number, number, number]} c */
export const rgbHex = c =>
  '#' +
  c
    .map(v =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('');
/** relative luminance @param {[number, number, number]} c */
export function luminance(c) {
  const f = (/** @type {number} */ v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
/** @param {string} a @param {string} b the contrast ratio, 1 to 21 */
export function contrastRatio(a, b) {
  const [x, y] = [luminance(hexRgb(a)), luminance(hexRgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** the background, darkened (for light text) or lightened (for dark text) in small steps until the text reads at `min`
 * @param {string} bg @param {string} fg @param {number} [min] */
export function readableBg(bg, fg, min = 4.5) {
  const toward = luminance(hexRgb(fg)) > 0.5 ? 0 : 255;
  let c = hexRgb(bg);
  for (let i = 0; i < 40 && contrastRatio(rgbHex(c), fg) < min; i++)
    c = /** @type {[number, number, number]} */ (c.map(v => v + (toward - v) * 0.06));
  return rgbHex(c);
}
