// Phase 10: the bowl's shape (game/js/logic/bowl.js) and the hub's spot on it (locations.json "bowl"). On the bowl a
// map's north faces the centre and its east runs counter-clockwise. RL-5: the hub, Copperleaf, is the game's only
// place; a run's places are laid out by its map (run-map.test.mjs), so the old world's layout tests went.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA } from './setup-real.mjs';
import { BOWL_RIM_HEIGHT, bowlCompass, bowlHeight } from '../../game/js/logic/bowl.js';

const byId = id => GAME_DATA.locations.find(l => l.id === id);

test('the bowl: curves only, rising to 45 degrees at the rim', () => {
  assert.equal(bowlHeight(0), 0);
  /* only curves: the slope grows all the way out, no flat floor */
  let last = -1;
  for (let r = 0.05; r <= 1; r += 0.05) {
    const s = (bowlHeight(r) - bowlHeight(r - 0.01)) / 0.01;
    assert.ok(s > last, `the slope stops growing at ${r.toFixed(2)}`);
    last = s;
  }
  assert.ok(Math.abs(bowlHeight(1) - BOWL_RIM_HEIGHT) < 1e-12);
  const slope = (bowlHeight(1) - bowlHeight(1 - 1e-6)) / 1e-6;
  assert.ok(Math.abs(slope - 1) < 1e-3, `slope at the rim ${slope}`);
  const { north, east } = bowlCompass(0, 0.5);
  assert.deepEqual(north, [-0, -1], 'a map at the top of the bowl has its north facing the centre');
  assert.deepEqual(east, [-1, 0], 'and its east running counter-clockwise');
});

test('Copperleaf, the start, is at the centre of the floor', () => {
  assert.ok(byId('copperleaf').bowl.r < 0.02);
});
