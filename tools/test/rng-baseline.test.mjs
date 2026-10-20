// RL-1: the randomness facts as they are before RL-2 moves them, written down as tests so a change shows.
// - game/js/util.js's random is whatever Math.random is when util.js loads: on the page the browser's (not seedable),
//   here the Park-Miller stand-in of load-logic.mjs, put on Math.random before anything imports util.js.
// - So the battle engine's rolls (crit, damage, accuracy, statuses, the AI's pick, speed ties) follow Math.random:
//   two battles started from the same seed play out the same, event for event.
// RL-2 replaces this with logic/rng.js and a battle's own b.rng; then the first test changes on purpose.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, hooks, reseed, startedSave } from './setup-fixture.mjs';
import { random } from '../../game/js/util.js';

test('rng: util.js random is Math.random (here the seeded stand-in)', () => {
  assert.equal(random, Math.random);
  reseed(7);
  const a = [random(), random(), random()];
  reseed(7);
  assert.deepEqual([random(), random(), random()], a);
});

function play(seed) {
  reseed(seed);
  const s = startedSave('sparky0', 12),
    foe = fn('makeBilly')('sprout0', 12);
  fn('newBattle')('wild', [foe]);
  const b = hooks.activeBattle,
    log = [];
  for (let t = 0; t < 60 && !b.over; t++) {
    fn('runTurn')([{ who: 0, k: 'move', mid: 'tackle', tk: 1 }]);
    log.push(...b.events.map(e => e.t || e.k || ''));
  }
  return { over: b.over, log, hp: [s.team[0].hp, foe.hp] };
}

test('rng: two battles from the same seed play out the same', () => {
  const a = play(2024),
    b = play(2024);
  assert.ok(a.over, 'the battle ended');
  assert.ok(a.log.length > 2, 'something happened');
  assert.deepEqual(b, a);
});

test('rng: other seeds give other battles (the seed reaches the engine)', () => {
  const logs = new Set([1, 2, 3, 4, 5, 6].map(s => JSON.stringify(play(s))));
  assert.ok(logs.size > 1);
});
