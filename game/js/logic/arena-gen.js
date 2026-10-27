// @ts-check
'use strict';
/* ================= THE LEADERS' ARENAS (region map track WM-7) =================
   A raised, fenced ring on a generated place's road (logic/mapgen.js calls it when the scene's `arena` dial is given:
   a run's mini-boss place and the boss's, logic/run-scenes.js), themed by its leader's type (game/data/arenas.json):
   - arenaGenGround, after the lots: where it stands (a leader's: on the main road, `back` metres from the end the way
     on leaves by; the boss's: at the hub), its ground levelled, an octagon raised `rise` over the road by the step
     raise with a flat apron round it and a ramp where each road crosses its rim, its ground, no tall grass, kept clear
     of trees, lots and anything placed after;
   - arenaGenProps, after the layout: the fence round its rim, open where a road crosses it, its posts at the corners,
     its dressing by the gaps outside the fence; a leader's ring also gets its barrier, a straight fence across the
     whole scene just past its ramp on the way on, open where a road crosses it (the gates' gaps);
   - arenaGenPublish, once the scene's spots are made: scene.arena (where it is, the leader's spot and the challenger's,
     the gate runs across the barrier's gaps), and no spot of the scene's left on it.
   The gate itself is not the generator's: a run puts it on the made scene (arenaGenGates, `unless: beat:<the leader>`),
   so the generator's walk checks see the ring open both ways, as it is once the leader is beaten. Its own random
   stream ('arena'), so no other stage's draws move. Logic only: no DOM, runs in Node (tools/test/arena-gen.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { MAPGEN_LM, mapgenCellAt, mapgenOccAdd, mapgenPaintDisc, mapgenRound2, mapgenSmooth } from './mapgen.js';
/* eslint-disable no-func-assign */
expose({
  ARENA_APRON: [() => ARENA_APRON],
  ARENA_BLEND: [() => ARENA_BLEND],
  ARENA_FENCE_IN: [() => ARENA_FENCE_IN],
  ARENA_GAP: [() => ARENA_GAP],
  ARENA_PLAIN: [() => ARENA_PLAIN],
  ARENA_RAMP: [() => ARENA_RAMP],
  ARENA_SIZES: [() => ARENA_SIZES],
  ARENA_SNAP: [() => ARENA_SNAP],
  // @ts-expect-error -- replaced on purpose
  arenaAlong: [() => arenaAlong, v => (arenaAlong = v)],
  // @ts-expect-error -- replaced on purpose
  arenaBarrierCrossesDeck: [() => arenaBarrierCrossesDeck, v => (arenaBarrierCrossesDeck = v)],
  arenaCorners: [() => arenaCorners],
  // @ts-expect-error -- replaced on purpose
  arenaCross: [() => arenaCross, v => (arenaCross = v)],
  // @ts-expect-error -- replaced on purpose
  arenaFenceSpans: [() => arenaFenceSpans, v => (arenaFenceSpans = v)],
  // @ts-expect-error -- replaced on purpose
  arenaGenBarrier: [() => arenaGenBarrier, v => (arenaGenBarrier = v)],
  // @ts-expect-error -- replaced on purpose
  arenaGenFits: [() => arenaGenFits, v => (arenaGenFits = v)],
  // @ts-expect-error -- replaced on purpose
  arenaGenGaps: [() => arenaGenGaps, v => (arenaGenGaps = v)],
  // @ts-expect-error -- replaced on purpose
  arenaGenGates: [() => arenaGenGates, v => (arenaGenGates = v)],
  // @ts-expect-error -- replaced on purpose
  arenaGenGround: [() => arenaGenGround, v => ((arenaGenGround = v), provide({ arenaGenGround }))],
  // @ts-expect-error -- replaced on purpose
  arenaGenParams: [() => arenaGenParams, v => ((arenaGenParams = v), provide({ arenaGenParams }))],
  // @ts-expect-error -- replaced on purpose
  arenaGenProps: [() => arenaGenProps, v => ((arenaGenProps = v), provide({ arenaGenProps }))],
  // @ts-expect-error -- replaced on purpose
  arenaGenPublish: [() => arenaGenPublish, v => ((arenaGenPublish = v), provide({ arenaGenPublish }))],
  // @ts-expect-error -- replaced on purpose
  arenaGenRun: [() => arenaGenRun, v => (arenaGenRun = v)],
  // @ts-expect-error -- replaced on purpose
  arenaLineSpans: [() => arenaLineSpans, v => (arenaLineSpans = v)],
  // @ts-expect-error -- replaced on purpose
  arenaMainRoad: [() => arenaMainRoad, v => (arenaMainRoad = v)],
  arenaOct: [() => arenaOct],
});
/* eslint-enable no-func-assign */
provide({ arenaGenGround, arenaGenParams, arenaGenProps, arenaGenPublish });
/* to-module: end */
/** WM-7: a theme for a scene asked for with no arenas.json (the tests' small data, the Studio's hand-made dials) */
export const ARENA_PLAIN = {
  name: 'Stone ring',
  ground: 'K',
  rim: 'e',
  fence: 'fence_wood',
  gate: 'fence_gate',
  posts: 'waymarker_post',
  dress: ['lantern', 'flag_pole'],
};
/** WM-7: the sizes with no arenas.json: a leader's ring and the boss's (arenas.json sizes) */
export const ARENA_SIZES = { leader: { r: 8, rise: 0.6, back: 28 }, boss: { r: 11, rise: 0.8 } };
/** how wide the apron round the ring is (metres: flat at the road's raise, so its wall reads) */
export const ARENA_APRON = 1.5;
/** how far in from the rim the fence stands (metres) */
export const ARENA_FENCE_IN = 0.35;
/** a ramp's slope: rise a metre (the road's own limit, 0.1 m a half metre: mapgen.js mapgenTerraces) */
export const ARENA_RAMP = 0.2;
/** how much wider than its road a gap in the fence is, each side (metres) */
export const ARENA_GAP = 1.1;
/** where a barrier's line stands past a half-metre line (metres; logic/arena-gen.test.mjs: it shuts every cell) */
export const ARENA_SNAP = 0.25;
/** how far the ground round the ring blends back to the land's (metres) */
export const ARENA_BLEND = 4;

