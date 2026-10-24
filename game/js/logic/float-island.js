// @ts-check
'use strict';
/* ================= THE FLOATING ISLAND (the hub's world map) =================
   The owner, 2026-10-23: on the hub's world map Copperleaf's island floats in open sky, no bowl and no sea round it.
   This is its rock: a low-poly cone hanging under the coast, wide and steep at the top and narrowing to a point, and
   a few small rocks floating near it. Calm on purpose (the owner: "not too busy"): few faces, few rocks.
   Coordinates are the bowl's (x east, y north, h up; logic/bowl.js); the triangles come out in the GPU's (x, h, -y),
   as logic/bowl-camera.js bowlToGpu. Logic only, runs in Node (tools/test/float-island.test.mjs); world-bowl.js draws
   them. Each corner: position (3), the face's normal (3), its band (0 the top of the rock, 1 its point; -1 the
   island's cap, -2 a small rock's grassy top) and its bob (0 still, else a phase in 0-1 for a small rock's drift). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  FLOAT_ISLAND: [() => FLOAT_ISLAND],
  FLOAT_STRIDE: [() => FLOAT_STRIDE],
  // @ts-expect-error -- replaced on purpose
  floatGroundHeight: [() => floatGroundHeight, v => (floatGroundHeight = v)],
  // @ts-expect-error -- replaced on purpose
  floatGroundMesh: [() => floatGroundMesh, v => (floatGroundMesh = v)],
  // @ts-expect-error -- replaced on purpose
  floatHash: [() => floatHash, v => (floatHash = v)],
  // @ts-expect-error -- replaced on purpose
  floatInside: [() => floatInside, v => (floatInside = v)],
  // @ts-expect-error -- replaced on purpose
  floatIslandMesh: [() => floatIslandMesh, v => (floatIslandMesh = v)],
  // @ts-expect-error -- replaced on purpose
  floatIslandSize: [() => floatIslandSize, v => (floatIslandSize = v)],
  // @ts-expect-error -- replaced on purpose
  floatResample: [() => floatResample, v => (floatResample = v)],
  // @ts-expect-error -- replaced on purpose
  floatRock: [() => floatRock, v => (floatRock = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** floats per corner: position, normal, band, bob */
export const FLOAT_STRIDE = 8;
/** the rock's shape: corners round the coast, the rings going down (how far out from the middle, how far down as a
 * share of the depth), the depth as a share of the island's width, and the small rocks */
export const FLOAT_ISLAND = {
  /* the owner, 2026-10-24: "less low poly": many corners and rings, its bulges smooth */
  corners: 112,
  rings: [
    [1.0, 0.0],
    [1.0, 0.035],
    [0.97, 0.09],
    [0.91, 0.16],
    [0.83, 0.25],
    [0.73, 0.35],
    [0.62, 0.46],
    [0.5, 0.57],
    [0.38, 0.68],
    [0.26, 0.79],
    [0.15, 0.89],
  ],
  depth: 0.62,
  /** how much each corner is pushed in or out, and up or down (shares): broad bulges and a little grain */
  jitter: 0.13,
  grain: 0.025,
  rocks: 3,
  /** the island's own ground: a square this many metres */
  cell: 1.5,
};

