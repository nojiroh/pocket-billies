// RL-6: the run map and its clock on the game's own data (nodeTypes.json, rules.json run, biomes.json): what the
// placeholders (roguelite-track.md 8.10, 8.18) give over many seeds. run-map.test.mjs tests the rules on small tables of its own.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { runArrive, runMapMake, runMapRows, runMapStart, runNext } = modules['run-map'];
const { validRun, newRun } = modules['run-state'];
const START = {
  team: [],
  se: 0,
  items: {},
  pyramids: {},
  trip: { node: 0, plan: [] },
  wild: {},
  flags: {},
  seats: [],
  visited: {},
};
const M = GAME_DATA.rules.run.map,
  seeds = Array.from({ length: 1000 }, (_, k) => `G${k.toString(36).toUpperCase()}RUN`);

test("the game's run map: 8 to 12 nodes on every path, mini-bosses with a town before each, the five biomes", () => {
  assert.ok(M.rows >= 8 && M.rows <= 12, `${M.rows} rows`);
  const roles = runMapRows(M);
  let nodes = 0;
  const types = {},
    biomes = {};
  for (const s of seeds) {
    const map = runMapMake(s, GAME_DATA.nodeTypes, M);
    nodes += map.nodes.length;
    for (const n of map.nodes) {
      types[n.type] = (types[n.type] || 0) + 1;
      biomes[n.biome] = (biomes[n.biome] || 0) + 1;
      assert.ok(GAME_DATA.nodeTypes[n.type], n.type);
      assert.ok(GAME_DATA.biomes[n.biome], n.biome);
    }
    assert.ok(validRun(JSON.parse(JSON.stringify({ ...newRun(s, 1, 3, START), map }))));
  }
  assert.deepEqual(Object.keys(biomes).sort(), ['autumn', 'lake', 'meadow', 'ridge', 'thicket']);
  assert.equal(types.boss, seeds.length);
  assert.equal(types.miniboss, seeds.length * roles.filter(r => r === 'guard').length);
  assert.ok(types.town >= seeds.length * roles.filter(r => r === 'rest').length, 'a town before each mini-boss');
  const mean = nodes / seeds.length;
  assert.ok(mean >= M.rows && mean <= 2 * M.rows - 2, `${mean} nodes a map`);
});

test("the game's clock: no deadline (RL-R2), a week of forecast from the biomes' climates, a walk the save takes", () => {
  const data = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: GAME_DATA.rules.run },
    weathers = {};
  for (const seed of seeds.slice(0, 200)) {
    const s = { run: newRun(seed, 1, 3, START), trip: { node: 0, plan: [] } };
    runMapStart(s.run, data);
    assert.equal(s.run.deadline, undefined);
    let at = 0;
    assert.equal(runArrive(s, 0, data), 1);
    while (runNext(s.run.map, at).length) runArrive(s, (at = runNext(s.run.map, at)[0]), data);
    assert.equal(s.run.clock, M.rows, 'the boss on the shortest walk is day 9');
    for (const w of s.run.forecast.flat()) weathers[w] = (weathers[w] || 0) + 1;
    assert.ok(validRun(JSON.parse(JSON.stringify(s.run))));
  }
  assert.deepEqual(Object.keys(GAME_DATA.rules.run.clock), ['ahead']);
  // the five biomes are mild: the mild odds, no snow or ash (no season in a run)
  assert.deepEqual(Object.keys(weathers).sort(), ['clear', 'cloudy', 'fog', 'rain', 'storm']);
});
