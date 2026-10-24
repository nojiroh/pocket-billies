// Map generator track MG-1: the route generator (game/js/logic/mapgen.js) on the game's own scenery and biomes:
// the same dials give the same scene, a stage's own seed changes only that stage, the scene is in the game's format,
// the hub reaches every exit, nothing grows on a path, in water or on a bridge.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const ctx = { scenery: GAME_DATA.scenery, biomes: GAME_DATA.biomes };
const T = GAME_DATA.scenery.terrains,
  P = GAME_DATA.scenery.props;

/* a spread of dials: every biome, shape, water and feature at least once */
const CASES = [];
{
  const biomes = Object.keys(GAME_DATA.biomes),
    shapes = Object.keys(G.MAPGEN_SHAPES),
    /* RL-R2b: the islet has its own test below (adding it here would move every case's water) */
    water = Object.keys(G.MAPGEN_WATER).filter(k => k !== 'islet'),
    feats = Object.keys(G.MAPGEN_FEATURES),
    surf = Object.keys(G.MAPGEN_SURFACES);
  const exits = [
    [
      { side: 'W', t: 0.5 },
      { side: 'E', t: 0.5 },
    ],
    [
      { side: 'S', t: 0.3 },
      { side: 'N', t: 0.7 },
    ],
    [{ side: 'S', t: 0.5 }],
    [
      { side: 'W', t: 0.4 },
      { side: 'E', t: 0.6 },
      { side: 'S', t: 0.5 },
    ],
  ];
  for (let i = 0; i < 16; i++)
    CASES.push({
      biome: biomes[i % biomes.length],
      seed: 100 + i,
      w: [112, 96, 136][i % 3],
      h: [64, 88, 76][i % 3],
      land: { hills: (i % 5) / 4, terraces: i % 4 === 1 ? 0.7 : 0, water: water[i % water.length], waterAmount: 0.6 },
      road: {
        exits: exits[i % exits.length],
        shape: shapes[i % shapes.length],
        surface: surf[i % surf.length],
        wobble: (i % 3) / 2,
      },
      feature: feats[i % feats.length],
      props: { lamps: 0.5, benches: 0.5, bins: 0.5, folk: 0.5, signs: 1 },
    });
}
const MADE = CASES.map(c => ({ c, ...G.mapgenScene(c, ctx) }));
const at = (sc, x, z) => (sc.tiles[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)];

test('the same dials give the same scene; another seed gives another', () => {
  const a = G.mapgenScene(CASES[1], ctx).scene,
    b = G.mapgenScene(structuredClone(CASES[1]), ctx).scene;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = G.mapgenScene({ ...CASES[1], seed: 999 }, ctx).scene;
  assert.notEqual(JSON.stringify(a.tiles), JSON.stringify(c.tiles));
});

test("a stage's own seed changes that stage only", () => {
  const a = G.mapgenScene(CASES[0], ctx).scene,
    b = G.mapgenScene({ ...CASES[0], seeds: { plants: 7 } }, ctx).scene;
  assert.deepEqual(a.tiles, b.tiles, 'the ground stays');
  assert.deepEqual(a.heights, b.heights, 'the land stays');
  assert.deepEqual(a.edgeExits, b.edgeExits, 'the road and exits stay');
  assert.notDeepEqual(
    a.props.filter(p => P[p.k].family || p.k.startsWith('tree')),
    b.props.filter(p => P[p.k].family || p.k.startsWith('tree')),
    'the plants change'
  );
});

test("the dials are filled in and kept in range, and the caller's are not changed", () => {
  const p = { w: 5000, seed: -3.7, road: { shape: 'nope', width: 99, exits: [{ side: 'Q' }] }, land: { hills: 7 } },
    copy = structuredClone(p),
    Q = G.mapgenParams(p);
  assert.deepEqual(p, copy);
  assert.equal(Q.w, 200);
  assert.equal(Q.seed, 3);
  assert.equal(Q.road.shape, 'winding');
  assert.equal(Q.road.width, 6);
  assert.equal(Q.land.hills, 1);
  assert.deepEqual(Q.road.exits, [{ side: 'S', t: 0.5, width: 2 }], 'no usable exit: one in the south');
  assert.equal(Q.biome, 'meadow');
});

