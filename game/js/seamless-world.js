/* seamless-world.js — v43: the seamless world. Scenes stay separate files, but what the walk screen shows is a window onto one
   continuous ground: a scene with the road leaving its exit, the road itself, or the next scene with the road arriving.

   How it is stitched: a road (a link between two stops) lives in a frame of its own, the "road frame", whose origin is
   the first scene's corner and in which the road leaves that scene's exit at right angles to its edge, runs straight,
   turns at right angles when it has to (so the far end arrives at right angles to the far scene's edge too), and the
   far scene is placed so that its exit sits at the road's end. Every view is an axis-aligned box of that frame made
   into an ordinary scene object (tiles, heights, steps, props, water, rails...) on the fly — a "composite" — so the
   renderer, the navigation grid, the encounters and the folk need to know nothing about any of this. Moving from one
   composite to the next is a translation: the player, the camera and everything moving are shifted by the difference
   of the two boxes' origins (dioShift), the ground of the next box is painted in the background before it is needed,
   and nothing fades or cuts.

   A road's length is 40 m per 500 steps of its cost; where you stand on it is your progress along the link, so steps
   stay the currency: the road is the walk you were already doing, now with ground under it. The road's ground, verges,
   trees and flowers come from a seed (the link's index), never stored. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, sceneExits, sceneIdAt } from './hooks.js';
import { clamp } from './util.js';
import { ADJ, LINKS, ROUTE } from './data.js';
import { U } from './game-state.js';
import { artLoad, hexA } from './art.js';
import {
  DIO,
  DIO_GCACHE,
  DIO_STEPS,
  dioData,
  dioExitEdge,
  dioGroundAsync,
  dioGroundKey,
  dioHubOf,
  dioMoodOf,
  dioPaths,
  dioPoly,
  dioScene,
  dioStepCell,
  dioSteps,
} from './walk-view.js';
import { eng } from './engine/settings.js';
import { smooth01 } from './engine/core.js';
import { DGL, dglPrepare, dglPrepared } from './walk-view-gl.js';
import { lifeShift } from './life.js';
import { owShift } from './world-billies.js';
/* eslint-disable no-func-assign */
expose({
  WORLD: [() => WORLD],
  WR_DECO: [() => WR_DECO],
  WR_DIR: [() => WR_DIR],
  WR_HUBL: [() => WR_HUBL],
  WR_JD: [() => WR_JD],
  WR_JW: [() => WR_JW],
  WR_LOOK: [() => WR_LOOK],
  WR_LR: [() => WR_LR],
  WR_MIX: [() => WR_MIX],
  WR_OPP: [() => WR_OPP],
  WR_ROCK: [() => WR_ROCK],
  WR_ROOM_GAP: [() => WR_ROOM_GAP],
  WR_SR: [() => WR_SR],
  WR_ST: [() => WR_ST],
  WR_TUN: [() => WR_TUN],
  WR_WIN: [() => WR_WIN],
  dioShift: [() => dioShift, v => (dioShift = v)],
  wrAdj: [() => wrAdj, v => (wrAdj = v)],
  wrAlongPts: [() => wrAlongPts, v => (wrAlongPts = v)],
  wrAt: [() => wrAt, v => (wrAt = v)],
  wrBldWindows: [() => wrBldWindows, v => (wrBldWindows = v)],
  wrCompose: [() => wrCompose, v => (wrCompose = v)],
  wrComposeMulti: [() => wrComposeMulti, v => (wrComposeMulti = v)],
  wrCornerH: [() => wrCornerH, v => (wrCornerH = v)],
  wrDelta: [() => wrDelta, v => (wrDelta = v)],
  wrExitOf: [() => wrExitOf, v => (wrExitOf = v)],
  wrExitPath: [() => wrExitPath, v => (wrExitPath = v)],
  wrFix: [() => wrFix, v => (wrFix = v)],
  wrGate: [() => wrGate, v => (wrGate = v)],
  wrGetReady: [() => wrGetReady, v => (wrGetReady = v)],
  wrHash: [() => wrHash, v => (wrHash = v)],
  wrHeight: [() => wrHeight, v => (wrHeight = v)],
  wrHubParts: [() => wrHubParts, v => (wrHubParts = v)],
  wrHubScene: [() => wrHubScene, v => (wrHubScene = v)],
  wrInRect: [() => wrInRect],
  wrJoin: [() => wrJoin, v => (wrJoin = v)],
  wrJoinTrip: [() => wrJoinTrip, v => (wrJoinTrip = v)],
  wrLinkIndex: [() => wrLinkIndex, v => (wrLinkIndex = v)],
  wrLook: [() => wrLook, v => (wrLook = v)],
  wrLookMix: [() => wrLookMix, v => (wrLookMix = v)],
  wrLookOf: [() => wrLookOf, v => (wrLookOf = v)],
  wrLookTick: [() => wrLookTick, v => ((wrLookTick = v), provide({ wrLookTick }))],
  wrMixHex: [() => wrMixHex, v => (wrMixHex = v)],
  wrNear: [() => wrNear, v => ((wrNear = v), provide({ wrNear }))],
  wrNoise: [() => wrNoise, v => (wrNoise = v)],
  wrOn: [() => wrOn],
  wrPrefetch: [() => wrPrefetch, v => (wrPrefetch = v)],
  wrPrefetchView: [() => wrPrefetchView, v => (wrPrefetchView = v)],
  wrProps: [() => wrProps, v => (wrProps = v)],
  wrRaiseAt: [() => wrRaiseAt, v => (wrRaiseAt = v)],
  wrReady: [() => wrReady, v => (wrReady = v)],
  wrRoad: [() => wrRoad, v => (wrRoad = v)],
  wrRoadLen: [() => wrRoadLen, v => (wrRoadLen = v)],
  wrRoamView: [() => wrRoamView, v => (wrRoamView = v)],
  wrRoomId: [() => wrRoomId, v => (wrRoomId = v)],
  wrRoomPlace: [() => wrRoomPlace, v => (wrRoomPlace = v)],
  wrRoomScene: [() => wrRoomScene, v => (wrRoomScene = v)],
  wrRoomWindows: [() => wrRoomWindows, v => (wrRoomWindows = v)],
  wrSalt: [() => wrSalt, v => (wrSalt = v)],
  wrScene: [() => wrScene, v => (wrScene = v)],
  wrSceneById: [() => wrSceneById, v => ((wrSceneById = v), provide({ wrSceneById }))],
  wrSeamOf: [() => wrSeamOf, v => (wrSeamOf = v)],
  wrStartU: [() => wrStartU, v => (wrStartU = v)],
  wrTile: [() => wrTile, v => (wrTile = v)],
  wrTrim: [() => wrTrim, v => (wrTrim = v)],
  wrTripView: [() => wrTripView, v => (wrTripView = v)],
  wrVeil: [() => wrVeil, v => (wrVeil = v)],
  wrViewFor: [() => wrViewFor, v => (wrViewFor = v)],
});
/* eslint-enable no-func-assign */
provide({ wrLookTick, wrNear, wrSceneById });
/* to-module: end */
export const WORLD = { cache: new Map(), max: 5, gen: 0, LW: 40, MID: 64, BAND: 12, on: true };
provide({ WORLD }); /* to-module */
export const wrOn = () => WORLD.on && !(typeof eng === 'function' && eng('world', 'seamless') === false);
function wrRoadLen(steps) {
  return Math.max(24, Math.round((40 * steps) / 500));
}
function wrLinkIndex(a, b) {
  for (let i = 0; i < LINKS.length; i++) {
    const L = LINKS[i];
    if ((L[0] === a && L[1] === b) || (L[0] === b && L[1] === a)) return i;
  }
  return -1;
}
function wrHash(x, y, s) {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + (s || 0) * 1013904223) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function wrNoise(x, y, s) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    fx = x - xi,
    fy = y - yi,
    u = t => t * t * (3 - 2 * t),
    a = wrHash(xi, yi, s),
    b = wrHash(xi + 1, yi, s),
    c = wrHash(xi, yi + 1, s),
    d = wrHash(xi + 1, yi + 1, s);
  return a + (b - a) * u(fx) + (c - a) * u(fy) + (a - b - c + d) * u(fx) * u(fy);
}
const WR_DIR = { E: [1, 0], W: [-1, 0], N: [0, 1], S: [0, -1] };
/* which exit of a stop's scene a link uses: the join table first, then the compass match (ui.js sceneExits) */
function wrExitOf(node, i) {
  const sc = dioScene(sceneIdAt(node));
  if (!sc || !(sc.exits || []).length) return null;
  const L = LINKS[i],
    J = L[3],
    id = J ? (L[0] === node ? J.a : J.b) : null,
    E = sc.edgeExits || [];
  let k = id ? E.findIndex(q => q.id === id) : -1;
  if (k < 0 && typeof sceneExits === 'function') {
    const to = L[0] === node ? L[1] : L[0];
    k = sceneExits(node)[to] ?? -1;
  }
  if (k < 0) return null;
  const e = E[k] || dioExitEdge(sc, sc.exits[k]),
    p = sc.exits[k];
  return { k, side: e.side, p, width: e.width || 2 };
}
/* the road of link i: its frame, legs and ends. A = the link's first stop, B its second, whichever way you walk it */
function wrRoad(i) {
  const key = 'road' + i + '|' + WORLD.gen;
  let R = WORLD.cache.get(key);
  if (R) return R;
  const L = LINKS[i],
    a = L[0],
    b = L[1],
    A = dioScene(sceneIdAt(a)),
    B = dioScene(sceneIdAt(b)),
    ea = wrExitOf(a, i),
    eb = wrExitOf(b, i);
  if (!A || !B || !ea || !eb) return null;
  const Lr = wrRoadLen(L[2]),
    dA = WR_DIR[ea.side],
    dB = WR_DIR[eb.side],
    LW = WORLD.LW;
  /* A sits at (ax, az): room on its west or south for the road when the exit is on that side */
  const ax = ea.side === 'W' ? LW : 0,
    az = ea.side === 'S' ? LW : 0;
  const start =
    ea.side === 'E'
      ? [ax + A.w, az + ea.p[1]]
      : ea.side === 'W'
        ? [ax, az + ea.p[1]]
        : ea.side === 'N'
          ? [ax + ea.p[0], az + A.h]
          : [ax + ea.p[0], az];
  /* legs: straight when the exits face each other, one turn when they are at right angles, two when both look the same way */
  const dEnd = [-dB[0], -dB[1]],
    dot = dA[0] * dEnd[0] + dA[1] * dEnd[1],
    legs = [];
  if (dot > 0.5) legs.push({ d: dA, L: Lr });
  else if (Math.abs(dot) < 0.5) {
    legs.push({ d: dA, L: Lr * 0.5 }, { d: dEnd, L: Lr * 0.5 });
  } else {
    const perp = [dA[1], -dA[0]],
      s = wrHash(i, 7, 1) < 0.5 ? 1 : -1;
    legs.push({ d: dA, L: Lr * 0.34 }, { d: [perp[0] * s, perp[1] * s], L: Lr * 0.32 }, { d: dEnd, L: Lr * 0.34 });
  }
  const pts = [start.slice()];
  let p = start.slice(),
    u = 0;
  const segs = [];
  for (const g of legs) {
    const q = [p[0] + g.d[0] * g.L, p[1] + g.d[1] * g.L];
    segs.push({ a: p, b: q, d: g.d, u0: u, u1: u + g.L });
    u += g.L;
    p = q;
    pts.push(q);
  }
  const end = p,
    bEdge =
      eb.side === 'E'
        ? [B.w, eb.p[1]]
        : eb.side === 'W'
          ? [0, eb.p[1]]
          : eb.side === 'N'
            ? [eb.p[0], B.h]
            : [eb.p[0], 0];
  /* B sits on whole metres (its tiles must line up with the grid); the road's end is within half a metre of its exit */
  const bx = Math.round(end[0] - bEdge[0]),
    bz = Math.round(end[1] - bEdge[1]);
  R = {
    i,
    a,
    b,
    A: A,
    B: B,
    aId: sceneIdAt(a),
    bId: sceneIdAt(b),
    ea,
    eb,
    Lr,
    legs: segs,
    pts,
    start,
    end,
    aOff: [ax, az],
    bOff: [bx, bz],
    seed: i * 131 + 7,
    edgeA: A.edge || 'g',
    edgeB: B.edge || 'g',
  };
  WORLD.cache.set(key, R);
  return R;
}
/* ---------- alpha 0.2: places joined edge to edge ----------
   Two linked places meet at their exits: B's edge lies against A's, B placed so that its exit is exactly across from
   A's (tools/join-places.py, now on the legacy branch, made every link's two exits face each other, east to west or north to south). A place's
   view is the place itself with a band of each neighbour where they meet (WR_JD deep, WR_JW either side of the exit,
   never past the place's own edge, two neighbours on one side sharing it half and half); around that lies
   countryside you can't walk into. The ground eases across every seam (heights over 8 m each side, a ragged line
   where two kinds of ground meet). A trip is the walk from the hub to the exit (the path the tool measured,
   edgeExits[k].path) and on from the next place's entrance to its hub, the view changing to the next place's at
   the seam. A link whose exits don't face each other (one drawn in the Studio since) still gets a road. */
