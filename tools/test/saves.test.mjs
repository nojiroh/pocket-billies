// Phase 13 (moved from logic.test.mjs, phase 04e): saves (game/js/logic/saves.js), on the small data set of
// setup-fixture.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, logic, startedSave } from './setup-fixture.mjs';

test('saves: a new save, load checks, migrate, backup check', () => {
  const s = fn('newSave')();
  assert.equal(s.saveVersion, logic.SAVE_VERSION);
  assert.equal(s.gameVersion, globalThis.PB_VERSION);
  assert.equal(s.coins.penny, 5);
  assert.equal(s.items.potion, 2);
  assert.equal(fn('saveAge')(s), 'ok');
  assert.equal(fn('saveAge')({}), 'old');
  assert.equal(fn('saveAge')({ saveVersion: logic.SAVE_VERSION + 1 }), 'new');
  assert.equal(fn('saveAge')(null), null);
  assert.equal(fn('loadSave')({ team: [] }), null);
  const started = startedSave('sparky0', 10);
  started.box.push({ ...fn('makeBilly')('sprout0', 3), sp: 'gone0' }); // a species the Studio removed
  started.team[0].moves = ['tackle', 'nosuchmove'];
  const m = fn('migrate')(JSON.parse(JSON.stringify(started)));
  assert.equal(m.box.length, 0);
  assert.deepEqual(m.team[0].moves, ['tackle']);
  assert.equal(m.saveVersion, logic.SAVE_VERSION);
  const valid = fn('validSave');
  assert.equal(valid(m), true);
  assert.equal(valid(s), false); // not started
  assert.equal(valid({ ...m, team: [{ ...m.team[0], lvl: 101 }] }), false);
  assert.equal(valid(JSON.parse(JSON.stringify(m).replace('"flags":{}', '"flags":{"__proto__":1}'))), false);
});

test('saves: a started save comes back from its JSON (loading again changes nothing); a broken one is refused', () => {
  const s = startedSave('sparky0', 10);
  s.team.push(fn('makeBilly')('drip0', 7));
  const once = fn('loadSave')(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(once.team, s.team);
  assert.deepEqual(fn('loadSave')(JSON.parse(JSON.stringify(once))), once);
  const text = JSON.stringify(once);
  const valid = fn('validSave');
  assert.equal(valid(JSON.parse(text)), true);
  const broken = f => {
    const o = JSON.parse(text);
    f(o);
    return valid(o);
  };
  assert.equal(
    broken(o => (o.team[1].uid = o.team[0].uid)),
    false,
    'two Billies with one id'
  );
  assert.equal(
    broken(o => (o.team[0].moves = ['nosuchmove'])),
    false,
    'a move the game does not have'
  );
  assert.equal(
    broken(o => (o.trip.node = 99)),
    false,
    'a place the game does not have'
  );
  assert.equal(
    broken(o => (o.se = -1)),
    false,
    'money below zero'
  );
});
