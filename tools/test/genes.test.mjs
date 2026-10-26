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

test("genes: a Gene id gives its part, kind, kit, the donor's species, the trait and dominant type", () => {
  assert.deepEqual(N.geneOf(D, 'front', 'eagle_wing@hughes2'), {
    slot: 'front',
    id: 'eagle_wing@hughes2',
    donor: 'hughes2',
    sp: 'hughes2',
    line: 'hughes',
    part: 'eagle_wing',
    kind: 'wing',
    kit: 'birds',
    trait: 'airborne',
    type: 'Flying',
    move: null,
    field: null,
  });
  /* a regional form's rig is a donor too; its species is its line's stage */
  assert.equal(N.geneOf(D, 'front', 'eagle_wing@hughes_harbour2').sp, 'hughes2');
  assert.equal(N.geneOf(D, 'front', 'eagle_wing@nobody'), null);
  assert.equal(N.geneOf(D, 'front', 'hughes2'), null, 'a bare donor is not a Gene');
  /* a lookup for any slot (head Genes come with SP-7); graftFit keeps only the slots that are spliced */
  assert.equal(N.geneOf(D, 'head', 'duck_head@hughes2').part, 'duck_head');
});

test('genes: graftFit keeps the slots that fit and drops the rest', () => {
  assert.deepEqual(N.graftFit(D, 'swift0', { front: 'bear_arm@musk3', sig: 'shark_tailfin@zuck2' }), {
    front: 'bear_arm@musk3',
    sig: 'shark_tailfin@zuck2',
  });
  /* trump's tail is its back: it can't stand in for Swiftlet's foot; an unknown donor, the head, a number go */
  assert.deepEqual(
    N.graftFit(D, 'swift0', { back: 'reptile_tail@trump0', head: 'bear_head@musk0', sig: 7, front: 'nobody' }),
    null
  );
  assert.deepEqual(N.graftFit(D, 'swift0', { back: 'reptile_tail@trump0', front: 'rabbit_arm@gates0' }), {
    front: 'rabbit_arm@gates0',
  });
  assert.equal(N.graftFit(D, 'swift0', null), null);
});

test('genes: Stability costs the line, the kit or another kit; past the limit Unstable, then refused', () => {
  const S = D.genes.stability,
    cost = (sp, slot, donor) => N.geneCost(D, sp, N.geneOf(D, slot, donor));
  assert.equal(cost('swift0', 'front', 'hawk_wing@swift2'), S.line);
  assert.equal(cost('swift0', 'front', 'eagle_wing@hughes2'), S.kit, 'a bird wing for a bird wing');
  assert.equal(cost('swift0', 'front', 'bear_arm@musk3'), S.other, 'a bear arm for a bird wing');
  assert.deepEqual(N.graftStability(D, 'swift0', { front: 'eagle_wing@hughes2' }), {
    cost: S.kit,
    limit: S.limit,
    unstable: false,
    refused: false,
  });
  const three = { front: 'bear_arm@musk3', back: 'bear_leg@musk3', sig: 'shark_tailfin@zuck2' },
    st = N.graftStability(D, 'swift0', three);
  assert.equal(st.cost, 3 * S.other);
  assert.equal(st.unstable, st.cost > S.limit);
  assert.equal(st.refused, st.cost > S.limit + S.refuse);
  assert.equal(N.graftStability(D, 'swift0', three, 10).unstable, false, 'a higher limit (the Gene Bank)');
  assert.equal(N.graftStability(D, 'swift0', null).cost, 0);
});

test('genes: a foreign part weighs what it did on its donor', () => {
  assert.deepEqual(N.graftRel(D, 'swift0', { front: 'bear_arm@musk3' }), { front: 160 / 0.4 });
  assert.deepEqual(N.graftRel(D, 'musk3', { front: 'hawk_wing@swift0' }), { front: 0.4 / 160 });
  assert.equal(N.graftRel(D, 'swift0', null), null);
});

