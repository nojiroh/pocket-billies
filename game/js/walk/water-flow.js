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
  ESTUARY_COAST: [() => ESTUARY_COAST],
  ESTUARY_IN: [() => ESTUARY_IN],
  ESTUARY_OUT: [() => ESTUARY_OUT],
  FLOW_BODY: [() => FLOW_BODY],
  FLOW_BODY_LOOK: [() => FLOW_BODY_LOOK],
  FLOW_CELLS: [() => FLOW_CELLS],
  FLOW_RAPIDS: [() => FLOW_RAPIDS],
  FLOW_REACH: [() => FLOW_REACH],
  OPEN_SEA_LAKE: [() => OPEN_SEA_LAKE],
  PROFILE_HALF: [() => PROFILE_HALF],
  // @ts-expect-error -- replaced on purpose
  flowChannels: [() => flowChannels, v => (flowChannels = v)],
  // @ts-expect-error -- replaced on purpose
  flowMapAt: [() => flowMapAt, v => (flowMapAt = v)],
  // @ts-expect-error -- replaced on purpose
  waterFlowMap: [() => waterFlowMap, v => (waterFlowMap = v)],
  // @ts-expect-error -- replaced on purpose
  waterOpenSea: [() => waterOpenSea, v => (waterOpenSea = v)],
  // @ts-expect-error -- replaced on purpose
  waterRiverProfile: [() => waterRiverProfile, v => (waterRiverProfile = v)],
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
 * @typedef {{W2: number, H2: number, d: Float32Array, cls?: Uint8Array, lev?: Float32Array}} FlowMap
 * @typedef {{wet: (x: number, z: number) => boolean, bed: (x: number, z: number) => number, step: (x: number, z: number) => number, sea?: boolean}} FlowOpts
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
 * @param {FlowOpts} [o] the scene's water and its levels (WA-10: the channels, their levels and estuaries; none: the
 *   flow alone, as before)
 * @returns {FlowMap}
 */
