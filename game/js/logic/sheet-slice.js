// @ts-check
'use strict';
/* ================= SHEET SLICE (studio track ST-3) =================
   Cutting a sheet of art into parts, as numbers: which pixels are background (a key colour, the kits' magenta, or
   clear pixels), islands of art (4- or 8-connected, pieces closer than a gap joined, specks under a minimum area
   dropped), a template grid, rows found by their gaps, trimming, names from a template, front and back matched, an
   Aseprite JSON's frames and slices, and the phase 16 kits exactly as tools/slice-part-kit.py cut them (its scipy
   steps and Pillow's box filter, number for number; tools/test/sheet-slice-parity.test.mjs checks every part).
   A picture is ImageData-shaped ({ width, height, data: RGBA bytes }); a mask is one byte per pixel (1 = art).
   Logic only: no DOM, runs in Node. studio/js/workbench.js puts it on the page. */
/** @typedef {{ width: number, height: number, data: Uint8ClampedArray }} Pixels */
/** @typedef {{ x: number, y: number, w: number, h: number }} SheetBox x, y, width, height in sheet pixels */
/** @typedef {SheetBox & { cx: number, cy: number, area: number, mask: Uint8Array }} SheetIsland mask: the art inside the box */
/** @typedef {'magenta' | 'clear' | { rgb: number[], tol?: number }} SheetKey what the background is */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  LIMB_KINDS: [() => LIMB_KINDS],
  PRECISION_BITS: [() => PRECISION_BITS],
  SHEET_KIT_DEFAULTS: [() => SHEET_KIT_DEFAULTS],
  // @ts-expect-error -- replaced on purpose
  asepriteBoxes: [() => asepriteBoxes, v => (asepriteBoxes = v)],
  // @ts-expect-error -- replaced on purpose
  boxCoeffs: [() => boxCoeffs, v => (boxCoeffs = v)],
  clip8: [() => clip8],
  // @ts-expect-error -- replaced on purpose
  maskDilate: [() => maskDilate, v => (maskDilate = v)],
  // @ts-expect-error -- replaced on purpose
  maskErode: [() => maskErode, v => (maskErode = v)],
  // @ts-expect-error -- replaced on purpose
  maskLabel: [() => maskLabel, v => (maskLabel = v)],
  // @ts-expect-error -- replaced on purpose
  premultiply: [() => premultiply, v => (premultiply = v)],
  // @ts-expect-error -- replaced on purpose
  roundHalfEven: [() => roundHalfEven, v => (roundHalfEven = v)],
  // @ts-expect-error -- replaced on purpose
  roundThousandths: [() => roundThousandths, v => (roundThousandths = v)],
  // @ts-expect-error -- replaced on purpose
  sheetArtBox: [() => sheetArtBox, v => (sheetArtBox = v)],
  // @ts-expect-error -- replaced on purpose
  sheetAutoSockets: [() => sheetAutoSockets, v => (sheetAutoSockets = v)],
  // @ts-expect-error -- replaced on purpose
  sheetBoxResize: [() => sheetBoxResize, v => (sheetBoxResize = v)],
  // @ts-expect-error -- replaced on purpose
  sheetCellIsland: [() => sheetCellIsland, v => (sheetCellIsland = v)],
  // @ts-expect-error -- replaced on purpose
  sheetCrop: [() => sheetCrop, v => (sheetCrop = v)],
  // @ts-expect-error -- replaced on purpose
  sheetEdgeColor: [() => sheetEdgeColor, v => (sheetEdgeColor = v)],
  // @ts-expect-error -- replaced on purpose
  sheetGridBoxes: [() => sheetGridBoxes, v => (sheetGridBoxes = v)],
  // @ts-expect-error -- replaced on purpose
  sheetIslands: [() => sheetIslands, v => (sheetIslands = v)],
  // @ts-expect-error -- replaced on purpose
  sheetKitEntry: [() => sheetKitEntry, v => (sheetKitEntry = v)],
  // @ts-expect-error -- replaced on purpose
  sheetKitScale: [() => sheetKitScale, v => (sheetKitScale = v)],
  // @ts-expect-error -- replaced on purpose
  sheetMask: [() => sheetMask, v => (sheetMask = v)],
  // @ts-expect-error -- replaced on purpose
  sheetMatchViews: [() => sheetMatchViews, v => (sheetMatchViews = v)],
  // @ts-expect-error -- replaced on purpose
  sheetName: [() => sheetName, v => (sheetName = v)],
  // @ts-expect-error -- replaced on purpose
  sheetPiece: [() => sheetPiece, v => (sheetPiece = v)],
  // @ts-expect-error -- replaced on purpose
  sheetRows: [() => sheetRows, v => (sheetRows = v)],
  // @ts-expect-error -- replaced on purpose
  sheetSliceKit: [() => sheetSliceKit, v => (sheetSliceKit = v)],
  // @ts-expect-error -- replaced on purpose
  sheetTrim: [() => sheetTrim, v => (sheetTrim = v)],
  // @ts-expect-error -- replaced on purpose
  unpremultiply: [() => unpremultiply, v => (unpremultiply = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** Python's round(): a half goes to the even neighbour */
export function roundHalfEven(/** @type {number} */ x) {
  const f = Math.floor(x),
    d = x - f;
  if (d !== 0.5) return d < 0.5 ? f : f + 1;
  return f % 2 === 0 ? f : f + 1;
}
/** Python's round(x, 3). A double is exactly halfway between thousandths only at an odd multiple of 1/16. */
export function roundThousandths(/** @type {number} */ x) {
  const s = x * 16;
  if (Number.isInteger(s) && s % 2 !== 0) return roundHalfEven(x * 1000) / 1000;
  return Number(x.toFixed(3));
}

/* ---------- background and art ---------- */
/** 1 where the picture is art, 0 where it is background */
export function sheetMask(/** @type {Pixels} */ img, /** @type {SheetKey} */ key = 'clear') {
  const { width: w, height: h, data: d } = img,
    m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4],
      g = d[i * 4 + 1],
      b = d[i * 4 + 2],
      a = d[i * 4 + 3];
    let bg;
    if (key === 'magenta') bg = r > 150 && b > 150 && g < 120 && Math.abs(r - b) < 70;
    else if (key === 'clear' || !key) bg = a < 128;
    else {
      const t = key.tol ?? 24;
      bg = a < 128 || (Math.abs(r - key.rgb[0]) <= t && Math.abs(g - key.rgb[1]) <= t && Math.abs(b - key.rgb[2]) <= t);
    }
    m[i] = bg ? 0 : 1;
  }
  return m;
}
/** the most common colour along the picture's edge (the likely background), as [r, g, b] */
export function sheetEdgeColor(/** @type {Pixels} */ img) {
  const { width: w, height: h, data: d } = img,
    count = new Map();
  let best = [0, 0, 0],
    most = 0;
  const see = (/** @type {number} */ x, /** @type {number} */ y) => {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 128) return;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2],
      n = (count.get(k) || 0) + 1;
    count.set(k, n);
    if (n > most) ((most = n), (best = [d[i], d[i + 1], d[i + 2]]));
  };
  for (let x = 0; x < w; x++) (see(x, 0), see(x, h - 1));
  for (let y = 1; y < h - 1; y++) (see(0, y), see(w - 1, y));
  return most ? best : null;
}
/** binary erosion with a cross (scipy's default); outside the picture counts as background */
export function maskErode(
  /** @type {Uint8Array} */ m,
  /** @type {number} */ w,
  /** @type {number} */ h,
  /** @type {number} */ n = 1
) {
  let a = m;
  for (let k = 0; k < n; k++) {
    const o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        o[i] = a[i] && x > 0 && x < w - 1 && y > 0 && y < h - 1 && a[i - 1] && a[i + 1] && a[i - w] && a[i + w] ? 1 : 0;
      }
    a = o;
  }
  return a;
}
/** binary dilation with a cross (diagonals too when `square`) */
export function maskDilate(
  /** @type {Uint8Array} */ m,
  /** @type {number} */ w,
  /** @type {number} */ h,
  /** @type {number} */ n = 1,
  square = false
) {
  let a = m;
  for (let k = 0; k < n; k++) {
    const o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!a[i]) continue;
        o[i] = 1;
        if (x > 0) o[i - 1] = 1;
        if (x < w - 1) o[i + 1] = 1;
        if (y > 0) o[i - w] = 1;
        if (y < h - 1) o[i + w] = 1;
        if (square) {
          if (x > 0 && y > 0) o[i - w - 1] = 1;
          if (x < w - 1 && y > 0) o[i - w + 1] = 1;
          if (x > 0 && y < h - 1) o[i + w - 1] = 1;
          if (x < w - 1 && y < h - 1) o[i + w + 1] = 1;
        }
      }
    a = o;
  }
  return a;
}
/** islands of a mask, numbered from 1 in the order a row-by-row scan meets them (as scipy's label); 0 is background */
export function maskLabel(
  /** @type {Uint8Array} */ m,
  /** @type {number} */ w,
  /** @type {number} */ h,
  /** @type {4 | 8} */ conn = 4
) {
  const lab = new Int32Array(w * h),
    parent = [0];
  const find = (/** @type {number} */ a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  const join = (/** @type {number} */ a, /** @type {number} */ b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!m[i]) continue;
      const near = [];
      if (x > 0 && lab[i - 1]) near.push(lab[i - 1]);
      if (y > 0 && lab[i - w]) near.push(lab[i - w]);
      if (conn === 8 && y > 0) {
        if (x > 0 && lab[i - w - 1]) near.push(lab[i - w - 1]);
        if (x < w - 1 && lab[i - w + 1]) near.push(lab[i - w + 1]);
      }
      if (!near.length) {
        parent.push(parent.length);
        lab[i] = parent.length - 1;
      } else {
        lab[i] = near[0];
        for (const q of near) join(near[0], q);
      }
    }
  /* final numbers in the order of each island's first pixel */
  const num = new Int32Array(parent.length);
  let count = 0;
  for (let i = 0; i < w * h; i++)
    if (lab[i]) {
      const r = find(lab[i]);
      if (!num[r]) num[r] = ++count;
      lab[i] = num[r];
    }
  return { labels: lab, count };
}