/** the octagon's distance: at most r inside a regular octagon of apothem r round (0, 0), its sides facing the axes
 * and the diagonals @param {number} dx @param {number} dz */
export const arenaOct = (dx, dz) => Math.max(Math.abs(dx), Math.abs(dz), (Math.abs(dx) + Math.abs(dz)) * Math.SQRT1_2);

/** WM-7: the arena dial filled in and kept in range, or undefined (no arena): its mode (a leader's or the boss's), its
 * size (arenas.json sizes) and its theme's grounds and props (arenas.json themes; ARENA_PLAIN's for any not given)
 * @param {any} A @returns {any} */
export function arenaGenParams(A) {
  if (!A || typeof A !== 'object') return undefined;
  const mode = A.mode === 'boss' ? 'boss' : 'leader',
    S = ARENA_SIZES[mode],
    num = (/** @type {any} */ v, /** @type {number} */ d, /** @type {number} */ lo, /** @type {number} */ hi) =>
      typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d,
    str = (/** @type {any} */ v, /** @type {string} */ d) => (typeof v === 'string' && v ? v : d),
    out = /** @type {any} */ ({
      mode,
      r: num(A.r, S.r, 4, 14),
      rise: num(A.rise, S.rise, 0.4, 1.2),
      name: str(A.name, ARENA_PLAIN.name),
      ground: str(A.ground, ARENA_PLAIN.ground).slice(0, 1),
      rim: str(A.rim, ARENA_PLAIN.rim).slice(0, 1),
      fence: str(A.fence, ARENA_PLAIN.fence),
      gate: str(A.gate, ARENA_PLAIN.gate),
      posts: str(A.posts, ARENA_PLAIN.posts),
      dress: (Array.isArray(A.dress) ? A.dress : ARENA_PLAIN.dress).filter(k => typeof k === 'string').slice(0, 4),
    });
  if (mode === 'leader') out.back = num(A.back, /** @type {number} */ (S.back), 16, 60);
  return out;
}

