// @ts-check
'use strict';
/* ================= THE FLOW MAP (water track WA-2a) =================
   Which way the water runs, and where it foams, on the water mesh's half-metre grid: built once with the mesh from
   the scene's `streams` (the contract: {pts, speed} and the optional `w` a width per point, `rapids` [[t0, t1]]
   fractions along the line, `src` and `mouth`) and its waterfalls' feet. Each segment visits only the cells within
   its reach, so building it costs the streams' area, not every vertex times every segment (the old waterFlowField).
   A cell holds four numbers: the flow (x, z: the direction times the stream's speed), foam (0-1: rapids, the churn
   where a river meets a pool, a lake or the sea, a spring's bubbling, a fall's foot) and how far into the stream it
   lies (1 on its line, 0 at its reach). The walk view reads it on the CPU (flowMapAt: the mesh's running water, the
   leaves) and the water shader as a texture (walk/water.js). A plain {pts, speed} stream gets the same flow at a
   cell's middle as the old search: the nearest segment within 2.5 m, the first one on a tie.
   Logic only: no DOM, runs in Node (tools/test/water-flow.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  FLOW_CELLS: [() => FLOW_CELLS],
  FLOW_RAPIDS: [() => FLOW_RAPIDS],
  FLOW_REACH: [() => FLOW_REACH],
  OPEN_SEA_LAKE: [() => OPEN_SEA_LAKE],
  // @ts-expect-error -- replaced on purpose
  flowMapAt: [() => flowMapAt, v => (flowMapAt = v)],
  // @ts-expect-error -- replaced on purpose
  waterFlowMap: [() => waterFlowMap, v => (waterFlowMap = v)],
  // @ts-expect-error -- replaced on purpose
  waterOpenSea: [() => waterOpenSea, v => (waterOpenSea = v)],
  // @ts-expect-error -- replaced on purpose
  widthAt: [() => widthAt, v => (widthAt = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const FLOW_CELLS = 2; /* cells a metre (the water mesh's half metre) */
const FLOW_REACH = 2.5; /* metres from a stream's line that still run with it (at least; a wide river reaches w/2 + 1) */
const FLOW_RAPIDS = 1.6; /* rapids run this much faster than the rest of the stream */

/**
 * @typedef {{pts?: number[][], speed?: number, w?: number[] | number, rapids?: number[][], src?: string, mouth?: string}} FlowStream
 * @typedef {{W2: number, H2: number, d: Float32Array}} FlowMap
 */

/** the stream's width at point k (m; a number, or one a point; 0 when not given) */
function widthAt(/** @type {FlowStream} */ st, /** @type {number} */ k) {
  const w = st.w;
  if (Array.isArray(w)) return +w[Math.min(k, w.length - 1)] || 0;
  return +(w || 0);
}

/**
 * the flow map of a scene w x h metres
 * @param {{w: number, h: number, streams?: FlowStream[]}} sc
 * @param {number[][]} [feet] waterfalls' feet [x, z, r]: churning foam within r metres
 * @returns {FlowMap}
 */