/* ---------- islands, rows, grid ---------- */
/** the art's islands: { key, clean (an opening of this many steps), gap (pieces this close are one), minArea, conn } */
export function sheetIslands(/** @type {Pixels} */ img, o = /** @type {any} */ ({})) {
  const { width: w, height: h } = img;
  /** @type {Uint8Array} */
  let fg = sheetMask(img, o.key);
  if (o.clean) fg = maskDilate(maskErode(fg, w, h, o.clean), w, h, o.clean);
  const grouped = o.gap ? maskDilate(fg, w, h, o.gap, o.conn === 8) : fg,
    { labels, count } = maskLabel(grouped, w, h, o.conn || 4),
    x0 = new Int32Array(count + 1).fill(w),
    y0 = new Int32Array(count + 1).fill(h),
    x1 = new Int32Array(count + 1),
    y1 = new Int32Array(count + 1),
    area = new Int32Array(count + 1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        l = labels[i];
      if (!l) continue;
      if (x < x0[l]) x0[l] = x;
      if (x >= x1[l]) x1[l] = x + 1;
      if (y < y0[l]) y0[l] = y;
      if (y >= y1[l]) y1[l] = y + 1;
      if (fg[i]) area[l]++;
    }
  /** @type {SheetIsland[]} */
  const out = [];
  for (let l = 1; l <= count; l++) {
    if (area[l] < (o.minArea || 1)) continue;
    const bw = x1[l] - x0[l],
      bh = y1[l] - y0[l],
      mask = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const i = (y + y0[l]) * w + x + x0[l];
        mask[y * bw + x] = fg[i] && labels[i] === l ? 1 : 0;
      }
    out.push({
      x: x0[l],
      y: y0[l],
      w: bw,
      h: bh,
      cx: (x0[l] + x1[l]) / 2,
      cy: (y0[l] + y1[l]) / 2,
      area: area[l],
      mask,
    });
  }
  return out;
}
/** items (with cx, cy) split into `count` rows at the biggest gaps between their centres, each row left to right */
export function sheetRows(/** @type {SheetIsland[]} */ items, /** @type {number} */ count) {
  const s = [...items].sort((a, b) => a.cy - b.cy),
    gaps = Array.from({ length: Math.max(0, s.length - 1) }, (_, k) => k + 1).sort(
      (a, b) => s[b].cy - s[b - 1].cy - (s[a].cy - s[a - 1].cy)
    ),
    cuts = gaps.slice(0, Math.max(0, count - 1)).sort((a, b) => a - b),
    rows = [];
  let start = 0;
  for (const c of [...cuts, s.length]) {
    rows.push(s.slice(start, c).sort((a, b) => a.cx - b.cx));
    start = c;
  }
  return rows;
}
/** the cells of a template grid: { cols, rows, x, y, cellW, cellH, gapX, gapY }, row by row */
export function sheetGridBoxes(o = /** @type {any} */ ({})) {
  /** @type {(SheetBox & { row: number, col: number })[]} */
  const out = [];
  for (let r = 0; r < (o.rows || 1); r++)
    for (let c = 0; c < (o.cols || 1); c++)
      out.push({
        x: (o.x || 0) + c * (o.cellW + (o.gapX || 0)),
        y: (o.y || 0) + r * (o.cellH + (o.gapY || 0)),
        w: o.cellW,
        h: o.cellH,
        row: r,
        col: c,
      });
  return out;
}
/** a template cell's art as an island (background left out, trimmed to the art), or null when the cell is empty */
export function sheetCellIsland(/** @type {Pixels} */ img, /** @type {SheetBox} */ b, /** @type {SheetKey} */ key) {
  const bx = Math.max(0, b.x),
    by = Math.max(0, b.y),
    bw = Math.min(img.width, b.x + b.w) - bx,
    bh = Math.min(img.height, b.y + b.h) - by;
  if (bw <= 0 || bh <= 0) return null;
  const cell = sheetCrop(img, { x: bx, y: by, w: bw, h: bh }),
    m = sheetMask(cell, key);
  let x0 = bw,
    y0 = bh,
    x1 = 0,
    y1 = 0,
    area = 0;
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++)
      if (m[y * bw + x]) {
        area++;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
  if (!area) return null;
  const w = x1 - x0,
    h = y1 - y0,
    mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = m[(y + y0) * bw + x + x0];
  return { x: bx + x0, y: by + y0, w, h, cx: bx + x0 + w / 2, cy: by + y0 + h / 2, area, mask };
}

