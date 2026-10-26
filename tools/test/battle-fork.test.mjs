// RO-3f: Fork (the Satoshi line's move, fx.copyTypes) takes the target's types onto the user for battle.forkTurns
// turns, says so, wears off with its own line, fails when there is nothing new to take, and Soak still wins over it.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, said, startedSave } from './setup-real.mjs';

const { RULES, SPECIES } = data;

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

/** Pseudonymph (ours) against a wild Billie of this species, seeded */
function battle(foeId) {
  reseed(11);
  const s = startedSave('satoshi0', 30);
  s.team[0] = fn('makeBilly')('satoshi0', 30);
  assert.ok(fn('newBattle')('wild', [fn('makeBilly')(foeId, 30)], { fmt: 'single', seed: 'fork-test' }));
  hooks.activeBattle.events = [];
  return hooks.activeBattle;
}
const said2 = b => b.events.map(e => e.t || '').join('\n');

test('fork: the data: Steel Pseudonymph knows Fork from level 1; forkTurns is set', () => {
  assert.deepEqual(SPECIES.satoshi0.types, ['Steel']);
  assert.ok(fn('makeBilly')('satoshi0', 5).moves.includes('fork'));
  assert.equal(data.MOVES.fork.fx.copyTypes, 1);
  assert.ok(RULES.battle.forkTurns >= 1);
});

test('fork: takes the foe’s types for forkTurns turns, then wears off with its own line', () => {
  const b = battle('hastings1');
  fn('useMove')(0, 'fork', 1);
  assert.deepEqual(fn('actorTypes')(0), ['Flying', 'Psychic']);
  assert.deepEqual(fn('actorTypes')(1), ['Flying', 'Psychic'], 'the foe keeps its own');
  assert.match(said2(b), /forked .* and became Flying\/Psychic type/);
  for (let i = 0; i < RULES.battle.forkTurns - 1; i++) fn('endTurn')();
  assert.deepEqual(fn('actorTypes')(0), ['Flying', 'Psychic'], 'still copied one turn before the end');
  fn('endTurn')();
  assert.deepEqual(fn('actorTypes')(0), ['Steel']);
  assert.match(said2(b), /fork ran out/);
  assert.doesNotMatch(said2(b), /dried off/);
});

test('fork: fails when the user already has the foe’s types; the computer does not pick it then', () => {
  const b = battle('satoshi0');
  fn('useMove')(0, 'fork', 1);
  assert.match(said2(b), /But it failed/);
  assert.deepEqual(fn('actorTypes')(0), ['Steel']);
  assert.equal(fn('aiScore')(1, 'fork', 0), 5, 'nothing to take: the base score only');
});

test('fork: a Water foe makes it Water (what the same-type bonus and weaknesses read); Soak over a fork dries off as Soak', () => {
  const b = battle('cuban0');
  fn('useMove')(0, 'fork', 1);
  assert.deepEqual(fn('actorTypes')(0), ['Water']);
  fn('useMove')(1, 'spin', 0);
  b.events = [];
  for (let i = 0; i < RULES.battle.spinTurns; i++) fn('endTurn')();
  assert.match(said2(b), /dried off/);
  assert.deepEqual(fn('actorTypes')(0), ['Steel']);
});
