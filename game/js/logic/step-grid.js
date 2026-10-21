// @ts-check
'use strict';
/* ================= STEP GRID SLOPES (moved from walk-view.js in map generator MG-2, unchanged) =================
   The step grid (walk-view.js stepGrid: E = {w, h, H raise per half-metre cell, M flags}) as the game draws and
   paints it: where ramp cells (flag 32) lean between their neighbours, and whether two neighbouring cells meet with
   no riser. Logic only, so the map generator's tests measure a road exactly as the game draws it
   (tools/test/mapgen-roads.test.mjs). The ground painter's worker gets these as their source text
   (ground-paint-worker.js paintWorkerSource): they read nothing but their arguments. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  stepCellsJoined: [() => stepCellsJoined, v => (stepCellsJoined = v)],
  // @ts-expect-error -- replaced on purpose
  stepCornerHeight: [() => stepCornerHeight, v => ((stepCornerHeight = v), provide({ stepCornerHeight }))],
  // @ts-expect-error -- replaced on purpose
  stepGridCorners: [() => stepGridCorners, v => (stepGridCorners = v)],
});
/* eslint-enable no-func-assign */
provide({ stepCornerHeight });
/* to-module: end */
/* two neighbouring cells meet without a step when their corners on the shared edge agree (a slope) */
export function stepCellsJoined(E, i, j, di, dj) {
  const ii = i + di,
    jj = j + dj;
  if (ii < 0 || jj < 0 || ii >= E.w || jj >= E.h) return false;
  const q = j * E.w + i,
    r = jj * E.w + ii;
  const A = di
    ? [
        [di > 0 ? 1 : 0, 0],
        [di > 0 ? 1 : 0, 1],
      ]
    : [
        [0, dj > 0 ? 1 : 0],
        [1, dj > 0 ? 1 : 0],
      ];
  for (const [ci, cj] of A) {
    const B = [di ? 1 - ci : ci, dj ? 1 - cj : cj];
    if (Math.abs(stepCornerHeight(E, q, ci, cj) - stepCornerHeight(E, r, B[0], B[1])) > 0.03) return false;
  }
  return true;
}
/* v23: slopes. A step cell flagged 32 is a ramp: instead of lying flat at its own height it leans between its
   neighbours. Each corner touching a ramp cell takes the average height of the cells around it that are within a
   step of the ramp, and those cells use that corner height too, so a ramp meets the ground above and below it with
   no riser. stepGridCorners caches the corners (NaN where a corner is ordinary). */
export function stepGridCorners(E) {
  if (E.cs === E.s && E.cm === E.m0 && E.C && E.cs != null) return E.C;
  const w = E.w,
    h = E.h,
    C = new Float32Array((w + 1) * (h + 1)).fill(NaN);
  let any = false;
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      let sum = 0,
        n = 0,
        rs = 0,
        rn = 0;
      const cells = [];
      for (const [a, b] of [
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
      ]) {
        const ii = i + a,
          jj = j + b;
        if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
        const q = jj * w + ii;
        cells.push(q);
        if (E.M[q] & 32) {
          rs += E.H[q];
          rn++;
        }
      }
      if (!rn) continue;
      const m = rs / rn;
      for (const q of cells) {
        if (Math.abs(E.H[q] - m) <= 0.45) {
          sum += E.H[q];
          n++;
        }
      }
      C[j * (w + 1) + i] = sum / n;
      any = true;
    }
  E.C = C;
  E.cs = E.s;
  E.cm = E.m0;
  E.sl = any;
  return C;
}
/* the height of cell q's corner (ci,cj in 0/1): the shared ramp height when the corner is part of a slope, else the cell's own */
export function stepCornerHeight(E, q, ci, cj) {
  const C = stepGridCorners(E);
  if (!E.sl) return E.H[q];
  const i = q % E.w,
    j = (q - i) / E.w,
    c = C[(j + cj) * (E.w + 1) + i + ci];
  return c === c && Math.abs(c - E.H[q]) <= 0.45 ? c : E.H[q];
}
