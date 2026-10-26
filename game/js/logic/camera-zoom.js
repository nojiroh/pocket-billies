// @ts-check
'use strict';
/* ================= CAMERA ZOOM (camera track CAM-2) =================
   One zoom value drives the walking camera's tilt, distance and field of view, each along its own curve (Nesky,
   "50 Game Camera Mistakes" #16), as plain numbers (tools/test/camera-zoom.test.mjs):
   - zoom 1 is the scene's own framing: no extra tilt, the distance and field of view as they are;
   - CAM-4b: the values come from the zoom stops (below); CAM-2's two ends and curve shape are gone;
   - past an end stop (a moment zooming in further than you can pinch) each value carries on along the slope there.
   The zoom itself is your pinch zoom times the camera goals' zoom (logic/camera-follow.js blendGoals).
   CAM-4a, the zoom's feel (Camera > Feel): the zoom eases in log space (each second takes the same share of the way
   at any zoom, so pinching in and out feels alike), the pinch's sensitivity, a soft rubber band past the limits and
   the lean toward the point you pinch.
   CAM-4b, zoom stops (Camera > Zoom stops): 3-5 named stops in zoom order, each with its tilt, distance, field of
   view, blur and look-ahead; between them each value follows a smooth curve through the stops that never overshoots
   (monotone cubic, in zoom), and past the end stops it carries on along the end's slope. The default stops lie on a
   straight line, so they give the zoom before CAM-4b exactly. A pinch let go near a stop eases to it. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  STOP_VALUES: [() => STOP_VALUES],
  ZOOM_STOPS: [() => ZOOM_STOPS],
  // @ts-expect-error -- replaced on purpose
  monotoneAt: [() => monotoneAt, v => (monotoneAt = v)],
  // @ts-expect-error -- replaced on purpose
  monotoneSlopes: [() => monotoneSlopes, v => (monotoneSlopes = v)],
  // @ts-expect-error -- replaced on purpose
  nearestStop: [() => nearestStop, v => (nearestStop = v)],
  // @ts-expect-error -- replaced on purpose
  nextStop: [() => nextStop, v => (nextStop = v)],
  // @ts-expect-error -- replaced on purpose
  pinchLean: [() => pinchLean, v => (pinchLean = v)],
  // @ts-expect-error -- replaced on purpose
  pinchZoom: [() => pinchZoom, v => (pinchZoom = v)],
  stopCurveMemo: [() => stopCurveMemo],
  // @ts-expect-error -- replaced on purpose
  stopCurves: [() => stopCurves, v => (stopCurves = v)],
  // @ts-expect-error -- replaced on purpose
  stopPull: [() => stopPull, v => (stopPull = v)],
  // @ts-expect-error -- replaced on purpose
  stopShape: [() => stopShape, v => (stopShape = v)],
  // @ts-expect-error -- replaced on purpose
  stopsOrDefault: [() => stopsOrDefault, v => (stopsOrDefault = v)],
  // @ts-expect-error -- replaced on purpose
  stopsProblems: [() => stopsProblems, v => (stopsProblems = v)],
  // @ts-expect-error -- replaced on purpose
  zoomBand: [() => zoomBand, v => (zoomBand = v)],
  // @ts-expect-error -- replaced on purpose
  zoomEase: [() => zoomEase, v => (zoomEase = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
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
/**
 * @typedef {object} ZoomStop
 * @property {string} id fixed when the stop is made; a scene's `cam.stop` names it
 * @property {string} name what the Studio shows
 * @property {number} zoom where it sits (1: the scene's own framing; below: closer)
 * @property {number} pitch degrees added to the tilt there
 * @property {number} dist the distance's factor there
 * @property {number} fov the field of view's factor there
 * @property {number} blur the lens blur's factor there (times the player's Blur slider)
 * @property {number} lead the look-ahead's factor there
 */
/** CAM-4b: the default stops, from the two ends before CAM-4b: the same picture at every zoom (14 degrees of tilt a unit
    of zoom, the distance times the zoom, the same field of view) */
export const ZOOM_STOPS = /** @type {ZoomStop[]} */ ([
  { id: 'close', name: 'Close', zoom: 0.55, pitch: -6.3, dist: 0.55, fov: 1, blur: 1, lead: 1 },
  { id: 'normal', name: 'Normal', zoom: 1, pitch: 0, dist: 1, fov: 1, blur: 1, lead: 1 },
  { id: 'far', name: 'Far', zoom: 1.7, pitch: 9.8, dist: 1.7, fov: 1, blur: 1, lead: 1 },
]);
/** the values a stop carries, in the order the curve graph draws them */
export const STOP_VALUES = /** @type {const} */ (['pitch', 'dist', 'fov', 'blur', 'lead']);
/**
 * What is wrong with a list of stops (none: it can be used): 3-5 stops, ids unique, zooms above 0 and rising, every
 * value a number.
 * @param {any} S
 * @returns {string[]}
 */
export function stopsProblems(S) {
  if (!Array.isArray(S)) return ['the stops are not a list'];
  const out = [];
  if (S.length < 3 || S.length > 5) out.push(`${S.length} stops (3-5)`);
  const ids = new Set();
  S.forEach((s, i) => {
    if (!s || typeof s !== 'object') return out.push(`stop ${i + 1} is not a stop`);
    if (typeof s.id !== 'string' || !s.id) out.push(`stop ${i + 1} has no id`);
    else if (ids.has(s.id)) out.push(`stop id ${s.id} twice`);
    else ids.add(s.id);
    for (const k of ['zoom', ...STOP_VALUES])
      if (typeof s[k] !== 'number' || !isFinite(s[k])) out.push(`stop ${s.id || i + 1}: ${k} is not a number`);
    if (!(s.zoom > 0)) out.push(`stop ${s.id || i + 1}: zoom must be above 0`);
    else if (i && S[i - 1] && !(s.zoom > S[i - 1].zoom)) out.push(`stop ${s.id || i + 1}: zoom must rise`);
  });
  return out;
}
/**
 * The stops if they can be used, else the default ones (a broken list never breaks the camera).
 * @param {any} S
 * @returns {ZoomStop[]}
 */