const WR_OPP = { E: 'W', W: 'E', N: 'S', S: 'N' },
  WR_JD = 36,
  WR_JW = 26;
/* what doesn't change from view to view (joins, seams, each place's eased ground), kept until the data changes */
function wrFix(key, fn) {
  if (WORLD.fixGen !== WORLD.gen) {
    WORLD.fix = new Map();
    WORLD.fixGen = WORLD.gen;
  }
  if (WORLD.fix.has(key)) return WORLD.fix.get(key);
  const v = fn();
  WORLD.fix.set(key, v);
  return v;
}
function wrJoin(i) {
  if (!wrOn() || (typeof eng === 'function' && eng('world', 'joined') === false)) return null;
  return wrFix('join' + i, () => {
    const L = LINKS[i];
    if (!L) return null;
    const a = L[0],
      b = L[1],
      A = dioScene(sceneIdAt(a)),
      B = dioScene(sceneIdAt(b)),
      ea = wrExitOf(a, i),
      eb = wrExitOf(b, i);
    if (!A || !B || !ea || !eb || WR_OPP[ea.side] !== eb.side || sceneIdAt(a) === sceneIdAt(b)) return null;
    const off =
      ea.side === 'E'
        ? [A.w, Math.round(ea.p[1] - eb.p[1])]
        : ea.side === 'W'
          ? [-B.w, Math.round(ea.p[1] - eb.p[1])]
          : ea.side === 'N'
            ? [Math.round(ea.p[0] - eb.p[0]), A.h]
            : [Math.round(ea.p[0] - eb.p[0]), -B.h];
    return { join: 1, i, a, b, A, B, aId: sceneIdAt(a), bId: sceneIdAt(b), ea, eb, off, seed: i * 131 + 7 };
  });
}
/* The seam of join i. The stretch of edge the two places share near the exit (lo..hi, in A's metres along the edge;
   at most WR_SR either side of the exit, ending half way to another exit on that edge, of either place) eases out over
   WR_ST at each end. dh is the land's difference across it, metre by metre (B's minus A's), W how far either side the
   land eases, and dE the difference of the step raise right at the exit (a cave mouth up on a shelf, a canyon rim). */
const WR_SR = 22,
  WR_ST = 4,
  WR_ROCK = 4.1,
  WR_TUN = 6; /* (the rock's raise: as tools/expand-places.py ROCK_UP) */
function wrCornerH(S, x, z) {
  const H = S.heights;
  if (!H) return 0;
  const r = H[S.h - Math.round(z)];
  return r ? +r[Math.round(x)] || 0 : 0;
}
function wrRaiseAt(S, ex) {
  const E = dioSteps(S);
  if (!E) return 0;
  const p = ex.p,
    s = ex.side,
    x = s === 'E' ? S.w - 0.25 : s === 'W' ? 0.25 : p[0],
    z = s === 'N' ? S.h - 0.25 : s === 'S' ? 0.25 : p[1];
  return E.H[dioStepCell(x, z, E)];
}
function wrSeamOf(i) {
  return wrFix('seam' + i, () => {
    const J = wrJoin(i);
    if (!J) return null;
    const s = J.ea.side,
      vert = s === 'E' || s === 'W',
      A = J.A,
      B = J.B,
      oa = vert ? J.off[1] : J.off[0],
      e = vert ? J.ea.p[1] : J.ea.p[0];
    const c0 = Math.max(0, oa),
      c1 = Math.min(vert ? A.h : A.w, oa + (vert ? B.h : B.w));
    if (c1 <= c0) return null;
    let lo = Math.max(e - WR_SR, c0),
      hi = Math.min(e + WR_SR, c1);
    const along = (S, j) => {
        const q = S.edgeExits[j],
          p = S.exits[j];
        return q.side === 'E' || q.side === 'W' ? p[1] : p[0];
      },
      oth = [];
    (A.edgeExits || []).forEach((q, j) => {
      if (j !== J.ea.k && q.side === s && A.exits[j]) oth.push(along(A, j));
    });
    (B.edgeExits || []).forEach((q, j) => {
      if (j !== J.eb.k && q.side === J.eb.side && B.exits[j]) oth.push(along(B, j) + oa);
    });
    for (const o of oth) {
      const m = (o + e) / 2;
      if (o < e) lo = Math.max(lo, m + WR_ST / 2);
      else hi = Math.min(hi, m - WR_ST / 2);
    }
    if (hi < lo) lo = hi = (lo + hi) / 2;
    const hA = u => wrCornerH(A, vert ? (s === 'E' ? A.w : 0) : u, vert ? u : s === 'N' ? A.h : 0),
      hB = u => {
        const v = u - oa;
        return wrCornerH(B, vert ? (s === 'E' ? 0 : B.w) : v, vert ? v : s === 'N' ? 0 : B.h);
      };
    const u0 = Math.floor(lo - WR_ST),
      u1 = Math.ceil(hi + WR_ST),
      dh = {};
    let big = 0;
    for (let u = u0; u <= u1; u++) {
      const c = clamp(u, Math.ceil(c0), Math.floor(c1));
      dh[u] = hB(c) - hA(c);
      if (Math.abs(u - e) <= 6) big = Math.max(big, Math.abs(dh[u]));
    }
    return {
      i,
      aId: J.aId,
      bId: J.bId,
      sA: s,
      sB: J.eb.side,
      oa,
      e,
      lo,
      hi,
      u0,
      u1,
      dh,
      W: clamp(3 * big, 8, 14),
      dE: wrRaiseAt(B, J.eb) - wrRaiseAt(A, J.ea),
    };
  });
}
/* A place's eased ground: its own metre corners and step raises with every joined edge eased as its seam says. The
   land meets half way (each side moves by half the difference, less and less further in). Where one exit is up on a
   rim or shelf, the other place's ground rises to meet it in a broad slope round its exit (a ramp of half-metre cells
   that lean, so no new wall). Worked out from the place's own joins alone, so every view of it shows it the same. The
   place's data is not changed. {G: corners, (w+1)*(h+1), row b at b metres from the near edge; E: a step grid or null} */
function wrAdj(S, sid) {
  return wrFix('adj' + sid, () => {
    const L = [];
    for (let i = 0; i < LINKS.length; i++) {
      if (sceneIdAt(LINKS[i][0]) !== sid && sceneIdAt(LINKS[i][1]) !== sid) continue; /* only this place's seams */
      const Q = wrSeamOf(i);
      if (!Q) continue;
      if (Q.aId === sid) L.push([Q, 1]);
      else if (Q.bId === sid) L.push([Q, 0]);
    }
    if (!L.length) return null;
    const W = S.w,
      Hh = S.h,
      G = new Float32Array((W + 1) * (Hh + 1));
    for (let b = 0; b <= Hh; b++) {
      const r = (S.heights || [])[Hh - b];
      for (let a = 0; a <= W; a++) G[b * (W + 1) + a] = r ? +r[a] || 0 : 0;
    }
    const E0 = dioSteps(S);
    let E = null;
    const dOf = (s, x, z) => (s === 'E' ? W - x : s === 'W' ? x : s === 'N' ? Hh - z : z),
      uOf = (s, x, z) => (s === 'E' || s === 'W' ? z : x);
    for (const [Q, isA] of L) {
      const s = isA ? Q.sA : Q.sB,
        sh = isA ? 0 : Q.oa,
        sg = isA ? 1 : -1,
        tap = u => smooth01((u - (Q.lo - WR_ST)) / WR_ST) * smooth01((Q.hi + WR_ST - u) / WR_ST);
      for (let b = 0; b <= Hh; b++)
        for (let a = 0; a <= W; a++) {
          const d = dOf(s, a, b);
          if (d >= Q.W) continue;
          const u = uOf(s, a, b) + sh;
          if (u <= Q.u0 || u >= Q.u1) continue;
          const k = (1 - smooth01(d / Q.W)) * tap(u);
          if (k > 0) G[b * (W + 1) + a] += ((sg * Q.dh[Math.round(u)]) / 2) * k;
        }
      /* the lower side rises to the exit that is up on a rim */
      const up = isA ? Q.dE : -Q.dE;
      if (up > 0.05 && !WORLD.noLift) {
        if (!E) {
          E = {
            w: W * 2,
            h: Hh * 2,
            H: E0 ? Float32Array.from(E0.H) : new Float32Array(W * Hh * 4),
            M: E0 ? Uint8Array.from(E0.M) : new Uint8Array(W * Hh * 4),
          };
          E.s = 'adj:' + sid;
          E.m0 = E.s;
        }
        const WE = clamp(up / 0.22, 6, 20),
          eu = Q.e - sh,
          rows = S.tiles || [];
        for (let j = 0; j < E.h; j++)
          for (let i = 0; i < E.w; i++) {
            const x = (i + 0.5) / 2,
              z = (j + 0.5) / 2,
              d = dOf(s, x, z),
              r = Math.hypot(d, uOf(s, x, z) - eu);
            if (r >= WE + 2) continue;
            const ch = (rows[Hh - 1 - Math.floor(z)] || '')[Math.floor(x)];
            if (ch === 'w' || ch === 'd') continue;
            const q = j * E.w + i;
            if ((E.M[q] & 15) === 8 || E.M[q] & 16) continue;
            const lift = up * (1 - smooth01((r - 2) / WE));
            if (lift < 0.02) continue;
            E.H[q] += lift;
            E.M[q] |= 32;
          }
      }
    }
    return { G, E };
  });
}
/* the walk from a place's hub to one of its exits, in its own metres: the path the tool measured, or a straight line */
function wrExitPath(S, k) {
  const e = (S.edgeExits || [])[k],
    p = (S.exits || [])[k],
    hub = dioHubOf(S);
  if (!p) return { pts: [hub, hub], len: 0 };
  let pts = e && e.path && e.path.length > 1 ? e.path.map(q => q.slice()) : [hub.slice(), p.slice()];
  const last = pts[pts.length - 1];
  if (Math.hypot(last[0] - p[0], last[1] - p[1]) > 0.3) pts.push(p.slice());
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { pts, len };
}
function wrAlongPts(P, u) {
  u = clamp(u, 0, P.len);
  let s = 0;
  for (let i = 1; i < P.pts.length; i++) {
    const a = P.pts[i - 1],
      b = P.pts[i],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s + l >= u || i === P.pts.length - 1) {
      const k = l ? clamp((u - s) / l, 0, 1) : 0;
      return {
        x: a[0] + (b[0] - a[0]) * k,
        z: a[1] + (b[1] - a[1]) * k,
        d: l ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : [0, 1],
      };
    }
    s += l;
  }
  return { x: P.pts[0][0], z: P.pts[0][1], d: [0, 1] };
}
/* the road point at u metres from A's edge, and the nearest road point to (x, z) in the frame */
function wrAt(R, u) {
  u = clamp(u, 0, R.Lr);
  for (const s of R.legs)
    if (u <= s.u1 || s === R.legs[R.legs.length - 1]) {
      const k = clamp((u - s.u0) / (s.u1 - s.u0 || 1), 0, 1);
      return { x: s.a[0] + (s.b[0] - s.a[0]) * k, z: s.a[1] + (s.b[1] - s.a[1]) * k, d: s.d };
    }
}
export function wrNear(R, x, z) {
  let best = null;
  for (const s of R.legs) {
    const vx = s.b[0] - s.a[0],
      vz = s.b[1] - s.a[1],
      l2 = vx * vx + vz * vz || 1e-9,
      k = clamp(((x - s.a[0]) * vx + (z - s.a[1]) * vz) / l2, 0, 1),
      px = s.a[0] + vx * k,
      pz = s.a[1] + vz * k,
      d = Math.hypot(px - x, pz - z);
    if (!best || d < best.d)
      best = { d, u: s.u0 + Math.sqrt(l2) * k, px, pz, side: (x - px) * vz - (z - pz) * vx > 0 ? 1 : -1 };
  }
  return best;
}
const wrInRect = (x, z, o, sc) => x >= o[0] && z >= o[1] && x < o[0] + sc.w && z < o[1] + sc.h;
/* the road's ground at a frame point: a path down the middle, verges of grass and tall grass, then the countryside
   of the nearer scene's edge terrain. Across water (a scene whose edge is sea) the road is a sandy causeway. */
