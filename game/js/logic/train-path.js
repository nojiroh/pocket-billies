// @ts-check
'use strict';
/* ================= THE SKY TRAIN'S WAY (hub track HB-8) =================
   Where a sky train is along its ride from Skyline Station: the station's track bed, the sky rail (the map's
   `landmarks.rail`, a point every 2 m with the rail's height, from island-gen.js) and the portal's tear. A train model
   faces its own +x and its footprint lies behind its base point (build-station-trains.py, TRAIN_HALF), so its base point
   stands half its width in front of the rail, turned to the way it goes, its nose up on a climb (HB-6's tilt). Logic
   only: no DOM, runs in Node (tools/test/train-path.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  TRAIN_RIDE: [() => TRAIN_RIDE],
  // @ts-expect-error -- replaced on purpose
  trainGlide: [() => trainGlide, v => (trainGlide = v)],
  // @ts-expect-error -- replaced on purpose
  trainPathAt: [() => trainPathAt, v => (trainPathAt = v)],
  // @ts-expect-error -- replaced on purpose
  trainPathOf: [() => trainPathOf, v => (trainPathOf = v)],
  // @ts-expect-error -- replaced on purpose
  trainPlace: [() => trainPlace, v => (trainPlace = v)],
  // @ts-expect-error -- replaced on purpose
  trainRoute: [() => trainRoute, v => (trainRoute = v)],
  trainRouteBack: [() => trainRouteBack],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {[number, number, number]} TrainPoint x, z and the rail's height (its tube's axis), metres */
/** @typedef {{ pts: TrainPoint[], at: number[], len: number }} TrainPath */

/** the numbers: half a train's width (its base point in front of the rail), the rail's axis over a piece's base, how
 * far behind the station's middle the train stops, half a train's length (its pitch from the rail under each end), and
 * the glide in: how far back along the track and how high up it starts */
export const TRAIN_RIDE = { half: 1.3, railTop: 0.13, stop: -0.5, ends: 5, glide: { back: 44, up: 12 } };

/** a path through the points, with the distance along it at each @param {TrainPoint[]} pts @returns {TrainPath} */
export function trainPathOf(pts) {
  const at = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    at.push(at[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return { pts, at, len: at[at.length - 1] || 0 };
}

/** the point d metres along the path (held at its ends), its heading (a unit x, z) and how steep it climbs there
 * (degrees, from the rail under a train's two ends) @param {TrainPath} P @param {number} d
 * @returns {{ x: number, z: number, h: number, dx: number, dz: number, pitch: number }} */
export function trainPathAt(P, d) {
  const n = P.pts.length;
  const point = (/** @type {number} */ s) => {
    const q = Math.max(0, Math.min(P.len, s));
    let i = 1;
    while (i < n - 1 && P.at[i] < q) i++;
    const a = P.pts[i - 1],
      b = P.pts[i] || a,
      L = P.at[i] - P.at[i - 1],
      k = L > 0 ? (q - P.at[i - 1]) / L : 0;
    return { a, b, x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, h: a[2] + (b[2] - a[2]) * k };
  };
  const p = point(d),
    e = TRAIN_RIDE.ends,
    f = point(d + e),
    r = point(d - e),
    run = Math.hypot(f.x - r.x, f.z - r.z),
    hx = p.b[0] - p.a[0],
    hz = p.b[1] - p.a[1],
    hl = Math.hypot(hx, hz) || 1;
  return {
    x: p.x,
    z: p.z,
    h: p.h,
    dx: hx / hl,
    dz: hz / hl,
    pitch: run > 1e-6 ? (Math.atan2(f.h - r.h, run) * 180) / Math.PI : 0,
  };
}

/** the departure's way: from where the train stops at the station (its middle on the track bed, the rail's height at
 * the station) along the sky rail to its launch lip, then into the tear. The return runs it backwards.
 * @param {TrainPoint[]} rail the map's landmarks.rail @param {TrainPoint} tear landmarks.portal
 * @param {number} stopX the train's middle at the station (x, on the rail's line) @returns {TrainPath} */
export function trainRoute(rail, tear, stopX) {
  const r0 = rail[0];
  /** @type {TrainPoint[]} */
  const pts = [[stopX, r0[1], r0[2]], ...rail.filter(p => p[0] > stopX + 0.01), tear];
  return trainPathOf(pts);
}

/** the same way backwards (the return: out of the tear, down the rail to the station) @param {TrainPath} P */
export const trainRouteBack = P => trainPathOf(P.pts.slice().reverse());

/** the glide in: k (0-1, eased out) of the way from back along the track and up in the air down onto the track bed
 * where the train stops @param {TrainPoint} stop @param {number} k @returns {{ x: number, z: number, h: number,
 * dx: number, dz: number, pitch: number }} */
export function trainGlide(stop, k) {
  const G = TRAIN_RIDE.glide,
    u = 1 - Math.max(0, Math.min(1, k)),
    /* the share of the way still to go (eased out), and the height as its square: it slopes down onto the track */
    s = u * u;
  return {
    x: stop[0] - s * G.back,
    z: stop[1],
    h: stop[2] + G.up * s * s,
    dx: 1,
    dz: 0,
    pitch: G.back > 0 ? -(Math.atan((2 * G.up * s) / G.back) * 180) / Math.PI : 0,
  };
}

/** a train's placement at a point of its way: its base point half its width in front of the rail (turned to its
 * heading: rot 0 runs +x), its lift over y0 (the height its placement's y stands at) and its nose's tilt
 * @param {{ x: number, z: number, h: number, dx: number, dz: number, pitch: number }} at @param {number} y0
 * @returns {{ x: number, z: number, rot: number, lift: number, tilt: [number, number] }} */
export function trainPlace(at, y0) {
  const th = Math.atan2(at.dz, at.dx),
    half = TRAIN_RIDE.half;
  return {
    x: at.x + Math.sin(th) * half,
    z: at.z - Math.cos(th) * half,
    rot: (th * 180) / Math.PI,
    lift: at.h - TRAIN_RIDE.railTop - y0,
    /* its top leans toward its own +x: nose up on a climb is a lean back */
    tilt: [-at.pitch, 0],
  };
}
