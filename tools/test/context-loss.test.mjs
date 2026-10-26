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
    lastShadow: dead,
  });
  propModelState.meshes.set('a.json', dead);
  buildingState.fail = propModelState.fail = solidPropState.fail = 'x: null';
  solidPropState.live.set(dead, 1);
  Object.assign(structureState, { mesh: dead, key: 'k', parts: [dead] });
  try {
    G.onGlContextRestored({});
    for (const k of ['sceneCache', 'mesh', 'gtex', 'ring', 'basin', 'prep', 'lastShadow'])
      assert.equal(walkRenderer[k], null, k);
    assert.notEqual(buildingState.mesh, bmesh);
    assert.notEqual(solidPropState.meshes, smesh);
    assert.equal(propModelState.meshes.size, 0);
    assert.equal(solidPropState.live.size, 0);
    assert.deepEqual([buildingState.fail, propModelState.fail, solidPropState.fail], ['', '', ''], 'they try again');
    assert.deepEqual([structureState.mesh, structureState.key, structureState.parts], [null, '', []]);
  } finally {
    walkView.id = id;
  }
});

test("a restore makes the light block's buffer again on its next bind (engine/light.js frameBlockLost)", () => {
  const { walkView, frameBlock, gpuState } = G,
    id = walkView.id;
  walkView.id = null;
  /* the restored context is the same object as before: the old `gl === gl` check passed with a dead buffer */
  frameBlock.gl = gpuState.gl || { same: true };
  frameBlock.buf = { dead: true };
  try {
    G.onGlContextRestored({});
    assert.equal(frameBlock.gl, null);
    assert.equal(frameBlock.buf, null);
  } finally {
    walkView.id = id;
  }
});

test('a restore drops every GPU copy the world map keeps and keeps the work behind them (world-bowl.js)', async () => {
  /* the world map's module reads the game data when it loads (game-data.js), put together as the Node tools do */
  globalThis.GAMEDATA ??= (await import('../data-files.mjs')).readGameData();
  globalThis.PB_VERSION ??= 'test';
  await import('../../game/js/world-bowl.js');
  const { worldBowl } = G,
    dead = { dead: true },
    was = { ground: worldBowl.ground, wall: worldBowl.wall, skyState: worldBowl.skyState, on: worldBowl.on },
    terrain = { gl: dead, pix: dead },
    atlas = { gl: dead, c: dead },
    float = { gpu: dead, fineGpu: dead, fallsGpu: dead, waterGpu: dead, fine: dead },
    things = { gpu: dead, atlas, stand: [dead] };
  Object.assign(worldBowl, {
    on: false,
    ground: { gl: dead, mesh: dead, water: dead, shadow: dead, lines: dead, terrain, float, things, G: dead },
    wall: { gl: dead, t: dead },
    skyState: { tex: dead, gpu: dead, clouds: [dead] },
  });
  try {
    G.worldBowlContextRestored();
    const g = worldBowl.ground;
    assert.deepEqual([g.gl, g.mesh, g.water, g.shadow, g.lines], [null, null, null, null, null]);
    assert.equal(terrain.gl, null);
    assert.equal(atlas.gl, null);
    assert.deepEqual([float.gpu, float.fineGpu, float.fallsGpu, float.waterGpu], [null, null, null, null]);
    assert.equal(things.gpu, null);
    assert.equal(worldBowl.wall, null);
    assert.deepEqual([worldBowl.skyState.tex, worldBowl.skyState.gpu], [null, null]);
    /* kept: what the CPU worked out */
    assert.deepEqual(
      [terrain.pix, atlas.c, float.fine, things.stand[0], worldBowl.skyState.clouds[0]],
      Array(5).fill(dead)
    );
    assert.ok(worldBowl.dirty);
  } finally {
    Object.assign(worldBowl, was);
  }
});

test('a forced loss (H4) loses the context once and asks for it back after the given time', async () => {
  const cv = fakeCanvas(),
    ran = [],
    ext = {
      loseContext: () => (ran.push('lose'), cv.fire('webglcontextlost')),
      restoreContext: () => ran.push('restore'),
    },
    was = { gl: G.gpuState.gl, cv: G.gpuState.cv, lost: G.gpuState.lost, back: G.onGlContextRestored };
  G.watchContextLoss(cv);
  Object.assign(G.gpuState, { gl: { getExtension: k => (k === 'WEBGL_lose_context' ? ext : null) }, cv, lost: 0 });
  G.onGlContextRestored = () => {};
  try {
    assert.equal(G.forceContextLoss(5), true);
    assert.equal(G.gpuState.lost, 1);
    assert.equal(G.forceContextLoss(5), false, 'not twice while lost');
    await new Promise(r => setTimeout(r, 30));
    assert.deepEqual(ran, ['lose', 'restore']);
    cv.fire('webglcontextrestored');
    assert.equal(G.gpuState.lost, 0);
    assert.equal(G.forceContextLoss(5), false, 'no context made again yet (gpuState.cv is null)');
  } finally {
    Object.assign(G.gpuState, { gl: was.gl, cv: was.cv, lost: was.lost });
    G.onGlContextRestored = was.back;
  }
});
