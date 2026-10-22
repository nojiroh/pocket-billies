// @ts-check
'use strict';
/* ================= CAMERA ORBIT (island track IS-1) =================
   The walking camera on an island map (`cam.orbit` in the map): it stands out over the sea and looks in at the
   island's middle `c`, so walking round the coast turns it a full circle. Yaw is the walk camera's (radians; it looks
   along +z at yaw 0, its forward is [sin yaw, cos yaw]), so a player south of the middle sees today's north view.
   Logic only, runs in Node (tools/test/camera-orbit.test.mjs); walk/camera.js and walk-view.js use it. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  TAU: [() => TAU],
  // @ts-expect-error -- replaced on purpose
  orbitInDead: [() => orbitInDead, v => (orbitInDead = v)],
  // @ts-expect-error -- replaced on purpose
  orbitStart: [() => orbitStart, v => (orbitStart = v)],
  // @ts-expect-error -- replaced on purpose
  orbitStep: [() => orbitStep, v => (orbitStep = v)],
  // @ts-expect-error -- replaced on purpose
  orbitStickYaw: [() => orbitStickYaw, v => (orbitStickYaw = v)],
  // @ts-expect-error -- replaced on purpose
  orbitWalkStep: [() => orbitWalkStep, v => (orbitWalkStep = v)],
  // @ts-expect-error -- replaced on purpose
  orbitYawAt: [() => orbitYawAt, v => (orbitYawAt = v)],
  // @ts-expect-error -- replaced on purpose
  wrapAngle: [() => wrapAngle, v => (wrapAngle = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{ c: number[], dead?: number, lag?: number, turn?: number }} CameraOrbit */
/**
 * The orbit's state, kept by the renderer between frames. `yaw` is unwrapped (it runs on past +/-180 degrees so the
 * easing never spins the long way); `stick` is the joystick's frame while it is held (see orbitStickYaw).
 * @typedef {{ yaw: number, target: number, hold: boolean, stick: number | null, lock: boolean }} OrbitState
 */

export const TAU = Math.PI * 2;

/** An angle brought into (-PI, PI].
 * @param {number} a */
export function wrapAngle(a) {
  const w = a - TAU * Math.floor((a + Math.PI) / TAU);
  return w === -Math.PI ? Math.PI : w;
}

/** The yaw that looks from (x, z) at the orbit's middle `c`: 0 from the south, PI/2 from the west.
 * @param {number[]} c @param {number} x @param {number} z */
export function orbitYawAt(c, x, z) {
  return Math.atan2(c[0] - x, c[1] - z);
}

/** Inside the dead zone (the mountain top), where the yaw holds still.
 * @param {CameraOrbit} O @param {number} x @param {number} z */
export function orbitInDead(O, x, z) {
  return Math.hypot(x - O.c[0], z - O.c[1]) < (O.dead || 0);
}

/**
 * A fresh state for a player at (x, z): the camera already where it belongs (on arriving, or a cut).
 * @param {CameraOrbit} O @param {number} x @param {number} z @param {number} [held] the yaw to keep if (x, z) is
 *   inside the dead zone (0, the north view, when there is none)
 * @returns {OrbitState}
 */
export function orbitStart(O, x, z, held = 0) {
  const y = orbitInDead(O, x, z) ? held : orbitYawAt(O.c, x, z);
  return { yaw: y, target: y, hold: orbitInDead(O, x, z), stick: null, lock: false };
}

/**
 * One frame: the target yaw (the way to the middle, or held inside the dead zone), taken the short way round from
 * the current yaw, and the yaw eased toward it over `lag` seconds (a time constant; 0 follows at once).
 * @param {OrbitState} S @param {CameraOrbit} O @param {number} x @param {number} z @param {number} dt seconds
 * @returns {OrbitState} S, changed in place
 */
export function orbitStep(S, O, x, z, dt) {
  S.hold = orbitInDead(O, x, z);
  if (!S.hold) S.target = S.yaw + wrapAngle(orbitYawAt(O.c, x, z) - S.yaw);
  else S.target = S.yaw + wrapAngle(S.target - S.yaw);
  const lag = Math.max(0, O.lag || 0),
    k = lag > 0 ? 1 - Math.exp(-Math.max(0, dt) / lag) : 1;
  S.yaw += (S.target - S.yaw) * k;
  /* keep the unwrapped yaw near zero over many laps (both moved together, so nothing on screen changes) */
  if (Math.abs(S.yaw) > TAU * 8) {
    const off = TAU * Math.round(S.yaw / TAU);
    S.yaw -= off;
    S.target -= off;
  }
  return S;
}

/**
 * The yaw the joystick walks by. It follows the way to the middle from where you stand now (not the eased camera, and
 * not last frame's target), so holding right walks round the middle instead of spiralling out. While the stick is
 * held it keeps the frame it had when you were last inside the dead zone: crossing the summit holding up, the way to
 * the middle flips half a turn as you leave the far side, and following it would walk you straight back in. Let go
 * and the frame follows again.
 * @param {OrbitState} S @param {boolean} held the stick (or a key) is pushed this frame
 * @param {CameraOrbit} [O] @param {number} [x] @param {number} [z] where you stand (without them: the last target)
 * @returns {number}
 */
export function orbitStickYaw(S, held, O, x, z) {
  const inDead = O && x != null && z != null ? orbitInDead(O, x, z) : S.hold,
    now = O && x != null && z != null && !inDead ? S.yaw + wrapAngle(orbitYawAt(O.c, x, z) - S.yaw) : S.target;
  if (!held) {
    S.stick = null;
    S.lock = false;
    return now;
  }
  if (S.stick == null) S.stick = now;
  if (inDead) S.lock = true;
  if (!S.lock) S.stick = now;
  return S.stick;
}

/**
 * A step of length `s` along the unit direction (dx, dz), taken round the middle: the part across the radius moves
 * you along the circle you are on and the part along it moves you in or out, so holding right walks a true circle
 * (a straight step along the tangent would add s*s/2r to the radius each frame). Inside `minR` (the dead zone) it is
 * a straight step.
 * @param {number[]} c @param {number} x @param {number} z @param {number} dx @param {number} dz @param {number} s
 * @param {number} [minR]
 * @returns {number[]} [x, z]
 */
export function orbitWalkStep(c, x, z, dx, dz, s, minR = 0) {
  const rx = x - c[0],
    rz = z - c[1],
    r = Math.hypot(rx, rz);
  if (!(r > Math.max(minR, 0.5))) return [x + dx * s, z + dz * s];
  const ux = rx / r,
    uz = rz / r,
    out = (dx * ux + dz * uz) * s,
    /* across: positive is the way (uz, -ux) points */
    across = (dx * uz - dz * ux) * s,
    r1 = Math.max(0.01, r + out),
    a = Math.atan2(rx, rz) + across / ((r + r1) / 2);
  return [c[0] + Math.sin(a) * r1, c[1] + Math.cos(a) * r1];
}