function wrTile(R, x, z) {
  const n = wrNear(R, x, z),
    d = n.d,
    w = 1.4 + 0.5 * wrNoise(n.u * 0.11, 3, R.seed),
    edge = n.u < R.Lr / 2 ? R.edgeA : R.edgeB,
    wet = 'wd'.includes(edge);
  if (d < w) return 'p';
  if (d < w + 0.9 && wrHash(x * 2, z * 2, R.seed) < 0.35) return wet ? 's' : 'g';
  if (d < 5.5) {
    if (wet) return 's';
    const t = wrNoise(x * 0.21, z * 0.21, R.seed + 3);
    return t > 0.62 ? 't' : t < 0.18 && !wet ? 'f' : 'g';
  }
  if (d < 7 && wet) return 's';
  if (wet) return edge;
  const t = wrNoise(x * 0.09, z * 0.09, R.seed + 5);
  return t > 0.7 && 'gGy'.includes(edge) ? 'y' : edge === 'G' || edge === 'g' ? (t < 0.3 ? 'G' : 'g') : edge;
}
function wrHeight(R, x, z) {
  const n = wrNear(R, x, z),
    k = smooth01((n.d - 2) / 6);
  return (
    (wrNoise(x * 0.07, z * 0.07, R.seed + 9) - 0.5) * 0.5 * k +
    (wrNoise(x * 0.02, z * 0.02, R.seed + 11) - 0.5) * 0.6 * k
  );
}
/* props along the road: a signpost at each end, benches and stones now and then, and the countryside's growth, from the
   same families and ground letters the wild-growth pass uses */
