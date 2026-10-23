// @ts-check
'use strict';
/* ================= LENS FOCUS (camera track CAM-3) =================
   The diorama blur's plane of focus, as plain numbers (tools/test/lens-focus.test.mjs). The blur shader
   (engine/post-effects.js, dof) and the Studio's blur guides use the same numbers, so what the guides tint is
   what the blur keeps sharp.
   - A pixel's distance from the plane of focus decides its blur. Before CAM-3 the plane always faced the camera (a
     slab of the view's depth around the focus). Now it can lean: tilt 0 is that slab; tilt 1 is an upright wall
     through the focus point, square to the ground, so whatever stands in the strip is sharp head to toe and the
     ground ahead and behind melts away (a tilt-shift miniature).
   - For a pixel at screen place (u, v) (0-1) and view depth z, its distance from any plane is
     z * (g0 + gx*u + gy*v) - h: the camera gives g0, gx, gy and h once a frame (focusPlane) and the shader does three
     multiplies. Tilt 0 gives g = (1, 0, 0) and h = the focus distance: exactly the old z - focus.
   - The blur grows from the plane's distance as before: sharp within the band (0.6 of it on the near side), then up
     to full blur over the far or near ramp (focusBlur, the shader's smoothsteps).
   - What the focus is on (focusAim): you; the spot you tapped (in over 0.35 s, held, out by 2.6 s, as before); in a
     talk the middle of you and the speaker (the two-shot, both sharp); an encounter's spot while the camera swoops;
     a boss when its reveal plays. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  edgeBlur: [() => edgeBlur, v => (edgeBlur = v)],
  // @ts-expect-error -- replaced on purpose
  focusAim: [() => focusAim, v => (focusAim = v)],
  // @ts-expect-error -- replaced on purpose
  focusBlur: [() => focusBlur, v => (focusBlur = v)],
  // @ts-expect-error -- replaced on purpose
  focusPlane: [() => focusPlane, v => (focusPlane = v)],
  // @ts-expect-error -- replaced on purpose
  leanStep: [() => leanStep, v => (leanStep = v)],
  lensDot: [() => lensDot],
  // @ts-expect-error -- replaced on purpose
  lensSmooth: [() => lensSmooth, v => (lensSmooth = v)],
  lensUnit: [() => lensUnit],
  // @ts-expect-error -- replaced on purpose
  planeDistance: [() => planeDistance, v => (planeDistance = v)],
  // @ts-expect-error -- replaced on purpose
  unprojectNdc: [() => unprojectNdc, v => (unprojectNdc = v)],
  // @ts-expect-error -- replaced on purpose
  viewRays: [() => viewRays, v => (viewRays = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {[number, number, number]} V3 */
/**
 * A point on screen at NDC (x, y, z) back into the world, through the inverse view-projection matrix (column-major,
 * as WebGL keeps it).
 * @param {ArrayLike<number>} m
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {V3}
 */
export function unprojectNdc(m, x, y, z) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}
/** @param {V3} a @param {V3} b */
export const lensDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** @param {V3} a @returns {V3} */
export const lensUnit = a => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
/**
 * The camera's eye and, for a screen place (u, v), the step in the world per metre of view depth (so a pixel at
 * depth z is at eye + ray * z).
 * @param {ArrayLike<number>} ivp
 * @param {number} near
 * @param {number} far
 */
export function viewRays(ivp, near, far) {
  /** @param {number} u @param {number} v @returns {V3} */
  const ray = (u, v) => {
    const a = unprojectNdc(ivp, u * 2 - 1, v * 2 - 1, -1),
      b = unprojectNdc(ivp, u * 2 - 1, v * 2 - 1, 1),
      k = 1 / (far - near);
    return [(b[0] - a[0]) * k, (b[1] - a[1]) * k, (b[2] - a[2]) * k];
  };
  const r00 = ray(0, 0),
    r10 = ray(1, 0),
    r01 = ray(0, 1),
    a = unprojectNdc(ivp, -1, -1, -1),
    /** @type {V3} */
    eye = [a[0] - r00[0] * near, a[1] - r00[1] * near, a[2] - r00[2] * near],
    /** the view's axis: square to the near plane, pointing into the picture */
    ax = r10.map((c, i) => c - r00[i]),
    ay = r01.map((c, i) => c - r00[i]);
  /** @type {V3} */
  let fwd = lensUnit([ax[1] * ay[2] - ax[2] * ay[1], ax[2] * ay[0] - ax[0] * ay[2], ax[0] * ay[1] - ax[1] * ay[0]]);
  if (lensDot(fwd, r00) < 0) fwd = [-fwd[0], -fwd[1], -fwd[2]];
  return { eye, fwd, r00, r10, r01 };
}
/**
 * @typedef {object} FocusPlane
 * @property {V3} eye the camera
 * @property {V3} fwd the view's axis
 * @property {V3} n the plane's normal (away from the camera)
 * @property {V3} at a point on the plane (the focus point, moved along the view so its depth is the eased focus)
 * @property {number} h the plane's distance from the eye along n
 * @property {[number, number, number]} g g0, gx, gy: a pixel's distance from the plane is z * (g0 + gx*u + gy*v) - h
 */
