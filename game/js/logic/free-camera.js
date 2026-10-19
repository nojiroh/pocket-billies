// @ts-check
'use strict';
/* ================= FREE CAMERA (the Studio's Walk scenes preview, after Project Story S3) =================
   A camera that leaves the walker: it looks at a point on (or above) the ground from a distance, turned (yaw) and
   tilted (pitch), and the walk view draws through it as it does a cutscene's (walk/camera.js cutsceneCamera). Input
   moves a goal; the camera glides to it. Positions are the scene's metres: x across, z depth, y up. Logic only: no
   DOM, runs in Node (tools/test/free-camera.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  FREE_CAM: [() => FREE_CAM],
  RAD: [() => RAD],
  // @ts-expect-error -- replaced on purpose
  freeCamAt: [() => freeCamAt, v => (freeCamAt = v)],
  freeCamCopy: [() => freeCamCopy],
  // @ts-expect-error -- replaced on purpose
  freeCamForward: [() => freeCamForward, v => (freeCamForward = v)],
  // @ts-expect-error -- replaced on purpose
  freeCamGlide: [() => freeCamGlide, v => (freeCamGlide = v)],
  // @ts-expect-error -- replaced on purpose
  freeCamKeep: [() => freeCamKeep, v => (freeCamKeep = v)],
  // @ts-expect-error -- replaced on purpose
  freeCamLook: [() => freeCamLook, v => (freeCamLook = v)],
  freeCamMetresPerPixel: [() => freeCamMetresPerPixel],
  // @ts-expect-error -- replaced on purpose
  freeCamPan: [() => freeCamPan, v => (freeCamPan = v)],
  // @ts-expect-error -- replaced on purpose
  freeCamRise: [() => freeCamRise, v => (freeCamRise = v)],
  // @ts-expect-error -- replaced on purpose
  freeCamTilt: [() => freeCamTilt, v => (freeCamTilt = v)],
  // @ts-expect-error -- replaced on purpose
  freeCamTurn: [() => freeCamTurn, v => (freeCamTurn = v)],
  // @ts-expect-error -- replaced on purpose
  freeCamZoom: [() => freeCamZoom, v => (freeCamZoom = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{ tgt: [number, number, number], yaw: number, pitch: number, dist: number }} FreeCam */
/** the limits: pitch in degrees (12: towards the horizon, 89: straight down), distance in metres */
export const FREE_CAM = { pitchMin: 12, pitchMax: 89, distMin: 2.5, distMax: 160, fov: 40, above: 0.8, rise: 60 };
export const RAD = Math.PI / 180;

/** a camera looking at a spot from the walk camera's usual angle @param {number} x @param {number} z
 * @param {number} y the ground's height there @param {number} [yaw] @returns {FreeCam} */
export function freeCamAt(x, z, y = 0, yaw = 0) {
  return { tgt: [x, y, z], yaw, pitch: 48, dist: 26 };
}
/** the direction it looks in @param {FreeCam} s @returns {[number, number, number]} */
export function freeCamForward(s) {
  const p = s.pitch * RAD;
  return [Math.sin(s.yaw) * Math.cos(p), -Math.sin(p), Math.cos(s.yaw) * Math.cos(p)];
}
/** what the walk view needs (cutsceneCamera's eye, target and field of view) @param {FreeCam} s */
export function freeCamLook(s) {
  const f = freeCamForward(s);
  return {
    eye: /** @type {[number, number, number]} */ ([
      s.tgt[0] - f[0] * s.dist,
      s.tgt[1] - f[1] * s.dist,
      s.tgt[2] - f[2] * s.dist,
    ]),
    tgt: /** @type {[number, number, number]} */ (s.tgt.slice()),
    fov: FREE_CAM.fov,
  };
}
/** metres on the ground per pixel at the target, for a view this many pixels high @param {FreeCam} s @param {number} h */
export const freeCamMetresPerPixel = (s, h) => (2 * s.dist * Math.tan((FREE_CAM.fov * RAD) / 2)) / Math.max(1, h);
/** moves the target along the ground: to the screen's right and ahead of the way it looks, in metres (right as
 * the walk camera has it, walk/camera.js) @param {FreeCam} s @param {number} right @param {number} ahead */