function wrProps(R, box, C) {
  const out = [],
    cat = C.props,
    nat =
      WORLD.nat ||
      (WORLD.nat = Object.entries(cat)
        .filter(([k, M]) => M.family && M.grow && M.family !== 'water')
        .map(([k, M]) => [k, M]));
  if (!nat.length) return out;
  const x0 = Math.floor(box[0]),
    z0 = Math.floor(box[1]),
    x1 = Math.ceil(box[0] + box[2]),
    z1 = Math.ceil(box[1] + box[3]);
  for (let z = z0; z < z1; z += 2)
    for (let x = x0; x < x1; x += 2) {
      const h = wrHash(x, z, R.seed + 21);
      if (h > 0.42) continue;
      const px = x + 1 + (wrHash(x, z, R.seed + 22) - 0.5) * 1.8,
        pz = z + 1 + (wrHash(x, z, R.seed + 23) - 0.5) * 1.8;
      if (wrInRect(px, pz, R.aOff, R.A) || wrInRect(px, pz, R.bOff, R.B)) continue;
      const n = wrNear(R, px, pz);
      if (n.d < 2.6) continue;
      const ch = wrTile(R, px, pz);
      if ('pwd'.includes(ch)) continue;
      const fam =
        n.d < 6
          ? h < 0.2
            ? 'ground'
            : 'flowers'
          : h < 0.07
            ? 'trees'
            : h < 0.17
              ? 'shrubs'
              : h < 0.22
                ? 'rocks'
                : h < 0.3
                  ? 'ground'
                  : 'flowers';
      const ks = nat.filter(([k, M]) => M.family === fam && M.grow.includes(ch));
      if (!ks.length) continue;
      let r = wrHash(x, z, R.seed + 24) * ks.reduce((s, [, M]) => s + (M.weight || 1), 0),
        pick = ks[0];
      for (const q of ks) {
        r -= q[1].weight || 1;
        if (r <= 0) {
          pick = q;
          break;
        }
      }
      const q = { k: pick[0], x: +px.toFixed(2), z: +pz.toFixed(2), w: 43 };
      const s = +(0.85 + wrHash(x, z, R.seed + 25) * 0.3).toFixed(2);
      if (Math.abs(s - 1) > 0.02) q.s = s;
      if (wrHash(x, z, R.seed + 26) < 0.45) q.f = 1;
      out.push(q);
    }
  /* the road's furniture: a sign at both ends, a bench or a stone every so often */
  for (let u = 28; u < R.Lr - 20; u += 36) {
    const h = wrHash(u, 1, R.seed + 31),
      p = wrAt(R, u),
      side = h < 0.5 ? 1 : -1,
      px = p.x - p.d[1] * 2.6 * side,
      pz = p.z + p.d[0] * 2.6 * side;
    if (px < box[0] || pz < box[1] || px > box[0] + box[2] || pz > box[1] + box[3]) continue;
    const k =
      h < 0.3 && cat.bench_wood
        ? 'bench_wood'
        : h < 0.5 && cat.rocks_b
          ? 'rocks_b'
          : h < 0.7 && cat.boulder_lichen
            ? 'boulder_lichen'
            : cat.stump
              ? 'stump'
              : null;
    if (k) out.push({ k, x: +px.toFixed(2), z: +pz.toFixed(2), w: 43, f: side > 0 ? 1 : 0 });
  }
  return out;
}
/* the look of a composite: the scene's own, or the two ends mixed along the road */
function wrMixHex(a, b, t) {
  const A = hexA(a),
    B = hexA(b);
  return (
    '#' +
    [0, 1, 2]
      .map(i =>
        Math.round(A[i] + (B[i] - A[i]) * t)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
      .toUpperCase()
  );
}
const WR_LOOK = [
  'sky',
  'haze',
  'hazeD',
  'cam',
  'blur',
  'amb',
  'tint',
  'far',
  'farH',
  'wind',
  'waterKind',
  'rays',
  'flatFar',
  'chat',
  'folk',
  'look',
  'dark',
  'mist',
  'cliff',
  'grass',
];
function wrLook(R, t) {
  const A = R.A,
    B = R.B,
    o = {};
  for (const k of WR_LOOK) o[k] = t < 0.5 ? A[k] : B[k];
  if (A.sky && B.sky) o.sky = A.sky.map((c, i) => wrMixHex(c, B.sky[i] || c, t));
  if (A.haze && B.haze) o.haze = wrMixHex(A.haze, B.haze, t);
  o.indoor = 0;
  o.folk = t < 0.5 ? A.folk : B.folk;
  return o;
}
function wrLookOf(S) {
  const o = {};
  for (const k of WR_LOOK) o[k] = S[k];
  o.indoor = 0;
  o.mood = dioMoodOf(S);
  o.placeId = S.place;
  /* alpha 0.2: a cave stays dark in its own view (indoor was dropped for views in v46, and the darkness with it) */ if (
    o.dark == null &&
    S.indoor &&
    S.far === 'cave'
  )
    o.dark = 1;
  return o;
}
/* alpha 0.2: the air eases from one place to the next. Within WR_LR of where two places meet, the sky, haze, darkness
   and camera are a mix of the two (half and half on the line), worked out where you stand each frame (wrLookTick), so
   the view you leave and the one you arrive in agree at the seam. Things that can't be mixed (the backdrop, the
   ambient bits in the air) stay the place's own. */
const WR_LR = 14,
  WR_MIX = ['sky', 'haze', 'hazeD', 'tint', 'dark', 'mist', 'cam', 'blur', 'wind'];
function wrLookMix(A, B, f) {
  const o = {};
  for (const k of WR_MIX) o[k] = A[k];
  if (!B || f <= 0) return o;
  const n = (a, b, d) => {
      const x = a ?? d,
        y = b ?? d;
      return x == null || y == null ? (f < 0.5 ? a : b) : x + (y - x) * f;
    },
    hx = (a, b, d) => wrMixHex(a || d, b || d, f);
  if (A.sky && B.sky) o.sky = A.sky.map((c, i) => hx(c, B.sky[i] || c, '#8CC6E6'));
  o.haze = hx(A.haze || (A.sky || [])[2], B.haze || (B.sky || [])[2], '#EAD9C0');
  o.hazeD = n(A.hazeD, B.hazeD, 34);
  o.tint =
    (A.tint && A.tint !== '#000000') || (B.tint && B.tint !== '#000000')
      ? hx(
          A.tint && A.tint !== '#000000' ? A.tint : '#7F7F7F',
          B.tint && B.tint !== '#000000' ? B.tint : '#7F7F7F',
          '#7F7F7F'
        )
      : A.tint;
  o.dark = n(A.dark, B.dark, 0);
  o.mist =
    A.mist == null && B.mist == null ? A.mist : n(A.mist, B.mist, typeof eng === 'function' ? eng('air', 'mist') : 0);
  o.blur = n(A.blur, B.blur, 1);
  o.wind = n(A.wind, B.wind, 1);
  const ca = A.cam || {},
    cb = B.cam || {};
  o.cam = Object.assign({}, ca, { pitch: n(ca.pitch, cb.pitch, 34), h: n(ca.h, cb.h, 9), fov: n(ca.fov, cb.fov, 1) });
  return o;
}
function wrLookTick() {
  const sc = DIO.sc,
    P = DIO.pl;
  if (!sc || !sc.look0 || !sc.lookSeams || !P) return;
  let best = null;
  for (const m of sc.lookSeams) {
    const u = m.v ? P.z : P.x,
      out = Math.max(m.lo - u, u - m.hi, 0);
    if (out > 6) continue;
    const d = ((m.v ? P.x : P.z) - m.at) * m.n;
    if (d < -WR_LR || d > WR_LR) continue;
    const f = (d <= 0 ? 0.5 * (1 - smooth01(-d / WR_LR)) : 0.5 + 0.5 * smooth01(d / WR_LR)) * (1 - out / 6);
    if (!best || f > best.f) best = { m, f };
  }
  const key = best ? best.m.id + ':' + best.f.toFixed(3) : '';
  if (sc._lk === key) return;
  sc._lk = key;
  Object.assign(sc, wrLookMix(sc.look0, best ? best.m.look : null, best ? best.f : 0));
}
/* v46: a composite from any number of scenes and roads laid in one frame. F = {box:[x, z, w, h] in the frame,
   scenes:[{S, id, off:[x, z], clip?, side?}] (where each scene's corner lies; alpha 0.2: a neighbour shown only where it
   meets the place has the stretch shown, clip [x0, z0, x1, z1] in the frame, and the side of the place it meets),
   roads:[{R, off:[x, z]}] (frame = road frame + off), base (the scene whose hub, exits and folk the view uses), look}.
   Inside a scene its own tiles, heights, steps and things (alpha 0.2: its eased ground, wrAdj); elsewhere the nearest
   road's ground eased to the scenes' rims, or, in a joined view (no road), countryside: the places' own edge ground
   running on a little, then their surroundings rising gently, with trees, which you can't walk into (sc.inside).
   Where two places meet, the grounds mingle over a couple of metres. Each part is recorded with where its corner lies
   in the composite (parts), so moving from one composite to another that shares a part is a shift. */
function wrComposeMulti(id, F) {
  const C = dioData().sc,
    x0 = Math.floor(F.box[0]),
    z0 = Math.floor(F.box[1]),
    w = Math.ceil(F.box[2]),
    h = Math.ceil(F.box[3]),
    parts = [],
    tiles = [],
    heights = [];
  const SS = F.scenes
    .map(q => {
      const O = [Math.round(q.off[0]) - x0, Math.round(q.off[1]) - z0];
      let K = [O[0], O[1], O[0] + q.S.w, O[1] + q.S.h];
      if (q.clip)
        K = [
          Math.max(K[0], Math.round(q.clip[0]) - x0),
          Math.max(K[1], Math.round(q.clip[1]) - z0),
          Math.min(K[2], Math.round(q.clip[2]) - x0),
          Math.min(K[3], Math.round(q.clip[3]) - z0),
        ];
      K = [Math.max(K[0], 0), Math.max(K[1], 0), Math.min(K[2], w), Math.min(K[3], h)];
      return K[2] > K[0] && K[3] > K[1]
        ? { S: q.S, id: q.id, O, K, band: !!q.clip, side: q.side || null, adj: wrAdj(q.S, q.id) }
        : null;
    })
    .filter(Boolean);
  /* alpha 0.2: an underground place (under: 1). Seen from outside it is a mountain: beyond the rock strips it grew
    (with the tunnels in them) its cave is covered by rock rising to a summit (cover). Seen from inside, the places
    round it are rock too, but for a few metres of each tunnel past where it meets them (rock); so is the countryside. */
  const UB = !!F.base.under;
  for (const q of SS) {
    const g = q.S.grown2;
    if (q.S.under && !UB && q.band && g) {
      const c = [q.O[0] + (g.W || 0), q.O[1] + (g.S || 0), q.O[0] + q.S.w - (g.E || 0), q.O[1] + q.S.h - (g.N || 0)];
      q.cover = [Math.max(c[0], q.K[0]), Math.max(c[1], q.K[1]), Math.min(c[2], q.K[2]), Math.min(c[3], q.K[3])];
    }
    if (UB && q.band && !q.S.under) q.rock = 1;
  }
  const inCover = (q, x, z) => !!q.cover && x >= q.cover[0] && z >= q.cover[1] && x < q.cover[2] && z < q.cover[3];
  const RR = F.roads.map(q => ({ R: q.R, o: [q.off[0] - x0, q.off[1] - z0] })),
    fill = !RR.length && SS.some(q => q.band); /* composite point (x, z) is road-frame point (x - o0, z - o1) */
  for (const q of SS) parts.push({ id: q.id, ox: q.O[0], oz: q.O[1], w: q.S.w, h: q.S.h });
  for (const q of RR) parts.push({ id: 'road' + q.R.i, ox: q.o[0], oz: q.o[1], road: 1 });
  const inK = (q, x, z) => x >= q.K[0] && z >= q.K[1] && x < q.K[2] && z < q.K[3],
    inS = (x, z) => {
      for (const q of SS) if (inK(q, x, z)) return q;
      return null;
    };
  const nearRoad = (x, z) => {
    let best = null;
    for (const q of RR) {
      const n = wrNear(q.R, x - q.o[0], z - q.o[1]);
      if (!best || n.d < best.n.d) best = { q, n };
    }
    return best;
  };
  const nearK = (x, z) => {
    let b = null;
    for (const q of SS) {
      const cx = clamp(x, q.K[0], q.K[2]),
        cz = clamp(z, q.K[1], q.K[3]),
        d = Math.hypot(cx - x, cz - z);
      if (!b || d < b.d) b = { q, d, cx, cz };
    }
    return b;
  };
  const tileOf = (q, i, z) => {
    const S = q.S;
    return ((S.tiles || [])[S.h - 1 - (z - q.O[1])] || '')[i - q.O[0]] || S.edge;
  };
  const B0 = SS.find(q => q.S === F.base) || SS[0];
  /* where each neighbour meets the place: the edge line (at), which way is the neighbour (n), the stretch along it */
  const seams = [];
  for (const q of SS) {
    if (!q.band || !q.side || q === B0) continue;
    const s = q.side,
      v = s === 'E' || s === 'W';
    seams.push({
      q,
      v,
      at: s === 'E' ? B0.O[0] + B0.S.w : s === 'W' ? B0.O[0] : s === 'N' ? B0.O[1] + B0.S.h : B0.O[1],
      n: s === 'E' || s === 'N' ? 1 : -1,
      lo: v ? q.K[1] : q.K[0],
      hi: v ? q.K[3] : q.K[2],
    });
  }
  /* a rock band's tunnel: where the place's exit on that side is, along it (the tunnel runs on WR_TUN m past the line) */
  for (const m of seams)
    if (m.q.rock) {
      const ex = (F.base.exits || [])
        .map(([x, z]) => [x + B0.O[0], z + B0.O[1]])
        .filter(([x, z]) => Math.abs((m.v ? x : z) - m.at) < 2.5);
      let b = null;
      for (const e of ex) {
        const u = m.v ? e[1] : e[0];
        if (u >= m.lo && u <= m.hi && (!b || Math.abs(u - (m.lo + m.hi) / 2) < Math.abs(b - (m.lo + m.hi) / 2))) b = u;
      }
      m.q.tun = { m, u: b };
    }
  const inTun = (q, x, z) => {
    const T = q.tun;
    if (!T || T.u == null) return false;
    const m = T.m,
      d = ((m.v ? x : z) - m.at) * m.n;
    return d >= 0 && d < WR_TUN && Math.abs((m.v ? z : x) - T.u) <= 1.5;
  };
  const NAT = ch => {
    const T = C.terrains[ch];
    return !!T && !T.paved && !'wdp'.includes(ch) && T.walk !== false;
  };
  /* the countryside: right by a place its own edge ground runs on a little (not paths or paving), then its surroundings */
  const fillTile = (n, x, z) => {
    const q = n.q,
      S = q.S,
      edge = S.edge || 'g',
      fx = x - q.O[0],
      fz = z - q.O[1],
      salt = wrSalt(q.id);
    if (n.d < 1.2 + 2.6 * wrNoise(fx * 0.23, fz * 0.23, salt + 1)) {
      const rim = tileOf(
          q,
          Math.floor(clamp(n.cx, q.K[0] + 0.5, q.K[2] - 0.5)),
          Math.floor(clamp(n.cz, q.K[1] + 0.5, q.K[3] - 0.5))
        ),
        T = C.terrains[rim];
      if (T && !T.paved && !'pcmbaqhe'.includes(rim)) return rim;
    }
    if ('wd'.includes(edge)) return edge;
    const u = wrNoise(fx * 0.09, fz * 0.09, salt + 5);
    return u > 0.7 && 'gGy'.includes(edge) ? 'y' : edge === 'G' || edge === 'g' ? (u < 0.3 ? 'G' : 'g') : edge;
  };
  for (let j = 0; j < h; j++) {
    let row = '';
    const z = h - 1 - j;
    for (let i = 0; i < w; i++) {
      const x = i + 0.5,
        zz = z + 0.5,
        q = inS(x, zz);
      let ch;
      if (q && (q.cover || q.rock) && (q.rock ? !inTun(q, x, zz) : inCover(q, x, zz))) {
        const n = wrNoise((x - q.O[0]) * 0.19, (zz - q.O[1]) * 0.19, wrSalt(q.id) + 43);
        ch = q.rock ? 'r' : n > 0.72 ? 'M' : n < 0.2 ? 'P' : 'r';
      } else if (q && q.rock) ch = F.base.edge || 'k';
      else if (q) {
        ch = tileOf(q, i, z);
        /* alpha 0.2: where two places meet their grounds mingle over a couple of metres (the same in every view: hashed in
      the first of the two places' own metres) */
        for (const m of seams) {
          if (m.q.cover || m.q.rock) continue;
          const u = m.v ? zz : x;
          if (u < m.lo || u > m.hi) continue;
          const d = ((m.v ? x : zz) - m.at) * m.n;
          if (Math.abs(d) >= 2.6) continue;
          const o = d < 0 ? m.q : B0,
            mi = m.v ? Math.floor(2 * m.at - x) : i,
            mz = m.v ? z : Math.floor(2 * m.at - zz);
          if (!inK(o, mi + 0.5, mz + 0.5)) break;
          const oc = tileOf(o, mi, mz);
          if (oc === ch || !NAT(ch) || !NAT(oc)) break;
          const r = m.q.id < B0.id ? m.q : B0;
          if (
            wrHash((i - r.O[0]) * 3 + 7, (z - r.O[1]) * 5 + 11, Math.round(wrSalt(m.q.id) + wrSalt(B0.id))) <
            0.5 * (1 - Math.abs(d) / 2.6)
          )
            ch = oc;
          break;
        }
      } else if (fill) ch = UB ? 'r' : fillTile(nearK(x, zz), x, zz);
      else {
        const r = nearRoad(x, zz);
        ch = r ? wrTile(r.q.R, x - r.q.o[0], zz - r.q.o[1]) : F.base.edge || 'g';
      }
      row += ch;
    }
    tiles.push(row);
  }
  /* heights: each place's own (eased near its joins); where two places meet they agree half way. Outside them the
    nearest road's noise eased to the rim over 5 m, or (joined) the rim rising gently into the countryside */
  const cH0 = (q, a, b) => {
    const A = q.adj;
    if (A) return A.G[b * (q.S.w + 1) + a];
    const r = (q.S.heights || [])[q.S.h - b];
    return r ? +r[a] || 0 : 0;
  };
  const cH = (q, a, b) => {
    if (q.rock && q.tun) {
      /* flat, at the place's own edge */ const m = q.tun.m,
        x = a + q.O[0],
        z = b + q.O[1],
        ex = m.v ? m.at - m.n * 0.01 : x,
        ez = m.v ? z : m.at - m.n * 0.01;
      return cH0(B0, clamp(Math.round(ex - B0.O[0]), 0, B0.S.w), clamp(Math.round(ez - B0.O[1]), 0, B0.S.h));
    }
    return cH0(q, a, b);
  };
  const HV = new Float32Array((w + 1) * (h + 1)),
    HS = new Uint8Array((w + 1) * (h + 1)),
    W1 = w + 1;
  for (let zc = 0; zc <= h; zc++)
    for (let i = 0; i <= w; i++) {
      let s = 0,
        n = 0;
      for (const q of SS) {
        if (i < q.K[0] || i > q.K[2] || zc < q.K[1] || zc > q.K[3]) continue;
        s += cH(q, i - q.O[0], zc - q.O[1]);
        n++;
      }
      if (n) {
        HV[zc * W1 + i] = s / n;
        HS[zc * W1 + i] = 1;
      }
    }
  for (let zc = 0; zc <= h; zc++)
    for (let i = 0; i <= w; i++) {
      const k = zc * W1 + i;
      if (HS[k]) continue;
      const n = nearK(i, zc),
        rim = n ? HV[Math.round(n.cz) * W1 + Math.round(n.cx)] : 0;
      let v; /* (a road's middle may hold no place at all) */
      if (fill) {
        const q = n.q;
        v =
          rim +
          ('wd'.includes(q.S.edge || 'g')
            ? 0
            : smooth01((n.d - 1) / 9) *
              (0.8 + 1.8 * wrNoise((i - q.O[0]) * 0.07, (zc - q.O[1]) * 0.07, wrSalt(q.id) + 9)));
      } else {
        const rd = nearRoad(i, zc);
        v = rd ? wrHeight(rd.q.R, i - rd.q.o[0], zc - rd.q.o[1]) : 0;
        if (n && n.d < 6) v = rim + (v - rim) * smooth01(n.d / 5);
      }
      HV[k] = v;
    }
  for (let r = 0; r <= h; r++) {
    const zc = h - r,
      row = new Array(W1);
    for (let i = 0; i <= w; i++) row[i] = +HV[zc * W1 + i].toFixed(2);
    heights.push(row);
  }
  const sc = {
    name: F.base.name,
    w,
    h,
    edge: F.base.edge || 'g',
    tiles,
    heights,
    props: [],
    exits: [],
    hub: null,
    parts,
    comp: {
      road: RR.length === 1 ? RR[0].R.i : (F.road ?? null),
      roads: RR.map(q => q.R.i),
      box: [x0, z0, w, h],
      hubOf: F.hubOf ?? null,
      joined: fill ? 1 : 0,
    },
    indoor: 0,
  };
  Object.assign(sc, F.look || wrLookOf(F.base));
  sc.name = F.base.name;
  /* each place's things; of a neighbour only what stands in the stretch shown */
  const mv = q => {
    if (q.rock) return;
    const S = q.S,
      O = q.O,
      K = q.K,
      band = q.band,
      inq0 = (x, z) => x >= K[0] && z >= K[1] && x <= K[2] && z <= K[3],
      inq = q.cover ? (x, z) => inq0(x, z) && !inCover(q, x, z) : inq0,
      tr = (x, z) => [+(x + O[0]).toFixed(2), +(z + O[1]).toFixed(2)],
      anyIn = pts => pts.some(([x, z]) => inq(x + O[0], z + O[1]));
    for (const p of S.props || []) {
      const x = +(p.x + O[0]).toFixed(2),
        z = +(p.z + O[1]).toFixed(2);
      if (band ? !inq(x, z) : !(x >= -2 && z >= -2 && x <= w + 2 && z <= h + 2)) continue;
      const c = Object.assign({}, p);
      c.x = x;
      c.z = z;
      sc.props.push(c);
    }
    for (const k of ['streams', 'rails'])
      if (S[k])
        sc[k] = (sc[k] || []).concat(
          S[k]
            .filter(o => !band || anyIn(o.pts))
            .map(o => Object.assign({}, o, { pts: o.pts.map(([x, z]) => tr(x, z)) }))
        );
    for (const k of ['bridges', 'escalators'])
      if (S[k])
        sc[k] = (sc[k] || []).concat(
          S[k]
            .filter(o => !band || anyIn([o.a, o.b]))
            .map(o => Object.assign({}, o, { a: tr(o.a[0], o.a[1]), b: tr(o.b[0], o.b[1]) }))
        );
    if (S.arches)
      sc.arches = (sc.arches || []).concat(
        S.arches
          .filter(o => !band || inq(o.x + O[0], o.z + O[1]))
          .map(o => Object.assign({}, o, { x: o.x + O[0], z: o.z + O[1] }))
      );
    if (S.waters)
      sc.waters = (sc.waters || []).concat(
        S.waters
          .map(o => {
            const c = Object.assign({}, o, { x: o.x + O[0], z: o.z + O[1] });
            if (band) {
              const a = Math.max(c.x, K[0]),
                b = Math.max(c.z, K[1]),
                e = Math.min(c.x + (c.w || 0), K[2]),
                f = Math.min(c.z + (c.h || 0), K[3]);
              if (e <= a || f <= b) return null;
              Object.assign(c, { x: a, z: b, w: e - a, h: f - b });
            }
            return c;
          })
          .filter(Boolean)
      );
    if (S.life && !q.cover)
      sc.life = (sc.life || []).concat(
        S.life
          .map(o => {
            const q = Object.assign({}, o);
            if (o.area) q.area = [o.area[0] + O[0], o.area[1] + O[1], o.area[2] + O[0], o.area[3] + O[1]];
            else if (o.k !== 'duck' && o.k !== 'car') q.area = [O[0] + 1, O[1] + 1, O[0] + S.w - 1, O[1] + S.h - 1];
            if (o.path) q.path = o.path.map(([x, z]) => tr(x, z));
            if (band) {
              if (o.path || !q.area) return null;
              const Z = q.area,
                A = [
                  Math.max(Z[0], K[0] + 1),
                  Math.max(Z[1], K[1] + 1),
                  Math.min(Z[2], K[2] - 1),
                  Math.min(Z[3], K[3] - 1),
                ];
              if (A[2] - A[0] < 6 || A[3] - A[1] < 6) return null;
              q.n = Math.max(
                1,
                Math.round(((q.n || 1) * (A[2] - A[0]) * (A[3] - A[1])) / Math.max(1, (Z[2] - Z[0]) * (Z[3] - Z[1])))
              );
              q.area = A;
            }
            return q;
          })
          .filter(Boolean)
      );
    if (S.npcSpots && !band)
      sc.npcSpots = (sc.npcSpots || []).concat(S.npcSpots.map(q => (Array.isArray(q) ? tr(q[0], q[1]) : q)));
    if (S.cliff && !sc.cliff) sc.cliff = S.cliff;
    if (S.ride && !band) sc.ride = S.ride;
    if (S.wallCol && !sc.wallCol) sc.wallCol = S.wallCol;
  };
  for (const q of SS) mv(q);
  /* the base scene's hub and exits (where the labels and the walk-in go) */
  const BO = B0 ? B0.O : [0, 0];
  sc.hub = F.base.hub ? [F.base.hub[0] + BO[0], F.base.hub[1] + BO[1]] : [w / 2, h / 2];
  sc.exits = (F.base.exits || []).map(([x, z]) => [+(x + BO[0]).toFixed(2), +(z + BO[1]).toFixed(2)]);
  sc.baseOff = BO;
  sc.baseId = B0 ? B0.id : null;
  /* steps (cliffs, terraces, stairs) on the half-metre grid, copied in place (alpha 0.2: the eased ones; the countryside
    carries on the rim's raise, so a place up on a shelf doesn't end in a drop) */
  const E = {
      s: '@' + id,
      m0: '@' + id,
      w: w * 2,
      h: h * 2,
      H: new Float32Array(w * 4 * h),
      M: new Uint8Array(w * 4 * h),
    },
    EK = new Uint8Array(w * 4 * h);
  let anyS = false;
  for (const q of SS) {
    const SE = (q.adj && q.adj.E) || dioSteps(q.S),
      ox = q.O[0] * 2,
      oz = q.O[1] * 2;
    if (SE) anyS = true;
    for (let jj = Math.max(0, q.K[1] * 2); jj < Math.min(E.h, q.K[3] * 2); jj++) {
      const j = jj - oz;
      for (let ii = Math.max(0, q.K[0] * 2); ii < Math.min(E.w, q.K[2] * 2); ii++) {
        const i = ii - ox,
          k = jj * E.w + ii;
        if (EK[k]) continue;
        EK[k] = 1;
        if (!SE || i < 0 || j < 0 || i >= SE.w || j >= SE.h) continue;
        E.H[k] = SE.H[j * SE.w + i];
        E.M[k] = SE.M[j * SE.w + i];
      }
    }
  }
  /* the mountain's rock and the rock round a cave (cave rock, so its faces read as the cave's) */
  for (const q of SS) {
    if (!q.cover && !q.rock) continue;
    anyS = true;
    for (let jj = Math.max(0, q.K[1] * 2); jj < Math.min(E.h, q.K[3] * 2); jj++)
      for (let ii = Math.max(0, q.K[0] * 2); ii < Math.min(E.w, q.K[2] * 2); ii++) {
        const x = (ii + 0.5) / 2,
          z = (jj + 0.5) / 2,
          k = jj * E.w + ii;
        if (q.rock) {
          /* the rock carries on the place's own rock at the line (and a tunnel's floor) */ const m = q.tun.m,
            ex = m.v ? m.at - m.n * 0.25 : x,
            ez = m.v ? z : m.at - m.n * 0.25,
            r = Math.floor(ez * 2) * E.w + Math.floor(ex * 2);
          if (inTun(q, x, z)) {
            E.H[k] = E.H[r] || 0;
            E.M[k] = 32;
          } else {
            E.H[k] = Math.max(WR_ROCK, E.H[r] || 0);
            E.M[k] = 35;
          }
        } else if (inCover(q, x, z)) {
          /* over the cave the rock climbs on from the strip round it to a summit */ const c = q.cover,
            ds = [x - c[0], c[2] - x, z - c[1], c[3] - z],
            m = ds.indexOf(Math.min(...ds)),
            d = ds[m],
            bx = m === 0 ? c[0] - 0.25 : m === 1 ? c[2] + 0.25 : x,
            bz = m === 2 ? c[1] - 0.25 : m === 3 ? c[3] + 0.25 : z;
          const bi = Math.floor(bx * 2),
            bj = Math.floor(bz * 2),
            inside =
              bx >= q.K[0] && bx < q.K[2] && bz >= q.K[1] && bz < q.K[3] && bi >= 0 && bj >= 0 && bi < E.w && bj < E.h,
            b = inside && EK[bj * E.w + bi] ? E.H[bj * E.w + bi] : WR_ROCK + 3;
          E.H[k] =
            Math.round(
              (Math.max(WR_ROCK, b) + smooth01(d / 16) * (4 + 6 * wrNoise(x * 0.06, z * 0.06, wrSalt(q.id) + 47))) * 20
            ) / 20;
          E.M[k] = 35;
        }
      }
  }
  if (anyS && fill)
    for (let jj = 0; jj < E.h; jj++)
      for (let ii = 0; ii < E.w; ii++) {
        const k = jj * E.w + ii;
        if (EK[k]) continue;
        const n = nearK((ii + 0.5) / 2, (jj + 0.5) / 2),
          ci = clamp(Math.floor(n.cx * 2), n.q.K[0] * 2, n.q.K[2] * 2 - 1),
          cj = clamp(Math.floor(n.cz * 2), n.q.K[1] * 2, n.q.K[3] * 2 - 1),
          r = cj * E.w + ci;
        E.H[k] = UB ? Math.max(WR_ROCK, E.H[r]) : E.H[r];
        E.M[k] = UB ? 35 : E.M[r] & 15;
      }
  if (anyS) {
    sc.steps = E.s;
    sc.stepm = E.m0;
    sc.stepsV = 1;
    DIO_STEPS.set(sc, E);
  }
  /* the roads' countryside and furniture, kept off every scene in the view */
  for (const q of RR) {
    for (const p of wrProps(q.R, [-q.o[0], -q.o[1], w, h], C)) {
      const x = +(p.x + q.o[0]).toFixed(2),
        z = +(p.z + q.o[1]).toFixed(2);
      if (inS(x, z)) continue;
      const r = nearRoad(x, z);
      if (r && r.q !== q) continue;
      sc.props.push(Object.assign(p, { x, z }));
    }
  }
  /* alpha 0.2: the countryside's growth, thicker away from the places (trees frame the view) */
  if (fill && !UB) {
    const nat =
      WORLD.nat ||
      (WORLD.nat = Object.entries(C.props)
        .filter(([k, M]) => M.family && M.grow && M.family !== 'water')
        .map(([k, M]) => [k, M]));
    for (let z = 0; z < h; z += 2)
      for (let x = 0; x < w; x += 2) {
        const n = nearK(x + 1, z + 1);
        if (n.d < 1.6 || n.d > 8) continue;
        const q = n.q,
          fx = x - q.O[0],
          fz = z - q.O[1],
          sl = wrSalt(q.id) | 0,
          hh = wrHash(fx, fz, sl + 21);
        if (hh > 0.3) continue;
        const px = x + 1 + (wrHash(fx, fz, sl + 22) - 0.5) * 1.6,
          pz = z + 1 + (wrHash(fx, fz, sl + 23) - 0.5) * 1.6;
        if (inS(px, pz) || px < 0 || pz < 0 || px > w || pz > h) continue;
        const ch = (tiles[h - 1 - Math.floor(pz)] || '')[Math.floor(px)];
        if (!ch || 'pwd'.includes(ch) || (C.terrains[ch] || {}).paved) continue;
        const fam =
          n.d < 3.5
            ? hh < 0.18
              ? 'ground'
              : 'flowers'
            : hh < 0.16
              ? 'trees'
              : hh < 0.25
                ? 'shrubs'
                : hh < 0.29
                  ? 'rocks'
                  : hh < 0.36
                    ? 'ground'
                    : 'flowers';
        const ks = nat.filter(([k, M]) => M.family === fam && M.grow.includes(ch));
        if (!ks.length) continue;
        let rr = wrHash(fx, fz, sl + 24) * ks.reduce((s, [, M]) => s + (M.weight || 1), 0),
          pick = ks[0];
        for (const c of ks) {
          rr -= c[1].weight || 1;
          if (rr <= 0) {
            pick = c;
            break;
          }
        }
        const o = { k: pick[0], x: +px.toFixed(2), z: +pz.toFixed(2), w: 43 },
          s = +(0.85 + wrHash(fx, fz, sl + 25) * 0.3).toFixed(2);
        if (Math.abs(s - 1) > 0.02) o.s = s;
        if (wrHash(fx, fz, sl + 26) < 0.45) o.f = 1;
        sc.props.push(o);
      }
  }
  /* the mountain over an underground place: boulders, heather and the odd stunted tree on its slopes */
  for (const q of SS) {
    if (!q.cover) continue;
    const nat =
        WORLD.nat ||
        (WORLD.nat = Object.entries(C.props)
          .filter(([k, M]) => M.family && M.grow && M.family !== 'water')
          .map(([k, M]) => [k, M])),
      sl = wrSalt(q.id) | 0;
    for (let z = Math.ceil(q.cover[1]); z < q.cover[3] - 1; z += 3)
      for (let x = Math.ceil(q.cover[0]); x < q.cover[2] - 1; x += 3) {
        const fx = x - q.O[0],
          fz = z - q.O[1],
          hh = wrHash(fx, fz, sl + 61);
        if (hh > 0.3) continue;
        const px = x + 1.5 + (wrHash(fx, fz, sl + 62) - 0.5) * 2,
          pz = z + 1.5 + (wrHash(fx, fz, sl + 63) - 0.5) * 2;
        if (!inCover(q, px, pz)) continue;
        const ch = (tiles[h - 1 - Math.floor(pz)] || '')[Math.floor(px)],
          fam = hh < 0.06 ? 'trees' : hh < 0.17 ? 'rocks' : hh < 0.24 ? 'shrubs' : 'ground',
          ks = nat.filter(([k, M]) => M.family === fam && M.grow.includes(ch));
        if (!ks.length) continue;
        const pick = ks[Math.floor(wrHash(fx, fz, sl + 64) * ks.length) % ks.length];
        const o = { k: pick[0], x: +px.toFixed(2), z: +pz.toFixed(2), w: 43 };
        if (wrHash(fx, fz, sl + 65) < 0.45) o.f = 1;
        sc.props.push(o);
      }
  }
  /* you walk in the places, not out into the countryside */
  if (fill) sc.inside = SS.map(q => q.K.slice());
  /* the air of each neighbour, for easing it in near the line (wrLookTick) */
  if (fill) {
    sc.look0 = wrLookMix(sc, null, 0);
    sc.lookSeams = seams.map(m => ({
      id: m.q.id,
      v: m.v,
      at: m.at,
      n: m.n,
      lo: m.lo,
      hi: m.hi,
      look: wrLookOf(m.q.S),
    }));
  }
  sc.under = UB ? 1 : 0;
  /* v46: where each spot's ground pattern comes from, so it is the same in every view: a scene's own metres inside it,
    the road's frame on the road (the painter, walk-view.js, seeds its variants and noise from these) */
  sc.stable = {
    scenes: SS.map(q => ({
      id: q.id,
      x: q.O[0],
      z: q.O[1],
      w: q.S.w,
      h: q.S.h,
      clip: q.band ? q.K.slice() : null,
      salt: wrSalt(q.id),
      hub: q.S.hub || null,
      exits: q.S.exits || [],
      worn: q.S.worn || null,
    })),
    roads: RR.map(q => ({ o: q.o, R: q.R, salt: wrSalt('road' + q.R.i) })),
  };
  return sc;
}
function wrSalt(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 131 + ch.charCodeAt(0)) % 100003;
  return (h * 7.31) % 997;
}
/* a window of one road (the long ones' middle) */
function wrCompose(id, R, box, base, t) {
  return wrComposeMulti(id, {
    box,
    scenes: [
      { S: R.A, id: R.aId, off: R.aOff },
      { S: R.B, id: R.bId, off: R.bOff },
    ],
    roads: [{ R, off: [0, 0] }],
    base,
    look: wrLook(R, t),
    road: R.i,
  });
}
/* v46: a place's hub view: the scene with the first stretch of every road leaving it (and whatever of the next scene
   that reaches), in the scene's own metres. You roam in it without a single switch; a trip leaves it only when the
   road runs on past what it holds. */
