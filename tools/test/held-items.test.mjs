// RL-12c: held items (items.json `hold`, logic/effects.js fxOfBillie): a Billie's own rows, the new kinds (xp,
// turnHeal, pinchHeal), no item changing nothing, and data-checks' rules for them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const E = modules.effects,
  C = modules['data-checks'],
  ITEMS = GAME_DATA.items,
  HELD = Object.keys(ITEMS).filter(k => ITEMS[k].hold);

test('held items: the game has some, each a known kind, priced and never used up', () => {
  assert.ok(HELD.length >= 8, `${HELD.length} held items`);
  for (const k of HELD) {
    const I = ITEMS[k];
    assert.ok(I.price > 0, `${k} has a price (the payout counts it)`);
    for (const f of I.hold) assert.ok(E.FX_KINDS.includes(f.kind), `${k}: ${f.kind}`);
    for (const use of ['hp', 'hpAll', 'cure', 'revive', 'evoItem', 'lvlUp'])
      assert.equal(I[use], undefined, `${k}.${use}`);
  }
});

test("held items: fxOfBillie is the held item's rows tagged held:<id>; none, an unknown id or a plain item give null", () => {
  assert.equal(E.fxOfBillie(null, ITEMS), null);
  assert.equal(E.fxOfBillie({}, ITEMS), null);
  assert.equal(E.fxOfBillie({ held: 'nope' }, ITEMS), null);
  assert.equal(E.fxOfBillie({ held: 'potion' }, ITEMS), null);
  const fx = E.fxOfBillie({ held: 'iron_vest' }, ITEMS);
  assert.deepEqual(fx, [{ kind: 'damage', side: 'take', mult: 0.85, src: 'held:iron_vest' }]);
});

test('held items: no rows change nothing', () => {
  for (const fx of [null, [], undefined]) {
    assert.equal(E.fxXp(fx, 137), 137);
    assert.equal(E.fxTurnHeal(fx), 0);
    assert.equal(E.fxPinchHeal(fx), null);
  }
});

test('held items: each new kind at its point', () => {
  const of = id => E.fxOfBillie({ held: id }, ITEMS);
  assert.equal(E.fxXp(of('study_notes'), 100), 150);
  assert.equal(E.fxXp(of('iron_vest'), 100), 100, 'another kind leaves XP alone');
  assert.equal(E.fxTurnHeal(of('leftover_sandwich')), 0.0625);
  assert.deepEqual(E.fxPinchHeal(of('snack_pack')), { at: 0.5, share: 0.25 });
  assert.equal(E.fxMoney(of('lucky_coin'), 100), 125);
  assert.equal(E.fxDamage(of('brass_knuckles'), { cat: 'H', type: 'Fire', deal: true, take: false }), 1.2);
  assert.equal(E.fxDamage(of('brass_knuckles'), { cat: 'S', type: 'Fire', deal: true, take: false }), 1);
  assert.equal(E.fxDamage(of('smart_specs'), { cat: 'S', type: 'Fire', deal: true, take: false }), 1.2);
  assert.equal(E.fxDamage(of('iron_vest'), { cat: 'H', type: 'Fire', deal: false, take: true }), 0.85);
  assert.deepEqual(E.fxStages(of('quick_laces')), { hus: 1 });
  assert.equal(
    E.fxTurnHeal([
      { kind: 'turnHeal', share: 0.8 },
      { kind: 'turnHeal', share: 0.8 },
    ]),
    1,
    'at most all'
  );
});

test('held items: the game data passes dataHeldItems; planted mistakes are named', () => {
  assert.deepEqual(C.dataHeldItems(GAME_DATA), []);
  const D = {
    ...GAME_DATA,
    items: {
      a: { n: 'A', price: 1, d: '', icon: 'x', hold: [] },
      b: { n: 'B', price: 1, d: '', icon: 'x', hp: 20, hold: [{ kind: 'xp', mult: 1.5 }] },
      c: { n: 'C', price: 1, d: '', icon: 'x', hold: [{ kind: 'catch', mult: 2 }] },
      d: { n: 'D', price: 1, d: '', icon: 'x', hold: [{ kind: 'stat', stat: 'hp', stages: 1 }] },
      e: { n: 'E', price: 1, d: '', icon: 'x', hold: [{ kind: 'pinchHeal', at: 2, share: 0 }] },
      f: { n: 'F', price: 1, d: '', icon: 'x', hold: [{ kind: 'money', mult: 9 }] },
    },
  };
  const got = C.dataHeldItems(D).map(p => p[1].split(':')[0]);
  assert.deepEqual(got, [
    'a.hold',
    'b',
    'c.hold[0]',
    'd.hold[0].stat',
    'e.hold[0].share',
    'e.hold[0].at',
    'f.hold[0].mult',
  ]);
});
