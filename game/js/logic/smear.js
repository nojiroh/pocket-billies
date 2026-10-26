// @ts-check
'use strict';
/* ================= SMEARS: THE THROW'S PACE, ITS AFTERIMAGES AND ITS RIBBON (VFX track VFX-1, VFX-2) =================
   A thrown pyramid leaves "multiples" behind it, the classic smear of hand-drawn animation: copies of itself at the
   places it just was, held, not blurred. Its places are kept on a 24 fps grid (the rigs' "on ones",
   skeleton-rig.js rigFrame), so the copies step like the rest of the animation; each copy is drawn dithered (the
   models' Bayer fade) and brighter in its own colours. After it stops, the copies run out one by one, oldest first.
   The throw's pace: fast at the release, a hang at the top, fast into the hit (smears read on speed contrast).
   VFX-2: the motion lines, a ribbon along the last part of the arc (the same kept places), tapered to its tail, hard
   edged, eroded in dithered steps: its tail frays in flight, and once the object stops it erodes away in four steps
   on the same grid (about 150 ms). A spinning throw twists it about the tumble axis.
   Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  RIBBON_CELLS: [() => RIBBON_CELLS],
  RIBBON_CORE: [() => RIBBON_CORE],
  RIBBON_FRAY: [() => RIBBON_FRAY],
  RIBBON_HALF: [() => RIBBON_HALF],
  RIBBON_STEPS: [() => RIBBON_STEPS],
  RIBBON_SUB: [() => RIBBON_SUB],
  SMEAR_GHOSTS: [() => SMEAR_GHOSTS],
  SMEAR_KEEP: [() => SMEAR_KEEP],
  SMEAR_MIN_GAP: [() => SMEAR_MIN_GAP],
  SMEAR_NEAR: [() => SMEAR_NEAR],
  SMEAR_STEP: [() => SMEAR_STEP],
  THROW_EASE: [() => THROW_EASE],
  // @ts-expect-error -- replaced on purpose
  ribbonCells: [() => ribbonCells, v => (ribbonCells = v)],
  // @ts-expect-error -- replaced on purpose
  ribbonEdges: [() => ribbonEdges, v => (ribbonEdges = v)],
  // @ts-expect-error -- replaced on purpose
  smearCount: [() => smearCount, v => (smearCount = v)],
  // @ts-expect-error -- replaced on purpose
  smearGhosts: [() => smearGhosts, v => (smearGhosts = v)],
  // @ts-expect-error -- replaced on purpose
  smearHistory: [() => smearHistory, v => (smearHistory = v)],
  // @ts-expect-error -- replaced on purpose
  smearRecord: [() => smearRecord, v => (smearRecord = v)],
  // @ts-expect-error -- replaced on purpose
  smearRibbon: [() => smearRibbon, v => (smearRibbon = v)],
  // @ts-expect-error -- replaced on purpose
  throwArcEase: [() => throwArcEase, v => (throwArcEase = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the history's grid (ms): 24 places a second */
export const SMEAR_STEP = 1000 / 24;
/** the afterimages, newest first: how much of each is drawn (the dithered fade) and how much brighter it is in its
 * own colours (battle-3d.js: the colours' value times 1 + glow) */
export const SMEAR_GHOSTS = [
  { fade: 0.6, glow: 0.45 },
  { fade: 0.4, glow: 0.7 },
  { fade: 0.25, glow: 0.95 },
];
/** a copy closer than this (metres) to the next newer one is not drawn: at the top of the arc they would only
 * dither over the pyramid itself */
export const SMEAR_MIN_GAP = 0.12;
/** a copy closer than this (metres) to the camera is not drawn: a throw leaves the camera, so its first copies lie
 * between the lens and the pyramid and would fill the screen */
