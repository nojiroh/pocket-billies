// Phase 20 H (early part): the GPU context's lost and restored listeners go on each canvas once, however often
// initWebgl runs on it (engine/webgl.js watchContextLoss). No graphics: a stand-in canvas counts its listeners.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import './walk-renderer.mjs';
/* the walk view's mesh caches live in these (the page loads them; the walk renderer alone doesn't) */
await import('../../game/js/buildings.js');
await import('../../game/js/prop-models.js');
await import('../../game/js/solid-props.js');
await import('../../game/js/structures.js');

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

test("a restore drops the walk view's GPU caches, shown or not (walk-view-gl.js onGlContextRestored)", () => {
  const { walkRenderer, walkView, buildingState, propModelState, solidPropState, structureState } = G,
    dead = { dead: true },
    bmesh = buildingState.mesh,
    smesh = solidPropState.meshes,
    id = walkView.id;
  walkView.id = null;
  Object.assign(walkRenderer, {
    sceneCache: new Map([['k', dead]]),
    mesh: dead,
    gtex: dead,
    ring: dead,
    basin: dead,
    prep: dead,
  });
  propModelState.meshes.set('a.json', dead);
  solidPropState.live.set(dead, 1);
  Object.assign(structureState, { mesh: dead, key: 'k', parts: [dead] });
  try {
    G.onGlContextRestored({});
    for (const k of ['sceneCache', 'mesh', 'gtex', 'ring', 'basin', 'prep']) assert.equal(walkRenderer[k], null, k);
    assert.notEqual(buildingState.mesh, bmesh);
    assert.notEqual(solidPropState.meshes, smesh);
    assert.equal(propModelState.meshes.size, 0);
    assert.equal(solidPropState.live.size, 0);
    assert.deepEqual([structureState.mesh, structureState.key, structureState.parts], [null, '', []]);
  } finally {
    walkView.id = id;
  }
});
