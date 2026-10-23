// @ts-check
'use strict';
/* ================= KIT PIXELS (Studio plan Phase 5, T5.1) =================
   The picture steps of the Python kit builder (tools/build-kit-billies.py, retired in Studio plan Phase 5), number for number with Pillow, numpy and Python's colorsys, so a
   kit Billie baked here is pixel-equal to the one the Python builder made (tools/test/kit-bake-parity.test.mjs): a
   part scaled by Pillow's box filter to hard alpha, recoloured (a head keeps its face), its blink, its squash and
   stretch frames, mirrored copies, and Pillow's nearest-neighbour affine drawing, used to measure a figure.
   A picture is ImageData-shaped ({ width, height, data: RGBA bytes }). Logic only: no DOM, runs in Node. */
/** @typedef {{ width: number, height: number, data: Uint8ClampedArray }} Pixels */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { roundHalfEven, sheetBoxResize } from './sheet-slice.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  kitAffine: [() => kitAffine, v => (kitAffine = v)],
  kitBlank: [() => kitBlank],
  // @ts-expect-error -- replaced on purpose
  kitBlinkFrame: [() => kitBlinkFrame, v => (kitBlinkFrame = v)],
  kitCopy: [() => kitCopy],
  // @ts-expect-error -- replaced on purpose
  kitFaceMask: [() => kitFaceMask, v => (kitFaceMask = v)],
  // @ts-expect-error -- replaced on purpose
  kitFlipX: [() => kitFlipX, v => (kitFlipX = v)],
  // @ts-expect-error -- replaced on purpose
  kitFlipY: [() => kitFlipY, v => (kitFlipY = v)],
  // @ts-expect-error -- replaced on purpose
  kitHsvToRgb: [() => kitHsvToRgb, v => (kitHsvToRgb = v)],
  // @ts-expect-error -- replaced on purpose
  kitNearest: [() => kitNearest, v => (kitNearest = v)],
  // @ts-expect-error -- replaced on purpose
  kitOpaqueWidth: [() => kitOpaqueWidth, v => (kitOpaqueWidth = v)],
  // @ts-expect-error -- replaced on purpose
  kitPartScale: [() => kitPartScale, v => (kitPartScale = v)],
  // @ts-expect-error -- replaced on purpose
  kitPaste: [() => kitPaste, v => (kitPaste = v)],
  // @ts-expect-error -- replaced on purpose
  kitPilSatVal: [() => kitPilSatVal, v => (kitPilSatVal = v)],
  // @ts-expect-error -- replaced on purpose
  kitRecolour: [() => kitRecolour, v => (kitRecolour = v)],
  // @ts-expect-error -- replaced on purpose
  kitRecolourHead: [() => kitRecolourHead, v => (kitRecolourHead = v)],
  // @ts-expect-error -- replaced on purpose
  kitRgbToHsv: [() => kitRgbToHsv, v => (kitRgbToHsv = v)],
  // @ts-expect-error -- replaced on purpose
  kitRoundDigits: [() => kitRoundDigits, v => (kitRoundDigits = v)],
  // @ts-expect-error -- replaced on purpose
  kitSquashFrames: [() => kitSquashFrames, v => (kitSquashFrames = v)],
  pyMod1: [() => pyMod1],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a clear picture @param {number} w @param {number} h @returns {Pixels} */
export const kitBlank = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
/** a copy @param {Pixels} p @returns {Pixels} */
export const kitCopy = p => ({ width: p.width, height: p.height, data: new Uint8ClampedArray(p.data) });

/** Python's x % 1.0 for a float (the result takes the divisor's sign) @param {number} x */
export const pyMod1 = x => {
  const m = x % 1;
  return m < 0 ? m + 1 : m === 0 ? 0 : m;
};
/** Python's round(x, n) for a small n: a half goes to the even neighbour. A double is exactly halfway only when it is
 * a multiple of 2^-(n+1) (as sheet-slice.js roundThousandths); otherwise toFixed rounds it the same way.
 * @param {number} x @param {number} n */
