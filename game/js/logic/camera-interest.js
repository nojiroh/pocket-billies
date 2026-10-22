// @ts-check
'use strict';
/* ================= CAMERA INTEREST (camera track CAM-2) =================
   Points of interest near you (a landmark, a shop's or clinic's door, anything the catalogue marks `interest`) lean
   the walking camera toward them and zoom it a little, as plain numbers (tools/test/camera-interest.test.mjs):
   - each point has a weight (0-1), a radius (metres), a zoom (the zoom's factor at full weight) and a pull (metres);
   - its weight fades in as you come within its radius, in full from 40% of the radius in (a smoothstep, no edge);
   - the strongest point wins (points don't add up, so a street of shops doesn't pull harder than one);
   - the aim moves toward it by its pull at most, and never further than the cap (about 1.5 m), so you stay framed. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  INTEREST_DEFAULTS: [() => INTEREST_DEFAULTS],
  // @ts-expect-error -- replaced on purpose
  interestFade: [() => interestFade, v => (interestFade = v)],
  // @ts-expect-error -- replaced on purpose
  interestPick: [() => interestPick, v => (interestPick = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * @typedef {object} InterestPoint
 * @property {string} id
 * @property {number} x
 * @property {number} z
 * @property {number} weight 0-1
 * @property {number} radius metres
 * @property {number} zoom the zoom's factor at full weight
 * @property {number} pull metres the aim leans toward it at full weight
 */
/** a landmark's and a door's interest when the catalogue says no more than `landmark` or `act` */
export const INTEREST_DEFAULTS = {
  landmark: { weight: 0.5, radius: 14, zoom: 1, pull: 1.5 },
  door: { weight: 0.6, radius: 3.5, zoom: 0.92, pull: 1 },
};
/**
 * 0 outside the radius, 1 from 40% of it in, smooth between.
 * @param {number} d distance (m)
 * @param {number} r radius (m)
 */
export function interestFade(d, r) {
  if (!(r > 0) || d >= r) return 0;
  const a = r * 0.4,
    t = d <= a ? 1 : 1 - (d - a) / (r - a);
  return t * t * (3 - 2 * t);
}
/**
 * The strongest point near you and how it leans the camera.
 * @param {InterestPoint[]} points
 * @param {number} px where you are
 * @param {number} pz
 * @param {number} cap the most the aim leans (m)
 * @returns {{id: string, w: number, lean: number[], zoom: number, n: number, at: number[]} | null} `w` its weight
 *   now, `lean` the aim's shift toward it at full weight (x, z), `zoom` its zoom, `n` how many are in reach
 */
export function interestPick(points, px, pz, cap) {
  let best = /** @type {{p: InterestPoint, d: number} | null} */ (null),
    bw = 0,
    n = 0;
  for (const p of points) {
    const d = Math.hypot(p.x - px, p.z - pz),
      w = Math.max(0, Math.min(1, p.weight)) * interestFade(d, p.radius);
    if (w <= 0) continue;
    n++;
    if (w > bw) {
      bw = w;
      best = { p, d };
    }
  }
  if (!best) return null;
  const { p, d } = best,
    len = Math.min(Math.max(0, p.pull), Math.max(0, cap), d),
    k = d > 1e-6 ? len / d : 0;
  return {
    id: p.id,
    w: bw,
    lean: [(p.x - px) * k, (p.z - pz) * k],
    zoom: p.zoom > 0 ? p.zoom : 1,
    n,
    at: [p.x, p.z],
  };
}
