// UI-2: the UI icons (game/art/ui/*.svg) are drawn as 12 x 12 grids in tools/build-ui-icons.py; each SVG must be
// what its grid makes, and every icon the game names must exist. Remake the files with
// `python3 tools/build-ui-icons.py`.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = join(import.meta.dirname, '../..');
const SRC = readFileSync(join(ROOT, 'tools/build-ui-icons.py'), 'utf8');
const ICONS = Object.fromEntries(
  [...SRC.matchAll(/ {4}'([a-z]+)': \[\n((?: {8}'[.#]{12}',\n){12}) {4}\]/g)].map(m => [
    m[1],
    [...m[2].matchAll(/'([.#]{12})'/g)].map(r => r[1]),
  ])
);
/** the same SVG the Python tool writes */
const svgOf = rows => {
  let d = '';
  rows.forEach((row, y) => {
    for (const m of row.matchAll(/#+/g)) d += `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" shape-rendering="crispEdges"><path d="${d}" fill="#000"/></svg>\n`;
};

test('every icon file is what its grid in tools/build-ui-icons.py makes', () => {
  assert.equal(Object.keys(ICONS).length, 47);
  for (const [name, rows] of Object.entries(ICONS))
    assert.equal(readFileSync(join(ROOT, `game/art/ui/${name}.svg`), 'utf8'), svgOf(rows), name);
});

test('the icons the game names by key all exist', () => {
  const used = new Set();
  /* UI-5: every game script, so a screen moved out of ui.js stays covered */
  const files = readdirSync(join(ROOT, 'game/js'), { recursive: true }).filter(f => String(f).endsWith('.js'));
  for (const f of files)
    for (const m of readFileSync(join(ROOT, 'game/js', String(f)), 'utf8').matchAll(/uiIconHTML\('([a-z]+)'/g))
      used.add(m[1]);
  assert.ok(used.size > 20, `only ${used.size} icons found`);
  for (const k of used) assert.ok(ICONS[k], `no icon "${k}"`);
});