export function waterFlowMap(sc, feet = []) {
  const W2 = Math.max(1, Math.round(sc.w * FLOW_CELLS)),
    H2 = Math.max(1, Math.round(sc.h * FLOW_CELLS)),
    d = new Float32Array(W2 * H2 * 4),
    best = new Float64Array(W2 * H2).fill(Infinity),
    foam = (/** @type {number} */ q, /** @type {number} */ f) => {
      if (f > d[q * 4 + 2]) d[q * 4 + 2] = Math.min(1, f);
    },
    /* every cell whose middle lies within r of (x, z), with its distance */
    round = (
      /** @type {number} */ x,
      /** @type {number} */ z,
      /** @type {number} */ r,
      /** @type {(q: number, dist: number) => void} */ fn
    ) => {
      const i0 = Math.max(0, Math.floor((x - r) * FLOW_CELLS)),
        i1 = Math.min(W2 - 1, Math.floor((x + r) * FLOW_CELLS)),
        j0 = Math.max(0, Math.floor((z - r) * FLOW_CELLS)),
        j1 = Math.min(H2 - 1, Math.floor((z + r) * FLOW_CELLS));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const dist = Math.hypot((i + 0.5) / FLOW_CELLS - x, (j + 0.5) / FLOW_CELLS - z);
          if (dist < r) fn(j * W2 + i, dist);
        }
    };
  for (const st of sc.streams || []) {
    const p = st.pts || [],
      sp = st.speed || 1;
    if (p.length < 2) continue;
    /* how far along the line each point lies (for the rapids' fractions) */
    const at = [0];
    for (let k = 1; k < p.length; k++) at.push(at[k - 1] + Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]));
    const len = at[p.length - 1] || 1,
      rapids = (st.rapids || []).map(r => [r[0] * len, r[1] * len]),
      rapidAt = (/** @type {number} */ s) => rapids.some(r => s >= r[0] - 0.25 && s <= r[1] + 0.25);
    for (let k = 0; k < p.length - 1; k++) {
      const a = p[k],
        b = p[k + 1],
        vx = b[0] - a[0],
        vz = b[1] - a[1],
        l2 = vx * vx + vz * vz || 1e-9,
        l = Math.sqrt(l2),
        hw = Math.max(widthAt(st, k), widthAt(st, k + 1)) / 2,
        reach = Math.max(FLOW_REACH, hw + 1),
        x0 = Math.min(a[0], b[0]) - reach,
        x1 = Math.max(a[0], b[0]) + reach,
        z0 = Math.min(a[1], b[1]) - reach,
        z1 = Math.max(a[1], b[1]) + reach;
      for (let j = Math.max(0, Math.floor(z0 * FLOW_CELLS)); j <= Math.min(H2 - 1, Math.floor(z1 * FLOW_CELLS)); j++)
        for (
          let i = Math.max(0, Math.floor(x0 * FLOW_CELLS));
          i <= Math.min(W2 - 1, Math.floor(x1 * FLOW_CELLS));
          i++
        ) {
          const x = (i + 0.5) / FLOW_CELLS,
            z = (j + 0.5) / FLOW_CELLS,
            t = Math.min(1, Math.max(0, ((x - a[0]) * vx + (z - a[1]) * vz) / l2)),
            dist = Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z),
            q = j * W2 + i;
          if (dist >= reach || dist >= best[q]) continue;
          best[q] = dist;
          const rp = rapids.length && rapidAt(at[k] + t * l) ? 1 : 0,
            s = sp * (rp ? FLOW_RAPIDS : 1),
            w = widthAt(st, k) + (widthAt(st, k + 1) - widthAt(st, k)) * t;
          d[q * 4] = (vx / l) * s;
          d[q * 4 + 1] = (vz / l) * s;
          d[q * 4 + 3] = 1 - dist / reach;
          /* white water on rapids, most along the middle */
          if (rp) foam(q, 0.85 * (1 - Math.min(1, Math.max(0, dist - w * 0.25) / Math.max(0.6, w * 0.5 + 0.4))));
        }
    }
    /* where the river meets still water it churns; a spring bubbles at its source */
    const e = p[p.length - 1],
      we = widthAt(st, p.length - 1) || 1.2;
    if (st.mouth === 'pool' || st.mouth === 'lake' || st.mouth === 'sea') {
      const r = we * 0.9 + 1;
      round(e[0], e[1], r, (q, dist) => foam(q, 0.6 * (1 - dist / r)));
    }
    if (st.src === 'spring') {
      const r = widthAt(st, 0) * 0.5 + 0.6;
      round(p[0][0], p[0][1], r, (q, dist) => foam(q, 0.35 * (1 - dist / r)));
    }
  }
  /* a waterfall's foot: white water and churn in its plunge pool */
  for (const [x, z, r] of feet) if (r > 0) round(x, z, r, (q, dist) => foam(q, 1 - (dist / r) * 0.8));
  return { W2, H2, d };
}

/**
 * the flow at a spot (the cell it lies in): [x, z], [0, 0] off the streams
 * @param {FlowMap} F @param {number} x @param {number} z
 */
export function flowMapAt(F, x, z) {
  const i = Math.floor(x * FLOW_CELLS),
    j = Math.floor(z * FLOW_CELLS);
  if (i < 0 || j < 0 || i >= F.W2 || j >= F.H2) return [0, 0];
  const q = (j * F.W2 + i) * 4;
  return [F.d[q], F.d[q + 1]];
}

/** still water bigger than this (m^2, whole tiles) and cut off from the sea is a lake, not a pond (WA-10) */
const OPEN_SEA_LAKE = 600;
/**
 * Which still water joins the open sea (water track WA-10): on a coast, only water that reaches the map's edge through
 * still water is the sea; a pond or a lake behind the beach is not (it took the sea's swell and surf before). Running
 * water (a river) does not join two bodies, so a pond a river drains into the sea stays a pond. Per 1 m tile: 1 the
 * open sea, 2 an enclosed pond, 3 an enclosed lake (over OPEN_SEA_LAKE tiles), 0 dry or running.
 * @param {number} w @param {number} h tiles across and down (j counted from the south, as the walk view's z)
 * @param {(i: number, j: number) => boolean} still tile i, j holds still water
 */
export function waterOpenSea(w, h, still) {
  const n = w * h,
    out = new Uint8Array(n),
    seen = new Uint8Array(n),
    N4 = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
  for (let q0 = 0; q0 < n; q0++) {
    if (seen[q0]) continue;
    const i0 = q0 % w,
      j0 = (q0 - i0) / w;
    if (!still(i0, j0)) continue;
    const comp = [q0];
    seen[q0] = 1;
    let edge = false;
    for (let k = 0; k < comp.length; k++) {
      const q = comp[k],
        i = q % w,
        j = (q - i) / w;
      if (i === 0 || j === 0 || i === w - 1 || j === h - 1) edge = true;
      for (const [a, b] of N4) {
        const ii = i + a,
          jj = j + b;
        if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
        const m = jj * w + ii;
        if (seen[m] || !still(ii, jj)) continue;
        seen[m] = 1;
        comp.push(m);
      }
    }
    const v = edge ? 1 : comp.length > OPEN_SEA_LAKE ? 3 : 2;
    for (const q of comp) out[q] = v;
  }
  return out;
}
