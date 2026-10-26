// Phase 20 R3 (shadows lane, F8): Engine > Quality "Models in the shadow cache": the far sun map's cache holds the
// models whose mesh holds still (a tree whose leaves sway among them), never one that bobs, tumbles, turns a part or
// moves; pictures as before; the cache key changes with which items it holds. Off, the lists are as they were. No
// graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadowSetup } from './shadow-fixture.mjs';

const G = globalThis;
const { provide } = await import('../../game/js/hooks.js');
const { engineContext, walkRenderer } = G;
const SUN = { travel: [0.4, -0.8, 0.45] };
const mesh = (o = {}) => ({ vao: 'm', spins: [], ...o });
function items() {
  const it = (id, x, o = {}) => ({
      k: 'prop',
      id,
      x,
      y: 0,
      z: 2,
      w: 32,
      h: 32,
      mpp: 1 / 32,
      ox: -16,
      oy: -32,
      sh: 1,
      flip: 1,
      im: { T: { t: id } },
      p: { x, z: 2 },
      M: {},
      ...o,
    }),
    model = (id, x, o = {}, m = mesh()) => it(id, x, { vox: { mesh: m }, voxPath: id, ...o });
  return [
    model('oak', 1, { still: true }),
    model('swayingOak', 2, { still: false, M: { sway: 0.4 } }),
    model('mill', 3, { still: true }, mesh({ spins: [{ a: [0, 0, 1] }] })),
    model('airship', 4, { still: true, M: { bob: 0.3 } }),
    model('boat', 5, { still: false, bobs: true }),
    model('pyramid', 6, { still: true, spin: { a: [1, 0, 0], an: 1, c: [0, 0, 0] } }),
    model('cart', 7, { still: false, p: { x: 7, z: 2, moving: true } }),
    model('loading', 8, { still: true }, null),
    it('rock', 9, { still: true }),
    it('grass', 10, { still: false, M: { sway: 1 } }),
    it('cloud', 11, { still: true, vol: true }),
    { ...it('man', 12), k: 'npc' },
  ];
}
function lists(on) {
  shadowSetup();
  engineContext.look.quality.modelShadowCache = on;
  provide({ propModelMesh: (path, rec) => rec.mesh });
  G.fittedShadowPass(items(), SUN, null);
  return {
    stat: G.SHADOW_LISTS.stat.map(it => it.id),
    dyn: G.SHADOW_LISTS.dyn.map(it => it.id),
    key: walkRenderer.shKey,
  };
}
test('on: still meshes cached (swaying leaves or not), moving models drawn each frame, pictures as before', () => {
  const L = lists(true);
  assert.deepEqual(L.stat, ['oak', 'swayingOak', 'rock']);
  assert.deepEqual(L.dyn, ['mill', 'airship', 'boat', 'pyramid', 'cart', 'loading', 'grass', 'cloud', 'man']);
});
test('off: the lists as they were (the prop’s still flag alone)', () => {
  const L = lists(false);
  assert.deepEqual(L.stat, ['oak', 'mill', 'airship', 'pyramid', 'loading', 'rock']);
  assert.equal(L.key.split('|').at(-1), '', 'no signature in the key');
});
test('the casters’ signature: the same items the same, a model loaded, an item moved, added or gone a new one', () => {
  const sig = G.shadowCasterSignature,
    a = items();
  assert.equal(sig(a), sig(items()));
  const b = items();
  b[8].vox = { mesh: mesh() };
  assert.notEqual(sig(b), sig(a), 'a picture became its model');
  const c = items();
  c[0].x += 0.05;
  assert.notEqual(sig(c), sig(a), 'moved 5 cm');
  assert.notEqual(sig(a.slice(1)), sig(a), 'one gone');
  assert.notEqual(sig([...a, a[0]]), sig(a), 'one added');
  const d = items();
  [d[0], d[1]] = [d[1], d[0]];
  assert.notEqual(sig(d), sig(a), 'in another order');
});
test('on: the cache key carries the signature of what the cache holds', () => {
  shadowSetup();
  engineContext.look.quality.modelShadowCache = true;
  provide({ propModelMesh: (path, rec) => rec.mesh });
  const L = items();
  G.fittedShadowPass(L, SUN, null);
  const k1 = walkRenderer.shKey;
  L[8].vox = { mesh: mesh() };
  L[8].voxPath = 'rock';
  G.fittedShadowPass(L, SUN, null);
  assert.ok(k1 && walkRenderer.shKey && k1 !== walkRenderer.shKey);
  assert.equal(walkRenderer.shKey.split('|').at(-1), G.shadowCasterSignature(G.SHADOW_LISTS.stat));
  assert.ok(G.SHADOW_LISTS.stat.some(it => it.id === 'rock' && it.vox));
});
