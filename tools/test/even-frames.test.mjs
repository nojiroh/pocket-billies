// Fluid track FL-4 (even frames): the far shadow map's cache keyed per prop-grid cell in view (quality.shadowCells) and
// held when nothing in it moved (quality.shadowHold); grass planted on a view's own walking grid and sent to the card in
// strips (quality.grassAhead) with the same blades as in one go; mapCacheKey the same key, without a new string a frame;
// the periodic jobs in free time (quality.freeTicks). No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordingGL } from './walk-renderer.mjs';
import { shadowSetup } from './shadow-fixture.mjs';
await import('../../game/js/prop-models.js');

const G = globalThis;
const { provide } = await import('../../game/js/hooks.js');
const { engineContext, walkRenderer, walkView, gpuState } = G;
const { mapCacheKey } = await import('../../game/js/walk/map-cache.js');
const { grassJob, grassStep } = await import('../../game/js/walk/grass-build.js');
const { everyFree } = await import('../../game/js/free-tick.js');
const { setWalkData } = await import('../../game/js/walk-view.js');
setWalkData(() => ({ scenes: {}, sc: { terrains: {}, props: {} } }));

// ---------- mapCacheKey ----------
test('mapCacheKey: the same key as it was made, the same string while nothing changes, a new one when the waters do', () => {
  engineContext.look = null;
  const sc = { props: [1, 2], heights: [0, 0, 0], waters: [{ x: 1, z: 2, w: 3, h: 4, k: 'pond' }], waterKind: 'pond' },
    gkey = 'ground-key';
  const k1 = mapCacheKey('copperleaf', sc, gkey);
  assert.equal(k1, G.mapCacheKeyMade('copperleaf', sc, gkey));
  assert.equal(mapCacheKey('copperleaf', sc, gkey), k1);
  sc.waters[0].w = 5; // changed in place (the Studio's water tools)
  const k2 = mapCacheKey('copperleaf', sc, gkey);
  assert.notEqual(k2, k1);
  assert.equal(k2, G.mapCacheKeyMade('copperleaf', sc, gkey));
  sc.props.push(3);
  assert.equal(mapCacheKey('copperleaf', sc, gkey), G.mapCacheKeyMade('copperleaf', sc, gkey));
  sc.flatFar = true;
  assert.equal(mapCacheKey('copperleaf', sc, gkey), G.mapCacheKeyMade('copperleaf', sc, gkey));
  assert.equal(mapCacheKey('other', sc, gkey), G.mapCacheKeyMade('other', sc, gkey));
  const room = { groundOf: sc, roomBase: 'other' };
  assert.equal(mapCacheKey('room', room, gkey), G.mapCacheKeyMade('other', sc, gkey));
});

// ---------- the far map's cache per grid cell ----------
const SUN = { travel: [0.4, -0.8, 0.45] };
const prop = (id, x, z, o = {}) => ({
  k: 'prop',
  id,
  x,
  y: 0,
  z,
  w: 32,
  h: 32,
  mpp: 1 / 32,
  ox: -16,
  oy: -32,
  sh: 1,
  flip: 1,
  still: true,
  im: { T: { t: id } },
  M: {},
  ...o,
});
// three cells of the 6 m grid: (0,0), (1,0) and (3,0); placements are the items' p
function place() {
  const P = [
    { k: 'a', x: 1, z: 1 },
    { k: 'b', x: 2, z: 2 },
    { k: 'c', x: 7, z: 1 },
    { k: 'd', x: 19, z: 1 },
  ];
  const cell = (L, x) => ({ list: L, x, y: 0, z: 3, r: 4 });
  const grid = { sc: walkView.sc, cells: [cell([P[0], P[1]], 3), cell([P[2]], 9), cell([P[3]], 21)] };
  return { P, grid };
}
function frame(P, grid, list, o = {}) {
  walkRenderer.pgrid = grid;
  walkRenderer.farProps = o.far || FAR;
  walkRenderer.frustum = o.F || null;
  const items = list.map(i => prop(P[i].k, P[i].x, P[i].z, { p: P[i] }));
  for (const it of o.moving || []) items.push(it);
  const gl = gpuState.gl;
  gl.calls.length = 0;
  const SH = G.fittedShadowPass(items, SUN, null);
  /* blits: 2 when drawn again (the ground drawn, then copied to the cache), 1 when the cache was laid down */
  const redrawn = gl.calls.some(c => c[0] === 'ground'),
    blits = redrawn ? 2 : gl.calls.filter(c => c[0] === 'blitFramebuffer').length,
    drew = gl.calls.some(c => c[0] === 'sun');
  return { SH, blits, drew };
}
const FAR = [];
function cellsSetup(o = {}) {
  shadowSetup();
  provide({ propModelMesh: () => null });
  engineContext.look.quality = { shadowMap: 2048, shadowCache: true, shadowCells: true, cull: true, ...o };
  gpuState.fb.shadowS = { f: 'shadowSFB', w: 2048 };
  gpuState.gl.blitFramebuffer = (...a) => gpuState.gl.calls.push(['blitFramebuffer', ...a]);
  const P = place();
  return P;
}
// a frustum whose left side stands at x = lim (only cells reaching right of it are in view)
const rightOf = lim => [1, 0, 0, -lim, 0, 0, 0, 1e9, 0, 0, 0, 1e9, 0, 0, 0, 1e9, 0, 0, 0, 1e9, 0, 0, 0, 1e9];

