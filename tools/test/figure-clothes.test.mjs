// Characters track CH-5b: clothes as data (game/data/figureKit.json clothes, pieces and flair, read by
// game/js/logic/figure-kit.js lookFigure through logic/kit-shapes.js)
import './figure-kit-data.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { figureKitData, lookFigure } from '../../game/js/logic/figure-kit.js';

const W = JSON.parse(readFileSync(new URL('../../game/data/wardrobe.json', import.meta.url), 'utf8'));
const CHOSEN = JSON.parse(readFileSync(new URL('../../game/data/people/chosen.json', import.meta.url), 'utf8'));
const KIT = figureKitData();
const clone = o => JSON.parse(JSON.stringify(o));
const SLOTS = ['top', 'outer', 'bottom', 'shoes'];
const wearing = (wear, o = {}) =>
  lookFigure({ ...CHOSEN.look, wear: { ...CHOSEN.look.wear, ...wear } }, W.items, { name: 'c', ...o });
const ids = F => F.parts.map(p => p.id);

test('clothes: every wardrobe top, outer, bottom and shoe has its clothes; every garment is one', () => {
  for (const [id, it] of Object.entries(W.items))
    if (SLOTS.includes(it.slot)) assert.ok(KIT.clothes[id], `${id} has no clothes in figureKit.json`);
  for (const id of Object.keys(KIT.clothes))
    if (id !== 'note') assert.ok(SLOTS.includes(W.items[id] && W.items[id].slot), `${id} is clothes`);
});

test('clothes: every garment builds on every build, with numbers everywhere', () => {
  for (const build of Object.keys(KIT.builds))
    for (const id of Object.keys(KIT.clothes)) {
      if (id === 'note') continue;
      const F = wearing({ [W.items[id].slot]: id }, { figure: { build }, flair: { detail: true } });
      assert.ok(!JSON.stringify(F.parts).includes('null'), `${id} on ${build}`);
      assert.ok(
        F.parts.every(p => p.parent < F.parts.indexOf(p)),
        `${id} on ${build}: a part before its parent`
      );
    }
});

test('clothes: the knobs dress the body’s own parts', () => {
  const col = (F, id) => F.parts.find(p => p.id === id).col;
  /* sleeves: a tank's bare arms, a long sleeve's, a jacket's over either */
  assert.deepEqual(
    [col(wearing({ top: 'tank', outer: null }), 'armA'), col(wearing({ top: 'tank', outer: null }), 'forearmA')],
    ['skin', 'skin']
  );
  assert.deepEqual(
    [col(wearing({ top: 'tee', outer: null }), 'armA'), col(wearing({ top: 'tee', outer: null }), 'forearmA')],
    ['top', 'skin']
  );
  assert.equal(col(wearing({ top: 'longsleeve', outer: null }), 'forearmA'), 'top');
  assert.equal(col(wearing({ top: 'tank', outer: 'blazer' }), 'forearmA'), 'outer');
  assert.equal(col(wearing({ top: 'tank', outer: 'apron' }), 'armA'), 'skin', 'the apron covers no arm');
  /* legs: a skirt's bare legs, shorts' bare shins */
  assert.equal(col(wearing({ bottom: 'skirt' }), 'thighA'), 'skin');
  assert.deepEqual(
    [col(wearing({ bottom: 'shorts' }), 'thighA'), col(wearing({ bottom: 'shorts' }), 'shinA')],
    ['pants', 'skin']
  );
  /* shoes: a sandal's bare foot, boots up the shin */
  assert.equal(col(wearing({ shoes: 'sandals' }), 'footA'), 'skin');
  assert.ok(ids(wearing({ shoes: 'boots' })).includes('bootA'));
  assert.ok(!ids(wearing({ shoes: 'sneakers' })).includes('bootA'));
});

test('clothes: the rules between garments: the collar under no jacket, the belt under no long coat', () => {
  assert.ok(ids(wearing({ top: 'tee', outer: null })).includes('collar'));
  assert.ok(!ids(wearing({ top: 'tee', outer: 'blazer' })).includes('collar'));
  assert.ok(ids(wearing({ top: 'tee', outer: 'apron' })).includes('collar'));
  assert.ok(ids(wearing({ bottom: 'jeans', outer: 'blazer' })).includes('belt'));
  assert.ok(!ids(wearing({ bottom: 'jeans', outer: 'labcoat' })).includes('belt'));
  assert.ok(!ids(wearing({ bottom: 'skirt', outer: null })).includes('belt'));
  /* an item of another slot worn as an outer (Chad's track top) dresses by its `outer` */
  assert.ok(ids(wearing({ outer: 'track_top' })).includes('jacket'));
  assert.ok(!ids(wearing({ top: 'track_top', outer: null })).includes('jacket'));
  /* the parts keep today's order: the track stripes side by side */
  const T = ids(wearing({ bottom: 'track_pants' })).filter(x => /stripe/.test(x));
  assert.deepEqual(T, ['tstripeA', 'sstripeA', 'tstripeB', 'sstripeB']);
});

test('clothes: an edit to the data is what the figure wears; an unknown item dresses as the kit’s default', () => {
  const kit = clone(KIT);
  kit.clothes.tee.sleeves = 'long';
  kit.clothes.tee.rows = [
    {
      id: 'patch',
      parent: 'torso',
      at: [0, '0.2 * tk', 'trz3'],
      shape: { kind: 'ellipsoid', c: [0, 0, 0], r: [0.04, 0.04, 0.02] },
      col: 'top2',
    },
  ];
  kit.pieces.collar.rows[0].shape.r = 0.03;
  const F = wearing({ top: 'tee', outer: null }, { kit });
  assert.equal(F.parts.find(p => p.id === 'forearmA').col, 'top');
  assert.ok(ids(F).includes('patch'));
  assert.equal(
    F.parts.find(p => p.id === 'collar').shape.r,
    0.03,
    'a piece edited once, for every garment that uses it'
  );
  /* a top the kit has no clothes for is a tee; an outer a plain covering one */
  const items = { ...W.items, mystery: { slot: 'top', colors: [] }, cloak: { slot: 'outer', colors: [] } };
  const U = lookFigure({ ...CHOSEN.look, wear: { ...CHOSEN.look.wear, top: 'mystery', outer: 'cloak' } }, items, {
    name: 'c',
  });
  assert.equal(U.parts.find(p => p.id === 'forearmA').col, 'outer');
  assert.ok(!ids(U).includes('jacket'));
});
