// Studio plan T2.1: how a run starts, on the game's own data. The run's money and items, the unlocks it carries, its map
// (biomes filtered by those unlocks), deadline, what the map shows and the forecast, for 200 seeds with no unlocks,
// with every unlock, and on the debug menu's short map. Frozen from runTakeOff (game/js/run.js) before the start became
// one shared function, so the fixture, the self-test, the simulator and the Studio's Run Lab start runs as it does.
//   node --test --test-update-snapshots tools/test/run-start.test.mjs   remakes it (say why in the commit)
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { fn, GAME_DATA, hooks, modules, reseed } from './setup-real.mjs';

const { runMapStart } = modules['run-map'];
const { runBegin } = modules['run-state'];
const { runGive } = modules['run-start'];
const { runUnlocks, unlockOpen } = modules.unlocks;
const { MAPGEN_VERSION } = modules.mapgen;
const UNLOCK_DATA = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: GAME_DATA.pools,
    scenery: GAME_DATA.scenery,
    rules: GAME_DATA.rules.run,
  },
  SEEDS = Array.from({ length: 200 }, (_, k) => `S${k.toString(36).toUpperCase()}START`),
  CASES = {
    none: { unlocks: [] },
    all: { unlocks: Object.keys(GAME_DATA.unlocks) },
    short: { unlocks: [], map: { rows: 5, minibosses: 1 } },
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
  runBegin(s, { ...runGive(seed, 1, MAPGEN_VERSION, DATA.rules.start), home: [s.team[0].uid] });
  const run = s.run;
  run.unlocks = runUnlocks(s, UNLOCK_DATA);
  const rules = { ...DATA.rules.map, ...(c.map || {}) };
  runMapStart(run, {
    ...DATA,
    rules: { ...DATA.rules, map: { ...rules, biomes: unlockOpen(rules.biomes, 'biome', run.unlocks, UNLOCK_DATA) } },
  });
  return s;
}

/** what a start decides, without the save's own Billies */
const started = s => ({
  se: s.se,
  items: s.items,
  coins: s.coins,
  seed: s.run.seed,
  tier: s.run.tier,
  mapgenV: s.run.mapgenV,
  unlocks: s.run.unlocks,
  mods: s.run.mods,
  clock: s.run.clock,
  deadline: s.run.deadline,
  map: s.run.map,
  forecast: s.run.forecast,
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

test('a run starts with run.start (copies), on its seed, tier and generator version', () => {
  const g = runGive('S', 1, 7, GAME_DATA.rules.run.start);
  assert.deepEqual(g, {
    seed: 'S',
    tier: 1,
    mapgenV: 7,
    se: GAME_DATA.rules.run.start.se,
    coins: GAME_DATA.rules.run.start.coins,
    items: GAME_DATA.rules.run.start.items,
  });
  g.coins.penny = 99;
  assert.notEqual(GAME_DATA.rules.run.start.coins.penny, 99);
});