/** the point `d` metres along a line of points from its start, and the line's way there (a unit vector)
 * @param {number[][]} pts @param {number} d @returns {{ at: number[], dir: number[] }} */
export function arenaAlong(pts, d) {
  let left = d;
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1],
      [bx, bz] = pts[k],
      seg = Math.hypot(bx - ax, bz - az);
    if (seg > 0 && seg >= left) {
      const f = left / seg;
      return { at: [ax + (bx - ax) * f, az + (bz - az) * f], dir: [(bx - ax) / seg, (bz - az) / seg] };
    }
    left -= seg;
  }
  const n = pts.length,
    a = pts[Math.max(0, n - 2)],
    b = pts[n - 1],
    L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { at: b.slice(), dir: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
}

/** the main road's points from the end away from the way on to the end it leaves by (P.ahead: east when not given)
 * @param {any} G */
export function arenaMainRoad(G) {
  const R = G.road[0] ? G.road[0].pts : [],
    side = G.P.ahead || 'E';
  if (R.length < 2) return R;
  const key = (/** @type {number[]} */ p) => (side === 'E' ? p[0] : side === 'W' ? -p[0] : side === 'N' ? p[1] : -p[1]);
  return key(R[R.length - 1]) >= key(R[0]) ? R : R.slice().reverse();
}

/** is the ring at (cx, cz) clear of water, bridges and jetties, and inside the scene by 2 m? @param {any} G
 * @param {number} cx @param {number} cz @param {number} r */
export function arenaGenFits(G, cx, cz, r) {
  const R = r + ARENA_APRON;
  if (cx - R < 2 || cz - R < 2 || cx + R > G.w - 2 || cz + R > G.h - 2) return false;
  for (let j = Math.floor(cz - R); j < Math.ceil(cz + R); j++)
    for (let i = Math.floor(cx - R); i < Math.ceil(cx + R); i++)
      if (arenaOct(i + 0.5 - cx, j + 0.5 - cz) <= R && G.F[j * G.w + i] & (4 | 8 | 128)) return false;
  return true;
}

/** WM-7: the ring's ground (after the lots; see the header). Sets G.arena, or notes why there is none
 * @param {any} G */
