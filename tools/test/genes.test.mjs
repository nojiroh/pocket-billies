// SP-2: Genes (game/data/genes.json, logic/genes.js): the data and data-checks' rules for it, a splice's Stability,
// weight, dominant type, traits and Unstable, and a grafted Billie in the save.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, GAME_DATA, modules, startedSave } from './setup-real.mjs';

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

test('genes: SP-3 the wild odds leave some Billies plain and every spliceable kind has a word', () => {
  const G = structuredClone(GAME_DATA.genes);
  Object.assign(G.wild, { graft: 0.7, chimera: 0.3, escaped: 0.1, chimeraParts: [3, 2] });
  delete G.kinds.tail.word;
  const got = C.dataGenes({ ...GAME_DATA, genes: G }).map(p => p[1].split(':')[0]);
  assert.ok(got.includes('wild'), got.join(' | '));
  assert.ok(got.includes('wild.chimeraParts'));
  assert.ok(got.includes('kinds.tail.word'));
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

test('genes: a splice is saved with its Billie; saveFill trims what no longer fits; billiesOk refuses a bad shape', () => {
  const { billiesOk } = modules.saves,
    fill = s => fn('saveFill')(JSON.parse(JSON.stringify(s))),
    s = startedSave('swift0', 10);
  s.team[0].graft = { front: 'musk3', sig: 'zuck2' };
  assert.deepEqual(fill(s).team[0].graft, { front: 'musk3', sig: 'zuck2' }, 'kept through a save and load');
  s.team[0].graft = { front: 'musk3', back: 'trump0', head: 'musk0', sig: 'nobody' };
  assert.deepEqual(fill(s).team[0].graft, { front: 'musk3' }, 'the slots that fit stay');
  s.team[0].graft = { back: 'trump0' };
  assert.equal('graft' in fill(s).team[0], false, 'nothing fits: gone');
  /* past what Stability ever allows: gone */
  const S = data.GENES.stability,
    was = S.refuse;
  S.refuse = 0;
  try {
    s.team[0].graft = { front: 'musk3', back: 'musk3', sig: 'zuck2' };
    assert.equal('graft' in fill(s).team[0], false);
  } finally {
    S.refuse = was;
  }
  const m = fn('makeBilly')('swift0', 5);
  assert.equal(billiesOk([{ ...m, graft: { front: 'musk3' } }]), true);
  assert.equal(billiesOk([{ ...m, graft: 'front=musk3' }]), false);
  assert.equal(billiesOk([{ ...m, graft: { front: 7 } }]), false);
  assert.equal(billiesOk([{ ...m, graft: { front: 'x'.repeat(41) } }]), false);
  assert.equal(billiesOk([{ ...m, graft: ['musk3'] }]), false);
});

test('genes: a splice survives evolving', () => {
  const s = startedSave('swift0', 30),
    m = s.team[0];
  m.graft = { front: 'musk3', sig: 'zuck2' };
  fn('evolve')(m);
  assert.equal(m.sp, 'swift1');
  assert.deepEqual(m.graft, { front: 'musk3', sig: 'zuck2' });
});

test('genes: a spliced Billie has its dominant Gene type in battle and on its card; an unspliced one its own', () => {
  const s = startedSave('gates0', 20),
    m = s.team[0],
    own = fn('billyTypes')(m);
  assert.equal(own, data.SPECIES.gates0.types, 'the same list, untouched');
  m.graft = { sig: 'musk0' };
  assert.deepEqual(fn('billyTypes')(m), ['Grass', 'Fire']);
});

test('genes: an Unstable Billie has one stat raised and one lowered, and a merged name; a stable one neither', () => {
  const S = data.GENES.stability,
    U = data.GENES.unstable,
    was = S.limit,
    s = startedSave('swift0', 30),
    m = s.team[0];
  m.build = { head: 'M', body: 'M', front: 'M', back: 'M', sig: 'M' };
  m.graft = { front: 'hughes2' };
  const stable = Object.fromEntries(STATS.map(k => [k, fn('stat')(m, k)]));
  assert.equal(fn('billyName')(m), 'Swiftlet');
  S.limit = 0;
  try {
    const un = fn('billyUnstable')(m);
    assert.ok(un);
    for (const k of STATS) {
      const want =
        k === un.up ? Math.round(stable[k] * U.up) : k === un.down ? Math.round(stable[k] * U.down) : stable[k];
      assert.equal(fn('stat')(m, k), Math.max(1, want), k);
    }
    assert.equal(fn('billyName')(m), modules.breeding.breedName('Swiftlet', data.SPECIES.hughes2.name));
    m.nick = 'Bob';
    assert.equal(fn('billyName')(m), 'Bob', 'a nickname still wins');
  } finally {
    S.limit = was;
  }
});

test("genes: the debug log's splice report names data ids only, never a Billie's name", () => {
  const s = startedSave('gates0', 20);
  s.team[0].nick = 'Secret Name';
  s.team[0].graft = { sig: 'musk0' };
  const r = fn('spliceReport')();
  assert.deepEqual(r, [
    {
      at: 0,
      sp: 'gates0',
      graft: 'sig=musk0',
      cost: 1,
      limit: 3,
      unstable: false,
      traits: ['counterweight'],
      types: ['Grass', 'Fire'],
    },
  ]);
  assert.doesNotMatch(JSON.stringify(r), /Secret/);
});

test('genes: SP-3 a wild splice is a Graft or a Chimera by the odds, from the pool, never refused, the same per stream', () => {
  const R = modules.rng,
    pools = Object.values(GAME_DATA.pools).map(P => P.list.map(([id]) => id)),
    W = GAME_DATA.genes.wild,
    lineOf = rig => GAME_DATA.kitBuilds.forms.find(f => f.rig === rig).line;
  let n = 0,
    grafts = 0,
    chimeras = 0;
  for (const pool of pools)
    for (const sp of pool)
      for (let i = 0; i < 200; i++) {
        const rnd = R.rngFn(`${sp}|${i}`, 'splice'),
          g = N.wildSplice(D, sp, pool, rnd),
          again = N.wildSplice(D, sp, pool, R.rngFn(`${sp}|${i}`, 'splice'));
        assert.deepEqual(g, again, 'the same stream gives the same splice');
        n++;
        if (!g) continue;
        const slots = Object.keys(g);
        if (slots.length === 1) grafts++;
        else chimeras++;
        assert.ok(slots.length <= W.chimeraParts[1]);
        assert.deepEqual(N.graftFit(D, sp, g), g, `${sp} ${JSON.stringify(g)} fits`);
        assert.equal(N.graftStability(D, sp, g).refused, false);
        const lines = new Set(pool.map(id => data.SPECIES[id].line));
        for (const donor of Object.values(g)) {
          assert.ok(lines.has(lineOf(donor)), `${donor} is of a line the pool holds`);
          assert.notEqual(lineOf(donor), data.SPECIES[sp].line);
        }
      }
  /* a pool of one line gives no donors; a pool's own odds stay near genes.json's (some species have fewer open slots) */
  assert.equal(
    N.wildSplice(D, 'swift0', ['swift0'], () => 0),
    null
  );
  assert.ok(grafts / n > W.graft * 0.7 && grafts / n < W.graft * 1.3, `grafts ${grafts}/${n}`);
  assert.ok(chimeras > 0 && chimeras / n < (W.chimera + W.graft) * 1.3, `chimeras ${chimeras}/${n}`);
});

test('genes: SP-3 a Gene in words names its animal and its kind', () => {
  assert.equal(N.geneWords(D, 'front', 'hughes2'), 'an eagle’s wings');
  const sharkTail = GAME_DATA.kitBuilds.forms.find(f => Object.values(f.parts).some(p => p[0] === 'shark_tailfin'));
  assert.equal(N.geneWords(D, 'sig', sharkTail.rig), 'a shark’s tail');
  assert.equal(N.geneWords(D, 'front', 'nobody'), '');
});
