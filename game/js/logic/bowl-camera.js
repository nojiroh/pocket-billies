// @ts-check
'use strict';
/* ================= THE BOWL'S CAMERA (phase 10, session E-map-3) =================
   The world map looks into the bowl from above, like a tabletop diorama (docs/phases/10-world-map-bowl.md). The camera
   circles a target on the ground: yaw turns it round, tilt is how far it looks down (90 degrees: straight down),
   dist is how far it sits from the target. It never drops below the rim line and never leaves the bowl's air.
   Coordinates: the bowl's own (logic/bowl.js) are x east, y north, h up; the GPU's are [x, h, -y] (y up, as the walk
   renderer). Logic only: no DOM, runs in Node; the map draws with what bowlCamView returns. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { BOWL_RIM_HEIGHT, bowlBaseHeight, bowlGridHeight } from './bowl.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_CAMERA: [() => BOWL_CAMERA],
  DEG: [() => DEG],
  FLOAT_CAMERA: [() => FLOAT_CAMERA],
  // @ts-expect-error -- replaced on purpose
  add: [() => add, v => (add = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamClamp: [() => bowlCamClamp, v => (bowlCamClamp = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamClampFloat: [() => bowlCamClampFloat, v => (bowlCamClampFloat = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamEase: [() => bowlCamEase, v => (bowlCamEase = v)],
  bowlCamFloat: [() => bowlCamFloat, v => (bowlCamFloat = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamGap: [() => bowlCamGap, v => (bowlCamGap = v)],
  bowlCamGround: [() => bowlCamGround, v => (bowlCamGround = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamHome: [() => bowlCamHome, v => (bowlCamHome = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamHomeFloat: [() => bowlCamHomeFloat, v => (bowlCamHomeFloat = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamLookView: [() => bowlCamLookView, v => (bowlCamLookView = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamMatrix: [() => bowlCamMatrix, v => (bowlCamMatrix = v)],
  bowlCamOverview: [() => bowlCamOverview],
  // @ts-expect-error -- replaced on purpose
  bowlCamPan: [() => bowlCamPan, v => (bowlCamPan = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamProject: [() => bowlCamProject, v => (bowlCamProject = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamRay: [() => bowlCamRay, v => (bowlCamRay = v)],
  bowlCamTurn: [() => bowlCamTurn],
  // @ts-expect-error -- replaced on purpose
  bowlCamUseFloat: [() => bowlCamUseFloat, v => (bowlCamUseFloat = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamUseGround: [() => bowlCamUseGround, v => (bowlCamUseGround = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCamView: [() => bowlCamView, v => (bowlCamView = v)],
  bowlCamZoom: [() => bowlCamZoom],
  // @ts-expect-error -- replaced on purpose
  bowlPickGround: [() => bowlPickGround, v => (bowlPickGround = v)],
  // @ts-expect-error -- replaced on purpose
  bowlSurface: [() => bowlSurface, v => (bowlSurface = v)],
  bowlToGpu: [() => bowlToGpu],
  // @ts-expect-error -- replaced on purpose
  cross: [() => cross, v => (cross = v)],
  // @ts-expect-error -- replaced on purpose
  dot: [() => dot, v => (dot = v)],
  // @ts-expect-error -- replaced on purpose
  mul: [() => mul, v => (mul = v)],
  // @ts-expect-error -- replaced on purpose
  norm: [() => norm, v => (norm = v)],
  // @ts-expect-error -- replaced on purpose
  sub: [() => sub, v => (sub = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const DEG = Math.PI / 180;
/** limits and the opening view. Distances are in bowl radii. */
export const BOWL_CAMERA = {
  /** the view's height in degrees */
  fov: 50,
  /** opening tilt (owner, 2026-10-19: about 50 degrees) and the range a player can tilt in */
  tilt: 50 * DEG,
  tiltMin: 35 * DEG,
  tiltMax: 89.5 * DEG,
  /** zoom (owner: from the whole bowl down to about one region) */
  dist: 1.0,
  distMin: 0.45,
  distMax: 2.6,
  /** the whole bowl at once */
  overview: { dist: 2.4, tilt: 62 * DEG },
  /** how far out the target may go, and how far above the rim the eye stays */
  targetMax: 0.95,
  eyeAboveRim: 0.05,
  near: 0.01,
  far: 10,
};

/** th: the target's height when it is fixed (the floating island's pivot); else the ground under the target
 * @typedef {{ tx: number, ty: number, yaw: number, tilt: number, dist: number, th?: number }} BowlCamState */
