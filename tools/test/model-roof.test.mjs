// HB-5: a placed roof style (roof: moss, solar or chrome) recolours a model's roof parts (roof: 1) and hides its roof
// dressing (roof: 2, a cottage's moss tufts); a colour swap (a variant) changes the matching colours only.
import assert from 'node:assert/strict';
import { test } from 'node:test';

await import('./walk-renderer.mjs');
await import('../../game/js/prop-models.js');
/* not exported: the test globals (walk-renderer.mjs asks for them) */
const { swappedRecipe } = /** @type {any} */ (globalThis);

const REC = {
  ppm: 32,
  layers: [
    { k: 'box', name: 'walls', col: '#F2DCA0', tex: 'plaster' },
    { k: 'dome', name: 'roof', col: '#76AA50', tex: 'leaves', roof: 1 },
    { k: 'sphere', name: 'moss tuft', col: '#6E9E4C', tex: 'leaves', roof: 2 },
  ],
};

test('a roof style recolours roof parts and hides roof dressing', () => {
  const out = swappedRecipe('test:roof#solar', REC, { '@roof': { col: '#3A4C7E', tex: 'solar' } });
  assert.deepEqual(
    out.layers.map(l => [l.col, l.tex, !!l.hide]),
    [
      ['#F2DCA0', 'plaster', false],
      ['#3A4C7E', 'solar', false],
      ['#6E9E4C', 'leaves', true],
    ]
  );
});

test('a colour swap alone keeps the roof and its dressing', () => {
  const out = swappedRecipe('test:roof#v1', REC, { '#f2dca0': '#C8DCEC' });
  assert.deepEqual(
    out.layers.map(l => [l.col, !!l.hide]),
    [
      ['#C8DCEC', false],
      ['#76AA50', false],
      ['#6E9E4C', false],
    ]
  );
});