export function arenaGenGround(G) {
  const A = G.P.arena;
  if (!A) return;
  const { w, h } = G,
    W2 = w * 2,
    H2 = h * 2,
    r = A.r,
    road = arenaMainRoad(G);
  if (road.length < 2) {
    G.notes.push('no main road for the arena');
    return;
  }
  /* where: a leader's `back` metres from the way on's end (moved back toward the start 4 m at a time, five times,
     until it is clear of water), the boss's at the road's point nearest the hub (then on either way along it) */
  const len = road.reduce((s, p, k) => (k ? s + Math.hypot(p[0] - road[k - 1][0], p[1] - road[k - 1][1]) : 0), 0);
  let hubAt = 0,
    best = 1e9;
  for (let k = 0, s = 0; k < road.length; k++) {
    if (k) s += Math.hypot(road[k][0] - road[k - 1][0], road[k][1] - road[k - 1][1]);
    const d = Math.hypot(road[k][0] - G.hub[0], road[k][1] - G.hub[1]);
    if (d < best) [best, hubAt] = [d, s];
  }
  /* where along the road: a leader's from `back` on toward the start, 3 m at a time, to the road's middle; the boss's
     either way from the hub's point, 3 m at a time, 24 m at most; at each, on the road or moved off it to a side (2 or
     4 m) or away from the scene's side, the road still crossing the ring */
  /** @type {number[]} */
  const tries = [];
  if (A.mode === 'boss') for (let t = 0; t <= 24; t += 3) tries.push(hubAt + t, ...(t ? [hubAt - t] : []));
  else for (let d = len - A.back; d >= len * 0.45; d -= 3) tries.push(d);
  const edge = r + ARENA_APRON + 2;
  let spot = /** @type {{ at: number[], dir: number[] } | null} */ (null);
  for (const d of tries) {
    if (d < r + 6 || d > len - r - 6) continue;
    const s = arenaAlong(road, d);
    for (const off of [0, 2, -2, 4, -4]) {
      const x = s.at[0] - s.dir[1] * off,
        z = s.at[1] + s.dir[0] * off,
        at = [Math.min(G.w - edge, Math.max(edge, x)), Math.min(G.h - edge, Math.max(edge, z))];
      if (Math.hypot(at[0] - s.at[0], at[1] - s.at[1]) > r - 3.5) continue;
      if (arenaGenFits(G, at[0], at[1], r)) {
        spot = { at, dir: s.dir };
        break;
      }
    }
    if (spot) break;
  }
  if (!spot) {
    G.notes.push('no room for the arena on the main road');
    return;
  }
  const cx = Math.round(spot.at[0] * 2) / 2,
    cz = Math.round(spot.at[1] * 2) / 2,
    h0 = G.H[Math.round(cz) * (w + 1) + Math.round(cx)],
    s0 = G.S[Math.floor(cz * 2) * W2 + Math.floor(cx * 2)] || 0,
    top = Math.round((s0 + A.rise) * 20) / 20,
    apron = r + ARENA_APRON,
    ramp = A.rise / ARENA_RAMP + 0.5;
  /* corners: level at the middle's height over the ring and its apron, blended back over ARENA_BLEND */
  for (
    let j = Math.max(0, Math.floor(cz - apron - ARENA_BLEND));
    j <= Math.min(h, Math.ceil(cz + apron + ARENA_BLEND));
    j++
  )
    for (
      let i = Math.max(0, Math.floor(cx - apron - ARENA_BLEND));
      i <= Math.min(w, Math.ceil(cx + apron + ARENA_BLEND));
      i++
    ) {
      const d = arenaOct(i - cx, j - cz) - apron,
        t = d <= 0 ? 1 : 1 - mapgenSmooth(Math.min(1, d / ARENA_BLEND));
      if (t > 0) G.H[j * (w + 1) + i] = G.H[j * (w + 1) + i] * (1 - t) + h0 * t;
    }
  /* is half-metre cell (x, z) on a road, within its half width and a little? */
  const onRoad = (/** @type {number} */ x, /** @type {number} */ z) => {
    const k = G.near[mapgenCellAt(G, x, z)];
    return k >= 0 && Math.hypot(x - G.roadPts[k].x, z - G.roadPts[k].z) <= G.roadPts[k].r + 0.75;
  };
  /* half-metre cells: the ring at its top, the apron at the road's raise, a ramp down each road from the rim */
  const R0 = apron + ramp;
  for (let j = Math.max(0, Math.floor((cz - R0) * 2)); j < Math.min(H2, Math.ceil((cz + R0) * 2)); j++)
    for (let i = Math.max(0, Math.floor((cx - R0) * 2)); i < Math.min(W2, Math.ceil((cx + R0) * 2)); i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        d = arenaOct(x - cx, z - cz),
        q = j * W2 + i;
      if (d <= r) {
        G.S[q] = top;
        G.M[q] &= ~(16 | 32);
      } else if (onRoad(x, z) && d <= r + ramp) {
        G.S[q] = Math.round(Math.max(s0, top - ARENA_RAMP * (d - r)) * 20) / 20;
        G.M[q] = (G.M[q] & ~16) | 32;
      } else if (d <= apron) {
        G.S[q] = s0;
        G.M[q] &= ~(16 | 32);
      }
    }
  G.stepsUsed = true;
  /* metre cells: its ground and its rim's, no tall grass or bank, no trees on it or by it */
  mapgenPaintDisc(G, cx, cz, apron + 2.5, (/** @type {number} */ q) => {
    const x = (q % w) + 0.5,
      z = Math.floor(q / w) + 0.5,
      d = arenaOct(x - cx, z - cz);
    G.F[q] = (G.F[q] & ~(32 | 64)) | 16;
    if (d <= r - 1) G.T[q] = A.ground;
    else if (d <= r) G.T[q] = A.rim;
  });
  /* nothing else stands on it: a lot (the layout, signs and set pieces keep off one) and kept room (every prop) */
  G.lots.push([cx - apron, cz - apron, cx + apron, cz + apron]);
  G.keep.push([cx, cz, apron]);
  G.arena = {
    x: cx,
    z: cz,
    r,
    top,
    s0,
    dir: spot.dir,
    gaps: arenaGenGaps(G, cx, cz, r - ARENA_FENCE_IN),
    past: apron + ramp + 1,
    barrier: null,
  };
}