export function kitRoundDigits(x, n) {
  const p = 10 ** n,
    s = x * p;
  if (Number.isInteger(s * 2) && !Number.isInteger(s) && Number.isInteger(x * 2 ** (n + 1)))
    return roundHalfEven(s) / p;
  return Number(x.toFixed(n));
}

/* ---------- colour (Python's colorsys, in doubles) ---------- */
/** @param {number} r @param {number} g @param {number} b @returns {[number, number, number]} */
export function kitRgbToHsv(r, g, b) {
  const maxc = Math.max(r, g, b),
    minc = Math.min(r, g, b),
    rangec = maxc - minc,
    v = maxc;
  if (minc === maxc) return [0, 0, v];
  const s = rangec / maxc,
    rc = (maxc - r) / rangec,
    gc = (maxc - g) / rangec,
    bc = (maxc - b) / rangec;
  let h;
  if (r === maxc) h = bc - gc;
  else if (g === maxc) h = 2.0 + rc - bc;
  else h = 4.0 + gc - rc;
  return [pyMod1(h / 6.0), s, v];
}
/** @param {number} h @param {number} s @param {number} v @returns {[number, number, number]} */
export function kitHsvToRgb(h, s, v) {
  if (s === 0.0) return [v, v, v];
  let i = Math.trunc(h * 6.0);
  const f = h * 6.0 - i,
    p = v * (1.0 - s),
    q = v * (1.0 - s * f),
    t = v * (1.0 - s * (1.0 - f));
  i = ((i % 6) + 6) % 6;
  if (i === 0) return [v, t, p];
  if (i === 1) return [q, v, p];
  if (i === 2) return [p, v, t];
  if (i === 3) return [p, q, v];
  if (i === 4) return [t, p, v];
  return [v, p, q];
}
/** Pillow's RGB -> HSV (Convert.c rgb2hsv) for one pixel: saturation and value, 0-255 (hue is not needed here)
 * @param {number} r @param {number} g @param {number} b @returns {[number, number]} */
export function kitPilSatVal(r, g, b) {
  const maxc = Math.max(r, g, b),
    minc = Math.min(r, g, b);
  if (minc === maxc) return [0, maxc];
  const s = Math.fround((maxc - minc) / maxc);
  return [Math.min(255, Math.max(0, Math.trunc(s * 255.0))), maxc];
}

/* ---------- a part, scaled and recoloured ---------- */
/** load_part: a kit part at f times its size, box-filtered as Pillow does (premultiplied twice, as the builder did),
 * then hard alpha (a pixel is there or it isn't) @param {Pixels} img @param {number} f @returns {Pixels} */
export function kitPartScale(img, f) {
  const w = img.width,
    h = img.height,
    ow = Math.max(1, roundHalfEven(w * f)),
    oh = Math.max(1, roundHalfEven(h * f)),
    pre = kitCopy(img);
  for (let i = 0; i < pre.data.length; i += 4) {
    const k = pre.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) pre.data[i + c] = Math.trunc(pre.data[i + c] * k);
  }
  /* Image.resize to the same size is a copy */
  const small = ow === w && oh === h ? pre : sheetBoxResize(pre, ow, oh),
    d = small.data,
    out = new Uint8ClampedArray(d.length);
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    for (let c = 0; c < 3; c++)
      out[i + c] = a > 0 ? Math.trunc(Math.min(255, Math.max(0, (d[i + c] * 255) / Math.max(a, 1)))) : 0;
    out[i + 3] = a >= 128 ? 255 : 0;
  }
  return { width: ow, height: oh, data: out };
}
/** recolour: move a picture to a colour [hue, saturation scale, value scale]; outlines (dark) and white highlights
 * stay. null leaves it as it is. @param {Pixels} img @param {number[] | null} col @returns {Pixels} */