export function freeCamPan(s, right, ahead) {
  const fx = Math.sin(s.yaw),
    fz = Math.cos(s.yaw);
  s.tgt[0] += fz * right + fx * ahead;
  s.tgt[2] += -fx * right + fz * ahead;
  return s;
}
/** turns round the target (radians) @param {FreeCam} s @param {number} a */
export function freeCamTurn(s, a) {
  s.yaw += a;
  return s;
}
/** tilts (degrees; more looks further down) @param {FreeCam} s @param {number} d */
export function freeCamTilt(s, d) {
  s.pitch = Math.min(FREE_CAM.pitchMax, Math.max(FREE_CAM.pitchMin, s.pitch + d));
  return s;
}
/** zooms by a factor (below 1 comes closer), towards a point on the ground when given, so the point stays put
 * @param {FreeCam} s @param {number} k @param {[number, number] | null} [at] */
export function freeCamZoom(s, k, at = null) {
  const d = Math.min(FREE_CAM.distMax, Math.max(FREE_CAM.distMin, s.dist * k)),
    q = 1 - d / s.dist;
  if (at) {
    s.tgt[0] += (at[0] - s.tgt[0]) * q;
    s.tgt[2] += (at[1] - s.tgt[2]) * q;
  }
  s.dist = d;
  return s;
}
/** raises or lowers what it looks at (metres) @param {FreeCam} s @param {number} dy */
export function freeCamRise(s, dy) {
  s.tgt[1] += dy;
  return s;
}
/** keeps it in the scene (a little past its edges), the target between the ground and FREE_CAM.rise above it, and
 * the eye above the ground (it tilts down, then comes closer, until it is) @param {FreeCam} s
 * @param {{ w: number, h: number }} sc @param {(x: number, z: number) => number} heightAt */
export function freeCamKeep(s, sc, heightAt) {
  const m = 4;
  s.tgt[0] = Math.min(sc.w + m, Math.max(-m, s.tgt[0]));
  s.tgt[2] = Math.min(sc.h + m, Math.max(-m, s.tgt[2]));
  const g = heightAt(s.tgt[0], s.tgt[2]) || 0;
  s.tgt[1] = Math.min(g + FREE_CAM.rise, Math.max(g, s.tgt[1]));
  for (let i = 0; i < 40; i++) {
    const e = freeCamLook(s).eye;
    if (e[1] >= (heightAt(e[0], e[2]) || 0) + FREE_CAM.above) break;
    if (s.pitch < FREE_CAM.pitchMax) s.pitch = Math.min(FREE_CAM.pitchMax, s.pitch + 2);
    else s.dist = Math.max(FREE_CAM.distMin, s.dist * 0.9);
  }
  return s;
}
/** the camera a step closer to the goal (it glides; the yaw the short way round) @param {FreeCam} cur
 * @param {FreeCam} goal @param {number} dt seconds */
export function freeCamGlide(cur, goal, dt) {
  const k = 1 - Math.exp(-dt * 10);
  for (let i = 0; i < 3; i++) cur.tgt[i] += (goal.tgt[i] - cur.tgt[i]) * k;
  let dy = goal.yaw - cur.yaw;
  dy -= Math.round(dy / (2 * Math.PI)) * 2 * Math.PI;
  cur.yaw += dy * k;
  cur.pitch += (goal.pitch - cur.pitch) * k;
  cur.dist *= Math.exp(Math.log(goal.dist / cur.dist) * k);
  return cur;
}
/** a copy @param {FreeCam} s @returns {FreeCam} */
export const freeCamCopy = s => ({
  tgt: /** @type {[number, number, number]} */ (s.tgt.slice()),
  yaw: s.yaw,
  pitch: s.pitch,
  dist: s.dist,
});
