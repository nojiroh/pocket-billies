'use strict';
/* ================= WALK SHADOWS =================
   Phase 20 (stage B): the sun's two shadow maps, the lamps' shadow maps and the shadow sprites, moved from
   walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  buildingFrontPicture,
  buildingGuard,
  buildingState,
  buildingsOn,
  drawBuildingShadows,
  drawGroundDepth,
  drawPropModelShadows,
  drawSolidPropShadows,
  drawStructureShadows,
  provide,
  roomFloorOf,
} from '../hooks.js';
import { pictureRight, placedTurn } from '../logic/prop-turn.js';
import { gpuPass, gpuTag } from '../engine/gpu-counters.js';
import { filterInto } from '../engine/frame-lists.js';
import { walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { bindQuad, gpuState, imageTexture, normalize3, renderTarget } from '../engine/webgl.js';
import { beginLampShadow, beginSunShadow, endShadow, frameBlockStale } from '../engine/light.js';
import { FIXED_RIGHT, walkRenderer } from './walk-state.js';
import { standingHeightAt } from './heights.js';
import { setSpriteUniforms, worldCurveArgs } from './draw-common.js';
import { screenRay } from './camera.js';
/* eslint-disable no-func-assign */
expose({
  SHADOW_LISTS: [() => SHADOW_LISTS],
  drawShadowSprites: [() => drawShadowSprites, v => (drawShadowSprites = v)],
  fittedShadowPass: [() => fittedShadowPass, v => (fittedShadowPass = v)],
  lampShadowMaps: [() => lampShadowMaps, v => (lampShadowMaps = v)],
  shadowMapArea: [() => shadowMapArea, v => (shadowMapArea = v)],
  shadowPass: [() => shadowPass, v => setShadowPass(v)],
});
/* eslint-enable no-func-assign */
export function setShadowPass(v) {
  shadowPass = v; // eslint-disable-line no-func-assign
  provide({ shadowPass });
}
/* to-module: end */
/* v19: the shadow map covers the ground the camera sees (plus a margin for tall things just outside), not the whole
   scene, so its texels are smaller where it matters; the radius moves in 2 m steps */
function shadowMapArea(C) {
  const sc = walkView.sc,
    full = [sc.w / 2, sc.h / 2, Math.hypot(sc.w, sc.h) / 2 + 6];
  if (!C || !engineSetting('shadows', 'fit')) return full;
  const P = walkView.pl,
    y0 = standingHeightAt(P.x, P.z),
    X = [],
    Z = [];
  for (const [sx, sy] of [
    [0, 0],
    [C.rw, 0],
    [0, C.rh],
    [C.rw, C.rh],
    [C.rw / 2, C.rh / 2],
  ]) {
    const r = screenRay(C, sx, sy);
    const t = r.d[1] < -0.02 ? Math.min(55, (y0 - r.o[1]) / r.d[1]) : 55;
    X.push(r.o[0] + r.d[0] * t);
    Z.push(r.o[2] + r.d[2] * t);
  }
  const x0 = Math.max(-6, Math.min(...X)),
    x1 = Math.min(sc.w + 6, Math.max(...X)),
    z0 = Math.max(-6, Math.min(...Z)),
    z1 = Math.min(sc.h + 6, Math.max(...Z));
  if (!(x1 > x0 && z1 > z0)) return full;
  const rad = Math.ceil((Math.hypot(x1 - x0, z1 - z0) / 2 + 6) / 2) * 2;
  return rad >= full[2] ? full : [(x0 + x1) / 2, (z0 + z1) / 2, Math.max(12, rad)];
}
/* v34: a shadow cache. Things that never move (the ground, buildings, rocks, still props) are drawn into a second
   depth map and kept there; each frame that copy is laid down first and only moving things (people, billionaires,
   swaying trees, boats) are drawn on top. The square the map covers moves in 3 m steps so the copy stays usable while
   you walk; the sun's slow travel or any change to the scene draws it again. */
/* v43: two cascades. The far map is the fitted view as before (cached for what never moves); the near map is a tight
   square round you at a finer texel, drawn every frame from the things in it, so shadows near you are crisp */
