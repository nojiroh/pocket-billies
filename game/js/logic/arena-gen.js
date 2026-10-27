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
     whole scene just past its ramp on the way on, open where a road crosses it (the gates' gaps); WM-3: on a place
     whose road turns, the line that keeps every way in on the ring's side and every way on beyond, or two runs
     round the corner that holds the ways on;
   - arenaGenPublish, once the scene's spots are made: scene.arena (where it is, the leader's spot and the challenger's,
     the gate runs across the barrier's gaps), and no spot of the scene's left on it.
   The gate itself is not the generator's: a run puts it on the made scene (arenaGenGates, `unless: beat:<the leader>`),
   so the generator's walk checks see the ring open both ways, as it is once the leader is beaten. Its own random
   stream ('arena'), so no other stage's draws move. Logic only: no DOM, runs in Node (tools/test/arena-gen.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import {
  MAPGEN_LM,
  mapgenCellAt,
  mapgenExitPoint,
  mapgenOccAdd,
  mapgenPaintDisc,
  mapgenRound2,
  mapgenSmooth,
} from './mapgen.js';
/* eslint-disable no-func-assign */
expose({
  ARENA_APRON: [() => ARENA_APRON],
  ARENA_BLEND: [() => ARENA_BLEND],
  ARENA_CROSS_COS: [() => ARENA_CROSS_COS],
  ARENA_FENCE_IN: [() => ARENA_FENCE_IN],
  ARENA_GAP: [() => ARENA_GAP],
  ARENA_GATE_LAP: [() => ARENA_GATE_LAP],
  ARENA_LINE_CLEAR: [() => ARENA_LINE_CLEAR],
  ARENA_LINE_ROOM: [() => ARENA_LINE_ROOM],
  ARENA_LINE_STEP: [() => ARENA_LINE_STEP],
  ARENA_PLAIN: [() => ARENA_PLAIN],
  ARENA_RAMP: [() => ARENA_RAMP],
  ARENA_SIZES: [() => ARENA_SIZES],
  ARENA_SNAP: [() => ARENA_SNAP],
  // @ts-expect-error -- replaced on purpose
  arenaAlong: [() => arenaAlong, v => (arenaAlong = v)],
  // @ts-expect-error -- replaced on purpose
  arenaBarrierCorners: [() => arenaBarrierCorners, v => (arenaBarrierCorners = v)],
  // @ts-expect-error -- replaced on purpose
  arenaBarrierCrossesDeck: [() => arenaBarrierCrossesDeck, v => (arenaBarrierCrossesDeck = v)],
  // @ts-expect-error -- replaced on purpose
  arenaBarrierLines: [() => arenaBarrierLines, v => (arenaBarrierLines = v)],
  arenaCorners: [() => arenaCorners],
  // @ts-expect-error -- replaced on purpose
  arenaCross: [() => arenaCross, v => (arenaCross = v)],
  // @ts-expect-error -- replaced on purpose
  arenaCrossesSquare: [() => arenaCrossesSquare, v => (arenaCrossesSquare = v)],
  // @ts-expect-error -- replaced on purpose
  arenaFenceSpans: [() => arenaFenceSpans, v => (arenaFenceSpans = v)],
  // @ts-expect-error -- replaced on purpose
  arenaGenBarrier: [() => arenaGenBarrier, v => (arenaGenBarrier = v)],
  // @ts-expect-error -- replaced on purpose
  arenaGenCorner: [() => arenaGenCorner, v => (arenaGenCorner = v)],
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
  // @ts-expect-error -- replaced on purpose
  arenaOnOneTerrace: [() => arenaOnOneTerrace, v => (arenaOnOneTerrace = v)],
  // @ts-expect-error -- replaced on purpose
  arenaSegGaps: [() => arenaSegGaps, v => (arenaSegGaps = v)],
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
/** WM-3: how much longer than its gap a gate's run is, each end (metres) */
export const ARENA_GATE_LAP = 0.25;
/** WM-3: how square on a road must cross a ring's rim (the cosine of the widest angle to the way out, about 53 degrees) */
export const ARENA_CROSS_COS = 0.6;
/** WM-3: how much road a leader's ring would rather have before its apron (metres): its line of route trainers
 * (route-trainers.js routeArenaLine: 10 m in from the way in, then two ROUTE_ARENA_GAP of 8 m, 4 m to spare) */
export const ARENA_LINE_ROOM = 30;
/** WM-3: how far a barrier's line keeps from every exit (metres), so no road runs along it and a seam's walk (4 m in) meets no gate */
export const ARENA_LINE_CLEAR = 6;
/** WM-3: how far apart the barrier's lines are tried (metres; arenaBarrierLines) */
export const ARENA_LINE_STEP = 1.5;
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
  /* WM-3: which of the scene's exits (road.exits, by order) lead on: whole numbers, a few at most */
  if (Array.isArray(A.on))
    out.on = A.on.filter((/** @type {any} */ k) => Number.isInteger(k) && k >= 0 && k < 8).slice(0, 4);
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
  /* where along the road: a leader's from `back` on toward the start, 3 m at a time, to the road's middle (then the
     rest of the road, WM-3); the boss's
     either way from the hub's point, 3 m at a time, 24 m at most; at each, on the road or moved off it to a side (2 or
     4 m) or away from the scene's side, the road still crossing the ring */
  /** @type {number[]} */
  const tries = [];
  if (A.mode === 'boss') for (let t = 0; t <= 24; t += 3) tries.push(hubAt + t, ...(t ? [hubAt - t] : []));
  else {
    for (let d = len - A.back; d >= len * 0.45; d -= 3) tries.push(d);
    /* WM-3: a short or crowded main road (a way in and a way on near one corner, a stream by them): then nearer the
       way on, then on back toward the way in */
    for (let d = len - A.back + 3; d <= len - r - 6; d += 3) tries.push(d);
    for (let d = len * 0.45 - 3; d >= r + 6; d -= 3) tries.push(d);
  }
  const edge = r + ARENA_APRON + 2,
    /* how far its ramps reach (as below: the apron, then the ramp down the rise), a metre more */
    foot = r + ARENA_APRON + A.rise / ARENA_RAMP + 0.5 + 1,
    /* WM-3: a leader's ring only where its barrier can stand past it with every way in on its side and every way on
       beyond (arenaBarrierLines); the first spot that fits at all when none does */
    past = r + ARENA_APRON + A.rise / ARENA_RAMP + 0.5 + 1,
    walls = (/** @type {number[]} */ at) =>
      A.mode !== 'leader' ||
      arenaBarrierLines(G, { x: at[0], z: at[1], past }, 1).length > 0 ||
      arenaBarrierCorners(G, { x: at[0], z: at[1], past }, 1, true).length > 0;
  let spot = /** @type {{ at: number[], dir: number[] } | null} */ (null),
    first = /** @type {{ at: number[], dir: number[] } | null} */ (null),
    walled = /** @type {{ at: number[], dir: number[] } | null} */ (null);
  /* a leader's: room on the road before it for its line of trainers (ARENA_LINE_ROOM) first */
  const room = A.mode === 'leader' ? ARENA_LINE_ROOM + r + ARENA_APRON : 0;
  for (const d of tries) {
    if (d < r + 6 || d > len - r - 6) continue;
    const s = arenaAlong(road, d);
    for (const off of [0, 2, -2, 4, -4]) {
      const x = s.at[0] - s.dir[1] * off,
        z = s.at[1] + s.dir[0] * off,
        at = [Math.min(G.w - edge, Math.max(edge, x)), Math.min(G.h - edge, Math.max(edge, z))];
      if (Math.hypot(at[0] - s.at[0], at[1] - s.at[1]) > r - 3.5) continue;
      if (arenaGenFits(G, at[0], at[1], r)) {
        first ||= { at, dir: s.dir };
        if (!arenaCrossesSquare(G, at[0], at[1], r) || !arenaOnOneTerrace(G, at[0], at[1], foot)) continue;
        if (!walls(at)) continue;
        walled ||= { at, dir: s.dir };
        if (d < room) continue;
        spot = { at, dir: s.dir };
        break;
      }
    }
    if (spot) break;
  }
  spot ||= walled || first;
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
  /* half-metre cells: the ring at its top, the apron at the road's raise, a ramp down each road from the rim; WM-3:
     down to the lowest raise a road has by the ring (a ring by a terrace's edge: its road goes on down a step), each
     road cell no lower than it was */
  let low = s0;
  const near = apron + ramp + 6;
  for (let j = Math.max(0, Math.floor((cz - near) * 2)); j < Math.min(H2, Math.ceil((cz + near) * 2)); j++)
    for (let i = Math.max(0, Math.floor((cx - near) * 2)); i < Math.min(W2, Math.ceil((cx + near) * 2)); i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2;
      if (arenaOct(x - cx, z - cz) <= near && onRoad(x, z)) low = Math.min(low, G.S[j * W2 + i] || 0);
    }
  const down = Math.max(ramp, (top - low) / ARENA_RAMP + 0.5),
    R0 = Math.max(apron, r + down);
  for (let j = Math.max(0, Math.floor((cz - R0) * 2)); j < Math.min(H2, Math.ceil((cz + R0) * 2)); j++)
    for (let i = Math.max(0, Math.floor((cx - R0) * 2)); i < Math.min(W2, Math.ceil((cx + R0) * 2)); i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        d = arenaOct(x - cx, z - cz),
        q = j * W2 + i;
      if (d <= r) {
        G.S[q] = top;
        G.M[q] &= ~(16 | 32);
      } else if (onRoad(x, z) && d <= r + down) {
        const was = G.S[q] || 0,
          to = d <= apron ? s0 : Math.min(s0, was);
        G.S[q] = Math.round(Math.max(to, top - ARENA_RAMP * (d - r)) * 20) / 20;
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
 * between the cells' middles), with where the scene's roads cross it (each a gate's gap). Past it is the way on.
 * WM-3: `how` gives its line instead (across: a line along x, running east to west; sg: the way on north or east, 1,
 * or south or west, -1), from arenaBarrierLines
 * @param {any} G @param {number} cx @param {number} cz @param {number} off
 * @param {{ across: boolean, sg: number }} [how]
 * @returns {{ a: number[], b: number[], gaps: { x: number, z: number, half: number, out: number[] }[] }} */
export function arenaGenBarrier(G, cx, cz, off, how) {
  const side = G.P.ahead || 'E',
    sg = how ? how.sg : side === 'W' || side === 'S' ? -1 : 1,
    /* x (or z) of the line, snapped: ARENA_SNAP past a half-metre line */
    at = (/** @type {number} */ v) => Math.round(v * 2) / 2 + ARENA_SNAP,
    across = how ? how.across : side === 'N' || side === 'S',
    a = across ? [0.2, at(cz + off * sg)] : [at(cx + off * sg), 0.2],
    b = across ? [G.w - 0.2, a[1]] : [a[0], G.h - 0.2],
    t = across ? [1, 0] : [0, 1],
    /* `out`: across the line, the way on */
    out = across ? [0, sg] : [sg, 0];
  return { a, b, gaps: arenaSegGaps(G, a, b, t, out) };
}

/** where the scene's roads cross a straight run of barrier from a to b (along t; `out` across it, the way on): each a
 * gate's gap, wider where a road crosses aslant @param {any} G @param {number[]} a @param {number[]} b
 * @param {number[]} t @param {number[]} out @returns {{ x: number, z: number, half: number, out: number[] }[]} */
export function arenaSegGaps(G, a, b, t, out) {
  /** @type {{ x: number, z: number, half: number, out: number[] }[]} */
  const gaps = [];
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
  return gaps;
}

/** WM-3: a leader's barrier round a corner of the place, for one whose ways on lie in a corner its ways in don't (in
 * from the south and the west, on to the east and the north): two runs meeting at (X, Z), one along x = X out to the
 * edge the way sz says, one along z = Z out to the edge the way sx says, the corner past both the way on. `near`:
 * the other way round, the corner before both holds the ways in and the ring (in from the west, on to the east and,
 * by a branch before the ring, the north), the runs going back from (X, Z). Each way on
 * ARENA_LINE_CLEAR inside both lines, each way in that far outside one, the ring `past` outside one; corners a metre
 * apart; up to `n`, the nearest the ring first, ARENA_LINE_STEP apart (`any`: the first found, for whether there is
 * one) @param {any} G @param {{ x: number, z: number, past: number }} R @param {number} [n] @param {boolean} [any]
 * @returns {{ X: number, Z: number, sx: number, sz: number, near: boolean }[]} */
export function arenaBarrierCorners(G, R, n = 6, any = false) {
  /* the corners that part the ways in from the ways on, once a scene (they don't depend on the ring) */
  if (!G.arenaCorners) {
    const ex = ((G.P.road && G.P.road.exits) || []).map((/** @type {any} */ e) =>
        mapgenExitPoint(G.w, G.h, { ...e, in: 0 })
      ),
      on = (G.P.arena && G.P.arena.on) || [1],
      C = ARENA_LINE_CLEAR;
    /** @type {{ X: number, Z: number, sx: number, sz: number, near: boolean }[]} */
    const list = [];
    if (ex[on[0]])
      for (const sx of [1, -1])
        for (const sz of [1, -1])
          for (let X = 1 + ARENA_SNAP; X < G.w - 1; X += 1)
            for (let Z = 1 + ARENA_SNAP; Z < G.h - 1; Z += 1)
              for (const near of [false, true]) {
                const ok = ex.every((/** @type {number[]} */ p, /** @type {number} */ j) => {
                  const dx = (p[0] - X) * sx,
                    dz = (p[1] - Z) * sz,
                    inside = dx >= C && dz >= C,
                    outside = dx <= -C || dz <= -C,
                    /* near: the corner holds the ways in (and the ring), the rest of the place the ways on */
                    nIn = dx <= -C && dz <= -C,
                    nOut = dx >= C || dz >= C;
                  return near ? (on.includes(j) ? nOut : nIn) : on.includes(j) ? inside : outside;
                });
                if (ok) list.push({ X, Z, sx, sz, near });
              }
    G.arenaCorners = list;
  }
  /** @type {{ X: number, Z: number, sx: number, sz: number, near: boolean, d: number }[]} */
  const all = [];
  for (const c of G.arenaCorners) {
    const dx = (R.x - c.X) * c.sx,
      dz = (R.z - c.Z) * c.sz;
    if (c.near ? !(dx <= -R.past && dz <= -R.past) : !(dx <= -R.past || dz <= -R.past)) continue;
    if (any) return [c];
    all.push({ ...c, d: c.near ? Math.min(-dx, -dz) : Math.hypot(Math.max(0, -dx), Math.max(0, -dz)) });
  }
  all.sort((p, q) => p.d - q.d || p.X - q.X || p.Z - q.Z);
  /** @type {{ X: number, Z: number, sx: number, sz: number, near: boolean }[]} */
  const out = [];
  for (const c of all) {
    if (out.length >= n) break;
    if (
      out.some(
        o => o.near === c.near && o.sx === c.sx && o.sz === c.sz && Math.hypot(o.X - c.X, o.Z - c.Z) < ARENA_LINE_STEP
      )
    )
      continue;
    out.push({ X: c.X, Z: c.Z, sx: c.sx, sz: c.sz, near: c.near });
  }
  return out;
}

/** WM-3: an L barrier's two runs (arenaBarrierCorners), as arenaGenBarrier's: the first with the second in `more`
 * @param {any} G @param {{ X: number, Z: number, sx: number, sz: number, near?: boolean }} c */
export function arenaGenCorner(G, c) {
  /* the runs go out from the corner along the corner's own sides: away from it (sx, sz) round the ways on's corner,
     back past it round a near corner (the ways in's) */
  const k = c.near ? -1 : 1,
    a = [c.X, c.Z],
    bv = [c.X, c.sz * k > 0 ? G.h - 0.2 : 0.2],
    bh = [c.sx * k > 0 ? G.w - 0.2 : 0.2, c.Z];
  return {
    a,
    b: bv,
    gaps: arenaSegGaps(G, a, bv, [0, 1], [c.sx, 0]),
    more: [{ a, b: bh, gaps: arenaSegGaps(G, a, bh, [1, 0], [0, c.sz]) }],
  };
}

/** WM-3: where a leader's barrier may stand on a place whose road can turn (a way in from the south, the way on east):
 * lines across the whole scene, at least `past` from the ring's middle, with every way in (the scene's exits not in the
 * arena's `on`: the first ahead, exit 1, when not given) on the ring's side and every way on past it, each
 * ARENA_LINE_CLEAR from the line; up to `n` a
 * way, ARENA_LINE_STEP apart, the way of the place's `ahead` first, then the others the way the first way on lies
 * @param {any} G @param {{ x: number, z: number, past: number }} R @param {number} [n]
 * @returns {{ off: number, across: boolean, sg: number }[]} */
export function arenaBarrierLines(G, R, n = 8) {
  const ex = ((G.P.road && G.P.road.exits) || []).map((/** @type {any} */ e) =>
      mapgenExitPoint(G.w, G.h, { ...e, in: 0 })
    ),
    on = (G.P.arena && G.P.arena.on) || [1],
    side = G.P.ahead || 'E',
    first = ex[on[0]];
  if (!first) return [];
  /** @type {{ across: boolean, sg: number }[]} */
  const ways = [{ across: side === 'N' || side === 'S', sg: side === 'W' || side === 'S' ? -1 : 1 }];
  for (const across of [false, true]) {
    const c = across ? R.z : R.x,
      v = across ? first[1] : first[0];
    if (v !== c) {
      const w = { across, sg: v > c ? 1 : -1 };
      if (!ways.some(q => q.across === w.across && q.sg === w.sg)) ways.push(w);
    }
  }
  /** @type {{ off: number, across: boolean, sg: number }[]} */
  const out = [];
  for (const w of ways) {
    const c = w.across ? R.z : R.x,
      size = w.across ? G.h : G.w,
      k = w.across ? 1 : 0;
    let got = 0,
      last = -1e9;
    for (let off = R.past; got < n; off += 0.5) {
      const line = Math.round((c + off * w.sg) * 2) / 2 + ARENA_SNAP;
      if (line < 1 || line > size - 1) break;
      const ok = ex.every((/** @type {number[]} */ p, /** @type {number} */ j) =>
        on.includes(j) ? (p[k] - line) * w.sg >= ARENA_LINE_CLEAR : (p[k] - line) * w.sg <= -ARENA_LINE_CLEAR
      );
      if (ok && off - last >= ARENA_LINE_STEP) {
        out.push({ off, ...w });
        last = off;
        got++;
      }
    }
  }
  return out;
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

/** WM-3: is the ground out to a ring's ramps' foot (apothem R round cx, cz) all on the terrace its middle is on? Its
 * ramps run down to the middle's raise, so a road going on down a terrace edge would meet a step (a ring by a
 * terrace's edge) @param {any} G @param {number} cx @param {number} cz @param {number} R */
export function arenaOnOneTerrace(G, cx, cz, R) {
  const W2 = G.w * 2,
    H2 = G.h * 2,
    at = (/** @type {number} */ x, /** @type {number} */ z) => G.S[Math.floor(z * 2) * W2 + Math.floor(x * 2)] || 0,
    s0 = at(cx, cz);
  for (let j = Math.max(0, Math.floor((cz - R) * 2)); j < Math.min(H2, Math.ceil((cz + R) * 2)); j++)
    for (let i = Math.max(0, Math.floor((cx - R) * 2)); i < Math.min(W2, Math.ceil((cx + R) * 2)); i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2;
      if (arenaOct(x - cx, z - cz) <= R && Math.abs((G.S[j * W2 + i] || 0) - s0) > 0.05) return false;
    }
  return true;
}

/** WM-3: does every road cross a ring's rim (apothem f round cx, cz) near head-on, the angle between it and the way out
 * of the ring there within acos(ARENA_CROSS_COS)? A road leaving along the rim runs down the ring's apron and blend
 * where the walk can't follow it (a boss's ring by a road that bends at the hub) @param {any} G @param {number} cx
 * @param {number} cz @param {number} f */
export function arenaCrossesSquare(G, cx, cz, f) {
  for (const R of G.road) {
    const P = R.pts;
    for (let k = 1; k < P.length; k++) {
      const a = arenaOct(P[k - 1][0] - cx, P[k - 1][1] - cz) - f,
        b = arenaOct(P[k][0] - cx, P[k][1] - cz) - f;
      if (a <= 0 === b <= 0) continue;
      const t = a / (a - b),
        x = P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t,
        z = P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t,
        dx = P[k][0] - P[k - 1][0],
        dz = P[k][1] - P[k - 1][1],
        c = Math.abs(dx * (x - cx) + dz * (z - cz)) / ((Math.hypot(dx, dz) || 1) * (Math.hypot(x - cx, z - cz) || 1));
      if (c < ARENA_CROSS_COS) return false;
    }
  }
  return true;
}

/** the props of a run of box props (a fence, a gate) from a to b, as mapgen.js mapgenFenceRun lays them: turned along
 * it, each segment fitted to the run's length (scaled 0.8-1.25), its base point the middle of its front
 * @param {any} M the prop (scenery.json, with a box) @param {string} k @param {number[]} a @param {number[]} b
 * @returns {{ k: string, x: number, z: number, g: number, s?: number, rot?: number }[]} */
export function arenaGenRun(M, k, a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!M || !M.box || L < 0.5) return [];
  /* enough of them that none is stretched past 1.25 (a run left short opens a walk cell at its ends) */
  const n = Math.max(1, Math.round(L / M.box[0]), Math.ceil(L / (M.box[0] * 1.25))),
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
    /* a piece stretched even a little keeps it (pieces at their own length a centimetre or two apart can leave a walk
       cell open between them) */
    if (Math.abs(s - 1) > 0.02 || s > 1) p.s = Math.ceil(s * 100) / 100;
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
    /* WM-3: the lines that keep every way in on the ring's side and the way on past it (arenaBarrierLines) */
    const tries = [
      ...arenaBarrierLines(G, R).map(L => () => arenaGenBarrier(G, R.x, R.z, L.off, L)),
      ...arenaBarrierCorners(G, R).map(c => () => arenaGenCorner(G, c)),
    ];
    for (const make of tries) {
      const B = /** @type {any} */ (make());
      if ([B, ...(B.more || [])].some(S => arenaBarrierCrossesDeck(G, S))) continue;
      R.barrier = B;
      break;
    }
    if (!R.barrier)
      G.notes.push("no line for the arena's barrier between the ways in and on, clear of jetties and bridges");
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
    for (const S of [B, ...(B.more || [])])
      for (const [a, b] of arenaLineSpans(S.a, S.b, S.gaps))
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
    /* each gap's run, ARENA_GATE_LAP longer each end than the gap, so no walk cell is left open where it meets the
       barrier's fence (WM-3: a road crossing aslant leaves a wide gap whose ends fall between cells) */
    gates: (R.barrier ? [R.barrier, ...(R.barrier.more || [])].flatMap(S => S.gaps) : []).map(
      (/** @type {any} */ g) => {
        const t = [-g.out[1], g.out[0]],
          h = g.half + ARENA_GATE_LAP;
        return [
          [mapgenRound2(g.x - t[0] * h), mapgenRound2(g.z - t[1] * h)],
          [mapgenRound2(g.x + t[0] * h), mapgenRound2(g.z + t[1] * h)],
        ];
      }
    ),
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
