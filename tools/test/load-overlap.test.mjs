// Fluid track FL-4b (the load overlap, LD-5's leftovers): the one-off work's budget a quarter of the paced slot
// (quality.slotBudget, game/js/logic/load-budget.js slotWorkMs); pictures let go by the time they were last used
// (quality.texAge, textureTrimOrder). No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
await import('./walk-renderer.mjs');
const { slotWorkMs, textureTrimOrder, TEXTURE_AGE_MS } = await import('../../game/js/logic/load-budget.js');

test('slotBudget: a quarter of the paced slot, 2 to 12 ms (the owner: 4 at 60, 8 at 30, 2 at 120)', () => {
  const at = fps => slotWorkMs(1000 / fps);
  assert.equal(Math.round(at(60)), 4);
  assert.equal(Math.round(at(30)), 8);
  assert.equal(Math.round(at(120)), 2);
  // the half rate on a 60 Hz screen: two refreshes, the slot of 30
  assert.equal(slotWorkMs((2 * 1000) / 60), at(30));
  // a slow rate behind a window (20 a second) is held to 12; a very fast screen to 2
  assert.equal(at(20), 12);
  assert.equal(at(240), 2);
  // no slot known: the most
  assert.equal(slotWorkMs(0), 12);
  assert.equal(slotWorkMs(NaN), 12);
});

test('texAge: unused for longer than 10 s by the clock go, the longest unused first; recent ones stay', () => {
  const now = 100000,
    E = [
      ['a', { ut: now - 5000 }],
      ['b', { ut: now - 30000 }],
      ['c', { ut: now - 11000 }],
      ['d', { ut: now - TEXTURE_AGE_MS }],
      ['e', {}],
    ];
  assert.deepEqual(
    textureTrimOrder(E, now).map(x => x[0]),
    ['e', 'b', 'c']
  );
  // a battle or a 30 fps walk ages a picture as a 60 fps walk does: only time counts
  assert.deepEqual(
    textureTrimOrder([['x', { ut: 0 }]], 9000).map(x => x[0]),
    []
  );
});

// quality.meshWorker: a low-poly model's mesh built on the helper thread (game/js/prop-mesh-worker.js) is the mesh
// the page builds (logic/low-poly.js lowPolyMeshData), handed over without a copy; the page asks once per recipe.
const { readFileSync } = await import('node:fs');
const { join } = await import('node:path');
const { ROOT } = await import('./load-logic.mjs');
await import('../../game/js/prop-models.js');
const { lowPolyFromRecipe, lowPolyMeshData, lowPolyMeshBuffers } = await import('../../game/js/logic/low-poly.js');
const { spinGroups } = await import('../../game/js/logic/spin-merge.js');
await import('../../game/js/prop-meshes.js');
const { propMeshes, propMeshGet, propMeshMessage, propMeshAhead } = /** @type {any} */ (globalThis);
const { readGameData } = await import('../data-files.mjs');
const MODELS = Object.entries(readGameData().scenery.props)
  .filter(([, M]) => typeof M.model === 'string')
  .map(([k, M]) => ({ k, rec: JSON.parse(readFileSync(join(ROOT, 'game/art', M.model), 'utf8')) }))
  .filter(({ rec }) => rec.kind !== 'mesh' && !(rec.layers || []).some(l => l.k === 'raw' && !l.hide));
const bytes = a => new Uint8Array(a instanceof ArrayBuffer ? a : a.buffer, a.byteOffset || 0, a.byteLength);

test('meshWorker: the mesh data is the still layers’ mesh and one joined mesh per turning group', () => {
  const W = MODELS.find(({ k }) => k === 'windmill');
  assert.ok(W, 'the windmill has a recipe');
  const D = lowPolyMeshData(W.rec),
    still = lowPolyFromRecipe({ ...W.rec, layers: W.rec.layers.filter(l => !l.spin) });
  assert.deepEqual(bytes(D.vb), bytes(still.vb));
  assert.deepEqual([...D.ib], [...still.ib]);
  assert.equal(D.spins.length, spinGroups(W.rec.layers).length);
  assert.ok(D.spins[0].n > 0 && D.spins[0].spin && D.spins[0].c);
});

