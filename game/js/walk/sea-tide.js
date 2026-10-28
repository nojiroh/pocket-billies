// @ts-check
'use strict';
/* ================= THE TIDE (water track WA-4) =================
   The sea comes in and goes out twice a day. Which ground it covers and which water it leaves is read from the tiles,
   so a map needs no tide data of its own: on a scene with the sea all round (`flatFar`), wet sand (`S`) joined to the
   sea is covered at high tide (sandbars and flats included), and the open sea's shallows (`w`) right beside dry land
   go dry at low tide. Water of the sea's kind that does not join the open sea (it reaches neither the map's edge nor
   deep water `d`) is a tide pool: it keeps its water when the sea goes out. The renderer turns the two masks into
   shorelines (water-data.js shoreField) and moves the waterline between them with tideLevel.
   Logic only: no DOM, runs in Node (tools/test/sea-tide.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  TIDE_HIGH: [() => TIDE_HIGH],
  TIDE_PERIOD: [() => TIDE_PERIOD],
  // @ts-expect-error -- replaced on purpose
  tideCells: [() => tideCells, v => (tideCells = v)],
  // @ts-expect-error -- replaced on purpose
  tideLevel: [() => tideLevel, v => (tideLevel = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** hours from one high tide to the next (two a day, so a day's tides repeat and never jump at midnight) */
const TIDE_PERIOD = 12;
/** the hour of the morning's high tide (the evening's is TIDE_PERIOD later) */
const TIDE_HIGH = 9;

/** the tide at hour h: 1 high, -1 low, smooth between */
export function tideLevel(h) {
  return Math.cos((2 * Math.PI * (h - TIDE_HIGH)) / TIDE_PERIOD);
}

/**
 * The tide's cells on a w x h map of 1 m tiles. ter(i, j) gives tile i, j's ground letter (j counted from the
 * south, as the walk view's z); sea(i, j) whether that tile is water of the sea's kind.
 * Returns per tile: cover (1: land the high tide covers), dry (1: water the low tide leaves), pool (1: a tide pool),
 * and how many tiles of each.
 * @param {number} w
 * @param {number} h
 * @param {(i: number, j: number) => string} ter
 * @param {(i: number, j: number) => boolean} sea
 * @param {(i: number, j: number) => boolean} [run] whether tile i, j holds running water (a river): never the sea's,
 *   so the tide neither dries its bed nor covers its banks through it (a river runs at its own level)
 */
export function tideCells(w, h, ter, sea, run) {
  const n = w * h,
    isSea = new Uint8Array(n),
    open = new Uint8Array(n),
    cover = new Uint8Array(n),
    dry = new Uint8Array(n),
    pool = new Uint8Array(n),
    Q = [],
    N4 = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const c = ter(i, j);
      if ((c === 'w' || c === 'd') && sea(i, j) && !(run && run(i, j))) isSea[j * w + i] = 1;
    }
  /* the open sea: the sea's water reached from the map's edge or from deep water */
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i;
      if (isSea[q] && (i === 0 || j === 0 || i === w - 1 || j === h - 1 || ter(i, j) === 'd')) {
        open[q] = 1;
        Q.push(q);
      }
    }
  for (let k = 0; k < Q.length; k++) {
    const q = Q[k],
      i = q % w,
      j = (q - i) / w;
    for (const [a, b] of N4) {
      const ii = i + a,
        jj = j + b;
      if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
      const m = jj * w + ii;
      if (isSea[m] && !open[m]) {
        open[m] = 1;
        Q.push(m);
      }
    }
  }
  /* wet sand joined to the sea (open or a pool) through wet sand: the high tide covers it */
  Q.length = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i;
      if (ter(i, j) !== 'S') continue;
      for (const [a, b] of N4) {
        const ii = i + a,
          jj = j + b;
        if (ii >= 0 && jj >= 0 && ii < w && jj < h && isSea[jj * w + ii]) {
          cover[q] = 1;
          Q.push(q);
          break;
        }
      }
    }
  for (let k = 0; k < Q.length; k++) {
    const q = Q[k],
      i = q % w,
      j = (q - i) / w;
    for (const [a, b] of N4) {
      const ii = i + a,
        jj = j + b;
      if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
      const m = jj * w + ii;
      if (!cover[m] && ter(ii, jj) === 'S') {
        cover[m] = 1;
        Q.push(m);
      }
    }
  }
  /* the open sea's shallows touching dry land (any of the eight round it) go dry at low tide; pools keep theirs */
  let nCover = 0,
    nDry = 0,
    nPool = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i;
      nCover += cover[q];
      if (isSea[q] && !open[q]) {
        pool[q] = 1;
        nPool++;
        continue;
      }
      if (!open[q] || ter(i, j) !== 'w') continue;
      let land = false;
      for (let b = -1; b <= 1 && !land; b++)
        for (let a = -1; a <= 1; a++) {
          const ii = i + a,
            jj = j + b;
          if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
          const c = ter(ii, jj);
          if (c !== 'w' && c !== 'd') {
            land = true;
            break;
          }
        }
      if (land) {
        dry[q] = 1;
        nDry++;
      }
    }
  return { cover, dry, pool, nCover, nDry, nPool };
}
