// Phase 20 H (early part): the GPU context's lost and restored listeners go on each canvas once, however often
// initWebgl runs on it (engine/webgl.js watchContextLoss). No graphics: a stand-in canvas counts its listeners.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import './walk-renderer.mjs';

const G = globalThis;

/* a canvas stand-in: keeps its listeners and fires them on demand */
function fakeCanvas() {
  const on = {};
  return {
    on,
    addEventListener(k, f) {
      (on[k] ||= []).push(f);
    },
    fire(k, e = { preventDefault() {} }) {
      for (const f of on[k] || []) f(e);
    },
  };
}

test('the lost and restored listeners are added once per canvas', () => {
  const cv = fakeCanvas(),
    other = fakeCanvas();
  assert.equal(G.watchContextLoss(cv), true);
  assert.equal(G.watchContextLoss(cv), false);
  assert.equal(G.watchContextLoss(cv), false);
  assert.equal(cv.on.webglcontextlost.length, 1);
  assert.equal(cv.on.webglcontextrestored.length, 1);
  assert.equal(G.watchContextLoss(other), true, 'another canvas gets its own pair');
});

test('a loss marks the context lost and a restore clears it and hands the canvas back once', () => {
  const cv = fakeCanvas(),
    seen = [],
    was = G.onGlContextRestored;
  G.watchContextLoss(cv);
  G.onGlContextRestored = c => seen.push(c);
  let prevented = false;
  try {
    cv.fire('webglcontextlost', { preventDefault: () => (prevented = true) });
    assert.equal(G.gpuState.lost, 1);
    assert.ok(prevented, 'the page asks for the context back');
    G.gpuState.cv = cv;
    G.watchContextLoss(cv);
    cv.fire('webglcontextrestored');
    assert.equal(G.gpuState.lost, 0);
    assert.equal(G.gpuState.cv, null, 'the next mount makes the context again');
    assert.deepEqual(seen, [cv]);
  } finally {
    G.onGlContextRestored = was;
  }
});
