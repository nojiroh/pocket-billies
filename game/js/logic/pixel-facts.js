// @ts-check
'use strict';
/* ========== PIXEL FACTS: WHAT THE GAME READS OUT OF A PICTURE'S PIXELS (load track LD-1) ==========
   A few props need numbers or cut pictures made from another picture's pixels: a flat grass prop's mean lightness
   (walk/sprites.js, a moss or clover patch takes its grass's colour by it) and a tree's leaf clumps, cut from its crown
   (prop-models.js leafCut). Reading pixels in a page stalls it (the picture is read back from the graphics chip), so
   tools/bake-pixel-facts.mjs makes them once from the art files with these same functions, and the game reads the
   baked ones; a picture the Studio is editing is still read in the page. Pixels are RGBA bytes, rows top to bottom.
   Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  leafCutKey: [() => leafCutKey, v => (leafCutKey = v)],
  // @ts-expect-error -- replaced on purpose
  leafCutName: [() => leafCutName, v => (leafCutName = v)],
  // @ts-expect-error -- replaced on purpose
  leafCutPixels: [() => leafCutPixels, v => (leafCutPixels = v)],
  // @ts-expect-error -- replaced on purpose
  leafOutlineColour: [() => leafOutlineColour, v => (leafOutlineColour = v)],
  // @ts-expect-error -- replaced on purpose
  pixelLightness: [() => pixelLightness, v => (pixelLightness = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a picture's mean lightness (0-1, the eye's weights) over its opaque pixels; 0.5 when none is
 * @param {ArrayLike<number>} d */
export function pixelLightness(d) {
  let s = 0,
    n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    s += (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    n++;
  }
  return n ? s / n : 0.5;
}

/** phase 09 batch 1: a leaf picture's outline colour, the darkest colour it uses more than 15 times
 * @param {ArrayLike<number>} d @returns {[number, number, number]} */
export function leafOutlineColour(d) {
  const n = new Map();
  for (let i = 0; i < d.length; i += 4)
    if (d[i + 3] > 127) {
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      n.set(k, (n.get(k) || 0) + 1);
    }
  let best = 0,
    bl = 1e9;
  for (const [k, c] of n)
    if (c > 15) {
      const l = 0.299 * (k >> 16) + 0.587 * ((k >> 8) & 255) + 0.114 * (k & 255);
      if (l < bl) {
        bl = l;
        best = k;
      }
    }
  return [best >> 16, (best >> 8) & 255, best & 255];
}

/** a leaf layer's cut, as its key says it (the picture, the clip, the shade): what the baked file is named by
 * @param {string} img @param {{ clip?: number[], shade?: number }} L */
export function leafCutKey(img, L) {
  return img + '|' + (L.clip || []).join(',') + '|' + (L.shade || 1);
}

/** the baked cut's file name for a key: an FNV-1a hash, 8 hex digits @param {string} key */
export function leafCutName(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** phase 09 batch 1: one leaf layer's cut from its picture (W x H, its pixels d, its outline colour), as RGBA bytes.
   No clip: the whole picture, darkened by shade. A box [left, top, right, bottom] (phase 09 batch 10, a pine's tier):
   the box's opaque pixels. A circle [x, y, r]: a square 2r across round it, the circle's opaque pixels, the lower rim
   (next to an opaque pixel outside the circle) in the outline colour
 * @param {number} W @param {number} H @param {ArrayLike<number>} data @param {number[]} outline
 * @param {{ clip?: number[], shade?: number }} L @returns {{ w: number, h: number, data: Uint8ClampedArray }} */
export function leafCutPixels(W, H, data, outline, L) {
  const sh = L.shade || 1;
  if (!L.clip) {
    const o = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < data.length; i += 4) {
      o[i] = data[i] * sh;
      o[i + 1] = data[i + 1] * sh;
      o[i + 2] = data[i + 2] * sh;
      o[i + 3] = data[i + 3];
    }
    return { w: W, h: H, data: o };
  }
  if (L.clip.length >= 4) {
    const [x0, y0, x1, y1] = L.clip.map(Math.round),
      w = Math.max(1, x1 - x0),
      h = Math.max(1, y1 - y0),
      o = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const px = x0 + x,
          py = y0 + y;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const i = (py * W + px) * 4,
          j = (y * w + x) * 4;
        if (data[i + 3] <= 127) continue;
        o[j] = data[i] * sh;
        o[j + 1] = data[i + 1] * sh;
        o[j + 2] = data[i + 2] * sh;
        o[j + 3] = 255;
      }
    return { w, h, data: o };
  }
  const [cx, cy, r] = L.clip,
    R = Math.max(1, Math.ceil(r)),
    S = 2 * R,
    x0 = Math.round(cx) - R,
    y0 = Math.round(cy) - R,
    inC = (/** @type {number} */ px, /** @type {number} */ py) => (px + 0.5 - cx) ** 2 + (py + 0.5 - cy) ** 2 <= r * r,
    op = (/** @type {number} */ px, /** @type {number} */ py) =>
      px >= 0 && py >= 0 && px < W && py < H && data[(py * W + px) * 4 + 3] > 127,
    o = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const px = x0 + x,
        py = y0 + y;
      if (!op(px, py) || !inC(px, py)) continue;
      const i = (py * W + px) * 4,
        j = (y * S + x) * 4,
        rim =
          py > cy - r * 0.25 &&
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([a, b]) => op(px + a, py + b) && !inC(px + a, py + b));
      const c = rim ? outline : [data[i], data[i + 1], data[i + 2]];
      o[j] = c[0] * sh;
      o[j + 1] = c[1] * sh;
      o[j + 2] = c[2] * sh;
      o[j + 3] = 255;
    }
  return { w: S, h: S, data: o };
}
