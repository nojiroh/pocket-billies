// @ts-check
'use strict';
/* ================= SMEARS: THE THROW'S PACE AND ITS AFTERIMAGES (VFX track VFX-1) =================
   A thrown pyramid leaves "multiples" behind it, the classic smear of hand-drawn animation: copies of itself at the
   places it just was, held, not blurred. Its places are kept on a 24 fps grid (the rigs' "on ones",
   skeleton-rig.js rigFrame), so the copies step like the rest of the animation; each copy is drawn dithered (the
   models' Bayer fade) and brighter in its own colours. After it stops, the copies run out one by one, oldest first.
   The throw's pace: fast at the release, a hang at the top, fast into the hit (smears read on speed contrast).
   Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  SMEAR_GHOSTS: [() => SMEAR_GHOSTS],
  SMEAR_MIN_GAP: [() => SMEAR_MIN_GAP],
  SMEAR_NEAR: [() => SMEAR_NEAR],
  SMEAR_STEP: [() => SMEAR_STEP],
  THROW_EASE: [() => THROW_EASE],
  // @ts-expect-error -- replaced on purpose
  smearCount: [() => smearCount, v => (smearCount = v)],
  // @ts-expect-error -- replaced on purpose
  smearGhosts: [() => smearGhosts, v => (smearGhosts = v)],
  // @ts-expect-error -- replaced on purpose
  smearHistory: [() => smearHistory, v => (smearHistory = v)],
  // @ts-expect-error -- replaced on purpose
  smearRecord: [() => smearRecord, v => (smearRecord = v)],
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
  if (H.list.length > SMEAR_GHOSTS.length + 1) H.list.length = SMEAR_GHOSTS.length + 1;
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