test('shadowCells: a cell leaving the view keeps the cache; one coming in with new casters draws it again', () => {
  const { P, grid } = cellsSetup();
  frame(P, grid, [0, 1, 2, 3]);
  const k = walkRenderer.shKey;
  assert.ok(k && k.endsWith('|cells'));
  const blitsHit = frame(P, grid, [0, 1, 2, 3]).blits;
  assert.equal(blitsHit, 1, 'the same casters: the copy laid down (one blit), not drawn again');
  // the camera turns: cell (0,0) leaves the view (its two props are no longer gathered)
  const F = rightOf(20);
  assert.equal(frame(P, grid, [2, 3], { F }).blits, 1, 'a cell gone out of view: still the copy');
  assert.equal(walkRenderer.shKey, k);
  // the old key (switch off) draws it again when the view's cells change
  const old = cellsSetup({ shadowCells: false });
  frame(old.P, old.grid, [0, 1, 2, 3]);
  assert.equal(frame(old.P, old.grid, [2, 3], { F }).blits, 2, 'old key: drawn again and copied (two blits)');
});
test('shadowCells: a prop in view hidden (by the hour, a story flag) or a cell with new casters draws the map again', () => {
  const { P, grid } = cellsSetup();
  frame(P, grid, [0, 2, 3]);
  // the cell (0,0) in view now has prop b too (it was hidden when the map was drawn)
  assert.equal(frame(P, grid, [0, 1, 2, 3]).blits, 2, 'a caster added in a cell in view');
  assert.equal(frame(P, grid, [0, 1, 2]).blits, 2, 'a caster gone (d hidden) in a cell in view');
  assert.equal(frame(P, grid, [0, 1, 2]).blits, 1);
  // every caster of a cell gone: the cell is in view and has none
  assert.equal(frame(P, grid, [0, 1]).blits, 2, 'the last caster of a cell gone');
  // the grid made again (props moved, added or gone) or the far props: drawn again
  assert.equal(frame(P, { ...grid }, [0, 1]).blits, 2, 'a new grid');
  assert.equal(frame(P, walkRenderer.pgrid, [0, 1], { far: [] }).blits, 2, 'new far props');
});
test('shadowCells: a model that finished loading (its picture before) draws the map again', () => {
  const { P, grid } = cellsSetup();
  frame(P, grid, [0, 1, 2, 3]);
  walkRenderer.pgrid = grid;
  walkRenderer.farProps = FAR;
  const items = [0, 1, 2, 3].map(i => prop(P[i].k, P[i].x, P[i].z, { p: P[i] }));
  items[2].vox = { mesh: null };
  provide({ propModelMesh: () => ({ spins: [] }) });
  gpuState.gl.calls.length = 0;
  G.fittedShadowPass(items, SUN, null);
  assert.ok(gpuState.gl.calls.some(c => c[0] === 'ground'));
});

// ---------- the far map held ----------
test('shadowHold: nothing in the map moved, last frame’s map is used again (no clear, no copy)', () => {
  const { P, grid } = cellsSetup({ shadowHold: true });
  const MAN = { T: { t: 'man' } },
    MM = {};
  const man = () => ({ ...prop('man', 3, 3, { still: false, p: null, M: MM }), k: 'npc', im: MAN });
  const a = frame(P, grid, [0, 1, 2, 3], { moving: [man()] });
  assert.ok(a.drew);
  const b = frame(P, grid, [0, 1, 2, 3], { moving: [man()] });
  assert.equal(b.blits, 1, 'the frame after the map was drawn: the copy (nothing to compare yet)');
  const c = frame(P, grid, [0, 1, 2, 3], { moving: [man()] });
  assert.equal(c.drew, false, 'held: nothing sent to the card');
  assert.equal(c.SH, b.SH);
  const walked = man();
  walked.x += 0.05;
  assert.equal(frame(P, grid, [0, 1, 2, 3], { moving: [walked] }).blits, 1, 'someone moved: copy and draw on');
  const step = man();
  step.im = { T: { t: 'man2' } };
  frame(P, grid, [0, 1, 2, 3], { moving: [step] });
  assert.equal(frame(P, grid, [0, 1, 2, 3], { moving: [step] }).drew, false);
  const s2 = man();
  s2.im = { T: { t: 'man3' } };
  assert.equal(frame(P, grid, [0, 1, 2, 3], { moving: [s2] }).blits, 1, 'another step of the walk: drawn');
  // a model among the moving things (it may move inside its own draw): never held
  const boat = () => prop('boat', 4, 4, { still: false, bobs: true, vox: { mesh: null }, p: null });
  frame(P, grid, [0, 1, 2, 3], { moving: [boat()] });
  assert.equal(frame(P, grid, [0, 1, 2, 3], { moving: [boat()] }).blits, 1);
  // without the switch: always the copy
  const off = cellsSetup({ shadowHold: false });
  frame(off.P, off.grid, [0, 1, 2, 3]);
  frame(off.P, off.grid, [0, 1, 2, 3]);
  assert.equal(frame(off.P, off.grid, [0, 1, 2, 3]).blits, 1);
});

