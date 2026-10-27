// @ts-check
'use strict';
/* ================= SVG PIXELS (Studio art track SA-2b) =================
   The UI icons (art/ui/*.svg) are pixel art written as SVG: one <path> per colour, sorted by colour, each a list of
   one-pixel-high runs `M<x> <y>h<n>v1h-<n>z` in reading order, on a `viewBox="0 0 <w> <h>"` with crisp edges. That
   is the format tools/build-ui-icons.py wrote (it retired in SA-2b: the SVG files are the source, decision 6), so a
   picture and its SVG turn into each other exactly: the Studio paints an icon's pixels and writes the same text back.
   An SVG drawn any other way is not pixels: svgToPixels says why, and the Studio edits it as text only.
   Logic only: no DOM, runs in Node (tools/test/svg-pixels.test.mjs). */
/** @typedef {{ w: number, h: number, data: Uint8ClampedArray }} SvgPixels */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  SVG_HEAD: [() => SVG_HEAD],
  SVG_PATH: [() => SVG_PATH],
  SVG_RUN: [() => SVG_RUN],
  // @ts-expect-error -- replaced on purpose
  pixelsToSvg: [() => pixelsToSvg, v => (pixelsToSvg = v)],
  svgHex2: [() => svgHex2],
  // @ts-expect-error -- replaced on purpose
  svgProblem: [() => svgProblem, v => (svgProblem = v)],
  // @ts-expect-error -- replaced on purpose
  svgToPixels: [() => svgToPixels, v => (svgToPixels = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const SVG_HEAD =
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) (\d+)" shape-rendering="crispEdges">/;
export const SVG_PATH = /^<path d="([^"]*)" fill="#([0-9A-F]{6})"\/>/;
export const SVG_RUN = /M(\d+) (\d+)h(\d+)v1h-(\d+)z/y;

export const svgHex2 = (/** @type {number} */ v) => v.toString(16).toUpperCase().padStart(2, '0');

/** a picture as the icons' SVG text: colours with alpha under 128 are empty, every other pixel is opaque
 * @param {ArrayLike<number>} rgba @param {number} w @param {number} h @returns {string} */
export function pixelsToSvg(rgba, w, h) {
  /** @type {Record<string, string>} */
  const paths = {};
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w;) {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] < 128) {
        x++;
        continue;
      }
      const c = '#' + svgHex2(rgba[i]) + svgHex2(rgba[i + 1]) + svgHex2(rgba[i + 2]);
      let n = 1;
      for (; x + n < w; n++) {
        const j = (y * w + x + n) * 4;
        if (rgba[j + 3] < 128 || '#' + svgHex2(rgba[j]) + svgHex2(rgba[j + 1]) + svgHex2(rgba[j + 2]) !== c) break;
      }
      paths[c] = (paths[c] || '') + `M${x} ${y}h${n}v1h-${n}z`;
      x += n;
    }
  const body = Object.keys(paths)
    .sort()
    .map(c => `<path d="${paths[c]}" fill="${c}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>\n`;
}

/** an icon's SVG text as pixels, or { error } when it isn't in the pixel format (then it is edited as text)
 * @param {string} text @returns {SvgPixels | { error: string }} */
export function svgToPixels(text) {
  const t = String(text || '').replace(/\s+$/, '');
  const head = SVG_HEAD.exec(t);
  if (!head) return { error: 'It doesn’t start as the icons’ pixel SVG does (a viewBox from 0 0, crisp edges).' };
  const w = +head[1],
    h = +head[2];
  if (!w || !h || w > 512 || h > 512) return { error: `A ${w}×${h} picture is not an icon’s size.` };
  const data = new Uint8ClampedArray(w * h * 4);
  let at = head[0].length;
  while (!t.startsWith('</svg>', at)) {
    const p = SVG_PATH.exec(t.slice(at));
    if (!p)
      return { error: 'Something other than one-colour pixel paths is in it (only <path d="M…" fill="#RRGGBB"/>).' };
    const d = p[1],
      rgb = [0, 2, 4].map(k => parseInt(p[2].slice(k, k + 2), 16));
    SVG_RUN.lastIndex = 0;
    while (SVG_RUN.lastIndex < d.length) {
      const m = SVG_RUN.exec(d);
      if (!m) return { error: `A path isn’t made of one-pixel runs (#${p[2]}).` };
      const x = +m[1],
        y = +m[2],
        n = +m[3];
      if (n !== +m[4] || !n || x + n > w || y >= h)
        return { error: `A run of #${p[2]} leaves the picture or doesn’t close.` };
      for (let k = 0; k < n; k++) {
        const i = (y * w + x + k) * 4;
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 255;
      }
    }
    at += p[0].length;
  }
  if (t.length !== at + '</svg>'.length) return { error: 'There is more after the closing </svg>.' };
  return { w, h, data };
}

/** what is wrong with an SVG the Studio would save as an icon, or '' (any SVG drawing is allowed; nothing that runs,
 * loads other files or points outside it, and the icons' 36 x 36 box). The browser's parse is checked on top of this
 * @param {string} text */
export function svgProblem(text) {
  const t = String(text || '');
  if (!/^\s*<svg[\s>]/.test(t) || !/<\/svg>\s*$/.test(t)) return 'An SVG starts with <svg …> and ends with </svg>.';
  if (!/\sviewBox="0 0 36 36"/.test(t.slice(0, t.indexOf('>') + 1))) return 'An icon’s box is viewBox="0 0 36 36".';
  if (/<(script|foreignObject|iframe|image|use|style)\b/i.test(t))
    return 'Scripts, styles, pictures and links aren’t allowed.';
  if (/\son[a-z]+\s*=|href\s*=|url\s*\(|<!(DOCTYPE|ENTITY)|javascript:/i.test(t))
    return 'Event handlers, links and outside files aren’t allowed.';
  return '';
}
