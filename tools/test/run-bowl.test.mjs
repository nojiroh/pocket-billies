// RL-8b: a run's own world map from its seed (game/js/logic/run-bowl.js): land under every place, the run's biomes'
// grounds and trees, another seed another map, the same seed the same; drawn as an island world (logic/bowl.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA } from './setup-real.mjs';
import {
  RUN_BOWL_LAND,
  runBowlGround,
  runBowlLook,
  runBowlRelief,
  runBowlTrees,
} from '../../game/js/logic/run-bowl.js';
import { runMapMake, runSpot } from '../../game/js/logic/run-map.js';
import { rngFrom } from '../../game/js/logic/rng.js';
import { bowlTreeStyle } from '../../game/js/logic/bowl-things.js';
import { BOWL_ISLE_RIM, bowlCoastAt, bowlGroundGrid, bowlReliefFeatures, bowlXY } from '../../game/js/logic/bowl.js';

const { biomes, nodeTypes, worldmap } = GAME_DATA,
  RULES = GAME_DATA.rules.run.map;
const make = seed => {
  const map = runMapMake(seed, nodeTypes, RULES),
    spots = map.nodes.map((_, i) => {
      const s = runSpot(map, i);
      return bowlXY(s.a, s.r);
    });
  return { map, spots, look: runBowlLook(seed, map, spots, biomes, worldmap, bowlTreeStyle, rngFrom) };
};
/* the bowl's ground for a run's look, its places as the sea input sees them (each place's map's half-diagonal) */
const ground = ({ spots, look }) =>
  bowlGroundGrid(bowlReliefFeatures([], look.relief, look.seed), 160, {
    places: spots.map(([x, y]) => ({ x, y, reach: Math.hypot(112, 64) / 2000 + 0.012 })),
    roads: [],
    opt: look.sea,
  });

test("a biome's ground and trees for the map", () => {
  assert.equal(runBowlGround(biomes.meadow), 'gggGGCCf');
  assert.equal(runBowlGround(undefined), '');
  const t = runBowlTrees(biomes.ridge, bowlTreeStyle);
  assert.equal(t[0], 'cone', 'a ridge is pines first');
  assert.deepEqual(runBowlTrees(undefined, bowlTreeStyle), ['round', 'round', 'tall', 'bush']);
});

test("a run's look: land under each place, inside the rim, its own seeds; the hub's look untouched", () => {
  const before = JSON.stringify(worldmap);
  for (const seed of ['RL8BOWL0', 'RL8BOWL1', 'RL8BOWL2', 'RL8BOWL3']) {
    const R = make(seed),
      { look, spots, map } = R;
    assert.equal(look.sea.island, 0);
    assert.ok(look.sea.isles.length >= spots.length + RUN_BOWL_LAND.lobes[0], 'a round a place, lobes, islets');
    assert.ok(look.seed >= 1, 'its own noise');
    for (const k of Object.keys(look.kinds)) assert.ok(look.kinds[k].length > 0);
    for (const b of new Set(map.nodes.map(n => n.biome))) assert.ok(look.kinds[b], `a ground for ${b}`);
    const G = ground(R);
    spots.forEach(([x, y], i) => {
      /* the place's whole map (112 x 64 m, facing north) on land */
      for (const [dx, dy] of [
        [0, 0],
        [-0.056, -0.032],
        [0.056, -0.032],
        [-0.056, 0.032],
        [0.056, 0.032],
      ])
        assert.ok(bowlCoastAt(G, x + dx, y + dy) < 0, `${seed}: place ${i}'s map is under water`);
    });
    for (let a = 0; a < 360; a += 10) {
      const w = (a * Math.PI) / 180;
      assert.ok(bowlCoastAt(G, Math.cos(w) * 0.95, Math.sin(w) * 0.95) > 0, `${seed}: land at the rim at ${a}°`);
    }
    for (const b of look.sea.isles) assert.ok(Math.hypot(b.x, b.y) - b.r < BOWL_ISLE_RIM, 'every round starts inside');
  }
  assert.equal(JSON.stringify(worldmap), before);
});

test('the same seed makes the same look, another seed another', () => {
  const a = make('RL8BOWLA').look,
    b = make('RL8BOWLA').look,
    c = make('RL8BOWLB').look;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.sea.isles, c.sea.isles);
  assert.notEqual(a.seed, c.seed);
});

test("WM-4: a run on the region grid has its places' bumps and dips within half a cell, as steep as the hub's", () => {
  const hub = worldmap.relief,
    got = runBowlRelief(hub, true);
  assert.equal(runBowlRelief(hub, false), hub, 'a run from before WM-2 keeps the hub’s');
  for (const [k, [h, r]] of Object.entries(hub.kinds)) {
    const [h2, r2] = got.kinds[k];
    assert.ok(r2 <= RUN_BOWL_LAND.relief + 1e-12, `${k} within half a cell`);
    assert.ok(Math.abs(h2 / r2 - h / r) < 1e-4, `${k} as steep`);
  }
  assert.equal(got.max, hub.max);
  assert.notEqual(make('RL8BOWL0').look.relief, hub, "a gridded run's look has its own");
});
