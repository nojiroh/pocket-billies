// Studio plan Phase 5, T5.7: the pixel-density report (logic/pixel-density.js) on the game's data. The world's metres
// per pixel moved there from world-billies.js unchanged; the report covers every species with a rig, kit Billies with
// their parts, and names the part sizes that are not whole numbers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  densityHeights,
  densityKitParts,
  densityReport,
  densityWorld,
  densityWorldMpp,
} from '../../game/js/logic/pixel-density.js';
import { GAME_DATA, logic } from './setup-real.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const src = readFileSync(join(ROOT, 'game/art/next/rigs-next.js'), 'utf8');
const RIGS = JSON.parse(src.slice(src.indexOf('RIGS_NEXT=') + 10).replace(/;\s*$/, ''));
const SPECIES = densityHeights(GAME_DATA.lines);
/* world-billies.js worldBillyMetersPerPixel as it was before the move (the oracle) */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function before(ht, R, big = 1) {
  const h = clamp((ht || 1) * 0.9, 0.6, 2) * big,
    px = Math.max(20, R.geo.base - R.geo.top || R.BH * 0.7),
    m = h / px;
  const r = 1 / (m * 68),
    rq = r >= 1 ? Math.round(r * 4) / 4 : 1 / (Math.round(4 / r) / 4),
    mq = 1 / (rq * 68);
  return Math.abs(mq / m - 1) <= 0.06 ? mq : m;
}

test("densityWorldMpp is the world's metres per pixel, number for number", () => {
  let n = 0;
  for (const [sp, R] of Object.entries(RIGS))
    for (const ht of [undefined, 0.3, 1, 1.7, 3])
      for (const big of [1, 1.4]) {
        assert.equal(densityWorldMpp(ht, R.front.geo, R.front.BH, big), before(ht, R.front, big), `${sp} ${ht} ${big}`);
        n++;
      }
  assert.ok(n > 1000);
});

test("the grid a Billie sits on, and a kit Billie's parts against its torso", () => {
  assert.equal(densityWorld(1, { base: 100, top: 100 - 68 * 0.9 }, 128).grid, 'whole');
  assert.equal(densityWorld(1, { base: 100, top: 100 - 68 * 0.9 * 1.25 }, 128).grid, 'quarter');
  const p = densityKitParts({
    scale: 0.5,
    parts: { torso: ['a', 1, null], head: ['b', 1.5, null] },
    extras: [['c', 'brow', 1.2, null, true]],
  });
  assert.deepEqual(
    p.map(r => [r.what, r.scale, r.vsBody, r.flag]),
    [
      ['torso', 0.5, 1, false],
      ['head', 0.75, 1.5, true],
      ['extra (brow)', 0.6, 1.2, false],
    ]
  );
});

test('the report covers every species with a rig, kit Billies with their parts, and the sizes that are not whole', () => {
  const R = densityReport(GAME_DATA, RIGS, SPECIES);
  assert.equal(R.rows.length, Object.keys(RIGS).filter(sp => SPECIES[sp]).length);
  assert.equal(R.rows.filter(r => r.kit).length, 37);
  for (const r of R.rows)
    assert.ok(r.pxPerM > 20 && r.pxPerM < 400 && ['whole', 'quarter', 'off grid'].includes(r.grid), JSON.stringify(r));
  assert.deepEqual(R.nonInteger, ['S 0.85', 'L 1.2']);
});

test('densityHeights gives each species the height the game gives it (game-data.js SPECIES)', () => {
  let n = 0;
  for (const [sp, s] of Object.entries(logic.SPECIES))
    if (SPECIES[sp]) {
      assert.equal(SPECIES[sp].ht, s.ht, sp);
      n++;
    }
  assert.ok(n >= 20, `${n} species compared`);
});