/** @typedef {[number, number, number]} V3 */
/** @typedef {{ C: V3, fw: V3, rt: V3, up: V3, foc: number, W: number, H: number, near: number, far: number }} BowlView */

/** the GPU's point for a point of the bowl @param {number} x @param {number} y @param {number} h @returns {V3} */
export const bowlToGpu = (x, y, h) => [x, h, -y];
/** the drawn ground (logic/bowl.js bowlGroundGrid), once the map has made it; until then the bowl without relief */
/** @type {import('./bowl.js').BowlGround | null} */
export let bowlCamGround = null;
/** @param {import('./bowl.js').BowlGround | null} G */
export function bowlCamUseGround(G) {
  bowlCamGround = G;
}
/** the ground's height anywhere, as drawn @param {number} x @param {number} y */
export function bowlSurface(x, y) {
  return bowlCamGround ? bowlGridHeight(bowlCamGround, x, y) : bowlBaseHeight(x, y);
}
/** the hub's floating island (the owner, 2026-10-23: no bowl, an island in open sky): the camera orbits its middle
 * like the walk's orbit camera (logic/camera-orbit.js). Limits are shares of the island's radius r. */
export const FLOAT_CAMERA = {
  tilt: 45 * DEG,
  tiltMin: 12 * DEG,
  tiltMax: 75 * DEG,
  dist: 5,
  distMin: 1.8,
  distMax: 8,
  /** how far from the middle the target may go */
  pan: 0.5,
  /** the slow turn while nobody touches the map (radians a second) */
  drift: 0.03,
};
/** @typedef {{ c: number[], r: number, th: number }} FloatFrame the island's middle, radius and the pivot's height */
/** the floating island the camera orbits, or null for the bowl @type {FloatFrame | null} */
export let bowlCamFloat = null;
/** @param {FloatFrame | null} F */
export function bowlCamUseFloat(F) {
  bowlCamFloat = F;
}
/** a state inside the floating island's limits: the target near its middle at the pivot's height, the eye between
 * close and far, never under the horizon or straight down
 * @param {BowlCamState} s @param {FloatFrame} F @returns {BowlCamState} */
export function bowlCamClampFloat(s, F) {
  const K = FLOAT_CAMERA;
  let { tx, ty, yaw, tilt, dist } = s;
  const dx = tx - F.c[0],
    dy = ty - F.c[1],
    m = Math.hypot(dx, dy),
    lim = F.r * K.pan;
  if (m > lim) {
    tx = F.c[0] + (dx * lim) / m;
    ty = F.c[1] + (dy * lim) / m;
  }
  dist = Math.min(F.r * K.distMax, Math.max(F.r * K.distMin, dist));
  tilt = Math.min(K.tiltMax, Math.max(K.tiltMin, tilt));
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  return { tx, ty, yaw, tilt, dist, th: F.th };
}
/** the floating island's opening view: its middle, from the side yaw looks from, a low three-quarter view
 * @param {FloatFrame} F @param {number} [yaw] @returns {BowlCamState} */
export function bowlCamHomeFloat(F, yaw = 0) {
  return bowlCamClampFloat({ tx: F.c[0], ty: F.c[1], yaw, tilt: FLOAT_CAMERA.tilt, dist: F.r * FLOAT_CAMERA.dist }, F);
}
/** a state kept inside every limit (the floating island's, while one is in) @param {BowlCamState} s
 * @returns {BowlCamState} */
export function bowlCamClamp(s) {
  if (bowlCamFloat) return bowlCamClampFloat(s, bowlCamFloat);
  const K = BOWL_CAMERA;
  let { tx, ty, yaw, tilt, dist } = s;
  const r = Math.hypot(tx, ty);
  if (r > K.targetMax) {
    tx *= K.targetMax / r;
    ty *= K.targetMax / r;
  }
  dist = Math.min(K.distMax, Math.max(K.distMin, dist));
  tilt = Math.min(K.tiltMax, Math.max(K.tiltMin, tilt));
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  /* never below the rim line: look down more, and if that is not enough, back off */
  const need = BOWL_RIM_HEIGHT + K.eyeAboveRim - bowlSurface(tx, ty);
  if (dist * Math.sin(tilt) < need) {
    if (need / dist <= Math.sin(K.tiltMax)) tilt = Math.asin(need / dist);
    else {
      tilt = K.tiltMax;
      dist = need / Math.sin(K.tiltMax);
    }
  }
  return { tx, ty, yaw, tilt, dist };
}