export function kitRecolour(img, col) {
  if (!col) return img;
  const [hue, sat, val] = col,
    d = img.data,
    out = new Uint8ClampedArray(d.length);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255,
      g = d[i + 1] / 255,
      b = d[i + 2] / 255;
    const al = d[i + 3] / 255;
    if (al > 0) {
      const [, s, v] = kitRgbToHsv(r, g, b);
      if (!(v < 0.22) && !(s < 0.12 && v > 0.85))
        [r, g, b] = kitHsvToRgb(hue, Math.min(1.0, Math.max(s, 0.12) * sat), Math.min(1.0, v * val));
    }
    out[i] = roundHalfEven(r * 255);
    out[i + 1] = roundHalfEven(g * 255);
    out[i + 2] = roundHalfEven(b * 255);
    out[i + 3] = roundHalfEven(al * 255);
  }
  return { width: img.width, height: img.height, data: out };
}
/** face_mask: a head's face (eyes, nose, mouth: the darkest and the most saturated pixels) @param {Pixels} head */
export function kitFaceMask(head) {
  const d = head.data,
    n = head.width * head.height,
    m = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (!d[i + 3]) continue;
    const [s, v] = kitPilSatVal(d[i], d[i + 1], d[i + 2]);
    if (v < 90 || (s > 120 && v > 140)) m[p] = 1;
  }
  return m;
}
/** recolour_head: recoloured with the face kept as drawn @param {Pixels} head @param {number[] | null} col */
export function kitRecolourHead(head, col) {
  if (!col) return head;
  const out = kitRecolour(head, col),
    m = kitFaceMask(head);
  for (let p = 0; p < m.length; p++) if (m[p]) out.data.set(head.data.subarray(p * 4, p * 4 + 4), p * 4);
  return out;
}

/* ---------- mirrors, frames, widths ---------- */
/** FLIP_LEFT_RIGHT @param {Pixels} p @returns {Pixels} */
export function kitFlipX(p) {
  const o = kitBlank(p.width, p.height);
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++)
      o.data.set(
        p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 4),
        (y * p.width + p.width - 1 - x) * 4
      );
  return o;
}
/** FLIP_TOP_BOTTOM @param {Pixels} p @returns {Pixels} */
export function kitFlipY(p) {
  const o = kitBlank(p.width, p.height),
    row = p.width * 4;
  for (let y = 0; y < p.height; y++) o.data.set(p.data.subarray(y * row, (y + 1) * row), (p.height - 1 - y) * row);
  return o;
}
/** the width of the columns that hold any pixel @param {Pixels} p */
export function kitOpaqueWidth(p) {
  let x0 = Infinity,
    x1 = -1;
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++)
      if (p.data[(y * p.width + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
  return x1 < 0 ? 0 : x1 - x0 + 1;
}
/** Pillow's affine transform, nearest neighbour (Geometry.c): out(x, y) = in(a0 x + a1 y + a2, a3 x + a4 y + a5) at
 * pixel middles, clear outside. Pure scaling takes Pillow's ImagingScaleAffine path (doubles, stepped); anything
 * turned its 16.16 fixed-point path. @param {Pixels} src @param {number} W @param {number} H @param {number[]} a */
export function kitAffine(src, W, H, a) {
  const out = kitBlank(W, H),
    iw = src.width,
    ih = src.height,
    put = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ xi, /** @type {number} */ yi) =>
      out.data.set(src.data.subarray((yi * iw + xi) * 4, (yi * iw + xi) * 4 + 4), (y * W + x) * 4);
  const COORD = (/** @type {number} */ v) => (v < 0 ? -1 : Math.trunc(v));
  if (a[1] === 0 && a[3] === 0) {
    let xo = a[2] + a[0] * 0.5,
      yo = a[5] + a[4] * 0.5,
      xmin = W,
      xmax = 0;
    const xin = new Int32Array(W);
    for (let x = 0; x < W; x++) {
      const v = COORD(xo);
      if (v >= 0 && v < iw) {
        xmax = x + 1;
        if (x < xmin) xmin = x;
        xin[x] = v;
      }
      xo += a[0];
    }
    for (let y = 0; y < H; y++) {
      const yi = COORD(yo);
      if (yi >= 0 && yi < ih) for (let x = xmin; x < xmax; x++) put(x, y, xin[x], yi);
      yo += a[4];
    }
    return out;
  }
  const FIX = (/** @type {number} */ v) => Math.floor(v * 65536.0 + 0.5),
    a0 = FIX(a[0]),
    a1 = FIX(a[1]),
    a3 = FIX(a[3]),
    a4 = FIX(a[4]);
  let xo = FIX(a[2] + a[1] * 0.5 + a[0] * 0.5),
    yo = FIX(a[5] + a[4] * 0.5 + a[3] * 0.5);
  for (let y = 0; y < H; y++) {
    let xx = xo,
      yy = yo;
    for (let x = 0; x < W; x++) {
      const xi = xx >> 16;
      if (xi >= 0 && xi < iw) {
        const yi = yy >> 16;
        if (yi >= 0 && yi < ih) put(x, y, xi, yi);
      }
      xx += a0;
      yy += a3;
    }
    xo += a1;
    yo += a4;
  }
  return out;
}
/** Image.resize(size, NEAREST) (Pillow's scaling path; the same size is a copy) @param {Pixels} p @param {number} w
 * @param {number} h */
export function kitNearest(p, w, h) {
  if (w === p.width && h === p.height) return kitCopy(p);
  return kitAffine(p, w, h, [p.width / w, 0, 0, 0, p.height / h, 0]);
}
/** alpha_composite of a hard-alpha picture onto another at (x, y): its pixels replace what is under them
 * @param {Pixels} dst @param {Pixels} src @param {number} x @param {number} y */
export function kitPaste(dst, src, x, y) {
  for (let v = 0; v < src.height; v++)
    for (let u = 0; u < src.width; u++) {
      const X = x + u,
        Y = y + v,
        i = (v * src.width + u) * 4;
      if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height || !src.data[i + 3]) continue;
      dst.data.set(src.data.subarray(i, i + 4), (Y * dst.width + X) * 4);
    }
}
/** squash_frames: a torso padded by `pad`, and its squashed (wider, lower) and stretched (thinner, taller) frames on
 * the same ground and middle @param {Pixels} im @param {number} pad @param {Record<string, [number, number]>} shapes
 * @returns {Record<string, Pixels>} */
