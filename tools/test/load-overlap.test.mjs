// Fluid track FL-4b (the load overlap, LD-5's leftovers): the one-off work's budget a quarter of the paced slot
// (quality.slotBudget, game/js/logic/load-budget.js slotWorkMs); pictures let go by the time they were last used
// (quality.texAge, textureTrimOrder). No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotWorkMs, textureTrimOrder, TEXTURE_AGE_MS } from '../../game/js/logic/load-budget.js';

test('slotBudget: a quarter of the paced slot, 2 to 12 ms (the owner: 4 at 60, 8 at 30, 2 at 120)', () => {
  const at = fps => slotWorkMs(1000 / fps);
  assert.equal(Math.round(at(60)), 4);
  assert.equal(Math.round(at(30)), 8);
  assert.equal(Math.round(at(120)), 2);
  // the half rate on a 60 Hz screen: two refreshes, the slot of 30
  assert.equal(slotWorkMs((2 * 1000) / 60), at(30));
  // a slow rate behind a window (20 a second) is held to 12; a very fast screen to 2
  assert.equal(at(20), 12);
  assert.equal(at(240), 2);
  // no slot known: the most
  assert.equal(slotWorkMs(0), 12);
  assert.equal(slotWorkMs(NaN), 12);
});

test('texAge: unused for longer than 10 s by the clock go, the longest unused first; recent ones stay', () => {
  const now = 100000,
    E = [
      ['a', { ut: now - 5000 }],
      ['b', { ut: now - 30000 }],
      ['c', { ut: now - 11000 }],
      ['d', { ut: now - TEXTURE_AGE_MS }],
      ['e', {}],
    ];
  assert.deepEqual(
    textureTrimOrder(E, now).map(x => x[0]),
    ['e', 'b', 'c']
  );
  // a battle or a 30 fps walk ages a picture as a 60 fps walk does: only time counts
  assert.deepEqual(
    textureTrimOrder([['x', { ut: 0 }]], 9000).map(x => x[0]),
    []
  );
});
