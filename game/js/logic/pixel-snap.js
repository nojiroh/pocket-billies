// @ts-check
'use strict';
/* ================= PIXEL SNAP (studio track ST-3) =================
   Pixel art drawn big (an AI image at about 4x, a screenshot, an upscale) back to true-scale pixels: find the size of
   its big pixels and where their grid starts, then give each cell its most common colour. Colours are counted in
   buckets (16 shades a channel) so the noise of an AI image doesn't split a colour; the cell gets the mean of the
   winning bucket. A cell mostly clear stays clear. Logic only: no DOM, runs in Node (tools/test/pixel-snap.test.mjs). */
/** @typedef {{ width: number, height: number, data: Uint8ClampedArray }} Pixels */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  SNAP_EDGE: [() => SNAP_EDGE],
  SNAP_NEAR: [() => SNAP_NEAR],
  // @ts-expect-error -- replaced on purpose
  edgeEnergy: [() => edgeEnergy, v => (edgeEnergy = v)],
  // @ts-expect-error -- replaced on purpose
  gridScores: [() => gridScores, v => (gridScores = v)],
  // @ts-expect-error -- replaced on purpose
  snapDetect: [() => snapDetect, v => (snapDetect = v)],
  // @ts-expect-error -- replaced on purpose
  snapToPixels: [() => snapToPixels, v => (snapToPixels = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** how far (a channel) a pixel may be from its cell's colour to count towards it */
export const SNAP_NEAR = 20;
/** a change between neighbours under this (the four channels added up) is noise, not an edge */
export const SNAP_EDGE = 48;
/** how much the colour changes between neighbours along x (axis 0) or y (axis 1), summed over the other axis */
export function edgeEnergy(/** @type {Pixels} */ img, /** @type {number} */ axis) {
  const { width: w, height: h, data: d } = img,
    n = axis ? h : w,
    e = new Float64Array(n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (axis ? !y : !x) continue;
      const i = (y * w + x) * 4,
        j = axis ? i - w * 4 : i - 4;
      let s = 0;
      for (let c = 0; c < 4; c++) s += Math.abs(d[i + c] - d[j + c]);
      if (s > SNAP_EDGE) e[axis ? y : x] += s;
    }
  return e;
}
/** for each size, the grid offset that leaves the least change between its lines, and how much change is left
    there (a share of the average: near 0 when every edge sits on the grid) */
export function gridScores(/** @type {Float64Array} */ e, /** @type {number} */ maxScale) {
  let total = 0;
  for (let i = 1; i < e.length; i++) total += e[i];
  const mean = total / Math.max(1, e.length - 1),
    out = [];
  for (let s = 2; s <= maxScale; s++) {
    let best = Infinity,
      at = 0;
    for (let o = 0; o < s; o++) {
      let sum = 0,
        n = 0;
      for (let i = 1; i < e.length; i++) if (i % s !== o) ((sum += e[i]), n++);
      const v = n && mean ? sum / n / mean : 1;
      if (v < best) ((best = v), (at = o));
    }
    out.push({ s, o: at, v: best });
  }
  return out;
}
/** the size of the big pixels and where their grid starts: { scale, ox, oy, left } (left: the change left between
    grid lines, near 0 for a clean grid). A picture with no clear grid gives scale 1.
    Halves of the real size are clean too (their lines include the real ones) and multiples are not (they skip real
    lines), so the largest clean size is the real one. */
export function snapDetect(/** @type {Pixels} */ img, maxScale = 16) {
  const X = gridScores(edgeEnergy(img, 0), maxScale),
    Y = gridScores(edgeEnergy(img, 1), maxScale),
    both = X.map((x, i) => ({ s: x.s, ox: x.o, oy: Y[i].o, v: (x.v + Y[i].v) / 2 })),
    low = Math.min(...both.map(b => b.v));
  if (!both.length || low > 0.6) return { scale: 1, ox: 0, oy: 0, left: low };
  const clean = both.filter(b => b.v <= Math.max(low * 1.5, low + 0.05)),
    pick = clean[clean.length - 1];
  return { scale: pick.s, ox: pick.ox, oy: pick.oy, left: pick.v };
}
/** the picture at true scale: each scale x scale cell (the grid starting at ox, oy) becomes one pixel */
export function snapToPixels(/** @type {Pixels} */ img, /** @type {number} */ scale, ox = 0, oy = 0) {
  const s = Math.max(1, Math.round(scale)),
    x0 = (((ox % s) + s) % s) - (ox % s ? s : 0),
    y0 = (((oy % s) + s) % s) - (oy % s ? s : 0),
    w = Math.ceil((img.width - x0) / s),
    h = Math.ceil((img.height - y0) / s),
    out = new Uint8ClampedArray(w * h * 4),
    d = img.data;
  for (let cy = 0; cy < h; cy++)
    for (let cx = 0; cx < w; cx++) {
      /** @type {Map<number, number[]>} */
      const buckets = new Map();
      let seen = 0,
        clear = 0;
      for (let y = y0 + cy * s; y < y0 + (cy + 1) * s; y++)
        for (let x = x0 + cx * s; x < x0 + (cx + 1) * s; x++) {
          if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
          const i = (y * img.width + x) * 4;
          seen++;
          if (d[i + 3] < 128) {
            clear++;
            continue;
          }
          const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4),
            b = buckets.get(k) || [0, 0, 0, 0];
          b[0]++;
          b[1] += d[i];
          b[2] += d[i + 1];
          b[3] += d[i + 2];
          buckets.set(k, b);
        }
      if (!seen || clear * 2 >= seen) continue;
      /** @type {number[] | null} */
      let win = null;
      for (const b of buckets.values()) if (!win || b[0] > win[0]) win = b;
      if (!win) continue;
      /* the winning bucket's mean, then the mean of every pixel near it (a colour on a bucket's edge is split) */
      const m = [win[1] / win[0], win[2] / win[0], win[3] / win[0]],
        sum = [0, 0, 0];
      let n = 0;
      for (let y = Math.max(0, y0 + cy * s); y < Math.min(img.height, y0 + (cy + 1) * s); y++)
        for (let x = Math.max(0, x0 + cx * s); x < Math.min(img.width, x0 + (cx + 1) * s); x++) {
          const i = (y * img.width + x) * 4;
          if (d[i + 3] < 128 || [0, 1, 2].some(k => Math.abs(d[i + k] - m[k]) > SNAP_NEAR)) continue;
          for (let k = 0; k < 3; k++) sum[k] += d[i + k];
          n++;
        }
      const o = (cy * w + cx) * 4;
      for (let k = 0; k < 3; k++) out[o + k] = Math.round(n ? sum[k] / n : m[k]);
      out[o + 3] = 255;
    }
  return { width: w, height: h, data: out };
}
