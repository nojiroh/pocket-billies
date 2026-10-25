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

test('battle genes: SP-3 a spliced wild Billie says what it wears as the battle opens; a plain one says nothing more', () => {
  const s = startedSave('gates0', 20),
    q = { id: 'q1', sp: 'swift0', lvl: 5, no: 1, build: { head: 'M', body: 'M', front: 'M', back: 'M', sig: 'M' } },
    open = (/** @type {any} */ e) => {
      hooks.provide({ activeBattle: null });
      fn('startWild')(e);
      return texts(hooks.activeBattle);
    };
  s.wild = {};
  const plain = open({ ...q });
  assert.doesNotMatch(plain, /This Swiftlet/);
  const words = fn('spliceWords')({ sp: 'swift0', graft: { front: 'eagle_wing@hughes2' } });
  assert.deepEqual(words, ['an eagle’s wings']);
  assert.match(open({ ...q, graft: { front: 'eagle_wing@hughes2' } }), /This Swiftlet has an eagle’s wings!/);
  assert.match(
    open({ ...q, graft: { front: 'eagle_wing@hughes2', sig: 'shark_tailfin@zuck2' } }),
    /This Swiftlet is a patchwork: an eagle’s wings and a shark’s tail!/
  );
});

test('battle genes: SP-3 a spliced wild Billie knocked out banks DNA and samples its Genes once; caught, it leaves none', () => {
  const W = data.GENES.wild.dna,
    /* a battle against a Pupfin spliced with foeGraft, ended as `over` and settled; `meta` carries an earlier save's */
    end = (/** @type {any} */ foeGraft, /** @type {string} */ over, /** @type {any} */ meta) => {
      const { s, B } = battle(null, foeGraft);
      if (meta) s.meta = meta;
      B.over = over;
      const { pay, run } = fn('battleSettle')(B, s);
      fn('battleSettleWin')(B, s, pay, run);
      return { s, pay };
    };
  const first = end({ front: 'eagle_wing@hughes2' }, 'win'),
    meta = first.s.meta;
  assert.equal(meta.dna, W.graft);
  assert.deepEqual(meta.genes, ['eagle_wing@hughes2']);
  assert.deepEqual(first.pay.sampled, [{ gene: 'eagle_wing@hughes2', words: 'an eagle’s wings' }]);
  /* a Chimera with that Gene again: its own DNA, and only the new Gene joins */
  const again = end({ front: 'eagle_wing@hughes2', sig: 'shark_tailfin@zuck2' }, 'win', meta);
  assert.equal(meta.dna, W.graft + W.chimera);
  assert.deepEqual(meta.genes, ['eagle_wing@hughes2', 'shark_tailfin@zuck2']);
  assert.deepEqual(
    again.pay.sampled.map(x => x.gene),
    ['shark_tailfin@zuck2']
  );
  /* caught (Taxed): it keeps its parts, no sample; a plain Billie beaten: nothing */
  assert.equal(end({ front: 'eagle_wing@hughes2' }, 'caught').s.meta.dna, 0);
  const plain = end(null, 'win');
  assert.deepEqual([plain.s.meta.dna, plain.s.meta.genes, plain.pay.dna], [0, [], 0]);
  assert.ok(fn('validMeta')(meta), 'the sampled meta passes the save check');
  assert.equal(
    fn('validMeta')({ ...meta, genes: ['shark_tailfin@zuck2', 'shark_tailfin@zuck2'] }),
    false,
    'a Gene twice is refused'
  );
});
