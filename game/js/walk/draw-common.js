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
/* eslint-disable no-func-assign */
expose({
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
export function worldCurveDrop(x, z) {
  const sc = walkView.sc;
  if (!sc) return 0;
  const c = worldCurveArgs(),
    d = Math.max(0, Math.hypot(x - c[0], z - c[1]) - c[3]);
  return c[2] * d * d;
}
/* ---------- passes ---------- */
export function useWalkProgram(name, C, X) {
  const gl = gpuState.gl,
    p = gpuState.P[name];
  gl.useProgram(p.p);
  if (p.U.uVP && C) gl.uniformMatrix4fv(p.U.uVP, false, C.vp);
  if (X) setLightUniforms(p, X);
  return p;
}
export function setSpriteUniforms(p, it, uv) {
  const gl = gpuState.gl,
    U = p.U,
    s = it.mpp;
  gl.uniform3f(U.uBase, it.x, it.y, it.z);
  gl.uniform4f(U.uOff, it.ox * s, it.oy * s, it.w * s, it.h * s);
  gl.uniform4fv(U.uUV, uv || [0, 0, 1, 1]);
  gl.uniform1f(U.uFlip, it.flip);
  if (U.uSlope) gl.uniform1f(U.uSlope, it.slope || 0);
  gl.uniform1f(U.uShear, it.shear || 0);
}