const WR_HUBL = 36;
function wrHubParts(node) {
  const sid = sceneIdAt(node),
    S = dioScene(sid);
  if (!S) return null;
  const scenes = [{ S, id: sid, off: [0, 0] }],
    roads = [],
    bands = [];
  let x0 = 0,
    z0 = 0,
    x1 = S.w,
    z1 = S.h;
  for (const e of ADJ[node]) {
    const J = wrJoin(e.i);
    if (J) {
      const atA = J.a === node,
        nid = atA ? J.bId : J.aId;
      if (nid === sid) continue;
      const ex = atA ? J.ea : J.eb;
      bands.push({
        S: atA ? J.B : J.A,
        id: nid,
        off: atA ? J.off.slice() : [-J.off[0], -J.off[1]],
        side: ex.side,
        at: ex.side === 'E' || ex.side === 'W' ? ex.p[1] : ex.p[0],
      });
      continue;
    }
    const R = wrRoad(e.i);
    if (!R) continue;
    const atA = R.a === node,
      So = atA ? R.aOff : R.bOff;
    roads.push({ R, off: [-So[0], -So[1]] });
    const No = atA ? R.bOff : R.aOff,
      N = atA ? R.B : R.A,
      nid = atA ? R.bId : R.aId;
    if (nid !== sid) scenes.push({ S: N, id: nid, off: [No[0] - So[0], No[1] - So[1]] });
    for (let k = 0; k <= WR_HUBL; k += 3) {
      const u = atA ? Math.min(R.Lr, k) : Math.max(0, R.Lr - k),
        p = wrAt(R, u),
        x = p.x - So[0],
        z = p.z - So[1];
      x0 = Math.min(x0, x - WORLD.BAND);
      z0 = Math.min(z0, z - WORLD.BAND);
      x1 = Math.max(x1, x + WORLD.BAND);
      z1 = Math.max(z1, z + WORLD.BAND);
    }
  }
  /* alpha 0.2: each neighbour shows where it meets the place, WR_JW either side of its exit (past the place's corner
    too, so the view you leave and the one you arrive in agree round the exit); two on one side share it half and half,
    and where two bands would meet beyond a corner each stops at the corner */
  const clips = [];
  for (const s of ['E', 'W', 'N', 'S']) {
    const bs = bands.filter(b => b.side === s).sort((a, b) => a.at - b.at);
    bs.forEach((b, k) => {
      let lo = b.at - WR_JW,
        hi = b.at + WR_JW;
      if (k > 0) lo = Math.max(lo, (bs[k - 1].at + b.at) / 2);
      if (k < bs.length - 1) hi = Math.min(hi, (b.at + bs[k + 1].at) / 2);
      clips.push({ b, s, lo, hi });
    });
  }
  const rect = c =>
    c.s === 'E'
      ? [S.w, c.lo, S.w + WR_JD, c.hi]
      : c.s === 'W'
        ? [-WR_JD, c.lo, 0, c.hi]
        : c.s === 'N'
          ? [c.lo, S.h, c.hi, S.h + WR_JD]
          : [c.lo, -WR_JD, c.hi, 0];
  for (const c of clips)
    for (const d of clips) {
      if (c === d) continue;
      const a = rect(c),
        e = rect(d);
      if (Math.min(a[2], e[2]) > Math.max(a[0], e[0]) && Math.min(a[3], e[3]) > Math.max(a[1], e[1])) {
        const sp = c.s === 'E' || c.s === 'W' ? S.h : S.w;
        c.lo = Math.max(c.lo, 0);
        c.hi = Math.min(c.hi, sp);
      }
    }
  for (const c of clips) {
    const clip = rect(c);
    scenes.push({ S: c.b.S, id: c.b.id, off: c.b.off, clip, side: c.s });
    x0 = Math.min(x0, clip[0]);
    z0 = Math.min(z0, clip[1]);
    x1 = Math.max(x1, clip[2]);
    z1 = Math.max(z1, clip[3]);
  }
  const M = bands.length && !roads.length ? 6 : 0,
    bx = Math.floor(x0 - M),
    bz = Math.floor(z0 - M); /* (the camera stops 2 m past a view's edge: 6 m of countryside round it is enough) */
  return { box: [bx, bz, Math.ceil(x1 + M) - bx, Math.ceil(z1 + M) - bz], scenes, roads, base: S, hubOf: node };
}
export function wrHubScene(node) {
  const sid = sceneIdAt(node),
    id = 'w:' + sid + '*',
    key = id + '|' + WORLD.gen;
  let sc = WORLD.cache.get(key);
  if (sc) return sc;
  const F = wrHubParts(node);
  if (!F) return null;
  sc = wrComposeMulti(id, F);
  sc.id = id;
  WORLD.cache.set(key, sc);
  wrTrim();
  return sc;
}
function wrTrim() {
  while (WORLD.cache.size > WORLD.max + LINKS.length) {
    let k0 = null;
    for (const k of WORLD.cache.keys())
      if (!k.startsWith('road')) {
        k0 = k;
        break;
      }
    if (!k0) break;
    WORLD.cache.delete(k0);
  }
}
/* the view for a place on a road: the near end's hub, the far end's hub, or a window in between */
function wrViewFor(R, u, endOnly) {
  const LW = WORLD.LW,
    two = R.Lr <= 2 * LW - 8,
    cut = two ? R.Lr / 2 : 24;
  if (endOnly === 'a' || (!endOnly && u <= cut))
    return { id: 'w:' + R.aId + '*', hub: R.a, off: R.aOff, base: R.A, t: 0 };
  if (endOnly === 'b' || (!endOnly && u >= R.Lr - cut))
    return { id: 'w:' + R.bId + '*', hub: R.b, off: R.bOff, base: R.B, t: 1 };
  const M = WORLD.MID,
    k = Math.round(u / 24),
    p = wrAt(R, k * 24);
  return {
    id: 'w:road' + R.i + '@' + k,
    box: [p.x - M / 2, p.z - M / 2, M, M],
    base: u < R.Lr / 2 ? R.A : R.B,
    t: u / R.Lr,
    mid: [p.x, p.z],
    off: [0, 0],
  };
}
function wrScene(view, R) {
  if (view.hub != null) return wrHubScene(view.hub);
  const key = view.id + '|' + WORLD.gen;
  let sc = WORLD.cache.get(key);
  if (sc) return sc;
  sc = wrCompose(view.id, R, view.box, view.base, view.t);
  sc.id = view.id;
  if (view.mid) {
    sc.hub = [view.mid[0] - sc.comp.box[0], view.mid[1] - sc.comp.box[1]];
    sc.folk = 0;
    sc.exits = [];
    sc.edgeExits = null;
  }
  WORLD.cache.set(key, sc);
  wrTrim();
  return sc;
}
/* a composite by id, for dioScene(): "w:<scene>*" (a place's hub), "w:road<link>@<k>" (a road's middle); the v43 ids
   "w:<scene>><link>" and "w:<scene><<link>" now mean the hub */