export function kitSquashFrames(im, pad, shapes) {
  const w = im.width,
    h = im.height,
    W = w + 2 * pad,
    H = h + 2 * pad,
    /** @type {Record<string, Pixels>} */ out = {};
  for (const [name, [fx, fy]] of Object.entries(shapes)) {
    const nw = Math.max(1, Math.min(W, roundHalfEven(w * fx))),
      nh = Math.max(1, Math.min(H, roundHalfEven(h * fy))),
      c = kitBlank(W, H);
    kitPaste(c, kitNearest(im, nw, nh), Math.floor((W - nw) / 2), H - pad - nh);
    out[name] = c;
  }
  return out;
}

/* ---------- the blink ---------- */
/** blink_frame: the head with its eyes shut: each eye (a dark blob inside the face, with its highlight) painted over
 * with the skin round it and a closed-lid line across its lower middle. null if no pair of eyes is found.
 * @param {Pixels} head @returns {Pixels | null} */
export function kitBlinkFrame(head) {
  const w = head.width,
    h = head.height,
    a = kitCopy(head).data,
    n = w * h,
    al = new Uint8Array(n),
    sat = new Int32Array(n),
    val = new Int32Array(n);
  for (let p = 0; p < n; p++) {
    al[p] = a[p * 4 + 3] > 0 ? 1 : 0;
    [sat[p], val[p]] = kitPilSatVal(a[p * 4], a[p * 4 + 1], a[p * 4 + 2]);
  }
  const dark = (/** @type {number} */ p) => al[p] && val[p] < 70;
  /* the outline: within 2 px of a clear pixel (np.roll wraps round the edges) */
  const edge = new Uint8Array(n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let e = 0;
      for (let dy = -2; dy <= 2 && !e; dy++)
        for (let dx = -2; dx <= 2; dx++)
          if (!al[((((y + dy) % h) + h) % h) * w + ((((x + dx) % w) + w) % w)]) {
            e = 1;
            break;
          }
      edge[y * w + x] = e;
    }
  const inner = new Uint8Array(n);
  for (let p = 0; p < n; p++) inner[p] = dark(p) && !edge[p] ? 1 : 0;
  /* connected blobs, 4-connected */
  const seen = new Uint8Array(n),
    /** @type {number[][]} */ eyes = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inner[y * w + x] || seen[y * w + x]) continue;
      const st = [[y, x]],
        pts = [];
      seen[y * w + x] = 1;
      while (st.length) {
        const [cy, cx] = /** @type {number[]} */ (st.pop());
        pts.push([cy, cx]);
        for (const [ny, nx] of [
          [cy + 1, cx],
          [cy - 1, cx],
          [cy, cx + 1],
          [cy, cx - 1],
        ])
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && inner[ny * w + nx] && !seen[ny * w + nx]) {
            seen[ny * w + nx] = 1;
            st.push([ny, nx]);
          }
      }
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity,
        sy = 0,
        sx = 0;
      for (const [py, px] of pts) {
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
        sy += py;
        sx += px;
      }
      const bw = x1 - x0 + 1,
        bh = y1 - y0 + 1,
        cy = sy / pts.length,
        cx = sx / pts.length;
      if (
        pts.length >= 3 &&
        pts.length <= w * h * 0.08 &&
        bw >= 2 &&
        bw <= w * 0.3 &&
        bh >= 2 &&
        bh <= h * 0.35 &&
        h * 0.2 < cy &&
        cy < h * 0.75 &&
        Math.abs(cx - w / 2) > w * 0.1
      )
        eyes.push([x0, y0, x1, y1]);
    }
  const left = eyes.filter(e => (e[0] + e[2]) / 2 < w / 2),
    right = eyes.filter(e => (e[0] + e[2]) / 2 >= w / 2);
  if (!left.length || !right.length) return null;
  const area = (/** @type {number[]} */ e) => (e[2] - e[0] + 1) * (e[3] - e[1] + 1),
    biggest = (/** @type {number[][]} */ l) => l.reduce((m, e) => (area(e) > area(m) ? e : m)),
    L = biggest(left),
    R = biggest(right);
  if (Math.abs((L[1] + L[3]) / 2 - (R[1] + R[3]) / 2) > Math.max(2, h * 0.08)) return null;
  /* the lid line: the mean of the dark pixels (numpy casts it down to bytes) */
  let line = [40, 30, 30, 255];
  {
    const sum = [0, 0, 0, 0];
    let cnt = 0;
    for (let p = 0; p < n; p++)
      if (dark(p)) {
        cnt++;
        for (let c = 0; c < 4; c++) sum[c] += a[p * 4 + c];
      }
    if (cnt) line = sum.map(s => Math.trunc(s / cnt));
  }
  const eyeish = new Uint8Array(n);
  for (let p = 0; p < n; p++) eyeish[p] = al[p] && !edge[p] && (val[p] < 140 || (sat[p] < 46 && val[p] > 200)) ? 1 : 0;
  for (const [x0, y0, x1, y1] of [L, R]) {
    const X0 = Math.max(0, x0 - 1),
      Y0 = Math.max(0, y0 - 1),
      X1 = Math.min(w - 1, x1 + 1),
      Y1 = Math.min(h - 1, y1 + 1);
    /* the skin: the median of the fur in a ring round the eye that is not part of it */
    const ring = [];
    for (let y = Math.max(0, Y0 - 2); y < Math.min(h, Y1 + 3); y++)
      for (let x = Math.max(0, X0 - 2); x < Math.min(w, X1 + 3); x++) {
        const p = y * w + x;
        if ((X0 <= x && x <= X1 && Y0 <= y && y <= Y1) || !al[p] || edge[p] || eyeish[p]) continue;
        ring.push(Array.from(a.subarray(p * 4, p * 4 + 4)));
      }
    let skin;
    if (ring.length)
      skin = [0, 1, 2, 3].map(c => {
        const v = ring.map(r => r[c]).sort((p, q) => p - q),
          m = v.length >> 1;
        return roundHalfEven(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2);
      });
    else skin = Array.from(a.subarray((y0 * w + x0) * 4, (y0 * w + x0) * 4 + 4));
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) if (eyeish[y * w + x]) a.set(skin, (y * w + x) * 4);
    const ly = y0 + roundHalfEven((y1 - y0) * 0.6);
    for (let x = x0; x <= x1; x++) a.set(line, (ly * w + x) * 4);
  }
  return { width: w, height: h, data: a };
}
