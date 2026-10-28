// @ts-check
/* ================= THE ATLAS'S CELLS (characters track CH-4) =================
   Where each figure's picture goes in the figures' shared atlas (figure-atlas.js): shelves, rows of one height across
   the atlas (a cell's height rounded up to ATLAS_SHELF_STEP pixels), each with its free spans; a cell takes the first
   span wide enough on a shelf of its height (or one up to half as tall again), else a new shelf above the last. A
   freed cell's span goes back and joins its neighbours; the top shelf goes once it is empty. Every cell keeps PAD
   empty pixels to its right and above it, so nothing of a neighbour is ever read past its edge. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  ATLAS_SHELF_STEP: [() => ATLAS_SHELF_STEP],
  // @ts-expect-error -- replaced on purpose
  atlasPackAdd: [() => atlasPackAdd, v => (atlasPackAdd = v)],
  // @ts-expect-error -- replaced on purpose
  atlasPackFree: [() => atlasPackFree, v => (atlasPackFree = v)],
  // @ts-expect-error -- replaced on purpose
  atlasPackNew: [() => atlasPackNew, v => (atlasPackNew = v)],
  // @ts-expect-error -- replaced on purpose
  atlasPackUse: [() => atlasPackUse, v => (atlasPackUse = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** shelves come in heights of this many pixels */
export const ATLAS_SHELF_STEP = 8;
/**
 * @typedef {{ y: number, h: number, spans: number[][] }} AtlasShelf a shelf: its bottom row, height and free spans [x0, x1)
 * @typedef {{ w: number, h: number, pad: number, shelves: AtlasShelf[], top: number, cells: number }} AtlasPack
 * @typedef {{ x: number, y: number, w: number, h: number, shelf: AtlasShelf }} AtlasCell
 */
/** an empty atlas of w x h pixels @param {number} w @param {number} h @param {number} [pad] @returns {AtlasPack} */
export function atlasPackNew(w, h, pad = 1) {
  return { w, h, pad, shelves: [], top: 0, cells: 0 };
}
/**
 * room for a picture of w x h pixels: its cell (x, y its bottom left in the atlas's pixels), or null when the atlas is
 * full @param {AtlasPack} P @param {number} w @param {number} h @returns {AtlasCell | null}
 */
export function atlasPackAdd(P, w, h) {
  const W = w + P.pad,
    H = Math.ceil((h + P.pad) / ATLAS_SHELF_STEP) * ATLAS_SHELF_STEP;
  if (W > P.w || H > P.h) return null;
  /* the snuggest shelf with a span wide enough: its own height first, then up to half as tall again */
  /** @type {AtlasShelf | null} */
  let best = null,
    bi = -1;
  for (const S of P.shelves) {
    if (S.h < H || S.h > H * 1.5 || (best && S.h >= best.h)) continue;
    const i = S.spans.findIndex(([a, b]) => b - a >= W);
    if (i >= 0) {
      best = S;
      bi = i;
    }
  }
  if (!best) {
    if (P.top + H > P.h) return null;
    best = { y: P.top, h: H, spans: [[0, P.w]] };
    bi = 0;
    P.shelves.push(best);
    P.top += H;
  }
  const sp = best.spans[bi],
    x = sp[0];
  sp[0] += W;
  if (sp[0] >= sp[1]) best.spans.splice(bi, 1);
  P.cells++;
  return { x, y: best.y, w, h, shelf: best };
}
/** a cell's room back @param {AtlasPack} P @param {AtlasCell} c */
export function atlasPackFree(P, c) {
  const S = c.shelf,
    a = c.x,
    b = c.x + c.w + P.pad;
  /* in order, joined to the spans either side */
  let i = 0;
  while (i < S.spans.length && S.spans[i][0] < a) i++;
  S.spans.splice(i, 0, [a, b]);
  if (i + 1 < S.spans.length && S.spans[i + 1][0] === b) {
    S.spans[i][1] = S.spans[i + 1][1];
    S.spans.splice(i + 1, 1);
  }
  if (i > 0 && S.spans[i - 1][1] === a) {
    S.spans[i - 1][1] = S.spans[i][1];
    S.spans.splice(i, 1);
  }
  P.cells--;
  /* empty shelves at the top go, so the room above is free for any height */
  for (let L = P.shelves[P.shelves.length - 1]; L && L.spans.length === 1 && L.spans[0][1] - L.spans[0][0] >= P.w;) {
    P.shelves.pop();
    P.top = L.y;
    L = P.shelves[P.shelves.length - 1];
  }
}
/** how much of the atlas's height its shelves take, 0-1 @param {AtlasPack} P */
export function atlasPackUse(P) {
  return P.top / P.h;
}