/* ---------- pieces ---------- */
/** a box of a picture, as a new picture */
export function sheetCrop(/** @type {Pixels} */ img, /** @type {SheetBox} */ b) {
  const out = { width: b.w, height: b.h, data: new Uint8ClampedArray(b.w * b.h * 4) };
  for (let y = 0; y < b.h; y++) {
    const from = ((b.y + y) * img.width + b.x) * 4;
    out.data.set(img.data.subarray(from, from + b.w * 4), y * b.w * 4);
  }
  return out;
}
/** an island cut out: its box's colours, clear outside its art (and `erode` pixels in from the art's edge) */
export function sheetPiece(/** @type {Pixels} */ img, /** @type {SheetIsland} */ it, erode = 0) {
  const p = sheetCrop(img, it),
    m = erode ? maskErode(it.mask, it.w, it.h, erode) : it.mask;
  for (let i = 0; i < it.w * it.h; i++) p.data[i * 4 + 3] = m[i] ? 255 : 0;
  return p;
}
/** the box around a picture's art (alpha above 0), or null when there is none */
export function sheetArtBox(/** @type {Pixels} */ p) {
  let x0 = p.width,
    y0 = p.height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++)
      if (p.data[(y * p.width + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/** a picture cut down to its art (a picture with none stays as it is) */
export function sheetTrim(/** @type {Pixels} */ p) {
  const b = sheetArtBox(p);
  return b ? sheetCrop(p, b) : p;
}

/* ---------- Pillow's box filter (Resample.c, 8 bits a channel), for the kits' exact parity ---------- */
export const PRECISION_BITS = 22;
export function boxCoeffs(/** @type {number} */ inSize, /** @type {number} */ outSize) {
  const scale = inSize / outSize,
    filterscale = Math.max(1, scale),
    support = 0.5 * filterscale,
    ksize = Math.ceil(support) * 2 + 1,
    bounds = new Int32Array(outSize * 2),
    kk = new Int32Array(outSize * ksize);
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale,
      ss = 1 / filterscale;
    const xmin = Math.max(0, Math.trunc(center - support + 0.5));
    let xmax = Math.min(inSize, Math.trunc(center + support + 0.5));
    xmax -= xmin;
    const k = new Float64Array(xmax);
    let ww = 0;
    for (let x = 0; x < xmax; x++) {
      const t = (x + xmin - center + 0.5) * ss,
        v = t > -0.5 && t <= 0.5 ? 1 : 0;
      k[x] = v;
      ww += v;
    }
    for (let x = 0; x < xmax; x++) {
      const v = ww !== 0 ? k[x] / ww : k[x];
      kk[xx * ksize + x] = Math.trunc(v < 0 ? -0.5 + v * (1 << PRECISION_BITS) : 0.5 + v * (1 << PRECISION_BITS));
    }
    bounds[xx * 2] = xmin;
    bounds[xx * 2 + 1] = xmax;
  }
  return { ksize, bounds, kk };
}
export const clip8 = (/** @type {number} */ ss) => {
  const v = Math.floor(ss / (1 << PRECISION_BITS));
  return v < 0 ? 0 : v > 255 ? 255 : v;
};
/** Pillow's RGBA -> premultiplied (MULDIV255) */
export function premultiply(/** @type {Uint8ClampedArray} */ d) {
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    for (let c = 0; c < 3; c++) {
      const t = d[i + c] * a + 128;
      d[i + c] = ((t >> 8) + t) >> 8;
    }
  }
}
/** Pillow's premultiplied -> RGBA */
export function unpremultiply(/** @type {Uint8ClampedArray} */ d) {
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0 || a === 255) continue;
    for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.floor((255 * d[i + c]) / a));
  }
}
/** Image.resize(size, Image.BOX) of an RGBA picture, exactly as Pillow does it */
export function sheetBoxResize(/** @type {Pixels} */ img, /** @type {number} */ ow, /** @type {number} */ oh) {
  const iw = img.width,
    ih = img.height,
    src = new Uint8ClampedArray(img.data);
  premultiply(src);
  const H = boxCoeffs(iw, ow),
    V = boxCoeffs(ih, oh);
  let cur = src,
    cw = iw,
    ch = ih;
  const needH = ow !== iw,
    needV = oh !== ih;
  const yFirst = V.bounds[0],
    yLast = V.bounds[oh * 2 - 2] + V.bounds[oh * 2 - 1];
  const vb = Int32Array.from(V.bounds);
  if (needH) {
    if (needV) for (let i = 0; i < oh; i++) vb[i * 2] -= yFirst;
    const rows = needV ? yLast - yFirst : ih,
      off = needV ? yFirst : 0,
      tmp = new Uint8ClampedArray(ow * rows * 4);
    for (let y = 0; y < rows; y++)
      for (let xx = 0; xx < ow; xx++) {
        const xmin = H.bounds[xx * 2],
          xmax = H.bounds[xx * 2 + 1];
        for (let c = 0; c < 4; c++) {
          let ss = 1 << (PRECISION_BITS - 1);
          for (let x = 0; x < xmax; x++) ss += cur[((y + off) * cw + x + xmin) * 4 + c] * H.kk[xx * H.ksize + x];
          tmp[(y * ow + xx) * 4 + c] = clip8(ss);
        }
      }
    cur = tmp;
    cw = ow;
    ch = rows;
  }
  if (needV) {
    const out = new Uint8ClampedArray(ow * oh * 4);
    for (let yy = 0; yy < oh; yy++) {
      const ymin = vb[yy * 2],
        ymax = vb[yy * 2 + 1];
      for (let x = 0; x < cw; x++)
        for (let c = 0; c < 4; c++) {
          let ss = 1 << (PRECISION_BITS - 1);
          for (let y = 0; y < ymax; y++) ss += cur[((y + ymin) * cw + x) * 4 + c] * V.kk[yy * V.ksize + y];
          out[(yy * ow + x) * 4 + c] = clip8(ss);
        }
    }
    cur = out;
    ch = oh;
  }
  unpremultiply(cur);
  return { width: cw, height: ch, data: cur };
}
/** a kit piece at game scale, as tools/slice-part-kit.py's to_game_scale did: box filter, then clear pixels that are
    mostly clear or still pink from the magenta background */
