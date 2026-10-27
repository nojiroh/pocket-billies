// Studio plan T2.1: how a run starts, on the game's own data. The run's money and items, the unlocks it carries, its map
// (biomes filtered by those unlocks), what the map shows and the forecast, for 200 seeds with no unlocks,
// with every unlock, and on the debug menu's short map. Frozen from runTakeOff (game/js/run.js) before the start became
// one shared function (logic/run-start.js runStartPlan, runStartOn), which the fixture, the self-test, the simulator and
// the Studio's Run Lab call too. RL-R1: with the run's region (its zones give the map its rows and biomes).
//   node --test --test-update-snapshots tools/test/run-start.test.mjs   remakes it (say why in the commit)
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { fn, GAME_DATA, hooks, modules, reseed } from './setup-real.mjs';

const { runGive, runStartOn, runStartPlan } = modules['run-start'];
const { runUnlocks } = modules.unlocks;
const UNLOCK_DATA = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: GAME_DATA.pools,
    scenery: GAME_DATA.scenery,
    rules: GAME_DATA.rules.run,
    unlockData: UNLOCK_DATA,
    /* RL-R1: the region, as run-world.js runWorldData gives it */
    region: modules['run-region'].runRegionData(GAME_DATA, GAME_DATA.trainers),
  },
  SEEDS = Array.from({ length: 200 }, (_, k) => `S${k.toString(36).toUpperCase()}START`),
  CASES = {
    none: { unlocks: [] },
    all: { unlocks: Object.keys(GAME_DATA.unlocks) },
    short: { unlocks: [], map: { rows: 6, minibosses: 1 } },
  };

/** a save at the mast: one starter, the unlocks bought */
function mast(/** @type {string[]} */ unlocks) {
  reseed(1);
  const s = fn('newSave')();
  s.started = true;
  s.starter = GAME_DATA.rules.start.starters[0];
  s.team.push(fn('makeBilly')(s.starter + '0', GAME_DATA.rules.start.starterLevel));
  for (const id of unlocks) s.meta.unlocks[id] = 1;
  hooks.provide({ saveData: s });
  return s;
}

/** the run runTakeOff starts (its part that isn't the page: no heal, ranch, world or flight) */
function takeOff(/** @type {string} */ seed, /** @type {{ unlocks: string[], map?: object }} */ c) {
  const s = mast(c.unlocks);
  runStartOn(s, runStartPlan(seed, DATA, { unlocks: runUnlocks(s, UNLOCK_DATA), map: c.map }), {
    home: [s.team[0].uid],
  });
  return s;
}

/** what a start decides, without the save's own Billies */
const started = s => ({
  se: s.se,
  items: s.items,
  pyramids: s.pyramids,
  seed: s.run.seed,
  expedition: s.run.expedition,
  mapgenV: s.run.mapgenV,
  unlocks: s.run.unlocks,
  mods: s.run.mods,
  clock: s.run.clock,
  map: s.run.map,
  forecast: s.run.forecast,
  region: s.run.region,
});

test('a run starts as runTakeOff starts it: 200 seeds, no unlocks, every unlock, the short map', t => {
  const hash = createHash('sha256'),
    first = {};
  for (const [name, c] of Object.entries(CASES))
    for (const seed of SEEDS) {
      const got = started(takeOff(seed, c));
      hash.update(JSON.stringify(got));
      if (seed === SEEDS[0]) first[name] = got;
    }
  t.assert.snapshot({ first, all: hash.digest('hex') });
});

test('the unlocks a run carries open its biomes: none leaves out ridge and autumn', () => {
  const biomes = c => new Set(SEEDS.flatMap(seed => started(takeOff(seed, c)).map.nodes.map(n => n.biome)));
  assert.deepEqual([...biomes(CASES.none)].sort(), ['lake', 'meadow', 'thicket']);
  assert.deepEqual([...biomes(CASES.all)].sort(), ['autumn', 'lake', 'meadow', 'ridge', 'thicket']);
});

test('a run starts with run.start (copies), on its seed, expedition and generator version', () => {
  const g = runGive('S', 1, 7, GAME_DATA.rules.run.start);
  assert.deepEqual(g, {
    seed: 'S',
    expedition: 1,
    mapgenV: 7,
    se: GAME_DATA.rules.run.start.se,
    pyramids: GAME_DATA.rules.run.start.pyramids,
    items: GAME_DATA.rules.run.start.items,
  });
  g.pyramids.pyramid = 99;
  assert.notEqual(GAME_DATA.rules.run.start.pyramids.pyramid, 99);
});

test('a plan touches nothing: the data stays as it was, the same seed plans the same run, a save it goes on is its own', () => {
  const before = JSON.stringify(DATA),
    a = runStartPlan('PURE', DATA, { unlocks: ['biome_ridge'], map: { rows: 6, minibosses: 1 }, mods: ['m'] }),
    b = runStartPlan('PURE', DATA, { unlocks: ['biome_ridge'], map: { rows: 6, minibosses: 1 }, mods: ['m'] });
  assert.equal(JSON.stringify(DATA), before);
  assert.deepEqual(a, b);
  assert.equal(a.map.nodes.length >= 5, true);
  const s = mast([]),
    run = runStartOn(s, a, { home: [s.team[0].uid] });
  assert.deepEqual(run.mods, ['m']);
  assert.deepEqual(run.unlocks, ['biome_ridge']);
  run.map.nodes[0].seen = 0;
  assert.notEqual(a.map.nodes[0].seen, 0, "the save's map is a copy");
});

test('a map its rules can’t make stops the start before the save changes', () => {
  const s = mast([]);
  assert.throws(() => runStartPlan('BAD', DATA, { map: { rows: 3, minibosses: 2 } }), /can't hold/);
  assert.equal(s.run, null);
});
