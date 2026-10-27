// Studio art track SA-2b: the icons' block shading (game/js/logic/icon-block.js), ported from tools/build-ui-icons.py
// when it retired: each of the 51 grids it drew (tools/test/fixtures/ui-icon-grids.json) shades to the pixels of its
// SVG in game/art/ui.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, modules } from './setup-real.mjs';

const B = modules['icon-block'];
const S = modules['svg-pixels'];
const G = JSON.parse(readFileSync(join(ROOT, 'tools/test/fixtures/ui-icon-grids.json'), 'utf8'));
const hex = (d, i) => '#' + [0, 1, 2].map(k => d[i + k].toString(16).toUpperCase().padStart(2, '0')).join('');

test('every grid the builder drew shades to its icon, pixel for pixel', () => {
  assert.equal(Object.keys(G.icons).length, 51);
  for (const [name, rows] of Object.entries(G.icons)) {
    const hue = G.mono[name] || '';
    const col = ch => (ch === '.' ? '' : /\d/.test(ch) ? B.ICON_RAMPS[hue][+ch - 1] : B.ICON_PALETTE[ch]);
    /* the builder's families: a one-colour icon's digits are one; its letters each their own, even when a letter's
       colour is one of the digits' (so the test keys the grid by letter, not by colour) */
    const front = rows.map(r => [...r].map(ch => (ch === '.' ? '' : ch))),
      keyed = B.iconBlockKeyed(
        front,
        ch => col(ch),
        ch => (/\d/.test(ch) ? 'mono' : ch)
      );
    const px = S.svgToPixels(readFileSync(join(ROOT, `game/art/ui/${name}.svg`), 'utf8'));
    for (let y = 0; y < 36; y++)
      for (let x = 0; x < 36; x++) {
        const i = (y * 36 + x) * 4,
          want = px.data[i + 3] ? hex(px.data, i) : '';
        if (keyed[y][x] !== want) assert.fail(`${name} at ${x},${y}: ${keyed[y][x]} not ${want}`);
      }
  }
});

test('a flat front by colour: a one-colour icon’s shades are one block, other colours get a seam', () => {
  const g = B.ICON_RAMPS.gold,
    front = Array.from({ length: 34 }, () => Array(34).fill(''));
  for (let y = 10; y < 14; y++) for (let x = 10; x < 14; x++) front[y][x] = x < 12 ? g[1] : g[2];
  const mono = B.iconBlock(front, B.iconFamily('gold')),
    plain = B.iconBlock(front);
  assert.equal(mono[12][11], g[1].toUpperCase()); // inside, below the split: full colour, no seam
  assert.equal(plain[12][11], B.iconMix(g[1], '#14200F', 0.35)); // two colours meet: a seam
  assert.equal(mono[14][14], B.iconMix(g[2], '#14200F', 0.4)); // the near block side
  assert.equal(mono[15][15], B.iconMix(g[2], '#14200F', 0.5)); // the far one
  assert.equal(B.iconMix('#000000', '#FFFFFF', 0.5), '#808080'); // 127.5 rounds to even (128)
});