export const SMEAR_NEAR = 2;
/** VFX-2: the ribbon's kept places (the owner's choice: six, about 250 ms of the arc) */
export const RIBBON_CELLS = 6;
/** how many places a history keeps: what the afterimages and the ribbon need */
export const SMEAR_KEEP = Math.max(SMEAR_GHOSTS.length + 1, RIBBON_CELLS);
/** the ribbon's half width at its head (metres), tapered to nothing at its tail */
export const RIBBON_HALF = 0.13;
/** the white core's share of its width (the rest is the object's own colour) */
export const RIBBON_CORE = 0.4;
/** how much of the ribbon's tail is eroded in flight (0 at the head, this at the tail) */
export const RIBBON_FRAY = 0.75;
/** the erosion's steps: once the object stops, one more step each grid cell, gone after this many */
export const RIBBON_STEPS = 4;
/** points drawn between two kept places (a smooth curve through them; it still moves on the grid) */
export const RIBBON_SUB = 3;
/** how much the throw's pace varies: 0 even, below 1 always forward; 0.45 is 1.45x the mean speed at both ends and
 * 0.55x at the top */
export const THROW_EASE = 0.45;

/** a throw's progress (0..1) for its time (0..1): same start, middle and end, faster at both ends
 * @param {number} k */
export function throwArcEase(k, a = THROW_EASE) {
  return k + (a * Math.sin(2 * Math.PI * k)) / (2 * Math.PI);
}

/** @typedef {{ x: number, y: number, z: number, t?: number, [k: string]: any }} SmearPlace */
/** @typedef {{ cell: number, list: SmearPlace[] }} SmearHistory */

/** an empty history
 * @returns {SmearHistory} */
export function smearHistory() {
  return { cell: -Infinity, list: [] };
}

/** keeps place s (and the time t, ms) when t is in a new grid cell; true when kept
 * @param {SmearHistory} H @param {number} t @param {SmearPlace} s */
export function smearRecord(H, t, s) {
  const cell = Math.floor(t / SMEAR_STEP);
  if (cell === H.cell) return false;
  H.cell = cell;
  H.list.unshift({ ...s, t });
  if (H.list.length > SMEAR_KEEP) H.list.length = SMEAR_KEEP;
  return true;
}

/** the afterimages to draw at time t, newest first: up to n of them (the battle's quality), each a kept place with
 * its look. The newest place is the cell the object is in now, so the copies start one cell back; a copy lives
 * (count + 1) steps, so in flight all show, and once the object stops they run out oldest first. eye: the camera
 * (the same metres), none drawn within SMEAR_NEAR of it
 * @param {SmearHistory | null | undefined} H @param {number} t @param {number} n
 * @param {{ x: number, y: number, z: number } | null} [eye]
 * @returns {{ s: SmearPlace, fade: number, glow: number }[]} */
export function smearGhosts(H, t, n = SMEAR_GHOSTS.length, eye = null) {
  const out = [];
  if (!H || n <= 0) return out;
  const L = H.list,
    life = (SMEAR_GHOSTS.length + 1) * SMEAR_STEP;
  for (let i = 1; i < L.length && i <= n; i++) {
    const s = L[i],
      p = L[i - 1];
    if (t - (s.t ?? t) >= life) break;
    if (Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) < SMEAR_MIN_GAP) continue;
    if (eye && Math.hypot(s.x - eye.x, s.y - eye.y, s.z - eye.z) < SMEAR_NEAR) continue;
    out.push({ s, ...SMEAR_GHOSTS[i - 1] });
  }
  return out;
}

/** how many afterimages a battle draws: none under Reduced motion or at its lowest quality (level 3), two at
 * level 2 @param {boolean} reduced @param {number} lvl */
export function smearCount(reduced, lvl) {
  return reduced || lvl >= 3 ? 0 : lvl >= 2 ? 2 : SMEAR_GHOSTS.length;
}

/** how many places the ribbon runs along: none where the afterimages are off (Reduced motion, quality level 3), four
 * at level 2 @param {boolean} reduced @param {number} lvl */
export function ribbonCells(reduced, lvl) {
  return reduced || lvl >= 3 ? 0 : lvl >= 2 ? 4 : RIBBON_CELLS;
}

/** @typedef {{ x: number, y: number, z: number, w: number, e: number, tum: number }} RibbonPoint */

/** the ribbon at time t, head first: up to `cells` kept places with a smooth curve through them, each point with its
 * half width w (tapered to 0 at the tail) and erosion e (0 whole .. 1 gone, in 1 / RIBBON_STEPS steps). head: where
 * the object is now while it flies (the ribbon reaches it between grid cells); none once it stops. It ends before the
 * first place within SMEAR_NEAR of the eye (a throw leaves the camera: its tail is the near end)
 * @param {SmearHistory | null | undefined} H @param {number} t @param {number} cells
 * @param {{ x: number, y: number, z: number } | null} [eye] @param {SmearPlace | null} [head]
 * @returns {RibbonPoint[]} */
