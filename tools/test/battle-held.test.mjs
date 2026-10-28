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

// PK-10 (perks-track.md 5.8): the 16 new held items, each in a battle by its own name
const BOOSTERS = {
  matchbook: 'Fire',
  water_bottle: 'Water',
  seed_packet: 'Grass',
  spare_battery: 'Electric',
  garden_trowel: 'Ground',
  paper_plane: 'Flying',
  tarot_card: 'Psychic',
  socket_wrench: 'Steel',
  dragon_fruit: 'Dragon',
};
const moveOf = (t, not) =>
  Object.keys(data.MOVES).find(
    m => data.MOVES[m].p > 0 && data.MOVES[m].c !== 'X' && (not ? data.MOVES[m].t !== t : data.MOVES[m].t === t)
  );
const dmgWith = (held, mid, foeHeld) => {
  battle(held, foeHeld);
  reseed(9);
  hooks.activeBattle.rng = null;
  return fn('calcDamage')(0, 1, mid).dmg;
};

test('battle held PK-10: each type booster makes its holder’s moves of its type hit 20% harder, no others', () => {
  for (const [id, t] of Object.entries(BOOSTERS)) {
    const mid = moveOf(t),
      other = moveOf(t, true);
    assert.ok(mid, `a ${t} move to try ${id} with`);
    const base = dmgWith(null, mid),
      up = dmgWith(id, mid);
    assert.ok(up > base && up <= Math.ceil(base * 1.2) + 1, `${id}: ${base} -> ${up}`);
    assert.equal(dmgWith(id, other), dmgWith(null, other), `${id} leaves a non-${t} move alone`);
  }
});

test('battle held PK-10: Ankle Weights hits 30% harder and moves last', () => {
  const mid = moveOf('Fire'),
    base = dmgWith(null, mid),
    up = dmgWith('ankle_weights', mid);
  assert.ok(up > base * 1.2, `${base} -> ${up}`);
  battle('ankle_weights');
  assert.equal(fn('heldLastActs')([{ who: 0 }, { who: 1 }]).size, 1);
});

test('battle held PK-10: Seatbelt holds on once from full HP', () => {
  const { me } = battle('seatbelt'),
    r = { dmg: 999 };
  assert.equal(fn('heldSurvives')(0, r), true);
  assert.equal(r.dmg, me.hp - 1);
  assert.equal(fn('heldSurvives')(0, { dmg: 999 }), false);
});

test('battle held PK-10: Cactus Keyring hurts a physical hitter by an eighth', () => {
  const { B } = battle('cactus_keyring'),
    foe = fighter(1),
    mx = fn('maxHp')(foe);
  fn('heldAfterHit')(1, 0, { c: 'H' }, { dmg: 4 });
  assert.equal(foe.hp, mx - Math.max(1, Math.floor(mx / 8)));
  assert.match(texts(B), /Cactus Keyring/);
});

test('battle held PK-10: Complaint Form raises Attack and Sp. Atk sharply at the first super-effective hit', () => {
  const { B } = battle('complaint_form'),
    v = B.sides[0].f[0].v;
  fn('heldHitMoments')(1, 0, { c: 'H', t: 'Water' }, { te: 1 });
  assert.equal(v.st.lev || 0, 0);
  fn('heldHitMoments')(1, 0, { c: 'H', t: 'Water' }, { te: 2 });
  assert.deepEqual([v.st.lev, v.st.lob], [2, 2]);
  fn('heldHitMoments')(1, 0, { c: 'H', t: 'Water' }, { te: 2 });
  assert.deepEqual([v.st.lev, v.st.lob], [2, 2], 'once a battle');
  assert.match(texts(B), /Complaint Form: .*Sp\. Atk rose sharply/);
});

test('battle held PK-10: Party Balloon keeps Ground moves off until its holder is hit', () => {
  battle('party_balloon');
  assert.equal(fn('heldFloats')(0, 'Ground'), true);
  fn('heldAfterHit')(1, 0, { c: 'S' }, { dmg: 2 });
  assert.equal(fn('heldFloats')(0, 'Ground'), false);
});

test('battle held PK-10: Costume Fangs heals an eighth of the damage dealt', () => {
  const { me } = battle('costume_fangs');
  me.hp = 3;
  fn('heldAfterHit')(0, 1, { c: 'H' }, { dmg: 16 });
  assert.equal(me.hp, 5);
});

test('battle held PK-10: Express Pass puts its holder first on about a fifth of turns', () => {
  let won = 0;
  for (let i = 0; i < 200; i++) {
    reseed(300 + i);
    const { B } = battle('express_pass'),
      acts = [{ who: 0 }, { who: 1 }],
      early = new Set();
    B.rng = null;
    fn('heldFirstActs')(acts, early);
    if (early.has(acts[0])) won++;
  }
  assert.ok(won > 20 && won < 65, `${won} of 200`);
});