test("the scene is in the game's format", () => {
  for (const { c, scene: sc } of MADE) {
    const where = `${c.biome} seed ${c.seed}`;
    assert.equal(sc.tiles.length, sc.h, where);
    for (const row of sc.tiles) assert.equal(row.length, sc.w, where);
    for (const ch of new Set(sc.tiles.join(''))) assert.ok(T[ch], `${where}: ground ${ch}`);
    assert.equal(sc.heights.length, sc.h + 1, where);
    for (const row of sc.heights) assert.equal(row.length, sc.w + 1, where);
    for (const p of sc.props) {
      assert.ok(P[p.k], `${where}: prop ${p.k}`);
      assert.equal(p.g, 1, `${where}: ${p.k} is marked generated`);
      assert.ok(p.x >= 0 && p.x <= sc.w && p.z >= 0 && p.z <= sc.h, `${where}: ${p.k} on the map`);
    }
    assert.ok(T[sc.edge], where);
    assert.equal(sc.kind, 'route');
    assert.equal(sc.biome, c.biome);
    assert.equal(sc.wild, 42);
    assert.ok(
      sc.props.some(p => p.w === 42),
      `${where}: wild plants marked as grow-wild marks them`
    );
    assert.equal(sc.gen.v, G.MAPGEN_VERSION);
    assert.equal(sc.gen.seed, c.seed);
    assert.equal(sc.exits.length, sc.edgeExits.length);
    const sides = {};
    for (const e of sc.edgeExits) {
      assert.ok('NSEW'.includes(e.side) && e.t > 0 && e.t < 1 && e.width === 2, `${where}: exit ${e.id}`);
      assert.ok(e.len > 0 && e.path.length >= 2, `${where}: exit ${e.id} has a path and a length`);
      assert.deepEqual(e.path[0], sc.hub, `${where}: exit ${e.id}'s path starts at the hub`);
      sides[e.id] = 1;
    }
    assert.equal(Object.keys(sides).length, sc.edgeExits.length, `${where}: exit ids are different`);
    if (sc.steps) assert.equal(Buffer.from(sc.steps, 'base64').length, sc.w * sc.h * 4 * 2, `${where}: steps size`);
    if (sc.stepm) assert.equal(Buffer.from(sc.stepm, 'base64').length, sc.w * sc.h * 4, `${where}: stepm size`);
    for (const b of sc.bridges || []) assert.ok(b.w >= 1.4 && b.kind, where);
  }
});

test('the hub reaches every exit, and the hub and exits stand on dry ground', () => {
  for (const { c, scene: sc } of MADE) {
    const where = `${c.biome} seed ${c.seed} ${c.road.shape} ${c.land.water} ${c.feature}`;
    assert.deepEqual(G.mapgenUnreachable(sc, GAME_DATA.scenery), [], where);
    assert.ok(!'wd'.includes(at(sc, ...sc.hub)), `${where}: hub on ${at(sc, ...sc.hub)}`);
    for (const e of sc.exits) assert.ok(!'wd'.includes(at(sc, ...e)), `${where}: exit on water`);
  }
});

test('a road runs straight in from each exit, on its surface', () => {
  for (const { c, scene: sc } of MADE) {
    const surf = G.MAPGEN_SURFACES[c.road.surface];
    for (const e of sc.edgeExits) {
      const [x, z] = sc.exits[sc.edgeExits.indexOf(e)],
        n = { N: [0, -1], S: [0, 1], E: [-1, 0], W: [1, 0] }[e.side];
      for (let d = 0; d < 5; d++)
        assert.equal(at(sc, x + n[0] * d, z + n[1] * d), surf, `${c.biome} seed ${c.seed} exit ${e.id} ${d} m in`);
    }
  }
});

test('nothing grows on a path, on a bridge, or in water it does not grow in', () => {
  for (const { c, scene: sc } of MADE) {
    for (const p of sc.props) {
      const M = P[p.k];
      if (!M.family && !p.k.startsWith('tree') && !p.k.startsWith('bush')) continue;
      const ch = at(sc, p.x, p.z),
        where = `${c.biome} seed ${c.seed}: ${p.k} at ${p.x},${p.z} on ${ch}`;
      assert.ok(!(T[ch] && T[ch].paved) && !'pvKqb'.includes(ch), where);
      if ('wd'.includes(ch)) assert.ok(M.grow && /[wd]/.test(M.grow), where);
      for (const b of sc.bridges || []) {
        const vx = b.b[0] - b.a[0],
          vz = b.b[1] - b.a[1],
          t = Math.max(0, Math.min(1, ((p.x - b.a[0]) * vx + (p.z - b.a[1]) * vz) / (vx * vx + vz * vz))),
          d = Math.hypot(b.a[0] + vx * t - p.x, b.a[1] + vz * t - p.z);
        assert.ok(d > b.w / 2, `${where}: on a bridge`);
      }
    }
  }
});

