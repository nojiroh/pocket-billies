// @ts-check
'use strict';
/* ================= TURNED PROPS (phase 09 batch 9) =================
   A placement's rot: degrees, turned about its base point (the middle of its front, where its door is), the same way
   for everything: the model, its pictures, its shadow, its footprint, its door and its lights. Buildings have had it
   since alpha 0.4 (a few degrees along a curved street); every prop can now turn any way at all. Positive turns its
   front's right-hand end away from you (x toward z), as buildings.js buildingRotation and the model shaders do.
   A prop's own metres: x across its front, z back from its front (its footprint runs z 0 to its box's depth). Logic
   only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  FACING_RIGHT: [() => FACING_RIGHT],
  STRAIGHT_RIGHT: [() => STRAIGHT_RIGHT],
  // @ts-expect-error -- replaced on purpose
  decalPlace: [() => decalPlace, v => (decalPlace = v)],
  // @ts-expect-error -- replaced on purpose
  mirroredTurn: [() => mirroredTurn, v => (mirroredTurn = v)],
  // @ts-expect-error -- replaced on purpose
  normalTurn: [() => normalTurn, v => (normalTurn = v)],
  // @ts-expect-error -- replaced on purpose
  pictureFacing: [() => pictureFacing, v => (pictureFacing = v)],
  // @ts-expect-error -- replaced on purpose
  pictureRight: [() => pictureRight, v => (pictureRight = v)],
  // @ts-expect-error -- replaced on purpose
  placedTurn: [() => placedTurn, v => (placedTurn = v)],
  // @ts-expect-error -- replaced on purpose
  pointInProp: [() => pointInProp, v => (pointInProp = v)],
  // @ts-expect-error -- replaced on purpose
  propTurn: [() => propTurn, v => (propTurn = v)],
  // @ts-expect-error -- replaced on purpose
  spanFit: [() => spanFit, v => (spanFit = v)],
  // @ts-expect-error -- replaced on purpose
  tiltSpin: [() => tiltSpin, v => (tiltSpin = v)],
  // @ts-expect-error -- replaced on purpose
  turnedBounds: [() => turnedBounds, v => (turnedBounds = v)],
  // @ts-expect-error -- replaced on purpose
  turnedPoint: [() => turnedPoint, v => (turnedPoint = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{ x: number, z: number, rot?: number }} Placed */

/** the placement's turn in radians (0 when it has none) @param {Placed | null | undefined} p @returns {number} */
export function placedTurn(p) {
  const r = p && +(p.rot || 0);
  return r ? (r * Math.PI) / 180 : 0;
}

/** a point given in the prop's own metres (dx across, dz back), in the place's metres
 * @param {Placed} p @param {number} dx @param {number} dz @returns {[number, number]} */
export function turnedPoint(p, dx, dz) {
  const r = placedTurn(p);
  if (!r) return [p.x + dx, p.z + dz];
  const c = Math.cos(r),
    s = Math.sin(r);
  return [p.x + dx * c - dz * s, p.z + dx * s + dz * c];
}

/** a point of the place in the prop's own metres (the inverse of turnedPoint)
 * @param {Placed} p @param {number} x @param {number} z @returns {[number, number]} */
export function pointInProp(p, x, z) {
  const r = placedTurn(p),
    dx = x - p.x,
    dz = z - p.z;
  if (!r) return [dx, dz];
  const c = Math.cos(r),
    s = Math.sin(r);
  return [dx * c + dz * s, -dx * s + dz * c];
}

/** the place's rectangle [x0, z0, x1, z1] round a rectangle given in the prop's own metres
 * @param {Placed} p @param {number} a0 @param {number} b0 @param {number} a1 @param {number} b1
 * @returns {[number, number, number, number]} */
