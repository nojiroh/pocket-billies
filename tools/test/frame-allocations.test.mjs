// Phase 20 C2: the per-frame allocations taken out of the walk renderer. Each test runs the renderer's function on a
// stand-in WebGL context (tools/test/walk-renderer.mjs) and compares what it sends with the code it replaced, kept here
// as the reference. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeProgram, recordingGL } from './walk-renderer.mjs';

const G = globalThis;

// fixture sprite items: plain, flipped and sheared, sloped, with odd numbers so rounding would show
const ITEMS = [
  { x: 1, y: 0, z: 2, mpp: 0.03125, ox: -16, oy: -40, w: 32, h: 40, flip: 1, shear: 0 },
  { x: -3.7, y: 1.25, z: 9.1, mpp: 1 / 42, ox: -21.5, oy: -63, w: 43, h: 63, flip: -1, shear: 0.137, slope: 0.21 },
  { x: 12.3, y: -0.4, z: 0.333, mpp: 0.0291, ox: -7, oy: -77.7, w: 14, h: 77.7, flip: 1 },
];
const SPRITE_U = ['uBase', 'uOff', 'uUV', 'uFlip', 'uSlope', 'uShear'];

/* setSpriteUniforms as it was before C2; the callers passed a copy of the item for a slice or a rising picture */
function oldSetSpriteUniforms(gl, p, it, uv) {
  const U = p.U,
    s = it.mpp;
  gl.uniform3f(U.uBase, it.x, it.y, it.z);
  gl.uniform4f(U.uOff, it.ox * s, it.oy * s, it.w * s, it.h * s);
  gl.uniform4fv(U.uUV, uv || [0, 0, 1, 1]);
  gl.uniform1f(U.uFlip, it.flip);
  if (U.uSlope) gl.uniform1f(U.uSlope, it.slope || 0);
  gl.uniform1f(U.uShear, it.shear || 0);
}

test('sprite uniforms: a slice at another depth and a rising picture send what the item copies sent', () => {
  for (const names of [SPRITE_U, SPRITE_U.filter(n => n !== 'uSlope')]) {
    const p = fakeProgram(names);
    const want = recordingGL(),
      got = recordingGL();
    for (const it of ITEMS) {
      oldSetSpriteUniforms(want, p, it);
      oldSetSpriteUniforms(want, p, it, [0.25, 0, 0.5, 1]);
      for (let i = 0, d = 2.6, n = 6; i < n; i++)
        oldSetSpriteUniforms(want, p, Object.assign({}, it, { z: it.z + (d * i) / (n - 1) }));
      for (const rk of [1, 0.37, 0.002]) {
        const r = rk !== 1 ? Object.assign({}, it, { oy: it.oy * rk, h: it.h * rk }) : it;
        oldSetSpriteUniforms(want, p, r);
      }
    }
    G.gpuState.gl = got;
    for (const it of ITEMS) {
      G.setSpriteUniforms(p, it);
      G.setSpriteUniforms(p, it, [0.25, 0, 0.5, 1]);
      for (let i = 0, d = 2.6, n = 6; i < n; i++) G.setSpriteUniforms(p, it, null, it.z + (d * i) / (n - 1));
      for (const rk of [1, 0.37, 0.002]) G.setSpriteUniforms(p, it, null, it.z, rk);
    }
    assert.deepEqual(got.calls, want.calls);
  }
});

test('the world curve drop is the one worldCurveArgs gives, everywhere in and round a place', () => {
  const old = (x, z) => {
    const c = G.worldCurveArgs(),
      d = Math.max(0, Math.hypot(x - c[0], z - c[1]) - c[3]);
    return c[2] * d * d;
  };
  const sc0 = G.walkView.sc;
  try {
    for (const [w, h] of [
      [60, 46],
      [173, 91],
      [33.3, 120.7],
    ]) {
      G.walkView.sc = { w, h };
      for (let x = -80; x <= w + 80; x += 7.3)
        for (let z = -80; z <= h + 80; z += 5.9) assert.equal(G.worldCurveDrop(x, z), old(x, z));
    }
    G.walkView.sc = null;
    assert.equal(G.worldCurveDrop(1, 2), 0);
  } finally {
    G.walkView.sc = sc0;
  }
});
