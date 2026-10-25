// Water track WA-5a: the water kinds' order and play (game/js/logic/water-kinds.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WATER_KINDS,
  WATER_KIND_BASE,
  WATER_KIND_PLAY,
  waterKindBase,
  waterKindShut,
  waterKindSlow,
  waterKindStill,
  waterKindWalkOn,
} from '../../game/js/logic/water-kinds.js';

test("water kinds: the renderer's nine first, the six of WA-5a appended in the contract's order", () => {
  assert.deepEqual(WATER_KINDS.slice(0, 9), [
    'pond',
    'stream',
    'canal',
    'spring',
    'swamp',
    'lake',
    'sea',
    'lava',
    'ice',
  ]);
  assert.deepEqual(WATER_KINDS.slice(9), ['rapids', 'hotspring', 'oasis', 'bog', 'reef', 'cave']);
  for (const k in WATER_KIND_BASE) {
    assert.ok(WATER_KINDS.indexOf(k) >= 9, `${k} is a new kind`);
    assert.ok(WATER_KINDS.indexOf(WATER_KIND_BASE[k]) < 9, `${k} borrows an old look`);
  }
  for (const k of WATER_KINDS.slice(9)) assert.ok(WATER_KIND_BASE[k], `${k} has a look until WA-5b`);
  for (const k in WATER_KIND_PLAY) assert.ok(WATER_KINDS.includes(k), `${k} in the play table is a kind`);
  assert.equal(waterKindBase('pond'), 'pond');
});

test('water kinds: lava and rapids shut, ice walked on, the marsh and the bog slow, still water freezes', () => {
  assert.deepEqual(WATER_KINDS.filter(waterKindShut), ['lava', 'rapids']);
  assert.deepEqual(WATER_KINDS.filter(waterKindWalkOn), ['ice']);
  assert.ok(waterKindSlow('bog') < waterKindSlow('swamp') && waterKindSlow('swamp') < 1);
  assert.equal(waterKindSlow('pond'), 1);
  for (const k of ['pond', 'lake', 'swamp', 'bog', 'oasis']) assert.ok(waterKindStill(k), k);
  for (const k of ['stream', 'rapids', 'sea', 'hotspring', 'lava', 'ice']) assert.ok(!waterKindStill(k), k);
});