/**
 * The plane of focus for a frame.
 * @param {{ivp: ArrayLike<number>, near: number, far: number}} C the camera (walk/camera.js)
 * @param {V3} F the focus point
 * @param {number} focus the eased focus distance along the view (walkRenderer.focus)
 * @param {number} tilt 0: the plane faces the camera; 1: upright, square to the ground
 * @returns {FocusPlane}
 */
export function focusPlane(C, F, focus, tilt) {
  const R = viewRays(C.ivp, C.near, C.far),
    { eye, fwd } = R,
    t = Math.max(0, Math.min(1, tilt || 0)),
    gh = Math.hypot(fwd[0], fwd[2]),
    /** @type {V3} the view's axis laid flat (a camera looking straight down keeps the slab) */
    flat = gh > 1e-4 ? [fwd[0] / gh, 0, fwd[2] / gh] : fwd,
    n = lensUnit([fwd[0] + (flat[0] - fwd[0]) * t, fwd[1] + (flat[1] - fwd[1]) * t, fwd[2] + (flat[2] - fwd[2]) * t]),
    fd = lensDot([F[0] - eye[0], F[1] - eye[1], F[2] - eye[2]], fwd),
    /** @type {V3} */
    at = [F[0] + fwd[0] * (focus - fd), F[1] + fwd[1] * (focus - fd), F[2] + fwd[2] * (focus - fd)],
    h = lensDot([at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]], n),
    g0 = lensDot(R.r00, n);
  return { eye, fwd, n, at, h, g: [g0, lensDot(R.r10, n) - g0, lensDot(R.r01, n) - g0] };
}
/**
 * A world point's distance from the plane (more than 0: beyond it).
 * @param {FocusPlane} P
 * @param {V3} p
 */
export function planeDistance(P, p) {
  return lensDot([p[0] - P.eye[0], p[1] - P.eye[1], p[2] - P.eye[2]], P.n) - P.h;
}
/** @param {number} a @param {number} b @param {number} x */
export function lensSmooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
/**
 * How blurred (0 sharp, 1 full) a point is at distance d from the plane, as the shader works it out.
 * @param {number} d
 * @param {number} band the sharp band beyond the plane (metres); 0.6 of it on the near side
 * @param {number} rampF metres over which the blur builds beyond the band
 * @param {number} rampN the same on the near side
 */
export function focusBlur(d, band, rampF, rampN) {
  return d > 0 ? lensSmooth(band, band + rampF, d) : lensSmooth(band * 0.6, band * 0.6 + rampN, -d);
}
/**
 * The blur at the screen's edges (Engine > Lens > Edge blur), added to a pixel's blur: none in the middle 60% of
 * the screen, growing to k at the corners.
 * @param {number} u
 * @param {number} v
 * @param {number} k
 */
export function edgeBlur(u, v, k) {
  if (!(k > 0)) return 0;
  const x = (u - 0.5) * 2,
    y = (v - 0.5) * 2;
  return k * lensSmooth(0.6, 1.25, Math.hypot(x, y * 0.85));
}
/**
 * @typedef {object} AimInput
 * @property {number} px you
 * @property {number} pz
 * @property {number} t the walk's clock (ms)
 * @property {string|null} [moment] the camera's moment (walkRenderer.camInfo.moment)
 * @property {[number, number]|null} [talk] the speaker, while a talk is on
 * @property {[number, number]|null} [boss] the boss, while its reveal plays
 * @property {{ex: number, ez: number}|null} [swoop] the encounter's spot, while the camera swoops to it
 * @property {{x: number, z: number, t: number}|null} [tap] where you tapped, and when
 */
/**
 * What the focus is on this frame.
 * @param {AimInput} I
 * @returns {{x: number, z: number, kind: string}}
 */
export function focusAim(I) {
  if (I.swoop) return { x: I.swoop.ex, z: I.swoop.ez, kind: 'encounter' };
  if (I.moment === 'talk' && I.talk) return { x: (I.px + I.talk[0]) / 2, z: (I.pz + I.talk[1]) / 2, kind: 'talk' };
  if (I.moment === 'boss' && I.boss) return { x: I.boss[0], z: I.boss[1], kind: 'boss' };
  const ft = I.tap;
  if (ft && I.t - ft.t < 2600) {
    const s = (/** @type {number} */ x) => {
        const c = Math.max(0, Math.min(1, x));
        return c * c * (3 - 2 * c);
      },
      k = s((I.t - ft.t) / 350) * (1 - s((I.t - ft.t - 1800) / 800));
    return { x: I.px + (ft.x - I.px) * k, z: I.pz + (ft.z - I.pz) * k, kind: k > 0.01 ? 'tap' : 'you' };
  }
  return { x: I.px, z: I.pz, kind: 'you' };
}
/**
 * The focus point's lean away from you, eased (exact at any frame rate): the focus moves to a speaker or an
 * encounter over about `ease` seconds, and walking never leaves it behind you (the lean is measured from you).
 * @param {[number, number]} off the lean last frame
 * @param {[number, number]} goal the aim minus you
 * @param {number} dt seconds
 * @param {number} ease seconds (0: at once)
 * @returns {[number, number]}
 */
export function leanStep(off, goal, dt, ease) {
  const k = ease > 0 ? 1 - Math.exp(-dt / (ease / 3)) : 1;
  return [off[0] + (goal[0] - off[0]) * k, off[1] + (goal[1] - off[1]) * k];
}
