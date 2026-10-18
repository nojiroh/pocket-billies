// Phase 13 (moved from logic.test.mjs, phase 04e): the rules (game/js/logic/rules.js), on the small data set of
// setup-fixture.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, startedSave } from './setup-fixture.mjs';

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
  assert.deepEqual(fn('tripTo')(0), { steps: 100, plan: [0], back: false });
  assert.equal(fn('canEnter')(2), false); // the lake needs a Water Billie big enough to ride
  assert.equal(fn('tripTo')(2), null);
  s.team.push(fn('makeBilly')('drip0', 10)); // 2 m tall
  assert.equal(fn('canEnter')(2), true);
  assert.equal(fn('earningsBetween')(7000, 9000), 1000 + 500);
  const before = s.queue.length,
    q = fn('spawn')();
  assert.equal(s.queue.length, before + 1);
  assert.ok(['sprout0', 'drip0'].includes(q.sp) && q.lvl >= 3 && q.lvl <= 5, JSON.stringify(q));
  assert.equal(
    fn('pickWeighted')([
      ['a', 1],
      ['b', 0],
    ]),
    'a'
  );
});