function wrSceneById(id) {
  if (!id || !id.startsWith('w:')) return null;
  for (const [k, v] of WORLD.cache) if (k === id + '|' + WORLD.gen) return v;
  let m = id.match(/^(w:.+)#([^@#]+)@(-?[\d.]+),(-?[\d.]+)(?:,(-?[\d.]+))?$/);
  if (m) return wrRoomScene(m[1], m[2], m[5] != null ? [+m[3], +m[4], +m[5]] : [+m[3], +m[4]]);
  m = id.match(/^w:road(\d+)@(-?\d+)$/);
  if (m) {
    const R = wrRoad(+m[1]);
    if (!R) return null;
    return wrScene(wrViewFor(R, +m[2] * 24), R);
  }
  m = id.match(/^w:(.+?)(\*|[<>]\d+)$/);
  if (!m) return null;
  const node = ROUTE.findIndex(r => r.scene === m[1]);
  return node >= 0 ? wrHubScene(node) : null;
}
/* v46: seamless rooms. Walking into a building doesn't leave the place: the room is laid into the place's own view
   where the building stands, larger than the building (as in classic RPGs), with its door at the building's door.
   Everything else of the place stays, dimmed (the room box in the light, walk-view-gl.js); the building itself and what
   stands on the room's floor or just in front of it are left out while you're inside. The view shares the place's
   parts, so going in and out is a shift of nothing: you never leave where you were.
   id: "<the place's view>#<room scene>@<door x>,<door z>" */
/* where the room goes: centred on the building (door[2], its middle), so a door left of the middle outside is left of
   the middle inside too; its doorway is then moved to lie exactly at the building's door */
const WR_ROOM_GAP = { station: 2.6, fire_station: 3.2, market_hall: 3, barn: 3 };
/* alpha 0.1: a room shows the building's own windows. As many as its front has (a column of windows counts once, a
   window in the roof not at all), where they are along the front as you see it from the street, the wide ones wider,
   on the room's back wall. Each slides along the wall to the nearest spot no furniture stands in front of (or is left
   out), and pictures, clocks and boards on that wall step aside for them. A room with winMatch: 0 keeps its own. */
const WR_WIN = { k: 'wall_window', w: 1.5, y0: 1.3 },
  WR_DECO = /^(wall_clock|wall_painting|wall_map|blackboard|timetable_board)$/;
function wrBldWindows(M, p, ppu) {
  const B = M.build || {},
    eave = B.eave,
    cols = [],
    rects = (B.win || []).map(r => r.slice(0, 4));
  for (const f of M.fx || [])
    if (
      f.k === 'window' &&
      !rects.some(([x, y, w, h]) => f.x >= x - 2 && f.x <= x + w + 2 && f.y >= y - 2 && f.y <= y + h + 2)
    )
      rects.push([f.x - 8, f.y - 8, 16, 16]);
  for (const [x, y, w, h] of rects) {
    if (eave != null && y + h < eave) continue;
    const cx = x + w / 2,
      c = cols.find(c => Math.abs(c.cx - cx) < 6);
    if (c) c.w = Math.max(c.w, w);
    else cols.push({ cx, w });
  }
  const half = M.box ? (M.box[0] * ppu) / 2 : 60,
    [w0, w1] = B.wall || [-half, half];
  return cols
    .map(c => {
      const u = clamp((c.cx - w0) / (w1 - w0), 0.04, 0.96);
      return { u: p.f ? 1 - u : u, w: c.w };
    })
    .sort((a, b) => a.u - b.u);
}
function wrRoomWindows(props, r0, R, C, BM, bp, ox, oz) {
  const ppu = C.ppu || 34,
    room = props.slice(r0),
    wins = wrBldWindows(BM, bp, ppu),
    tan = Math.tan(((((R.cam && R.cam.pitch) || 34) - 3 + 12) * Math.PI) / 180); /* the room camera's tilt */
  const own = room.filter(q => q.k === WR_WIN.k),
    zw = own.length ? own[0].z : +(oz + R.h - 1.55).toFixed(2),
    xa = ox + 1.3,
    xb = ox + R.w - 1.3;
  const ext = q => {
    const M = C.props[q.k] || {},
      s = (q.s || 1) / ppu,
      hw = Math.max(0.1, -(M.ox ?? -16) * s * 0.92),
      bw = M.box ? (M.box[0] * (q.s || 1)) / 2 : hw;
    return { x0: q.x - hw, x1: q.x + hw, top: -(M.oy ?? -32) * s, bw, bd: M.box ? M.box[1] * (q.s || 1) : 0.5 };
  };
  const deco = room.filter(q => WR_DECO.test(q.k) && Math.abs(q.z - zw) < 0.3),
    furn = room.filter(
      q => q.k !== WR_WIN.k && !deco.includes(q) && q.z < zw + 0.3 && q.z > zw - 4.5 && !(C.props[q.k] || {}).flat
    );
  const hides = (q, x, s) => {
    const e = ext(q),
      hw = (WR_WIN.w * s) / 2;
    return (
      Math.min(e.x1, x + hw) - Math.max(e.x0, x - hw) > 0.2 &&
      e.top - Math.max(0, zw - q.z) * tan > WR_WIN.y0 * s + 0.12
    );
  };
  /* the windows where the front has them; furniture against the back wall that would stand in front of one slides
    along the wall to a free stretch; what can't, the window slides past (keeping the windows' order), or is left out */
  const W = wins.map(w => {
    const s = clamp(w.w / 20, 0.85, 1.3);
    return { x: xa + w.u * (xb - xa), s, hw: (WR_WIN.w * s) / 2 };
  });
  /* two windows close together on the front (a double window) are one wide window inside */
  for (let i = 1; i < W.length; i++) {
    const a = W[i - 1],
      b = W[i];
    if (b.x - a.x < a.hw + b.hw + 0.25) {
      const x0 = a.x - a.hw,
        x1 = b.x + b.hw,
        s = clamp((x1 - x0) / WR_WIN.w, 0.85, 1.3);
      W.splice(i - 1, 2, { x: (x0 + x1) / 2, s, hw: (WR_WIN.w * s) / 2 });
      i--;
    }
  }
  const back = q => q.z > zw - 1.25,
    freeFor = (q, x) => {
      const e = ext(q);
      if (x - e.bw < xa - 0.4 || x + e.bw > xb + 0.4) return false;
      const at = Object.assign({}, q, { x });
      if (W.some(w => !w.gone && hides(at, w.x, w.s))) return false;
      return !furn.some(
        o => o !== q && Math.abs(o.x - x) < ext(o).bw + e.bw + 0.1 && Math.abs(o.z - q.z) < (ext(o).bd + e.bd) / 2 + 0.1
      );
    };
  for (const w of W) {
    for (const q of furn) {
      if (!hides(q, w.x, w.s) || !back(q)) continue;
      let to = null;
      for (let k = 1; k <= 40 && to == null; k++)
        for (const sg of [1, -1]) {
          const x = +(q.x + sg * k * 0.25).toFixed(2);
          if (freeFor(q, x)) {
            to = x;
            break;
          }
        }
      if (to != null) q.x = to;
    }
    if (!furn.some(q => hides(q, w.x, w.s))) continue;
    const i = W.indexOf(w),
      lo = i ? W[i - 1].x + W[i - 1].hw + w.hw + 0.25 : xa + w.hw - 0.3,
      hi = i < W.length - 1 ? W[i + 1].x - W[i + 1].hw - w.hw - 0.25 : xb - w.hw + 0.3;
    let at = null;
    for (let k = 1; k <= 10 && at == null; k++)
      for (const sg of [1, -1]) {
        const x = w.x + sg * k * 0.25;
        if (x < lo || x > hi || furn.some(q => hides(q, x, w.s))) continue;
        at = x;
        break;
      }
    if (at != null) w.x = at;
    else w.gone = 1;
  }
  for (let i = props.length - 1; i >= r0; i--) if (props[i].k === WR_WIN.k) props.splice(i, 1);
  const placed = W.filter(w => !w.gone);
  for (const o of placed) props.push({ k: WR_WIN.k, x: +o.x.toFixed(2), z: zw, s: +o.s.toFixed(2) });
  const dw = q => (ext(q).x1 - ext(q).x0) / 2,
    behind = (q, x) =>
      furn.some(f => {
        const e = ext(f);
        return (
          Math.min(e.x1, x + dw(q)) - Math.max(e.x0, x - dw(q)) > 0.2 &&
          e.top - Math.max(0, zw - f.z) * tan > WR_WIN.y0 + 0.2
        );
      }),
    clash = (q, x) =>
      placed.some(o => Math.abs(o.x - x) < o.hw + dw(q) + 0.15) ||
      deco.some(o => o !== q && props.includes(o) && Math.abs(o.x - x) < dw(o) + dw(q) + 0.15) ||
      (x !== q.x && behind(q, x));
  for (const q of deco) {
    if (!clash(q, q.x)) continue;
    let to = null;
    for (let k = 1; k <= 44 && to == null; k++)
      for (const sg of [1, -1]) {
        const x = q.x + sg * k * 0.25;
        if (x - dw(q) >= xa && x + dw(q) <= xb && !clash(q, x)) {
          to = x;
          break;
        }
      }
    if (to != null) q.x = +to.toFixed(2);
    else props.splice(props.indexOf(q), 1);
  }
}
function wrRoomPlace(B, R, door) {
  const mid = door[2] ?? door[0];
  let ox = Math.round(mid - R.w / 2),
    oz = Math.round(door[1] - ((R.exits && R.exits[0]) || [0, 0.6])[1]);
  ox = clamp(ox, Math.ceil(door[0] - (R.w - 2.2)), Math.floor(door[0] - 2.2));
  ox = clamp(ox, 0, Math.max(0, B.w - R.w));
  oz = clamp(oz, 0, Math.max(0, B.h - R.h));
  return [ox, oz];
}
export function wrRoomId(baseId, roomId, door) {
  return baseId + '#' + roomId + '@' + door.map(v => (+v).toFixed(1)).join(',');
}
export function wrRoomScene(baseId, roomId, door) {
  const id = wrRoomId(baseId, roomId, door),
    key = id + '|' + WORLD.gen;
  let sc = WORLD.cache.get(key);
  if (sc) return sc;
  const B0 = dioScene(baseId),
    R = dioScene(roomId);
  if (!B0 || !B0.w || !R || !R.w) return null;
  const C = dioData().sc,
    [rx, rz] = wrRoomPlace(B0, R, door);
  /* only a window of the place round the room is made again (the rest isn't seen from inside): far less to prepare */
  let B = B0,
    cx = 0,
    cz = 0;
  const F = B0.comp && B0.comp.hubOf != null ? wrHubParts(B0.comp.hubOf) : null;
  if (F) {
    const x0 = Math.max(0, rx - 18),
      z0 = Math.max(0, rz - 14),
      x1 = Math.min(B0.w, rx + R.w + 18),
      z1 = Math.min(B0.h, rz + R.h + 20);
    if ((x1 - x0) * (z1 - z0) < B0.w * B0.h * 0.8) {
      cx = x0;
      cz = z0;
      B = wrComposeMulti(id, Object.assign({}, F, { box: [F.box[0] + x0, F.box[1] + z0, x1 - x0, z1 - z0] }));
    }
  }
  const ox = rx - cx,
    oz = rz - cz,
    W = B.w,
    H = B.h;
  /* each building's room is its own: mirrored or not and a wall colour picked by where its door is (not your room, or a room set to stay as made) */
  const vs = wrHash(Math.round(door[0] * 10), Math.round(door[1] * 10), 977),
    vary = R.room !== 'home' && R.vary !== 0,
    mir = vary && vs < 0.5,
    mx = x => (mir ? R.w - x : x),
    WALLS = ['#E6CFA2', '#D9B79C', '#DCD2BC', '#E4D3B8', '#CBD6DC', '#E8CDBA', '#D8CCDC', '#D2DCC4'];
  /* the doorway, in the room's own metres: right where the building's door is */
  const ex = clamp(door[0] - cx - ox, 2.2, R.w - 2.2),
    gap = WR_ROOM_GAP[R.building] || WR_ROOM_GAP[R.room] || 2,
    fl = (() => {
      const n = {};
      for (const ch of (R.tiles || [])[Math.floor(R.h / 2)] || '') n[ch] = (n[ch] || 0) + 1;
      return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || R.edge || 'b';
    })();
  /* ground: the room's floor in its rectangle (rows run from the far side down) */
  const tiles = (B.tiles || []).slice();
  for (let lz = 0; lz < R.h; lz++) {
    const j = H - 1 - (oz + lz),
      row = tiles[j];
    if (row == null) continue;
    const rr = (R.tiles || [])[R.h - 1 - lz] || '';
    let out = '';
    for (let i = 0; i < R.w; i++) {
      let ch = rr[mir ? R.w - 1 - i : i] || R.edge || 'b';
      if (ch === 'q') ch = fl;
      if (lz <= 1 && i + 0.5 > ex - gap / 2 && i + 0.5 < ex + gap / 2) ch = 'q';
      out += ch;
    }
    tiles[j] = row.slice(0, ox) + out + row.slice(ox + R.w);
  }
  /* heights: the floor lies flat at the door's height */
  const hv = (i, zc) => {
      const r = H - zc,
        row = (B.heights || [])[r];
      return row ? (row[i] ?? 0) : 0;
    },
    fh = hv(clamp(Math.round(door[0] - cx), 0, W), clamp(Math.round(door[1] - cz), 0, H));
  const heights = (B.heights || []).map(r => r.slice());
  if (heights.length)
    for (let zc = oz; zc <= oz + R.h; zc++) {
      const r = H - zc;
      if (!heights[r]) continue;
      for (let i = ox; i <= ox + R.w; i++) {
        const rh = R.heights ? (R.heights[R.h - (zc - oz)] || [])[i - ox] || 0 : 0;
        heights[r][i] = +(fh + rh).toFixed(2);
      }
    }
  /* steps: the place's, with the room's walls stamped in */
  const SB = dioSteps(B),
    SR = dioSteps(R),
    E = {
      s: '@' + id,
      m0: '@' + id,
      w: W * 2,
      h: H * 2,
      H: SB ? new Float32Array(SB.H) : new Float32Array(W * H * 4),
      M: SB ? new Uint8Array(SB.M) : new Uint8Array(W * H * 4),
    };
  for (let j = oz * 2; j < (oz + R.h) * 2 && j < E.h; j++)
    for (let i = ox * 2; i < (ox + R.w) * 2 && i < E.w; i++) {
      const q = j * E.w + i,
        ii = i - ox * 2,
        r = SR ? (j - oz * 2) * SR.w + (mir ? SR.w - 1 - ii : ii) : -1;
      E.H[q] = SR ? SR.H[r] : 0;
      E.M[q] = SR ? SR.M[r] : 0;
    }
  /* things: the place's, less what the room covers (and a strip in front of it, so nothing stands between you and the room), plus the room's */
  const x0 = ox - 0.6,
    x1 = ox + R.w + 0.6,
    z0 = oz - 3.2,
    z1 = oz + R.h + 0.6,
    hits = (a0, b0, a1, b1) => a1 > x0 && a0 < x1 && b1 > z0 && b0 < z1;
  const props = [];
  for (const p of B.props || []) {
    const M = C.props[p.k],
      s = p.s || 1;
    let a0 = p.x - 0.3,
      a1 = p.x + 0.3,
      b0 = p.z - 0.2,
      b1 = p.z + 0.4;
    if (M && M.box) {
      a0 = p.x - (M.box[0] * s) / 2;
      a1 = p.x + (M.box[0] * s) / 2;
      b0 = p.z - 0.1;
      b1 = p.z + M.box[1] * s;
    }
    if (hits(a0, b0, a1, b1)) continue;
    props.push(p);
  }
  const r0 = props.length;
  for (const p of R.props || []) {
    const M = C.props[p.k],
      lx = mx(p.x),
      hw = M && M.box ? (M.box[0] * (p.s || 1)) / 2 : 0.45;
    if (!(M && M.flat) && p.z < 3 && lx + hw > ex - gap / 2 - 0.3 && lx - hw < ex + gap / 2 + 0.3) continue;
    /* nothing stands in the doorway */ const q = Object.assign({}, p);
    q.x = +(lx + ox).toFixed(2);
    if (mir) {
      if (q.f) delete q.f;
      else q.f = 1;
    }
    q.z = +(p.z + oz).toFixed(2);
    props.push(q);
  }
  /* alpha 0.1: the room's windows are the building's own (wrRoomWindows) */
  if (R.winMatch !== 0) {
    const bp = (B0.props || []).find(p => {
      const M = C.props[p.k];
      return (
        M &&
        M.box &&
        Math.abs(p.z - door[1]) < 0.08 &&
        Math.abs(p.x - (door[2] ?? door[0])) < (door[2] != null ? 0.08 : (M.box[0] * (p.s || 1)) / 2)
      );
    });
    if (bp) wrRoomWindows(props, r0, R, C, C.props[bp.k], bp, ox, oz);
  }
  sc = Object.assign({}, B, { tiles, heights, props, id, steps: E.s, stepm: E.m0, stepsV: 1 });
  DIO_STEPS.set(sc, E);
  for (const k of WR_LOOK) sc[k] = R[k];
  Object.assign(sc, {
    indoor: R.indoor || 1,
    room: R.room || true,
    wallCol:
      vary && R.wallCol
        ? R.wallCol.map((c, i) => (i === 10 ? WALLS[Math.floor(vs * 997) % WALLS.length] : c))
        : R.wallCol,
    keeper: R.keeper,
    folk: 0,
    life: (B.life || []).filter(o => !o.area || o.area[2] < x0 || o.area[0] > x1 || o.area[3] < z0 || o.area[1] > z1),
    hub: [ex + ox, (R.hub || [R.w / 2, 2.2])[1] + oz],
    exits: [[ex + ox, Math.max(oz + 0.3, Math.min(oz + 1.2, door[1] - cz))]],
    roomGap: gap,
    /* the doorway exactly at the door, also front to back */ edgeExits: null,
    npcSpots: (R.npcSpots || []).map(q => (Array.isArray(q) ? [mx(q[0]) + ox, q[1] + oz] : q)),
    roomRect: [ox, oz, R.w, R.h],
    roomOf: roomId,
    roomBase: baseId,
    roomDoor: [door[0] - cx, door[1] - cz],
    roomCut: [cx, cz],
    roomFloor: fh,
    arches: (B.arches || []).filter(o => !hits(o.x - 1, o.z - 1, o.x + 1, o.z + 1)),
    name: R.name,
  });
  WORLD.cache.set(key, sc);
  wrTrim();
  return sc;
}
/* where a point of one composite lands in another (both hold a scene or the road): null when they share nothing */
export function wrDelta(fromId, toId) {
  const a = dioScene(fromId),
    b = dioScene(toId);
  if (!a || !b) return null;
  const pa = a.parts || [{ id: fromId, ox: 0, oz: 0 }],
    pb = b.parts || [{ id: toId, ox: 0, oz: 0 }];
  for (const p of pa) {
    const q = pb.find(x => x.id === p.id);
    if (q) return [q.ox - p.ox, q.oz - p.oz];
  }
  return null;
}
/* --- what the walk shows (called by walkState in ui.js) --- */
/* roaming at a stop: v46: always the place's hub view (the scene with the first stretch of each road), so walking
   round a place and up to its exits never switches views */
export function wrRoamView(node, pos) {
  if (!wrOn()) return null;
  const id = sceneIdAt(node),
    sc = dioScene(id);
  if (
    !sc ||
    !(sc.exits || []).length ||
    sc.kind === 'room' ||
    sc.kind === 'test' ||
    /^(int_|test_)/.test(id) ||
    sc.room
  )
    return null;
  const hs = wrHubScene(node);
  if (!hs) return null;
  WORLD.roam = { node };
  return { id: hs.id, sc: hs, R: null };
}
/* on a road: the view for your progress, and where you stand on it (in that view's metres) */
export function wrTripView(node, nx, f) {
  if (!wrOn()) return null;
  const i = wrLinkIndex(node, nx);
  if (i < 0) return null;
  const J = wrJoin(i);
  if (J) return wrJoinTrip(J, node, f);
  const R = wrRoad(i);
  if (!R) return null;
  const fwd = R.a === node,
    u = fwd ? f * R.Lr : (1 - f) * R.Lr,
    v = wrViewFor(R, u),
    sc = wrScene(v, R);
  if (!sc) return null;
  const p = wrAt(R, u);
  const lane = (wrNoise(u * 0.05, 1, R.seed + 41) - 0.5) * 1.2,
    o = v.off || [0, 0];
  return {
    id: v.id,
    sc,
    R,
    u,
    fwd,
    pos: [p.x - p.d[1] * lane - o[0] - sc.comp.box[0], p.z + p.d[0] * lane - o[1] - sc.comp.box[1]],
    dir: fwd ? p.d : [-p.d[0], -p.d[1]],
  };
}
/* alpha 0.2: a trip between two joined places is the walk from the middle of one (its hub) to the exit, then from the
   next place's entrance to its middle, your steps spread evenly along it; the view is the place you are in, and changes
   at the seam. If you set off from somewhere along the way out (near the exit already), the trip starts there. */
function wrJoinTrip(J, node, f) {
  const fwd = J.a === node,
    X = fwd ? J.A : J.B,
    Y = fwd ? J.B : J.A,
    xn = fwd ? J.a : J.b,
    yn = fwd ? J.b : J.a,
    PX = wrExitPath(X, (fwd ? J.ea : J.eb).k),
    PY = wrExitPath(Y, (fwd ? J.eb : J.ea).k),
    L = Math.max(1, PX.len + PY.len);
  const T = WORLD.trip;
  let u0 = 0;
  if (T && T.i === J.i && T.node === node) u0 = T.u0;
  else if (f <= 0) {
    u0 = wrStartU(xn, PX);
    WORLD.trip = { i: J.i, node, u0 };
  } else WORLD.trip = null;
  const u = u0 + clamp(f, 0, 1) * (L - u0),
    inX = u < PX.len,
    vn = inX ? xn : yn,
    sc = wrHubScene(vn);
  if (!sc) return null;
  const o = sc.baseOff || [0, 0],
    p = inX ? wrAlongPts(PX, u) : wrAlongPts(PY, PY.len - (u - PX.len));
  return {
    id: sc.id,
    sc,
    R: J,
    u,
    fwd,
    pos: [p.x + o[0], p.z + o[1]],
    dir: inX ? p.d : [-p.d[0], -p.d[1]],
    join: 1,
    inX,
    xn,
    yn,
    PX,
    PY,
    L,
  };
}
/* how far along the way out you stand (0 if you aren't in that place's view) */
function wrStartU(xn, P) {
  const sid = sceneIdAt(xn);
  if (!(DIO.ready && DIO.sc && DIO.pl && !DIO.pl.fresh && (DIO.sc.baseId || DIO.id) === sid)) return 0;
  const o = DIO.sc.baseOff || [0, 0],
    x = DIO.pl.x - o[0],
    z = DIO.pl.z - o[1];
  let best = null,
    s = 0;
  for (let i = 1; i < P.pts.length; i++) {
    const a = P.pts[i - 1],
      b = P.pts[i],
      vx = b[0] - a[0],
      vz = b[1] - a[1],
      l = Math.hypot(vx, vz) || 1e-9,
      k = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / (l * l), 0, 1),
      d = Math.hypot(a[0] + vx * k - x, a[1] + vz * k - z);
    if (!best || d < best.d) best = { d, u: s + l * k };
    s += l;
  }
  return best ? Math.max(0, best.u - 1) : 0;
}
/* paint the ground of the view that comes next while this one is on screen (so the shift to it is instant) */
export function wrPrefetch(R, u, fwd, tv) {
  if (!R) return;
  if (R.join) {
    /* the next place's view, from 40 m before the seam */ if (tv && tv.inX && tv.PX.len - u < 40) {
      const sc = wrHubScene(tv.yn);
      if (sc && sc.id !== DIO.id) {
        const e = tv.PY.pts[tv.PY.pts.length - 1],
          o = sc.baseOff || [0, 0];
        wrGetReady(sc.id, false, [e[0] + o[0], e[1] + o[1]]);
      }
    }
    return;
  }
  const ahead = clamp(fwd ? u + 40 : u - 40, 0, R.Lr);
  /* v46: 40 m ahead (was 26; and near the end, the far place itself), the painting and the card both need the time */ const v =
    wrViewFor(R, ahead);
  if (v.id === DIO.id) return;
  const sc = wrScene(v, R);
  if (!sc) return;
  /* where you will be when it is shown: a little past where you are now */ const p = wrAt(
      R,
      clamp(fwd ? u + 12 : u - 12, 0, R.Lr)
    ),
    o = v.off || [0, 0];
  wrGetReady(v.id, false, [p.x - o[0] - sc.comp.box[0], p.z - o[1] - sc.comp.box[1]]);
}
function wrPrefetchView(v, R) {
  if (v.id === DIO.id) return;
  wrScene(v, R);
  wrGetReady(v.id);
}
/* v46: is a view ready to be shown at once (its ground painted and, in 3D, built on the card)? wrGetReady also starts
   whatever is missing: the painting in slices of about 8 ms, then the building on the card a few ms a frame (dglPrepare) */
