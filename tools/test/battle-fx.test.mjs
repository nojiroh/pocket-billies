// RL-12: a run's Perks in a battle (b.fx, logic/effects.js): stat stages for yours on the field as it starts, what
// yours deal and take (calcDamage), a coin's chance (catchOdds), the money a win pays (battleRewards), and a battle
// without them exactly as before.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, said, startedSave } from './setup-real.mjs';

const { MOVES, RULES, SPECIES } = data;
const starter = () => Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
const wild = () =>
  Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !RULES.start.starters.includes(SPECIES[k].line));
const physical = m => m.moves.find(id => MOVES[id] && MOVES[id].c === 'H' && MOVES[id].p > 0);

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

/** a seeded wild battle, the same each time, with these effect rows (none: no fx) */
function battle(fx, lvl = 12) {
  reseed(7);
  startedSave(starter(), lvl);
  const foe = fn('makeBilly')(wild(), lvl);
  assert.ok(fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'fx-test', ...(fx ? { fx } : {}) }));
  return hooks.activeBattle;
}
const rows = (...fx) => fx.map(f => ({ ...f, src: 'test' }));

test('battle fx: stat rows raise yours on the field as the battle starts, not the foe, within the stage cap', () => {
  const b = battle(rows({ kind: 'stat', stat: 'hus', stages: 1 }, { kind: 'stat', stat: 'lev', stages: 9 }));
  assert.equal(b.sides[0].f[0].v.st.hus, 1);
  assert.equal(b.sides[0].f[0].v.st.lev, RULES.battle.stageMax);
  assert.ok(
    Object.values(b.sides[1].f[0].v.st).every(n => n === 0),
    'the foe: none'
  );
  fn('sayBattleFx')();
  assert.ok(
    b.events.some(e => /Speed rose/.test(e.t || '')),
    'a line says so'
  );
  const none = battle(null);
  assert.ok(
    Object.values(none.sides[0].f[0].v.st).every(n => n === 0),
    'no fx: none'
  );
});

test('battle fx: damage dealt and taken follow the rows (same seed, same rolls)', () => {
  const hitOf = (fx, k, tk) => {
    const b = battle(fx),
      m = b.sides[k === 0 ? 0 : 1].team[0],
      mid = physical(m);
    assert.ok(mid, 'a physical move to test with');
    return fn('calcDamage')(k, tk, mid).dmg;
  };
  const base = hitOf(null, 0, 1),
    up = hitOf(rows({ kind: 'damage', side: 'deal', mult: 3 }), 0, 1),
    special = hitOf(rows({ kind: 'damage', side: 'deal', cat: 'S', mult: 3 }), 0, 1);
  assert.ok(up >= base * 3 - 3 && up <= (base + 1) * 3, `${base} -> ${up}`);
  assert.equal(special, base, 'a special-only row leaves a physical move');
  const taken = hitOf(null, 1, 0),
    less = hitOf(rows({ kind: 'damage', side: 'take', mult: 0.5 }), 1, 0);
  assert.ok(less < taken || taken === 1, `${taken} -> ${less}`);
  assert.equal(hitOf(rows({ kind: 'damage', side: 'take', mult: 0.5 }), 0, 1), base, 'take rows: not when yours hit');
});

test('battle fx: catch rows multiply a coin’s chance, never past 1', () => {
  const odds = fx => {
    const b = battle(fx, 30);
    return fn('catchOdds')('pyramid', 1, false, b);
  };
  const base = odds(null);
  assert.ok(base > 0 && base < 0.5, `the test needs a low chance: ${base}`);
  assert.equal(odds(rows({ kind: 'catch', mult: 1.5 })), Math.min(1, base * 1.5));
  assert.equal(odds(rows({ kind: 'catch', mult: 4 }, { kind: 'catch', mult: 4 })), Math.min(1, base * 4));
});

test('battle fx: money rows change what a win pays (whole $); none: as before', () => {
  const pay = fx =>
    fn('battleRewards')(
      { kind: 'trainer', over: 'win', T: { reward: 300 }, tid: 'x', foe: [{ lvl: 5 }], fx },
      { se: 0, flags: {}, seats: [], run: {} },
      () => 0.99
    ).reward;
  assert.equal(pay(undefined), 300);
  assert.equal(pay(rows({ kind: 'money', mult: 1.2 })), 360);
  const prize = fx =>
    fn('battleRewards')(
      { kind: 'wild', over: 'win', foe: [{ lvl: 9 }], fx },
      { se: 0, flags: {}, seats: [], run: {} },
      () => 0.99
    ).prize;
  assert.equal(prize(rows({ kind: 'money', mult: 2 })), prize(undefined) * 2);
});
