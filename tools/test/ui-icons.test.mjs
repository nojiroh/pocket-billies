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

test('the 91 icons: names in the code’s style, each a 36 x 36 picture in the pixel format', () => {
  /* a new icon (the Studio's New icon) raises this count on purpose; UI-13: 26 glyphs (g-*); UI-8c: 12 place icons and badges (node-*); UI-18: more (the Map's ⋯ menu); SY-3: bureau */
  assert.equal(NAMES.length, 91);
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

test('UI-13: HP’s heart is teal, like its bar (the icon set’s teal and its shades, no red left)', () => {
  const px = modules['svg-pixels'].svgToPixels(readFileSync(join(UI, 'heart.svg'), 'utf8'));
  const seen = new Set();
  for (let i = 0; i < px.data.length; i += 4)
    if (px.data[i + 3] >= 128) seen.add([0, 1, 2].map(k => px.data[i + k].toString(16).padStart(2, '0')).join(''));
  assert.deepEqual([...seen].sort(), ['1f5e4f', '216b5c', '2a9d8f', '94cec7', 'cae6e3']);
});

test('UI-13: the marks’ glyphs: each in UI_GLYPHS exists, is one colour (a mask: only its shape counts) and is tinted by a colour code id', () => {
  const { UI_GLYPHS, UI_SIGNAL_IDS } = modules.signals;
  const named = new Set();
  for (const [group, marks] of Object.entries(UI_GLYPHS))
    for (const [id, [icon, tone]] of Object.entries(marks)) {
      named.add(icon);
      assert.ok(NAMES.includes(icon), `${group}.${id}: no icon "${icon}"`);
      assert.ok(tone === '' || UI_SIGNAL_IDS.includes(tone), `${group}.${id}: no colour code "${tone}"`);
      const px = modules['svg-pixels'].svgToPixels(readFileSync(join(UI, `${icon}.svg`), 'utf8'));
      const cols = new Set();
      for (let i = 0; i < px.data.length; i += 4)
        if (px.data[i + 3] >= 128) cols.add(px.data[i] * 65536 + px.data[i + 1] * 256 + px.data[i + 2]);
      assert.equal(cols.size, 1, `${icon}: ${cols.size} colours`);
    }
  // every glyph file is a mark's, and a glyph's name says it is one
  assert.deepEqual(NAMES.filter(n => n.startsWith('g-')).sort(), [...named].sort());
  // the groups Part 2 names: the three statuses, Sandstorm among the short effects, the eight families
  assert.deepEqual(Object.keys(UI_GLYPHS.status).sort(), ['brn', 'par', 'slp']);
  assert.ok(UI_GLYPHS.effect.sandstorm);
  assert.deepEqual(
    Object.keys(UI_GLYPHS.family).sort(),
    UI_SIGNAL_IDS.filter(id => modules.signals.UI_SIGNALS.find(s => s[0] === id)[2] === 'family').sort()
  );
});

test('UI-13: the bolt icon is the storm weather’s alone (Sandstorm and paralysis have their own glyphs)', () => {
  const files = readdirSync(join(ROOT, 'game/js'), { recursive: true }).filter(f => String(f).endsWith('.js'));
  for (const f of files) {
    if (String(f) === 'hooks.js') continue;
    const text = readFileSync(join(ROOT, 'game/js', String(f)), 'utf8');
    assert.doesNotMatch(text, /(?:uiIconHTML|runIcon|runIconURL|uiIconURL)\('bolt'/, String(f));
    // a weather table names it for storms only
    for (const m of text.matchAll(/(\w+): 'bolt'/g)) assert.equal(m[1], 'storm', `${f}: ${m[0]}`);
  }
  assert.deepEqual(modules.signals.glyphOf('effect', 'sandstorm'), ['g-sand', 'caution']);
  assert.equal(modules.signals.glyphOf('status', 'par')[0], 'g-par');
});
