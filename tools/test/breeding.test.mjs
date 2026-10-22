// RL-10: breeding at Copperleaf's ranch on the game's own rules: a bred Billie's mark (a quirk, an abomination's name,
// spike and drawback), what each mode makes, the egg's timer and hatching, and the save's checks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, fn, reseed, startedSave } from './setup-real.mjs';

const B = GAME_DATA.rules.ranch.breed;

test('breeding: an abomination raises one stat and lowers another by rules.json ranch.breed; its name shows', () => {
  reseed();
  const s = startedSave('musk0', 20),
    m = s.team[0],
    stat = fn('stat'),
    before = { lev: stat(m, 'lev'), hus: stat(m, 'hus'), law: stat(m, 'law') };
  assert.ok(
    Object.values(before).every(v => Number.isInteger(v) && v > 0),
    'real stats'
  );
  m.mut = { k: 'quirk' };
  assert.equal(stat(m, 'lev'), before.lev, 'a quirk changes no stat');
  m.mut = { k: 'abom', name: 'Emberotter', up: 'lev', down: 'hus' };
  assert.equal(stat(m, 'lev'), Math.round(before.lev * B.abomUp));
  assert.equal(stat(m, 'hus'), Math.round(before.hus * B.abomDown));
  assert.equal(stat(m, 'law'), before.law, 'the others as they were');
  assert.equal(fn('billyName')(m), 'Emberotter');
  m.nick = 'Bob';
  assert.equal(fn('billyName')(m), 'Bob', 'a nickname still wins');
});

test('breeding: the save check takes a quirk and a well-formed abomination, and nothing else', () => {
  reseed();
  const s = startedSave('musk0', 10),
    m = s.team[0],
    ok = fn('billiesOk');
  for (const mut of [{ k: 'quirk' }, { k: 'abom', name: 'Emberotter', up: 'lev', down: 'hus' }]) {
    m.mut = mut;
    assert.equal(ok(s.team), true, JSON.stringify(mut));
  }
  for (const mut of [
    'abom',
    { k: 'mutant' },
    { k: 'abom', name: 'X', up: 'lev', down: 'lev' },
    { k: 'abom', name: 'X', up: 'luck', down: 'hus' },
    { k: 'abom', name: '', up: 'lev', down: 'hus' },
    { k: 'abom', name: 'X'.repeat(25), up: 'lev', down: 'hus' },
  ]) {
    m.mut = /** @type {any} */ (mut);
    assert.equal(ok(s.team), false, JSON.stringify(mut));
  }
});
