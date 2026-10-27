// RL-7: a run's scenes and world tables (game/js/logic/run-scenes.js) on small tables of its own: each node's exits
// in the order its scene is made with them and the ids the generator gives them, the dials drawn from rules.json
// run.scene, the wild levels by row, and the world: Copperleaf first, a place per node, a seam road per link from
// an east exit to a west one. Making the scenes on the game's data is run-world-real.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashString, rngFrom } from '../../game/js/logic/rng.js';
import { runSpot } from '../../game/js/logic/run-map.js';
import {
  runMapIdOf,
  runPlaceId,
  runPlaceName,
  runSceneDials,
  runSceneExitTo,
  runSceneExits,
  runSceneParams,
  runWildLevels,
  runWorldTables,
} from '../../game/js/logic/run-scenes.js';

/* the landing, two lanes with a switch (2 leads to 3 and 4), a town merging the two, the boss:
   row 0: 0 · row 1: 1, 2 · row 2: 3, 4 · row 3: 5 */
const MAP = {
  nodes: [
    { type: 'landing', row: 0, lane: 0, to: [1, 2], biome: 'meadow' },
    { type: 'route', row: 1, lane: 0, to: [3], biome: 'meadow' },
    { type: 'route', row: 1, lane: 1, to: [3, 4], biome: 'lake' },
    { type: 'town', row: 2, lane: 0, to: [5], biome: 'lake' },
    { type: 'route', row: 2, lane: 1, to: [5], biome: 'meadow' },
    { type: 'boss', row: 3, lane: 0, to: [], biome: 'meadow' },
  ],
};
const DATA = {
  nodeTypes: {
    landing: { name: 'Landing', engine: 'scene' },
    route: { name: 'Route', engine: 'scene', weight: 4 },
    town: { name: 'Town', engine: 'scene', weight: 1 },
    boss: { name: 'Boss', engine: 'scene' },
  },
  biomes: {
    meadow: { name: 'Meadow', climate: 'mild', pool: 'grass', battleStage: 'grass', mood: 'green' },
    lake: { name: 'Lake', climate: 'mild', pool: 'pond', battleStage: 'lake', mood: 'lakeside' },
  },
  pools: {
    grass: {
      lv: [40, 45],
      list: [
        ['sprout0', 3],
        ['sparky0', 1],
      ],
    },
    pond: { lv: [15, 18], list: [['bubbly0', 1]] },
  },
  scenery: {},
  rules: {
    scene: {
      land: { hills: [0.2, 0.6], water: { none: 2, pond: 1, stream: 0 } },
      road: { wobble: [0.3, 0.8] },
      feature: { none: 1, glade: 1 },
    },
    wild: { lv: [3, 5], perRow: 1, back: 2 },
  },
};
const RUN = { seed: 'RL7SCENES', map: MAP };
const HUB = { id: 'copperleaf', name: 'Copperleaf Town', mapId: 'copperleaf', kind: 'town', pool: 'hedgerow' };

test("a node's exits: the first west, the first east (the main road; WM-1: runs go west to east), then the second of each, with the generator's ids", () => {
  const exits = (/** @type {number} */ i) => runSceneExits(MAP, i).map(e => [e.side, e.t, e.id, e.node]);
  assert.deepEqual(exits(0), [
    ['E', 0.15625, 'east', 1],
    ['E', 0.84375, 'east2', 2],
  ]);
  assert.deepEqual(exits(2), [
    ['W', 0.5, 'west', 0],
    ['E', 0.15625, 'east', 3],
    ['E', 0.84375, 'east2', 4],
  ]);
  assert.deepEqual(exits(3), [
    ['W', 0.15625, 'west', 1],
    ['E', 0.5, 'east', 5],
    ['W', 0.84375, 'west2', 2],
  ]);
  assert.deepEqual(exits(5), [
    ['W', 0.15625, 'west', 3],
    ['W', 0.84375, 'west2', 4],
  ]);
  assert.equal(runSceneExitTo(MAP, 2, 4)?.id, 'east2');
  assert.equal(runSceneExitTo(MAP, 4, 2)?.id, 'west');
  assert.equal(runSceneExitTo(MAP, 1, 4), null, 'no link, no exit');
});

test("a node's dials: from its stream, inside the ranges, a choice only by weight, the file's layout doesn't matter", () => {
  const rule = DATA.rules.scene,
    a = runSceneDials(rule, rngFrom('X|n3', 'scene|dials')),
    b = runSceneDials(rule, rngFrom('X|n3', 'scene|dials'));
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a).sort(), ['feature', 'land', 'road']);
  /* the same rules written in another order draw the same */
  const shuffled = {
    road: { wobble: [0.3, 0.8] },
    feature: { glade: 1, none: 1 },
    land: { water: { stream: 0, pond: 1, none: 2 }, hills: [0.2, 0.6] },
  };
  assert.deepEqual(runSceneDials(shuffled, rngFrom('X|n3', 'scene|dials')), a);
  const seen = { water: new Set(), feature: new Set() };
  for (let k = 0; k < 400; k++) {
    const d = runSceneDials(rule, rngFrom('X|n' + k, 'scene|dials'));
    assert.ok(d.land.hills >= 0.2 && d.land.hills <= 0.6, `hills ${d.land.hills}`);
    assert.ok(d.road.wobble >= 0.3 && d.road.wobble <= 0.8, `wobble ${d.road.wobble}`);
    assert.equal(Math.round(d.land.hills * 100) / 100, d.land.hills, 'to the hundredth');
    seen.water.add(d.land.water);
    seen.feature.add(d.feature);
  }
  assert.deepEqual([...seen.water].sort(), ['none', 'pond'], 'a weight of 0 is never picked');
  assert.deepEqual([...seen.feature].sort(), ['glade', 'none']);
});

