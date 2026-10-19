// @ts-check
'use strict';
/* ================= PIXEL OPS (studio track ST-2) =================
   What the Studio's shared pixel canvas does to a picture, as numbers: lines, fill, flips and quarter turns of a box,
   symmetry, the game palette (lock to it, find what is off it), patches for the undo, and the canvas's keys.
   A picture is ImageData-shaped ({ width, height, data: RGBA bytes }). Logic only: no DOM, runs in Node
   (tools/test/pixel-ops.test.mjs). studio/js/pixel-canvas.js puts it on the page. */
/** @typedef {{ width: number, height: number, data: Uint8ClampedArray }} Pixels */
/** @typedef {[number, number, number, number]} Box x, y, width, height */
/** @typedef {[number, number, number, number]} Rgba */
/** @typedef {{ mode: string, sx: number, sy: number }} Symmetry mode off / v / h / both; a mirrored x is sx - x */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  PIXEL_GRID_FROM: [() => PIXEL_GRID_FROM],
  PIXEL_KEYS: [() => PIXEL_KEYS],
  PIXEL_ZOOMS: [() => PIXEL_ZOOMS],
  // @ts-expect-error -- replaced on purpose
  offPalette: [() => offPalette, v => (offPalette = v)],
  // @ts-expect-error -- replaced on purpose
  paletteColors: [() => paletteColors, v => (paletteColors = v)],
  // @ts-expect-error -- replaced on purpose
  paletteNearest: [() => paletteNearest, v => (paletteNearest = v)],
  // @ts-expect-error -- replaced on purpose
  pixelClip: [() => pixelClip, v => (pixelClip = v)],
  // @ts-expect-error -- replaced on purpose
  pixelCopy: [() => pixelCopy, v => (pixelCopy = v)],
  // @ts-expect-error -- replaced on purpose
  pixelDiffBox: [() => pixelDiffBox, v => (pixelDiffBox = v)],
  // @ts-expect-error -- replaced on purpose
  pixelFill: [() => pixelFill, v => (pixelFill = v)],
  // @ts-expect-error -- replaced on purpose
  pixelFlip: [() => pixelFlip, v => (pixelFlip = v)],
  // @ts-expect-error -- replaced on purpose
  pixelGet: [() => pixelGet, v => (pixelGet = v)],
  // @ts-expect-error -- replaced on purpose
  pixelHex: [() => pixelHex, v => (pixelHex = v)],
  // @ts-expect-error -- replaced on purpose
  pixelKeyAction: [() => pixelKeyAction, v => (pixelKeyAction = v)],
  // @ts-expect-error -- replaced on purpose
  pixelLine: [() => pixelLine, v => (pixelLine = v)],
  // @ts-expect-error -- replaced on purpose
  pixelMirrored: [() => pixelMirrored, v => (pixelMirrored = v)],
  // @ts-expect-error -- replaced on purpose
  pixelNew: [() => pixelNew, v => (pixelNew = v)],
  // @ts-expect-error -- replaced on purpose
  pixelPaste: [() => pixelPaste, v => (pixelPaste = v)],
  // @ts-expect-error -- replaced on purpose
  pixelRgba: [() => pixelRgba, v => (pixelRgba = v)],
  // @ts-expect-error -- replaced on purpose
  pixelRotate: [() => pixelRotate, v => (pixelRotate = v)],
  pixelSame: [() => pixelSame],
  // @ts-expect-error -- replaced on purpose
  pixelSet: [() => pixelSet, v => (pixelSet = v)],
  // @ts-expect-error -- replaced on purpose
  pixelSymmetryFor: [() => pixelSymmetryFor, v => (pixelSymmetryFor = v)],
  // @ts-expect-error -- replaced on purpose
  pixelTopColors: [() => pixelTopColors, v => (pixelTopColors = v)],
  // @ts-expect-error -- replaced on purpose
  pixelZoomNext: [() => pixelZoomNext, v => (pixelZoomNext = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a new transparent picture */
export function pixelNew(/** @type {number} */ width, /** @type {number} */ height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}
/** '#rrggbb' (or '#rgb') as RGBA, opaque */
export function pixelRgba(/** @type {string} */ hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return /** @type {Rgba} */ (Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255] : [0, 0, 0, 255]);
}
/** RGB as '#RRGGBB' */
export function pixelHex(/** @type {number} */ r, /** @type {number} */ g, /** @type {number} */ b) {
  return (
    '#' +
    [r, g, b]
      .map(v => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}
/** the pixel's RGBA, or null outside the picture */
export function pixelGet(/** @type {Pixels} */ im, /** @type {number} */ x, /** @type {number} */ y) {
  if (x < 0 || y < 0 || x >= im.width || y >= im.height) return null;
  const i = (y * im.width + x) * 4,
    d = im.data;
  return /** @type {Rgba} */ ([d[i], d[i + 1], d[i + 2], d[i + 3]]);
}
/** paints one pixel (null clears it); false outside the picture */
export function pixelSet(
  /** @type {Pixels} */ im,
  /** @type {number} */ x,
  /** @type {number} */ y,
  /** @type {Rgba | null} */ c
) {
  if (x < 0 || y < 0 || x >= im.width || y >= im.height) return false;
  const i = (y * im.width + x) * 4;
  im.data.set(c || [0, 0, 0, 0], i);
  return true;
}
/** the pixels of a straight line, both ends included (Bresenham) */
export function pixelLine(/** @type {number[]} */ a, /** @type {number[]} */ b) {
  let [x0, y0] = a;
  const [x1, y1] = b,
    dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0),
    sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1,
    out = [];
  let e = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) {
      e += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      e += dx;
      y0 += sy;
    }
  }
  return out;
}
/** the symmetry axes in the middle of a box (a picture's or a part's): a mirrored x is sx - x */
export function pixelSymmetryFor(/** @type {string} */ mode, /** @type {Box} */ box) {
  return { mode, sx: 2 * box[0] + box[2] - 1, sy: 2 * box[1] + box[3] - 1 };
}
/** a pixel and its mirror images under the symmetry (no repeats) */
export function pixelMirrored(/** @type {number} */ x, /** @type {number} */ y, /** @type {Symmetry | null} */ sym) {
  const out = [[x, y]],
    m = sym ? sym.mode : 'off',
    add = (/** @type {number} */ a, /** @type {number} */ b) => {
      if (!out.some(p => p[0] === a && p[1] === b)) out.push([a, b]);
    };
  if (!sym || m === 'off') return out;
  if (m === 'v' || m === 'both') add(sym.sx - x, y);
  if (m === 'h' || m === 'both') add(x, sym.sy - y);
  if (m === 'both') add(sym.sx - x, sym.sy - y);
  return out;
}
/** the box clipped to the picture, or null when nothing is left */
export function pixelClip(/** @type {Pixels} */ im, /** @type {Box | null | undefined} */ box) {
  const b = box || [0, 0, im.width, im.height],
    x0 = Math.max(0, Math.floor(b[0])),
    y0 = Math.max(0, Math.floor(b[1])),
    x1 = Math.min(im.width, Math.floor(b[0] + b[2])),
    y1 = Math.min(im.height, Math.floor(b[1] + b[3]));
  return x1 > x0 && y1 > y0 ? /** @type {Box} */ ([x0, y0, x1 - x0, y1 - y0]) : null;
}
/* two pixels are the same colour for the fill when their RGBA match, or when both are fully clear */
export const pixelSame = (/** @type {Uint8ClampedArray} */ d, /** @type {number} */ i, /** @type {Rgba} */ t) =>
  (d[i + 3] === 0 && t[3] === 0) || (d[i] === t[0] && d[i + 1] === t[1] && d[i + 2] === t[2] && d[i + 3] === t[3]);