/** a leader's ring's barrier: a straight fence across the whole scene, `off` metres past the ring's middle the way
 * on (P.ahead: east when not given), on the walk grid's half-metre lines so it shuts every cell (a thin box can fall
 * between the cells' middles), with where the scene's roads cross it (each a gate's gap). Past it is the way on
 * @param {any} G @param {number} cx @param {number} cz @param {number} off
 * @returns {{ a: number[], b: number[], gaps: { x: number, z: number, half: number, out: number[] }[] }} */
export function arenaGenBarrier(G, cx, cz, off) {
  const side = G.P.ahead || 'E',
    sg = side === 'W' || side === 'S' ? -1 : 1,
    /* x (or z) of the line, snapped: ARENA_SNAP past a half-metre line */
    at = (/** @type {number} */ v) => Math.round(v * 2) / 2 + ARENA_SNAP,
    across = side === 'N' || side === 'S',
    a = across ? [0.2, at(cz + off * sg)] : [at(cx + off * sg), 0.2],
    b = across ? [G.w - 0.2, a[1]] : [a[0], G.h - 0.2],
    t = across ? [1, 0] : [0, 1],
    /* `out`: across the line, the way on */
    out = across ? [0, sg] : [sg, 0],
    /** @type {{ x: number, z: number, half: number, out: number[] }[]} */
    gaps = [];
  for (const R of G.road)
    for (let k = 1; k < R.pts.length; k++) {
      const p = arenaCross(a, b, R.pts[k - 1], R.pts[k]);
      if (!p) continue;
      /* a road crossing the line aslant takes a wider gap */
      const d = [R.pts[k][0] - R.pts[k - 1][0], R.pts[k][1] - R.pts[k - 1][1]],
        c = Math.abs(d[0] * out[0] + d[1] * out[1]) / (Math.hypot(d[0], d[1]) || 1),
        half = (R.width / 2 + ARENA_GAP) / Math.max(0.5, c);
      if (!gaps.some(g => Math.abs((g.x - p[0]) * t[0] + (g.z - p[1]) * t[1]) < g.half + half))
        gaps.push({ x: p[0], z: p[1], half, out });
    }
  return { a, b, gaps };
}

/** does a barrier's line cross a jetty, or a bridge outside its gaps? @param {any} G
 * @param {{ a: number[], b: number[], gaps: { x: number, z: number, half: number }[] }} B */
export function arenaBarrierCrossesDeck(G, B) {
  const L = Math.hypot(B.b[0] - B.a[0], B.b[1] - B.a[1]);
  for (let u = 0; u <= L; u += 0.5) {
    const x = B.a[0] + ((B.b[0] - B.a[0]) * u) / L,
      z = B.a[1] + ((B.b[1] - B.a[1]) * u) / L;
    if (!(G.F[mapgenCellAt(G, x, z)] & (8 | 128))) continue;
    if (!B.gaps.some(g => Math.hypot(g.x - x, g.z - z) <= g.half)) return true;
  }
  return false;
}