test("a node's generator dials: the run's seed, biome, size and exits; it can't be made before its parents", () => {
  assert.throws(() => runSceneParams(RUN, 3, [], DATA), /node 3 needs node 1's scene first/);
  /* the landing has no parent: its dials need no scene */
  const P = runSceneParams(RUN, 0, [], DATA);
  assert.deepEqual([P.kind, P.biome, P.w, P.h, P.edges.length], ['route', 'meadow', 112, 64, 0]);
  assert.deepEqual(P.road.exits, [
    { side: 'E', t: 0.15625, width: 2 },
    { side: 'E', t: 0.84375, width: 2 },
  ]);
  assert.equal(P.road.wobble, runSceneDials(DATA.rules.scene, rngFrom('RL7SCENES|n0', 'scene|dials')).road.wobble);
  assert.equal(P.seed, hashString('RL7SCENES|n0|scene') % 2147483647, "the node's own seed");
});

test("wild levels by row: the landing's, one more a row, never past 100", () => {
  assert.deepEqual(runWildLevels(MAP, 0, DATA), [3, 5]);
  assert.deepEqual(runWildLevels(MAP, 3, DATA), [5, 7]);
  assert.deepEqual(runWildLevels(MAP, 5, DATA), [6, 8]);
  const steep = { ...DATA, rules: { ...DATA.rules, wild: { lv: [90, 98], perRow: 2, back: 2 } } };
  assert.deepEqual(runWildLevels(MAP, 5, steep), [96, 100]);
});

test("the run's world: Copperleaf first, a place per node, a seam road per link, each node's pool", () => {
  const W = runWorldTables(RUN, HUB, DATA);
  /* RL-8b: off the run's own map (no land, pin or things on it), the rest as it is */
  assert.deepEqual(
    W.locations[0],
    { ...HUB, bowl: { a: 0, r: 0, ...HUB.bowl, off: true } },
    'Copperleaf is world node 0'
  );
  assert.equal((HUB.bowl || {}).off, undefined, "the hub's own row is left alone");
  const places = W.locations.slice(1);
  assert.deepEqual(
    places.map(p => [p.id, p.name, p.kind, p.route, p.town || 0, p.pool, p.runNode]),
    [
      ['run_0', 'Meadow Landing', 'route', 'Landing', 0, 'run_0', 0],
      ['run_1', 'Meadow Route', 'route', 'Route', 0, 'run_1', 1],
      ['run_2', 'Lake Route', 'route', 'Route', 0, 'run_2', 2],
      ['run_3', 'Lake Town', 'town', 'Town', 1, 'run_3', 3],
      ['run_4', 'Meadow Route', 'route', 'Route', 0, 'run_4', 4],
      ['run_5', 'Meadow Boss', 'route', 'Boss', 0, 'run_5', 5],
    ]
  );
  assert.equal(runPlaceName(MAP, 3, DATA), 'Lake Town');
  places.forEach((p, i) => {
    assert.equal(p.mapId, runMapIdOf('RL7SCENES', i));
    assert.deepEqual(p.bowl, runSpot(MAP, i));
    assert.equal(p.battleStage, DATA.biomes[MAP.nodes[i].biome].battleStage);
    assert.equal(p.mood, DATA.biomes[MAP.nodes[i].biome].mood);
  });
  assert.match(runMapIdOf('RL7SCENES', 3), /^run_3_[a-z0-9]+$/);
  assert.notEqual(runMapIdOf('RL7SCENES', 3), runMapIdOf('RL7OTHER', 3), 'two runs never share a map id');
  assert.equal(runPlaceId(3), 'run_3');
  /* the pools: the biome's species, the row's levels (not the source pool's 40-45) */
  assert.deepEqual(W.pools.run_0, { lv: [3, 5], list: DATA.pools.grass.list });
  assert.deepEqual(W.pools.run_3, { lv: [5, 7], list: DATA.pools.pond.list });
  assert.notEqual(W.pools.run_0.list, DATA.pools.grass.list, 'a copy');
  /* a road per link, from the parent's east exit to the child's west one */
  const id = (/** @type {number} */ i) => runMapIdOf('RL7SCENES', i);
  assert.deepEqual(
    W.roads.map(r => [r.id, r.kind, r.a.map, r.a.exit, r.b.map, r.b.exit]),
    [
      ['road:run_0-run_1', 'seam', id(0), 'east', id(1), 'west'],
      ['road:run_0-run_2', 'seam', id(0), 'east2', id(2), 'west'],
      ['road:run_1-run_3', 'seam', id(1), 'east', id(3), 'west'],
      ['road:run_2-run_3', 'seam', id(2), 'east', id(3), 'west2'],
      ['road:run_2-run_4', 'seam', id(2), 'east2', id(4), 'west'],
      ['road:run_3-run_5', 'seam', id(3), 'east', id(5), 'west'],
      ['road:run_4-run_5', 'seam', id(4), 'east', id(5), 'west2'],
    ]
  );
});
