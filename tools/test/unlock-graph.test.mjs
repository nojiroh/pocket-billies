// Studio plan T4.2: logic/unlock-graph.js on the game's own data: the graph matches what unlocks.test.mjs expects
// (ranch_3 needs ranch_2, the station's biomes need station_2, the earned rows in a column apart), a circle a new
// `requires` would close is found with its path, and what a new save has after runs and wins is what unlockAuto grants.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules['unlock-graph'],
  D = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings, rules: GAME_DATA.rules };

test('unlock graph: a column per building then the earned rows; edges from what a row needs', () => {
  const g = G.unlockGraph(D),
    node = Object.fromEntries(g.nodes.map(n => [n.id, n]));
  assert.deepEqual(
    g.cols.map(c => c.id),
    [...Object.keys(D.buildings), 'earned']
  );
  assert.equal(g.nodes.length, Object.keys(D.unlocks).length);
  assert.equal(node.ranch_2.col, 'ranch');
  assert.equal(node.ranch_3.depth, 1);
  assert.equal(node.ranch_2.depth, 0);
  assert.equal(node.first_run.col, 'earned');
  assert.equal(node.shop_revive.currency, 'research');
  assert.equal(node.station_2.currency, 'crests');
  const has = (from, to) => g.edges.some(e => e.from === from && e.to === to);
  assert.ok(has('ranch_2', 'ranch_3') && has('station_2', 'biome_ridge') && has('station_2', 'biome_autumn'));
  assert.equal(
    g.edges.length,
    Object.values(D.unlocks).reduce((a, R) => a + (R.requires || []).length, 0)
  );
  const seen = new Set(g.nodes.map(n => `${n.col}:${n.depth}:${n.at}`));
  assert.equal(seen.size, g.nodes.length, 'no two rows in one place');
});

test('unlock graph: a circle a requires edit would close is named by its path', () => {
  const U = D.unlocks;
  assert.deepEqual(G.unlockCycle(U, 'ranch_2', ['ranch_3']), ['ranch_2', 'ranch_3', 'ranch_2']);
  assert.deepEqual(G.unlockCycle(U, 'ranch_2', ['ranch_2']), ['ranch_2', 'ranch_2']);
  assert.equal(G.unlockCycle(U, 'ranch_3', ['ranch_2', 'station_2']), null);
  const longer = { ...U, station_2: { ...U.station_2, requires: ['ranch_3'] } };
  assert.deepEqual(G.unlockCycle(longer, 'ranch_2', ['biome_ridge']), [
    'ranch_2',
    'biome_ridge',
    'station_2',
    'ranch_3',
    'ranch_2',
  ]);
  assert.equal(G.unlockDepths(longer).biome_ridge, 3);
});

test('unlock graph: a new save has nothing earned; runs and wins earn what unlockAuto grants', () => {
  const fresh = G.unlockSaveAfter(D);
  assert.deepEqual(fresh.owned, []);
  assert.deepEqual(fresh.currencies, { research: 0, scrap: 0, crests: 0 });
  assert.equal(fresh.buildings.ranch, 1);
  assert.equal(fresh.why.shop_revive, 'cost');
  assert.equal(fresh.why.ranch_3, 'requires');
  assert.equal(fresh.why.first_run, 'earned');
  assert.ok(!fresh.biomes.includes('ridge') && fresh.biomes.includes('meadow'), 'locked biomes stay off the map');
  assert.ok(!fresh.shop.includes('revive'), 'locked wares stay off the shelves');
  const later = G.unlockSaveAfter(D, { runs: 5, wins: 1 });
  assert.deepEqual(later.earned.sort(), ['first_run', 'first_win', 'runs_5']);
  assert.equal(later.currencies.scrap, D.unlocks.first_run.grant.scrap);
  assert.equal(later.currencies.research, D.unlocks.runs_5.grant.research);
  assert.equal(later.currencies.crests, D.unlocks.first_win.grant.crests);
  assert.equal(later.why.station_2, null, 'the Crest of a win buys the station’s level');
  assert.ok(G.unlockSaveAfter(D, { caught: 15 }).owned.includes('caught_15'));
});
