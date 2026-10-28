// @ts-check
'use strict';
/* ================= THE SKY TRAIN'S WAY (hub track HB-8, cutscenes track A) =================
   Where a sky train is through its ride from Skyline Station, in the station's own frame (u metres along its front
   toward its right-hand end, w metres back from its front; the track runs along behind it, the map's `landmarks.rail`,
   island-gen.js): it glides in along the track and settles at the platform; you board; it rises straight up on its
   engines to hover over the station, turns its nose to the portal (floating out in front, `landmarks.portal`) and
   shoots into it, shrinking away. Coming home it bursts out of the portal, flies to the hover, turns back along the
   track and sets down. A train model faces its own +x and its footprint lies behind its base point
   (build-station-trains.py, TRAIN_HALF), so its base point stands half its width in front of the track's line, turned
   to the way it faces, its nose up or down as it climbs or dives (HB-6's tilt). Logic only: no DOM, runs in Node
   (tools/test/train-path.test.mjs). */
/** @typedef {[number, number, number]} TrainPoint x, z and height, metres */
/** @typedef {{ x: number, z: number, ax: number[], bw: number[], y0: number }} TrainFrame the station's base point, its
 * front's way to the right-hand end (ax) and back from its front (bw), its level */
/** @typedef {{ x: number, z: number, h: number, dx: number, dz: number, pitch: number }} TrainPose the track line's
 * point under the train's middle, its height, the way it faces and its nose's climb in degrees */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  TRAIN_DEPART: [() => TRAIN_DEPART],
  TRAIN_HOME: [() => TRAIN_HOME],
  TRAIN_PLATFORM: [() => TRAIN_PLATFORM],
  TRAIN_RIDE: [() => TRAIN_RIDE],
  // @ts-expect-error -- replaced on purpose
  trainAt: [() => trainAt, v => (trainAt = v)],
  // @ts-expect-error -- replaced on purpose
  trainBoardPath: [() => trainBoardPath, v => (trainBoardPath = v)],
  trainClamp: [() => trainClamp],
  // @ts-expect-error -- replaced on purpose
  trainDepartAt: [() => trainDepartAt, v => (trainDepartAt = v)],
  trainEase: [() => trainEase],
  // @ts-expect-error -- replaced on purpose
  trainEye: [() => trainEye, v => (trainEye = v)],
  // @ts-expect-error -- replaced on purpose
  trainFrame: [() => trainFrame, v => (trainFrame = v)],
  // @ts-expect-error -- replaced on purpose
  trainHomeAt: [() => trainHomeAt, v => (trainHomeAt = v)],
  // @ts-expect-error -- replaced on purpose
  trainHover: [() => trainHover, v => (trainHover = v)],
  // @ts-expect-error -- replaced on purpose
  trainPlace: [() => trainPlace, v => (trainPlace = v)],
  // @ts-expect-error -- replaced on purpose
  trainWalkAt: [() => trainWalkAt, v => (trainWalkAt = v)],
  // @ts-expect-error -- replaced on purpose
  turnTo: [() => turnTo, v => (turnTo = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the numbers: half a train's width (its base point in front of the track's line), the track's line over the station's
 * ground, where the train stops (u) and the track's line (w) in the station's metres, how high it hovers before it
 * turns to the portal, and the glide in: how far back along the track and how high up it starts */
export const TRAIN_RIDE = { half: 1.3, railTop: 0.13, stop: -0.5, track: 6.1, hover: 11, glide: { back: 44, up: 12 } };
/** the beats (ms): the departure and the way home (the owner, 2026-10-28: you walk up the steps and across the
 * platform into the train, at a walk) */
export const TRAIN_DEPART = { glide: 2600, board: 3200, lift: 2200, turn: 1100, dash: 1200 };
export const TRAIN_HOME = { open: 900, out: 1700, turn: 900, down: 1700, off: 2400 };
/** the platform you walk across to board, in the station's metres (tools/build-station-trains.py station()): the steps
 * from w 0 to 0.9 up to its top 0.93 m over the station's ground, the gap between the two benches facing the trains
 * (u -0.15 to 0.85) where you cross, and its edge, the step into the carriage; the foot of the steps a little in
 * front of them */
export const TRAIN_PLATFORM = { top: 0.93, steps: [0, 0.9], gap: 0.35, edge: 4.35, foot: -1.2 };

export const trainEase = {
  in: (/** @type {number} */ k) => k * k,
  out: (/** @type {number} */ k) => 1 - (1 - k) * (1 - k),
  inOut: (/** @type {number} */ k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
};
export const trainClamp = (/** @type {number} */ k) => Math.max(0, Math.min(1, k));

/** the station's frame from its placement (rot in degrees: its own +x runs (cos, sin)) @param {{ x: number, z: number,
 * rot?: number }} st @param {number} y0 its level @returns {TrainFrame} */
export function trainFrame(st, y0) {
  const r = ((st.rot || 0) * Math.PI) / 180;
  return { x: st.x, z: st.z, ax: [Math.cos(r), Math.sin(r)], bw: [-Math.sin(r), Math.cos(r)], y0 };
}
/** a point in the station's metres on the map: [x, z] @param {TrainFrame} F @param {number} u @param {number} w */
export function trainAt(F, u, w) {
  return [F.x + F.ax[0] * u + F.bw[0] * w, F.z + F.ax[1] * u + F.bw[1] * w];
}
/** a camera's point in the station's metres, h over its level: [x, height, z] @param {TrainFrame} F @param {number} u
 * @param {number} w @param {number} h */
export function trainEye(F, u, w, h) {
  const [x, z] = trainAt(F, u, w);
  return [x, F.y0 + h, z];
}
/** the turn from one heading to another, k of the way, the short way round (radians) @param {number} a @param {number} b
 * @param {number} k */
export function turnTo(a, b, k) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

/** where the hover is (over where the train stops) and how it faces the portal from there: the heading's angle, the
 * nose's climb in degrees, the way across @param {TrainFrame} F @param {TrainPoint} tear landmarks.portal */
export function trainHover(F, tear) {
  const [x, z] = trainAt(F, TRAIN_RIDE.stop, TRAIN_RIDE.track),
    h = F.y0 + TRAIN_RIDE.railTop + TRAIN_RIDE.hover,
    dx = tear[0] - x,
    dz = tear[1] - z,
    run = Math.hypot(dx, dz) || 1;
  return { x, z, h, aim: Math.atan2(dz, dx), climb: (Math.atan2(tear[2] - h, run) * 180) / Math.PI, run };
}

/** the departure t ms in: where the train is, its size (1 as it is, smaller into the portal) and the beat it is in
 * @param {TrainFrame} F @param {TrainPoint} tear @param {number} t
 * @returns {{ at: TrainPose, s: number, beat: string, k: number }} */
export function trainDepartAt(F, tear, t) {
  const D = TRAIN_DEPART,
    G = TRAIN_RIDE.glide,
    H = trainHover(F, tear),
    track = Math.atan2(F.ax[1], F.ax[0]),
    rail = F.y0 + TRAIN_RIDE.railTop,
    pose = (/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ h, a, pitch) => ({
      x,
      z,
      h,
      dx: Math.cos(a),
      dz: Math.sin(a),
      pitch,
    });
  let s = t;
  if (s < D.glide) {
    /* along the track from back past its left-hand end and up in the air, settling where it stops */
    const k = trainClamp(s / D.glide),
      u = 1 - k,
      q = u * u,
      [x, z] = trainAt(F, TRAIN_RIDE.stop - q * G.back, TRAIN_RIDE.track);
    return {
      at: pose(x, z, rail + G.up * q * q, track, -(Math.atan((2 * G.up * q) / G.back) * 180) / Math.PI),
      s: 1,
      beat: 'glide',
      k,
    };
  }
  if ((s -= D.glide) < D.board) return { at: pose(H.x, H.z, rail, track, 0), s: 1, beat: 'board', k: s / D.board };
  if ((s -= D.board) < D.lift) {
    /* straight up on its engines */
    const k = s / D.lift;
    return { at: pose(H.x, H.z, rail + (H.h - rail) * trainEase.inOut(k), track, 0), s: 1, beat: 'lift', k };
  }
  if ((s -= D.lift) < D.turn) {
    /* hovering, its nose round to the portal and up at it */
    const k = trainEase.inOut(s / D.turn);
    return { at: pose(H.x, H.z, H.h, turnTo(track, H.aim, k), H.climb * k), s: 1, beat: 'turn', k: s / D.turn };
  }
  if ((s -= D.turn) < D.dash) {
    /* into the portal, faster and faster, shrinking into it */
    const k = s / D.dash,
      e = trainEase.in(k);
    return {
      at: pose(H.x + (tear[0] - H.x) * e, H.z + (tear[1] - H.z) * e, H.h + (tear[2] - H.h) * e, H.aim, H.climb),
      s: 1 - 0.92 * trainEase.in(trainClamp((k - 0.45) / 0.55)),
      beat: 'dash',
      k,
    };
  }
  return { at: pose(tear[0], tear[1], tear[2], H.aim, H.climb), s: 0.08, beat: 'gone', k: 1 };
}

/** the way home t ms in: out of the portal to the hover, round along the track, down where it stops
 * @param {TrainFrame} F @param {TrainPoint} tear @param {number} t
 * @returns {{ at: TrainPose, s: number, beat: string, k: number }} */
export function trainHomeAt(F, tear, t) {
  const R = TRAIN_HOME,
    H = trainHover(F, tear),
    track = Math.atan2(F.ax[1], F.ax[0]),
    back = H.aim + Math.PI,
    rail = F.y0 + TRAIN_RIDE.railTop,
    pose = (/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ h, a, pitch) => ({
      x,
      z,
      h,
      dx: Math.cos(a),
      dz: Math.sin(a),
      pitch,
    });
  let s = t;
  if (s < R.open) return { at: pose(tear[0], tear[1], tear[2], back, -H.climb), s: 0.01, beat: 'open', k: s / R.open };
  if ((s -= R.open) < R.out) {
    /* out of the portal, nose first, slowing to the hover */
    const k = s / R.out,
      e = trainEase.out(k);
    return {
      at: pose(
        tear[0] + (H.x - tear[0]) * e,
        tear[1] + (H.z - tear[1]) * e,
        tear[2] + (H.h - tear[2]) * e,
        back,
        -H.climb
      ),
      s: 0.08 + 0.92 * trainEase.out(trainClamp(k * 2.2)),
      beat: 'out',
      k,
    };
  }
  if ((s -= R.out) < R.turn) {
    const k = trainEase.inOut(s / R.turn);
    return { at: pose(H.x, H.z, H.h, turnTo(back, track, k), -H.climb * (1 - k)), s: 1, beat: 'turn', k: s / R.turn };
  }
  if ((s -= R.turn) < R.down) {
    const k = s / R.down;
    return { at: pose(H.x, H.z, H.h + (rail - H.h) * trainEase.inOut(k), track, 0), s: 1, beat: 'down', k };
  }
  return {
    at: pose(H.x, H.z, rail, track, 0),
    s: 1,
    beat: (s -= R.down) < R.off ? 'off' : 'gone',
    k: trainClamp(s / R.off),
  };
}

/** the way you walk to board, [x, z, height over the station's ground] points: from where you stand (when near the
 * steps; else from their foot) to the foot of the steps, up them onto the platform, across between the benches to its
 * edge. Coming home it is walked backwards, to where the walk stands you after. Never through the station: on the
 * platform you are on its top, and you cross it in the benches' gap
 * @param {TrainFrame} F @param {number[] | null} from [x, z] where you stand @returns {number[][]} */
export function trainBoardPath(F, from) {
  const P = TRAIN_PLATFORM,
    pt = (/** @type {number} */ u, /** @type {number} */ w, /** @type {number} */ h) => [...trainAt(F, u, w), h],
    foot = pt(P.gap, P.foot, 0),
    out = [];
  if (from) {
    /* where you stand, in the station's metres: only from in front of it and within 4 m of the steps' foot */
    const dx = from[0] - F.x,
      dz = from[1] - F.z,
      u = dx * F.ax[0] + dz * F.ax[1],
      w = dx * F.bw[0] + dz * F.bw[1];
    if (w < P.foot && Math.hypot(u - P.gap, w - P.foot) < 4) out.push([from[0], from[1], 0]);
  }
  out.push(foot, pt(P.gap, P.steps[0], 0), pt(P.gap, P.steps[1], P.top), pt(P.gap, P.edge, P.top));
  return out;
}
/** a walk along a path k of the way (0-1), at an even pace: [x, z, height] @param {number[][]} path @param {number} k */
export function trainWalkAt(path, k) {
  const len = [0];
  for (let i = 1; i < path.length; i++)
    len.push(len[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const d = trainClamp(k) * len[len.length - 1];
  let i = 1;
  while (i < path.length - 1 && len[i] < d) i++;
  const a = path[i - 1],
    b = path[i],
    f = len[i] > len[i - 1] ? (d - len[i - 1]) / (len[i] - len[i - 1]) : 1;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** a train's placement at a pose: its base point half its width in front of the track's line (turned to its heading:
 * rot 0 runs +x), its lift over y0 (the height its placement's y stands at) and its nose's tilt
 * @param {TrainPose} at @param {number} y0
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