export function sheetKitScale(/** @type {Pixels} */ img, /** @type {number} */ scale) {
  const ow = Math.max(1, roundHalfEven(img.width * scale)),
    oh = Math.max(1, roundHalfEven(img.height * scale)),
    pre = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  for (let i = 0; i < pre.data.length; i += 4) {
    const f = pre.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) pre.data[i + c] = Math.trunc(pre.data[i + c] * f);
  }
  const small = sheetBoxResize(pre, ow, oh),
    d = small.data,
    out = new Uint8ClampedArray(d.length);
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3],
      rgb = [0, 1, 2].map(c => (a > 0 ? (d[i + c] * 255) / Math.max(a, 1) : 0)),
      pinkish = rgb[2] - rgb[1] > 40 && rgb[0] - rgb[1] > 60;
    for (let c = 0; c < 3; c++) out[i + c] = Math.trunc(Math.min(255, Math.max(0, rgb[c])));
    out[i + 3] = a >= 128 && !pinkish ? 255 : 0;
  }
  return { width: ow, height: oh, data: out };
}

/* ---------- sockets worked out from the outline (tools/slice-part-kit.py auto_sockets) ---------- */
export const LIMB_KINDS = ['arm', 'leg', 'wing', 'frontfin', 'backfin', 'foot'];
/** where a kit part connects, as fractions of its picture */
export function sheetAutoSockets(
  /** @type {string} */ kind,
  /** @type {string} */ slot,
  /** @type {Pixels} */ img,
  /** @type {string} */ view
) {
  const { width: w, height: h, data } = img,
    on = (/** @type {number} */ x, /** @type {number} */ y) => data[(y * w + x) * 4 + 3] > 0,
    xs = [],
    ys = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) (xs.push(x), ys.push(y));
  /** @type {Record<string, [number, number]>} */
  const out = {};
  if (!xs.length) return out;
  const top = Math.min(...ys),
    bot = Math.max(...ys),
    f = (/** @type {number} */ x, /** @type {number} */ y) =>
      /** @type {[number, number]} */ ([roundThousandths(x / w), roundThousandths(y / h)]),
    meanX = (/** @type {(y: number) => boolean} */ pick) => {
      let s = 0,
        n = 0;
      for (let i = 0; i < xs.length; i++) if (pick(ys[i])) ((s += xs[i]), n++);
      return s / n;
    },
    rowSpan = (/** @type {number} */ y) => {
      for (let dy = 0; dy < h; dy++)
        for (const yy of [y - dy, y + dy])
          if (yy >= 0 && yy < h) {
            let l = -1,
              r = -1;
            for (let x = 0; x < w; x++) if (on(x, yy)) ((l = l < 0 ? x : l), (r = x));
            if (l >= 0) return [l, r, yy];
          }
      return [0, w - 1, y];
    };
  if (slot === 'body' && kind === 'torso') {
    const ht = bot - top,
      nx = meanX(y => y <= top + 2),
      [l, r, sy] = rowSpan(roundHalfEven(top + ht * 0.2)),
      [hl, hr, hy] = rowSpan(roundHalfEven(top + ht * 0.86)),
      hc = (hl + hr) / 2,
      hw = (hr - hl) / 2,
      [tl, tr, ty] = rowSpan(roundHalfEven(top + ht * 0.8));
    return {
      neck: f(nx, top + 1),
      shoulderL: f(l + 3, sy),
      shoulderR: f(r - 3, sy),
      hipL: f(hc - hw * 0.5, hy),
      hipR: f(hc + hw * 0.5, hy),
      tail: view === 'front' ? f(tr - 4, ty) : f((tl + tr) / 2, top + ht * 0.9),
    };
  }
  if (slot === 'front' || slot === 'back' || LIMB_KINDS.includes(kind))
    return {
      joint: f(
        meanX(y => y <= top + 3),
        top
      ),
      end: f(
        meanX(y => y >= bot - 3),
        bot
      ),
    };
  if (slot === 'head' && kind === 'head')
    return {
      chin: f(
        meanX(y => y >= bot - 2),
        bot - 1
      ),
    };
  return out;
}

