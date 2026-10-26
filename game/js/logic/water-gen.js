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
import { WATER_KINDS, waterKindHeals, waterKindShut, waterKindWalkOn } from './water-kinds.js';
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
  mapgenReach,
  mapgenReached,
  mapgenResample,
  mapgenRound2,
  mapgenSegCross,
  mapgenSimplify,
  mapgenStreamLine,
} from './mapgen.js';
/* eslint-disable no-func-assign */
expose({
  WATERGEN_BOG: [() => WATERGEN_BOG],
  WATERGEN_CLIMB_MIN: [() => WATERGEN_CLIMB_MIN],
  WATERGEN_DEPTH: [() => WATERGEN_DEPTH],
  WATERGEN_FALL_MIN: [() => WATERGEN_FALL_MIN],
  WATERGEN_FLAT: [() => WATERGEN_FLAT],
  WATERGEN_HAND_MAX: [() => WATERGEN_HAND_MAX],
  WATERGEN_LOST_MAX: [() => WATERGEN_LOST_MAX],
  WATERGEN_NB8: [() => WATERGEN_NB8],
  WATERGEN_RAPID: [() => WATERGEN_RAPID],
  WATERGEN_RAPID_LEN: [() => WATERGEN_RAPID_LEN],
  WATERGEN_REED_ITEMS: [() => WATERGEN_REED_ITEMS],
  WATERGEN_SEAM_REACH: [() => WATERGEN_SEAM_REACH],
  WATERGEN_SET_CHANCE: [() => WATERGEN_SET_CHANCE],
  WATERGEN_SET_CHANCE_CAVE: [() => WATERGEN_SET_CHANCE_CAVE],
  WATERGEN_SET_PIECE: [() => WATERGEN_SET_PIECE],
  WATERGEN_SHALLOW_PROP: [() => WATERGEN_SHALLOW_PROP],
  WATERGEN_SPRING_CHANCE: [() => WATERGEN_SPRING_CHANCE],
  WATERGEN_SPRING_R: [() => WATERGEN_SPRING_R],
  WATERGEN_STEP: [() => WATERGEN_STEP],
  WATERGEN_STRAIGHT: [() => WATERGEN_STRAIGHT],
  WATERGEN_TRIES: [() => WATERGEN_TRIES],
  WATERGEN_UNDER: [() => WATERGEN_UNDER],
  // @ts-expect-error -- replaced on purpose
  waterGenBankRaise: [() => waterGenBankRaise, v => (waterGenBankRaise = v)],
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
  waterGenCarveRiver: [() => waterGenCarveRiver, v => (waterGenCarveRiver = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenClimbs: [() => waterGenClimbs, v => ((waterGenClimbs = v), provide({ waterGenClimbs }))],
  // @ts-expect-error -- replaced on purpose
  waterGenCorners: [() => waterGenCorners, v => (waterGenCorners = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenCutsOff: [() => waterGenCutsOff, v => (waterGenCutsOff = v)],
  waterGenFallEnds: [() => waterGenFallEnds],
  waterGenFallEntry: [() => waterGenFallEntry],
  // @ts-expect-error -- replaced on purpose
  waterGenFalls: [() => waterGenFalls, v => ((waterGenFalls = v), provide({ waterGenFalls }))],
  // @ts-expect-error -- replaced on purpose
  waterGenFits: [() => waterGenFits, v => (waterGenFits = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenFlood: [() => waterGenFlood, v => (waterGenFlood = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenFlowSum: [() => waterGenFlowSum, v => (waterGenFlowSum = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenHand: [() => waterGenHand, v => (waterGenHand = v)],
  waterGenHandClimb: [() => waterGenHandClimb],
  // @ts-expect-error -- replaced on purpose
  waterGenHandFalls: [() => waterGenHandFalls, v => (waterGenHandFalls = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenHandRivers: [() => waterGenHandRivers, v => (waterGenHandRivers = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenHeap: [() => waterGenHeap, v => (waterGenHeap = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenHeightAt: [() => waterGenHeightAt, v => (waterGenHeightAt = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenHotSpring: [() => waterGenHotSpring, v => (waterGenHotSpring = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenKindAt: [() => waterGenKindAt, v => (waterGenKindAt = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenKinds: [() => waterGenKinds, v => ((waterGenKinds = v), provide({ waterGenKinds }))],
  // @ts-expect-error -- replaced on purpose
  waterGenLevels: [() => waterGenLevels, v => (waterGenLevels = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenLost: [() => waterGenLost, v => (waterGenLost = v)],
  waterGenOnSide: [() => waterGenOnSide],
  // @ts-expect-error -- replaced on purpose
  waterGenPaint: [() => waterGenPaint, v => (waterGenPaint = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenPlungePool: [() => waterGenPlungePool, v => (waterGenPlungePool = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenRapids: [() => waterGenRapids, v => (waterGenRapids = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenReach: [() => waterGenReach, v => (waterGenReach = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenReachedNear: [() => waterGenReachedNear, v => (waterGenReachedNear = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenReachedRing: [() => waterGenReachedRing, v => (waterGenReachedRing = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenRects: [() => waterGenRects, v => (waterGenRects = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenReeds: [() => waterGenReeds, v => ((waterGenReeds = v), provide({ waterGenReeds }))],
  waterGenRestore: [() => waterGenRestore],
  // @ts-expect-error -- replaced on purpose
  waterGenRiver: [() => waterGenRiver, v => ((waterGenRiver = v), provide({ waterGenRiver }))],
  // @ts-expect-error -- replaced on purpose
  waterGenRiverFalls: [() => waterGenRiverFalls, v => (waterGenRiverFalls = v)],
  waterGenSave: [() => waterGenSave],
  // @ts-expect-error -- replaced on purpose
  waterGenSeamCells: [() => waterGenSeamCells, v => (waterGenSeamCells = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenSeamLevel: [() => waterGenSeamLevel, v => (waterGenSeamLevel = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenSeamRiver: [() => waterGenSeamRiver, v => (waterGenSeamRiver = v)],
  waterGenSegDist: [() => waterGenSegDist],
  // @ts-expect-error -- replaced on purpose
  waterGenSetPiece: [() => waterGenSetPiece, v => (waterGenSetPiece = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenSetPieceSpots: [() => waterGenSetPieceSpots, v => (waterGenSetPieceSpots = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenShallows: [() => waterGenShallows, v => ((waterGenShallows = v), provide({ waterGenShallows }))],
  // @ts-expect-error -- replaced on purpose
  waterGenShape: [() => waterGenShape, v => (waterGenShape = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenShorten: [() => waterGenShorten, v => (waterGenShorten = v)],
  waterGenSideBy: [() => waterGenSideBy],
  waterGenSideLen: [() => waterGenSideLen],
  // @ts-expect-error -- replaced on purpose
  waterGenSideSpans: [() => waterGenSideSpans, v => (waterGenSideSpans = v)],
  waterGenSmooth: [() => waterGenSmooth],
  // @ts-expect-error -- replaced on purpose
  waterGenSmoothLine: [() => waterGenSmoothLine, v => (waterGenSmoothLine = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenStepRiver: [() => waterGenStepRiver, v => (waterGenStepRiver = v)],
  // @ts-expect-error -- replaced on purpose
  waterGenTry: [() => waterGenTry, v => (waterGenTry = v)],
});
/* eslint-enable no-func-assign */
provide({
  waterGenCarve,
  waterGenClimbs,
  waterGenFalls,
  waterGenKinds,
  waterGenReeds,
  waterGenRiver,
  waterGenShallows,
});
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

/* ---------- WA-9: the Studio's hand water ----------
   The Generate card's river brush, waterfall placer and kind painter write the draft's dials (`params.hand`, kept in
   a scene's `gen` when it is added): every remake of the draft (a dial, a new seed, a part's reroll) makes them again,
   so they survive a regenerate. A hand river is an extra river (the generated one stays), shaped, painted and carved
   as the generated one is; a hand fall writes a `falls` entry as WA-2b's do; a hand kind is a `waters` rectangle
   laid last. A scene made without them is made exactly as before. */
/** the most hand rivers and falls a scene keeps */
export const WATERGEN_HAND_MAX = 8;
/** a hand fall's wanted climb (1 or 0) by its entry: waterGenClimbs keeps a 1 only where WA-2b's rule passes and never
 * adds one to a fall placed without */
export const waterGenHandClimb = new WeakMap();
/**
 * the draft's hand water, checked: rivers [{pts, w}], falls [{x, z, dir, w, h, pool, climb, k}], waters [{x, z, w, h,
 * k}], all inside the map (kept on G)
 */
export function waterGenHand(G) {
  if (G.hand) return G.hand;
  const H = (G.P && G.P.hand) || {},
    num = v => typeof v === 'number' && Number.isFinite(v),
    pt = p => Array.isArray(p) && num(p[0]) && num(p[1]),
    list = v => (Array.isArray(v) ? v : []),
    X = v => waterGenBetween(v, 0, G.w),
    Z = v => waterGenBetween(v, 0, G.h);
  const rivers = list(H.rivers)
    .filter(r => r && list(r.pts).filter(pt).length >= 2)
    .slice(0, WATERGEN_HAND_MAX)
    .map(r => ({ pts: r.pts.filter(pt).map(p => [X(p[0]), Z(p[1])]), w: num(r.w) ? waterGenBetween(r.w, 1.5, 8) : 0 }));
  const falls = list(H.falls)
    .filter(f => f && num(f.x) && num(f.z) && pt(f.dir) && Math.hypot(f.dir[0], f.dir[1]) > 1e-3)
    .slice(0, WATERGEN_HAND_MAX)
    .map(f => {
      const L = Math.hypot(f.dir[0], f.dir[1]);
      return {
        x: X(f.x),
        z: Z(f.z),
        dir: [f.dir[0] / L, f.dir[1] / L],
        w: num(f.w) ? waterGenBetween(f.w, 0.5, 12) : 1.5,
        h: num(f.h) && f.h > 0 ? waterGenBetween(f.h, 0.3, 15) : 0,
        pool: num(f.pool) ? waterGenBetween(f.pool, 0, 4) : 0,
        climb: f.climb ? 1 : 0,
        k: typeof f.k === 'string' && WATER_KINDS.includes(f.k) ? f.k : null,
      };
    });
  const waters = list(H.waters)
    .filter(r => r && num(r.x) && num(r.z) && num(r.w) && num(r.h) && r.w > 0 && r.h > 0 && WATER_KINDS.includes(r.k))
    .map(r => ({ x: X(r.x), z: Z(r.z), w: Math.min(r.w, G.w - X(r.x)), h: Math.min(r.h, G.h - Z(r.z)), k: r.k }))
    .filter(r => r.w > 0 && r.h > 0);
  return (G.hand = { rivers, falls, waters });
}
/** the side a point lies by (within 1.5 m of it), or '' */
export const waterGenSideBy = (G, x, z) => 'NSEW'.split('').find(s => mapgenDepth(G, s, x, z) < 1.5) || '';
/**
 * the hand rivers (waterGenRiver, first): each drawn line from its source to its mouth made into a river as WA-3a's
 * are (smoothed, its level never rising, wider downstream, rapids; no meanders: it keeps the line drawn), painted and
 * carved. Its source and mouth come from its ends: a side (`edge`), water already there (`lake`, or `sea` on a coast
 * away from the pond), else a `spring` at the source and a `pool` at the mouth. A river that runs along the road,
 * crosses it more than twice or cuts ground off from it is still made, with a note.
 * @param {any} G mapgen's working state @param {number} width the scene's river width (the dial's), when the line has
 * none of its own
 */
export function waterGenHandRivers(G, width) {
  const hand = waterGenHand(G).rivers;
  if (!hand.length) return [];
  const out = [];
  for (const H of hand) {
    const pts = mapgenResample(H.pts, 1),
      last = H.pts[H.pts.length - 1],
      tail = pts[pts.length - 1];
    if (Math.hypot(tail[0] - last[0], tail[1] - last[1]) > 0.05) pts.push(last.slice());
    if (pts.length < 3) {
      G.notes.push('a hand river shorter than 2 m: left out');
      continue;
    }
    const wide = H.w || width,
      a = pts[0],
      b = pts[pts.length - 1],
      wetAt = p => !!(G.F[mapgenCellAt(G, p[0], p[1])] & 4),
      sideA = waterGenSideBy(G, a[0], a[1]),
      sideB = waterGenSideBy(G, b[0], b[1]),
      inPond = p => !!G.pond && Math.hypot(p[0] - G.pond.x, p[1] - G.pond.z) < G.pond.r * 1.5 + 3;
    const src = sideA ? 'edge' : wetAt(a) ? 'lake' : 'spring',
      mouth = sideB ? 'edge' : wetAt(b) ? (G.P.land.water === 'coast' && !inPond(b) ? 'sea' : 'lake') : 'pool';
    const plan = {
      src: { src },
      mouth: { kind: mouth === 'pool' ? 'pool' : 'hand', mouth, at: b, pr: Math.max(2.5, wide * 0.8) },
    };
    const river = waterGenShape(G, null, plan, { pts, flow: pts.map((_, i) => i + 1) }, wide, false);
    river.srcSide = sideA || null;
    river.mouthSide = sideB || null;
    river.hand = 1;
    if (!waterGenFits(G, river)) G.notes.push('a hand river runs along the road or crosses it more than twice');
    const reach = G.riverReach;
    delete G.riverReach;
    if (waterGenCutsOff(G, river)) G.notes.push('a hand river cuts ground off from the road');
    G.riverReach = reach;
    waterGenPaint(G, river);
    out.push(river);
  }
  /* the generated river's "before" is the ground with the hand rivers in it */
  delete G.riverReach;
  return out;
}
/**
 * the hand falls (waterGenFalls, last): each one replaces a generated fall within 2 m of its lip; its drop is the one
 * given, or the ground's from 0.3 m behind the lip to the lowest 0.5-2 m past it; its pool is painted as a plunge
 * pool (higher ground cut down to it) where it fits and cuts no ground off, else it has none (a note). Its climb is
 * decided on the finished scene (waterGenClimbs).
 * @param {any} G mapgen's working state @param {any[]} falls the scene's falls so far (changed in place)
 */
export function waterGenHandFalls(G, falls) {
  const hand = waterGenHand(G).falls;
  if (!hand.length) return;
  const { w, h } = G,
    W2 = w * 2,
    { lv } = waterGenLevels(G),
    at = (x, z) =>
      lv[waterGenBetween(Math.floor(z * 2), 0, h * 2 - 1) * W2 + waterGenBetween(Math.floor(x * 2), 0, W2 - 1)];
  let seen = /** @type {Uint8Array | null} */ (null);
  for (const f of hand) {
    for (let n = falls.length - 1; n >= 0; n--)
      if (Math.hypot(falls[n].x - f.x, falls[n].z - f.z) < 2) falls.splice(n, 1);
    const [dx, dz] = f.dir,
      where = `${mapgenRound2(f.x)}, ${mapgenRound2(f.z)}`;
    if (!(G.F[mapgenCellAt(G, f.x - dx * 0.3, f.z - dz * 0.3)] & 4))
      G.notes.push(`the hand fall at ${where}: its lip is not on water`);
    let drop = f.h;
    if (!drop) {
      let low = Infinity;
      for (let d = 0.5; d <= 2; d += 0.25) low = Math.min(low, at(f.x + dx * d, f.z + dz * d));
      drop = Math.max(0, at(f.x - dx * 0.3, f.z - dz * 0.3) - low);
    }
    if (drop < 0.3) G.notes.push(`the hand fall at ${where} drops under 0.3 m: the automatic sheets draw it`);
    let pool = 0;
    if (f.pool) {
      const cx = f.x + dx * (f.pool + 0.25),
        cz = f.z + dz * (f.pool + 0.25),
        s0 =
          G.S[waterGenBetween(Math.floor(cz * 2), 0, h * 2 - 1) * W2 + waterGenBetween(Math.floor(cx * 2), 0, W2 - 1)],
        lev = waterGenHeightAt(G.H, w, h, cx, cz) - WATERGEN_UNDER,
        save = waterGenSave(G);
      seen = seen || waterGenReach(G);
      if (waterGenPlungePool(G, cx, cz, f.pool, s0, lev, true)) {
        const after = waterGenReach(G);
        if (waterGenLost(G, seen, after) > WATERGEN_LOST_MAX) waterGenRestore(G, save);
        else {
          pool = f.pool;
          seen = after;
        }
      }
      if (!pool) G.notes.push(`the hand fall at ${where}: no room for its pool (or it would cut ground off)`);
    }
    const e = waterGenFallEntry(f.x, f.z, f.dir, f.w, drop, pool, false, f.k);
    waterGenHandClimb.set(e, f.climb);
    falls.push(e);
  }
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
  /* WA-9: the Studio's hand-drawn rivers first, so the generated one finds them as other water */
  waterGenHandRivers(G, width);
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
 * rising), widths (never narrowing) and rapids; bend false (a hand-drawn line, WA-9) keeps it unmeandered
 */
export function waterGenShape(G, R, plan, got, width, bend = true) {
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
      o = bend ? (mapgenNoise((i * 0.5) / 7, 3.7, ns) - 0.5) * 2 * amp * ease[i] * fade : 0;
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
  G.river = G.river || river;
  (G.rivers || (G.rivers = [])).push(river);
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
  for (const river of G.rivers || []) waterGenCarveRiver(G, river);
}
/** waterGenCarve for one river (WA-9: a scene may have hand-drawn rivers beside its own) */
export function waterGenCarveRiver(G, river) {
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

/* ================= WATERFALLS PLACED (water track WA-2b, lane G) =================
   After the land stage (terraces, mountains, ledges: mapgen.js calls waterGenFalls once):
   - the river steps with the land: the terraces and a massif's shelves leave the ground under water at 0 (a river in a
     trench), so its water is lifted to the step raise of its lower bank, never higher than the point before;
   - a drop of WATERGEN_FALL_MIN or more is a fall (the scene's `falls`, the contract in water-track.md), with a plunge
     pool at its foot when one fits on the foot's level and you can walk to it; smaller drops stay the renderer's
     automatic cascades;
   - now and then a set piece (WATERGEN_SET_PIECE metres): a spring on a massif's shelf spilling off its cliff into a
     pool below (more often in a cave);
   - `climb: 1` where the fall is WATERGEN_CLIMB_MIN or taller and both its top and its foot can be walked to, so the
     Waterfall field move is a short cut, never the only way.
   Its own random stream ('heights', 'falls'). */
/** the smallest drop that makes a fall (m); smaller steps are the automatic cascades */
export const WATERGEN_FALL_MIN = 0.6;
/** a set piece's drop (m, the owner's answer) */
export const WATERGEN_SET_PIECE = [4, 15];
/** how often a route with mountains gets a set piece, and a cave */
export const WATERGEN_SET_CHANCE = 0.4;
export const WATERGEN_SET_CHANCE_CAVE = 0.7;
/** the shortest fall the Waterfall field move climbs (m) */
export const WATERGEN_CLIMB_MIN = 2;
/** the half-metre cells a pool or a set piece may cut off from the road (as a river's 25 cells, WA-3a): a notch down
 * a massif's shelves splits a shelf that is only walked along its length, so most places are refused */
export const WATERGEN_LOST_MAX = 25;
/** a step you walk up or down (walk-view.js MAX_STEP_RISE) */
export const WATERGEN_STEP = 0.34;

/** the walked level of each half-metre cell (smooth ground and its raise), and whether it is dry ground */
export function waterGenLevels(G) {
  const { w, h } = G,
    W2 = w * 2,
    H2 = h * 2,
    lv = new Float32Array(W2 * H2),
    dry = new Uint8Array(W2 * H2);
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++) {
      const q = j * W2 + i,
        f = G.F[(j >> 1) * w + (i >> 1)];
      lv[q] = waterGenHeightAt(G.H, w, h, (i + 0.5) / 2, (j + 0.5) / 2) + G.S[q];
      dry[q] = !(f & 4) || f & 8 ? 1 : 0;
    }
  return { lv, dry, W2, H2 };
}
/** the dry half-metre cells you can walk to from the road (steps of WATERGEN_STEP at most, up or down; a ledge's hop
 * is not counted, so this is a little short of the game's own reach, never past it) */
export function waterGenReach(G) {
  const { lv, dry, W2, H2 } = waterGenLevels(G),
    seen = new Uint8Array(W2 * H2),
    list = [];
  for (let q = 0; q < W2 * H2; q++)
    if (dry[q] && G.F[((q / W2) >> 1) * G.w + ((q % W2) >> 1)] & 1) {
      seen[q] = 1;
      list.push(q);
    }
  for (let k = 0; k < list.length; k++) {
    const q = list[k],
      i = q % W2,
      j = (q - i) / W2;
    for (const [a, b] of [
      [i + 1, j],
      [i - 1, j],
      [i, j + 1],
      [i, j - 1],
    ]) {
      if (a < 0 || b < 0 || a >= W2 || b >= H2) continue;
      const o = b * W2 + a;
      if (seen[o] || !dry[o] || Math.abs(lv[o] - lv[q]) > WATERGEN_STEP) continue;
      seen[o] = 1;
      list.push(o);
    }
  }
  return seen;
}
/** is any reached dry half-metre cell within r of (x, z) */
export function waterGenReachedNear(G, seen, x, z, r) {
  const W2 = G.w * 2,
    H2 = G.h * 2;
  for (let j = Math.max(0, Math.floor((z - r) * 2)); j <= Math.min(H2 - 1, Math.floor((z + r) * 2)); j++)
    for (let i = Math.max(0, Math.floor((x - r) * 2)); i <= Math.min(W2 - 1, Math.floor((x + r) * 2)); i++)
      if (seen[j * W2 + i] && Math.hypot((i + 0.5) / 2 - x, (j + 0.5) / 2 - z) <= r) return true;
  return false;
}
/** the lowest raise of the river's banks at each point of its line: dry ground just beyond its edge on either side,
 * the lower side (other water, a road or the map's edge counts 0, a bridge its deck's raise), then the lowest over
 * 1.5 m either way along the line, so the water steps only at a terrace's front or a shelf's edge */
export function waterGenBankRaise(G, river) {
  const { w, h } = G,
    W2 = w * 2,
    { pts, wid } = river,
    N = pts.length,
    raw = new Float32Array(N);
  const sideAt = (x, z) => {
    const i = Math.floor(x * 2),
      j = Math.floor(z * 2);
    if (i < 0 || j < 0 || i >= W2 || j >= h * 2) return 0;
    const f = G.F[(j >> 1) * w + (i >> 1)];
    if (f & (1 | 2 | 4 | 128)) return f & 8 ? G.S[j * W2 + i] : 0;
    return G.S[j * W2 + i];
  };
  const pinned = (G.P.pin || '') + G.joined.map(s => s.side).join('');
  for (let k = 0; k < N; k++) {
    const [x, z] = pts[k],
      a = pts[Math.max(0, k - 2)],
      b = pts[Math.min(N - 1, k + 2)],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
      nx = -(b[1] - a[1]) / L,
      nz = (b[0] - a[0]) / L,
      half = wid[k] / 2;
    let lo = Infinity;
    for (const s of [1, -1]) {
      let m = Infinity;
      for (const d of [half + 0.6, half + 1.1]) m = Math.min(m, sideAt(x + nx * d * s, z + nz * d * s));
      lo = Math.min(lo, m);
    }
    /* by a pinned or joined side the water stays at the neighbour's level */
    for (const s of pinned) if (mapgenDepth(G, s, x, z) <= WATERGEN_STRAIGHT + 1) lo = 0;
    raw[k] = Math.max(0, lo);
  }
  /* the river ends in the sea or a lake at its level */
  if (river.mouth === 'sea' || river.mouth === 'lake') for (let k = Math.max(0, N - 8); k < N; k++) raw[k] = 0;
  const out = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    let m = raw[k];
    for (let d = -3; d <= 3; d++) m = Math.min(m, raw[waterGenBetween(k + d, 0, N - 1)]);
    out[k] = m;
  }
  return out;
}
/** the river's water lifted to its banks' raise (never higher than the point before, in 5 cm steps): the raise of each
 * point of its line (G.S under its water and its pool set to it) */
export function waterGenStepRiver(G, river) {
  const { w, h } = G,
    W2 = w * 2,
    H2 = h * 2,
    { pts, wid } = river,
    N = pts.length,
    t = waterGenBankRaise(G, river),
    r = new Float32Array(N);
  for (let k = 0; k < N; k++) r[k] = Math.floor(Math.min(k ? r[k - 1] : Infinity, t[k]) * 20 + 1e-6) / 20;
  if (!r.some(v => v > 0)) return r;
  /* each half-metre water cell's nearest point of the line */
  const best = new Float32Array(W2 * H2).fill(1e9),
    who = new Int32Array(W2 * H2).fill(-1);
  for (let k = 0; k < N; k++) {
    const R = wid[k] / 2 + 1,
      [x, z] = pts[k];
    for (let j = Math.max(0, Math.floor((z - R) * 2)); j <= Math.min(H2 - 1, Math.floor((z + R) * 2)); j++)
      for (let i = Math.max(0, Math.floor((x - R) * 2)); i <= Math.min(W2 - 1, Math.floor((x + R) * 2)); i++) {
        const d = Math.hypot((i + 0.5) / 2 - x, (j + 0.5) / 2 - z);
        if (d <= R && d < best[j * W2 + i]) {
          best[j * W2 + i] = d;
          who[j * W2 + i] = k;
        }
      }
  }
  const pool = river.pool;
  for (let q = 0; q < W2 * H2; q++) {
    const i = q % W2,
      j = (q - i) / W2,
      f = G.F[(j >> 1) * w + (i >> 1)];
    if (!(f & 4) || f & 8) continue;
    let k = who[q];
    if (pool && Math.hypot((i + 0.5) / 2 - pool.at[0], (j + 0.5) / 2 - pool.at[1]) <= pool.r + 1) k = N - 1;
    if (k < 0 || r[k] <= 0) continue;
    G.S[q] = Math.max(G.S[q], r[k]);
  }
  /* dry ground right beside the lifted water, lower than it, comes up to it (not a road, a bridge or a jetty) */
  for (let q = 0; q < W2 * H2; q++) {
    const i = q % W2,
      j = (q - i) / W2,
      f = G.F[(j >> 1) * w + (i >> 1)];
    if (f & (1 | 4 | 8 | 128)) continue;
    let up = 0;
    for (const [a, b] of [
      [i + 1, j],
      [i - 1, j],
      [i, j + 1],
      [i, j - 1],
    ]) {
      if (a < 0 || b < 0 || a >= W2 || b >= H2) continue;
      const o = b * W2 + a,
        fo = G.F[(b >> 1) * w + (a >> 1)];
      if (fo & 4 && !(fo & 8) && who[o] >= 0) up = Math.max(up, G.S[o]);
    }
    if (up > G.S[q]) G.S[q] = up;
  }
  G.stepsUsed = true;
  return r;
}
/** a plunge pool of radius r centred at (cx, cz) on ground whose raise is s0 and water level lev, in whole cells (a
 * cell is in it when its middle is): its cells must be dry ground at that raise (within 0.4 m; higher ground is cut
 * down to it when carve is set) or water no higher, clear of roads, bridges, jetties, a town's square and the hub,
 * and of the map's last 6 m; painted as a river's water (deep more than 1.1 m from its edge), its bed carved like the
 * river's. Returns false (nothing painted) when it does not fit */
export function waterGenPlungePool(G, cx, cz, r, s0, lev, carve) {
  const { w, h } = G,
    W2 = w * 2,
    W = w + 1;
  if (Math.min(cx, cz, w - cx, h - cz) < r + 6) return false;
  if (G.town) {
    const [x0, z0, x1, z1] = G.town.square;
    if (cx > x0 - 12 - r && cx < x1 + 12 + r && cz > z0 - 12 - r && cz < z1 + 12 + r) return false;
  }
  if (Math.hypot(cx - G.hub[0], cz - G.hub[1]) < r + 6) return false;
  const cells = [];
  let ok = true;
  mapgenPaintDisc(G, cx, cz, r + 1, (q, d) => {
    const f = G.F[q];
    if (f & (1 | 8 | 128)) ok = false;
    if (d > r) return;
    const i = q % w,
      j = (q - i) / w;
    for (const o of [0, 1, W2, W2 + 1]) {
      const v = G.S[j * 2 * W2 + i * 2 + o];
      if (f & 4 ? v > s0 + 0.05 : v < s0 - 0.4 || (!carve && v > s0 + 0.4)) ok = false;
    }
    cells.push(q);
  });
  if (!ok || !cells.length) return false;
  for (const q of cells) {
    const i = q % w,
      j = (q - i) / w,
      d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz);
    if (!(G.F[q] & 4)) G.T[q] = d < r - 1.1 ? 'd' : 'w';
    G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
    for (const o of [0, 1, W2, W2 + 1]) {
      G.S[j * 2 * W2 + i * 2 + o] = s0;
      G.M[j * 2 * W2 + i * 2 + o] = 0;
    }
  }
  mapgenPaintDisc(G, cx, cz, r + 0.9, q => {
    if (!(G.F[q] & (1 | 4))) {
      G.T[q] = G.B.ground.bank;
      G.F[q] |= 64;
    }
  });
  /* the bed under its level, deeper toward the middle */
  const core = Math.max(0.75, r - 0.75);
  for (let j = Math.max(0, Math.ceil(cz - r - 1)); j <= Math.min(h, Math.floor(cz + r + 1)); j++)
    for (let i = Math.max(0, Math.ceil(cx - r - 1)); i <= Math.min(w, Math.floor(cx + r + 1)); i++) {
      const d = Math.hypot(i - cx, j - cz);
      if (d > r + 0.5) continue;
      G.H[j * W + i] = Math.min(
        G.H[j * W + i],
        lev - WATERGEN_DEPTH * (1 - waterGenSmooth(waterGenBetween((d - core) / 0.8, 0, 1)))
      );
    }
  return true;
}
/** copies of what a plunge pool paints, to take it back when it cuts ground off */
export const waterGenSave = G => ({ T: G.T.slice(), F: G.F.slice(), S: G.S.slice(), H: G.H.slice() });
export const waterGenRestore = (G, s) => {
  G.T = s.T;
  G.F.set(s.F);
  G.S.set(s.S);
  G.H.set(s.H);
};
/** reached half-metre cells lost (dry before, still dry, no longer reached) */
export function waterGenLost(G, before, after) {
  const W2 = G.w * 2;
  let lost = 0;
  for (let q = 0; q < before.length; q++)
    if (before[q] && !after[q]) {
      const f = G.F[((q / W2) >> 1) * G.w + ((q % W2) >> 1)];
      if (!(f & 4)) lost++;
    }
  return lost;
}
/** a fall's entry (the contract): x, z the lip's middle, dir the way it falls, w, h, pool (0 none), climb */
export const waterGenFallEntry = (x, z, dir, w, h, pool, climb, k) => {
  /** @type {any} */
  const f = {
    x: mapgenRound2(x),
    z: mapgenRound2(z),
    dir: [mapgenRound2(dir[0]), mapgenRound2(dir[1])],
    w: mapgenRound2(w),
    h: mapgenRound2(h),
    pool: mapgenRound2(pool),
  };
  if (k && k !== 'stream') f.k = k;
  if (climb) f.climb = 1;
  return f;
};
/** the river's falls: where its lifted water drops WATERGEN_FALL_MIN or more between two points of its line */
export function waterGenRiverFalls(G, river, r) {
  const { pts, wid, lev } = river,
    N = pts.length,
    out = [];
  for (let k = 1; k < N; k++) {
    const drop = r[k - 1] - r[k] + Math.max(0, lev[k - 1] - lev[k]);
    if (r[k - 1] - r[k] < 0.05 || drop < WATERGEN_FALL_MIN) continue;
    const a = pts[Math.max(0, k - 3)],
      b = pts[Math.min(N - 1, k + 2)],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    out.push({
      k,
      x: (pts[k - 1][0] + pts[k][0]) / 2,
      z: (pts[k - 1][1] + pts[k][1]) / 2,
      dir: [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      w: Math.max(wid[k - 1], wid[k]),
      h: drop,
    });
  }
  return out;
}
/** a set piece's place: the edge of a massif's shelf over a run of shelves going down (never up) that drops
 * WATERGEN_SET_PIECE metres within 6 m, its lip on a whole metre (so cells split cleanly at it), the shelf behind flat
 * for a spring's run of 4 m, and the ground below walked to. Candidates every metre, the tallest first */
export function waterGenSetPieceSpots(G, seen) {
  const { w } = G,
    { lv, dry, W2, H2 } = waterGenLevels(G),
    out = [];
  const clear = (i, j) => {
    if (i < 0 || j < 0 || i >= W2 || j >= H2) return false;
    const f = G.F[(j >> 1) * w + (i >> 1)];
    return dry[j * W2 + i] && !(f & (1 | 2 | 4 | 8 | 128));
  };
  for (let j = 16; j < H2 - 16; j++)
    for (let i = 16; i < W2 - 16; i++)
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        /* the lip on a whole metre: the top cell is the last half of its metre in the way it falls */
        if ((di === 1 && i % 2 === 0) || (di === -1 && i % 2) || (dj === 1 && j % 2 === 0) || (dj === -1 && j % 2))
          continue;
        if (!clear(i, j)) continue;
        const top = lv[j * W2 + i];
        if (!clear(i + di, j + dj) || top - lv[(j + dj) * W2 + i + di] < 0.3) continue;
        /* down the shelves to where they stop going down, 6 m at most */
        let m = 0,
          prev = top;
        for (let n = 1; n <= 12; n++) {
          const a = i + di * n,
            b = j + dj * n,
            v = lv[b * W2 + a];
          if (!clear(a, b) || v > prev + 0.05) break;
          if (prev - v < 0.05 && m && top - prev >= WATERGEN_SET_PIECE[0]) break;
          prev = v;
          m = n;
        }
        if (!m || top - prev < WATERGEN_SET_PIECE[0]) continue;
        const fi = i + di * m,
          fj = j + dj * m,
          drop = top - lv[fj * W2 + fi];
        if (drop > WATERGEN_SET_PIECE[1]) continue;
        /* the shelf behind: 4 m back and 1 m either side at the top's raise */
        let flat = true;
        for (let n = 0; n <= 8 && flat; n++)
          for (let s = -2; s <= 2 && flat; s++) {
            const a = i - di * n + dj * s,
              b = j - dj * n + di * s;
            if (!clear(a, b) || Math.abs(G.S[b * W2 + a] - G.S[j * W2 + i]) > 0.05) flat = false;
          }
        if (!flat) continue;
        /* no road or trail within 6 m of the face (a notch across the shelves beside one would cut it off) */
        let far = true;
        for (let b = Math.max(0, (j >> 1) - 8); b <= Math.min(G.h - 1, (j >> 1) + 8) && far; b++)
          for (let a = Math.max(0, (i >> 1) - 8); a <= Math.min(w - 1, (i >> 1) + 8) && far; a++)
            if (G.F[b * w + a] & 1) far = false;
        if (!far) continue;
        const x = (i + 0.5 + di * 0.5) / 2,
          z = (j + 0.5 + dj * 0.5) / 2;
        if (!waterGenReachedNear(G, seen, (fi + 0.5) / 2 + di, (fj + 0.5) / 2 + dj, 3)) continue;
        out.push({ i, j, di, dj, x, z, run: m / 2, h: drop, foot: G.S[fj * W2 + fi] });
      }
  out.sort((a, b) => b.h - a.h || a.j - b.j || a.i - b.i || a.di - b.di || a.dj - b.dj);
  /* one a place: none within 6 m of a taller one */
  const kept = [];
  for (const S of out) if (!kept.some(K => Math.hypot(K.x - S.x, K.z - S.z) < 6)) kept.push(S);
  return kept;
}
/** a set piece: a spring on the shelf, its run to the edge, a notch cut down the shelves below to the foot's level,
 * the fall and its pool; returns its fall or null */
export function waterGenSetPiece(G, rnd, seen) {
  const spots = waterGenSetPieceSpots(G, seen);
  if (!spots.length) return null;
  const { w, h } = G,
    W = w + 1,
    W2 = w * 2;
  /* one of the tallest few, by the random stream, else the next ones down */
  const start = Math.floor(rnd.next() * Math.min(4, spots.length));
  for (const S of spots.slice(start).concat(spots.slice(0, start)).slice(0, 12)) {
    const width = 1.5 + rnd.next(),
      prW = waterGenBetween(width * 0.6 + S.h * 0.08, 1.6, 2.8),
      save = waterGenSave(G);
    /* the notch: whole cells past the lip, within the run's width of the line to the pool, cut down to the foot */
    let ok = true,
      s0 = S.foot;
    const notch = [];
    const fx = S.x + S.di * S.run,
      fz = S.z + S.dj * S.run;
    mapgenPaintDisc(G, (S.x + fx) / 2, (S.z + fz) / 2, S.run / 2 + width, q => {
      const i = q % w,
        j = (q - i) / w,
        x = i + 0.5,
        z = j + 0.5;
      if ((x - S.x) * S.di + (z - S.z) * S.dj <= 0) return;
      if (waterGenSegDist(x, z, [S.x, S.z], [fx, fz]) > width / 2 + 0.25) return;
      if (G.F[q] & (1 | 4 | 8 | 128)) ok = false;
      for (const o of [0, 1, W2, W2 + 1]) s0 = Math.min(s0, G.S[j * 2 * W2 + i * 2 + o]);
      notch.push(q);
    });
    /* the foot at the lowest shelf the notch reaches */
    const h0 = S.h + S.foot - s0;
    if (h0 > WATERGEN_SET_PIECE[1]) ok = false;
    if (!ok) continue;
    for (const q of notch) {
      const i = q % w,
        j = (q - i) / w;
      for (const o of [0, 1, W2, W2 + 1]) {
        G.S[j * 2 * W2 + i * 2 + o] = s0;
        G.M[j * 2 * W2 + i * 2 + o] = 0;
      }
      G.T[q] = 'w';
      G.F[q] = (G.F[q] & ~(2 | 16 | 32 | 64)) | 4;
    }
    /* its pool: the widest that fits on the foot's shelf */
    let pr = 0,
      cx = 0,
      cz = 0;
    /* the pool reaches back to the notch's foot (its middle a radius and a quarter metre past the lip, as a river's) */
    for (const r of [Math.max(prW, S.run / 2), 1.4]) {
      if (S.run > r * 2 + 0.01) continue;
      cx = S.x + S.di * (r + 0.25);
      cz = S.z + S.dj * (r + 0.25);
      if (waterGenPlungePool(G, cx, cz, r, s0, waterGenHeightAt(G.H, w, h, cx, cz) - WATERGEN_UNDER, true)) {
        pr = r;
        break;
      }
    }
    if (!pr) {
      waterGenRestore(G, save);
      continue;
    }
    /* the spring's run on the shelf: 4 m back from the lip, whole cells behind it */
    const sx = S.x - S.di * 4,
      sz = S.z - S.dj * 4;
    mapgenPaintDisc(G, (S.x + sx) / 2, (S.z + sz) / 2, 2 + width, q => {
      const i = q % w,
        j = (q - i) / w,
        x = i + 0.5,
        z = j + 0.5;
      if ((x - S.x) * S.di + (z - S.z) * S.dj >= 0) return;
      if (waterGenSegDist(x, z, [sx, sz], [S.x, S.z]) > width / 2 + 0.25) return;
      if (G.F[q] & 4) return;
      G.T[q] = 'w';
      G.F[q] = (G.F[q] & ~(2 | 16 | 32 | 64)) | 4;
    });
    /* its bed a little under the shelf (the corners inside its run only) */
    const topLev = waterGenHeightAt(G.H, w, h, sx, sz) - WATERGEN_UNDER;
    for (let j = 0; j <= h; j++)
      for (let i = 0; i <= w; i++) {
        if ((i - S.x) * S.di + (j - S.z) * S.dj >= -0.25) continue;
        if (waterGenSegDist(i, j, [sx, sz], [S.x, S.z]) < width / 2 - 0.25)
          G.H[j * W + i] = Math.min(G.H[j * W + i], topLev);
      }
    const after = waterGenReach(G);
    if (waterGenLost(G, seen, after) > WATERGEN_LOST_MAX) {
      waterGenRestore(G, save);
      continue;
    }
    const pts = [
      [sx, sz],
      [S.x, S.z],
      [cx, cz],
    ];
    G.streams.push({
      pts: pts.map(p => [mapgenRound2(p[0]), mapgenRound2(p[1])]),
      speed: 0.9,
      w: pts.map(() => mapgenRound2(width)),
      src: 'spring',
      mouth: 'pool',
    });
    for (const p of pts) mapgenOccAdd(G, p[0], p[1], 0.8);
    G.waterKind = G.waterKind || G.B.water;
    G.stepsUsed = true;
    return waterGenFallEntry(S.x, S.z, [S.di, S.dj], width, h0, pr, false, G.B.water === 'spring' ? 'spring' : '');
  }
  return null;
}
/**
 * WA-2b: the scene's waterfalls (G.falls, the scene's `falls`), after the land stage: the river lifted to its banks'
 * steps, a fall at each drop of WATERGEN_FALL_MIN or more with its plunge pool, and now and then a set piece
 */
export function waterGenFalls(G) {
  G.falls = [];
  const rnd = G.rng('heights', 'falls'),
    falls = [];
  for (const river of G.stepsUsed ? G.rivers || [] : []) {
    const r = waterGenStepRiver(G, river);
    let seen = waterGenReach(G);
    for (const F of waterGenRiverFalls(G, river, r)) {
      const k = F.k,
        pr = waterGenBetween(F.w * 0.55 + F.h * 0.1, 1.4, 3),
        cx = F.x + F.dir[0] * (pr + 0.25),
        cz = F.z + F.dir[1] * (pr + 0.25),
        save = waterGenSave(G);
      let pool = 0;
      if (
        waterGenReachedNear(G, seen, cx, cz, pr + 1.5) &&
        waterGenPlungePool(G, cx, cz, pr, r[k], river.lev[k], false)
      ) {
        const after = waterGenReach(G);
        if (waterGenLost(G, seen, after) > WATERGEN_LOST_MAX) waterGenRestore(G, save);
        else {
          pool = pr;
          seen = after;
        }
      }
      falls.push(waterGenFallEntry(F.x, F.z, F.dir, F.w, F.h, pool, false, null));
    }
  }
  /* a set piece now and then: a route or a cave with mountains (never a town) */
  const chance = G.P.biome === 'cave' ? WATERGEN_SET_CHANCE_CAVE : WATERGEN_SET_CHANCE;
  if (G.mtnE && G.P.kind !== 'town' && rnd.next() < chance) {
    const S = waterGenSetPiece(G, rnd, waterGenReach(G));
    if (S) falls.push(S);
  }
  waterGenHandFalls(G, falls);
  G.falls = falls;
  return falls;
}
/** where a fall's top and foot are tested for being walked to: 4 m back from its lip (its river or spring above it),
 * and its pool's middle (WATERGEN's pools lie their radius and a quarter metre past the lip) */
export const waterGenFallEnds = f => ({
  top: [f.x - f.dir[0] * 4, f.z - f.dir[1] * 4, f.w / 2 + 3],
  foot: [f.x + f.dir[0] * (f.pool + 0.25), f.z + f.dir[1] * (f.pool + 0.25), f.pool + 2.5],
});
/** is dry, reached ground within r of (x, z) (sampled on rings) */
export function waterGenReachedRing(sc, R, x, z, r) {
  for (let a = 0; a < 32; a++)
    for (const d of [r * 0.5, r * 0.75, r]) {
      const px = x + Math.cos((a / 32) * Math.PI * 2) * d,
        pz = z + Math.sin((a / 32) * Math.PI * 2) * d;
      if (px < 0 || pz < 0 || px >= sc.w || pz >= sc.h) continue;
      const t = sc.tiles[sc.h - 1 - Math.floor(pz)][Math.floor(px)];
      if (t !== 'w' && t !== 'd' && mapgenReached(R, px, pz)) return true;
    }
  return false;
}
/**
 * on the finished scene (mapgen.js, last): `climb: 1` on a fall WATERGEN_CLIMB_MIN or taller with a pool whose top and
 * foot the game's own reach (mapgenReach, props and slopes) walks to, so the Waterfall field move is a short cut,
 * never the only way
 */
export function waterGenClimbs(sc, scenery) {
  if (!sc.falls || !sc.falls.some(f => f.pool && f.h >= WATERGEN_CLIMB_MIN)) return;
  const R = mapgenReach(sc, scenery, sc.hub, { slope: true });
  for (const f of sc.falls) {
    /* WA-9: a hand fall placed without its climb stays without */
    if (waterGenHandClimb.get(f) === 0) continue;
    if (!f.pool || f.h < WATERGEN_CLIMB_MIN) continue;
    const { top, foot } = waterGenFallEnds(f);
    if (waterGenReachedRing(sc, R, ...top) && waterGenReachedRing(sc, R, ...foot)) f.climb = 1;
  }
}

/* ---------- WA-5a: the new kinds placed (rapids, a hot spring, the bog, an oasis, cave water, reeds' finds) ----------
   Where the kinds of logic/water-kinds.js lie, as `waters` rectangles over the scene's water (the data contract: maps
   name kinds by their key). The renderer draws an unknown rectangle with the scene's own kind until WA-5b draws the
   new ones, so a scene keeps its `waterKind` (the bog's swamp, the cave's spring) and its look.
   - rapids over a river's steep stretches (WA-3a's `rapids`), never on or by a road or a bridge: neither waded nor
     surfed;
   - a hot spring now and then by a route's road (WATERGEN_SPRING_CHANCE): a small round pool of shallows that heals
     the party once a run (logic/water-play.js), placed as a plunge pool is, so it cuts nothing off;
   - a marsh biome's pond is a bog now and then (WATERGEN_BOG); a dry place's pond is an oasis; a cave's water is cave
     water;
   - on the finished scene, a reed or two in a marsh or a bog hides an item (`hide`, found once a run).
   Its own random streams ('heights', 'kinds') and ('props', 'reeds'). */
/** how often a route gets a hot spring (the owner: about one run in two, ~7 routes a run) */
export const WATERGEN_SPRING_CHANCE = 0.08;
/** a hot spring's radius (m) */
export const WATERGEN_SPRING_R = [1.2, 1.7];
/** how often a marsh biome's pond is a bog */
export const WATERGEN_BOG = 0.4;
/** what a reed may hide, by weight (items.json) */
export const WATERGEN_REED_ITEMS = [
  ['potion', 5],
  ['trailmix', 3],
  ['pretzel', 3],
  ['hi_potion', 2],
  ['burn_salve', 1],
  ['nerve_tonic', 1],
  ['revive', 1],
];

/** rectangles over the given cells (cell indexes j * w + i, z from the near edge), row runs joined down the rows when
 * they match @param {number} w @param {Iterable<number>} cells @param {string} k */
export function waterGenRects(w, cells, k) {
  const rows = new Map();
  for (const q of [...cells].sort((a, b) => a - b)) {
    const j = Math.floor(q / w);
    if (!rows.has(j)) rows.set(j, []);
    rows.get(j).push(q % w);
  }
  /** @type {{ x: number, z: number, w: number, h: number, k: string }[]} */
  const out = [],
    open = new Map();
  for (const j of [...rows.keys()].sort((a, b) => a - b)) {
    const runs = [],
      xs = rows.get(j);
    for (let n = 0; n < xs.length; n++) {
      let m = n;
      while (m + 1 < xs.length && xs[m + 1] === xs[m] + 1) m++;
      runs.push([xs[n], xs[m] - xs[n] + 1]);
      n = m;
    }
    const next = new Map();
    for (const [x, len] of runs) {
      const key = x + ',' + len,
        r = open.get(key);
      if (r && r.z + r.h === j) {
        r.h++;
        next.set(key, r);
      } else {
        const o = { x, z: j, w: len, h: 1, k };
        out.push(o);
        next.set(key, o);
      }
    }
    open.clear();
    for (const [key, r] of next) open.set(key, r);
  }
  return out;
}
/** the river's rapids: its water cells within its half width (and half a metre) of its line along each steep
 * stretch, less any within 2 m of a road, a bridge or a jetty */
export function waterGenRapids(G) {
  const { w } = G,
    cells = new Set();
  for (const R of G.rivers || []) {
    const M = R.pts.length;
    for (const [t0, t1] of R.rapids || [])
      for (let i = Math.round(t0 * (M - 1)); i <= Math.round(t1 * (M - 1)); i++) {
        const [x, z] = R.pts[i];
        mapgenPaintDisc(G, x, z, R.wid[i] / 2 + 0.5, q => {
          if (G.F[q] & 4 && !(G.F[q] & 8)) cells.add(q);
        });
      }
  }
  if (!cells.size) return [];
  for (const q of [...cells]) {
    let near = false;
    mapgenPaintDisc(G, (q % w) + 0.5, Math.floor(q / w) + 0.5, 2, o => {
      if (G.F[o] & (1 | 8 | 128)) near = true;
    });
    if (near) cells.delete(q);
  }
  return waterGenRects(w, cells, 'rapids');
}
/** a hot spring by the road: a round pool of shallows WATERGEN_SPRING_R across, 2-7 m off the road's middle, 3 m from
 * other water, clear of what the road keeps (exits, the hub, buildings' spots), cutting nothing off; null when none
 * fits after 60 tries */
export function waterGenHotSpring(G, rnd) {
  const { w, h } = G,
    W2 = w * 2;
  /** @type {Uint8Array | null} */
  let seen = null;
  for (let t = 0; t < 60; t++) {
    const q0 = Math.floor(rnd.next() * w * h),
      cx = (q0 % w) + 0.5,
      cz = Math.floor(q0 / w) + 0.5,
      r = WATERGEN_SPRING_R[0] + rnd.next() * (WATERGEN_SPRING_R[1] - WATERGEN_SPRING_R[0]);
    if (G.dist[q0] < r + 2 || G.dist[q0] > r + 7) continue;
    let wet = false;
    mapgenPaintDisc(G, cx, cz, r + 3, q => {
      if (G.F[q] & (4 | 128)) wet = true;
    });
    if (wet || G.keep.some(o => Math.hypot(cx - o[0], cz - o[1]) < o[2] + r + 1)) continue;
    seen = seen || waterGenReach(G);
    if (!waterGenReachedNear(G, seen, cx, cz, r + 1.5)) continue;
    const s0 = G.S[Math.floor(cz * 2) * W2 + Math.floor(cx * 2)],
      lev = waterGenHeightAt(G.H, w, h, cx, cz) - WATERGEN_UNDER,
      save = waterGenSave(G);
    if (!waterGenPlungePool(G, cx, cz, r, s0, lev, false)) continue;
    if (waterGenLost(G, seen, waterGenReach(G)) > WATERGEN_LOST_MAX) {
      waterGenRestore(G, save);
      continue;
    }
    const cells = [];
    mapgenPaintDisc(G, cx, cz, r, q => {
      if (G.F[q] & 4) {
        G.T[q] = 'w';
        cells.push(q);
      }
    });
    G.keep.push([cx, cz, r + 1]);
    return {
      x: mapgenRound2(cx),
      z: mapgenRound2(cz),
      r: mapgenRound2(r),
      rects: waterGenRects(w, cells, 'hotspring'),
    };
  }
  return null;
}
/** the new kinds' rectangles (mapgen.js, once after the falls): rapids, the pond's kind, cave water, a hot spring */
export function waterGenKinds(G) {
  const { P, B, w, h } = G,
    rnd = G.rng('heights', 'kinds'),
    R = [];
  if (P.biome === 'cave' && G.F.some(f => f & 4)) R.push({ x: 0, z: 0, w, h, k: 'cave' });
  if (G.pond) {
    const k =
      B.water === 'swamp' && rnd.next() < WATERGEN_BOG
        ? 'bog'
        : B.climate === 'dry' && P.biome !== 'cave'
          ? 'oasis'
          : '';
    if (k) {
      const cells = [];
      mapgenPaintDisc(G, G.pond.x, G.pond.z, G.pond.r + 1, q => {
        if (G.F[q] & 4) cells.push(q);
      });
      R.push(...waterGenRects(w, cells, k));
    }
  }
  R.push(...waterGenRapids(G));
  if (P.kind === 'route' && rnd.next() < WATERGEN_SPRING_CHANCE) {
    const S = waterGenHotSpring(G, rnd);
    if (S) {
      R.push(...S.rects);
      G.hotspring = { x: S.x, z: S.z, r: S.r };
    }
  }
  /* the cave's whole-map rectangle first, so lava's and the rest lie over it (the last rectangle holding a point wins) */
  G.waters = [...R.filter(r => r.k === 'cave'), ...G.waters, ...R.filter(r => r.k !== 'cave')];
  /* WA-9: the Studio's hand-painted kinds last, so they win where they lie */
  G.waters.push(...waterGenHand(G).waters);
}
/** on the finished scene (mapgen.js, last): a reed or two in a marsh or a bog hides an item (`hide`, an items.json
 * key) */
export function waterGenReeds(G, sc) {
  const marsh = sc.waterKind === 'swamp' || (sc.waters || []).some(r => r.k === 'bog');
  if (!marsh) return;
  const reeds = sc.props.filter(p => {
    const M = G.cat[p.k];
    return M && M.grow && /[wd]/.test(M.grow);
  });
  if (!reeds.length) return;
  const rnd = G.rng('props', 'reeds'),
    n = Math.min(reeds.length, 1 + (rnd.next() < 0.5 ? 1 : 0)),
    total = WATERGEN_REED_ITEMS.reduce((a, [, wt]) => a + /** @type {number} */ (wt), 0);
  for (let i = 0; i < n; i++) {
    const p = reeds.splice(Math.floor(rnd.next() * reeds.length), 1)[0];
    let r = rnd.next() * total;
    p.hide = WATERGEN_REED_ITEMS[0][0];
    for (const [k, wt] of WATERGEN_REED_ITEMS)
      if ((r -= /** @type {number} */ (wt)) < 0) {
        p.hide = k;
        break;
      }
  }
}

/* ---------- WA-5a: shallows for others (WA-6a's ask, the owner: a later lane G session) ----------
   Rocks and people may stand in shallows you wade (`w` of a kind waded: not lava, rapids, ice or a hot spring), never in
   deep water; the map generator's reach check keeps all water dry as before, so nothing here opens or shuts a way. */
/** the props that may stand in shallows: boulders, rocks and flat stones (not a molehill, roots or lava rock) */
export const WATERGEN_SHALLOW_PROP = /^(boulder|rock|stones)/;
provide({ WATERGEN_SHALLOW_PROP }); /* to-module */
/** the water kind of cell q (the last of G.waters holding its middle, else the scene's) */
export function waterGenKindAt(G, q) {
  const x = (q % G.w) + 0.5,
    z = Math.floor(q / G.w) + 0.5;
  for (let i = G.waters.length - 1; i >= 0; i--) {
    const r = G.waters[i];
    if (x >= r.x && z >= r.z && x < r.x + r.w && z < r.z + r.h) return r.k || G.waterKind || 'pond';
  }
  return G.waterKind || 'pond';
}
/** may someone or something stand in cell q's water: shallows of a kind you wade that does nothing else (not a hot
 * spring, whose pool stays clear to step into) */
export function waterGenShallows(G, q) {
  if (G.T[q] !== 'w' || G.F[q] & (8 | 128)) return false;
  const k = waterGenKindAt(G, q);
  return !waterKindShut(k) && !waterKindWalkOn(k) && !waterKindHeals(k);
}
