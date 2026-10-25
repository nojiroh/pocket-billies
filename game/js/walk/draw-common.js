'use strict';
/* ================= WALK DRAW COMMON =================
   Phase 20 (stage B): what every walk pass uses (the world's curve, binding a program with the light), moved from
   walk-view-gl.js as it was. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { gpuState } from '../engine/webgl.js';
import { setLightUniforms } from '../engine/light.js';
import { walkRenderer } from './walk-state.js';
import { standingHeightAt } from './heights.js';
/* eslint-disable no-func-assign */
expose({
  FULL_UV: [() => FULL_UV],
  ROCK_STATE: [() => ROCK_STATE],
  rockUniformsFor: [() => rockUniformsFor, v => (rockUniformsFor = v)],
  setRockUniforms: [() => setRockUniforms, v => (setRockUniforms = v)],
  setSpriteUniforms: [() => setSpriteUniforms, v => (setSpriteUniforms = v)],
  useWalkProgram: [() => useWalkProgram, v => (useWalkProgram = v)],
  worldCurveArgs: [() => worldCurveArgs, v => (worldCurveArgs = v)],
  worldCurveDrop: [() => worldCurveDrop, v => (worldCurveDrop = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export function worldCurveArgs() {
  const sc = walkView.sc;
  return [sc.w / 2, sc.h / 2, engineSetting('world', 'curve'), Math.max(sc.w, sc.h) * 0.55 + 4];
}
/* phase 20 C2: worldCurveArgs's numbers worked out here, without its array (this runs per grid cell and item) */
export function worldCurveDrop(x, z) {
  const sc = walkView.sc;
  if (!sc) return 0;
  const d = Math.max(0, Math.hypot(x - sc.w / 2, z - sc.h / 2) - (Math.max(sc.w, sc.h) * 0.55 + 4));
  return engineSetting('world', 'curve') * d * d;
}
/* ---------- passes ---------- */
export function useWalkProgram(name, C, X) {
  const gl = gpuState.gl,
    p = gpuState.P[name];
  gl.useProgram(p.p);
  if (p.U.uVP && C) gl.uniformMatrix4fv(p.U.uVP, false, C.vp);
  if (X) setLightUniforms(p, X);
  if (p.U.uRock && C) setRockUniforms(p, C);
  return p;
}
/* terrain TR-3: what the walk programs with ROCK_GLSL (walk-shaders.js) need to thin out rock between the camera and
   you: your spot on screen and its depth (uPlC: [x, y, w] in clip space at your middle; off screen [9, 9, -1], as in
   battle), and uRock: your feet's height, the soft circle's radius on screen (0: off; it widens as the camera rises
   on tall ground) and how much of it at most goes. Worked out once a camera (a frame), nothing made per draw */
const ROCK_STATE = { C: null, plc: new Float32Array(3), rock: new Float32Array(4) };
function rockUniformsFor(C) {
  const R = ROCK_STATE;
  if (R.C === C) return R;
  R.C = C;
  R.plc[0] = 9;
  R.plc[1] = 9;
  R.plc[2] = -1;
  R.rock.fill(0);
  const P = walkView.pl,
    sc = walkView.sc;
  if (walkRenderer.bt || !P || !sc || !C.vp) return R;
  const feet = (P.yv ?? standingHeightAt(P.x, P.z)) + worldCurveDrop(P.x, P.z),
    y = feet + 0.9,
    m = C.vp,
    w = m[3] * P.x + m[7] * y + m[11] * P.z + m[15];
  if (!(w > 0.2)) return R;
  R.plc[0] = (m[0] * P.x + m[4] * y + m[8] * P.z + m[12]) / w;
  R.plc[1] = (m[1] * P.x + m[5] * y + m[9] * P.z + m[13]) / w;
  R.plc[2] = w;
  /* while the camera's line to you is cut by ground (walk/camera.js rockK, 0-1), and (player visibility) while
     something hides you (walkRenderer.hidK, from the silhouette's occlusion query, last frame): out in the open
     nothing changes. The circle never takes all of what hides you (at most 85%), so the query still sees it */
  if (C !== walkView.C || sc.indoor || sc.room) return R;
  const k = engineSetting('camera', 'rockFade') ? C.rockK || 0 : 0,
    hk = engineSetting('camera', 'hideFade') ? walkRenderer.hidK || 0 : 0;
  if (k > 0.01 || hk > 0.01) {
    const rm = +engineSetting('camera', 'rise') || 0;
    R.rock[0] = feet;
    R.rock[1] = Math.max(
      k > 0.01 ? 0.3 + (rm > 0 ? 0.16 * Math.min(1, (C.occ || 0) / rm) : 0.16) : 0,
      hk > 0.01 ? +(engineSetting('camera', 'hideSize') ?? 0.3) : 0
    );
    R.rock[2] = Math.max(0.8 * k, Math.min(0.85, +(engineSetting('camera', 'hideAmount') ?? 0.7)) * hk);
  }
  return R;
}
function setRockUniforms(p, C) {
  const gl = gpuState.gl,
    U = p.U,
    R = rockUniformsFor(C);
  gl.uniform3fv(U.uPlC, R.plc);
  gl.uniform4fv(U.uRock, R.rock);
  if (U.uAspect) gl.uniform1f(U.uAspect, C.rw / C.rh);
}
/* phase 20 C2: z and rk stand in for a copy of the item (a slice of a thick sprite at another depth, a picture rising
   with its town at rk of its height), so nothing is made per draw */
const FULL_UV = new Float32Array([0, 0, 1, 1]);
export function setSpriteUniforms(p, it, uv, z = it.z, rk = 1) {
  const gl = gpuState.gl,
    U = p.U,
    s = it.mpp,
    oy = rk === 1 ? it.oy : it.oy * rk,
    h = rk === 1 ? it.h : it.h * rk;
  gl.uniform3f(U.uBase, it.x, it.y, z);
  gl.uniform4f(U.uOff, it.ox * s, oy * s, it.w * s, h * s);
  gl.uniform4fv(U.uUV, uv || FULL_UV);
  gl.uniform1f(U.uFlip, it.flip);
  if (U.uSlope) gl.uniform1f(U.uSlope, it.slope || 0);
  gl.uniform1f(U.uShear, it.shear || 0);
}
