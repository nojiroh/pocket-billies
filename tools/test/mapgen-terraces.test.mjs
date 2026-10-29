// Terrain TR-5: terraces that follow the land's contours (game/js/logic/mapgen.js mapgenTerraces, the land.lean and
// land.edges dials) and stairs up to ground you couldn't reach or leave (mapgenStairsUp). With lean 0 a hill's top is
// a terrace above its foot; lean 1 keeps the old bands rising toward the back. A front is a cliff, a grassy bank (a
// ramp too steep to walk), stepped (a shelf halfway) or a stone wall (material 5). A piece of ground the hub can't
// reach, or can't be walked back from, gets a 1 m flight of stone steps (material 8) up the gentlest wall; a summit
// no flight reaches loses its marked spot.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const C = GAME_DATA.scenery,
  ctx = { scenery: C, biomes: GAME_DATA.biomes };

/** a scene's step raise (m) and stepm flags per half-metre cell */
function grid(sc) {
  const b = Buffer.from(sc.steps, 'base64'),
    S = new Int16Array(b.buffer, b.byteOffset, b.length / 2);
  return { S: Array.from(S, v => v / 20), M: G.mapgenDecodeBase64(sc.stepm), W2: sc.w * 2, H2: sc.h * 2 };
}
/** the half-metre cells off the road, the hub and the exits' rounds, the water and the trails: where only the
 * terraces set the raise */
function plain(sc) {
  const out = [],
    R = G.mapgenReach(sc, C, sc.hub),
    road = new Set(Object.values(G.MAPGEN_SURFACES)),
    exits = (sc.edgeExits || []).map(e => G.mapgenExitPoint(sc.w, sc.h, e));
  for (let j = 0; j < sc.h * 2; j++)
    for (let i = 0; i < sc.w * 2; i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        ch = sc.tiles[sc.h - 1 - Math.floor(z)][Math.floor(x)];
      if (road.has(ch) || 'wdS'.includes(ch) || R.blk[j * R.gw + i]) continue;
      if (Math.hypot(x - sc.hub[0], z - sc.hub[1]) < 6 || exits.some(p => Math.hypot(x - p[0], z - p[1]) < 6)) continue;
      out.push({ q: j * sc.w * 2 + i, x, z });
    }
  return out;
}
const HILLY = { seed: 71, biome: 'meadow', land: { hills: 0.9, terraces: 1, cliffs: 0.6 } };
const rise = cliffs => Math.round((0.4 + cliffs * 1.2) * 20) / 20;

test('the terrace dials are kept only when given; nonsense is left out', () => {
  const a = G.mapgenParams({ seed: 1 }),
    b = G.mapgenParams({ seed: 1, land: { lean: 3, edges: 'bank' } }),
    c = G.mapgenParams({ seed: 1, land: { lean: 'x', edges: 'lava' } });
  assert.equal(Object.hasOwn(a.land, 'lean'), false);
  assert.equal(Object.hasOwn(a.land, 'edges'), false);
  assert.deepEqual([b.land.lean, b.land.edges], [1, 'bank']);
  assert.equal(Object.hasOwn(c.land, 'lean'), false);
  assert.equal(Object.hasOwn(c.land, 'edges'), false);
  /* the ledge drop's plan lays its terraces mostly as bands (the most south fronts for its ledges) */
  assert.equal(G.mapgenParams({ seed: 1, layout: 'ledges' }).land.lean, 0.7);
  assert.equal(G.mapgenParams({ seed: 1, layout: 'ledges', land: { lean: 0.2 } }).land.lean, 0.2);
});

test('lean 0: a terrace follows the land (higher levels on higher ground); lean 1: bands rising toward the back', () => {
  const r = rise(HILLY.land.cliffs);
  for (const lean of [0, 1]) {
    const sc = G.mapgenScene({ ...HILLY, land: { ...HILLY.land, lean, edges: 'cliff' } }, ctx).scene,
      { S } = grid(sc),
      by = new Map();
    for (const c of plain(sc)) {
      const lv = Math.round(S[c.q] / r);
      if (Math.abs(S[c.q] - lv * r) > 0.01) continue;
      if (!by.has(lv)) by.set(lv, { n: 0, y: 0, z: 0 });
      const o = by.get(lv);
      o.n++;
      o.y += G.mapgenSceneGround(sc, c.x, c.z);
      o.z += c.z;
    }
    const lvs = [...by.keys()].filter(k => by.get(k).n > 100).sort((a, b) => a - b),
      lo = by.get(lvs[0]),
      hi = by.get(lvs[lvs.length - 1]);
    assert.ok(lvs.length >= 3, `lean ${lean}: levels ${lvs}`);
    if (lean === 0) assert.ok(hi.y / hi.n > lo.y / lo.n + 0.8, `the top level stands on higher land`);
    else assert.ok(hi.z / hi.n > lo.z / lo.n + 10, `the top level lies further back`);
  }
});

