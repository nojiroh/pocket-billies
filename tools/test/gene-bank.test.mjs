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