test('the tall grass dial sets how much tall grass (the encounters) there is', () => {
  const count = tall =>
    (
      G.mapgenScene({ ...CASES[0], nature: { tall } }, ctx)
        .scene.tiles.join('')
        .match(/t/g) || []
    ).length;
  const none = count(0),
    some = count(0.3),
    lots = count(1);
  assert.equal(none, 0);
  assert.ok(some > 0 && lots > some * 1.5, `${some} then ${lots}`);
});

test('a generated route is quick enough to show live', () => {
  const t = performance.now();
  G.mapgenScene({ ...CASES[2], w: 136, h: 88 }, ctx);
  assert.ok(performance.now() - t < 1500, 'under 1.5 s in Node');
});

/* 40 random dial sets, each reaching every exit: mapgen-dials.test.mjs (the slow tier) */

/* phase 09: a picture scaled by a placement leaves the 32 px/m grid; plants get their variety from drawn variants */
test('pictures are never scaled; plants carry a drawn variant instead', () => {
  let withV = 0,
    plants = 0;
  for (const c of CASES) {
    const sc = G.mapgenScene(c, ctx).scene;
    for (const p of sc.props) {
      const M = P[p.k];
      if (!M.model) assert.equal(p.s, undefined, `${p.k}: a picture is scaled (${p.s})`);
      if (M.variants && M.variants.some(r => r.weight > 0)) plants++;
      if (p.v) {
        assert.ok(M.variants && Number.isInteger(p.v) && p.v >= 1 && p.v <= M.variants.length, `${p.k}: v ${p.v}`);
        withV++;
      }
    }
  }
  assert.ok(withV > plants * 0.5, `most plants with variants get one (${withV} of ${plants})`);
});

test('the variant pick follows the weights, the prop as drawn counting 1', () => {
  const M = { variants: [{ weight: 1 }, { weight: 2 }, { weight: 0 }] },
    n = [0, 0, 0, 0],
    W = { vrnd: null, rng: () => modules.rng.rngFrom(7, 'v') };
  for (let i = 0; i < 4000; i++) n[G.mapgenPickVariant(W, M)]++;
  assert.equal(n[3], 0, 'a weight of 0 is never picked');
  assert.ok(Math.abs(n[2] / 4000 - 0.5) < 0.04 && Math.abs(n[0] / 4000 - 0.25) < 0.04, n.join(','));
  assert.equal(G.mapgenPickVariant(W, { name: 'no variants' }), 0);
});

test('RL-R2b: an islet is the sea round a round of land on the hub, its exits reached on foot by causeways', () => {
  for (const seed of [7, 8, 9]) {
    const { scene: sc, notes } = G.mapgenScene(
      {
        biome: 'lake',
        seed,
        w: 112,
        h: 64,
        pin: 'EW',
        land: { water: 'islet', waterAmount: 0.8 },
        road: {
          exits: [
            { side: 'E', t: 0.5, width: 2 },
            { side: 'W', t: 0.5, width: 2 },
          ],
        },
      },
      ctx
    );
    assert.deepEqual(notes, [], `seed ${seed}`);
    assert.equal(sc.waterKind, 'sea');
    const wet = (/** @type {string} */ c) => c === 'd' || c === 'w',
      rim = [...sc.tiles[0], ...sc.tiles[sc.h - 1]];
    assert.ok(rim.filter(wet).length > rim.length * 0.7, `seed ${seed}: the sea along the north and south`);
    assert.ok(!wet(sc.tiles[Math.floor(sc.hub[1])][Math.floor(sc.hub[0])]), `seed ${seed}: the hub on land`);
    assert.deepEqual(
      G.mapgenUnreachable(sc, GAME_DATA.scenery),
      [],
      `seed ${seed}: the hub reaches every exit on foot`
    );
  }
});
