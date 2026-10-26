// @ts-check
'use strict';
/* ================= CAMERA ZOOM (camera track CAM-2) =================
   One zoom value drives the walking camera's tilt, distance and field of view, each along its own curve (Nesky,
   "50 Game Camera Mistakes" #16), as plain numbers (tools/test/camera-zoom.test.mjs):
   - zoom 1 is the scene's own framing: no extra tilt, the distance and field of view as they are;
   - at the closest zoom (Engine > Camera > Closest zoom) the camera has the "close" end's tilt, distance and field of
     view; at the farthest zoom, the "far" end's;
   - in between, each value moves from 1 (or 0 degrees) to its end along t^curve (t: how far toward that end, 0-1);
     curve 1 is a straight line, which with the default ends is how zoom worked before CAM-2 (14 degrees of tilt a
     unit of zoom, the distance times the zoom, the same field of view);
   - past an end (a moment zooming in further than you can pinch) each value carries on along the curve's slope there.
   The zoom itself is your pinch zoom times the camera goals' zoom (logic/camera-follow.js blendGoals).
   CAM-4a, the zoom's feel (Camera > Feel): the zoom eases in log space (each second takes the same share of the way
   at any zoom, so pinching in and out feels alike), the pinch's sensitivity, a soft rubber band past the limits and
   the lean toward the point you pinch. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  ZOOM_ENDS: [() => ZOOM_ENDS],
  // @ts-expect-error -- replaced on purpose
  pinchLean: [() => pinchLean, v => (pinchLean = v)],
  // @ts-expect-error -- replaced on purpose
  pinchZoom: [() => pinchZoom, v => (pinchZoom = v)],
  // @ts-expect-error -- replaced on purpose
  zoomBand: [() => zoomBand, v => (zoomBand = v)],
  // @ts-expect-error -- replaced on purpose
  zoomBend: [() => zoomBend, v => (zoomBend = v)],
  // @ts-expect-error -- replaced on purpose
  zoomEase: [() => zoomEase, v => (zoomEase = v)],
  // @ts-expect-error -- replaced on purpose
  zoomShape: [() => zoomShape, v => (zoomShape = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * @typedef {object} ZoomEnds
 * @property {number} min the closest zoom you can pinch to
 * @property {number} max the farthest
 * @property {number} nearPitch degrees added to the tilt at the closest zoom
 * @property {number} nearDist the distance's factor at the closest zoom
 * @property {number} nearFov the field of view's factor at the closest zoom
 * @property {number} farPitch degrees added at the farthest zoom
 * @property {number} farDist the distance's factor at the farthest zoom
 * @property {number} farFov the field of view's factor at the farthest zoom
 * @property {number} curve the curves' shape (1: straight; above 1 the change comes late, below 1 early)
 */
/** the ends that match zoom before CAM-2 for the default zoom range (0.55-1.7) */
export const ZOOM_ENDS = {
  min: 0.55,
  max: 1.7,
  nearPitch: -6.3,
  nearDist: 0.55,
  nearFov: 1,
  farPitch: 9.8,
  farDist: 1.7,
  farFov: 1,
  curve: 1,
};
/**
 * How far along its curve a value is: t^curve up to the end, then on along the curve's slope there.
 * @param {number} t how far toward the end (0 at zoom 1, 1 at the end, more past it)
 * @param {number} curve
 */
export function zoomBend(t, curve) {
  const c = curve > 0 ? curve : 1;
  return t <= 1 ? Math.pow(Math.max(0, t), c) : 1 + c * (t - 1);
}
/**
 * The tilt (degrees added), distance factor and field of view factor for a zoom.
 * @param {number} z the zoom (1: the scene's framing; below: closer)
 * @param {ZoomEnds} E
 * @returns {{pitch: number, dist: number, fov: number}}
 */
export function zoomShape(z, E) {
  const close = z < 1,
    span = close ? 1 - E.min : E.max - 1,
    t = span > 1e-6 ? Math.abs(z - 1) / span : 0,
    k = zoomBend(t, E.curve),
    pitch = (close ? E.nearPitch : E.farPitch) * k,
    dist = 1 + ((close ? E.nearDist : E.farDist) - 1) * k,
    fov = 1 + ((close ? E.nearFov : E.farFov) - 1) * k;
  return { pitch, dist: Math.max(0.15, dist), fov: Math.max(0.2, fov) };
}
/**
 * CAM-4a: the zoom eased toward its target in log space, exact at any frame rate: after `smooth` seconds it has gone
 * 63% of the way, whether it is zooming in or out (a linear ease seems to rush up close and crawl far out).
 * @param {number} z the zoom now
 * @param {number} zT the zoom it goes to
 * @param {number} smooth seconds (0: at once)
 * @param {number} dt seconds since the last frame
 */
export function zoomEase(z, zT, smooth, dt) {
  if (!(smooth > 0) || !(z > 0) || !(zT > 0)) return zT;
  return z * Math.pow(zT / z, 1 - Math.exp(-Math.max(0, dt) / smooth));
}
/**
 * CAM-4a: the zoom a pinch asks for: the zoom when the fingers went down times how far they have spread, raised to the
 * pinch's sensitivity (1: the picture follows the fingers; 2: twice as quick).
 * @param {number} z0 the zoom when the pinch began
 * @param {number} d0 the fingers' distance then (pixels)
 * @param {number} d their distance now (pixels; under 20 counts as 20)
 * @param {number} speed the sensitivity
 */
export function pinchZoom(z0, d0, d, speed) {
  return z0 * Math.pow(d0 / Math.max(20, d), speed > 0 ? speed : 1);
}
/**
 * CAM-4a: a zoom kept between the limits; with a band, past a limit it gives a little (in log zoom, never more than
 * `band` past it), as a rubber band does, and lets go back to the limit on release (the caller clamps then).
 * @param {number} v the zoom asked for
 * @param {number} lo the closest zoom
 * @param {number} hi the farthest zoom
 * @param {number} band how far past a limit it may stretch, in log zoom (0: a hard stop)
 */
export function zoomBand(v, lo, hi, band) {
  if (!(band > 0) || !(v > 0)) return Math.min(hi, Math.max(lo, v));
  const L = Math.log(v),
    a = Math.log(lo),
    b = Math.log(hi);
  if (L < a) return Math.exp(a - band * (1 - Math.exp((L - a) / band)));
  if (L > b) return Math.exp(b + band * (1 - Math.exp(-(L - b) / band)));
  return v;
}
/**
 * CAM-4a: zooming about the point you pinch. Zooming by z/z0 about a point A keeps A still if the aim moves by
 * (A - aim) * (1 - z/z0); the walking camera keeps you in view, so the lean is capped and eases back when you let go.
 * @param {number} ax the pinched point on the ground (m)
 * @param {number} az
 * @param {number} px the aim's point when the pinch began (m)
 * @param {number} pz
 * @param {number} z0 the zoom when the pinch began
 * @param {number} z the zoom now
 * @param {number} cap the most lean (m)
 * @returns {number[]} the lean [x, z] (m)
 */
export function pinchLean(ax, az, px, pz, z0, z, cap) {
  const k = z0 > 0 && z > 0 ? 1 - z / z0 : 0;
  let x = (ax - px) * k,
    y = (az - pz) * k;
  const n = Math.hypot(x, y),
    m = Math.max(0, cap);
  if (n > m) {
    x *= m / n;
    y *= m / n;
  }
  return [x, y];
}
