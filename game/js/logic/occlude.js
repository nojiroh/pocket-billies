// @ts-check
'use strict';
/* ================= COVER (player visibility) =================
   Whether a tall picture standing nearer the camera covers the player on screen, so it can thin out. Logic only:
   screen points are passed in, runs in Node (tools/test/occlude.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  coverTarget: [() => coverTarget, v => (coverTarget = v)],
  // @ts-expect-error -- replaced on purpose
  fadeEase: [() => fadeEase, v => (fadeEase = v)],
  // @ts-expect-error -- replaced on purpose
  hiddenEase: [() => hiddenEase, v => (hiddenEase = v)],
  // @ts-expect-error -- replaced on purpose
  outlineColour: [() => outlineColour, v => (outlineColour = v)],
  // @ts-expect-error -- replaced on purpose
  pictureCovers: [() => pictureCovers, v => (pictureCovers = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * Does a picture standing at screen point `q` (its foot; `q.d` its depth, `q.s` pixels a metre) cover the screen
 * point `me` (the player's middle; `me.d` its depth)? `halfW` and `hM` are the picture's half width and height in
 * metres. It counts only when the picture's foot is clearly nearer the camera than the player.
 * @param {{ x: number, y: number, d: number }} me
 * @param {{ x: number, y: number, d: number, s: number }} q
 * @param {number} halfW
 * @param {number} hM
 */
export function pictureCovers(me, q, halfW, hM) {
  if (!(q.d < me.d - 0.3)) return false;
  const half = halfW * q.s,
    top = q.y - hM * q.s;
  return me.x > q.x - half && me.x < q.x + half && me.y > top && me.y < q.y;
}

/**
 * The eased "something hides you" amount (0-1): toward `target` quickly (about a sixth of a second) when you go
 * behind something, slowly (about half a second) when you come out, so a thin post passing doesn't flicker it.
 * @param {number} k the amount last frame
 * @param {number} target 1 hidden, 0 not
 * @param {number} dt seconds since last frame
 */
export function hiddenEase(k, target, dt) {
  const rate = target > k ? 12 : 4,
    v = k + (target - k) * Math.min(1, dt * rate);
  return Math.abs(v - target) < 0.005 ? target : v;
}

/**
 * The outline's colour from a "#rrggbb" colour (the top someone wears), as 0-1 numbers: a dark or grey colour is
 * lifted so it reads against shade (lightness at least 0.6, saturation at least 0.35 unless it was grey). null for
 * anything that isn't such a colour.
 * @param {string | null | undefined} hex
 * @returns {number[] | null}
 */
export function outlineColour(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16),
    r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255,
    mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  let h = 0;
  if (d > 0) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const l0 = (mx + mn) / 2,
    s0 = d === 0 ? 0 : d / (1 - Math.abs(2 * l0 - 1)),
    l = Math.max(0.6, l0),
    s = s0 < 0.08 ? s0 : Math.max(0.35, s0),
    c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs((h % 2) - 1)),
    o = l - c / 2,
    i = Math.floor(h) % 6,
    rgb = [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ][i];
  return rgb.map(v => +(v + o).toFixed(4));
}

/**
 * How far a picture that covers you thins out (its fade, 0-1): `base` (Engine > Camera > coverFade, 0.4), milder
 * while the see-through circle is on (`hidK`, 0-1), since the circle already opens the part round you: halfway back
 * toward 1 when fully hidden.
 * @param {number} base
 * @param {number} hidK
 */
export function coverTarget(base, hidK) {
  const b = Math.min(1, Math.max(0, base));
  return b + (1 - b) * 0.5 * Math.min(1, Math.max(0, hidK));
}

/**
 * A picture's fade eased toward `target`: it thins out in about a quarter of a second and comes back in about half
 * a second, so walking past a tree doesn't pop it.
 * @param {number} v the fade last frame
 * @param {number} target
 * @param {number} dt seconds since last frame
 */
export function fadeEase(v, target, dt) {
  const r = v + (target - v) * Math.min(1, dt * (target < v ? 10 : 5));
  return Math.abs(r - target) < 0.005 ? target : r;
}