/* phase 20 C2: the shadow passes' lists of what they draw, refilled in place each frame (engine/frame-lists.js) */
const SHADOW_LISTS = { near: [], far: [], stat: [], dyn: [], lamp: [] };
export function shadowPass(items0, sun, C) {
  gpuPass('shadowFar');
  const far = fittedShadowPass(items0, sun, C);
  if (
    !(engineSetting('shadows', 'cascades') ?? true) ||
    (walkRenderer.bt && (engineSetting('quality', 'battleLite') ?? true))
  )
    return far;
  const P = walkView.pl,
    R = engineSetting('shadows', 'nearRadius') ?? 13,
    res = Math.min(1024, engineSetting('quality', 'shadowMap')),
    gl = gpuState.gl,
    items = filterInto(
      items0,
      it => Math.hypot(it.x - P.x, it.z - P.z) < R + (it.w || 32) * (it.mpp || 0.03) + 3,
      SHADOW_LISTS.near
    );
  gpuPass('shadowNear');
  const SH = beginSunShadow(P.x, P.z, R, sun, res, 'shadowN', Math.round(P.yv ?? standingHeightAt(P.x, P.z))),
    ca = worldCurveArgs();
  {
    const p = gpuState.P.shadowG;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
    gl.uniform1f(p.U.uCurveD0, ca[3]);
    drawGroundDepth(p, walkView.sc);
  }
  drawShadowSprites(SH, items, sun, ca);
  if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, items);
  if (typeof drawStructureShadows === 'function') drawStructureShadows(SH);
  if (typeof drawSolidPropShadows === 'function') drawSolidPropShadows(SH, items);
  if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, items);
  endShadow();
  SH.far = far;
  return SH;
}
/* v43: shadow maps for the two nearest lamps after dark (the ones that hang high: street lamps, lanterns, windows don't
   count). The lamps are moved to the front of the light list so the shader knows which they are. */
