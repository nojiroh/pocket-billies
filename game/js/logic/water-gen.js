// @ts-check
'use strict';
/* ================= RIVERS THAT RUN DOWNHILL (water track WA-3a, lane G) =================
   A generated scene's river, made from its height grid (logic/mapgen.js calls it from its water stage):
   - a source (a spring, a free side, a lake, or a joined edge where the neighbour's river comes in) and a mouth (the
     sea, a lake, a side, or a pool it fills), tried a few ways and the best kept;
   - the land flooded from the mouth (priority flood, Barnes 2014: every dip filled, a hair's rise across flats), so
     the way down from any corner leads to the mouth; the flow summed along it;
   - the line followed down, smoothed, meandering where the ground is flat; wider downstream; its water level never
     higher than the point before; rapids where it drops steeply;
   - painted like mapgenPaintStream (deep in the middle, shallow, the bank), then (waterGenCarve, after the stage has
     lowered the water) the bed carved to that level, the banks eased, and a joined edge's crossing kept wet and
     unpinned so the two scenes' rivers meet.
   `streams` keeps the contract's shape: {pts, speed} as before, with `w` (a width per point), `src`, `mouth` and
   `rapids` ([[t0, t1]], fractions along the line). Its own random stream ('heights', 'river'); the old line
   (mapgenStreamLine) only when no river fits. Logic only: no DOM, runs in Node (tools/test/water-gen.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import {
  MAPGEN_INWARD,
  MAPGEN_STRAIGHT_IN,
  mapgenAlong,
  mapgenCellAt,
  mapgenDepth,
  mapgenNearSpan,
  mapgenNoise,
  mapgenOccAdd,
  mapgenPaintDisc,
  mapgenPaintStream,
  mapgenResample,
  mapgenRound2,
  mapgenSegCross,
  mapgenSimplify,
  mapgenStreamLine,
} from './mapgen.js';
/* eslint-disable no-func-assign */
expose({
  WATERGEN_DEPTH: [() => WATERGEN_DEPTH],
  WATERGEN_FLAT: [() => WATERGEN_FLAT],
  WATERGEN_NB8: [() => WATERGEN_NB8],
  WATERGEN_RAPID: [() => WATERGEN_RAPID],
  WATERGEN_RAPID_LEN: [() => WATERGEN_RAPID_LEN],
  WATERGEN_SEAM_REACH: [() => WATERGEN_SEAM_REACH],
  WATERGEN_STRAIGHT: [() => WATERGEN_STRAIGHT],
  WATERGEN_TRIES: [() => WATERGEN_TRIES],
  WATERGEN_UNDER: [() => WATERGEN_UNDER],
  waterGenBetween: [() => waterGenBetween],
  // @ts-expect-error -- replaced on purpose
  waterGenBlocked: [() => waterGenBlocked, v => (waterGenBlocked = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenBlockedBase: [() => waterGenBlockedBase, v => (waterGenBlockedBase = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenBodies: [() => waterGenBodies, v => (waterGenBodies = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenCarve: [() => waterGenCarve, v => ((waterGenCarve = v), provide({ waterGenCarve }))],
  // @ts-expect-error -- replaced on purpose
  waterGenCorners: [() => waterGenCorners, v => (waterGenCorners = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenCutsOff: [() => waterGenCutsOff, v => (waterGenCutsOff = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenFits: [() => waterGenFits, v => (waterGenFits = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenFlood: [() => waterGenFlood, v => (waterGenFlood = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenFlowSum: [() => waterGenFlowSum, v => (waterGenFlowSum = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenHeap: [() => waterGenHeap, v => (waterGenHeap = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenHeightAt: [() => waterGenHeightAt, v => (waterGenHeightAt = v)],
  waterGenOnSide: [() => waterGenOnSide],
  // @ts-expect-error -- replaced on purpose
  waterGenPaint: [() => waterGenPaint, v => (waterGenPaint = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenRiver: [() => waterGenRiver, v => ((waterGenRiver = v), provide({ waterGenRiver }))],
  // @ts-expect-error -- replaced on purpose
  waterGenSeamCells: [() => waterGenSeamCells, v => (waterGenSeamCells = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenSeamLevel: [() => waterGenSeamLevel, v => (waterGenSeamLevel = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenSeamRiver: [() => waterGenSeamRiver, v => (waterGenSeamRiver = v)],
  waterGenSegDist: [() => waterGenSegDist],
  // @ts-expect-error -- replaced on purpose
  waterGenShape: [() => waterGenShape, v => (waterGenShape = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenShorten: [() => waterGenShorten, v => (waterGenShorten = v)],
  waterGenSideLen: [() => waterGenSideLen],
  // @ts-expect-error -- replaced on purpose
  waterGenSideSpans: [() => waterGenSideSpans, v => (waterGenSideSpans = v)],
  waterGenSmooth: [() => waterGenSmooth],
  // @ts-expect-error -- replaced on purpose
  waterGenSmoothLine: [() => waterGenSmoothLine, v => (waterGenSmoothLine = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenTry: [() => waterGenTry, v => (waterGenTry = v)],
});
/* eslint-enable no-func-assign */
provide({ waterGenCarve, waterGenRiver });
/* to-module: end */
/** metres a river runs straight across a side before it turns, so a seam is crossed head on */
export const WATERGEN_STRAIGHT = 8;
/** how far from an exit along its side a river may cross (m, to its middle less its half width): two exits on a side
 * may be 44 m apart, so the other's neighbour band (MAPGEN_BAND, 26 m) starts 18 m from this one, less 2 m for the
 * bank: a crossing then lies in one neighbour's stretch only (mapgenEdgeCorrection, mapgenSeamAgreement) */
export const WATERGEN_SEAM_REACH = 16;
/** sources and mouths tried */
export const WATERGEN_TRIES = 12;
/** how much lower the middle of the bed lies than the river's edge (m) */
export const WATERGEN_DEPTH = 0.3;
/** the river's edge under its bank (m) */
export const WATERGEN_UNDER = 0.15;
/** a drop steeper than this (m a metre) over WATERGEN_RAPID_LEN metres is rapids */
export const WATERGEN_RAPID = 0.06;
export const WATERGEN_RAPID_LEN = 3;
/** below this slope (m a metre) the river meanders */
export const WATERGEN_FLAT = 0.02;

/* ---------- the grid: corners (w+1) x (h+1), as G.H ---------- */
/** a min-heap of corner indices by value (ties by index, so the order is the same everywhere) */
export function waterGenHeap(n) {
  let k = new Int32Array(n),
    v = new Float64Array(n),
    size = 0;
  const less = (a, b) => v[a] < v[b] || (v[a] === v[b] && k[a] < k[b]);
  const swap = (a, b) => {
    const tk = k[a],
      tv = v[a];
    k[a] = k[b];
    v[a] = v[b];
    k[b] = tk;
    v[b] = tv;
  };
  return {
    get size() {
      return size;
    },
    push(key, val) {
      if (size === k.length) {
        const k2 = new Int32Array(size * 2),
          v2 = new Float64Array(size * 2);
        k2.set(k);
        v2.set(v);
        k = k2;
        v = v2;
      }
      let i = size++;
      k[i] = key;
      v[i] = val;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!less(i, p)) break;
        swap(i, p);
        i = p;
      }
    },
    pop() {
      const out = k[0];
      size--;
      if (size > 0) {
        k[0] = k[size];
        v[0] = v[size];
        let i = 0;
        for (;;) {
          const l = 2 * i + 1,
            r = l + 1;
          let m = i;
          if (l < size && less(l, m)) m = l;
          if (r < size && less(r, m)) m = r;
          if (m === i) break;
          swap(i, m);
          i = m;
        }
      }
      return out;
    },
  };
}
export const WATERGEN_NB8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
/**
 * the land flooded from a set of outlet corners (priority flood): Hf, each corner's height with the dips filled (a
 * hair higher than the corner it drains to, so flats drain too); recv, the corner it drains to (-1: an outlet or not
 * reached); order, the corners from the lowest. Blocked corners are walls (never reached)
 * @param {Float32Array} H corner heights, (w+1) x (h+1)
 * @param {number} w @param {number} h
 * @param {number[]} outlets @param {Uint8Array | null} blocked
 */
export function waterGenFlood(H, w, h, outlets, blocked) {
  const W = w + 1,
    n = W * (h + 1),
    Hf = new Float64Array(n).fill(Infinity),
    recv = new Int32Array(n).fill(-1),
    order = [],
    heap = waterGenHeap(n + outlets.length),
    done = new Uint8Array(n);
  for (const c of outlets) {
    if (Hf[c] !== Infinity) continue;
    Hf[c] = H[c];
    heap.push(c, Hf[c]);
  }
  while (heap.size) {
    const c = heap.pop();
    if (done[c]) continue;
    done[c] = 1;
    order.push(c);
    const i = c % W,
      j = (c - i) / W;
    for (const [di, dj] of WATERGEN_NB8) {
      const ii = i + di,
        jj = j + dj;
      if (ii < 0 || jj < 0 || ii > w || jj > h) continue;
      const q = jj * W + ii;
      if (done[q] || (blocked && blocked[q])) continue;
      const v = Math.max(H[q], Hf[c] + 1e-4 * (di && dj ? 1.414 : 1));
      if (v < Hf[q]) {
        Hf[q] = v;
        recv[q] = c;
        heap.push(q, v);
      }
    }
  }
  return { Hf, recv, order };
}
/** the flow through each corner: itself plus everything that drains through it (the flood's order, highest first) */
export function waterGenFlowSum(recv, order) {
  const f = new Float64Array(recv.length);
  for (let k = order.length - 1; k >= 0; k--) {
    const c = order[k];
    f[c] += 1;
    if (recv[c] >= 0) f[recv[c]] += f[c];
  }
  return f;
}

/* ---------- small geometry ---------- */
export const waterGenBetween = (v, a, b) => (v < a ? a : v > b ? b : v);
export const waterGenSmooth = t => t * t * (3 - 2 * t);
/** the corner height at (x, z), bilinear */
export function waterGenHeightAt(H, w, h, x, z) {
  const xc = waterGenBetween(x, 0, w),
    zc = waterGenBetween(z, 0, h),
    i = Math.min(w - 1, Math.floor(xc)),
    j = Math.min(h - 1, Math.floor(zc)),
    fx = xc - i,
    fz = zc - j,
    W = w + 1;
  const a = H[j * W + i],
    b = H[j * W + i + 1],
    c = H[(j + 1) * W + i],
    d = H[(j + 1) * W + i + 1];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
export const waterGenSegDist = (x, z, a, b) => {
  const vx = b[0] - a[0],
    vz = b[1] - a[1],
    l2 = vx * vx + vz * vz || 1e-9,
    t = waterGenBetween(((x - a[0]) * vx + (z - a[1]) * vz) / l2, 0, 1);
  return Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z);
};
/** a point on a side at u along it, d in from it */
export const waterGenOnSide = (G, side, u, d) =>
  side === 'N' ? [u, G.h - d] : side === 'S' ? [u, d] : side === 'E' ? [G.w - d, u] : [d, u];
export const waterGenSideLen = (G, side) => (side === 'N' || side === 'S' ? G.w : G.h);

/* ---------- where a river may not go ---------- */
/**
 * where a river may cross a side: anywhere along a side with no exit, else the stretches near its exits where a
 * neighbour shows it (WATERGEN_SEAM_REACH either side of the exit) less the exit's dried road run; nowhere on a
 * joined edge.
 * [u0, u1] ranges, for a river half width r
 */
export function waterGenSideSpans(G, side, r) {
  /* a joined edge is the neighbour's: only its own river crosses it (waterGenSeamRiver) */
  if (G.joined.some(s => s.side === side)) return [];
  const L = waterGenSideLen(G, side),
    ex = G.exits.filter(e => e.side === side);
  if (!ex.length) return [[6 + r, L - 6 - r]];
  const spans = [];
  for (const e of ex) {
    const at = mapgenAlong(side, e.pt[0], e.pt[1]),
      dry = e.width / 2 + G.P.road.width / 2 + 3 + r,
      far = WATERGEN_SEAM_REACH - r;
    if (far > dry) spans.push([Math.max(6 + r, at - far), at - dry], [at + dry, Math.min(L - 6 - r, at + far)]);
  }
  return spans.filter(s => s[1] - s[0] >= 1).map(s => [Math.ceil(s[0]), Math.floor(s[1])]);
}
/** corners a river may not run through (r: its half width): the exits' straight road runs, round the middle of the
 * main road (the hub's place, kept unless a neighbour's river must come in; in a town its street and lots too), other water, and the strip by each side it neither starts nor ends at (so a pinned or
 * joined edge keeps its height and a seam its land) */
export function waterGenBlocked(G, r, ends) {
  const B = waterGenBlockedBase(G, r, ends.seam).slice(),
    { w, h } = G,
    W = w + 1;
  for (const s of 'NSEW') {
    if (ends.sides.includes(s)) continue;
    const d = Math.min(WATERGEN_STRAIGHT, 3 + r);
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) if (mapgenDepth(G, s, i, j) < d) B[j * W + i] = 1;
  }
  return B;
}
/** waterGenBlocked's corners that are the same for every way tried: kept on G for the river's half width */
export function waterGenBlockedBase(G, r, seam) {
  const key = r + (seam ? 's' : '');
  if (G.riverBlocked && G.riverBlocked.key === key) return G.riverBlocked.B;
  const { w, h } = G,
    W = w + 1,
    B = new Uint8Array(W * (h + 1)),
    M = G.road[0] && G.road[0].pts,
    mid = M ? M[Math.floor(M.length / 2)] : null,
    /* a town's street, square, clinic, shop and houses: north of the main road round its middle (mapgenStageTown) */
    town = G.P.kind === 'town' ? mid : null;
  const runs = G.exits.map(e => {
    const n = MAPGEN_INWARD[e.side];
    return {
      a: e.pt,
      b: [e.pt[0] + n[0] * (MAPGEN_STRAIGHT_IN + 2), e.pt[1] + n[1] * (MAPGEN_STRAIGHT_IN + 2)],
      r: e.width / 2 + G.P.road.width / 2 + 2 + r,
    };
  });
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      const c = j * W + i;
      let b =
        runs.some(R => waterGenSegDist(i, j, R.a, R.b) < R.r) ||
        (mid && !seam && Math.hypot(i - mid[0], j - mid[1]) < 6 + r) ||
        (town && Math.abs(i - town[0]) < 24 + r && j > town[1] - 8 - r && j < town[1] + 32 + r);
      if (!b)
        for (const [ci, cj] of [
          [i, j],
          [i - 1, j],
          [i, j - 1],
          [i - 1, j - 1],
        ])
          if (ci >= 0 && cj >= 0 && ci < w && cj < h && G.F[cj * w + ci] & 4) b = true;
      if (b) B[c] = 1;
    }
  G.riverBlocked = { key, B };
  return B;
}

/* ---------- sources and mouths ---------- */
/** the neighbour's river at a joined edge: the run of water cells in its strip (u0..u1 in this scene's cells) */
export function waterGenSeamRiver(G) {
  for (const s of G.joined) {
    let a = -1;
    for (let n = 0; n <= s.ground.length; n++) {
      const wet = n < s.ground.length && 'wd'.includes(s.ground[n]);
      if (wet && a < 0) a = n;
      if (!wet && a >= 0) {
        const u0 = s.c0 + a,
          u1 = s.c0 + n;
        if (u0 > 0 && u1 < waterGenSideLen(G, s.side)) return { side: s.side, u0, u1, strip: s };
        a = -1;
      }
    }
  }
  return null;
}
/** the corners of the cells that hold the water body a test picks out (the sea, a pond) */
export function waterGenCorners(G, test) {
  const out = new Set(),
    W = G.w + 1;
  for (let q = 0; q < G.w * G.h; q++)
    if (G.F[q] & 4 && test(q)) {
      const i = q % G.w,
        j = (q - i) / G.w;
      for (const c of [j * W + i, j * W + i + 1, (j + 1) * W + i, (j + 1) * W + i + 1]) out.add(c);
    }
  return [...out].sort((a, b) => a - b);
}
/** what lies where: the pond (G.pond), the lava's lines, the sea (the rest of the water) */
export function waterGenBodies(G) {
  const lava = G.streams.flatMap(st => st.pts),
    nearLava = (x, z) => lava.some(p => Math.hypot(p[0] - x, p[1] - z) < 6),
    pond = G.pond,
    inPond = (x, z) => !!pond && Math.hypot(x - pond.x, z - pond.z) < pond.r * 1.5 + 3,
    at = q => [(q % G.w) + 0.5, Math.floor(q / G.w) + 0.5];
  return {
    pond: pond ? waterGenCorners(G, q => inPond(...at(q))) : [],
    sea: waterGenCorners(G, q => !inPond(...at(q)) && !nearLava(...at(q))),
  };
}

/**
 * a river's way from a source to a mouth, or null: { pts: corner points from the source, flow: at each, src, mouth,
 * side: the side it crosses at either end, cross: a joined edge it comes in by }
 */
export function waterGenTry(G, rnd, plan, r) {
  const { w, h } = G,
    W = w + 1,
    { src, mouth } = plan;
  const ends = { sides: [src.side, mouth.side].filter(Boolean), seam: !!src.seam };
  /* a neighbour's river keeps the width it has there, so the place it found clear is clear here too */
  const blocked = waterGenBlocked(G, src.seam ? (src.seam.u1 - src.seam.u0) / 2 : r, ends);
  /* the mouth's corners */
  let outlets = [];
  if (mouth.kind === 'edge') {
    for (const [u0, u1] of mouth.spans)
      for (let u = u0; u <= u1; u++) {
        const [x, z] = waterGenOnSide(G, mouth.side, u, WATERGEN_STRAIGHT);
        outlets.push(Math.round(z) * W + Math.round(x));
      }
    /* the straight run out stays clear of everything but the side */
    for (let j = 0; j <= h; j++)
      for (let i = 0; i <= w; i++) if (mapgenDepth(G, mouth.side, i, j) < WATERGEN_STRAIGHT) blocked[j * W + i] = 1;
  } else outlets = mouth.corners;
  for (const c of outlets) blocked[c] = 0;
  if (!outlets.length) return null;
  /* the source's first corner (past its straight run in) */
  const s0 = src.at;
  const start = Math.round(s0[1]) * W + Math.round(s0[0]);
  if (src.side)
    for (let j = 0; j <= h; j++)
      for (let i = 0; i <= w; i++) if (mapgenDepth(G, src.side, i, j) < WATERGEN_STRAIGHT) blocked[j * W + i] = 1;
  for (let j = Math.round(s0[1]) - 1; j <= Math.round(s0[1]) + 1; j++)
    for (let i = Math.round(s0[0]) - 1; i <= Math.round(s0[0]) + 1; i++)
      if (i >= 0 && j >= 0 && i <= w && j <= h && (!src.side || mapgenDepth(G, src.side, i, j) >= WATERGEN_STRAIGHT))
        blocked[j * W + i] = 0;
  /* ground by a road counts higher, so the way down crosses a road rather than runs along it (the road dries what
     lies beside it) */
  if (!G.riverHr || G.riverHr.r !== r) {
    const Hr = Float32Array.from(G.H);
    for (let j = 0; j <= h; j++)
      for (let i = 0; i <= w; i++) {
        const q = mapgenCellAt(G, i, j),
          k = G.near[q];
        if (k >= 0 && G.dist[q] < G.roadPts[k].r + r + 1.5) Hr[j * W + i] += 0.6;
      }
    G.riverHr = { r, Hr };
  }
  const { recv, order } = waterGenFlood(G.riverHr.Hr, w, h, outlets, blocked);
  if (recv[start] < 0 && !outlets.includes(start)) return null;
  const flow = waterGenFlowSum(recv, order);
  const pts = [],
    fl = [];
  for (let c = start, n = 0; c >= 0 && n < W * (h + 1); c = recv[c], n++) {
    pts.push([c % W, Math.floor(c / W)]);
    fl.push(flow[c]);
  }
  return { pts, flow: fl };
}

/** the line smoothed (a moving average, the ends held), resampled every half metre */
export function waterGenSmoothLine(pts, win) {
  const out = pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p.slice();
    const k = Math.min(win, i, pts.length - 1 - i);
    let x = 0,
      z = 0;
    for (let d = -k; d <= k; d++) {
      x += pts[i + d][0];
      z += pts[i + d][1];
    }
    return [x / (2 * k + 1), z / (2 * k + 1)];
  });
  return out;
}

/**
 * the scene's river (mapgen's water stage, for the stream dial or the bridge feature): tried from several sources to
 * several mouths, the longest that keeps clear of the exits and the hub's place kept; painted, its line in G.streams
 * with its widths, source, mouth and rapids. Falls back to the old line across the map when nothing fits.
 * @param {any} G mapgen's working state @param {any} rnd the water stage's random stream (only for the fallback)
 * @param {number} width the river's width at its mouth before widening (the dial's)
 * @param {boolean} want the scene wants a river (its water dial or feature); without, only a joined neighbour's
 * river is carried on
 */
export function waterGenRiver(G, rnd, width, want) {
  const seam = waterGenSeamRiver(G);
  if (!want && !seam) return null;
  const R = G.rng('heights', 'river'),
    { w, h } = G,
    W = w + 1,
    r = (width * 1.2) / 2,
    B = waterGenBodies(G),
    plans = [];
  const sides = 'NSEW'.split('');
  const edgeEnd = (side, u) => ({ kind: 'edge', side, u, at: waterGenOnSide(G, side, u, WATERGEN_STRAIGHT) });
  const pickOn = side => {
    const sp = waterGenSideSpans(G, side, r);
    if (!sp.length) return null;
    const s = sp[R.int(0, sp.length - 1)];
    return Math.round(R.range(s[0], s[1]));
  };
  /* sources */
  const sources = [];
  if (seam) {
    const u = (seam.u0 + seam.u1) / 2;
    sources.push({ ...edgeEnd(seam.side, u), src: 'edge', seam });
  } else {
    for (let t = 0; t < 3; t++) {
      const side = sides[R.int(0, 3)],
        u = pickOn(side);
      if (u != null) sources.push({ ...edgeEnd(side, u), src: 'edge' });
    }
    /* a spring: high ground inland, away from the road */
    let best = /** @type {any} */ (null);
    for (let t = 0; t < 40; t++) {
      const x = Math.round(R.range(10, w - 10)),
        z = Math.round(R.range(10, h - 10)),
        q = mapgenCellAt(G, x, z);
      if (G.F[q] & 4 || G.dist[q] < 8) continue;
      const v = G.H[z * W + x] + R.next() * 0.3;
      if (!best || v > best.v) best = { v, at: [x, z] };
    }
    if (best) sources.push({ kind: 'spring', at: best.at, src: 'spring' });
    if (G.pond) {
      const a = R.range(0, Math.PI * 2),
        rr = G.pond.r * 1.25 + 2;
      sources.push({
        kind: 'lake',
        at: [
          Math.round(waterGenBetween(G.pond.x + Math.cos(a) * rr, 2, w - 2)),
          Math.round(waterGenBetween(G.pond.z + Math.sin(a) * rr, 2, h - 2)),
        ],
        src: 'lake',
      });
    }
  }
  /* mouths */
  const mouths = [];
  if (B.sea.length) mouths.push({ kind: 'sea', corners: B.sea, mouth: 'sea' });
  if (B.pond.length) mouths.push({ kind: 'lake', corners: B.pond, mouth: 'lake' });
  for (const side of sides) {
    const sp = waterGenSideSpans(G, side, r);
    if (sp.length) mouths.push({ kind: 'edge', side, spans: sp, mouth: 'edge' });
  }
  /* a pool: the lowest of a few low spots inland, away from the road */
  {
    let best = /** @type {any} */ (null);
    for (let t = 0; t < 40; t++) {
      const x = Math.round(R.range(12, w - 12)),
        z = Math.round(R.range(12, h - 12)),
        q = mapgenCellAt(G, x, z);
      if (G.F[q] & 4 || G.dist[q] < 9) continue;
      const v = G.H[z * W + x];
      if (!best || v < best.v) best = { v, at: [x, z] };
    }
    if (best) {
      const pr = Math.max(2.5, r * 1.6),
        corners = [];
      for (let j = Math.ceil(best.at[1] - pr); j <= best.at[1] + pr; j++)
        for (let i = Math.ceil(best.at[0] - pr); i <= best.at[0] + pr; i++)
          if (Math.hypot(i - best.at[0], j - best.at[1]) <= pr) corners.push(j * W + i);
      mouths.push({ kind: 'pool', corners, mouth: 'pool', at: best.at, pr });
    }
  }
  for (const src of sources)
    for (const mouth of mouths) {
      if (src.kind === 'lake' && mouth.kind === 'lake') continue;
      if (src.side && mouth.side === src.side) continue;
      plans.push({ src, mouth });
    }
  /* each plan tried in a shuffled order, the best kept */
  for (let i = plans.length - 1; i > 0; i--) {
    const k = R.int(0, i);
    [plans[i], plans[k]] = [plans[k], plans[i]];
  }
  const minLen = (seam ? 0.4 : 0.6) * Math.min(w, h);
  let best = /** @type {any} */ (null);
  const tried = [],
    cutting = [];
  for (const plan of plans.slice(0, WATERGEN_TRIES)) {
    const got = waterGenTry(G, R, plan, r);
    if (!got) continue;
    const river = waterGenShape(G, R, plan, got, width);
    if (!river || !waterGenFits(G, river)) continue;
    let ok = river;
    if (waterGenCutsOff(G, river)) {
      cutting.push(river);
      /* ended in a pool short of the far side, it cuts nothing off: one end inland */
      ok = waterGenShorten(G, river, minLen * 0.6);
      if (!ok || !waterGenFits(G, ok) || waterGenCutsOff(G, ok)) continue;
    }
    tried.push(ok);
    if (ok.len < minLen) continue;
    const score = ok.len * (ok.mouth === 'pool' ? 0.7 : 1) + R.next() * 10;
    if (!best || score > best.score) best = { ...ok, score };
  }
  /* none as long as wanted: the longest that fits; a neighbour's river goes on however short its way here, and as a
     last resort even where it cuts ground off */
  const longest = L => L.reduce((a, b) => (!a || b.len > a.len ? b : a), /** @type {any} */ (null));
  if (!best && tried.length && (seam || longest(tried).len >= 12)) best = longest(tried);
  if (!best && seam && cutting.length) {
    best = longest(cutting);
    G.notes.push("the neighbour's river cuts ground off from the road");
  }
  if (!best && !want) {
    G.notes.push("no way downhill for the neighbour's river: it ends at the seam");
    return null;
  }
  if (!best) {
    G.notes.push('no way downhill for the river: a line across the map');
    mapgenPaintStream(G, mapgenStreamLine(G, rnd, 'w'), width, 'w');
    return null;
  }
  waterGenPaint(G, best);
  return best;
}

/**
 * the way found made into a river: straight runs across its sides, smoothed, meandering on the flat, its level (never
 * rising), widths (never narrowing) and rapids
 */
export function waterGenShape(G, R, plan, got, width) {
  const { w, h } = G,
    { src, mouth } = plan;
  let pts = got.pts.map(p => p.slice()),
    flow = got.flow.slice();
  if (src.side) {
    const lead = [];
    for (let d = 0; d < WATERGEN_STRAIGHT; d += 1) lead.push(waterGenOnSide(G, src.side, src.u, d));
    pts = lead.concat(pts);
    flow = lead.map(() => flow[0]).concat(flow);
  }
  if (mouth.kind === 'edge') {
    const last = pts[pts.length - 1],
      u = mapgenAlong(mouth.side, last[0], last[1]);
    for (let d = WATERGEN_STRAIGHT - 1; d >= 0; d -= 1) {
      pts.push(waterGenOnSide(G, mouth.side, u, d));
      flow.push(flow[flow.length - 1]);
    }
  }
  /* smoothed (the straight runs held), then every half metre */
  const hold = src.side ? WATERGEN_STRAIGHT : 0,
    holdEnd = mouth.kind === 'edge' ? WATERGEN_STRAIGHT : 0;
  const mid = waterGenSmoothLine(pts.slice(Math.max(0, hold - 1), pts.length - Math.max(0, holdEnd - 1)), 3);
  pts = pts
    .slice(0, Math.max(0, hold - 1))
    .concat(mid)
    .concat(pts.slice(pts.length - Math.max(0, holdEnd - 1)));
  const fineFlow = [];
  let line = [pts[0]];
  fineFlow.push(flow[0]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.round(L / 0.5));
    for (let k = 1; k <= n; k++) {
      line.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
      fineFlow.push(flow[i - 1] + ((flow[i] - flow[i - 1]) * k) / n);
    }
  }
  /* meanders where the ground is flat: a sideways swing by noise, gone at the ends */
  const raw = line.map(p => waterGenHeightAt(G.H, w, h, p[0], p[1])),
    ns = G.salt('heights', 'meander'),
    N = line.length,
    flat = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 8),
      b = Math.min(N - 1, i + 8),
      slope = Math.abs(raw[a] - raw[b]) / Math.max(0.5, (b - a) * 0.5);
    flat[i] = slope < WATERGEN_FLAT ? 1 : slope < WATERGEN_FLAT * 2 ? 2 - slope / WATERGEN_FLAT : 0;
  }
  /* the flat share eased along the line, so a swing grows and dies away */
  const ease = Float32Array.from(flat);
  for (let pass = 0; pass < 3; pass++)
    for (let i = 1; i < N - 1; i++) ease[i] = (ease[i - 1] + ease[i] * 2 + ease[i + 1]) / 4;
  const amp = Math.min(3, 1 + width * 0.5),
    endA = (src.side ? WATERGEN_STRAIGHT : 3) * 2,
    endB = (mouth.kind === 'edge' ? WATERGEN_STRAIGHT : 3) * 2;
  const bent = line.map((p, i) => {
    const a = line[Math.max(0, i - 2)],
      b = line[Math.min(N - 1, i + 2)],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
      nx = -(b[1] - a[1]) / L,
      nz = (b[0] - a[0]) / L,
      fade = waterGenSmooth(waterGenBetween(Math.min(i - endA, N - 1 - i - endB) / 12, 0, 1)),
      o = (mapgenNoise((i * 0.5) / 7, 3.7, ns) - 0.5) * 2 * amp * ease[i] * fade;
    return [waterGenBetween(p[0] + nx * o, 0, w), waterGenBetween(p[1] + nz * o, 0, h)];
  });
  line = mapgenResample(bent, 0.5);
  const M2 = line.length;
  /* the flow along the bent line (by its share of the way) */
  const fl = line.map(
    (_, i) => fineFlow[Math.min(fineFlow.length - 1, Math.round((i / Math.max(1, M2 - 1)) * (fineFlow.length - 1)))]
  );
  /* widths: from 0.6 of the dial's at the source to 1.2 at the mouth by the square root of the flow, 1.5 m at least
     (a narrower line along the corners would wet no cell); never narrower downstream */
  const f0 = fl[0],
    f1 = Math.max(f0 + 1, fl[M2 - 1]),
    seamW = src.seam ? src.seam.u1 - src.seam.u0 : 0;
  const wid = [];
  for (let i = 0; i < M2; i++) {
    const t = Math.sqrt(waterGenBetween((fl[i] - f0) / (f1 - f0), 0, 1));
    wid.push(Math.max(i ? wid[i - 1] : 1.5, seamW, width * (0.6 + 0.6 * t)));
  }
  /* the level: under the bank by WATERGEN_UNDER, never higher than the point before (a joined edge's river starts at
     the neighbour's) */
  const lev = [];
  const top = src.seam ? waterGenSeamLevel(G, src.seam) : Infinity;
  for (let i = 0; i < M2; i++) {
    const bank = waterGenHeightAt(G.H, w, h, line[i][0], line[i][1]) - WATERGEN_UNDER;
    lev.push(Math.min(i ? lev[i - 1] : top, bank));
  }
  /* rapids: a drop steeper than WATERGEN_RAPID over WATERGEN_RAPID_LEN metres, as fractions of the way */
  const span = Math.round(WATERGEN_RAPID_LEN * 2),
    steep = [];
  for (let i = 0; i + span < M2; i++)
    if ((lev[i] - lev[i + span]) / WATERGEN_RAPID_LEN > WATERGEN_RAPID)
      for (let k = i; k <= i + span; k++) steep[k] = 1;
  const rapids = [];
  for (let i = 0; i < M2; i++)
    if (steep[i] && !steep[i - 1]) {
      let k = i;
      while (steep[k + 1]) k++;
      rapids.push([mapgenRound2(i / (M2 - 1)), mapgenRound2(k / (M2 - 1))]);
    }
  return {
    pts: line,
    wid,
    lev,
    rapids,
    len: (M2 - 1) * 0.5,
    src: src.src,
    mouth: mouth.mouth,
    srcSide: src.side || null,
    mouthSide: mouth.kind === 'edge' ? mouth.side : null,
    seam: src.seam || null,
    pool: mouth.kind === 'pool' ? { at: mouth.at, r: mouth.pr } : null,
  };
}
/** the neighbour's river level where it comes in: its edge corners' height at the middle of its water, plus the depth
 * its bed had there (the middle of a bed lies WATERGEN_DEPTH under its edge) */
export function waterGenSeamLevel(G, seam) {
  const s = seam.strip,
    um = Math.round((seam.u0 + seam.u1) / 2),
    hs = s.heights[waterGenBetween(um - s.u0, 0, s.heights.length - 1)],
    hw = Math.max(...[seam.u0, seam.u1].map(u => s.heights[waterGenBetween(u - s.u0, 0, s.heights.length - 1)]));
  return Math.max(hs + WATERGEN_DEPTH, hw);
}
/** the river ended in a pool partway (the last point from the end back that is 6 m clear of the sides, the road and
 * other water, its way at least `least` metres long), or null */
export function waterGenShorten(G, river, least) {
  const { pts, wid } = river,
    pr = Math.max(2.5, wid[wid.length - 1] * 0.8);
  for (let k = pts.length - 1 - Math.round(2 * WATERGEN_STRAIGHT); k * 0.5 >= least; k--) {
    const [x, z] = pts[k];
    if (Math.min(x, z, G.w - x, G.h - z) < pr + 6) continue;
    const q = mapgenCellAt(G, x, z);
    if (G.near[q] >= 0 && G.dist[q] < G.roadPts[G.near[q]].r + pr + 3) continue;
    let wet = false;
    mapgenPaintDisc(G, x, z, pr + 3, c => {
      if (G.F[c] & 4) wet = true;
    });
    if (wet) continue;
    const f = (pts.length - 1) / k;
    return {
      ...river,
      pts: pts.slice(0, k + 1),
      wid: wid.slice(0, k + 1),
      lev: river.lev.slice(0, k + 1),
      rapids: river.rapids
        .map(([a, b]) => [mapgenRound2(a * f), mapgenRound2(Math.min(1, b * f))])
        .filter(([a, b]) => a < 1 && b > a),
      len: k * 0.5,
      mouth: 'pool',
      mouthSide: null,
      pool: { at: [x, z], r: pr },
    };
  }
  return null;
}
/** does the river keep clear: the road only crossed (never run along for long), at most two crossings, one at least
 * for the bridge feature (waterGenCutsOff is the other test, apart: a neighbour's river may need to fail it) */
export function waterGenFits(G, river) {
  const { pts, wid } = river;
  let crossings = 0,
    run = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = mapgenCellAt(G, pts[i][0], pts[i][1]),
      k = G.near[q],
      near = k >= 0 && G.dist[q] < G.roadPts[k].r + wid[i] / 2 + 0.8;
    run = near ? run + 0.5 : 0;
    if (run > (G.P.road.width + wid[i] + 1.6) * 1.35) return false; /* the road dries what runs beside it */
    if (i && k >= 0 && G.dist[q] < G.roadPts[k].r + 1.5)
      for (const Rd of G.road)
        for (let k2 = 0; k2 + 1 < Rd.pts.length; k2++)
          if (mapgenSegCross(pts[i - 1], pts[i], Rd.pts[k2], Rd.pts[k2 + 1])) crossings++;
  }
  if (crossings > 2) return false;
  if (G.P.feature === 'bridge' && !crossings) return false;
  return true;
}
/** would the river cut ground off from the road (25 cells or more that reach a road now and would not with it)? A
 * road cell always passes: where the river crosses it a bridge goes, and the road beside it is dried */
export function waterGenCutsOff(G, river) {
  const { w, h } = G,
    n = w * h,
    wet = new Uint8Array(n);
  river.pts.forEach((p, i) =>
    mapgenPaintDisc(G, p[0], p[1], river.wid[i] / 2, q => {
      wet[q] = 1;
    })
  );
  const reach = blocked => {
    const seen = new Uint8Array(n),
      list = [];
    for (let q = 0; q < n; q++)
      if (G.F[q] & 1) {
        seen[q] = 1;
        list.push(q);
      }
    for (let k = 0; k < list.length; k++) {
      const q = list[k],
        i = q % w,
        j = (q - i) / w;
      for (const [a, b] of [
        [i + 1, j],
        [i - 1, j],
        [i, j + 1],
        [i, j - 1],
      ]) {
        if (a < 0 || b < 0 || a >= w || b >= h) continue;
        const o = b * w + a;
        if (seen[o] || G.F[o] & 4 || blocked[o]) continue;
        seen[o] = 1;
        list.push(o);
      }
    }
    return seen;
  };
  const before = G.riverReach || (G.riverReach = reach(new Uint8Array(n))),
    after = reach(wet);
  let lost = 0;
  for (let q = 0; q < n; q++) if (before[q] && !after[q] && !wet[q]) lost++;
  return lost >= 25;
}

/**
 * paint the river (as mapgenPaintStream: deep where more than 1.1 m from the bank, shallow, then the bank), a pool at
 * a pool mouth, and its line into G.streams; G.river keeps what waterGenCarve needs
 */
export function waterGenPaint(G, river) {
  const bank = G.B.ground.bank,
    { pts, wid } = river;
  const wet = (q, d, half) => {
    G.T[q] = d < half - 1.1 ? 'd' : 'w';
    G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
  };
  for (let i = 0; i < pts.length; i++) {
    const half = wid[i] / 2;
    mapgenPaintDisc(G, pts[i][0], pts[i][1], half + 0.9, (q, d) => {
      if (d <= half) wet(q, d, half);
      else if (!(G.F[q] & (1 | 4))) {
        G.T[q] = bank;
        G.F[q] |= 64;
      }
    });
  }
  if (river.pool) {
    const { at, r } = river.pool;
    mapgenPaintDisc(G, at[0], at[1], r + 1, (q, d) => {
      if (d <= r) wet(q, d, r);
      else if (!(G.F[q] & (1 | 4))) {
        G.T[q] = bank;
        G.F[q] |= 64;
      }
    });
  }
  /* the neighbour's water along the joined edge, cell for cell */
  if (river.seam) waterGenSeamCells(G, river.seam);
  const keep = mapgenSimplify(
    pts.map((p, i) => [p[0], p[1], i]),
    0.3
  );
  const speed = mapgenRound2(
    0.6 + Math.min(0.4, ((river.lev[0] - river.lev[river.lev.length - 1]) / Math.max(1, river.len)) * 8)
  );
  /** @type {any} */
  const st = {
    pts: keep.map(p => [mapgenRound2(p[0]), mapgenRound2(p[1])]),
    speed,
    w: keep.map(p => mapgenRound2(wid[p[2]])),
    src: river.src,
    mouth: river.mouth,
  };
  if (river.rapids.length) st.rapids = river.rapids;
  G.streams.push(st);
  for (let i = 0; i < pts.length; i += 3) mapgenOccAdd(G, pts[i][0], pts[i][1], 0.8);
  G.river = river;
}
/** a joined edge's water cells copied across its straight run in (depth 0 to WATERGEN_STRAIGHT) */
export function waterGenSeamCells(G, seam) {
  const s = seam.strip;
  for (let u = seam.u0; u < seam.u1; u++) {
    const ch = s.ground[u - s.c0];
    for (let d = 0; d < WATERGEN_STRAIGHT; d++) {
      const i = s.side === 'W' ? d : s.side === 'E' ? G.w - 1 - d : u,
        j = s.side === 'S' ? d : s.side === 'N' ? G.h - 1 - d : u;
      if (i < 0 || j < 0 || i >= G.w || j >= G.h) continue;
      const q = j * G.w + i;
      if (G.F[q] & 1) continue;
      G.T[q] = d === 0 ? ch : G.T[q] === 'd' || ch === 'd' ? 'd' : 'w';
      G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
    }
  }
}

/**
 * after the water stage has dried the joined strips and lowered the water: the river's crossing of a joined edge wet
 * again, its bed carved to its level (WATERGEN_DEPTH deeper in the middle), its banks eased (no lower than its edge,
 * no steeper than about 1 in 1), and its corners by a pinned or joined side marked (G.riverKeep) so mapgenPinSides
 * leaves them: the neighbour takes them from the edge strip
 */
export function waterGenCarve(G) {
  const river = G.river;
  if (!river) return;
  const { w, h } = G,
    W = w + 1,
    { pts, wid, lev } = river;
  /* the crossings dried with the joined strip: wet again */
  for (const side of [river.srcSide, river.mouthSide])
    if (side && G.joined.some(s => s.side === side))
      for (let i = 0; i < pts.length; i++) {
        if (mapgenDepth(G, side, pts[i][0], pts[i][1]) > WATERGEN_STRAIGHT + 1) continue;
        const half = wid[i] / 2;
        mapgenPaintDisc(G, pts[i][0], pts[i][1], half, (q, d) => {
          if (G.F[q] & 1) return;
          G.T[q] = d < half - 1.1 ? 'd' : 'w';
          G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
        });
      }
  if (river.seam) waterGenSeamCells(G, river.seam);
  /* each corner's nearest point of the line */
  const n = W * (h + 1),
    best = new Float32Array(n).fill(1e9),
    who = new Int32Array(n).fill(-1);
  for (let k = 0; k < pts.length; k++) {
    const R = wid[k] / 2 + 2.5,
      [x, z] = pts[k];
    for (let j = Math.max(0, Math.ceil(z - R)); j <= Math.min(h, Math.floor(z + R)); j++)
      for (let i = Math.max(0, Math.ceil(x - R)); i <= Math.min(w, Math.floor(x + R)); i++) {
        const d = Math.hypot(i - x, j - z);
        if (d < best[j * W + i]) {
          best[j * W + i] = d;
          who[j * W + i] = k;
        }
      }
  }
  const wetCell = (i, j) => i >= 0 && j >= 0 && i < w && j < h && G.F[j * w + i] & 4;
  const keep = G.riverKeep || (G.riverKeep = new Uint8Array(n));
  const pinned = (G.P.pin || '') + G.joined.map(s => s.side).join('');
  for (let c = 0; c < n; c++) {
    const k = who[c];
    if (k < 0) continue;
    const i = c % W,
      j = (c - i) / W,
      half = wid[k] / 2,
      d = best[c],
      around = [wetCell(i, j), wetCell(i - 1, j), wetCell(i, j - 1), wetCell(i - 1, j - 1)];
    if (around.some(Boolean)) {
      /* a corner of the water: the level, deeper toward the middle */
      /* full depth near the line (every corner round a point of it, so the level read along it never rises), eased up
         toward the edge */
      const core = Math.max(0.75, half - 0.5);
      G.H[c] = lev[k] - WATERGEN_DEPTH * (1 - waterGenSmooth(waterGenBetween((d - core) / 0.8, 0, 1)));
      for (const s of pinned) if (mapgenDepth(G, s, i, j) <= WATERGEN_STRAIGHT) keep[c] = 1;
    } else {
      /* the bank: dry ground beside it, not a road, bridge or jetty */
      let road = false;
      for (const [ci, cj] of [
        [i, j],
        [i - 1, j],
        [i, j - 1],
        [i - 1, j - 1],
      ])
        if (ci >= 0 && cj >= 0 && ci < w && cj < h && G.F[cj * w + ci] & (1 | 2 | 8 | 128)) road = true;
      if (road || (G.spans || []).some(S => mapgenNearSpan(S, i, j, 1.5))) continue;
      const out = Math.max(0, d - half);
      if (out > 2) continue;
      G.H[c] = waterGenBetween(G.H[c], lev[k] + 0.05, lev[k] + 0.25 + out * 0.9);
      for (const s of pinned) if (mapgenDepth(G, s, i, j) <= WATERGEN_STRAIGHT && out < 1) keep[c] = 1;
    }
  }
  /* a joined edge's crossing: exactly the neighbour's corners */
  if (river.seam) {
    const s = river.seam.strip;
    for (let u = river.seam.u0 - 1; u <= river.seam.u1 + 1; u++) {
      const v = s.heights[u - s.u0];
      if (v == null) continue;
      const [x, z] = waterGenOnSide(G, s.side, u, 0);
      G.H[Math.round(z) * W + Math.round(x)] = v;
    }
  }
}