/** where segments a-b and c-d cross, or null @param {number[]} a @param {number[]} b @param {number[]} c
 * @param {number[]} d @returns {number[] | null} */
export function arenaCross(a, b, c, d) {
  const rx = b[0] - a[0],
    rz = b[1] - a[1],
    sx = d[0] - c[0],
    sz = d[1] - c[1],
    den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den,
    u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + rx * t, a[1] + rz * t] : null;
}

/** a straight fence line's stretches no gap covers, as [a, b] pairs @param {number[]} a @param {number[]} b
 * @param {{ x: number, z: number, half: number }[]} gaps @returns {number[][][]} */
export function arenaLineSpans(a, b, gaps) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    at = (/** @type {number} */ u) => [a[0] + t[0] * u, a[1] + t[1] * u],
    cut = gaps
      .map(g => (g.x - a[0]) * t[0] + (g.z - a[1]) * t[1])
      .map((u, i) => [u - gaps[i].half, u + gaps[i].half])
      .sort((p, q) => p[0] - q[0]),
    out = [];
  let from = 0;
  for (const [u0, u1] of cut) {
    if (u0 - from > 0.5) out.push([at(from), at(u0)]);
    from = Math.max(from, u1);
  }
  if (L - from > 0.5) out.push([at(from), at(L)]);
  return out;
}

/** where the scene's roads cross a ring's fence line (an octagon of apothem f round cx, cz): each crossing's point,
 * its road's half width and the way out of the ring there @param {any} G @param {number} cx @param {number} cz
 * @param {number} f @returns {{ x: number, z: number, half: number, out: number[] }[]} */
export function arenaGenGaps(G, cx, cz, f) {
  /** @type {{ x: number, z: number, half: number, out: number[] }[]} */
  const out = [];
  for (const R of G.road) {
    const P = R.pts;
    for (let k = 1; k < P.length; k++) {
      const a = arenaOct(P[k - 1][0] - cx, P[k - 1][1] - cz) - f,
        b = arenaOct(P[k][0] - cx, P[k][1] - cz) - f;
      if (a <= 0 === b <= 0) continue;
      const t = a / (a - b),
        x = P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t,
        z = P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t;
      /* two roads (a branch on the main one) crossing within a gap's width make one gap */
      if (out.some(g => Math.hypot(g.x - x, g.z - z) < 2 * (R.width / 2 + ARENA_GAP))) continue;
      const L = Math.hypot(x - cx, z - cz) || 1;
      out.push({ x, z, half: R.width / 2 + ARENA_GAP, out: [(x - cx) / L, (z - cz) / L] });
    }
  }
  return out;
}

/** the props of a run of box props (a fence, a gate) from a to b, as mapgen.js mapgenFenceRun lays them: turned along
 * it, each segment fitted to the run's length (scaled 0.8-1.25), its base point the middle of its front
 * @param {any} M the prop (scenery.json, with a box) @param {string} k @param {number[]} a @param {number[]} b
 * @returns {{ k: string, x: number, z: number, g: number, s?: number, rot?: number }[]} */
export function arenaGenRun(M, k, a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!M || !M.box || L < 0.5) return [];
  const n = Math.max(1, Math.round(L / M.box[0])),
    s = Math.min(1.25, Math.max(0.8, L / n / M.box[0])),
    tx = (b[0] - a[0]) / L,
    tz = (b[1] - a[1]) / L,
    rot = mapgenRound2((Math.atan2(tz, tx) * 180) / Math.PI),
    d = M.box[1] * s,
    out = [];
  for (let i = 0; i < n; i++) {
    const cx = a[0] + tx * (L / n) * (i + 0.5),
      cz = a[1] + tz * (L / n) * (i + 0.5),
      p = /** @type {any} */ ({ k, x: mapgenRound2(cx + tz * (d / 2)), z: mapgenRound2(cz - tx * (d / 2)), g: 1 });
    if (Math.abs(s - 1) > 0.02) p.s = mapgenRound2(s);
    if (rot) p.rot = rot;
    out.push(p);
  }
  return out;
}

