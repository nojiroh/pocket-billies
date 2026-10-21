// RL-4: the battle object. What newBattle installs (single, double, Alpha) is snapshotted field by field, with the
// non-enumerable `act` getters each side carries, so moving its making into logic/battle-state.js (makeBattle) is
// proven to give the same object. The team on side 0 is the save's team itself, by reference, in ordinary play.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, said, startedSave } from './setup-real.mjs';

const { DEX_ORDER, RULES, SPECIES } = data;

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

const starter = () => Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
function teamOfThree(lvl = 12) {
  const s = startedSave(starter(), lvl);
  while (s.team.length < 3) s.team.push(fn('makeBilly')(DEX_ORDER[(s.team.length * 5 + 3) % DEX_ORDER.length], lvl));
  return s;
}
// the battle as data: fighters by species and level (uids and dates follow the clock, not the seed)
const shape = b =>
  JSON.parse(
    JSON.stringify(b, (k, v) => (k === 'team' ? v.map(m => `${m.sp}@${m.lvl}`) : k === 'uid' || k === 'lead' ? '-' : v))
  );
// each side's `act` is a hidden getter and setter for its first slot's fighter
function checkAct(b) {
  for (const sd of b.sides) {
    const d = Object.getOwnPropertyDescriptor(sd, 'act');
    assert.ok(d && d.get && d.set && !d.enumerable, 'act is a hidden getter and setter');
    assert.equal(sd.act, sd.f[0].act);
    const was = sd.f[0].act;
    sd.act = 9;
    assert.equal(sd.f[0].act, 9);
    sd.act = was;
  }
}

for (const [name, fmt, foes] of [
  ['single', 'single', 1],
  ['double', 'double', 2],
  ['alpha', 'alpha', 1],
]) {
  test(`battle object: ${name}`, t => {
    reseed(7);
    const s = teamOfThree(10);
    const foe = Array.from({ length: foes }, (_, i) => fn('makeBilly')(DEX_ORDER[i + 1], 9));
    assert.equal(fn('newBattle')(fmt === 'single' ? 'wild' : 'trainer', foe, { fmt, foeName: 'Test' }), true);
    const b = hooks.activeBattle;
    assert.equal(b.sides[0].team, s.team, "side 0's team is the save's team");
    assert.equal(b.sides[1].team, foe);
    assert.equal(b.lead, s.team[0].uid);
    checkAct(b);
    t.assert.snapshot(shape(b));
  });
}

test('battle object: no battle when every Billie has fainted', () => {
  const s = startedSave(starter(), 10);
  s.team[0].hp = 0;
  assert.equal(fn('newBattle')('wild', [fn('makeBilly')(DEX_ORDER[1], 9)]), false);
  assert.equal(hooks.activeBattle, null);
});