function wrReady(id) {
  if (id === DIO.id) return true;
  const sc = dioScene(id);
  if (!sc) return false;
  const key = dioGroundKey(sc);
  if (!DIO_GCACHE.has(key)) return false;
  return typeof DGL === 'undefined' || !DGL.on || typeof dglPrepared !== 'function' || dglPrepared(id, sc, key);
}
export function wrGetReady(id, urgent, focus) {
  if (wrReady(id)) return true;
  const sc = dioScene(id);
  if (!sc) return false;
  const key = dioGroundKey(sc),
    G = DIO_GCACHE.get(key);
  if (!G) {
    if (!WORLD.busy) {
      WORLD.busy = true;
      WORLD.busyId = id;
      const t0 = performance.now();
      artLoad(dioPaths(sc))
        .then(() => dioGroundAsync(sc, urgent ? -5 : 10))
        .catch(() => {})
        .then(() => {
          WORLD.busy = false;
          if (typeof NWLOG !== 'undefined')
            NWLOG.add('scene', `painted ${id} ahead (${Math.round(performance.now() - t0)} ms in the background)`);
        });
    }
    return false;
  }
  if (typeof dglPrepare === 'function') dglPrepare(id, sc, G, urgent, focus || sc.hub || [sc.w / 2, sc.h / 2]);
  return false;
}
/* v46: show a view only when it is ready; until then stay in the one on screen, as long as where you stand is still
   well inside it (on a road the views overlap by 40 m, so there is time). If you would walk off its edge the switch
   happens anyway, built on the spot as before. */
