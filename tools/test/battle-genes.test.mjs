// SP-2: a spliced Billie in battle, one point at a time: its traits' rows count for it alone (stat stages as it takes
// the field, damage dealt and taken), an Unstable splice loses HP at each turn's end, and a spliced Billie's type is
// its dominant Gene's. No splice: nothing changes (the golden battles stay as they were).
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, said, startedSave } from './setup-real.mjs';

const { MOVES } = data;

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
  reseed(7);
});

/** a single wild battle: your Kidling (Grass), spliced with `graft`, against a Pupfin (Water) spliced with `foeGraft` */
function battle(graft, foeGraft) {
  const s = startedSave('gates0', 20),
    me = s.team[0];
  me.build = { head: 'M', body: 'M', front: 'M', back: 'M', sig: 'M' };
  if (graft) me.graft = graft;
  const foe = fn('makeBilly')('cuban0', 20);
  if (foeGraft) foe.graft = foeGraft;
  fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'genes' });
  return { s, B: hooks.activeBattle, me, foe };
}
const texts = B => JSON.stringify(B.events);

test("battle genes: a trait row is the Billie's own: Stride and Counterweight raise stages as it takes the field", () => {
  assert.equal(battle({ back: 'sparrow_foot@swift0' }).B.sides[0].f[0].v.st.hus, 1, 'a foot: Stride');
  assert.equal(battle({ sig: 'fox_tail@musk0' }).B.sides[0].f[0].v.st.law, 1, 'a tail: Counterweight');
  assert.equal(battle(null).B.sides[0].f[0].v.st.hus, 0);
  assert.equal(battle(null, { back: 'sparrow_foot@swift0' }).B.sides[1].f[0].v.st.hus, 1, 'the foe has its own');
  assert.deepEqual(
    fn('fxOfBillie')(battle({ back: 'sparrow_foot@swift0' }).me, data.ITEMS).map(f => f.src),
    ['gene:stride']
  );
});

test('battle genes: damage rows count for the spliced side alone', () => {
  const ground = Object.keys(MOVES).find(k => MOVES[k].t === 'Ground' && MOVES[k].p > 0),
    dmg = (graft, foeGraft, k, tk, mid) => {
      battle(graft, foeGraft);
      reseed(9);
      hooks.activeBattle.rng = null;
      return fn('calcDamage')(k, tk, mid).dmg;
    };
  assert.ok(ground, 'a Ground move to test with');
  const base = dmg(null, null, 1, 0, ground);
  /* Airborne (a wing) takes half from Ground; the Kidling keeps its type (a chick wing has no dominant type) */
  assert.ok(dmg({ front: 'chick_wing@hughes0' }, null, 1, 0, ground) < base, 'Airborne takes less from Ground');
  /* the foe's own wing shields the foe, not you (its weight moves its own attack, so compare what it takes) */
  assert.ok(
    dmg(null, { front: 'chick_wing@hughes0' }, 0, 1, ground) < dmg(null, null, 0, 1, ground),
    'the foe takes less'
  );
});

test("battle genes: an Unstable splice loses a share of HP at each turn's end; a stable one none", () => {
  const S = data.GENES.stability,
    was = S.limit;
  S.limit = 0;
  try {
    const { B, me } = battle({ front: 'bear_arm@musk3' }),
      mx = fn('maxHp')(me);
    fn('unstableTidy')(me);
    assert.ok(fn('billyUnstable')(me));
    me.hp = mx;
    fn('endTurn')();
    assert.equal(me.hp, mx - Math.max(1, Math.floor(mx * data.GENES.unstable.fx[0].share)));
    assert.match(texts(B), /unstable cells hurt it/);
  } finally {
    S.limit = was;
  }
  const { B, me } = battle({ front: 'bear_arm@musk3' }),
    mx = fn('maxHp')(me);
  me.hp = mx;
  fn('endTurn')();
  assert.equal(me.hp, mx);
  assert.doesNotMatch(texts(B), /unstable/);
});

test("battle genes: a spliced Billie fights as its dominant Gene's type", () => {
  battle({ sig: 'fox_tail@musk0' });
  assert.deepEqual(fn('actorTypes')(0), ['Grass', 'Fire']);
  battle(null);
  assert.deepEqual(fn('actorTypes')(0), ['Grass']);
});
