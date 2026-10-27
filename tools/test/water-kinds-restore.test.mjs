// Phase 20 R4: the water's kinds texture (game/js/walk/water.js kindTexture, WA-5b) is made once per context and made
// again after a restore. A restored context is the same object as the lost one, so the cache must compare the
// context's generation (gpuState.gen), not gl: before the fix, after a loss the water bound a dead texture (its
// kinds black and see-through, INVALID_OPERATION every frame). No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordingGL } from './walk-renderer.mjs';

const G = globalThis;
const { gpuState } = G;

test('the kinds texture: made once per context, again after a restore of the same context object', () => {
  const gl = recordingGL();
  gpuState.gl = gl;
  const made = () => gl.calls.filter(c => c[0] === 'createTexture').length;
  G.kindTexture();
  G.kindTexture();
  assert.equal(made(), 1, 'kept within a context');
  gpuState.gen++;
  G.kindTexture();
  assert.equal(made(), 2, 'made again after a restore (same gl, new generation)');
  const up = gl.calls.filter(c => c[0] === 'texImage2D');
  assert.equal(up.length, 2);
  assert.equal(up[0][4], G.WATER_KIND_LOOKS.length, 'a column a kind');
  assert.equal(up[0][5], G.KIND_ROWS);
});
