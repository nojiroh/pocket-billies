// RL-12c: logic/held.js, the held-item slot: giving from the bag (the item held before goes back), taking off, and a
// run's end taking every held item off first, so a loss pays them as Research and a win takes them home in the bag.
// Also the save: saveFill drops a held item the data doesn't have, billiesOk refuses one that isn't an id.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, modules, startedSave } from './setup-fixture.mjs';

const { heldGive, heldTake, heldAllOff, heldIds } = modules.held;
const { runBegin, runEnd } = modules['run-state'];
const ITEMS = {
  potion: { hp: 20 },
  vest: { hold: [{ kind: 'damage', side: 'take', mult: 0.85 }] },
  notes: { hold: [{ kind: 'xp', mult: 1.5 }] },
};
const RATES = { money: 0.1, itemShare: 0.5, released: 15, node: 10, win: 100, winCrests: 1 };

test('held: heldIds lists the items with hold rows', () => {
  assert.deepEqual(heldIds(ITEMS), ['notes', 'vest']);
});

test('held: give takes one from the bag, a second give swaps it back, take puts it back', () => {
  const s = { items: { vest: 1, notes: 1, potion: 3 } },
    m = /** @type {any} */ ({ uid: 'a' });
  assert.equal(heldGive(s, m, 'potion', ITEMS), false, 'not a held item');
  assert.equal(heldGive(s, m, 'vest', ITEMS), true);
  assert.equal(m.held, 'vest');
  assert.equal(s.items.vest, 0);
  assert.equal(heldGive(s, m, 'vest', ITEMS), false, 'none left, and it already holds it');
  assert.equal(heldGive(s, m, 'notes', ITEMS), true);
  assert.deepEqual([m.held, s.items.vest, s.items.notes], ['notes', 1, 0], 'the vest went back');
  assert.equal(heldTake(s, m), true);
  assert.equal('held' in m, false);
  assert.equal(s.items.notes, 1);
  assert.equal(heldTake(s, m), false, 'nothing to take');
  assert.equal(heldAllOff(s, [{ held: 'vest' }, {}, { held: 'vest' }]), 2);
  assert.equal(s.items.vest, 3);
});

test("held: a run's end takes held items off first: a loss pays them, a win takes them home", () => {
  const item = 'potion';
  for (const won of [false, true]) {
    const s = startedSave('sparky0', 10),
      hub = s.items[item] || 0;
    runBegin(s, { seed: 'ABCDE12345', expedition: 1, mapgenV: 1, se: 0, items: {} });
    for (const k of Object.keys(s.items)) s.items[k] = 0;
    s.team[0].held = item;
    const pay = runEnd(s, { won, keep: [s.team[0].uid] }, RATES, id => (id === item ? 200 : 0));
    assert.ok(
      s.team.every(m => !m.held),
      'nobody comes home holding one'
    );
    if (won) assert.equal(s.items[item], hub + 1, 'the item came home in the bag');
    else assert.equal(pay.lines.find(l => l.what === 'items').n, 100, 'paid at the item share');
  }
});

test("held: saveFill drops a held item the data doesn't have; billiesOk refuses one that isn't an id", () => {
  const { billiesOk } = modules.saves;
  const s = startedSave('sparky0', 10);
  s.team[0].held = 'no_such_item';
  assert.equal('held' in fn('saveFill')(JSON.parse(JSON.stringify(s))).team[0], false);
  const m = fn('makeBilly')('sparky0', 5);
  assert.equal(billiesOk([{ ...m, held: 'anything' }]), true);
  assert.equal(billiesOk([{ ...m, held: 7 }]), false);
  assert.equal(billiesOk([{ ...m, held: 'x'.repeat(41) }]), false);
});

test('held: a traveller leaves its held item at home (a won run never brings it back twice, the kept one holds it again)', () => {
  const s = startedSave('sparky0', 10);
  s.team[0].held = 'potion';
  const hub = s.items.potion || 0;
  runBegin(s, { seed: 'ABCDE12345', expedition: 1, mapgenV: 1, se: 0, items: {} });
  assert.equal(s.team[0].held, undefined, 'the traveller holds nothing');
  for (const k of Object.keys(s.items)) s.items[k] = 0;
  runEnd(s, { won: true, keep: [s.team[0].uid] }, RATES, () => 0);
  assert.equal(s.items.potion || 0, hub, 'no second one in the bag');
  assert.equal(s.team[0].held, 'potion', 'the kept Billie holds its item from home again');
});