/** the octagon's corners at apothem f round (cx, cz), from the east one round to the south-east one
 * @param {number} cx @param {number} cz @param {number} f */
export const arenaCorners = (cx, cz, f) =>
  Array.from({ length: 8 }, (_, k) => {
    const a = ((k - 0.5) * Math.PI) / 4,
      R = f / Math.cos(Math.PI / 8);
    return [cx + Math.cos(a) * R, cz + Math.sin(a) * R];
  });

/** the fence line's pieces between the gaps: for each side of the octagon, the stretches no gap covers
 * @param {number} cx @param {number} cz @param {number} f @param {{ x: number, z: number, half: number }[]} gaps
 * @returns {number[][][]} [a, b] pairs */
export function arenaFenceSpans(cx, cz, f, gaps) {
  const C = arenaCorners(cx, cz, f),
    out = [];
  for (let k = 0; k < 8; k++) {
    const a = C[k],
      b = C[(k + 1) % 8],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      tx = (b[0] - a[0]) / L,
      tz = (b[1] - a[1]) / L;
    /* the stretches of this side each gap takes, as [from, to] along it */
    const cut = gaps
      .map(g => {
        const u = (g.x - a[0]) * tx + (g.z - a[1]) * tz,
          off = Math.abs((g.x - a[0]) * tz - (g.z - a[1]) * tx);
        return off < 0.6 ? [u - g.half, u + g.half] : null;
      })
      .filter(c => !!c)
      .sort((p, q) => p[0] - q[0]);
    let from = 0;
    for (const [u0, u1] of cut) {
      if (u0 - from > 0.5) out.push([a.map((v, i) => v + [tx, tz][i] * from), a.map((v, i) => v + [tx, tz][i] * u0)]);
      from = Math.max(from, u1);
    }
    if (L - from > 0.5) out.push([a.map((v, i) => v + [tx, tz][i] * from), b.slice()]);
  }
  return out;
}

/** WM-7: the ring's props (after the layout; see the header) @param {any} G */
export function arenaGenProps(G) {
  const A = G.P.arena,
    R = G.arena;
  if (!A || !R) return;
  /* a leader's barrier (after the layout, which lays its bridges and jetty), moved on past a jetty or a bridge it
     would cross off a road (a fence can't stand on them) */
  if (A.mode === 'leader') {
    for (let t = 0; t < 8 && !R.barrier; t++) {
      const B = arenaGenBarrier(G, R.x, R.z, R.past + t * 1.5);
      if (!arenaBarrierCrossesDeck(G, B)) R.barrier = B;
    }
    if (!R.barrier) G.notes.push("no line for the arena's barrier clear of jetties and bridges");
  }
  const f = R.r - ARENA_FENCE_IN,
    put = (/** @type {any} */ p, /** @type {number} */ not = 4 | 8 | 128) => {
      const q = mapgenCellAt(G, p.x, p.z);
      if (G.F[q] & not) return;
      G.props.push(p);
      mapgenOccAdd(G, p.x, p.z, 0.4);
      if (G.Lm) G.Lm[q] = G.Lm[q] || MAPGEN_LM.fence;
    };
  /* the fence, open where a road crosses it; the posts at the corners no gap is near */
  const M = G.cat[A.fence];
  for (const [a, b] of arenaFenceSpans(R.x, R.z, f, R.gaps)) for (const p of arenaGenRun(M, A.fence, a, b)) put(p);
  /* the barrier stands in shallows too (you could wade round it), never on a bridge or a jetty */
  const B = R.barrier;
  if (B)
    for (const [a, b] of arenaLineSpans(B.a, B.b, B.gaps))
      for (const p of arenaGenRun(M, A.fence, a, b)) put(p, 8 | 128);
  if (G.cat[A.posts])
    for (const [x, z] of arenaCorners(R.x, R.z, f))
      if (!R.gaps.some((/** @type {any} */ g) => Math.hypot(g.x - x, g.z - z) < g.half + 0.4))
        put({ k: A.posts, x: mapgenRound2(x), z: mapgenRound2(z), g: 1 });
  /* the dressing: a pair by each gap, a metre outside the fence, the first of the list by the gaps back, the next by
     the gaps on */
  R.gaps.forEach((/** @type {any} */ g) => {
    const on = g.out[0] * R.dir[0] + g.out[1] * R.dir[1] > 0,
      k = A.dress[on && A.dress.length > 1 ? 1 : 0];
    if (!G.cat[k]) return;
    for (const sg of [1, -1]) {
      const x = g.x + g.out[0] * 1.2 - g.out[1] * (g.half + 0.6) * sg,
        z = g.z + g.out[1] * 1.2 + g.out[0] * (g.half + 0.6) * sg;
      if (x < 1 || z < 1 || x > G.w - 1 || z > G.h - 1 || G.F[mapgenCellAt(G, x, z)] & 1) continue;
      put({ k, x: mapgenRound2(x), z: mapgenRound2(z), g: 1 });
    }
  });
}