/** flood fill (4 neighbours) from x, y with the colour (null clears), staying inside the box (a part); the number of
 * pixels changed */
export function pixelFill(
  /** @type {Pixels} */ im,
  /** @type {number} */ x,
  /** @type {number} */ y,
  /** @type {Rgba | null} */ c,
  /** @type {Box | null} */ box = null
) {
  const b = pixelClip(im, box),
    t = pixelGet(im, x, y);
  if (!b || !t || x < b[0] || y < b[1] || x >= b[0] + b[2] || y >= b[1] + b[3]) return 0;
  const rep = c || /** @type {Rgba} */ ([0, 0, 0, 0]);
  if (pixelSame(Uint8ClampedArray.from(rep), 0, t)) return 0;
  const W = im.width,
    d = im.data,
    seen = new Uint8Array(W * im.height),
    st = [x, y];
  let n = 0;
  while (st.length) {
    const py = /** @type {number} */ (st.pop()),
      px = /** @type {number} */ (st.pop());
    if (px < b[0] || py < b[1] || px >= b[0] + b[2] || py >= b[1] + b[3]) continue;
    const k = py * W + px;
    if (seen[k] || !pixelSame(d, k * 4, t)) continue;
    seen[k] = 1;
    d.set(rep, k * 4);
    n++;
    st.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
  }
  return n;
}
/** a copy of a box of the picture (a patch: { x, y, width, height, data }) */
export function pixelCopy(/** @type {Pixels} */ im, /** @type {Box} */ box) {
  const b = pixelClip(im, box) || /** @type {Box} */ ([0, 0, 0, 0]),
    out = { x: b[0], y: b[1], ...pixelNew(b[2], b[3]) };
  for (let r = 0; r < b[3]; r++) {
    const s = ((b[1] + r) * im.width + b[0]) * 4;
    out.data.set(im.data.subarray(s, s + b[2] * 4), r * b[2] * 4);
  }
  return out;
}
/** puts a patch back where it came from (the parts outside the picture are dropped) */
export function pixelPaste(
  /** @type {Pixels} */ im,
  /** @type {{ x: number, y: number, width: number, height: number, data: Uint8ClampedArray }} */ p
) {
  for (let r = 0; r < p.height; r++) {
    const y = p.y + r;
    if (y < 0 || y >= im.height) continue;
    for (let q = 0; q < p.width; q++) {
      const x = p.x + q;
      if (x < 0 || x >= im.width) continue;
      const s = (r * p.width + q) * 4;
      im.data.set(p.data.subarray(s, s + 4), (y * im.width + x) * 4);
    }
  }
}
/** the smallest box holding every pixel that differs between two pictures of one size, or null when none does */
export function pixelDiffBox(/** @type {Pixels} */ a, /** @type {Pixels} */ b) {
  if (a.width !== b.width || a.height !== b.height) return /** @type {Box} */ ([0, 0, b.width, b.height]);
  const W = a.width,
    A = new Uint32Array(a.data.buffer, a.data.byteOffset, a.data.length >> 2),
    B = new Uint32Array(b.data.buffer, b.data.byteOffset, b.data.length >> 2);
  let x0 = W,
    y0 = a.height,
    x1 = -1,
    y1 = -1;
  for (let i = 0; i < A.length; i++) {
    if (A[i] === B[i]) continue;
    const x = i % W,
      y = (i / W) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : /** @type {Box} */ ([x0, y0, x1 - x0 + 1, y1 - y0 + 1]);
}
/** flips a box of the picture left-right ('h') or upside down ('v') */
export function pixelFlip(/** @type {Pixels} */ im, /** @type {Box | null} */ box, /** @type {string} */ axis) {
  const b = pixelClip(im, box);
  if (!b) return;
  const p = pixelCopy(im, b),
    [x, y, w, h] = b;
  for (let r = 0; r < h; r++)
    for (let q = 0; q < w; q++) {
      const s = ((axis === 'v' ? h - 1 - r : r) * w + (axis === 'v' ? q : w - 1 - q)) * 4;
      im.data.set(p.data.subarray(s, s + 4), ((y + r) * im.width + x + q) * 4);
    }
}
/** turns a box a quarter clockwise (dir 1) or anticlockwise (-1) about its middle; a box that is not square turns
 * into one the other way round, clipped to the picture. The box the art is in afterwards */
export function pixelRotate(/** @type {Pixels} */ im, /** @type {Box | null} */ box, /** @type {number} */ dir = 1) {
  const b = pixelClip(im, box);
  if (!b) return null;
  const p = pixelCopy(im, b),
    [x, y, w, h] = b,
    nx = x + Math.floor((w - h) / 2),
    ny = y + Math.floor((h - w) / 2);
  for (let r = 0; r < h; r++) im.data.fill(0, ((y + r) * im.width + x) * 4, ((y + r) * im.width + x + w) * 4);
  const out = { x: nx, y: ny, ...pixelNew(h, w) };
  for (let r = 0; r < h; r++)
    for (let q = 0; q < w; q++) {
      /* clockwise: (q, r) goes to (h - 1 - r, q) */
      const tx = dir > 0 ? h - 1 - r : r,
        ty = dir > 0 ? q : w - 1 - q,
        s = (r * w + q) * 4;
      out.data.set(p.data.subarray(s, s + 4), (ty * h + tx) * 4);
    }
  pixelPaste(im, out);
  return pixelClip(im, [nx, ny, h, w]);
}
/** every colour of the game palette (next/palette.js ramps, and its single colours) as '#RRGGBB', darkest first */
export function paletteColors(/** @type {Record<string, string | string[]> | null | undefined} */ ramps) {
  const out = /** @type {string[]} */ ([]);
  for (const v of Object.values(ramps || {}))
    for (const h of Array.isArray(v) ? v : [v]) {
      if (typeof h !== 'string') continue;
      const c = pixelRgba(h),
        x = pixelHex(c[0], c[1], c[2]);
      if (!out.includes(x)) out.push(x);
    }
  return out;
}
/** the palette colour nearest to a colour (RGB distance weighted for the eye), as '#RRGGBB' */
export function paletteNearest(/** @type {string} */ hex, /** @type {string[]} */ colors) {
  if (!colors.length) return pixelHex(.../** @type {[number, number, number]} */ (pixelRgba(hex).slice(0, 3)));
  const [r, g, b] = pixelRgba(hex);
  let best = colors[0],
    bd = Infinity;
  for (const h of colors) {
    const [R, G, B] = pixelRgba(h),
      d = 3 * (R - r) ** 2 + 4 * (G - g) ** 2 + 2 * (B - b) ** 2;
    if (d < bd) {
      bd = d;
      best = h;
    }
  }
  return best;
}
/** a byte per pixel: 1 where a pixel that shows (alpha over half) is not a palette colour */
export function offPalette(/** @type {Pixels} */ im, /** @type {string[]} */ colors) {
  const set = new Set(colors.map(h => parseInt(h.slice(1), 16))),
    d = im.data,
    out = new Uint8Array(im.width * im.height);
  for (let i = 0, k = 0; i < d.length; i += 4, k++)
    if (d[i + 3] >= 128 && !set.has((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])) out[k] = 1;
  return out;
}
/** the colours a picture uses most, most first, as '#RRGGBB' (pixels that show) */
export function pixelTopColors(/** @type {Pixels} */ im, /** @type {number} */ n = 48) {
  const d = im.data,
    cnt = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  return [...cnt.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => '#' + k.toString(16).padStart(6, '0').toUpperCase());
}
/** the zoom steps the number keys go to */
export const PIXEL_ZOOMS = [1, 2, 4, 8, 16, 32];
/** the smallest zoom that shows the pixel grid */
export const PIXEL_GRID_FROM = 8;
/** the next zoom in (dir 1) or out (-1): one at a time up to 8x, then two, then four */
export function pixelZoomNext(/** @type {number} */ z, /** @type {number} */ dir) {
  const step = (/** @type {number} */ v) => (v < 8 ? 1 : v < 16 ? 2 : 4);
  return Math.max(1, Math.min(32, dir > 0 ? z + step(z) : z - step(z - 1)));
}
/** the pixel canvas's keys (Aseprite's where it has one): what the `?` sheet lists and the canvas does. `keys` as
 * shown; `match` is { key, shift?, mod? } with key in lower case */
export const PIXEL_KEYS = [
  { act: 'tool:pen', keys: 'B', label: 'Pencil', match: [{ key: 'b' }, { key: 'p' }] },
  { act: 'tool:erase', keys: 'E', label: 'Eraser', match: [{ key: 'e' }] },
  { act: 'tool:fill', keys: 'G', label: 'Fill (inside the part)', match: [{ key: 'g' }, { key: 'f' }] },
  { act: 'tool:pick', keys: 'I or hold Alt', label: 'Pick a colour', match: [{ key: 'i' }] },
  { act: 'tool:line', keys: 'L', label: 'Line (or Shift-click with the pencil)', match: [{ key: 'l' }] },
  { act: 'tool:select', keys: 'M', label: 'Select a box', match: [{ key: 'm' }] },
  {
    act: 'flipH',
    keys: 'Shift+H',
    label: 'Flip the selection (or part) left-right',
    match: [{ key: 'h', shift: true }],
  },
  {
    act: 'flipV',
    keys: 'Shift+V',
    label: 'Flip the selection (or part) upside down',
    match: [{ key: 'v', shift: true }],
  },
  {
    act: 'rotate',
    keys: 'Shift+R',
    label: 'Turn the selection (or part) a quarter right',
    match: [{ key: 'r', shift: true }],
  },
  { act: 'symmetry', keys: 'Y', label: 'Symmetry: off, left-right, top-bottom, both', match: [{ key: 'y' }] },
  { act: 'onion', keys: 'O', label: 'Onion skin: the other view faint underneath', match: [{ key: 'o' }] },
  { act: 'lock', keys: 'K', label: 'Lock to the game palette', match: [{ key: 'k' }] },
  { act: 'swap', keys: 'X', label: 'Swap the two colours', match: [{ key: 'x' }] },
  { act: 'grid', keys: "Ctrl+'", label: 'Grid on or off (shows from 8x)', match: [{ key: "'", mod: true }] },
  { act: 'zoomIn', keys: '+', label: 'Zoom in', match: [{ key: '+' }, { key: '=' }] },
  { act: 'zoomOut', keys: '-', label: 'Zoom out', match: [{ key: '-' }] },
  { act: 'zoomStep', keys: '1 to 6', label: 'Zoom 1x, 2x, 4x, 8x, 16x, 32x', match: [] },
  { act: 'zoomFit', keys: '0', label: 'Zoom to fit', match: [{ key: '0' }] },
  { act: 'pan', keys: 'Space+drag', label: 'Move the view (or the middle button)', match: [] },
  {
    act: 'undo',
    keys: 'Ctrl+Z',
    label: 'Undo (the Studio’s, with every other edit)',
    match: [{ key: 'z', mod: true }],
  },
  {
    act: 'redo',
    keys: 'Ctrl+Shift+Z or Ctrl+Y',
    label: 'Redo',
    match: [
      { key: 'z', mod: true, shift: true },
      { key: 'y', mod: true },
    ],
  },
  { act: 'deselect', keys: 'Esc', label: 'Drop the selection, then close', match: [{ key: 'escape' }] },
];
/** the canvas action for a key press ({ key, shiftKey, ctrlKey, metaKey }), or null */
export function pixelKeyAction(
  /** @type {{ key: string, shiftKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean }} */ ev
) {
  const key = String(ev.key || '').toLowerCase(),
    mod = !!(ev.ctrlKey || ev.metaKey),
    shift = !!ev.shiftKey;
  if (!mod && /^[1-6]$/.test(key)) return 'zoom:' + PIXEL_ZOOMS[+key - 1];
  for (const k of PIXEL_KEYS)
    for (const m of k.match) {
      if (m.key !== key || !!m.mod !== mod) continue;
      /* letters need the exact Shift; '+' and the like come with whatever Shift the layout needs */
      if (/^[a-z]$/.test(key) && !!m.shift !== shift) continue;
      return k.act;
    }
  return null;
}