export function wrGate(v) {
  if (!wrOn() || !v || v.id === DIO.id || !DIO.ready || !DIO.sc || !DIO.pl || DIO.pl.fresh) return v;
  if (wrGetReady(v.id, true, v.pos)) {
    WORLD.heldFor = null;
    if (typeof DGL !== 'undefined') DGL.prepBoost = 1;
    return v;
  }
  const d = wrDelta(DIO.id, v.id);
  if (!d) return v;
  const x = v.pos[0] - d[0],
    z = v.pos[1] - d[1],
    sc = DIO.sc,
    m = 3,
    room = Math.min(x - m, z - m, sc.w - m - x, sc.h - m - z);
  /* alpha 0.2: neighbours share their edges, so a jump to the next place lands inside this view too; only a walk (a trip,
    or a few steps) waits here for the next view, a jump opens it at once */ if (
    v.mode !== 'road' &&
    Math.hypot(x - DIO.pl.x, z - DIO.pl.z) > 25
  )
    return v;
  if (typeof DGL !== 'undefined') DGL.prepBoost = room < 6 ? 4 : room < 12 ? 2 : 1;
  /* closer to the edge, bigger slices */ if (room < 0) {
    if (typeof NWLOG !== 'undefined') NWLOG.add('scene', `${v.id} wasn't ready in time; built on the spot`);
    return v;
  }
  if (WORLD.heldFor !== v.id) {
    WORLD.heldFor = v.id;
    WORLD.holds = (WORLD.holds || 0) + 1;
  }
  return Object.assign({}, v, { id: DIO.id, pos: [x, z], held: v.id });
}
/* move everything that is in the scene by (dx, dz) and carry on in the next composite without a cut */
/* alpha 0.2: going into or out of an underground place the picture dips to dark for a moment (you step into a cave) */
function wrVeil() {
  const cv = DIO.cv;
  if (!cv || !cv.isConnected || (typeof U !== 'undefined' && U.photo)) return;
  let v = document.getElementById('wrVeil');
  if (!v) {
    v = document.createElement('div');
    v.id = 'wrVeil';
    v.style.cssText = 'position:fixed;pointer-events:none;background:#07060a;z-index:5;opacity:0';
    document.body.appendChild(v);
  }
  const r = cv.getBoundingClientRect();
  Object.assign(v.style, {
    left: r.left + 'px',
    top: r.top + 'px',
    width: r.width + 'px',
    height: r.height + 'px',
    transition: 'none',
    opacity: '.94',
  });
  void v.offsetWidth;
  v.style.transition = 'opacity .6s ease-in';
  v.style.opacity = '0';
}
export function dioShift(id, dx, dz) {
  const sc = dioScene(id);
  if (!sc) return false;
  const P = DIO.pl;
  if (!!(DIO.sc && DIO.sc.under) !== !!sc.under) wrVeil();
  P.x += dx;
  P.z += dz;
  if (P.lx != null) {
    P.lx += dx;
    P.lz += dz;
  }
  if (P.route) P.route = P.route.map(([x, z]) => [x + dx, z + dz]);
  if (P.line) P.line = dioPoly(P.line.p.map(([x, z]) => [x + dx, z + dz]));
  for (const e of Object.values(DIO.enc || {})) {
    e.x += dx;
    e.z += dz;
    if (e.tx != null) {
      e.tx += dx;
      e.tz += dz;
    }
    e.sc = id;
  }
  for (const f of (DIO.folkAll && DIO.folkAll.length ? DIO.folkAll : DIO.folk) || []) {
    f.x += dx;
    f.z += dz;
    if (f.tx != null) {
      f.tx += dx;
      f.tz += dz;
    }
    if (f.route) f.route = f.route.map(([x, z]) => [x + dx, z + dz]);
    if (f.home) f.home = [f.home[0] + dx, f.home[1] + dz];
    if (f.A)
      for (const k in f.A) {
        const a = f.A[k];
        if (a) f.A[k] = [a[0] + dx, a[1] + dz];
      }
  }
  DIO.folkId = id;
  if (DIO.tap) {
    DIO.tap.x += dx;
    DIO.tap.z += dz;
  }
  for (const q of DIO.parts || []) {
    if (q.x != null) q.x += dx;
    if (q.z != null) q.z += dz;
  }
  if (typeof DGL !== 'undefined') {
    if (DGL.camT) {
      DGL.camT[0] += dx;
      DGL.camT[1] += dz;
    }
    if (DGL.focusT) {
      DGL.focusT.x += dx;
      DGL.focusT.z += dz;
    }
    DGL.encPos = [];
  }
  if (DIO.cam) {
    if (DIO.cam.x != null) DIO.cam.x += dx;
    if (DIO.cam.z != null) DIO.cam.z += dz;
    if (DIO.cam.cx != null) DIO.cam.cx += dx;
    if (DIO.cam.cz != null) DIO.cam.cz += dz;
  }
  if (typeof lifeShift === 'function') lifeShift(dx, dz, id);
  if (typeof owShift === 'function') owShift(dx, dz);
  DIO.id = id;
  DIO.sc = sc;
  DIO.gkey = '';
  DIO.cand = null;
  DIO.nav = null;
  DIO.npcAt = {};
  P.pk = '';
  if (typeof NWLOG !== 'undefined') NWLOG.add('scene', 'seamless to ' + id);
  return true;
}
