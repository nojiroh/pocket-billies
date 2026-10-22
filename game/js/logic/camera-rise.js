// @ts-check
'use strict';
/* ================= CAMERA RISE (terrain TR-3) =================
   How much more the walking camera must tilt down so the line from the eye to the player's head clears the ground
   between them. The camera stands behind the player (against its facing) and above; ground there (a massif on the
   camera's side, a terrace front) can hide the player. Logic only: the height lookup is passed in, runs in Node
   (tools/test/camera-rise.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  CAMERA_RISE_HEAD: [() => CAMERA_RISE_HEAD],
  CAMERA_RISE_MARGIN: [() => CAMERA_RISE_MARGIN],
  CAMERA_RISE_SAMPLES: [() => CAMERA_RISE_SAMPLES],
  // @ts-expect-error -- replaced on purpose
  cameraRiseNeeded: [() => cameraRiseNeeded, v => (cameraRiseNeeded = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* where along the ground toward the eye the line is tested, in metres from the player */
export const CAMERA_RISE_SAMPLES = [1.2, 2, 3, 4.5, 6.5, 9, 12, 16, 21, 27];
/* how far above the ground the line must pass, and the head's height above the feet */
export const CAMERA_RISE_MARGIN = 0.4,
  CAMERA_RISE_HEAD = 0.9;

/**
 * The extra tilt (degrees, 0 to maxDeg) that clears the view line, with the camera's current tilt `pitchDeg`, its
 * turn `yaw` (radians; the camera looks along +z at yaw 0), its horizontal distance back `reach` (metres) and the
 * ground height `heightAt(x, z)`.
 * @param {(x: number, z: number) => number} heightAt
 * @param {number} px
 * @param {number} pz
 * @param {number} feetY
 * @param {number} yaw
 * @param {number} pitchDeg
 * @param {number} reach
 * @param {number} maxDeg
 */
export function cameraRiseNeeded(heightAt, px, pz, feetY, yaw, pitchDeg, reach, maxDeg) {
  if (!(maxDeg > 0) || !(reach > 0)) return 0;
  const head = feetY + CAMERA_RISE_HEAD,
    bx = -Math.sin(yaw),
    bz = -Math.cos(yaw);
  let need = -Infinity;
  for (const s of CAMERA_RISE_SAMPLES) {
    if (s > reach) break;
    const g = heightAt(px + bx * s, pz + bz * s) + CAMERA_RISE_MARGIN - head;
    if (g > 0) need = Math.max(need, Math.atan2(g, s));
  }
  if (need === -Infinity) return 0;
  const extra = (need * 180) / Math.PI - pitchDeg;
  return extra > 0 ? Math.min(maxDeg, extra) : 0;
}
