// PK-10 (perks-track.md 5.8): held items' own moments and kinds in battle, one at a time, on test-only items (the
// game's items are tested by name in battle-held.test.mjs). A held item acts for its holder on either side; nothing
// held changes nothing (the golden battles).
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, startedSave } from './setup-real.mjs';

const { RULES, SPECIES, ITEMS, MOVES } = data;
const fighter = fn('fighter');
const starter = () => Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
const wildSpecies = () =>
  Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !RULES.start.starters.includes(SPECIES[k].line));
/** test-only held items, removed after each test */
const made = [];
const item = (id, hold) => {
  ITEMS[id] = { n: id.replace(/_/g, ' '), price: 100, rarity: 'common', d: 'Held: a test.', hold };
  made.push(id);
  return id;
};

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  reseed(7);
});
afterEach(() => {
  for (const id of made.splice(0)) delete ITEMS[id];
});

/** a single wild battle, your lead holding `held` (and the foe `foeHeld`) */
function battle(held, foeHeld, foeLvl = 12) {
  const s = startedSave(starter(), 12);
  if (held) s.team[0].held = held;
  const foe = fn('makeBilly')(wildSpecies(), foeLvl);
  if (foeHeld) foe.held = foeHeld;
  fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'held' });
  return { s, B: hooks.activeBattle, me: s.team[0], foe };
}
const texts = B => JSON.stringify(B.events);
/** a damaging move of `who`'s, or of a category */
const attack = (m, cat) => m.moves.find(id => MOVES[id].p && MOVES[id].c !== 'X' && (!cat || MOVES[id].c === cat));

test('held moments: a stat row at hurt, if superEffective, once a battle, lands on the holder only then', () => {
  const id = item('test_form', [
    { kind: 'stat', stat: 'lev', stages: 2, when: 'hurt', if: 'superEffective', once: 'battle' },
  ]);
  const { B } = battle(id),
    st = () => B.sides[0].f[0].v.st.lev || 0,
    M = { c: 'H', t: 'Normal' };
  fn('heldHitMoments')(1, 0, M, { te: 1 });
  assert.equal(st(), 0, 'not super effective: nothing');
  fn('heldHitMoments')(1, 0, M, { te: 2 });
  assert.equal(st(), 2, 'a super-effective hit: +2');
  assert.match(texts(B), /test form: .*Attack rose sharply/);
  fn('heldHitMoments')(1, 0, M, { te: 2 });
  assert.equal(st(), 2, 'once a battle');
  fn('heldHitMoments')(0, 1, M, { te: 2 });
  assert.equal(st(), 2, 'hitting is not hurt');
});

test('held moments: the row never acts where its kind always acts (no stages on coming in)', () => {
  const id = item('test_form2', [{ kind: 'stat', stat: 'hus', stages: 1, when: 'hit' }]);
  assert.equal(battle(id).B.sides[0].f[0].v.st.hus || 0, 0);
  assert.equal(data.ITEMS[id].hold.length, 1);
});

test('held moments: a foe holding one gets its stages too', () => {
  const id = item('test_form3', [{ kind: 'stat', stat: 'law', stages: 1, when: 'hurt' }]);
  const { B } = battle(null, id);
  fn('heldHitMoments')(0, 1, { c: 'S', t: 'Normal' }, { te: 1 });
  assert.equal(B.sides[1].f[0].v.st.law, 1);
  assert.equal(fighter(1).held, id);
});

test('held moments: a real hit runs them (useMove)', () => {
  const id = item('test_form4', [{ kind: 'stat', stat: 'pr', stages: 1, when: 'hit' }]);
  const { B, me } = battle(id),
    mid = attack(me);
  B.sides[1].team[0].hp = 9999;
  fn('useMove')(0, mid, 1);
  const hit = B.events.some(e => e.an && e.an.dmg > 0);
  assert.equal(B.sides[0].f[0].v.st.pr || 0, hit ? 1 : 0, texts(B));
});

test('held survive: once a battle, from full HP, a knockout hit leaves its holder at 1 HP', () => {
  const id = item('test_belt', [{ kind: 'survive' }]);
  const { B, me } = battle(id),
    mx = fn('maxHp')(me),
    r = { dmg: mx * 3 };
  assert.equal(fn('heldSurvives')(0, r), true);
  assert.equal(r.dmg, mx - 1);
  assert.equal(fn('heldSurvives')(0, { dmg: mx * 3 }), false, 'once a battle');
  const { me: me2 } = battle(id);
  me2.hp = mx - 1;
  assert.equal(fn('heldSurvives')(0, { dmg: mx * 3 }), false, 'not from below full HP');
  me2.hp = mx;
  assert.equal(fn('heldSurvives')(0, { dmg: 1 }), false, 'not a hit it lives through anyway');
  battle(null);
  assert.equal(fn('heldSurvives')(0, { dmg: mx * 3 }), false, 'nothing held');
  assert.ok(B);
});

