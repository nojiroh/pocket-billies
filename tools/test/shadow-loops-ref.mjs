// Phase 20 R4: the shadow maps' one-at-a-time loops as the game had them before "Shadows in batches" became the only
// path: walk/shadows.js drawShadowSprites (one draw a picture) and prop-models.js drawPropModelShadows (voxS, one
// draw an item). Kept here, unchanged but for reading the game's functions through globalThis and hooks.js (so
// the tests' stand-ins apply), as the reference the instanced passes are compared against. Not game code.
import { drawPropModelMesh, drawSpinningParts, setItemSpin, setPropModelUniforms } from './model-loops-ref.mjs';
import { buildingFrontPicture, buildingGuard } from '../../game/js/hooks.js';
const G = globalThis;
export function drawShadowSprites(SH, L, sun, ca, lamp, rest) {
  const gl = G.gpuState.gl,
    p = G.gpuState.P.shadow,
    solid = G.engineSetting('shadows', 'buildings'),
    tr = sun ? sun.travel : [0, -1, 0],
    h = G.normalize3([tr[0], 0, tr[2]]),
    Rs0 = Math.hypot(tr[0], tr[2]) < 0.05 ? [1, 0, 0] : [-h[2], 0, h[0]];
  let Rs = Rs0;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
  gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
  gl.uniform1f(p.U.uCurveD0, ca[3]);
  G.bindQuad();
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(p.U.uTex, 0);
  let miss = 0;
  for (const it of L) {
    if (it.flat || it.far || it.k === 'enc2' || it.vol || it.k === 'flag' || it.vox) continue;
    if (it.k === 'prop' && !(it.sh > 0)) continue;
    /* a box building's layers cast none (its slices do): skipped before its picture is looked up or bound */
    if (it.layer && it.M.box) continue;
    G.gpuTag(it.voxImg ? 'modelPic' : 0); /* R1 measure: a model's picture layer counted apart */
    const T = G.imageTexture(it.im);
    if (!T) {
      miss++;
      continue;
    }
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    if (lamp) {
      const dx = it.x - lamp[0],
        dz = it.z - lamp[2],
        l = Math.hypot(dx, dz);
      Rs = l < 0.3 ? Rs0 : [dz / l, 0, -dx / l];
    }
    if (it.bld3) {
      let F = null;
      buildingGuard(() => {
        F = G.imageTexture(buildingFrontPicture(it.im, it.M.build, it.M));
      });
      if (!F) miss++;
      if (F) {
        gl.bindTexture(gl.TEXTURE_2D, F.t);
        gl.uniform3fv(p.U.uRight, G.FIXED_RIGHT);
        G.setSpriteUniforms(p, it);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.uniform3fv(p.U.uRight, Rs);
      }
      continue;
    }
    if (it.plane && !(solid && it.M && it.M.box)) {
      gl.uniform3fv(p.U.uRight, it.fixed ? G.pictureRight(it, G.FIXED_RIGHT) : G.FIXED_RIGHT);
      G.setSpriteUniforms(p, it);
      if (rest && it.rest !== undefined) gl.uniform1f(p.U.uShear, it.rest);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.uniform3fv(p.U.uRight, Rs);
      continue;
    }
    if (solid && it.M && it.M.box) {
      /* phase 09 batch 9: a turned building's slices turn with it and step back the way it faces */
      const ta = G.placedTurn(it.p),
        tc = Math.cos(ta),
        ts = Math.sin(ta);
      gl.uniform3f(p.U.uRight, tc, 0, ts);
      const d = it.M.box[1] * (it.p.s || 1),
        n = 6;
      for (let i = 0; i < n; i++) {
        const k = (d * i) / (n - 1);
        G.setSpriteUniforms(p, it, null, it.z + k * tc);
        if (ta) gl.uniform3f(p.U.uBase, it.x - k * ts, it.y, it.z + k * tc);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.uniform3fv(p.U.uRight, Rs);
      continue;
    }
    gl.uniform3fv(p.U.uRight, Rs);
    G.setSpriteUniforms(p, it);
    if (rest && it.rest !== undefined) gl.uniform1f(p.U.uShear, it.rest);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  G.gpuTag(0);
  return miss;
}
export function drawPropModelShadows(SH, items) {
  if (!G.propModelsOn()) return;
  G.gpuTag('model');
  G.propModelGuard(() => {
    const gl = G.gpuState.gl;
    let p = null;
    const ca = typeof G.worldCurveArgs === 'function' ? G.worldCurveArgs() : [0, 0, 0, 1e9];
    for (const it of items) {
      if (!it.vox) continue;
      const m = G.propModelMesh(it.voxPath, it.vox);
      if (!m) continue;
      if (!p) {
        p = G.gpuState.P.voxS;
        gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
        gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
        gl.uniform1f(p.U.uCurveD0, ca[3]);
      }
      setPropModelUniforms(p, it);
      gl.uniform1f(p.U.uQ, m.q || 1);
      setItemSpin(p, it);
      drawPropModelMesh(m);
      for (const q of m.more || []) drawPropModelMesh(q);
      drawSpinningParts(p, m);
    }
    gl.bindVertexArray(null);
  });
  G.gpuTag(0);
}
