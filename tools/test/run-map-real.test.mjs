// RL-6: the run map and its clock on the game's own data (nodeTypes.json, rules.json run, biomes.json): what the
// placeholders (roguelite-track.md 8.10, 8.18) give over many seeds. run-map.test.mjs tests the rules on small tables of its own.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { runArrive, runMapLength, runMapMake, runMapRows, runMapStart, runNext } = modules['run-map'];
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

test("the game's run map (WM-2): 9 to 12 places on every path, mini-bosses with a town after each, the five biomes", () => {
  assert.deepEqual(M.path, [
    [9, 10],
    [9, 11],
    [10, 11],
    [10, 12],
    [11, 12],
  ]);
  assert.deepEqual(M.towns, [2, 3]);
  let nodes = 0,
    rows = 0,
    guards = 0,
    rests = 0;
  const types = {},
    biomes = {};
  for (const [k, s] of seeds.entries()) {
    const L = runMapLength(s, M, 1 + (k % 5)),
      roles = runMapRows({ ...M, ...L }),
      map = runMapMake(s, GAME_DATA.nodeTypes, { ...M, ...L });
    assert.ok(L.rows >= 9 && L.rows <= 12 && L.minibosses === (L.rows === 12 ? 3 : 2), JSON.stringify(L));
    rows += L.rows;
    guards += roles.filter(r => r === 'guard').length;
    rests += roles.filter(r => r === 'rest').length;
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
  assert.equal(types.miniboss, guards);
  assert.ok(types.town >= rests, 'a town after each mini-boss');
  assert.ok(types.town <= 2 * rests, 'towns only after mini-bosses');
  const mean = nodes / seeds.length,
    long = rows / seeds.length;
  assert.ok(mean >= long && mean <= 2 * long - 2, `${mean} nodes a map`);
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
    assert.equal(
      s.run.clock,
      runMapLength(seed, M, 1).rows,
      'the boss on the shortest walk is the day of the places a path (Expedition I: 9 or 10)'
    );
    for (const w of s.run.forecast.flat()) weathers[w] = (weathers[w] || 0) + 1;
    assert.ok(validRun(JSON.parse(JSON.stringify(s.run))));
  }
  assert.deepEqual(Object.keys(GAME_DATA.rules.run.clock), ['ahead']);
  // the five biomes are mild: the mild odds, no snow or ash (no season in a run)
  assert.deepEqual(Object.keys(weathers).sort(), ['clear', 'cloudy', 'fog', 'rain', 'storm']);
});

test("WM-5: the game's towns take their size by order and Expedition (rules.json run.map.townSizes), strictly", () => {
  const { runTownSize } = modules['run-map'],
    T = M.townSizes,
    seen = {};
  assert.deepEqual(T.cells, { hamlet: [2, 1], village: [2, 2], town: [3, 2] });
  for (const [k, s] of seeds.slice(0, 500).entries()) {
    const e = 1 + (k % 5),
      L = runMapLength(s, M, e),
      map = runMapMake(s, GAME_DATA.nodeTypes, { ...M, ...L }),
      towns = map.nodes.filter(n => n.type === 'town'),
      rows = [...new Set(towns.map(n => n.row))].sort((a, b) => a - b);
    assert.deepEqual(L.sizes, T.order[e - 1][String(L.minibosses)], `${s}: the Expedition's sizes`);
    assert.equal(rows.length, L.minibosses);
    for (const n of towns) {
      const want = L.sizes[rows.indexOf(n.row)];
      assert.deepEqual(n.size, T.cells[want], `${s}: town on row ${n.row} is a ${want}`);
      assert.equal(runTownSize(n, T), want);
    }
    const key = `${e}:${rows
      .map(r =>
        runTownSize(
          towns.find(n => n.row === r),
          T
        )
      )
      .join('+')}`;
    seen[key] = (seen[key] || 0) + 1;
  }
  // the owner's answer: the last a village at I, a town from II; before it hamlet (then village) of three, of two a
  // hamlet at I-III and a village at IV-V
  assert.deepEqual(Object.keys(seen).sort(), [
    '1:hamlet+village',
    '2:hamlet+town',
    '3:hamlet+town',
    '4:hamlet+village+town',
    '4:village+town',
    '5:hamlet+village+town',
    '5:village+town',
  ]);
});

test("WM-5: a town size the grid can't hold steps every town down a size, never to a failed map", () => {
  const { runTownSize } = modules['run-map'],
    T = { cells: { hamlet: [2, 1], village: [2, 2], huge: [4, 4] }, order: [{ 2: ['village', 'huge'] }] },
    R = { ...M, townSizes: T },
    seen = new Set();
  for (const s of seeds.slice(0, 50)) {
    const L = runMapLength(s, R, 1),
      map = runMapMake(s, GAME_DATA.nodeTypes, { ...R, ...L }),
      towns = map.nodes.filter(n => n.type === 'town'),
      rows = [...new Set(towns.map(n => n.row))].sort((a, b) => a - b),
      got = rows.map(r =>
        runTownSize(
          towns.find(n => n.row === r),
          T
        )
      );
    assert.deepEqual(L.sizes, ['village', 'huge']);
    // a 4 x 4 town is taller than the grid's 7 rows less the room round it on most maps: stepped down together
    assert.ok(['village,huge', 'hamlet,village'].includes(got.join()), `${s}: ${got.join()} (stepped down together)`);
    seen.add(got.join());
  }
  assert.equal(seen.size, 2, 'some maps hold the huge town, some step down');
  assert.equal(runTownSize({ type: 'town' }, T), 'hamlet', 'no footprint (a side area): the smallest');
  assert.equal(runTownSize({ type: 'town', size: [2, 2] }, undefined), '', 'no table');
});
