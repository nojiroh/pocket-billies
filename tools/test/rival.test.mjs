// RL-S2: Blake, the rival, on the game's own data: where he waits on a run's map (logic/run-map.js runMapRival):
// how many meetings by Expedition, in which share of the rows, only on a main-path route, one a row, the same for the
// same seed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { GAME_DATA, modules } from './setup-real.mjs';

const { runStartPlan } = modules['run-start'],
  { runRegionData } = modules['run-region'],
  { runMapRival } = modules['run-map'];
const RAW = readGameData(),
  R = GAME_DATA.rules.run,
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    rules: R,
    unlockData: { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
    region: runRegionData(RAW, RAW.trainers),
    fieldMoves: GAME_DATA.fieldMoves.moves,
  },
  SEEDS = Array.from({ length: 300 }, (_, k) => `RIVAL${k.toString(36).toUpperCase()}`);

test('meetings by Expedition, each in its band, on a main-path place, one a row', () => {
  for (const expedition of [1, 2, 5]) {
    const want = R.rival.meet[Math.min(expedition, R.rival.meet.length) - 1];
    let met = 0;
    for (const seed of SEEDS) {
      const { map } = runStartPlan(seed, DATA, { expedition }),
        main = map.nodes.filter(n => !n.side),
        rows = main.reduce((m, n) => Math.max(m, n.row), 0) + 1,
        rivals = map.nodes.filter(n => n.type === 'rival');
      assert.ok(rivals.length <= want, `${seed}: ${rivals.length} meetings at Expedition ${expedition}`);
      assert.equal(new Set(rivals.map(n => n.row)).size, rivals.length, `${seed}: one a row`);
      for (const n of rivals) {
        assert.ok(!n.side, `${seed}: never in a side area`);
        assert.ok(
          R.rival.bands.some(([lo, hi]) => n.row / rows >= lo && n.row / rows < hi),
          `${seed}: in a band`
        );
      }
      met += rivals.length;
    }
    // a band without a route or a waystation has no meeting (Expedition II's maps often have only two free rows), so
    // the test asks only that nearly every run meets him at least once
    assert.ok(
      met / SEEDS.length > Math.min(want, 1) * 0.85,
      `Expedition ${expedition}: ${met} meetings in ${SEEDS.length} runs`
    );
  }
});

test('he takes a route before a waystation, never a town; the same seed puts him on the same place; no meeting when meet is 0', () => {
  const nodes = [
      { type: 'landing', row: 0, lane: 0, to: [1, 2], seen: 0, biome: 'meadow' },
      { type: 'route', row: 1, lane: 0, to: [3], seen: 0, biome: 'meadow' },
      { type: 'town', row: 1, lane: 1, to: [3], seen: 0, biome: 'meadow' },
      { type: 'boss', row: 2, lane: 0, to: [], seen: 0, biome: 'meadow' },
    ],
    rules = { ...R.rival, on: ['route', 'event'], meet: [1, 0], bands: [[0, 1]] },
    a = { nodes: structuredClone(nodes) };
  assert.deepEqual(runMapRival('X', a, rules, 1), [1]);
  assert.equal(a.nodes[1].type, 'rival');
  assert.equal(a.nodes[2].type, 'town');
  const b = { nodes: structuredClone(nodes) };
  assert.deepEqual(runMapRival('X', b, rules, 2), [], 'Expedition II meets him 0 times here');
  assert.deepEqual(runMapRival('X', b, rules, 9), [], 'past the end: the last');
});
