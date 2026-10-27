// Studio track ST-1: the Studio's pane sizes (game/js/logic/studio-layout.js): width classes, limits, the saved
// layout read back from anything, presets. SA-4: the sidebar's workspaces.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from './load-logic.mjs';
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
  assert.equal(L.layoutRead('{"preset":"custom"}').preset, 'auto');
});

test('a preset sets every section and clears the per-section sizes', () => {
  const lay = L.layoutRead(JSON.stringify({ sizes: { moves: { 'list-w': 500 } }, sec2: 'moves' }));
  assert.deepEqual(L.layoutSizes(lay, 'moves'), { 'list-w': 500 });
  const u = L.layoutPreset(lay, 'ultrawide');
  assert.deepEqual(u.sizes, {});
  assert.equal(u.sec2, 'moves', 'the second section is kept');
  assert.deepEqual(L.layoutSizes(u, 'moves'), L.LAYOUT_PRESETS.ultrawide.sizes);
  assert.equal(L.layoutPreset(lay, 'split').split, 0.5);
  assert.ok(L.layoutAdjusted(lay));
  assert.ok(!L.layoutAdjusted(u));
  assert.ok(L.layoutAdjusted({ ...u, nav: 300 }));
  assert.equal(L.layoutPreset(lay, 'nope'), lay);
  for (const [id, P] of Object.entries(L.LAYOUT_PRESETS))
    for (const [k, v] of Object.entries(P.sizes))
      assert.equal(L.layoutClamp(k, v), v, `${id} ${k} is inside its limits`);
});

/* SA-4: the section keys as studio/js/studio-app.js's SECTION_LIST names them (the page's module needs a DOM) */
const appText = readFileSync(join(ROOT, 'studio', 'js', 'studio-app.js'), 'utf8'),
  listText = appText.slice(
    appText.indexOf('export const SECTION_LIST'),
    appText.indexOf('];', appText.indexOf('export const SECTION_LIST'))
  ),
  KEYS = [...listText.matchAll(/\[\s*'(\w+)',\s*'([^']*)'/g)].map(m => m[1]),
  NAMES = Object.fromEntries([...listText.matchAll(/\[\s*'(\w+)',\s*'([^']*)'/g)].map(m => [m[1], m[2]]));

test('every section is in exactly one workspace, and every workspace key is a section', () => {
  assert.ok(KEYS.length >= 30, `read ${KEYS.length} sections from SECTION_LIST`);
  const seen = L.STUDIO_WORKSPACES.flatMap(w => w[1]);
  assert.deepEqual([...new Set(seen)].length, seen.length, 'no section in two workspaces');
  assert.deepEqual(
    KEYS.filter(k => !seen.includes(k)),
    [],
    'no section left for More'
  );
  assert.deepEqual(
    seen.filter(k => !KEYS.includes(k)),
    [],
    'no workspace names a missing section'
  );
  const names = L.STUDIO_WORKSPACES.map(w => w[0]);
  assert.equal(new Set(names).size, names.length, 'workspace names are unique');
  assert.ok(!names.includes('Moneys'), 'the Moneys group is gone');
  for (const [t, ks] of L.STUDIO_WORKSPACES) assert.ok(ks.length, `${t} is not empty`);
  assert.deepEqual(names, ['Game', 'Art', 'Creatures', 'World', 'People & story', 'Runs', 'Sound & UI', 'Legacy']);
  assert.equal(L.workspaceOf('robots'), 'Runs', 'robots are in Runs (bots are the enemy faction)');
  assert.equal(L.workspaceOf('items'), 'Runs');
  assert.equal(L.workspaceOf('nope'), 'More');
});

test('the sidebar rows: Looks and Wardrobe are one Characters row, unknown keys are skipped, the rest is More', () => {
  const rows = L.navRows(KEYS),
    ppl = rows.find(w => w[0] === 'People & story')[1];
  assert.deepEqual(
    ppl.map(r => r.name || r.key),
    ['trainers', 'Characters', 'lore', 'story']
  );
  assert.deepEqual(ppl[1].keys, ['people', 'wardrobe']);
  assert.equal(ppl[1].key, 'people', 'the row opens its first section');
  assert.ok(!rows.some(w => w[0] === 'More'), 'no More with every section placed');
  assert.equal(L.navJoined('wardrobe').name, 'Characters');
  assert.equal(L.navJoined('rules'), null);
  /* a section no workspace names goes under More; a workspace with no known section is left out */
  const r2 = L.navRows(['rules', 'wardrobe', 'extra']);
  assert.deepEqual(
    r2.map(([t, R]) => [t, R.map(r => r.keys)]),
    [
      ['Game', [['rules']]],
      ['People & story', [['wardrobe']]],
      ['More', [['extra']]],
    ]
  );
});

test('the labels say what they are (SA-4)', () => {
  assert.equal(NAMES.parts, 'Part rules', 'T6.8: "Parts" says it holds the size rules');
  assert.equal(NAMES.relics, 'Perks');
  assert.equal(NAMES.people, 'Looks');
  assert.equal(NAMES.wardrobe, 'Wardrobe');
});