export function lampShadowMaps(items, X, dark) {
  const n = Math.min(2, engineSetting('shadows', 'lampShadows') ?? 2);
  if (!n) return;
  const L = X.lights,
    P = walkView.pl,
    cand = L.filter(l => !l.front && l.p[1] > 1.6 && l.r >= 3 && Math.hypot(l.p[0] - P.x, l.p[2] - P.z) < 22).slice(
      0,
      n
    );
  if (!cand.length) return;
  X.lights = cand.concat(L.filter(l => !cand.includes(l)));
  X._lp = null;
  X._lc = null;
  frameBlockStale(X);
  X.lampSh = [];
  const gl = gpuState.gl,
    ca = worldCurveArgs();
  cand.forEach((l, i) => {
    gpuPass(i ? 'lamp1' : 'lamp0');
    const SH = beginLampShadow([l.p[0], l.p[1] + 0.2, l.p[2]], 512, 'lamp' + i),
      near = filterInto(
        items,
        it =>
          Math.hypot(it.x - l.p[0], it.z - l.p[2]) < 13 &&
          it.p !== l.own &&
          !(it.k === 'prop' && it.M && it.M.glow && Math.hypot(it.x - l.p[0], it.z - l.p[2]) < 0.6),
        SHADOW_LISTS.lamp
      ); /* alpha 0.4: nor its own post (it.p!==l.own): the lamp's picture turned black in its own light's shadow */
    {
      const p = gpuState.P.shadowG;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
      gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
      gl.uniform1f(p.U.uCurveD0, ca[3]);
      drawGroundDepth(p, walkView.sc);
    }
    drawShadowSprites(SH, near, null, ca, l.p);
    if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, near);
    if (typeof drawSolidPropShadows === 'function') drawSolidPropShadows(SH, near);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, near);
    endShadow();
    X.lampSh.push(SH);
  });
}
/* the sprites of a shadow pass, each turned to face the sun (fixed ones and buildings as they stand); for a lamp, each turned to face the lamp */
function drawShadowSprites(SH, L, sun, ca, lamp) {
  const gl = gpuState.gl,
    p = gpuState.P.shadow,
    solid = engineSetting('shadows', 'buildings'),
    tr = sun ? sun.travel : [0, -1, 0],
    h = normalize3([tr[0], 0, tr[2]]),
    Rs0 = Math.hypot(tr[0], tr[2]) < 0.05 ? [1, 0, 0] : [-h[2], 0, h[0]];
  let Rs = Rs0;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
  gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
  gl.uniform1f(p.U.uCurveD0, ca[3]);
  bindQuad();
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(p.U.uTex, 0);
  let miss = 0;
  for (const it of L) {
    if (it.flat || it.far || it.k === 'enc2' || it.vol || it.k === 'flag' || it.vox) continue;
    if (it.k === 'prop' && !(it.sh > 0)) continue;
    gpuTag(it.voxImg ? 'modelPic' : 0); /* R1 measure: a model's picture layer counted apart */
    const T = imageTexture(it.im);
    if (!T) {
      miss++;
      continue;
    }
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    if (it.layer && it.M.box) continue;
    if (lamp) {
      const dx = it.x - lamp[0],
        dz = it.z - lamp[2],
        l = Math.hypot(dx, dz);
      Rs = l < 0.3 ? Rs0 : [dz / l, 0, -dx / l];
    }
    if (it.bld3) {
      let F = null;
      buildingGuard(() => {
        F = imageTexture(buildingFrontPicture(it.im, it.M.build, it.M));
      });
      if (!F) miss++;
      if (F) {
        gl.bindTexture(gl.TEXTURE_2D, F.t);
        gl.uniform3fv(p.U.uRight, FIXED_RIGHT);
        setSpriteUniforms(p, it);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.uniform3fv(p.U.uRight, Rs);
      }
      continue;
    }
    if (it.plane && !(solid && it.M && it.M.box)) {
      gl.uniform3fv(p.U.uRight, it.fixed ? pictureRight(it, FIXED_RIGHT) : FIXED_RIGHT);
      setSpriteUniforms(p, it);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.uniform3fv(p.U.uRight, Rs);
      continue;
    }
    if (solid && it.M && it.M.box) {
      /* phase 09 batch 9: a turned building's slices turn with it and step back the way it faces */
      const ta = placedTurn(it.p),
        tc = Math.cos(ta),
        ts = Math.sin(ta);
      gl.uniform3f(p.U.uRight, tc, 0, ts);
      const d = it.M.box[1] * (it.p.s || 1),
        n = 6;
      for (let i = 0; i < n; i++) {
        const k = (d * i) / (n - 1);
        setSpriteUniforms(p, it, null, it.z + k * tc);
        if (ta) gl.uniform3f(p.U.uBase, it.x - k * ts, it.y, it.z + k * tc);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.uniform3fv(p.U.uRight, Rs);
      continue;
    }
    gl.uniform3fv(p.U.uRight, Rs);
    setSpriteUniforms(p, it);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  gpuTag(0);
  return miss;
}
function fittedShadowPass(items0, sun, C) {
  const sc = walkView.sc,
    res =
      walkView.R < 0.8 || (walkRenderer.q || 0) >= 2
        ? Math.min(1024, engineSetting('quality', 'shadowMap'))
        : engineSetting('quality', 'shadowMap'),
    gl = gpuState.gl;
  let fit = shadowMapArea(C);
  const cache = (engineSetting('quality', 'shadowCache') ?? true) && !walkRenderer.bt && !!gl.blitFramebuffer;
  if (cache) fit = [Math.round(fit[0] / 3) * 3, Math.round(fit[1] / 3) * 3, fit[2] + 3];
  const items = filterInto(
    items0,
    it => Math.hypot(it.x - fit[0], it.z - fit[1]) < fit[2] + (it.w || 32) * (it.mpp || 0.03) + 4,
    SHADOW_LISTS.far
  );
  const SH = beginSunShadow(fit[0], fit[1], fit[2], sun, res);
  const ca = worldCurveArgs(),
    curve = P => {
      gl.uniform3f(P.U.uCurve, ca[0], ca[1], ca[2]);
      gl.uniform1f(P.U.uCurveD0, ca[3]);
    };
  const solid = engineSetting('shadows', 'buildings'),
    tr = sun.travel,
    h = normalize3([tr[0], 0, tr[2]]),
    Rs = Math.hypot(tr[0], tr[2]) < 0.05 ? [1, 0, 0] : [-h[2], 0, h[0]];
  const still = it => it.k === 'prop' && it.still && !it.vol,
    stat = cache ? filterInto(items, still, SHADOW_LISTS.stat) : items,
    dyn = cache
      ? filterInto(items, it => !still(it), SHADOW_LISTS.dyn)
      : ((SHADOW_LISTS.dyn.length = 0), SHADOW_LISTS.dyn);
  const q = v => Math.round(v * 500);
  const key = cache
    ? [
        fit.join(','),
        q(tr[0]),
        q(tr[1]),
        q(tr[2]),
        res,
        walkView.id,
        stat.length,
        stat.length ? stat[0].x + stat[stat.length - 1].z : 0,
        walkRenderer.itemGen || 0,
        solid ? 1 : 0,
        walkRenderer.mesh && walkRenderer.mesh.n,
        roomFloorOf(sc) ? sc.roomScene.id : '',
        sc.heights ? sc.heights.length : 0,
        typeof buildingsOn === 'function' && buildingsOn() ? 1 : 0,
        typeof buildingState !== 'undefined' ? buildingState.made || 0 : 0,
      ].join('|')
    : '';
  const SF = gpuState.fb.shadow;
  let hit = false;
  if (cache && walkRenderer.shKey === key && gpuState.fb.shadowS && gpuState.fb.shadowS.w === res) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, gpuState.fb.shadowS.f);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, SF.f);
    gl.blitFramebuffer(0, 0, res, res, 0, 0, res, res, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, SF.f);
    hit = true;
    walkRenderer.shHit = (walkRenderer.shHit || 0) + 1;
  }
  let miss = 0;
  const sprites = L => {
    const p = gpuState.P.shadow;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    curve(p);
    bindQuad();
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(p.U.uTex, 0);
    for (const it of L) {
      if (it.flat || it.far || it.k === 'enc2' || it.vol || it.k === 'flag' || it.vox) continue;
      if (it.k === 'prop' && !(it.sh > 0)) continue;
      gpuTag(it.voxImg ? 'modelPic' : 0); /* R1 measure: a model's picture layer counted apart */
      const T = imageTexture(it.im);
      if (!T) {
        miss++;
        continue;
      }
      gl.bindTexture(gl.TEXTURE_2D, T.t);
      if (it.layer && it.M.box) continue;
      /* a 3D building: its front as a cut-out here, walls and roof as geometry below */
      if (it.bld3) {
        let F = null;
        buildingGuard(() => {
          F = imageTexture(buildingFrontPicture(it.im, it.M.build, it.M));
        });
        if (!F) miss++;
        if (F) {
          gl.bindTexture(gl.TEXTURE_2D, F.t);
          gl.uniform3fv(p.U.uRight, FIXED_RIGHT);
          setSpriteUniforms(p, it);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          gl.uniform3fv(p.U.uRight, Rs);
        }
        continue;
      }
      if (it.plane && !(solid && it.M && it.M.box)) {
        gl.uniform3fv(p.U.uRight, it.fixed ? pictureRight(it, FIXED_RIGHT) : FIXED_RIGHT);
        setSpriteUniforms(p, it);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.uniform3fv(p.U.uRight, Rs);
        continue;
      }
      if (solid && it.M && it.M.box) {
        /* a building: its front outline extruded through its depth, so the shadow has its true roof line */
        /* phase 09 batch 9: a turned building's slices turn with it and step back the way it faces */
        const ta = placedTurn(it.p),
          tc = Math.cos(ta),
          ts = Math.sin(ta);
        gl.uniform3f(p.U.uRight, tc, 0, ts);
        const d = it.M.box[1] * (it.p.s || 1),
          n = 6;
        for (let i = 0; i < n; i++) {
          const k = (d * i) / (n - 1);
          setSpriteUniforms(p, it, null, it.z + k * tc);
          if (ta) gl.uniform3f(p.U.uBase, it.x - k * ts, it.y, it.z + k * tc);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        gl.uniform3fv(p.U.uRight, Rs);
        continue;
      }
      gl.uniform3fv(p.U.uRight, Rs);
      setSpriteUniforms(p, it);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gpuTag(0);
  };
  if (!hit) {
    let p = gpuState.P.shadowG;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    curve(p);
    drawGroundDepth(p, sc);
    sprites(stat);
    if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, stat);
    if (typeof drawStructureShadows === 'function') drawStructureShadows(SH);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, stat);
    if (cache) {
      const S2 = renderTarget('shadowS', res, res, { depthOnly: true });
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, SF.f);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S2.f);
      gl.blitFramebuffer(0, 0, res, res, 0, 0, res, res, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, SF.f);
      gl.viewport(0, 0, res, res);
      walkRenderer.shKey = miss ? '' : key;
      walkRenderer.shMiss = (walkRenderer.shMiss || 0) + 1;
    }
  }
  if (cache) {
    sprites(dyn);
    if (typeof drawBuildingShadows === 'function') drawBuildingShadows(SH, dyn);
    if (typeof drawPropModelShadows === 'function') drawPropModelShadows(SH, dyn);
  }
  if (typeof drawSolidPropShadows === 'function') drawSolidPropShadows(SH, items);
  endShadow();
  return SH;
}