/* ---------- names ---------- */
/** a part id from a template: {kit} {animal} {row} {col} {n} {name} {extra} filled in, then made a safe id */
export function sheetName(/** @type {string} */ tpl, /** @type {Record<string, string | number>} */ vars) {
  return String(tpl || '{name}')
    .replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? '' : String(vars[k])))
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'p$1');
}
/** front and back parts matched: by name first, then the rest in order of position (rows top to bottom) */
export function sheetMatchViews(
  /** @type {{ id: string, cx?: number, cy?: number }[]} */ front,
  /** @type {{ id: string, cx?: number, cy?: number }[]} */ back
) {
  const byName = new Map(back.map(b => [b.id, b])),
    used = new Set(),
    pairs = [],
    loose = [];
  for (const f of front) {
    const b = byName.get(f.id);
    if (b && !used.has(b)) (used.add(b), pairs.push({ id: f.id, front: f, back: b, by: 'name' }));
    else loose.push(f);
  }
  const pos = (/** @type {any} */ a, /** @type {any} */ b) => (a.cy ?? 0) - (b.cy ?? 0) || (a.cx ?? 0) - (b.cx ?? 0),
    rest = back.filter(b => !used.has(b)).sort(pos);
  loose
    .sort(pos)
    .forEach((f, i) => pairs.push({ id: f.id, front: f, back: rest[i] || null, by: rest[i] ? 'position' : 'none' }));
  for (const b of rest.slice(loose.length)) pairs.push({ id: b.id, front: null, back: b, by: 'none' });
  return pairs;
}