// ---------- grass in strips ----------
function grassScene() {
  const rows = [];
  for (let j = 0; j < 40; j++) rows.push('g'.repeat(20) + 'G'.repeat(12) + 'p'.repeat(4) + 'g'.repeat(4));
  return { w: 40, h: 40, edge: 'g', tiles: rows, props: [] };
}
function plant(strips) {
  const gl = recordingGL();
  gpuState.gl = gl;
  engineContext.look = { quality: { grassAhead: strips }, grass: { density: 1 } };
  const sc = grassScene(),
    N = 2,
    nav = { N, gw: 40 * N, gh: 40 * N, blk: new Uint8Array(40 * N * 40 * N) };
  for (let i = 0; i < 40 * N; i++) nav.blk[10 * N * 40 * N + i] = 1; // a wall along z = 10
  const target = {},
    J = grassJob(sc, nav, target);
  let slices = 0;
  while (!grassStep(J, strips ? 1 : 1e9)) slices++;
  const data = [];
  for (const c of gl.calls) {
    if (c[0] === 'bufferData' && Array.isArray(c[2]) && c[2].length > 12) data.push(...c[2]);
    if (c[0] === 'bufferSubData') data.push(...c[3].slice(c[4], c[4] + c[5]));
  }
  return { target, data, slices, calls: gl.calls };
}
test('grassAhead: the same blades in strips as in one go, on the view’s own walking grid', () => {
  const one = plant(false),
    strips = plant(true);
  assert.ok(one.target.grass && strips.target.grass);
  assert.equal(one.target.grass.n, strips.target.grass.n);
  assert.deepEqual(one.target.grass.chunks, strips.target.grass.chunks);
  assert.equal(strips.data.length, one.data.length);
  assert.ok(
    strips.data.every((v, i) => Object.is(v, one.data[i])),
    'byte for byte'
  );
  assert.ok(!one.calls.some(c => c[0] === 'bufferSubData'));
  assert.ok(strips.calls.some(c => c[0] === 'bufferSubData'));
  assert.ok(strips.slices > 1, 'over several slices');
  // nothing planted on the blocked row
  const g = strips.target.grass;
  assert.ok(g.n > 1000);
});
test('grassAhead: a job let go before it was done gives its buffers back', () => {
  const gl = recordingGL();
  gpuState.gl = gl;
  engineContext.look = { quality: { grassAhead: true }, grass: { density: 1 } };
  const sc = grassScene(),
    nav = { N: 2, gw: 80, gh: 80, blk: new Uint8Array(6400) },
    J = grassJob(sc, nav, {});
  let k = 0;
  while (!J.gpu && k++ < 1e5) grassStep(J, 0.01);
  assert.ok(J.gpu, 'part way through the upload');
  J.abort();
  assert.equal(J.gpu, null);
});

// ---------- free ticks ----------
test('freeTicks: off, the job runs on its timer; on, it is asked for in free time and never twice at once', async () => {
  const realSet = G.setInterval,
    realIdle = G.requestIdleCallback;
  let tick = null;
  const idle = [];
  G.setInterval = fn => ((tick = fn), 1);
  G.requestIdleCallback = (fn, o) => idle.push([fn, o]);
  try {
    let n = 0;
    engineContext.look = { quality: { freeTicks: false } };
    everyFree(() => n++, 150);
    tick();
    assert.equal(n, 1);
    engineContext.look = { quality: { freeTicks: true } };
    const asked = G.freeTicks.asked;
    tick();
    tick();
    assert.equal(n, 1, 'not on the timer');
    assert.equal(idle.length, 1, 'asked once');
    assert.equal(idle[0][1].timeout, 150, 'at the latest one period later');
    assert.equal(G.freeTicks.asked, asked + 1);
    idle[0][0]();
    assert.equal(n, 2);
    tick();
    assert.equal(idle.length, 2);
  } finally {
    G.setInterval = realSet;
    G.requestIdleCallback = realIdle;
  }
});
