'use strict';
/* ================= ENGINE FRAME LISTS =================
   Phase 20 (stage C2): lists the walk frame fills again every frame, kept and refilled in place instead of made new, so
   a frame leaves less for the garbage collector (a pause of a few milliseconds is a visible hitch on a phone). Plain
   numbers and arrays; nothing here touches WebGL. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  byDistance: [() => byDistance],
  nearestFirst: [() => nearestFirst, v => (nearestFirst = v)],
  pooledQuad: [() => pooledQuad, v => (pooledQuad = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const byDistance = (a, b) => a.d - b.d;
/* entry i of a pool of four-number arrays, set to a, b, c, e (made the first time the pool is that long) */
export function pooledQuad(pool, i, a, b, c, e) {
  let q = pool[i];
  if (!q) q = pool[i] = [0, 0, 0, 0];
  q[0] = a;
  q[1] = b;
  q[2] = c;
  q[3] = e;
  return q;
}
/* the max entries of L nearest to (x, z) (each entry's [0] and [1]), nearest first, into out; L is sorted by it, as the
   walk frame's contact-shadow list always was (each entry keeps its distance in .d) */
export function nearestFirst(L, x, z, out, max) {
  for (const a of L) a.d = Math.hypot(a[0] - x, a[1] - z);
  L.sort(byDistance);
  out.length = 0;
  for (let i = 0; i < L.length && i < max; i++) out.push(L[i]);
  return out;
}