/** a hash in 0-1 @param {number} a @param {number} b */
export function floatHash(a, b) {
  const v = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * The polygon resampled to n corners spaced evenly along its edge, turned counter-clockwise.
 * @param {number[][]} P [x, y] corners @param {number} n @returns {number[][]}
 */
export function floatResample(P, n) {
  let area = 0;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) area += (P[j][0] - P[i][0]) * (P[j][1] + P[i][1]);
  const Q = area > 0 ? P.slice() : P.slice().reverse(),
    len = [0];
  for (let i = 0; i < Q.length; i++) {
    const a = Q[i],
      b = Q[(i + 1) % Q.length];
    len.push(len[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const L = len[Q.length],
    out = [];
  let s = 0;
  for (let k = 0; k < n; k++) {
    const t = (k / n) * L;
    while (s < Q.length - 1 && len[s + 1] < t) s++;
    const a = Q[s],
      b = Q[(s + 1) % Q.length],
      f = len[s + 1] > len[s] ? (t - len[s]) / (len[s + 1] - len[s]) : 0;
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

/**
 * The island's middle (the mean of its corners) and its radius (the mean distance out).
 * @param {number[][]} P @returns {{ c: number[], r: number }}
 */
export function floatIslandSize(P) {
  const c = [0, 0];
  for (const p of P) {
    c[0] += p[0] / P.length;
    c[1] += p[1] / P.length;
  }
  let r = 0;
  for (const p of P) r += Math.hypot(p[0] - c[0], p[1] - c[1]) / P.length;
  return { c, r };
}

/**
 * One rock: a top ring (with a cap), its rings going down and a point, as flat-faced triangles.
 * @param {number[][]} ring the top's corners [x, y], counter-clockwise @param {number[]} c its middle
 * @param {number} top the top's height @param {number} depth how far down the point hangs
 * @param {{ seed?: number, cap?: number, capDrop?: number, bob?: number, rings?: number[][], jitter?: number, grain?: number,
 *   lift?: (x: number, y: number) => number }} [o]
 * cap: the cap's band (-1 the island's, -2 grass; undefined: none), capDrop: how far under the top the cap sits,
 * lift: a height added under each corner (the water's curve the coast sits on)
 * @returns {number[]}
 */
export function floatRock(ring, c, top, depth, o = {}) {
  const seed = o.seed || 0,
    J = o.jitter ?? FLOAT_ISLAND.jitter,
    R = o.rings || FLOAT_ISLAND.rings,
    bob = o.bob || 0,
    lift = o.lift || (() => 0),
    n = ring.length,
    /** @type {number[][][]} */ rows = [],
    out = /** @type {number[]} */ ([]);
  /* broad bulges round the rock (a smooth noise over the angle, new each ring) and a little grain per corner */
  const lumps = 9,
    bulge = (/** @type {number} */ k, /** @type {number} */ i) => {
      const t = (i / n) * lumps,
        a = Math.floor(t),
        f = t - a,
        e = f * f * (3 - 2 * f);
      return floatHash(seed + k, a % lumps) * (1 - e) + floatHash(seed + k, (a + 1) % lumps) * e - 0.5;
    },
    G = o.grain ?? FLOAT_ISLAND.grain;
  /* the point: under the middle, a little off it */
  const tip = [c[0] + (floatHash(seed, 1) - 0.5) * depth * 0.18, c[1] + (floatHash(seed, 2) - 0.5) * depth * 0.18, 0];
  tip[2] = top - depth + lift(tip[0], tip[1]);
  R.forEach(([s, d], k) => {
    rows.push(
      ring.map((p, i) => {
        const w = k ? 1 + bulge(k, i) * 2 * J + (floatHash(seed + k, i) - 0.5) * 2 * G : 1,
          dz = k ? bulge(k + 50, i) * J * 0.5 + (floatHash(seed + k, i + 99) - 0.5) * G : 0,
          /* the lower rings lean towards the point */
          lean = d * d * 0.6;
        const x = c[0] + (p[0] - c[0]) * s * w,
          y = c[1] + (p[1] - c[1]) * s * w;
        const X = x + (tip[0] - x) * lean * (1 - s),
          Y = y + (tip[1] - y) * lean * (1 - s);
        return [X, Y, top - depth * Math.max(0, d + dz) + lift(X, Y)];
      })
    );
  });
  /** @param {number[]} a @param {number[]} b @param {number[]} q @param {number} band */
  const tri = (a, b, q, band) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      v = [q[0] - a[0], q[1] - a[1], q[2] - a[2]];
    /* the bowl's normal (x, y, h), turned outward: away from the rock's axis, or up for a cap */
    let N = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = [(a[0] + b[0] + q[0]) / 3 - c[0], (a[1] + b[1] + q[1]) / 3 - c[1]],
      out2 = band < 0 ? N[2] : N[0] * m[0] + N[1] * m[1] - N[2] * 0.3;
    if (out2 < 0) N = N.map(x => -x);
    const l = Math.hypot(N[0], N[1], N[2]) || 1;
    for (const p of [a, b, q]) out.push(p[0], p[2], -p[1], N[0] / l, N[2] / l, -N[1] / l, band, bob);
  };
  for (let k = 0; k + 1 < rows.length; k++) {
    const A = rows[k],
      B = rows[k + 1],
      band = (R[k][1] + R[k + 1][1]) / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tri(A[i], A[j], B[j], band);
      tri(A[i], B[j], B[i], band);
    }
  }
  const last = rows[rows.length - 1];
  for (let i = 0; i < n; i++) tri(last[i], last[(i + 1) % n], tip, 0.95);
  if (o.cap != null) {
    const h = top - (o.capDrop || 0),
      mid = [c[0], c[1], h + lift(c[0], c[1])];
    for (let i = 0; i < n; i++) {
      const a = rows[0][i],
        b = rows[0][(i + 1) % n];
      tri([a[0], a[1], h + lift(a[0], a[1])], [b[0], b[1], h + lift(b[0], b[1])], mid, o.cap);
    }
  }
  return out;
}

/**
 * The whole floating island: its rock under the coast (and a cap just under the land, so no gap shows between the
 * ground's edge and the rock) and a few small rocks floating round it.
 * @param {number[][]} coast the coast [x, y] in the bowl's coordinates @param {number} top the coast's height
 * @param {{ seed?: number, rocks?: number, lift?: (x: number, y: number) => number }} [o]
 * @returns {{ data: Float32Array, c: number[], r: number, depth: number }}
 */
export function floatIslandMesh(coast, top, o = {}) {
  const K = FLOAT_ISLAND,
    seed = o.seed || 0,
    ring = floatResample(coast, K.corners),
    { c, r } = floatIslandSize(ring),
    depth = r * 2 * K.depth,
    lift = o.lift,
    out = floatRock(ring, c, top, depth, { seed, cap: -1, capDrop: r * 0.004, lift });
  const nr = o.rocks ?? K.rocks;
  for (let q = 0; q < nr; q++) {
    /* round the island, spread out, at different heights and sizes */
    const a = ((q + floatHash(seed + 7, q) * 0.5) / nr) * Math.PI * 2 + 0.6,
      far = r * (1.35 + floatHash(seed + 8, q) * 0.35),
      size = r * (0.07 + floatHash(seed + 9, q) * 0.06),
      x = c[0] + Math.cos(a) * far,
      y = c[1] + Math.sin(a) * far,
      h = top - depth * (0.12 + floatHash(seed + 10, q) * 0.3),
      m = 16,
      small = [];
    for (let i = 0; i < m; i++) {
      const b = (i / m) * Math.PI * 2,
        w = size * (0.8 + floatHash(seed + 11 + q, i) * 0.4);
      small.push([x + Math.cos(b) * w, y + Math.sin(b) * w]);
    }
    out.push(
      ...floatRock(small, [x, y], h, size * 2.2, {
        seed: seed + 20 + q,
        cap: -2,
        bob: 0.1 + q / nr,
        lift,
        rings: [
          [1, 0],
          [0.97, 0.12],
          [0.85, 0.3],
          [0.65, 0.5],
          [0.4, 0.72],
        ],
        jitter: 0.2,
      })
    );
  }
  return { data: new Float32Array(out), c, r, depth };
}

/** a point inside a polygon given as [x0, y0, x1, y1, ...] @param {ArrayLike<number>} P @param {number} x
 * @param {number} y */
export function floatInside(P, x, y) {
  let o = false;
  for (let i = 0, j = P.length - 2; i < P.length; j = i, i += 2) {
    const xi = P[i],
      yi = P[i + 1],
      xj = P[j],
      yj = P[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) o = !o;
  }
  return o;
}

/**
 * The floating island's own ground, finer than the bowl's grid (the owner: "less low poly"): a square every `cell`
 * across the island, its height from the island map's own heights inside the coast and just under the water's line
 * outside it (so the ground's edge meets the coast), two triangles a square, only squares that touch the land.
 * @param {ArrayLike<number>} poly the coast [x0, y0, ...] @param {(x: number, y: number) => number} heightAt inside
 * @param {(x: number, y: number) => number} waterAt the water's line @param {number} cell the square, in bowl units
 * @returns {{ V: Float32Array, I: Uint32Array, n: number, x0: number, y0: number, cell: number, h: Float32Array }}
 */
export function floatGroundMesh(poly, heightAt, waterAt, cell) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let k = 0; k < poly.length; k += 2) {
    x0 = Math.min(x0, poly[k]);
    x1 = Math.max(x1, poly[k]);
    y0 = Math.min(y0, poly[k + 1]);
    y1 = Math.max(y1, poly[k + 1]);
  }
  x0 -= cell * 2;
  y0 -= cell * 2;
  const nx = Math.ceil((x1 + cell * 2 - x0) / cell),
    ny = Math.ceil((y1 + cell * 2 - y0) / cell),
    w = nx + 1,
    V = new Float32Array(w * (ny + 1) * 3),
    h = new Float32Array(w * (ny + 1)),
    inn = new Uint8Array(w * (ny + 1)),
    /** @type {number[]} */ I = [];
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const x = x0 + i * cell,
        y = y0 + j * cell,
        q = j * w + i,
        on = floatInside(poly, x, y);
      inn[q] = on ? 1 : 0;
      h[q] = on ? heightAt(x, y) : waterAt(x, y) - cell * 0.6;
      V.set([x, h[q], -y], q * 3);
    }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * w + i,
        b = a + 1,
        c = a + w,
        d = c + 1;
      if (inn[a] + inn[b] + inn[c] + inn[d]) I.push(a, b, d, a, d, c);
    }
  return { V, I: new Uint32Array(I), n: nx, x0, y0, cell, h };
}

/**
 * The fine ground's height at a point (the triangle it falls in, as drawn), or null outside it.
 * @param {{ n: number, x0: number, y0: number, cell: number, h: Float32Array }} M @param {number} x @param {number} y
 */
export function floatGroundHeight(M, x, y) {
  const w = M.n + 1,
    rows = M.h.length / w - 1,
    u = (x - M.x0) / M.cell,
    v = (y - M.y0) / M.cell,
    i = Math.floor(u),
    j = Math.floor(v);
  if (i < 0 || j < 0 || i >= M.n || j >= rows) return null;
  const fu = u - i,
    fv = v - j,
    a = M.h[j * w + i],
    b = M.h[j * w + i + 1],
    c = M.h[(j + 1) * w + i],
    d = M.h[(j + 1) * w + i + 1];
  /* split from (i, j) to (i + 1, j + 1) */
  return fu >= fv ? a + (b - a) * fu + (d - b) * fv : a + (d - c) * fu + (c - a) * fv;
}