/** the view: eye, axes and focal length for a screen W by H pixels
 * @param {BowlCamState} s @param {number} W @param {number} H @returns {BowlView} */
export function bowlCamView(s, W, H) {
  const K = BOWL_CAMERA,
    fh = [Math.sin(s.yaw), Math.cos(s.yaw)],
    th = s.th != null ? s.th : bowlSurface(s.tx, s.ty),
    back = s.dist * Math.cos(s.tilt),
    /** @type {V3} */ T = bowlToGpu(s.tx, s.ty, th),
    /** @type {V3} */ C = bowlToGpu(s.tx - fh[0] * back, s.ty - fh[1] * back, th + s.dist * Math.sin(s.tilt)),
    fw = norm(sub(T, C)),
    /** @type {V3} */ rt = bowlToGpu(fh[1], -fh[0], 0),
    up = cross(rt, fw);
  return { C, fw, rt, up, foc: H / 2 / Math.tan((K.fov * DEG) / 2), W, H, near: K.near, far: K.far };
}

/** the view as a matrix for the GPU (column-major, clip w = depth along the view), as world-map-gl.js builds its own
 * @param {BowlView} v @returns {Float32Array} */
export function bowlCamMatrix(v) {
  const ax = (2 * v.foc) / v.W,
    ay = (2 * v.foc) / v.H,
    A = (v.far + v.near) / (v.far - v.near),
    B = (-2 * v.far * v.near) / (v.far - v.near),
    m = new Float32Array(16);
  /** @param {number} row @param {V3} a @param {number} w */
  const set = (row, a, w) => {
    m[row] = a[0];
    m[4 + row] = a[1];
    m[8 + row] = a[2];
    m[12 + row] = w;
  };
  set(0, mul(v.rt, ax), -ax * dot(v.rt, v.C));
  set(1, mul(v.up, ay), -ay * dot(v.up, v.C));
  set(2, mul(v.fw, A), -A * dot(v.fw, v.C) + B);
  set(3, v.fw, -dot(v.fw, v.C));
  return m;
}

/** where a GPU point lands on the screen (pixels, y down), or null behind the eye
 * @param {BowlView} v @param {V3} p @returns {{ x: number, y: number, z: number } | null} */
export function bowlCamProject(v, p) {
  const d = sub(p, v.C),
    z = dot(d, v.fw);
  if (z < v.near) return null;
  return { x: v.W / 2 + (v.foc * dot(d, v.rt)) / z, y: v.H / 2 - (v.foc * dot(d, v.up)) / z, z };
}

/** the ray through a screen point @param {BowlView} v @param {number} sx @param {number} sy
 * @returns {V3} a unit direction from v.C */
export function bowlCamRay(v, sx, sy) {
  const dx = (sx - v.W / 2) / v.foc,
    dy = (v.H / 2 - sy) / v.foc;
  return norm(add(v.fw, add(mul(v.rt, dx), mul(v.up, dy))));
}

/** the ground under a screen point, in the bowl's coordinates, or null when the ray misses it
 * @param {BowlView} v @param {number} sx @param {number} sy @returns {[number, number] | null} */
export function bowlPickGround(v, sx, sy) {
  const d = bowlCamRay(v, sx, sy),
    above = (/** @type {number} */ t) => {
      const p = add(v.C, mul(d, t));
      return p[1] - bowlSurface(p[0], -p[2]);
    };
  let t0 = v.near,
    g0 = above(t0);
  if (g0 <= 0) return null;
  const N = 240,
    step = (v.far - v.near) / N;
  for (let i = 1; i <= N; i++) {
    const t1 = v.near + i * step,
      g1 = above(t1);
    if (g1 <= 0) {
      let a = t0,
        b = t1;
      for (let k = 0; k < 30; k++) {
        const m = (a + b) / 2;
        if (above(m) > 0) a = m;
        else b = m;
      }
      const p = add(v.C, mul(d, (a + b) / 2));
      return [p[0], -p[2]];
    }
    t0 = t1;
    g0 = g1;
  }
  return null;
}

/** one finger dragged dx, dy pixels: the land follows the finger @param {BowlCamState} s @param {BowlView} v
 * @param {number} dx @param {number} dy @returns {BowlCamState} */