test('held survive: a real knockout hit on the holder (useMove) leaves it at 1 HP with a line', () => {
  const id = item('test_belt2', [{ kind: 'survive' }]);
  const { B, foe } = battle(null, id, 2),
    me = B.sides[0].team[0],
    mid = attack(me);
  fn('fieldState')(0).st.lev = 6;
  fn('fieldState')(0).st.lob = 6;
  for (let i = 0; i < 6 && !B.events.some(e => /held on with its test belt2/.test(e.t || '')); i++) {
    foe.hp = fn('maxHp')(foe);
    delete B.heldState;
    fn('useMove')(0, mid, 1);
  }
  assert.match(texts(B), /held on with its test belt2/);
  assert.ok(foe.hp >= 1);
});

test('held reflect: a Billie hitting its holder with a move of its category loses its share of HP', () => {
  const id = item('test_cactus', [{ kind: 'reflect', share: 0.125, cat: 'H' }]);
  const { B, me, foe } = battle(id),
    mx = fn('maxHp')(foe);
  fn('heldAfterHit')(1, 0, { c: 'H' }, { dmg: 5 });
  assert.equal(foe.hp, mx - Math.floor(mx * 0.125));
  assert.match(texts(B), /was hurt by Emberox’s test cactus/);
  const at = foe.hp;
  fn('heldAfterHit')(1, 0, { c: 'S' }, { dmg: 5 });
  assert.equal(foe.hp, at, 'not a special move');
  fn('heldAfterHit')(1, 0, { c: 'H' }, { dmg: 0 });
  assert.equal(foe.hp, at, 'no hit landed');
  const mine = me.hp;
  fn('heldAfterHit')(0, 1, { c: 'H' }, { dmg: 5 });
  assert.equal(me.hp, mine, 'its holder hitting is left alone');
  foe.hp = 1;
  fn('heldAfterHit')(1, 0, { c: 'H' }, { dmg: 5 });
  assert.equal(foe.hp, 0, 'never below 0');
});

test('held drain: its holder heals its share of the damage it deals, never past full', () => {
  const id = item('test_fangs', [{ kind: 'drain', share: 0.125 }]);
  const { B, me } = battle(id),
    mx = fn('maxHp')(me);
  me.hp = 5;
  fn('heldAfterHit')(0, 1, { c: 'H' }, { dmg: 40 });
  assert.equal(me.hp, 10);
  assert.match(texts(B), /Emberox restored HP with its test fangs/);
  fn('heldAfterHit')(0, 1, { c: 'S' }, { dmg: 3 });
  assert.equal(me.hp, 11, 'at least 1');
  me.hp = mx;
  fn('heldAfterHit')(0, 1, { c: 'H' }, { dmg: 400 });
  assert.equal(me.hp, mx, 'never past full');
  me.hp = 5;
  fn('heldAfterHit')(1, 0, { c: 'H' }, { dmg: 40 });
  assert.equal(me.hp, 5, 'being hit drains nothing');
});

test('held immune: moves of its type miss the holder until it is hit, then it is spent; the foe AI knows', () => {
  const id = item('test_balloon', [{ kind: 'immune', type: 'Ground', until: 'hurt' }]);
  const { B } = battle(id);
  assert.equal(fn('heldFloats')(0, 'Ground'), true);
  assert.equal(fn('heldFloats')(0, 'Fire'), false);
  const ground = Object.keys(MOVES).find(m => MOVES[m].t === 'Ground' && MOVES[m].p > 0 && MOVES[m].c !== 'X');
  assert.equal(fn('aiDamage')(1, ground, 0), 0, 'the AI sees it would miss');
  fn('heldAfterHit')(1, 0, { c: 'H' }, { dmg: 3 });
  assert.match(texts(B), /test balloon popped/);
  assert.equal(fn('heldFloats')(0, 'Ground'), false, 'spent by a hit');
  assert.ok(fn('aiDamage')(1, ground, 0) > 0);
});

test('held immune: a real Ground move on the holder misses with a line and no accuracy roll (useMove)', () => {
  const id = item('test_balloon2', [{ kind: 'immune', type: 'Ground' }]);
  const { B, me } = battle(id),
    ground = Object.keys(MOVES).find(m => MOVES[m].t === 'Ground' && MOVES[m].p > 0 && MOVES[m].c !== 'X'),
    hp = me.hp;
  fn('useMove')(1, ground, 0);
  assert.equal(me.hp, hp);
  assert.match(texts(B), /Emberox floated clear on its test balloon/);
  fn('useMove')(1, ground, 0);
  assert.equal(me.hp, hp, 'without until it lasts');
});
