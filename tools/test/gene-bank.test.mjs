// SP-4: the Gene Bank (genes.json bank, buildings.json genebank, logic/gene-bank.js): its data and data-checks' rules,
// its levels bought in DNA, and a milestone's DNA grant.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules, startedSave } from './setup-real.mjs';

const C = modules['data-checks'],
  K = modules.unlocks,
  UD = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings };

test('gene bank: a milestone that grants DNA pays it (it was dropped before SP-4)', () => {
  const s = startedSave('musk0', 5);
  s.meta.dna = 3;
  K.unlockGrant(s, { name: 'x', about: 'x', when: 'runs >= 1', grant: { dna: 7 } });
  assert.equal(s.meta.dna, 10);
});
