// HB-5: which room a door opens (data-files.js doorRooms, opensRoom): its own room, then its kind's, then the one for
// what it does; 'enter' has none of its own, so it opens the building's or its kind's room, or nothing.
// (data-files.js runs in its own context: its arrays are copied before comparing)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PB_DATA } from '../data-files.mjs';

test('the acts that lead into a room', () => {
  for (const a of ['shop', 'clinic', 'lab', 'house', 'ranch', 'enter']) assert.ok(PB_DATA.opensRoom(a), a);
  for (const a of ['home', 'sign', 'talk', 'fly', '', null, undefined, 'constructor'])
    assert.ok(!PB_DATA.opensRoom(a), String(a));
});

test("'enter' opens the building's or its kind's room, else nothing", () => {
  const p = { k: 'inn', act: 'enter' };
  assert.deepEqual([...PB_DATA.doorRooms(p, { room: 'int_inn' }, 'enter')], ['int_inn']);
  assert.deepEqual([...PB_DATA.doorRooms({ ...p, room: 'int_x' }, { room: 'int_inn' }, 'enter')], ['int_x', 'int_inn']);
  assert.deepEqual([...PB_DATA.doorRooms({ k: 'lighthouse', act: 'enter' }, {}, 'enter')], []);
});

test('the other acts still fall back to their own room', () => {
  assert.deepEqual([...PB_DATA.doorRooms({ k: 'shop', act: 'shop' }, {}, 'shop')], ['int_shop']);
  assert.deepEqual(
    [...PB_DATA.doorRooms({ k: 'bakery', act: 'shop' }, { room: 'int_bakery' }, 'shop')],
    ['int_bakery', 'int_shop']
  );
});