export function smearRibbon(H, t, cells, eye = null, head = null) {
  if (!H || cells < 2 || !H.list.length) return [];
  const L = H.list,
    /* the grid cells since the newest place was kept: 0 in flight, then one erosion step a cell */
    gone = Math.max(0, Math.floor(t / SMEAR_STEP) - H.cell);
  if (gone >= RIBBON_STEPS) return [];
  const near = s => !!eye && Math.hypot(s.x - eye.x, s.y - eye.y, s.z - eye.z) < SMEAR_NEAR,
    P = [];
  if (head && !near(head)) P.push(head);
  for (let i = 0; i < L.length && i < cells; i++) {
    const s = L[i];
    if (near(s)) break;
    const p = P[P.length - 1];
    if (p && Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) < SMEAR_MIN_GAP) continue;
    P.push(s);
  }
  if (P.length < 2) return [];
  /* a Catmull-Rom curve through the places, RIBBON_SUB points a span */
  const at = (i, k) => {
      const a = P[Math.max(0, i - 1)],
        b = P[i],
        c = P[i + 1],
        d = P[Math.min(P.length - 1, i + 2)],
        f = key =>
          0.5 *
          (2 * b[key] +
            (c[key] - a[key]) * k +
            (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * k * k +
            (3 * b[key] - a[key] - 3 * c[key] + d[key]) * k * k * k);
      return { x: f('x'), y: f('y'), z: f('z'), tum: (b.tum || 0) + ((c.tum || 0) - (b.tum || 0)) * k };
    },
    n = (P.length - 1) * RIBBON_SUB,
    out = [];
  for (let j = 0; j <= n; j++) {
    const i = Math.min(P.length - 2, Math.floor(j / RIBBON_SUB)),
      q = at(i, j / RIBBON_SUB - i),
      u = j / n,
      e = Math.min(1, Math.round((RIBBON_FRAY * u + gone / RIBBON_STEPS) * RIBBON_STEPS) / RIBBON_STEPS);
    out.push({ ...q, w: RIBBON_HALF * (1 - u), e });
  }
  return out;
}

/** the ribbon's two edges at each point, [left, right] (the same metres): across the curve and toward the eye, so it
 * faces the camera; a spinning throw (ax, its tumble axis) turns that about the axis by each point's tumble, so the
 * ribbon twists and at times shows its edge
 * @param {RibbonPoint[]} R @param {{ x: number, y: number, z: number }} eye
 * @param {number[] | null} [ax] @returns {number[][][]} */
export function ribbonEdges(R, eye, ax = null) {
  const out = [],
    nrm = v => {
      const l = Math.hypot(v[0], v[1], v[2]);
      return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : null;
    },
    cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    A = ax && nrm(ax);
  let last = [0, 1, 0];
  for (let i = 0; i < R.length; i++) {
    const p = R[i],
      a = R[Math.max(0, i - 1)],
      b = R[Math.min(R.length - 1, i + 1)],
      tg = nrm([b.x - a.x, b.y - a.y, b.z - a.z]) || [1, 0, 0];
    let s = nrm(cross(tg, [eye.x - p.x, eye.y - p.y, eye.z - p.z])) || nrm(cross(tg, [0, 1, 0])) || last;
    if (A) {
      /* Rodrigues: s turned about the axis by the tumble, then made square to the curve again */
      const c = Math.cos(p.tum),
        n = Math.sin(p.tum),
        k = A[0] * s[0] + A[1] * s[1] + A[2] * s[2],
        x = cross(A, s),
        r = [0, 1, 2].map(j => s[j] * c + x[j] * n + A[j] * k * (1 - c)),
        d = r[0] * tg[0] + r[1] * tg[1] + r[2] * tg[2];
      s = nrm([r[0] - tg[0] * d, r[1] - tg[1] * d, r[2] - tg[2] * d]) || s;
    }
    last = s;
    out.push([
      [p.x - s[0] * p.w, p.y - s[1] * p.w, p.z - s[2] * p.w],
      [p.x + s[0] * p.w, p.y + s[1] * p.w, p.z + s[2] * p.w],
    ]);
  }
  return out;
}