export function bowlCamPan(s, v, dx, dy) {
  const k = s.dist / v.foc,
    fh = [Math.sin(s.yaw), Math.cos(s.yaw)],
    rh = [fh[1], -fh[0]],
    f = dy * (k / Math.max(Math.sin(s.tilt), 0.5));
  return bowlCamClamp({ ...s, tx: s.tx - rh[0] * dx * k + fh[0] * f, ty: s.ty - rh[1] * dx * k + fh[1] * f });
}

/** zoom by a factor (below 1: closer) @param {BowlCamState} s @param {number} f @returns {BowlCamState} */
export const bowlCamZoom = (s, f) => bowlCamClamp({ ...s, dist: s.dist * f });
/** turn and tilt by angles in radians @param {BowlCamState} s @param {number} dYaw @param {number} dTilt
 * @returns {BowlCamState} */
export const bowlCamTurn = (s, dYaw, dTilt) => bowlCamClamp({ ...s, yaw: s.yaw + dYaw, tilt: s.tilt + dTilt });

/** the view of a place: centred on it, looking outward (towards the wall that rises behind it), at the opening tilt
 * and zoom @param {number} x @param {number} y @param {number} [yaw] the current yaw, kept near the centre
 * @returns {BowlCamState} */
export function bowlCamHome(x, y, yaw = 0) {
  const r = Math.hypot(x, y);
  return bowlCamClamp({
    tx: x,
    ty: y,
    yaw: r > 0.05 ? Math.atan2(x, y) : yaw,
    tilt: BOWL_CAMERA.tilt,
    dist: BOWL_CAMERA.dist,
  });
}
/** the whole bowl @param {number} [yaw] @returns {BowlCamState} */
export const bowlCamOverview = (yaw = 0) =>
  bowlCamClamp({ tx: 0, ty: 0, yaw, tilt: BOWL_CAMERA.overview.tilt, dist: BOWL_CAMERA.overview.dist });

/** a step towards a goal: k is how much of the way (0-1); yaw takes the short way round
 * @param {BowlCamState} s @param {BowlCamState} g @param {number} k @returns {BowlCamState} */
export function bowlCamEase(s, g, k) {
  let dy = g.yaw - s.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  return {
    tx: s.tx + (g.tx - s.tx) * k,
    ty: s.ty + (g.ty - s.ty) * k,
    yaw: s.yaw + dy * k,
    tilt: s.tilt + (g.tilt - s.tilt) * k,
    dist: s.dist + (g.dist - s.dist) * k,
    ...(g.th != null ? { th: s.th != null ? s.th + (g.th - s.th) * k : g.th } : {}),
  };
}
/** how far a state is from a goal (for "arrived") @param {BowlCamState} s @param {BowlCamState} g */
export function bowlCamGap(s, g) {
  const dy = Math.atan2(Math.sin(g.yaw - s.yaw), Math.cos(g.yaw - s.yaw));
  return Math.max(
    Math.hypot(g.tx - s.tx, g.ty - s.ty),
    Math.abs(dy) * 0.3,
    Math.abs(g.tilt - s.tilt) * 0.3,
    Math.abs(g.dist - s.dist)
  );
}

/* small vector helpers */
/** @param {V3} a @param {V3} b @returns {V3} */
export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
/** @param {V3} a @param {V3} b @returns {V3} */
export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
/** @param {V3} a @param {number} k @returns {V3} */
export function mul(a, k) {
  return [a[0] * k, a[1] * k, a[2] * k];
}
/** @param {V3} a @param {V3} b */
export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
/** @param {V3} a @param {V3} b @returns {V3} */
export function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
/** @param {V3} a @returns {V3} */
export function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** a view from an eye looking at a target (the opening fall films the bowl this way), tipped by roll radians
 * @param {V3} C @param {V3} T @param {number} W @param {number} H @param {number} [roll] @returns {BowlView} */
export function bowlCamLookView(C, T, W, H, roll = 0) {
  const K = BOWL_CAMERA,
    fw = norm(sub(T, C)),
    /** @type {V3} */ ref = Math.abs(fw[1]) > 0.98 ? [0, 0, -1] : [0, 1, 0],
    rt0 = norm(cross(fw, ref)),
    up0 = cross(rt0, fw),
    c = Math.cos(roll),
    s = Math.sin(roll),
    rt = norm(add(mul(rt0, c), mul(up0, s))),
    up = cross(rt, fw);
  return { C, fw, rt, up, foc: H / 2 / Math.tan((K.fov * DEG) / 2), W, H, near: K.near, far: K.far };
}
