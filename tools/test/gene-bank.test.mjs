// SP-4: the Gene Bank (genes.json bank, buildings.json genebank, logic/gene-bank.js): its data and data-checks' rules,
// its levels bought in DNA, and a milestone's DNA grant.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules, startedSave } from './setup-real.mjs';

const C = modules['data-checks'],
  K = modules.unlocks,
  UD = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings };

test('gene bank: the data passes; planted mistakes in bank and field are named', () => {
  assert.deepEqual(C.dataGenes(GAME_DATA), []);
  const G = structuredClone(GAME_DATA.genes);
  G.kinds.frontfin.field = 'fly';
  G.parts.bear_arm.field = 'nosuch';
  G.bank.levels[0].limit = 2;
  G.bank.levels[2].slots = ['sig'];
  const got = C.dataGenes({ ...GAME_DATA, genes: G }).map(p => p[1].split(':')[0]);
  assert.ok(got.includes('kinds.frontfin.field'), got.join(' | '));
  assert.ok(got.includes('parts.bear_arm.field'));
  assert.ok(got.includes('bank.levels[0].limit'));
  assert.ok(got.includes('bank.levels[2]'), 'a level takes slots back');
  const B = structuredClone(GAME_DATA.buildings);
  B.genebank.levels = 2;
  const more = C.dataGenes({ ...GAME_DATA, buildings: B }).map(p => p[1].split(':')[0]);
  assert.ok(more.includes('bank.levels'), 'as many levels as buildings.json sells');
});

test('gene bank: its levels are sold at the Bank for DNA, one after the other', () => {
  const s = startedSave('musk0', 5);
  s.meta.dna = 100;
  assert.equal(K.unlockCurrency(UD.unlocks.genebank_2, UD), 'dna');
  assert.equal(K.buildingLevel(s, 'genebank'), 1);
  assert.equal(K.unlockReady(s, 'genebank_3', UD), 'requires');
  assert.equal(K.unlockBuy(s, 'genebank_2', UD), true);
  assert.equal(s.meta.dna, 100 - UD.unlocks.genebank_2.cost);
  assert.equal(K.buildingLevel(s, 'genebank'), 2);
  assert.equal(K.unlockBuy(s, 'genebank_3', UD), s.meta.dna >= UD.unlocks.genebank_3.cost);
});

test('gene bank: a milestone that grants DNA pays it (it was dropped before SP-4)', () => {
  const s = startedSave('musk0', 5);
  s.meta.dna = 3;
  K.unlockGrant(s, { name: 'x', about: 'x', when: 'runs >= 1', grant: { dna: 7 } });
  assert.equal(s.meta.dna, 10);
});

test('gene bank: your Billies are held to the Bank level’s limit through a reload and an evolve; wild ones to 3', () => {
  const { geneData, geneLimit, spliceSet, billyUnstable, evolve } = modules.rules,
    { saveFill } = modules.saves,
    L = GAME_DATA.genes.bank.levels,
    s = startedSave('swift0', 30),
    m = s.team[0],
    far = { front: 'bear_arm@musk3', back: 'bear_leg@musk3' };
  assert.equal(geneLimit(s), L[0].limit);
  s.meta.buildings.genebank = 3;
  assert.equal(geneLimit(s), L[2].limit);
  const cost = modules.genes.graftStability(geneData(), 'swift0', far).cost;
  assert.ok(cost > L[0].limit && cost <= L[2].limit, `the test splice costs ${cost}`);
  spliceSet(m, far, geneLimit(s));
  assert.equal(billyUnstable(m), null, 'within the Bank’s limit');
  evolve(m);
  assert.ok(m.graft && !m.unstable, 'evolving keeps it stable at the Bank’s limit (the save is the page’s)');
  const back = saveFill(structuredClone(s));
  assert.ok(back.team[0].graft && !back.team[0].unstable, 'a reload keeps it, stable');
  const q = structuredClone(m);
  spliceSet(q, far);
  assert.ok(billyUnstable(q), 'the same splice on a wild one is Unstable at the default limit');
  s.meta.buildings.genebank = 1;
  const low = saveFill(structuredClone(s));
  assert.ok(low.team[0].unstable, 'at Lv 1 a reload settles it Unstable');
});

const B = modules['gene-bank'];

test('gene bank: sequencing reads a Billie’s own parts (and its splice) into the library once, for free', () => {
  const D = modules.rules.geneData(),
    s = startedSave('swift0', 20),
    m = s.team[0];
  s.meta.genes = [];
  const own = ['front', 'back', 'sig'].map(k => B.bankNative(D, 'swift0', k)).filter(Boolean);
  assert.ok(own.length >= 2 && own.every(id => id.endsWith('@swift0')), own.join());
  const got = B.bankSequence(D, s, m);
  assert.deepEqual(got.sort(), [...new Set(own)].sort());
  assert.deepEqual(B.bankSequence(D, s, m), [], 'never twice');
  m.graft = { sig: 'shark_tailfin@zuck2' };
  assert.deepEqual(B.bankSequence(D, s, m), ['shark_tailfin@zuck2'], 'its spliced Gene too');
  assert.equal(s.meta.dna, 0, 'free');
});

