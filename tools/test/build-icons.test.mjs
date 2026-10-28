// Perks track PK-2: tools/build-icons.mjs, the pictures drawn as the UI icons are (grids in tools/art/icon-grids,
// shaded by logic/icon-block.js, written by logic/svg-pixels.js to game/art/<folder>/<id>.svg).
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  ICON_FOLDERS,
  ROOT,
  iconGridProblems,
  iconGridSvg,
  iconOverlap,
  iconSheetHTML,
  iconSilhouette,
  planIcons,
} from '../build-icons.mjs';

const UI = JSON.parse(readFileSync(join(ROOT, 'tools/test/fixtures/ui-icon-grids.json'), 'utf8'));
const blank = () => Array.from({ length: 34 }, () => '.'.repeat(34));
const box = (/** @type {number} */ x0, /** @type {number} */ x1, ch = 'r') =>
  blank().map((r, y) => (y >= 4 && y < 30 ? r.slice(0, x0) + ch.repeat(x1 - x0) + r.slice(x1) : r));

test('a grid shades to the UI icons’ own SVG text: all 51 the retired builder drew, byte for byte', () => {
  for (const [k, rows] of Object.entries(UI.icons))
    assert.equal(iconGridSvg(rows, UI.mono[k]), readFileSync(join(ROOT, `game/art/ui/${k}.svg`), 'utf8'), k);
});

test('a grid’s problems: size, letters, digits without a hue, an unknown hue, nothing drawn', () => {
  assert.deepEqual(iconGridProblems('ok', box(4, 30)), []);
  assert.deepEqual(iconGridProblems('ok', box(4, 30, '2'), 'red'), []);
  assert.match(iconGridProblems('a', blank().slice(1)).join(), /34 rows, not 33/);
  assert.match(
    iconGridProblems(
      'a',
      blank().map((r, y) => (y ? r : r + '.'))
    ).join(),
    /row 0: 34 letters, not 35/
  );
  assert.match(iconGridProblems('a', box(4, 30, 'Z')).join(), /"Z" is no colour letter/);
  assert.match(iconGridProblems('a', box(4, 30, '2')).join(), /a shade digit without a mono hue/);
  assert.match(iconGridProblems('a', box(4, 30), 'pink').join(), /mono "pink" is not a hue/);
  assert.match(iconGridProblems('a', blank()).join(), /nothing drawn/);
  assert.match(iconGridProblems('Bad-id', box(4, 30)).join(), /lower case/);
});

test('silhouettes: the same shape overlaps 1, a shape and its other half 0', () => {
  const a = iconSilhouette(iconGridSvg(box(2, 32))),
    b = iconSilhouette(iconGridSvg(box(2, 32, 'g'))),
    left = iconSilhouette(iconGridSvg(box(2, 17))),
    right = iconSilhouette(iconGridSvg(box(17, 32)));
  assert.ok(a && b && left && right);
  assert.equal(iconOverlap(a, b), 1, 'colour does not count, only the shape');
  assert.ok(iconOverlap(left, right) < 0.1);
  assert.equal(iconSilhouette('<svg></svg>'), null);
});

test('every grid file in the repository passes --check, and each written SVG passes svgProblem', () => {
  const files = readdirSync(join(ROOT, 'tools/art/icon-grids')).map(f => f.replace(/\.json$/, ''));
  assert.ok(files.includes('perks'));
  for (const f of files) {
    assert.ok(ICON_FOLDERS.includes(f), `${f}.json draws into a folder build-icons knows`);
    const P = planIcons({ folder: f });
    assert.deepEqual(P.problems, [], f);
    assert.deepEqual(P.write, [], `${f}: every picture the data names is written (node tools/build-icons.mjs ${f})`);
  }
});

test('writing: only what the data names, never over an SVG on disk without --force', () => {
  const root = mkdtempSync(join(tmpdir(), 'pb-icons-'));
  try {
    mkdirSync(join(root, 'tools/art/icon-grids'), { recursive: true });
    mkdirSync(join(root, 'game/art/perks'), { recursive: true });
    const icons = { one: box(2, 32), two: box(2, 12, '2') };
    writeFileSync(
      join(root, 'tools/art/icon-grids/perks.json'),
      JSON.stringify({ about: 'test', mono: { two: 'teal' }, icons })
    );
    const named = new Set(['perks/one.svg']);
    let P = planIcons({ folder: 'perks', root, named });
    assert.deepEqual(P.problems, []);
    assert.deepEqual(
      P.write.map(w => w.id),
      ['one']
    );
    assert.deepEqual(P.waiting, ['two'], 'no data names two yet');
    /* the Studio edited it: kept, and said so */
    writeFileSync(join(root, 'game/art/perks/one.svg'), iconGridSvg(box(4, 30)));
    P = planIcons({ folder: 'perks', root, named });
    assert.deepEqual(P.write, []);
    assert.match(P.notes.join(), /one\.svg differs from its grid/);
    P = planIcons({ folder: 'perks', root, named, force: true });
    assert.deepEqual(
      P.write.map(w => w.id),
      ['one']
    );
    assert.equal(P.write[0].svg, iconGridSvg(icons.one));
    /* two grids of one shape */
    writeFileSync(
      join(root, 'tools/art/icon-grids/perks.json'),
      JSON.stringify({ about: 'test', mono: {}, icons: { three: box(2, 32), four: box(2, 32, 'b') } })
    );
    P = planIcons({ folder: 'perks', root, named: new Set() });
    assert.match(P.problems.join(), /three and four: their shapes overlap 100%/);
    assert.match(planIcons({ folder: 'ui', root }).problems.join(), /not an icon folder/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the contact sheet’s page shows each picture at 72, 36 and 18 px, pixelated', () => {
  const svg = iconGridSvg(box(2, 32));
  const h = iconSheetHTML({
    folder: 'perks',
    mode: 'dark',
    items: [{ id: 'one', svg, name: 'One <b>', sub: 'Common · Perk', d: 'Does a thing.', rarity: 'common' }],
  });
  for (const n of [72, 36, 18])
    assert.match(h, new RegExp(`width="${n}" height="${n}" style="image-rendering:pixelated"`));
  assert.match(h, /One &#60;b&#62;/);
  assert.match(h, /#1D2E25/);
});
