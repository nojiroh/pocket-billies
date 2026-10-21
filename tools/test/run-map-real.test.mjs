// RL-6: the run map on the game's own data (nodeTypes.json, rules.json run, biomes.json): what the placeholders
// (roguelite-track.md 8.18) give over many seeds. run-map.test.mjs tests the rules on small tables of its own.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { runMapMake, runMapRows } = modules['run-map'];
const { validRun, newRun } = modules['run-state'];
const START = {
  team: [],
  se: 0,
  items: {},
  coins: {},
  trip: { node: 0, plan: [] },
  wild: {},
  eggs: [],
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
