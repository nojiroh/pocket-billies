// SP-2: Genes (game/data/genes.json, logic/genes.js): the data and data-checks' rules for it, a splice's Stability,
// weight, dominant type, traits and Unstable, and a grafted Billie in the save.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, GAME_DATA, modules } from './setup-real.mjs';

const C = modules['data-checks'];

test('genes: the game data passes dataGenes; planted mistakes are named', () => {
  assert.deepEqual(C.dataGenes(GAME_DATA), []);
  const G = structuredClone(GAME_DATA.genes);
  G.kinds.wing.trait = 'nope';
  delete G.kinds.tail;
  G.kinds.claw = { trait: 'grip' };
  G.traits.grip.fx = [{ kind: 'xp', mult: 2 }];
  G.parts.eagle_wing.type = 'Cheese';
  G.parts.nothing = { move: 'nomove' };
  G.unstable.fx = [{ kind: 'turnHurt', share: 0 }];
  G.stability.kit = 5;
  const got = C.dataGenes({ ...GAME_DATA, genes: G }).map(p => p[1].split(':')[0]);
  assert.ok(got.includes('kinds.wing.trait'), got.join(' | '));
  assert.ok(got.includes('kinds.claw'));
  assert.ok(
    got.some(w => w === 'kinds'),
    'a spliceable tail with no row'
  );
  assert.ok(got.includes('traits.grip.fx[0]'), 'xp is not a Gene row');
  assert.ok(got.includes('parts.eagle_wing.type'));
  assert.ok(got.includes('parts.nothing') && got.includes('parts.nothing.move'));
  assert.ok(got.includes('unstable.fx[0].share'));
  assert.ok(got.includes('stability'));
});

const N = modules.genes,
  STATS = GAME_DATA.stats.map(s => s.id),
  D = {
    kitBuilds: GAME_DATA.kitBuilds,
    partKits: GAME_DATA.partKits,
    genes: GAME_DATA.genes,
    species: data.SPECIES,
    parts: GAME_DATA.rules.parts,
  };

test('genes: a donor gives the part its recipe has for the slot, with its kind, kit, trait and dominant type', () => {
  assert.deepEqual(N.geneOf(D, 'front', 'hughes2'), {
    slot: 'front',
    donor: 'hughes2',
    sp: 'hughes2',
    line: 'hughes',
    part: 'eagle_wing',
    kind: 'wing',
    kit: 'birds',
    trait: 'airborne',
    type: 'Flying',
    move: null,
  });
  /* a regional form's rig is a donor too; its species is its line's stage */
  assert.equal(N.geneOf(D, 'front', 'hughes_harbour2').sp, 'hughes2');
  assert.equal(N.geneOf(D, 'front', 'nobody'), null);
  /* a lookup for any slot (head Genes come with SP-7); graftFit keeps only the slots that are spliced */
  assert.equal(N.geneOf(D, 'head', 'hughes2').part, 'duck_head');
});

test('genes: graftFit keeps the slots that fit and drops the rest', () => {
  assert.deepEqual(N.graftFit(D, 'swift0', { front: 'musk3', sig: 'zuck2' }), { front: 'musk3', sig: 'zuck2' });
  /* trump's tail is its back: it can't stand in for Swiftlet's foot; an unknown donor, the head, a number go */
  assert.deepEqual(N.graftFit(D, 'swift0', { back: 'trump0', head: 'musk0', sig: 7, front: 'nobody' }), null);
  assert.deepEqual(N.graftFit(D, 'swift0', { back: 'trump0', front: 'gates0' }), { front: 'gates0' });
  assert.equal(N.graftFit(D, 'swift0', null), null);
});