/* ---------- Aseprite ---------- */
/** an Aseprite JSON export's boxes: its slices when it has any, else its frames (hash or array), named without the
    file extension */
export function asepriteBoxes(/** @type {any} */ json) {
  /** @type {(SheetBox & { name: string })[]} */
  const out = [];
  const slices = (json && json.meta && json.meta.slices) || [];
  for (const s of slices) {
    const k = s.keys && s.keys[0];
    if (k && k.bounds) out.push({ name: s.name, x: k.bounds.x, y: k.bounds.y, w: k.bounds.w, h: k.bounds.h });
  }
  if (out.length) return out;
  const frames = (json && json.frames) || [],
    list = Array.isArray(frames) ? frames.map(f => [f.filename, f]) : Object.entries(frames);
  for (const [name, f] of list)
    if (f && f.frame)
      out.push({
        name: String(name || '').replace(/\.[a-z0-9]+$/i, ''),
        x: f.frame.x,
        y: f.frame.y,
        w: f.frame.w,
        h: f.frame.h,
      });
  return out;
}

/* ---------- the phase 16 kits ---------- */
/** a kit's slicing as tools/slice-part-kit.py did it: the magenta key, an opening, pieces 6 px apart joined, specks
    under 800 px dropped, a quarter of the size */
export const SHEET_KIT_DEFAULTS = { key: 'magenta', clean: 1, gap: 6, minArea: 800, conn: 4, erode: 1, scale: 0.25 };
/** a kit sheet cut into its parts: rows of animals then a row of extras, each at game scale with its sockets.
    `problem` says why it could not be cut (the rows found don't match the kit). */
