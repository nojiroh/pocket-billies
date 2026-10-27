// Phase 20 R4: the models' one-at-a-time loops as game/js/prop-models.js had them before "Models in batches" and
// "Shadows in batches" became the only paths (drawVoxItems, drawLowPolyItems, the voxS loop of drawPropModelShadows,
// and their helpers). Kept here, unchanged, as the reference the instanced paths' tests compare against: what each
// item sent the card as uniforms, part by part. Not game code; nothing in game/ loads it.
const G = globalThis;

export function setItemSpin(p, it) {
  const gl = G.gpuState.gl,
    S = it.spin;
  if (S) {
    gl.uniform4f(p.U.uSpin, S.a[0], S.a[1], S.a[2], S.an);
    gl.uniform3fv(p.U.uSpinC, S.c);
  } else {
    gl.uniform4f(p.U.uSpin, 1, 0, 0, 0);
    gl.uniform3f(p.U.uSpinC, 0, 0, 0);
  }
}
export function setPropModelUniforms(p, it) {
  const gl = G.gpuState.gl,
    U = p.U,
    s = (it.p.s || 1) * (it.lk ? it.lk.size : 1),
    bo = G.mooredBob(it);
  gl.uniform3f(U.uBase, it.x, it.y + (bo ? bo[0] : 0), it.z);
  gl.uniform1f(U.uS, s);
  gl.uniform1f(U.uRot, G.propTurn(it) + (bo ? bo[1] : 0));
  gl.uniform1f(U.uFlip, it.flip || 1);
}
export function drawPropModelMesh(m) {
  const gl = G.gpuState.gl;
  gl.bindVertexArray(m.vao);
  if (m.el) gl.drawElements(gl.TRIANGLES, m.n, m.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
  else gl.drawArrays(gl.TRIANGLES, 0, m.n);
}
export function drawSpinningParts(p, m) {
  if (!m.spins || !m.spins.length) return;
  const gl = G.gpuState.gl,
    t = (G.reducedMotion ? 0 : G.walkView.t || 0) / 1000;
  for (const s of m.spins) {
    gl.uniform4f(p.U.uSpin, s.a[0], s.a[1], s.a[2], G.spinPartAngle(s, t));
    gl.uniform3fv(p.U.uSpinC, s.c);
    drawPropModelMesh(s);
  }
  gl.uniform4f(p.U.uSpin, 1, 0, 0, 0);
  gl.uniform3f(p.U.uSpinC, 0, 0, 0);
}
/* the voxel props one at a time (L is [item, mesh]) */
export function drawVoxItems(p, L) {
  const gl = G.gpuState.gl;
  for (const [it, m] of L) {
    gl.uniform3f(p.U.uBaseP, it.x, it.y, it.z);
    gl.uniform1f(p.U.uFade, it.fade ?? 1);
    gl.uniform1f(p.U.uEmit, it.glow ? it.glow : 0);
    setPropModelUniforms(p, it);
    gl.uniform1f(p.U.uQ, m.q || 1);
    setItemSpin(p, it);
    drawPropModelMesh(m);
    drawSpinningParts(p, m);
    G.propModelState.drawn++;
  }
}
/* the low-poly models one at a time */
export function drawLowPolyItems(p, L) {
  const gl = G.gpuState.gl;
  for (const [it, m] of L) {
    gl.uniform1f(p.U.uFade, it.fade ?? 1);
    gl.uniform1f(p.U.uBaseY, it.y);
    if (p.U.uCel) gl.uniform1f(p.U.uCel, it.vox && it.vox.cel != null ? it.vox.cel : 0.75);
    if (typeof G.setPropLookUniforms === 'function') G.setPropLookUniforms(p.U, it.lk, [it.x, it.y, it.z]);
    setPropModelUniforms(p, it);
    setItemSpin(p, it);
    if (p.U.uWinK) {
      const W = it.wins ? it.winL || (it.winL = G.modelWindowLight(it, G.walkRenderer.dark || 0)) : null;
      gl.uniform1f(p.U.uWinK, W ? W.k : 0);
      gl.uniform1i(p.U.uWinOn, W ? W.on : 0);
      gl.uniform1f(p.U.uWinSeed, W ? (Math.abs(Math.sin(it.x * 12.9898 + it.z * 78.233)) * 43.7585) % 1 : 0);
    }
    drawPropModelMesh(m);
    for (const q of m.more || []) drawPropModelMesh(q);
    drawSpinningParts(p, m);
    G.propModelState.drawn++;
    G.propModelState.lowPoly++;
  }
  gl.bindVertexArray(null);
}
