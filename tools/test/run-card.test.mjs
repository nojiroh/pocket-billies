// Cutscenes track C: logic/run-card.js, what the run's loading screens say: the region's zones, types, leaders, dex
// and weather on the way out (none for a run with no region), and what the run came to on the way home.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const { runCardOut, runCardHome, RUN_CARD } = modules['run-card'];
const DATA = {
  themes: { lakeland: { name: 'Lakeland', types: { Water: 3, Electric: 2, Flying: 2, Grass: 1 } } },
  biomes: { lake: { name: 'Lake', look: { sky: ['#1', '#2', '#3'] } }, meadow: { name: 'Meadow' } },
  trainers: { t1: { name: 'Mira' }, t2: { name: 'Odo' } },
};
const RUN = {
  expedition: 2,
  clock: 7,
  path: [0, 1, 1, 2],
  region: {
    theme: 'lakeland',
    name: 'Pendingvale',
    zones: [
      { biome: 'lake', rows: 2 },
      { biome: 'meadow', rows: 3 },
    ],
    dex: ['a0', 'b0', 'c0', 'd0', 'e0', 'f0', 'g0', 'h0'],
    swap: {},
    forms: {},
    leaders: ['t1', 'ghost', 't2'],
  },
  map: {
    nodes: [{ type: 'landing' }, { type: 'town' }, { type: 'miniboss' }, { type: 'route' }, { type: 'boss' }],
    side: { name: 'Hidden Cove' },
  },
  forecast: [[], ['rain'], ['rain'], ['fog'], ['clear'], ['rain', 'clear']],
};

test('run card: the way out reads the region, its theme and its map', () => {
  const F = runCardOut(RUN, DATA);
  assert.equal(F.name, 'Pendingvale');
  assert.equal(F.theme, 'Lakeland');
  assert.deepEqual(
    F.zones.map(z => [z.name, z.sky.length]),
    [
      ['Lake', 3],
      ['Meadow', 0],
    ]
  );
  assert.deepEqual(F.types, ['Water', 'Electric', 'Flying'], 'the heaviest first, ties by name, three at most');
  assert.equal(F.types.length, RUN_CARD.types);
  assert.deepEqual(
    F.leaders.map(L => [L.name, L.boss]),
    [
      ['Mira', false],
      ['ghost', false],
      ['Odo', true],
    ],
    'an unknown trainer keeps its id; the last is the boss'
  );
  assert.equal(F.dex, 8);
  assert.equal(F.sample.length, RUN_CARD.sample);
  assert.deepEqual(F.weather, ['rain', 'clear', 'fog'], "the first day's, the hub's left out, the most common first");
  assert.deepEqual([F.places, F.towns, F.guards, F.side, F.expedition], [5, 1, 1, 'Hidden Cove', 2]);
});

test('run card: no region, no card; the way home counts each place once', () => {
  assert.equal(runCardOut({ ...RUN, region: undefined }, DATA), null);
  assert.equal(runCardOut(null, DATA), null);
  const H = runCardHome(RUN, true, { research: 40, crests: 1, scrap: 0 }, ['Kidling']);
  assert.deepEqual(H, {
    won: true,
    name: 'Pendingvale',
    days: 7,
    cleared: 3,
    research: 40,
    crests: 1,
    scrap: 0,
    kept: ['Kidling'],
  });
});
