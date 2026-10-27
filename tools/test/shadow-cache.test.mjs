// Phase 20 R3 (shadows lane, F8): models in the shadow cache (the only path since R4): the far sun map's cache holds
// the models whose mesh holds still (a tree whose leaves sway among them), never one that bobs, tumbles, turns a part
// or moves; pictures as before; the cache key changes with which items it holds. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadowSetup, withOldShadowSprites } from './shadow-fixture.mjs';
await import('../../game/js/prop-models.js');

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
function lists() {
  shadowSetup();
  provide({ propModelMesh: (path, rec) => rec.mesh });
  G.fittedShadowPass(items(), SUN, null);
  return {
    stat: G.SHADOW_LISTS.stat.map(it => it.id),
    dyn: G.SHADOW_LISTS.dyn.map(it => it.id),
    key: walkRenderer.shKey,
  };
}
test('still meshes cached (swaying leaves or not), moving models drawn each frame, pictures as before', () => {
  const L = lists();
  assert.deepEqual(L.stat, ['oak', 'swayingOak', 'rock']);
  assert.deepEqual(L.dyn, ['mill', 'airship', 'boat', 'pyramid', 'cart', 'loading', 'grass', 'cloud', 'man']);
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
test('the cache key carries the signature of what the cache holds', () => {
  shadowSetup();
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

// ---------- E11, the owner's option (a): "Far shadows hold still" ----------
function swayers() {
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
    M: { sway: 1 },
    still: false,
    ...o,
  });
  return [
    it('grass', 1, { shear: 0.07, rest: 0 }),
    it('bush', 2, { shear: -0.05, rest: 0.02, fixed: true, plane: true }),
    it('flagPole', 3, { shear: 0.09 }),
    it('rock', 4, { shear: 0, still: true, M: {} }),
    it('cloud', 5, { shear: 0.1, rest: 0, vol: true }),
  ];
}
function farLists(on) {
  shadowSetup();
  const run = () => G.fittedShadowPass(swayers(), SUN, null);
  if (on) run();
  else withOldShadowSprites(run);
  return {
    stat: G.SHADOW_LISTS.stat.map(it => it.id),
    dyn: G.SHADOW_LISTS.dyn.map(it => it.id),
    key: walkRenderer.shKey,
  };
}
test('far shadows hold still: what only the wind sways is cached; anything else as before', () => {
  for (const on of [false, true]) {
    const A = farLists(on);
    assert.deepEqual(A.stat, ['grass', 'bush', 'rock']);
    assert.deepEqual(A.dyn, ['flagPole', 'cloud']);
    assert.equal(A.key.split('|').at(-1), G.shadowCasterSignature(G.SHADOW_LISTS.stat));
  }
});
// the shear each picture is drawn with, one at a time (the last uShear before its draw) and as instances
function shears(on, rest) {
  const gl = shadowSetup(),
    run = () => G.drawShadowSprites({ vp: ['x'] }, swayers(), SUN, [0, 0, 0, 1e9], null, rest);
  if (on) run();
  else withOldShadowSprites(run);
  const out = {};
  if (on) {
    for (let i = 0; i < G.SHADOW_QUADS.n; i++) out[G.SHADOW_QUADS.list[i].T] = G.SHADOW_QUADS.list[i].shear;
    return out;
  }
  let tex = null,
    sh = null;
  for (const [k, ...a] of gl.calls) {
    if (k === 'bindTexture') tex = a[1];
    else if (k === 'uniform1f' && a[0] === 'uShear') sh = a[1];
    else if (k === 'drawArrays') out[tex] = sh;
  }
  return out;
}
test('the far map’s still part draws them at rest, the rest of the time with the wind (both paths)', () => {
  for (const on of [false, true]) {
    assert.deepEqual(shears(on, true), { grass: 0, bush: 0.02, flagPole: 0.09, rock: 0 }, `instances ${on}`);
    assert.deepEqual(shears(on, false), { grass: 0.07, bush: -0.05, flagPole: 0.09, rock: 0 }, `instances ${on}`);
  }
});
test('a model’s leaf pictures at rest when the model stands still, none when it bobs', () => {
  G.artImage = () => ({ width: 16, height: 16 });
  const model = o => ({
    k: 'prop',
    x: 1,
    y: 0,
    z: 1,
    p: { s: 1, x: 1, z: 1 },
    M: {},
    flip: 1,
    shear: 0.06,
    vox: { layers: [{ k: 'img', img: 'leaf.png', x: 0, y: 2, z: 0, sway: 0.5, shadow: 1 }] },
    ...o,
  });
  const out = [];
  G.propModelImageItems(model({ rest: 0.01 }), out);
  G.propModelImageItems(model({ rest: 0.01, M: { bob: 0.3 } }), out);
  G.propModelImageItems(model({}), out);
  assert.deepEqual(
    out.map(it => [it.shear, it.rest]),
    [
      [0.03, 0.005],
      [0.03, undefined],
      [0.03, undefined],
    ]
  );
});