test('genes: the heaviest dominant Gene gives the second type, never a third', () => {
  assert.deepEqual(
    N.graftTypes(D, 'gates0', { sig: 'fox_tail@musk0' }, undefined),
    ['Grass', 'Fire'],
    'fox tail: Fire'
  );
  assert.deepEqual(
    N.graftTypes(D, 'swift0', { front: 'eagle_wing@hughes2' }, undefined),
    ['Flying', 'Psychic'],
    'Flying already'
  );
  assert.deepEqual(
    N.graftTypes(D, 'gates0', { front: 'chick_wing@hughes0' }, undefined),
    ['Grass'],
    'no dominant type'
  );
  const g = { front: 'bear_arm@musk3', sig: 'reptile_tail@bezos0' },
    heavy = N.graftHeaviest(D, 'gates0', g, undefined);
  assert.equal(heavy[0].part, 'bear_arm');
  assert.deepEqual(N.graftTypes(D, 'gates0', g, undefined), ['Grass', 'Ground']);
  /* sizes count: a small heavy arm can lose to a big tail */
  const t = N.graftTypes(
    D,
    'gates0',
    { front: 'bear_arm@musk0', sig: 'reptile_tail@bezos3' },
    { front: 'S', sig: 'L' }
  );
  assert.equal(t.length, 2);
});

test('genes: traits come one per kind, in slot order, at most maxTraits', () => {
  assert.deepEqual(
    N.graftTraits(D, 'gates0', { front: 'eagle_wing@hughes2', back: 'piranha_backfin@zuck0', sig: 'fox_tail@musk0' }),
    ['airborne', 'swimmer', 'counterweight']
  );
  assert.deepEqual(N.graftTraits(D, 'gates0', { back: 'piranha_backfin@zuck0', sig: 'shark_tailfin@zuck0' }), [
    'swimmer',
  ]);
  assert.deepEqual(
    N.graftTraits({ ...D, genes: { ...D.genes, maxTraits: 1 } }, 'gates0', {
      front: 'eagle_wing@hughes2',
      sig: 'fox_tail@musk0',
    }),
    ['airborne']
  );
});

test('genes: an Unstable roll is two different stats and its heaviest donor', () => {
  const g = { front: 'bear_arm@musk3', back: 'bear_leg@musk3', sig: 'shark_tailfin@zuck2' },
    seen = new Set();
  for (const x of [0, 0.3, 0.6, 0.99]) {
    const u = N.graftUnstable(D, { sp: 'swift0', graft: g }, STATS, () => x);
    assert.ok(STATS.includes(u.up) && STATS.includes(u.down) && u.up !== u.down, JSON.stringify(u));
    assert.equal(u.donor, 'musk3');
    seen.add(u.up);
  }
  assert.ok(seen.size > 1, 'the roll decides');
});

test('genes: Unstable is rolled once past the limit, kept through a new splice past it, gone when stable', () => {
  const S = data.GENES.stability,
    was = S.limit,
    m = startedSave('swift0', 30).team[0],
    far = { front: 'bear_arm@musk3', back: 'bear_leg@musk3' };
  fn('spliceSet')(m, { front: 'eagle_wing@hughes2' });
  assert.equal(m.unstable, undefined, 'within the limit');
  fn('spliceSet')(m, far);
  const u = m.unstable;
  assert.ok(u && u.up !== u.down && u.name, 'past the limit: rolled');
  assert.equal(fn('billyUnstable')(m), u);
  fn('spliceSet')(m, { ...far, sig: 'shark_tailfin@zuck2' });
  assert.equal(m.unstable, u, 'still past it: the same roll');
  fn('unstableTidy')(m, undefined, 99);
  assert.equal(fn('billyUnstable')(m), null, "settled at a higher limit (SP-4: the Gene Bank's): not Unstable");
  assert.equal(S.limit, was);
  fn('spliceSet')(m, '');
  assert.equal('unstable' in m, false, 'no splice, no roll');
});

test('genes: a splice is saved with its Billie; saveFill trims what no longer fits; billiesOk refuses a bad shape', () => {
  const { billiesOk } = modules.saves,
    fill = s => fn('saveFill')(JSON.parse(JSON.stringify(s))),
    s = startedSave('swift0', 10);
  s.team[0].graft = { front: 'bear_arm@musk3', sig: 'shark_tailfin@zuck2' };
  assert.deepEqual(
    fill(s).team[0].graft,
    { front: 'bear_arm@musk3', sig: 'shark_tailfin@zuck2' },
    'kept through a save and load'
  );
  s.team[0].graft = { front: 'bear_arm@musk3', back: 'reptile_tail@trump0', head: 'bear_head@musk0', sig: 'nobody' };
  assert.deepEqual(fill(s).team[0].graft, { front: 'bear_arm@musk3' }, 'the slots that fit stay');
  s.team[0].graft = { back: 'reptile_tail@trump0' };
  assert.equal('graft' in fill(s).team[0], false, 'nothing fits: gone');
  /* past what Stability ever allows: gone */
  const S = data.GENES.stability,
    was = S.refuse;
  S.refuse = 0;
  try {
    s.team[0].graft = { front: 'bear_arm@musk3', back: 'bear_leg@musk3', sig: 'shark_tailfin@zuck2' };
    assert.equal('graft' in fill(s).team[0], false);
  } finally {
    S.refuse = was;
  }
  const m = fn('makeBilly')('swift0', 5);
  assert.equal(billiesOk([{ ...m, graft: { front: 'bear_arm@musk3' } }]), true);
  assert.equal(billiesOk([{ ...m, graft: 'front=bear_arm@musk3' }]), false);
  assert.equal(billiesOk([{ ...m, graft: { front: 7 } }]), false);
  assert.equal(billiesOk([{ ...m, graft: { front: 'x'.repeat(65) } }]), false);
  assert.equal(billiesOk([{ ...m, graft: ['musk3'] }]), false);
});

