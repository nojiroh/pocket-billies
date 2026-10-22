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

test('rules: trips and gates, encounters, the wild prize', () => {
  const s = startedSave('sparky0', 10);
  assert.equal(fn('hereLocation')().id, 'meadow');
  assert.deepEqual(fn('tripTo')(0), { metres: 100, plan: [0] });
  assert.equal(fn('canEnter')(2), false); // the lake needs a Water Billie big enough to ride
  assert.equal(fn('tripTo')(2), null);
  s.team.push(fn('makeBilly')('drip0', 10)); // 2 m tall
  assert.equal(fn('canEnter')(2), true);
  assert.equal(fn('wildPrize')(10), 200); // a wild win pays $20 a level
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

test('RL-2: a spawn from a seeded stream is the same every time, and leaves Math.random alone (bar the uid)', () => {
  startedSave('sparky0', 10);
  const roll = () => {
    const f = fn('rngFn')('run-a|n0', 'wild|0'),
      out = [];
    for (let i = 0; i < 20; i++) {
      const { sp, lvl, build, coat, alpha } = fn('spawn')(false, null, undefined, f);
      out.push({ sp, lvl, build, coat, alpha });
      fn('encountersHere')().length = 0;
    }
    return out;
  };
  const a = roll();
  assert.deepEqual(roll(), a);
  assert.ok(new Set(a.map(q => q.sp + q.lvl)).size > 1, 'the stream reaches the rolls');
  // a seeded spawn draws Math.random once, for its uid (newUid), and for nothing else
  reseed(9);
  fn('spawn')(false, null, undefined, fn('rngFn')('x'));
  const after = Math.random();
  reseed(9);
  Math.random();
  assert.equal(after, Math.random());
  // the seeded pickers
  const f1 = fn('rngFn')('pick'),
    f2 = fn('rngFn')('pick'),
    L = [
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ];
  for (let i = 0; i < 20; i++) assert.equal(fn('pickWeighted')(L, f1), fn('pickWeighted')(L, f2));
  assert.deepEqual(fn('rollBuild')(fn('rngFn')('b')), fn('rollBuild')(fn('rngFn')('b')));
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

test('rules: a split evolution goes the way you pick: Build (its next stage) or Hype (the other final)', () => {
  const s = startedSave('sparky0', 10),
    E = data.SPECIES.sparky0,
    keep = [E.evo, E.alt];
  try {
    E.evo = { k: 'split', at: 5 };
    E.alt = 'sprout1';
    const a = s.team[0],
      b = fn('makeBilly')('sparky0', 10);
    assert.equal(fn('canEvolve')(a), true);
    fn('evolve')(a, 'A');
    fn('evolve')(b, 'B');
    assert.equal(a.sp, 'sparky1');
    assert.equal(b.sp, 'sprout1');
    assert.match(fn('evolutionHint')(fn('makeBilly')('sparky0', 3)), /you choose/);
  } finally {
    [E.evo, E.alt] = keep;
  }
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

test('rules: the distance walked outdoors counts; RL-10 (on purpose): walking hatches no egg any more', () => {
  const s = startedSave('sparky0', 10);
  s.eggs = [];
  s.stats = {};
  fn('addEgg')(2); // the fixture's egg needs 100 m
  fn('addWalked')(60);
  fn('addWalked')(60);
  assert.equal(s.eggs[0].prog, 0, 'eggs hatch at the ranch now (logic/breeding.js), not by walking');
  assert.equal(fn('hatchable')().length, 0);
  assert.equal(s.stats.walked, 120);
  fn('addWalked')(5000);
  assert.equal(s.stats.walked, 120, 'a jump of kilometres is not a walk');
});