export function waterFlowMap(sc, feet = [], o) {
  const W2 = Math.max(1, Math.round(sc.w * FLOW_CELLS)),
    H2 = Math.max(1, Math.round(sc.h * FLOW_CELLS)),
    d = new Float32Array(W2 * H2 * 4),
    best = new Float64Array(W2 * H2).fill(Infinity),
    /* WA-10: which stream each cell runs with and how far along its line */
    si = new Int16Array(W2 * H2).fill(-1),
    sa = new Float32Array(W2 * H2),
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
  for (const [sn, st] of (sc.streams || []).entries()) {
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
          si[q] = sn;
          sa[q] = at[k] + t * l;
          const rp = rapids.length && rapidAt(at[k] + t * l) ? 1 : 0,
            s = sp * (rp ? FLOW_RAPIDS : 1),
            w = widthAt(st, k) + (widthAt(st, k + 1) - widthAt(st, k)) * t;
          d[q * 4] = (vx / l) * s;
          d[q * 4 + 1] = (vz / l) * s;
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
  const F = { W2, H2, d };
  if (o) flowChannels(sc, F, si, sa, o);
  return F;
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

/* water track WA-10: a river runs only in its channel. Water wider than a channel (a disc of more than FLOW_BODY
   metres' radius fits in it and covers the cell: a pond, a lake, the sea) is a body: no flow there, so a river stops at
   the pond it leaves and at the coast it reaches (it ran 2.5 m into both, and out to its line's end in the sea) */
const FLOW_BODY = 3.25;
/* how far a disc is looked for round a cell (m): a body any wider counts the same */
const FLOW_BODY_LOOK = 6;
/* the estuary (m): the river's look fades over the last ESTUARY_IN metres of its channel, then a plume of it spreads
   ESTUARY_OUT metres into the water it joins */
const ESTUARY_IN = 4;
const ESTUARY_OUT = 7;
/* the river's share at the coast: the channel's last metres fade from 1 to this, the plume from this to 0 */
const ESTUARY_COAST = 0.65;
/* the river's level is a moving average over this many metres either way (between the land's steps) */
const PROFILE_HALF = 3;

/**
 * A river's water level along its line (water track WA-10): never rising, smoothed, and never under the water it
 * runs into. beds: the level the ground under the line would give at each point (bed - 0.12, by the walk view's
 * rule), steps: the land's step raise at each (a terrace's drop is kept, not smoothed into a ramp), end: the level of
 * the body it ends in (null: none), half: points either way in the moving average, ease: the last points that come
 * down to the end's level.
 * @param {ArrayLike<number>} beds @param {ArrayLike<number>} steps @param {number | null} end @param {number} half
 * @param {number} [ease]
 */
function waterRiverProfile(beds, steps, end, half, ease = 0) {
  const n = beds.length,
    a = new Float64Array(n),
    b = new Float64Array(n);
  let m = Infinity;
  for (let k = 0; k < n; k++) a[k] = m = Math.min(m, beds[k]);
  for (let k = 0; k < n; k++) {
    let s = 0,
      c = 0;
    for (let i = k; i >= Math.max(0, k - half) && Math.abs(steps[i] - steps[k]) < 0.05; i--) ((s += a[i]), c++);
    for (let i = k + 1; i <= Math.min(n - 1, k + half) && Math.abs(steps[i] - steps[k]) < 0.05; i++) ((s += a[i]), c++);
    b[k] = s / c;
  }
  m = Infinity;
  for (let k = 0; k < n; k++) {
    m = Math.min(m, b[k]);
    b[k] = end === null ? m : Math.max(m, end);
  }
  /* over its last `ease` points it comes down to the body's level (no step where it meets it) */
  if (end !== null)
    for (let k = Math.max(0, n - ease); k < n; k++) {
      const f = (k - (n - ease) + 1) / ease,
        g = f * f * (3 - 2 * f);
      b[k] += (end - b[k]) * g;
    }
  return b;
}

/**
 * Where each stream runs and how high (WA-10), on a flow map just built: clips the flow to the channel (between the
 * body it leaves and the body it reaches), lays the river's level along its line, and the estuary where it meets a
 * body: the channel's last metres and a plume past the coast carry the river's share (0-1) in the map's fourth
 * number, read by the water shader to mix the river's look into the body's. Fills F.cls per cell (0 none or still,
 * 1 running, 2 running in the estuary, 3 the plume: still, but drifting) and F.lev (the river's level, NaN off it).
 * @param {{w: number, h: number, streams?: FlowStream[]}} sc
 * @param {FlowMap} F @param {Int16Array} si @param {Float32Array} sa @param {FlowOpts} o
 */
function flowChannels(sc, F, si, sa, o) {
  const { W2, H2, d } = F,
    n = W2 * H2,
    wet = new Uint8Array(n),
    D = new Float32Array(n),
    cls = new Uint8Array(n),
    lev = new Float32Array(n).fill(NaN),
    cov = new Float32Array(n).fill(-1),
    C = FLOW_CELLS,
    at = (/** @type {number} */ x, /** @type {number} */ z) => {
      const i = Math.floor(x * C),
        j = Math.floor(z * C);
      return i < 0 || j < 0 || i >= W2 || j >= H2 ? -1 : j * W2 + i;
    };
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++) wet[j * W2 + i] = o.wet((i + 0.5) / C, (j + 0.5) / C) ? 1 : 0;
  /* how far each wet cell lies from dry ground (m; two passes; past the map's edge is not dry) */
  const S2 = Math.SQRT2 / C,
    S1 = 1 / C;
  for (let q = 0; q < n; q++) D[q] = wet[q] ? 1e9 : 0;
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++) {
      const q = j * W2 + i;
      if (!D[q]) continue;
      let v = D[q];
      if (i > 0) v = Math.min(v, D[q - 1] + S1);
      if (j > 0) {
        v = Math.min(v, D[q - W2] + S1);
        if (i > 0) v = Math.min(v, D[q - W2 - 1] + S2);
        if (i < W2 - 1) v = Math.min(v, D[q - W2 + 1] + S2);
      }
      D[q] = v;
    }
  for (let j = H2 - 1; j >= 0; j--)
    for (let i = W2 - 1; i >= 0; i--) {
      const q = j * W2 + i;
      if (!D[q]) continue;
      let v = D[q];
      if (i < W2 - 1) v = Math.min(v, D[q + 1] + S1);
      if (j < H2 - 1) {
        v = Math.min(v, D[q + W2] + S1);
        if (i < W2 - 1) v = Math.min(v, D[q + W2 + 1] + S2);
        if (i > 0) v = Math.min(v, D[q + W2 - 1] + S2);
      }
      D[q] = v;
    }
  /* the widest disc of water covering a cell (m, up to FLOW_BODY_LOOK), worked out only where asked */
  const R = Math.ceil(FLOW_BODY_LOOK * C),
    cover = (/** @type {number} */ q) => {
      if (cov[q] >= 0) return cov[q];
      let best = 0;
      if (wet[q]) {
        const i0 = q % W2,
          j0 = (q - i0) / W2;
        for (let j = Math.max(0, j0 - R); j <= Math.min(H2 - 1, j0 + R); j++)
          for (let i = Math.max(0, i0 - R); i <= Math.min(W2 - 1, i0 + R); i++) {
            const r = Math.min(D[j * W2 + i], FLOW_BODY_LOOK);
            if (r > best && Math.hypot(i - i0, j - j0) / C <= r) best = r;
          }
      }
      return (cov[q] = best);
    };
  /* each stream's line every half metre: where it leaves its head's body, where it reaches its mouth's, its level */
  const lines = (sc.streams || []).map(st => {
    const p = st.pts || [];
    if (p.length < 2) return null;
    const P = [],
      Sx = [];
    let acc = 0;
    for (let k = 0; k < p.length - 1; k++) {
      const l = Math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]);
      for (let t = 0; t < l; t += 1 / C) {
        P.push([p[k][0] + ((p[k + 1][0] - p[k][0]) * t) / l, p[k][1] + ((p[k + 1][1] - p[k][1]) * t) / l]);
        Sx.push(acc + t);
      }
      acc += l;
    }
    P.push(p[p.length - 1]);
    Sx.push(acc);
    let hw = 0;
    for (let k = 0; k < p.length; k++) hw = Math.max(hw, widthAt(st, k) / 2);
    const th = Math.max(FLOW_BODY, hw + 0.75),
      body = P.map(([x, z]) => {
        const q = at(x, z);
        return q < 0 ? !!o.sea : cover(q) > th;
      });
    let ih = 0,
      im = P.length - 1;
    if (body[0]) while (ih < P.length - 1 && body[ih]) ih++;
    const mouth = body[P.length - 1];
    if (mouth) while (im > ih && body[im]) im--;
    /* the level of the body it ends in: its water's own level (the bed's rule) over the last metres of the line */
    let end = /** @type {number | null} */ (null);
    if (mouth) {
      let s = 0,
        c = 0;
      for (let k = im + 1; k < Math.min(P.length, im + 1 + 6 * C); k++) {
        if (at(P[k][0], P[k][1]) < 0) continue;
        s += o.bed(P[k][0], P[k][1]);
        c++;
      }
      if (c) end = s / c;
    }
    const beds = [],
      steps = [];
    let last = NaN;
    for (let k = ih; k <= im; k++) {
      const [x, z] = P[k],
        q = at(x, z);
      if (q >= 0 && wet[q]) last = o.bed(x, z);
      beds.push(isNaN(last) ? o.bed(x, z) : last);
      steps.push(o.step(x, z));
    }
    const prof = waterRiverProfile(beds, steps, end, PROFILE_HALF * C, ESTUARY_IN * C),
      k1 = Math.min(P.length - 1, im + 1),
      k0 = Math.max(0, im - 1),
      dl = Math.hypot(P[k1][0] - P[k0][0], P[k1][1] - P[k0][1]) || 1;
    return {
      sh: Sx[ih],
      sm: Sx[im],
      mouth,
      m: P[im],
      dir: [(P[k1][0] - P[k0][0]) / dl, (P[k1][1] - P[k0][1]) / dl],
      speed: st.speed || 1,
      th,
      levAt: (/** @type {number} */ s) => prof[Math.max(0, Math.min(prof.length - 1, Math.round(s * C) - ih))],
    };
  });
  /* the channel: running cells between the two bodies; the estuary's last metres */
  for (let q = 0; q < n; q++) {
    d[q * 4 + 3] = 0;
    const L = si[q] >= 0 ? lines[si[q]] : null;
    if (!L || (d[q * 4] === 0 && d[q * 4 + 1] === 0)) continue;
    const s = sa[q];
    if (!wet[q] || s < L.sh - 0.25 || s > L.sm + 0.25 || cover(q) > L.th) {
      d[q * 4] = d[q * 4 + 1] = 0;
      continue;
    }
    cls[q] = 1;
    lev[q] = L.levAt(s);
    if (L.mouth && s > L.sm - ESTUARY_IN) {
      const f = Math.min(1, (s - (L.sm - ESTUARY_IN)) / ESTUARY_IN),
        sh = 1 - (1 - ESTUARY_COAST) * f * f * (3 - 2 * f);
      cls[q] = 2;
      d[q * 4 + 3] = sh;
      d[q * 4] *= 0.5 + 0.5 * sh;
      d[q * 4 + 1] *= 0.5 + 0.5 * sh;
    }
  }
  /* the plume: the river's share spreading into the body past its mouth, longest straight out, drifting outward */
  for (const L of lines) {
    if (!L || !L.mouth) continue;
    const [mx, mz] = L.m,
      [dx, dz] = L.dir,
      r = ESTUARY_OUT * 1.6;
    for (let j = Math.max(0, Math.floor((mz - r) * C)); j <= Math.min(H2 - 1, Math.floor((mz + r) * C)); j++)
      for (let i = Math.max(0, Math.floor((mx - r) * C)); i <= Math.min(W2 - 1, Math.floor((mx + r) * C)); i++) {
        const q = j * W2 + i;
        if (!wet[q] || cls[q] === 1 || cls[q] === 2) continue;
        const x = (i + 0.5) / C - mx,
          z = (j + 0.5) / C - mz,
          al = x * dx + z * dz,
          la = x * dz - z * dx,
          e = Math.hypot(Math.max(0, al) / 1.6, la) / ESTUARY_OUT;
        if (e >= 1) continue;
        const f = 1 - e * e * (3 - 2 * e),
          sh = ESTUARY_COAST * f;
        if (sh <= d[q * 4 + 3]) continue;
        cls[q] = 3;
        d[q * 4 + 3] = sh;
        /* the flow fans out from a point behind the mouth and slows as the share fades */
        const ox = x + dx * 2,
          oz = z + dz * 2,
          ol = Math.hypot(ox, oz) || 1,
          v = L.speed * 0.6 * (sh / ESTUARY_COAST);
        d[q * 4] = (ox / ol) * v;
        d[q * 4 + 1] = (oz / ol) * v;
      }
  }
  F.cls = cls;
  F.lev = lev;
}
