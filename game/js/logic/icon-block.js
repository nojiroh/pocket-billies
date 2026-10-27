// @ts-check
'use strict';
/* ================= ICON BLOCK (Studio art track SA-2b) =================
   The UI icons' "block and split" look (2026-10-23), ported from tools/build-ui-icons.py when the SVG files became
   the source (decision 6). An icon's front is drawn flat on 34 x 34 pixels; this adds, the same way for every icon:
   - a 2 px block side to the lower right, in darker shades of each colour (the far shade first);
   - the front split on the 45-degree line through its middle: paler above, full colour below;
   - a lit edge (top and left) and a darker seam where two colours meet (right and below).
   In a one-colour icon (a hue of ICON_RAMPS) that colour's four shades are one family: no seam between them, so the
   tones read as one block. The colours are the light theme's plus a few for things (ICON_PALETTE).
   The Studio's icon editor (studio/js/icon-editor.js) runs it on a front painted flat ("Shade as a block").
   Logic only: no DOM, runs in Node (tools/test/icon-block.test.mjs checks it against the 51 icons the builder drew). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  ICON_DEPTH: [() => ICON_DEPTH],
  ICON_FRONT: [() => ICON_FRONT],
  ICON_PALETTE: [() => ICON_PALETTE],
  ICON_RAMPS: [() => ICON_RAMPS],
  ICON_SIZE: [() => ICON_SIZE],
  LIT: [() => LIT],
  PALE: [() => PALE],
  SEAM: [() => SEAM],
  SHADOW: [() => SHADOW],
  SIDE: [() => SIDE],
  WHITE: [() => WHITE],
  iconBlock: [() => iconBlock],
  // @ts-expect-error -- replaced on purpose
  iconBlockKeyed: [() => iconBlockKeyed, v => (iconBlockKeyed = v)],
  iconFamily: [() => iconFamily],
  // @ts-expect-error -- replaced on purpose
  iconMix: [() => iconMix, v => (iconMix = v)],
  pyRound: [() => pyRound],
  rgbOf: [() => rgbOf],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const ICON_FRONT = 34;
export const ICON_DEPTH = 2;
export const ICON_SIZE = ICON_FRONT + ICON_DEPTH;
/* the builder's colour letters ('.' was empty) */
export const ICON_PALETTE = {
  g: '#3B8446', // primary green
  G: '#7DBF6E', // leaf green
  y: '#F6D06C', // gold A
  o: '#D99E33', // gold B
  r: '#C8492F', // danger red
  t: '#2A9D8F', // teal (healthy HP)
  b: '#4F9BD1', // water blue
  B: '#A9D4EE', // ice
  w: '#E6DDC6', // paper
  W: '#FFF8E6', // cream
  p: '#C2B79C', // stone
  s: '#9AA7B4', // steel
  k: '#4A5544', // slate (the darkest colour: still reads on the dark theme)
  n: '#9A6A3E', // wood
  v: '#8A6CC9', // violet
  V: '#6A4FB0', // deep violet
  c: '#D3DCE0', // cloud
};
/* a one-colour icon's light, mid, dark and ink shades (the builder's digits 1-4); ink is for details inside the shape */
export const ICON_RAMPS = {
  gold: ['#FBE3A0', '#F6D06C', '#D99E33', '#8A5A14'],
  red: ['#E8846B', '#C8492F', '#8E2E1C', '#6E1F12'],
  green: ['#7DBF6E', '#3B8446', '#24572C', '#173D1E'],
  steel: ['#C9D2DB', '#9AA7B4', '#5E6B78', '#3E4852'],
  blue: ['#A9D4EE', '#4F9BD1', '#2C6A9A', '#1B4466'],
  teal: ['#8FD6CC', '#2A9D8F', '#1B6B61', '#0F4740'],
  violet: ['#B9A3E3', '#8A6CC9', '#5A3F9E', '#3A2670'],
};
export const SHADOW = '#14200F',
  WHITE = '#FFFFFF',
  SIDE = [0.4, 0.5], // the block side's shade, near and far
  PALE = 0.5,
  LIT = 0.75,
  SEAM = 0.35;

/* Python's round(): halves go to the even number (the builder's colours depend on it) */
export const pyRound = (/** @type {number} */ v) => {
  const f = Math.floor(v),
    d = v - f;
  return d > 0.5 || (d === 0.5 && f % 2 !== 0) ? f + 1 : f;
};
export const rgbOf = (/** @type {string} */ h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/** a colour mixed toward another by t (0-1), as the builder mixed them @param {string} a @param {string} b @param {number} t */
export function iconMix(a, b, t) {
  const A = rgbOf(a),
    B = rgbOf(b);
  return (
    '#' +
    A.map((v, i) =>
      pyRound(v + (B[i] - v) * t)
        .toString(16)
        .toUpperCase()
        .padStart(2, '0')
    ).join('')
  );
}

/** the 36 x 36 picture of a flat front: rows of '#RRGGBB' ('' empty), ICON_FRONT square. `family` names the colours
 * that are one block (a one-colour icon's shades); by default each colour is its own
 * @param {string[][]} front @param {(c: string) => string} [family] @returns {string[][]} 36 rows of '#RRGGBB' or '' */
export const iconBlock = (front, family = c => c) => iconBlockKeyed(front, c => c, family);

/** iconBlock on a front of keys (the builder's letters): `colour` gives each key's colour, `family` its block
 * @param {string[][]} front @param {(k: string) => string} colour @param {(k: string) => string} family
 * @returns {string[][]} */
export function iconBlockKeyed(front, colour, family) {
  const N = ICON_FRONT,
    S = ICON_SIZE,
    at = (/** @type {number} */ x, /** @type {number} */ y) =>
      x >= 0 && x < N && y >= 0 && y < N ? (front[y] && front[y][x]) || '' : '',
    kin = (/** @type {string} */ c) => (c ? family(c) : '');
  /** @type {string[][]} */
  const px = Array.from({ length: S }, () => Array(S).fill(''));
  for (let k = ICON_DEPTH; k > 0; k--)
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const m = at(x - k, y - k);
        if (m && !at(x, y)) px[y][x] = iconMix(colour(m), SHADOW, SIDE[k - 1]);
      }
  let sum = 0,
    n = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (at(x, y)) {
        sum += x + y;
        n++;
      }
  const mid = n ? sum / n : 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const m = at(x, y);
      if (!m) continue;
      const c = colour(m),
        f = kin(m),
        r = kin(at(x + 1, y)),
        d = kin(at(x, y + 1));
      if ((r !== '' && r !== f) || (d !== '' && d !== f)) px[y][x] = iconMix(c, SHADOW, SEAM);
      else if (kin(at(x, y - 1)) !== f || kin(at(x - 1, y)) !== f) px[y][x] = iconMix(c, WHITE, LIT);
      else px[y][x] = x + y < mid ? iconMix(c, WHITE, PALE) : c;
    }
  return px;
}

/** the family of a colour in a one-colour icon of `hue`: its ramp's shades are one ('' hue: each colour its own)
 * @param {string} hue */
export const iconFamily = hue => {
  const R = /** @type {Record<string, string[]>} */ (ICON_RAMPS)[hue];
  return (/** @type {string} */ c) => (R && R.includes(c.toUpperCase()) ? 'mono' : c);
};
