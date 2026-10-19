// Studio track ST-1: the Studio's pane sizes (game/js/logic/studio-layout.js): width classes, limits, the saved
// layout read back from anything, presets.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const L = modules['studio-layout'];

test('a pane gets its width class from its width', () => {
  assert.equal(L.paneWidthClass(500), 'narrow');
  assert.equal(L.paneWidthClass(900), '');
  assert.equal(L.paneWidthClass(1920 - 232), 'wide');
  assert.equal(L.paneWidthClass(3440 - 232), 'ultra');
});

test('a dragged size stays inside its limits and the room there is', () => {
  assert.equal(L.layoutClamp('list-w', 50), 180);
  assert.equal(L.layoutClamp('list-w', 5000), 720);
  assert.equal(L.layoutClamp('list-w', 333.6), 334);
  assert.equal(L.layoutClamp('list-w', 600, 400), 400);
  assert.equal(L.layoutClamp('list-w', 600, 100), 180, 'never below the smallest, even with no room');
  assert.equal(L.layoutClamp('split', 0.95), 0.8);
  assert.equal(L.layoutClamp('nope', 300), null);
  assert.equal(L.layoutClamp('nav-w', NaN), null);
});

test('the saved layout is read back from anything without throwing', () => {
  for (const t of [null, '', 'not json', '42', '[]', '{"sizes":7}', '{"sizes":{"x":null}}'])
    assert.deepEqual(L.layoutRead(t), L.layoutEmpty(), String(t));
  const got = L.layoutRead(
    JSON.stringify({
      nav: 999,
      split: 0.4,
      sec2: 'moves',
      preset: 'wide',
      sizes: { billionaires: { 'list-w': 400, 'side-w': 'x', junk: 1 }, '<b>': { 'list-w': 300 } },
    })
  );
  assert.deepEqual(got, {
    nav: 420,
    split: 0.4,
    sec2: 'moves',
    preset: 'wide',
    sizes: { billionaires: { 'list-w': 400 } },
  });
  assert.equal(L.layoutRead('{"preset":"nope"}').preset, 'auto');
  assert.equal(L.layoutRead('{"preset":"custom"}').preset, 'custom');
});

test('a preset sets every section and clears the per-section sizes', () => {
  const lay = L.layoutRead(JSON.stringify({ sizes: { moves: { 'list-w': 500 } }, sec2: 'moves' }));
  assert.deepEqual(L.layoutSizes(lay, 'moves'), { 'list-w': 500 });
  const u = L.layoutPreset(lay, 'ultrawide');
  assert.deepEqual(u.sizes, {});
  assert.equal(u.sec2, 'moves', 'the second section is kept');
  assert.deepEqual(L.layoutSizes(u, 'moves'), L.LAYOUT_PRESETS.ultrawide.sizes);
  assert.equal(L.layoutPreset(lay, 'split').split, 0.5);
  assert.equal(L.layoutPreset(lay, 'nope'), lay);
  for (const [id, P] of Object.entries(L.LAYOUT_PRESETS))
    for (const [k, v] of Object.entries(P.sizes))
      assert.equal(L.layoutClamp(k, v), v, `${id} ${k} is inside its limits`);
});
