// RL-12c: held items in battle, one point at a time (the golden record plays them together): the turn-end heal, the
// once-a-battle pinch heal, the stat stage as a holder takes the field, the damage rows and the money rows of those
// standing. Nothing held: nothing changes (the four golden battles before RL-12c stayed the same).
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, said, startedSave } from './setup-real.mjs';

const { RULES, SPECIES } = data;
const fighter = fn('fighter');
const starter = () => Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
const wildSpecies = () =>
  Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !RULES.start.starters.includes(SPECIES[k].line));

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
  reseed(7);
});

/** a single wild battle, your lead holding `held` (and the foe `foeHeld`) */
function battle(held, foeHeld) {
  const s = startedSave(starter(), 12);
  if (held) s.team[0].held = held;
  const foe = fn('makeBilly')(wildSpecies(), 12);
  if (foeHeld) foe.held = foeHeld;
  fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'held' });
  return { s, B: hooks.activeBattle, me: s.team[0] };
}
const texts = B => JSON.stringify(B.events);

test('battle held: the turn-end heal restores a share of HP, never past full', () => {
  const { B, me } = battle('leftover_sandwich'),
    mx = fn('maxHp')(me);
  me.hp = Math.floor(mx / 2);
  const at = me.hp;
  fn('endTurn')();
  assert.equal(me.hp, at + Math.max(1, Math.floor(mx * 0.0625)));
  assert.match(texts(B), /Leftover Sandwich restored a little HP/);
  me.hp = mx;
  B.events.length = 0;
  fn('endTurn')();
  assert.equal(me.hp, mx);
  assert.doesNotMatch(texts(B), /Leftover Sandwich/, 'nothing said at full HP');
});

test('battle held: the pinch heal fires once a battle, at or below its share of HP', () => {
  const { B, me } = battle('snack_pack'),
    mx = fn('maxHp')(me);
  me.hp = Math.floor(mx * 0.6);
  fn('endTurn')();
  assert.equal(me.hp, Math.floor(mx * 0.6), 'not low enough');
  me.hp = Math.floor(mx * 0.3);
  fn('endTurn')();
  assert.equal(me.hp, Math.floor(mx * 0.3) + Math.floor(mx * 0.25));
  assert.match(texts(B), /ate its Snack Pack/);
  me.hp = 1;
  fn('endTurn')();
  assert.equal(me.hp, 1, 'only once a battle');
});

test('battle held: stat stages as a holder starts on the field; none without', () => {
  assert.equal(battle('quick_laces').B.sides[0].f[0].v.st.hus, 1);
  assert.equal(battle(null).B.sides[0].f[0].v.st.hus, 0);
});

test('battle held: damage rows count for the holder alone, dealt and taken', () => {
  const mid = battle(null).me.moves.find(m => data.MOVES[m].p),
    phys = data.MOVES[mid].c === 'H',
    dmg = (held, foeHeld) => {
      battle(held, foeHeld);
      reseed(9);
      hooks.activeBattle.rng = null;
      return fn('calcDamage')(0, 1, mid).dmg;
    };
  assert.ok(mid, 'the starter has a damaging move');
  const base = dmg(null, null);
  assert.ok(dmg(phys ? 'brass_knuckles' : 'smart_specs', null) > base, 'its own category hits harder');
  assert.equal(dmg(phys ? 'smart_specs' : 'brass_knuckles', null), base, 'the other category is left alone');
  assert.ok(dmg(null, 'iron_vest') < base, 'the vest takes less');
});

test('battle held: money rows count for the holders still standing', () => {
  const { B, me } = battle('lucky_coin');
  const fx = fn('battleMoneyFx')(B);
  assert.deepEqual(
    fx.map(f => f.kind),
    ['money']
  );
  me.hp = 0;
  assert.equal(fn('battleMoneyFx')(B), B.fx, 'a fainted holder pays nothing more');
  assert.equal(fn('battleMoneyFx')(battle(null).B), battle(null).B.fx);
});