export function sheetSliceKit(
  /** @type {Pixels} */ img,
  /** @type {{ name: string, animals: string[], rows: string[], extras: string[], slice?: any }} */ kit,
  /** @type {{ slots: Record<string, string>, sockets?: any }} */ cfg,
  /** @type {string} */ view
) {
  const o = { ...SHEET_KIT_DEFAULTS, ...(kit.slice || {}) },
    items = sheetIslands(img, o),
    names = [...kit.rows, 'extras'],
    rows = sheetRows(items, names.length),
    want = [...kit.rows.map(() => kit.animals.length), kit.extras.length],
    got = rows.map(r => r.length);
  if (got.join() !== want.join())
    return { parts: [], rows, problem: `expected parts per row ${want.join(', ')}, found ${got.join(', ')}` };
  const parts = [];
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const it = rows[r][c],
        extra = r >= kit.rows.length,
        kind = extra ? kit.extras[c] : kit.rows[r],
        animal = extra ? 'any' : kit.animals[c],
        id = extra ? `${kit.name}_${kind}` : `${animal}_${kind}`,
        img2 = sheetKitScale(sheetPiece(img, it, o.erode), o.scale),
        sockets = {
          ...sheetAutoSockets(kind, cfg.slots[kind], img2, view),
          ...(((cfg.sockets || {})[id] || {})[view] || {}),
        };
      parts.push({
        id,
        kind,
        animal,
        img: img2,
        sockets,
        box: { x: it.x, y: it.y, w: it.w, h: it.h },
        cx: it.cx,
        cy: it.cy,
      });
    }
  return { parts, rows, problem: '' };
}
/** a part's manifest entry (partKits.json `parts`), with this view added */
export function sheetKitEntry(
  /** @type {any} */ old,
  /** @type {{ name: string }} */ kit,
  /** @type {{ slots: Record<string, string>, pivots: Record<string, number[]> }} */ cfg,
  /** @type {{ id: string, kind: string, animal: string, img: Pixels, sockets: any }} */ p,
  /** @type {string} */ view
) {
  const e = old || {
    kit: kit.name,
    animal: p.animal,
    kind: p.kind,
    slot: cfg.slots[p.kind],
    pivot: cfg.pivots[p.kind],
    size: 'M',
    views: {},
  };
  e.views[view] = { file: `next/parts/${view}/${p.id}.png`, w: p.img.width, h: p.img.height, sockets: p.sockets };
  return e;
}
