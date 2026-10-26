// SP-5: Augments (genes.json augment, logic/augments.js): robots.json arms and legs fitted on a Billie: the data and
// data-checks' rules for it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const C = modules['data-checks'];

test('augments: the game data passes dataGenes; planted Augment mistakes are named', () => {
  assert.deepEqual(C.dataGenes(GAME_DATA), []);
  const G = structuredClone(GAME_DATA.genes);
  G.augment.field.nope = 'surf';
  G.augment.field.hydrant = 'fly';
  G.augment.levels[1].maxUp = 0;
  G.augment.price.up = [1];
  const got = C.dataGenes({ ...GAME_DATA, genes: G }).map(p => p[1].split(':')[0]);
  assert.ok(got.includes('augment.field.nope'), got.join(' | '));
  assert.ok(got.includes('augment.field.hydrant'));
  assert.ok(got.includes('augment.levels[1]'));
  assert.ok(got.includes('augment.price.up'));
});