/** WM-7: scene.arena, once the scene's spots are made (see the header): where the ring is, its top, its leader's spot
 * (on the road, toward the way on) and the challenger's (toward the way back), facing each other, and the runs a gate
 * shuts (each of the barrier's gaps); the scene's spots on it are dropped @param {any} G @param {any} sc */
export function arenaGenPublish(G, sc) {
  const A = G.P.arena,
    R = G.arena;
  if (!A || !R) return;
  const f = R.r - ARENA_FENCE_IN,
    road = arenaMainRoad(G),
    /* the main road's point nearest a point d metres from the middle along the way on (-d: back) */
    onRoad = (/** @type {number} */ d) => {
      const x = R.x + R.dir[0] * d,
        z = R.z + R.dir[1] * d;
      let b = road[0];
      for (const p of road) if (Math.hypot(p[0] - x, p[1] - z) < Math.hypot(b[0] - x, b[1] - z)) b = p;
      return [mapgenRound2(b[0]), mapgenRound2(b[1])];
    },
    far = A.mode === 'boss' ? 0.5 : 0.45;
  sc.arena = {
    mode: A.mode,
    name: A.name,
    x: R.x,
    z: R.z,
    r: R.r,
    top: R.top,
    leader: onRoad(R.r * far),
    from: onRoad(-R.r * far),
    gate: A.gate,
    gates: (R.barrier ? R.barrier.gaps : []).map((/** @type {any} */ g) => {
      const t = [-g.out[1], g.out[0]];
      return [
        [mapgenRound2(g.x - t[0] * g.half), mapgenRound2(g.z - t[1] * g.half)],
        [mapgenRound2(g.x + t[0] * g.half), mapgenRound2(g.z + t[1] * g.half)],
      ];
    }),
  };
  /* nobody waits or stands for a piece on the ring or its apron */
  const off = (/** @type {any} */ s) => arenaOct(s.x - R.x, s.z - R.z) > f + ARENA_APRON + 0.5;
  if (sc.spots) sc.spots = sc.spots.filter(off);
  if (G.spots) G.spots = G.spots.filter(off);
  if (sc.npcSpots) sc.npcSpots = sc.npcSpots.filter((/** @type {number[]} */ p) => off({ x: p[0], z: p[1] }));
}

/** WM-7: a run's gates on a made scene (logic/run-scenes.js): the scene's arena's gate prop across each gap on the way
 * on, shown until `beaten` holds (a condition: beat:<the leader's id>), so the way on opens once the leader is beaten
 * @param {any} sc @param {any} scenery @param {string} beaten */
export function arenaGenGates(sc, scenery, beaten) {
  const A = sc.arena;
  if (!A || !A.gates || !A.gates.length) return;
  const M = scenery && scenery.props && scenery.props[A.gate];
  for (const [a, b] of A.gates)
    for (const p of arenaGenRun(M, A.gate, a, b)) sc.props.push({ ...p, act: 'arenagate', unless: beaten });
}
