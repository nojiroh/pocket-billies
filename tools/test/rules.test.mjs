// Phase 13 (moved from logic.test.mjs, phase 04e): the rules (game/js/logic/rules.js), on the small data set of
// setup-fixture.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, reseed, startedSave } from './setup-fixture.mjs';

test('rules: stats, levels, moves, evolution', () => {
  const m = startedSave('sparky0', 10).team[0];
  assert.equal(fn('xpFor')(10), 800);
  assert.equal(fn('stat')(m, 'hp'), 30); // floor(2*50*10/100) + 10 + 10
  assert.equal(fn('stat')(m, 'lev'), 15); // floor(2*50*10/100) + 5
  assert.equal(m.hp, 30);
  assert.deepEqual(m.moves, ['tackle', 'ember']);
  const notes = [];
  fn('gainXp')(m, fn('xpFor')(16) - m.xp, t => notes.push(t));
  assert.equal(m.lvl, 16);
  assert.equal(notes.filter(t => /grew to level/.test(t)).length, 6);
  assert.equal(fn('canEvolve')(m), true); // the default first evolution: level 16
  assert.equal(fn('evolve')(m), 'Sparky');
  assert.equal(m.sp, 'sparky1');
});

test('rules: steps, trips and gates, encounters', () => {
  const s = startedSave('sparky0', 10);
  assert.equal(fn('hereLocation')().id, 'meadow');
  assert.deepEqual(fn('tripTo')(0), { steps: 100, plan: [0] });
  assert.equal(fn('canEnter')(2), false); // the lake needs a Water Billie big enough to ride
  assert.equal(fn('tripTo')(2), null);
  s.team.push(fn('makeBilly')('drip0', 10)); // 2 m tall
  assert.equal(fn('canEnter')(2), true);
  assert.equal(fn('earningsBetween')(7000, 9000), 1000 + 500);
  const before = fn('encountersHere')().length,
    q = fn('spawn')();
  assert.equal(fn('encountersHere')().length, before + 1);
  assert.ok(['sprout0', 'drip0'].includes(q.sp) && q.lvl >= 3 && q.lvl <= 5, JSON.stringify(q));
  assert.equal(
    fn('pickWeighted')([
      ['a', 1],
      ['b', 0],
    ]),
    'a'
  );
});

test('rules: encounters follow the place’s pool (its species by weight, its levels); a gentle one spares your starter', () => {
  const s = startedSave('sparky0', 10); // a Fire starter, in the meadow (Sprout 60, Drip 40, levels 3 to 5)
  reseed();
  const n = { sprout0: 0, drip0: 0 };
  for (let i = 0; i < 2000; i++) {
    const q = fn('spawn')();
    n[q.sp]++;
    assert.ok(q.lvl >= 3 && q.lvl <= 5, `level ${q.lvl}`);
    fn('encountersHere')().length = 0;
  }
  assert.equal(n.sprout0 + n.drip0, 2000, JSON.stringify(n));
  assert.ok(Math.abs(n.drip0 / 2000 - 0.4) < 0.04, JSON.stringify(n));
  // a gentle encounter is nothing strong against your starter: Water beats Fire, so only Sprout
  for (let i = 0; i < 200; i++) assert.equal(fn('spawn')(true).sp, 'sprout0');
});

test('rules: wild Billies live on each place’s map: full on the first visit, one more a minute of play, never past the stock', () => {
  const s = startedSave('sparky0', 10), // in the meadow, a route
    here = fn('encountersHere');
  s.wild = {};
  s.playMs = 0;
  assert.equal(here().length, 4, 'a route is full the first time you come');
  assert.equal(here(0).length, 0, 'a town without tall grass has none');
  fn('dropEncounter')(here()[0].id);
  fn('dropEncounter')(here()[0].id);
  assert.equal(here().length, 2);
  s.playMs = 59000;
  assert.equal(here().length, 2, 'not before a minute');
  s.playMs = 60000;
  assert.equal(here().length, 3);
  s.playMs = 600000;
  assert.equal(here().length, 4, 'never more than its stock');
  s.playMs = 900000;
  fn('dropEncounter')(here()[0].id);
  assert.equal(here().length, 3, 'the time it stood full does not count');
  s.playMs = 960000;
  assert.equal(here().length, 4);
});

test('rules: the other evolution kinds: a winning streak, a day resting in storage; the rest only by hand', () => {
  const s = startedSave('sparky0', 10),
    m = s.team[0],
    E = data.SPECIES.sparky0,
    keep = E.evo,
    canEvolve = fn('canEvolve');
  try {
    E.evo = { k: 'streak', n: 3, min: 5 };
    m.streak = 2;
    assert.equal(canEvolve(m), false);
    m.streak = 3;
    assert.equal(canEvolve(m), true);
    E.evo = { k: 'idle', ms: 86400000, min: 5 };
    s.box.push(m);
    m.boxedAt = Date.now() - 1000;
    assert.equal(canEvolve(m), false);
    m.boxedAt = Date.now() - 86400000 - 1000;
    assert.equal(canEvolve(m), true);
    m.lvl = 4;
    assert.equal(canEvolve(m), false, 'below its level it waits');
    m.lvl = 10;
    // an item, gifts, a merge or a new nickname: the interface does those; the rules only say how
    for (const k of ['item', 'donate', 'merge', 'rename']) {
      E.evo = { k, n: 2, min: 5 };
      assert.equal(canEvolve(m), false, k);
      assert.match(fn('evolutionHint')(m), /level 5/, k);
    }
  } finally {
    E.evo = keep;
  }
});