test('genes: a splice survives evolving', () => {
  const s = startedSave('swift0', 30),
    m = s.team[0];
  m.graft = { front: 'bear_arm@musk3', sig: 'shark_tailfin@zuck2' };
  fn('evolve')(m);
  assert.equal(m.sp, 'swift1');
  assert.deepEqual(m.graft, { front: 'bear_arm@musk3', sig: 'shark_tailfin@zuck2' });
});

test('genes: a spliced Billie has its dominant Gene type in battle and on its card; an unspliced one its own', () => {
  const s = startedSave('gates0', 20),
    m = s.team[0],
    own = fn('billyTypes')(m);
  assert.equal(own, data.SPECIES.gates0.types, 'the same list, untouched');
  m.graft = { sig: 'fox_tail@musk0' };
  assert.deepEqual(fn('billyTypes')(m), ['Grass', 'Fire']);
});

test('genes: an Unstable Billie has one stat raised and one lowered, and a merged name; a stable one neither', () => {
  const S = data.GENES.stability,
    U = data.GENES.unstable,
    was = S.limit,
    s = startedSave('swift0', 30),
    m = s.team[0];
  m.build = { head: 'M', body: 'M', front: 'M', back: 'M', sig: 'M' };
  fn('spliceSet')(m, { front: 'eagle_wing@hughes2' });
  const stable = Object.fromEntries(STATS.map(k => [k, fn('stat')(m, k)]));
  assert.equal(fn('billyName')(m), 'Swiftlet');
  S.limit = 0;
  try {
    fn('unstableTidy')(m);
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
  s.team[0].graft = { sig: 'fox_tail@musk0' };
  const r = fn('spliceReport')();
  assert.deepEqual(r, [
    {
      at: 0,
      sp: 'gates0',
      graft: 'sig=fox_tail@musk0',
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
    lineOf = id => GAME_DATA.kitBuilds.forms.find(f => f.rig === modules['graft-art'].geneSplit(id).donor).line;
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
  assert.equal(N.geneWords(D, 'front', 'eagle_wing@hughes2'), 'an eagle’s wings');
  assert.equal(N.geneWords(D, 'sig', 'shark_tailfin@zuck2'), 'a shark’s tail');
  assert.equal(N.geneWords(D, 'front', 'nobody'), '');
  assert.equal(N.geneWords(D, 'front', 'eagle_wing@nobody'), '');
});

test('genes: an Unstable roll is saved with its Billie; saveFill drops a stale or broken one', () => {
  const { billiesOk } = modules.saves,
    fill = s => fn('saveFill')(JSON.parse(JSON.stringify(s))),
    s = startedSave('swift0', 30),
    m = s.team[0];
  fn('spliceSet')(m, { front: 'bear_arm@musk3', back: 'bear_leg@musk3' });
  assert.deepEqual(fill(s).team[0].unstable, m.unstable, 'kept through a save and load');
  const keep = m.unstable;
  m.graft = { front: 'eagle_wing@hughes2' };
  assert.equal('unstable' in fill(s).team[0], false, 'stable again: gone');
  m.graft = { front: 'bear_arm@musk3', back: 'bear_leg@musk3' };
  m.unstable = { ...keep, up: keep.down };
  const again = fill(s).team[0].unstable;
  assert.notEqual(again.up, again.down, 'a broken roll is rolled again');
  assert.equal(billiesOk([{ ...m, unstable: { up: 'lev', down: 'hus', name: 'X' } }]), true);
  assert.equal(billiesOk([{ ...m, unstable: 'lev' }]), false);
  assert.equal(billiesOk([{ ...m, unstable: { up: 'lev', down: 7, name: 'X' } }]), false);
});
