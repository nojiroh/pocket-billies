'use strict';
/* ================= WALK SKY =================
   Phase 20 (stage B): the sky's colours and drawing it, and the world map's picture of a place, moved from
   walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { bowlWallTexture } from '../hooks.js';
import { hexToRgb } from '../art.js';
import { walkView } from '../walk-view.js';
import { engineContext, engineSetting } from '../engine/settings.js';
import { bindQuad, gpuState } from '../engine/webgl.js';
import { environment, environmentSky } from '../environment.js';
/* eslint-disable no-func-assign */
expose({ drawSky: [() => drawSky, v => (drawSky = v)], skyColors: [() => skyColors, v => (skyColors = v)] });
/* eslint-enable no-func-assign */
/* to-module: end */
/* v26: the scene's sky colours after the hour and the weather (environment.js) */
export function skyColors(sc) {
  const s = (sc.sky || ['#8CC6E6', '#BFE3EE', '#F4E8C8']).map(c => hexToRgb(c).map(v => v / 255));
  return typeof environmentSky === 'function' && engineContext.env ? environmentSky(s, !!sc.indoor) : s;
}
export function drawSky(C, sun, mirror) {
  const gl = gpuState.gl,
    sc = walkView.sc,
    p = gpuState.P.sky,
    U = p.U,
    sky = skyColors(sc);
  gl.useProgram(p.p);
  bindQuad();
  if (U.uEnv) {
    const E = typeof environment !== 'undefined' && engineContext.env ? environment : null;
    gl.uniform4f(U.uEnv, E ? E.night : 0, E ? E.flash : 0, E ? E.grey : 0, E ? (E.rainbow || 0) * (1 - E.night) : 0);
    gl.uniform3fv(U.uMoon, sun.dir);
  }
  gl.uniformMatrix4fv(U.uIVP, false, C.ivp);
  gl.uniform3fv(U.uSky0, sky[0]);
  gl.uniform3fv(U.uSky1, sky[1]);
  gl.uniform3fv(U.uSky2, sky[2]);
  gl.uniform3fv(U.uSunCol, sun.col);
  gl.uniform1f(U.uIndoor, sc.indoor ? 1 : 0);
  gl.uniform1f(U.uTime, walkView.t);
  gl.uniform1f(U.uSunPulse, sun.pulse);
  gl.uniform1f(U.uMirror, mirror);
  gl.uniform1f(U.uClouds, engineSetting('sun', 'clouds'));
  gl.uniform1f(U.uCloudSpd, engineSetting('sun', 'cloudSpeed'));
  /* phase 10: the bowl's far wall round the horizon, as seen from this place (world-bowl.js) */
  const wall = typeof bowlWallTexture === 'function' ? bowlWallTexture() : null;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, wall || gpuState.white);
  gl.uniform1i(U.uWorld, 0);
  gl.uniform1f(U.uWallOn, wall ? 1 : 0);
  gl.depthMask(false);
  gl.disable(gl.DEPTH_TEST);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.depthMask(true);
  gl.enable(gl.DEPTH_TEST);
}
