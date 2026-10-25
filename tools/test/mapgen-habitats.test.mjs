// Routes track RT-4: habitats (game/js/logic/mapgen.js mapgenHabitats) on the game's own scenery, biomes and set
// pieces. Over a sweep of plans, biomes and seeds: the same dials give the same points; a point is where you walk
// from the hub, off the tall grass and the jetty, clear of the props, spaced apart and no more than MAPGEN_HABITAT.most
// a habitat; a water point stands beside water and a woods point beside a forest mass (its deep ground, where the
// biome has a canopy); the lakeside plan always has water points; a place with no layout has no habitats.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen,
  C = GAME_DATA.scenery,
  ctx = { scenery: C, biomes: GAME_DATA.biomes, setPieces: GAME_DATA.setPieces };
const PLANS = Object.keys(G.MAPGEN_LAYOUTS).filter(k => k !== 'none'),
  BIOMES = ['meadow', 'lake', 'thicket', 'ridge', 'autumn', 'canyon', 'tundra', 'badlands'];
const params = (/** @type {number} */ k) => ({
  seed: 700 + k,
  biome: BIOMES[k % BIOMES.length],
  layout: PLANS[k % PLANS.length],
  pin: 'EW',
  pieces: 2 + (k % 3),
  road: {
    exits: [
      { side: 'E', t: 0.5 },
      { side: 'W', t: 0.5 },
    ],
    shape: ['winding', 'scurve', 'straight'][k % 3],
  },
});
const SWEEP = 12;

/** the tile under (x, z) on a finished scene @param {any} sc @param {number} x @param {number} z */
const tileAt = (sc, x, z) => (sc.tiles[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)];
/** whether a tile of `chars` lies within a metre of (x, z) @param {any} sc @param {number} x @param {number} z
 * @param {string} chars */
const beside = (sc, x, z, chars) =>
  [-1, -0.7, 0, 0.7, 1].some(dx => [-1, -0.7, 0, 0.7, 1].some(dz => chars.includes(tileAt(sc, x + dx, z + dz))));

test('habitats: the same dials give the same points', () => {
  const a = G.mapgenScene(params(2), ctx).scene,
    b = G.mapgenScene(params(2), ctx).scene;
  assert.ok(a.habitats, 'a laid-out place has habitats');
  assert.deepEqual(b.habitats, a.habitats);
});

test('habitats: reached, off the grass, clear of props, spaced; water by water, woods by the forest', () => {
  let water = 0,
    woods = 0;
  for (let k = 0; k < SWEEP; k++) {
    const P = params(k),
      sc = G.mapgenScene(P, ctx).scene,
      where = `${P.biome}/${P.layout} ${P.seed}`,
      R = G.mapgenReach(sc, C, sc.hub, { slope: true }),
      H = sc.habitats || {},
      canopy = Object.keys(GAME_DATA.biomes[P.biome].canopy || {}).length > 0;
    if (P.layout === 'lakeside') assert.ok(H.water && H.water.length, `${where}: a lakeside has water points`);
    for (const [kind, list] of Object.entries(H)) {
      assert.ok(['water', 'woods'].includes(kind), `${where}: no habitat "${kind}"`);
      assert.ok(list.length >= 1 && list.length <= G.MAPGEN_HABITAT.most, `${where} ${kind}: ${list.length} points`);
      list.forEach(([x, z], n) => {
        const at = `${where} ${kind} ${x},${z}`;
        assert.ok(G.mapgenReached(R, x, z), `${at}: not reached`);
        assert.ok(!'tb'.includes(tileAt(sc, x, z)), `${at}: on tall grass or a jetty`);
        assert.ok(
          sc.props.every(p => /tallgrass/.test(p.k) || Math.max(Math.abs(p.x - x), Math.abs(p.z - z)) >= 0.7),
          `${at}: on a prop`
        );
        for (const [x2, z2] of list.slice(0, n))
          assert.ok(Math.hypot(x2 - x, z2 - z) >= G.MAPGEN_HABITAT.apart - 1e-6, `${at}: too close to another`);
        if (kind === 'water') assert.ok(beside(sc, x, z, G.MAPGEN_WET), `${at}: no water beside it`);
        if (kind === 'woods' && canopy) assert.ok(beside(sc, x, z, G.MAPGEN_DEEP), `${at}: no forest beside it`);
      });
    }
    water += (H.water || []).length;
    woods += (H.woods || []).length;
  }
  assert.ok(water > 0 && woods > 0, `over the sweep: ${water} water and ${woods} woods points`);
});

test('habitats: a place with no layout has none', () => {
  const P = { ...params(1) };
  delete P.layout;
  assert.equal(G.mapgenScene(P, ctx).scene.habitats, undefined);
});