test('a terrace front is a cliff, a grassy bank, stepped or a stone wall, as the edges dial says', () => {
  const r = rise(HILLY.land.cliffs),
    count = {};
  for (const edges of ['cliff', 'bank', 'stepped', 'wall']) {
    const sc = G.mapgenScene({ ...HILLY, land: { ...HILLY.land, edges } }, ctx).scene,
      { S, M } = grid(sc),
      n = { wall: 0, ramp: 0, half: 0 };
    for (const c of plain(sc)) {
      if ((M[c.q] & 15) === 5) n.wall++;
      if (M[c.q] & 32) n.ramp++;
      const k = S[c.q] / r;
      if (Math.abs(k - Math.round(k)) > 0.2) n.half++;
    }
    count[edges] = n;
  }
  assert.equal(count.cliff.wall, 0);
  assert.ok(count.wall.wall > 100, `stone walls: ${JSON.stringify(count.wall)}`);
  assert.ok(count.bank.ramp > count.cliff.ramp + 100, `banks: ${JSON.stringify(count)}`);
  assert.ok(count.stepped.half > count.cliff.half + 100, `stepped: ${JSON.stringify(count)}`);
  /* in a town, stone walls by default */
  const town = G.mapgenScene({ ...HILLY, kind: 'town' }, ctx).scene;
  assert.ok(
    grid(town).M.some(m => (m & 15) === 5),
    'a town gets stone walls'
  );
});

/** a flat 24 m square, nothing on it, the hub at (4, 4), with a plateau of `up` m at 12-20 m both ways */
function plateau(up) {
  const sc = G.mapgenScene(
      {
        seed: 5,
        w: 24,
        h: 24,
        land: { hills: 0 },
        nature: { growth: 0, tall: 0, clearings: 0, trees: 0 },
        props: { signs: 0, benches: 0, folk: 0 },
      },
      ctx
    ).scene,
    W2 = 48,
    raw = new Int16Array(W2 * W2);
  sc.heights = sc.heights.map(row => row.map(() => 0));
  sc.tiles = sc.tiles.map(row => 'g'.repeat(row.length));
  sc.props = [];
  sc.hub = [4, 4];
  for (let j = 24; j < 40; j++) for (let i = 24; i < 40; i++) raw[j * W2 + i] = Math.round(up * 20);
  sc.steps = G.mapgenEncodeBase64(new Uint8Array(raw.buffer));
  sc.stepm = G.mapgenEncodeBase64(new Uint8Array(W2 * W2));
  const g = {
    w: 24,
    h: 24,
    mtnE: null,
    spots: [{ kind: 'summit', x: 16, z: 16, y: up }],
    S: new Float32Array(W2 * W2),
    M: new Uint8Array(W2 * W2),
  };
  return { sc, g };
}

test('ground the hub cannot reach gets a 1 m flight of stone steps, walked both ways', () => {
  const { sc, g } = plateau(1.2);
  assert.equal(G.mapgenReached(G.mapgenReach(sc, C, sc.hub, { slope: true }), 16, 16), false, 'cut off before');
  G.mapgenStairsUp(sc, C, g);
  assert.equal(g.stairsUp, 1);
  const R = G.mapgenReach(sc, C, sc.hub, { slope: true });
  assert.ok(G.mapgenReached(R, 16, 16), 'reached after');
  assert.ok(G.mapgenReach(sc, C, [16, 16], { slope: true }).seen[R.start], 'and back');
  assert.deepEqual(
    g.spots.map(s => s.kind),
    ['summit']
  );
  const { S, M } = grid(sc),
    steps = [...M.keys()].filter(q => (M[q] & 15) === 8);
  assert.ok(steps.length >= 6 && steps.length <= 16, `${steps.length} step cells`);
  for (const q of steps) assert.ok(S[q] > 0 && S[q] < 1.2, `a step between the levels: ${S[q]}`);
  assert.ok(Math.abs(g.S[steps[0]] - S[steps[0]]) < 1e-6, "G's own steps written too");
});

test('a wall too tall for a flight gets none; its summit loses its marked spot', () => {
  const { sc, g } = plateau(2.4);
  const before = sc.steps;
  G.mapgenStairsUp(sc, C, g);
  assert.equal(g.stairsUp, 0);
  assert.equal(sc.steps, before);
  assert.deepEqual(g.spots, []);
  assert.equal(g.summitsDropped, 1);
});
