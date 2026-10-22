// RL-8b: a world's seed moves the bowl's noise (game/js/logic/bowl.js bowlSeedShift): a run's own hills, headlands
// and tree clumps; seed 0 is the bowl as made (the hub), so its picture doesn't move.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA } from './setup-real.mjs';
import { bowlClumps } from '../../game/js/logic/bowl-things.js';
import {
  bowlGridHeight,
  bowlGroundGrid,
  bowlRelief,
  bowlReliefFeatures,
  bowlSeaInput,
  bowlSeedShift,
  bowlWaterLevel,
} from '../../game/js/logic/bowl.js';

const { locations, maps } = GAME_DATA;
const SEA = { share: 0.4, depth: 0.035, rimLand: 0, rough: 0.8, seed: 0, island: 0.3 };
const grid = seed =>
  bowlGroundGrid(
    bowlReliefFeatures(locations, null, seed),
    120,
    /* IS-5: as a run's place, with no island coast (the hub's own coast is drawn exactly, IS-7) */
    bowlSeaInput(locations, [], l => (maps[l.mapId] ? { w: maps[l.mapId].w, h: maps[l.mapId].h } : null), 1000, SEA)
  );
const clumps = (G, seed) =>
  bowlClumps(
    G,
    [{ x: 0, y: 0, reach: 0.06, region: 'starter' }],
    [],
    (x, y) => bowlGridHeight(G, x, y) - bowlWaterLevel(x, y),
    undefined,
    undefined,
    seed
  );

test('seed 0 moves nothing; any other seed moves the noise', () => {
  assert.deepEqual(bowlSeedShift(0), [0, 0]);
  const F0 = bowlReliefFeatures(locations),
    F1 = bowlReliefFeatures(locations, null, 0);
  for (const [x, y] of [
    [0.1, 0.2],
    [-0.4, 0.3],
    [0.6, -0.5],
  ])
    assert.equal(bowlRelief(F0, x, y), bowlRelief(F1, x, y));
  const s = new Set([1, 2, 77, 4321].map(k => bowlSeedShift(k).join()));
  assert.equal(s.size, 4, 'each seed its own shift');
});

test('a seed gives its own hills and trees, the same each time', () => {
  const a = grid(0),
    b = grid(1234),
    b2 = grid(1234);
  assert.deepEqual(b.h, b2.h, 'the same seed, the same ground');
  /* on land (the sea floor doesn't follow the hills) */
  let moved = 0,
    land = 0;
  for (let k = 0; k < a.h.length; k++)
    if (a.c[k] < 0 && b.c[k] < 0) {
      land++;
      if (Math.abs(a.h[k] - b.h[k]) > 1e-4) moved++;
    }
  assert.ok(moved > land / 2, `another seed moves the hills (${moved} of ${land} corners on land)`);
  const t0 = clumps(a, 0),
    t1 = clumps(b, 1234),
    t1b = clumps(b2, 1234);
  assert.deepEqual(t1, t1b);
  assert.ok(t0.length > 0 && t1.length > 0, 'trees on both');
  assert.notDeepEqual(
    t0.slice(0, 5).map(t => [t.x, t.y]),
    t1.slice(0, 5).map(t => [t.x, t.y])
  );
});