test('gene bank: a splice goes on an open slot for its DNA, is undone for free, and the Gene stays', () => {
  const D = modules.rules.geneData(),
    s = startedSave('swift0', 20),
    m = s.team[0],
    tail = 'shark_tailfin@zuck2',
    wing = 'eagle_wing@hughes2';
  s.meta.genes = [tail, wing];
  s.meta.dna = 0;
  assert.ok(B.bankGenes(D, s, m, 'sig').includes(tail));
  assert.ok(!B.bankGenes(D, s, m, 'sig').includes(wing), 'a wing doesn’t go on a tail');
  const price = B.bankPrice(D, 'swift0', 'sig', tail);
  assert.equal(price, D.genes.bank.price.base + D.genes.bank.price.perCost * 2, 'another kit: Stability 2');
  assert.equal(B.bankWhy(D, s, m, 'sig', tail), 'dna');
  s.meta.dna = 100;
  assert.equal(B.bankWhy(D, s, m, 'front', wing), 'slot', 'Lv 1 splices the sig slot only');
  assert.equal(B.bankWhy(D, s, m, 'sig', 'nope@zuck2'), 'unknown');
  assert.equal(B.bankSplice(D, s, m, 'sig', tail), '');
  assert.equal(s.meta.dna, 100 - price);
  assert.deepEqual(m.graft, { sig: tail });
  assert.equal(B.bankWhy(D, s, m, 'sig', tail), 'same');
  s.meta.buildings.genebank = 2;
  assert.deepEqual(B.bankSlots(D, 2), ['front', 'sig']);
  assert.equal(B.bankSplice(D, s, m, 'front', wing), '');
  assert.deepEqual(m.graft, { front: wing, sig: tail });
  assert.equal(B.bankUnsplice(D, s, m, 'sig'), '');
  assert.deepEqual(m.graft, { front: wing });
  assert.ok(s.meta.genes.includes(tail), 'the Gene stays in the library');
  assert.equal(B.bankUnsplice(D, s, m, 'front'), '');
  assert.equal('graft' in m, false);
  assert.equal(B.bankUnsplice(D, s, m, 'front'), 'none');
  s.run = { id: 'x' };
  assert.equal(B.bankWhy(D, s, m, 'sig', tail), 'run', 'a hub action');
});

test('gene bank: past the limit it is Unstable; a level up settles your Billies at the new limit', () => {
  const D = modules.rules.geneData(),
    s = startedSave('swift0', 20),
    m = s.team[0];
  s.meta.dna = 999;
  s.meta.buildings.genebank = 3;
  s.meta.genes = ['bear_arm@musk3', 'bear_leg@musk3'];
  assert.equal(B.bankSplice(D, s, m, 'front', 'bear_arm@musk3'), '');
  assert.equal(B.bankSplice(D, s, m, 'back', 'bear_leg@musk3'), '');
  const st = modules.genes.graftStability(D, 'swift0', m.graft, modules.rules.geneLimit(s));
  assert.equal(st.unstable, !!m.unstable, `cost ${st.cost}, limit ${st.limit}`);
  s.meta.buildings.genebank = 1;
  B.bankSettle(s);
  assert.equal(!!m.unstable, modules.genes.graftStability(D, 'swift0', m.graft, 3).unstable);
});

test('gene bank: a part that counts for a field move (fins: Surf, the bear’s arm: Rock Smash) gives its type there', () => {
  const R = modules.rules,
    D = R.geneData(),
    FM = GAME_DATA.fieldMoves.moves,
    fin = modules['graft-art'].graftDonors(D.kitBuilds, D.partKits, 'swift0', 'front').find(id => /frontfin@/.test(id));
  assert.ok(fin, 'a front fin fits a Swiftlet');
  const m = { sp: 'swift0', graft: { front: fin } };
  assert.ok(!R.billyTypes(m).includes(FM.surf.type) || D.species.swift0.types.includes(FM.surf.type));
  assert.ok(R.billyFieldTypes(m).includes(FM.surf.type), R.billyFieldTypes(m).join());
  assert.deepEqual(R.billyFieldTypes({ sp: 'swift0' }), D.species.swift0.types, 'no splice: its own types');
  const S = modules['run-side'],
    badges = { [S.fieldBadgeKey(FM.surf.type)]: 1 };
  assert.equal(S.fieldMoveState(FM.surf, badges, [{ name: 'x', types: R.billyFieldTypes(m) }]).state, 'ask');
  assert.equal(S.fieldMoveState(FM.surf, {}, [{ name: 'x', types: R.billyFieldTypes(m) }]).state, 'needBadge');
  const arm = { sp: 'swift0', graft: { front: 'bear_arm@musk3' } };
  assert.ok(R.billyFieldTypes(arm).includes(FM.smash.type));
});
