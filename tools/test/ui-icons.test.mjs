// The UI icons (game/art/ui/*.svg) are 36 x 36 fixed-colour pixel art drawn as grids in tools/build-ui-icons.py
// (the "block and split" look); each SVG must be what its grid makes, and every icon the game names must exist.
// Remake the files with `python3 tools/build-ui-icons.py`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = join(import.meta.dirname, '../..');
const TOOL = join(ROOT, 'tools/build-ui-icons.py');
const NAMES = [...readFileSync(TOOL, 'utf8').matchAll(/^ {4}'([a-z-]+)': \[$/gm)].map(m => m[1]);

test('every icon file is what its grid in tools/build-ui-icons.py makes', () => {
  assert.equal(NAMES.length, 51);
  const r = spawnSync('python3', [TOOL, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('every icon is a 36 x 36 picture and the tool draws every file in game/art/ui', () => {
  const files = readdirSync(join(ROOT, 'game/art/ui'))
    .filter(f => f.endsWith('.svg'))
    .map(f => f.slice(0, -4));
  assert.deepEqual(files.sort(), [...NAMES].sort());
  for (const n of NAMES)
    assert.match(readFileSync(join(ROOT, `game/art/ui/${n}.svg`), 'utf8'), /^<svg [^>]*viewBox="0 0 36 36"/, n);
});

test('the icons the game names by key all exist', () => {
  const used = new Set();
  /* UI-5: every game script, so a screen moved out of ui.js stays covered */
  const files = readdirSync(join(ROOT, 'game/js'), { recursive: true }).filter(f => String(f).endsWith('.js'));
  for (const f of files)
    for (const m of readFileSync(join(ROOT, 'game/js', String(f)), 'utf8').matchAll(
      /(?:uiIconHTML|runIcon)\('([a-z-]+)'/g
    ))
      used.add(m[1]);
  assert.ok(used.size > 20, `only ${used.size} icons found`);
  for (const k of used) assert.ok(NAMES.includes(k), `no icon "${k}"`);
});