export function turnedBounds(p, a0, b0, a1, b1) {
  if (!placedTurn(p)) return [p.x + a0, p.z + b0, p.x + a1, p.z + b1];
  const C = [turnedPoint(p, a0, b0), turnedPoint(p, a1, b0), turnedPoint(p, a0, b1), turnedPoint(p, a1, b1)],
    xs = C.map(q => q[0]),
    zs = C.map(q => q[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}

/** a turn as the data keeps it: degrees from -180 to 180, to a tenth, 0 as no turn at all
 * @param {number} deg @returns {number} */
export function normalTurn(deg) {
  let d = ((((+deg || 0) % 360) + 540) % 360) - 180;
  d = Math.round(d * 10) / 10;
  return d === -180 ? 180 : d === 0 ? 0 : d;
}

/** a placement's turn once it is mirrored left to right (a room laid in the other way round, a mirrored block)
 * @param {number | undefined} deg @returns {number} */
export function mirroredTurn(deg) {
  return deg ? normalTurn(-deg) : 0;
}

/**
 * the angle (radians) a frame item of the walk view turns by. A model, and a prop drawn as a solid: the placement's
 * turn and its look's few random degrees (walk/prop-look.js propLook rot).
 * @param {{ p?: Placed, lk?: { rot?: number } }} it @returns {number}
 */
export function propTurn(it) {
  return placedTurn(it.p) + (it.lk && it.lk.rot ? it.lk.rot * 0.6 : 0);
}

/**
 * the angle a picture item faces. One that faces the camera never turns. One that stays put in the world (fixed): its
 * own way (yaw: a model's picture layer, which has the model's turn in it already), the placement's turn (not a
 * building drawn in 3D, which turns its own walls) and a standee's few random degrees.
 * @param {{ fixed?: boolean, p?: Placed, lk?: { rot?: number }, M?: { box?: unknown }, bld3?: boolean, yaw?: number,
 *   voxImg?: number }} it @returns {number}
 */
export function pictureFacing(it) {
  if (!it.fixed) return 0;
  return (
    (it.lk && it.lk.rot && !(it.M && it.M.box) && !it.bld3 ? it.lk.rot * 0.6 : 0) +
    (it.yaw || 0) +
    (it.voxImg || it.bld3 ? 0 : placedTurn(it.p))
  );
}

export const STRAIGHT_RIGHT = new Float32Array([1, 0, 0]),
  FACING_RIGHT = new Float32Array(3);
/**
 * the picture's right-hand way along the ground for pictureFacing (the camera's own when it faces the camera); the
 * array is reused, so it is read at once (a uniform), never kept
 * @param {Parameters<typeof pictureFacing>[0]} it @param {ArrayLike<number>} cameraRight @returns {ArrayLike<number>}
 */
export function pictureRight(it, cameraRight) {
  if (!it.fixed) return cameraRight;
  const a = pictureFacing(it);
  if (!a) return STRAIGHT_RIGHT;
  FACING_RIGHT[0] = Math.cos(a);
  FACING_RIGHT[1] = 0;
  FACING_RIGHT[2] = Math.sin(a);
  return FACING_RIGHT;
}

/**
 * where a model's picture layer stands (a decal: a sign's lettering, a window's view, washing on a line; HB-1): on its
 * model as the model shaders draw it (prop-models.js propModelInstanceValues), so with the model's size and its look's
 * random wobble, its turn, its mirror and its bob. A layer's x is across the model, y back from its front, z up (its
 * metres before the size). A mirrored model's fixed layer moves to the mirrored spot and faces the mirrored way, but
 * its picture is never mirrored, so lettering reads right (the owner, 2026-10-25); a camera-facing layer mirrors with
 * its model as before.
 * @param {{ x: number, y: number, z: number }} at the model's base
 * @param {{ x?: number, y?: number, z?: number, yaw?: number, face?: string, flip?: unknown }} L the layer
 * @param {{ s: number, f?: number, turn: number, bob?: number[] | null }} m the model's size (with the wobble),
 *   mirror (-1), turn (radians, propTurn) and bob ([up, turn], prop-models.js mooredBob)
 * @returns {{ x: number, y: number, z: number, s: number, yaw: number, flip: number }}
 */
export function decalPlace(at, L, m) {
  const s = m.s,
    f = m.f || 1,
    ro = m.turn + (m.bob ? m.bob[1] : 0),
    c = Math.cos(ro),
    n = Math.sin(ro),
    lx = (L.x || 0) * s * f,
    lz = (L.y || 0) * s,
    fixed = L.face === 'fixed';
  return {
    x: at.x + lx * c - lz * n,
    z: at.z + lx * n + lz * c,
    y: at.y + (m.bob ? m.bob[0] : 0) + (L.z || 0) * s,
    s,
    yaw: fixed ? (+(L.yaw || 0) || 0) * f + ro : 0,
    flip: fixed ? (L.flip ? -1 : 1) : L.flip ? -f : f,
  };
}

/* ---------- HB-6: a model tipped off the upright ----------
   The model shaders turn a whole model about any axis through a pivot (RF-2's spin: a unit axis in the model's own
   metres, up as y, an angle in radians, the pivot), before its mirror, size and turn. A fence rail spans two posts on
   uneven ground (tipped end to end); a post leans a little (tipped by its placement's tilt). */
/** @typedef {{ a: [number, number, number], an: number, c: [number, number, number] }} ModelSpin */

/**
 * a model that spans two points len apart along its x, the ground h0 under its left-hand end (-x) and h1 under its
 * right-hand end (+x): its base point at their mean height, tipped about its depth so each end meets its own ground.
 * Mirrored (flip -1) its own x runs the other way, so the tip turns the other way too. No spin when the ends are level.
 * @param {number} len @param {number} h0 @param {number} h1 @param {number} [flip]
 * @returns {{ y: number, spin: ModelSpin | null }}
 */
export function spanFit(len, h0, h1, flip = 1) {
  const an = len > 0 ? Math.asin(Math.max(-1, Math.min(1, (h1 - h0) / len))) * (flip < 0 ? -1 : 1) : 0;
  return { y: (h0 + h1) / 2, spin: Math.abs(an) > 1e-4 ? { a: [0, 0, 1], an, c: [0, 0, 0] } : null };
}

/**
 * a placement's lean: tilt [degrees its top leans toward its own +x, degrees toward its back (+z)], about its base
 * point; null when it stands upright
 * @param {unknown} tilt @returns {ModelSpin | null}
 */
export function tiltSpin(tilt) {
  if (!Array.isArray(tilt)) return null;
  const tx = +tilt[0] || 0,
    tz = +tilt[1] || 0,
    an = (Math.hypot(tx, tz) * Math.PI) / 180;
  if (an < 1e-4) return null;
  const L = Math.hypot(tx, tz);
  return { a: [tz / L, 0, -tx / L], an, c: [0, 0, 0] };
}
