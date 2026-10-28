// The UI icons (game/art/ui/*.svg) are 36 x 36 fixed-colour pixel art, the "block and split" look. Since SA-2b the
// SVG files are the source (tools/build-ui-icons.py retired, decision 6): the Studio's icon editor paints them and
// writes the same pixel format (game/js/logic/svg-pixels.js). Here: the set, its size and format, and every icon the
// game names exists.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, modules } from './setup-real.mjs';

const UI = join(ROOT, 'game/art/ui');
const NAMES = readdirSync(UI)
  .filter(f => f.endsWith('.svg'))
  .map(f => f.slice(0, -4));

test('the 52 icons: names in the code’s style, each a 36 x 36 picture in the pixel format', () => {
  /* a new icon (the Studio's New icon) raises this count on purpose */
  assert.equal(NAMES.length, 52);
  for (const n of NAMES) {
    assert.match(n, /^[a-z][a-z0-9-]*$/, n);
    const text = readFileSync(join(UI, `${n}.svg`), 'utf8');
    assert.match(text, /^<svg [^>]*viewBox="0 0 36 36"/, n);
    const px = modules['svg-pixels'].svgToPixels(text);
    assert.ok(!px.error, `${n}: ${px.error}`);
  }
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
