// Phase 13 (moved from logic.test.mjs, phase 04e): the data tables (game/js/game-data.js), on the small data set of
// setup-fixture.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn } from './setup-fixture.mjs';

test('data tables: type matchups, species, the start', () => {
  const eff = fn('typeEffectiveness');
  assert.equal(eff('Fire', ['Grass']), 2);
  assert.equal(eff('Fire', ['Water']), 0.5);
  assert.equal(eff('Water', ['Fire', 'Grass']), 1);
  assert.equal(eff('None', ['Grass']), 1);
  assert.deepEqual(data.SPECIES.sparky0.types, ['Fire']);
  assert.equal(data.SPECIES.sparky0.next, 'sparky1');
  assert.deepEqual(data.SPECIES.sparky0.base, [50, 50, 50, 50, 50, 50]); // 300 (starter, stage 1) / 6 even weights
  assert.equal(data.START_NODE, 1); // rules.start.locationId: meadow
  assert.equal(data.roadCost(1, 2), 100); // phase 08: measured from the exits; a road without named exits counts 100 m
  assert.deepEqual(data.DATA_WARN, []);
});