export function stopsOrDefault(S) {
  return stopsProblems(S).length ? ZOOM_STOPS : S;
}
/* the slopes of a monotone cubic through the points (x rising): the weighted harmonic mean of the neighbouring
   secants where they agree in sign, 0 where they don't (Fritsch and Carlson; Matlab's pchip); one-sided at the ends.
   Points on a straight line get its slope everywhere, so the curve is that line. */
export function monotoneSlopes(xs, ys) {
  const n = xs.length,
    h = [],
    d = [],
    m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i]);
    d.push((ys[i + 1] - ys[i]) / h[i]);
  }
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const a = d[i - 1],
      b = d[i];
    if (a * b <= 0) continue;
    if (Math.abs(a - b) < 1e-12) m[i] = a;
    else {
      const w1 = 2 * h[i] + h[i - 1],
        w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / a + w2 / b);
    }
  }
  /* the one-sided end slopes can still overshoot inside the end piece: kept within three times its secant */
  for (const [i, k] of [
    [0, 0],
    [n - 1, n - 2],
  ])
    if (m[i] * d[k] <= 0) m[i] = 0;
    else if (Math.abs(m[i]) > 3 * Math.abs(d[k])) m[i] = 3 * d[k];
  return m;
}
/* one value at x along the cubic (Hermite form), straight on along the end slope past the ends */
export function monotoneAt(xs, ys, m, x) {
  const n = xs.length;
  if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
  if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
  let i = 0;
  while (x > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i],
    t = (x - xs[i]) / h,
    t2 = t * t,
    t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * ys[i] +
    (t3 - 2 * t2 + t) * h * m[i] +
    (-2 * t3 + 3 * t2) * ys[i + 1] +
    (t3 - t2) * h * m[i + 1]
  );
}
/* the curves are the same for every frame until the stops change: kept for the last list seen */
export const stopCurveMemo = { of: /** @type {any} */ (null), key: '', curve: /** @type {any} */ (null) };
/**
 * @param {ZoomStop[]} S
 * @returns {any}
 */
export function stopCurves(S) {
  const M = stopCurveMemo;
  if (S === M.of && M.curve) return M.curve;
  const key = JSON.stringify(S);
  if (key !== M.key || !M.curve) {
    const xs = S.map(s => s.zoom),
      /** @type {any} */
      C = { xs };
    for (const k of STOP_VALUES) {
      const ys = S.map(s => s[k]);
      C[k] = [ys, monotoneSlopes(xs, ys)];
    }
    M.curve = C;
    M.key = key;
  }
  M.of = S;
  return M.curve;
}
/**
 * CAM-4b: the tilt (degrees added), distance factor, field of view factor, blur factor and look-ahead factor at a zoom.
 * @param {number} z the zoom
 * @param {ZoomStop[]} stops a list stopsProblems passes
 * @returns {{pitch: number, dist: number, fov: number, blur: number, lead: number}}
 */
export function stopShape(z, stops) {
  const C = stopCurves(stops),
    at = k => monotoneAt(C.xs, C[k][0], C[k][1], z);
  return {
    pitch: at('pitch'),
    dist: Math.max(0.15, at('dist')),
    fov: Math.max(0.2, at('fov')),
    blur: Math.max(0, at('blur')),
    lead: Math.max(0, at('lead')),
  };
}
/**
 * CAM-4b: the stop nearest a zoom, in log zoom (as far from 0.5 to 1 as from 1 to 2).
 * @param {number} z
 * @param {ZoomStop[]} stops
 * @returns {number} its index
 */
export function nearestStop(z, stops) {
  let best = 0,
    bd = Infinity;
  const L = Math.log(Math.max(1e-6, z));
  stops.forEach((s, i) => {
    const d = Math.abs(Math.log(s.zoom) - L);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
/**
 * CAM-4b: where a pinch let go at zoom z settles: the nearest stop if it lies within `share` of the gap to it (in log
 * zoom; 0: nowhere, 0.5: always the nearest), else z as it is.
 * @param {number} z
 * @param {ZoomStop[]} stops
 * @param {number} share
 * @returns {{zoom: number, stop: ZoomStop | null}}
 */
export function stopPull(z, stops, share) {
  if (!(share > 0) || !(z > 0)) return { zoom: z, stop: null };
  const i = nearestStop(z, stops),
    s = stops[i],
    L = Math.log(z),
    S = Math.log(s.zoom),
    /* the gap on the side z lies; past an end stop, the gap inside it */
    j = L < S ? (i > 0 ? i - 1 : i + 1) : i < stops.length - 1 ? i + 1 : i - 1,
    gap = Math.abs(Math.log(stops[j].zoom) - S);
  return Math.abs(L - S) <= Math.min(0.5, share) * gap + 1e-9 ? { zoom: s.zoom, stop: s } : { zoom: z, stop: null };
}
/**
 * CAM-4b: the stop after the one nearest the zoom, round to the first after the last (a two-finger tap, Z).
 * @param {number} z
 * @param {ZoomStop[]} stops
 * @returns {ZoomStop}
 */
export function nextStop(z, stops) {
  return stops[(nearestStop(z, stops) + 1) % stops.length];
}
