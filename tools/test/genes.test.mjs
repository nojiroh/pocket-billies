// SP-2: Genes (game/data/genes.json, logic/genes.js): the data and data-checks' rules for it, a splice's Stability,
// weight, dominant type, traits and Unstable, and a grafted Billie in the save.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

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
  assert.ok(got.some(w => w === 'kinds'), 'a spliceable tail with no row');
  assert.ok(got.includes('traits.grip.fx[0]'), 'xp is not a Gene row');
  assert.ok(got.includes('parts.eagle_wing.type'));
  assert.ok(got.includes('parts.nothing') && got.includes('parts.nothing.move'));
  assert.ok(got.includes('unstable.fx[0].share'));
  assert.ok(got.includes('stability'));
});