test('meshWorker: the helper thread’s reply, handed over, is the page’s mesh (every low-poly prop of the data)', async () => {
  const sent = [];
  globalThis.self = { postMessage: (m, transfer) => sent.push(structuredClone(m, { transfer })) };
  await import('../../game/js/prop-mesh-worker.js');
  let n = 0;
  for (const { k, rec } of MODELS) {
    await globalThis.self.onmessage({ data: { kind: 'mesh', id: ++n, rec: structuredClone(rec) } });
    const r = sent.pop(),
      D = lowPolyMeshData(rec);
    assert.equal(r.kind, 'mesh', k);
    if (!D) {
      assert.equal(r.D, null, k);
      continue;
    }
    assert.deepEqual(bytes(r.D.vb), bytes(D.vb), k);
    assert.deepEqual([...r.D.ib], [...D.ib], k);
    assert.equal(r.D.ib.constructor, D.ib.constructor, k);
    assert.deepEqual(r.D.box, D.box, k);
    assert.deepEqual(r.D.wins, D.wins, k);
    assert.equal(r.D.glow, D.glow, k);
    assert.equal(r.D.spins.length, D.spins.length, k);
    for (let i = 0; i < D.spins.length; i++) assert.deepEqual(bytes(r.D.spins[i].vb), bytes(D.spins[i].vb), k);
  }
  assert.ok(n > 20, `${n} low-poly props`);
  // every buffer handed over once
  const D = lowPolyMeshData(MODELS.find(({ k }) => k === 'windmill').rec);
  assert.equal(lowPolyMeshBuffers(D).length, new Set(lowPolyMeshBuffers(D)).size);
  delete globalThis.self;
});

test('meshWorker: asked once while it is built, taken once, built again for a new recipe; on the page with no thread', () => {
  const posts = [],
    W0 = globalThis.Worker,
    D0 = globalThis.document;
  globalThis.document = { baseURI: 'http://x/' };
  globalThis.Worker = class {
    postMessage(m) {
      posts.push(m);
    }
    terminate() {}
  };
  try {
    Object.assign(propMeshes, { w: null, off: '' });
    const rec = MODELS[0].rec;
    assert.equal(propMeshGet('a', rec), undefined);
    assert.equal(propMeshGet('a', rec), undefined);
    assert.equal(posts.length, 1, 'asked once');
    assert.equal(propMeshAhead('a', rec), false, 'already under way');
    propMeshMessage({ kind: 'mesh', id: posts[0].id, D: lowPolyMeshData(rec) });
    const D = propMeshGet('a', rec);
    assert.ok(D && D.vb);
    // a Studio edit: another recipe for the same path is built again, a late reply for the old one is let go
    const rec2 = structuredClone(rec);
    assert.equal(propMeshGet('a', rec2), undefined);
    assert.equal(posts.length, 2);
    propMeshMessage({ kind: 'mesh', id: posts[0].id, D: null });
    assert.equal(propMeshGet('a', rec2), undefined);
    // the thread fails: the page builds it
    propMeshMessage({ kind: 'failed', id: posts[1].id, error: 'x' });
    assert.ok(propMeshes.off);
    const P = propMeshGet('a', rec2);
    assert.ok(P && P.vb && propMeshes.page >= 1);
  } finally {
    globalThis.Worker = W0;
    globalThis.document = D0;
    Object.assign(propMeshes, { w: null, off: '' });
    propMeshes.jobs.clear();
    propMeshes.ids.clear();
    propMeshes.done.clear();
  }
});

// quality.uploadQueue: a picture's first upload waits for its bitmap (createImageBitmap, off the page); then the first
// of a tick always goes, the rest only while the frame's one-off budget lasts; a bitmap that can't be made falls back
// to the picture itself.
test('uploadQueue: bitmap first, the first upload of a tick always, the rest within the budget', async () => {
  const G = /** @type {any} */ (globalThis),
    saved = {
      img: G.HTMLImageElement,
      cib: G.createImageBitmap,
      body: G.document.body,
      gl: G.gpuState.gl,
      left: G.frameBudgetLeft,
    };
  class Img {
    constructor(bad) {
      this.naturalWidth = this.naturalHeight = this.width = this.height = 4;
      this.bad = bad;
    }
  }
  G.HTMLImageElement = Img;
  G.createImageBitmap = async im => {
    if (im.bad) throw new Error('no');
    return { of: im, close() {} };
  };
  G.document.body = { classList: { contains: () => false } };
  G.gpuState.gl = {};
  const Q = G.uploadQueue,
    src = G.queuedUploadSource;
  try {
    const a = new Img(),
      b = new Img(),
      c = new Img(true);
    assert.equal(src(a), null, 'waits for its bitmap');
    assert.equal(src(b), null);
    assert.equal(src(c), null);
    await new Promise(r => setTimeout(r, 0));
    Q.n = 0;
    G.frameBudgetLeft = () => false;
    assert.equal(src(a).of, a, 'the first of a tick goes, whatever the budget');
    Q.n = 1;
    const held = Q.held;
    assert.equal(src(b), null, 'the second waits for a frame with budget left');
    assert.equal(Q.held, held + 1);
    G.frameBudgetLeft = () => true;
    assert.equal(src(b).of, b);
    assert.equal(src(c), c, 'no bitmap: the picture itself');
    assert.ok(Q.failed >= 1);
    // not an <img> (a canvas): as before, at once
    const cv = { width: 4, height: 4 };
    assert.equal(src(cv), cv);
  } finally {
    G.HTMLImageElement = saved.img;
    G.createImageBitmap = saved.cib;
    G.document.body = saved.body;
    G.gpuState.gl = saved.gl;
    G.frameBudgetLeft = saved.left;
    Q.wait.clear();
    Q.n = 0;
  }
});