test('genes: Stability costs the line, the kit or another kit; past the limit Unstable, then refused', () => {
  const S = D.genes.stability,
    cost = (sp, slot, donor) => N.geneCost(D, sp, N.geneOf(D, slot, donor));
  assert.equal(cost('swift0', 'front', 'swift2'), S.line);
  assert.equal(cost('swift0', 'front', 'hughes2'), S.kit, 'a bird wing for a bird wing');
  assert.equal(cost('swift0', 'front', 'musk3'), S.other, 'a bear arm for a bird wing');
  assert.deepEqual(N.graftStability(D, 'swift0', { front: 'hughes2' }), {
    cost: S.kit,
    limit: S.limit,
    unstable: false,
    refused: false,
  });
  const three = { front: 'musk3', back: 'musk3', sig: 'zuck2' },
    st = N.graftStability(D, 'swift0', three);
  assert.equal(st.cost, 3 * S.other);
  assert.equal(st.unstable, st.cost > S.limit);
  assert.equal(st.refused, st.cost > S.limit + S.refuse);
  assert.equal(N.graftStability(D, 'swift0', three, 10).unstable, false, 'a higher limit (the Gene Bank)');
  assert.equal(N.graftStability(D, 'swift0', null).cost, 0);
});

test('genes: a foreign part weighs what it did on its donor', () => {
  assert.deepEqual(N.graftRel(D, 'swift0', { front: 'musk3' }), { front: 160 / 0.4 });
  assert.deepEqual(N.graftRel(D, 'musk3', { front: 'swift0' }), { front: 0.4 / 160 });
  assert.equal(N.graftRel(D, 'swift0', null), null);
});

test('genes: the heaviest dominant Gene gives the second type, never a third', () => {
  assert.deepEqual(N.graftTypes(D, 'gates0', { sig: 'musk0' }, undefined), ['Grass', 'Fire'], 'fox tail: Fire');
  assert.deepEqual(N.graftTypes(D, 'swift0', { front: 'hughes2' }, undefined), ['Flying', 'Psychic'], 'Flying already');
  assert.deepEqual(N.graftTypes(D, 'gates0', { front: 'hughes0' }, undefined), ['Grass'], 'no dominant type');
  const g = { front: 'musk3', sig: 'bezos0' },
    heavy = N.graftHeaviest(D, 'gates0', g, undefined);
  assert.equal(heavy[0].part, 'bear_arm');
  assert.deepEqual(N.graftTypes(D, 'gates0', g, undefined), ['Grass', 'Ground']);
  /* sizes count: a small heavy arm can lose to a big tail */
  const t = N.graftTypes(D, 'gates0', { front: 'musk0', sig: 'bezos3' }, { front: 'S', sig: 'L' });
  assert.equal(t.length, 2);
});

test('genes: traits come one per kind, in slot order, at most maxTraits', () => {
  assert.deepEqual(N.graftTraits(D, 'gates0', { front: 'hughes2', back: 'zuck0', sig: 'musk0' }), [
    'airborne',
    'swimmer',
    'counterweight',
  ]);
  assert.deepEqual(N.graftTraits(D, 'gates0', { back: 'zuck0', sig: 'zuck0' }), ['swimmer']);
  assert.deepEqual(
    N.graftTraits({ ...D, genes: { ...D.genes, maxTraits: 1 } }, 'gates0', { front: 'hughes2', sig: 'musk0' }),
    ['airborne']
  );
});

test('genes: Unstable picks two different stats from the Billie and its splice, the same each time', () => {
  const g = { front: 'musk3', back: 'musk3', sig: 'zuck2' },
    m = { sp: 'swift0', uid: 'b1', graft: g },
    u = N.graftUnstable(D, m, STATS);
  assert.ok(u && STATS.includes(u.up) && STATS.includes(u.down) && u.up !== u.down);
  assert.deepEqual(N.graftUnstable(D, { ...m }, STATS), u);
  assert.equal(u.donor, 'musk3');
  assert.equal(N.graftUnstable(D, { ...m, graft: { front: 'hughes2' } }, STATS), null);
  assert.equal(N.graftUnstable(D, { sp: 'swift0', uid: 'b1' }, STATS), null);
  const many = new Set(
    ['a', 'b', 'c', 'd', 'e', 'f'].map(uid => JSON.stringify(N.graftUnstable(D, { ...m, uid }, STATS)))
  );
  assert.ok(many.size > 1, 'another Billie can come out another way');
});
