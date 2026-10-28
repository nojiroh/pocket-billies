// Style track SY-6: the coat's foil in the world (game/js/logic/coat-foil.js; the sprite shader's uFoil)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FOIL_CELL_MS,
  FOIL_HALF,
  FOIL_PERIOD_MS,
  FOIL_SPAN,
  FOIL_SWEEP_MS,
  coatFoil,
  foilBand,
  foilHue,
  foilOn,
} from '../../game/js/logic/coat-foil.js';

const COATS = { midnight: { name: 'Midnight' }, cloud: { name: 'Cloud', form: true } };

test('the foil is off under Reduced motion, with Flashes off, with Graphics Off and at quality level 2 and up', () => {
  assert.equal(foilOn({}), true);
  assert.equal(foilOn({ level: 1 }), true);
  assert.equal(foilOn({ reduced: true }), false);
  assert.equal(foilOn({ flashesOff: true }), false);
  assert.equal(foilOn({ graphicsOff: true }), false);
  assert.equal(foilOn({ level: 2 }), false);
  assert.equal(foilOn({ level: 3 }), false);
});

test('a sweep every 3-4 s, crossing in a fraction of it, on the 24 fps grid', () => {
  assert.ok(FOIL_PERIOD_MS >= 3000 && FOIL_PERIOD_MS <= 4000);
  assert.ok(FOIL_SWEEP_MS < FOIL_PERIOD_MS / 2);
  let on = 0;
  const seen = new Set();
  for (let t = 0; t < FOIL_PERIOD_MS; t += 5) {
    const b = foilBand(t, 'x');
    if (b == null) continue;
    on++;
    seen.add(b);
  }
  const share = on / (FOIL_PERIOD_MS / 5);
  assert.ok(Math.abs(share - FOIL_SWEEP_MS / FOIL_PERIOD_MS) < 0.03, 'on for the sweep only');
  assert.ok(seen.size <= Math.ceil(FOIL_SWEEP_MS / FOIL_CELL_MS) + 1, 'one place per 24 fps cell');
  assert.ok(seen.size >= 10, 'it moves');
  assert.equal(foilBand(NaN), null);
});

test('the band starts and ends off the picture and moves one way', () => {
  const at = [];
  for (let t = 0; t < FOIL_PERIOD_MS * 2; t += FOIL_CELL_MS / 2) {
    const b = foilBand(t, 7);
    if (b != null) at.push(b);
    else if (at.length) break;
  }
  assert.ok(at.length > 5);
  assert.ok(at[0] - FOIL_HALF < 0.05, 'starts at the edge');
  assert.ok(at[at.length - 1] + FOIL_HALF > FOIL_SPAN - 0.1, 'ends past the far edge');
  for (let i = 1; i < at.length; i++) assert.ok(at[i] >= at[i - 1]);
});

test('Billies are spread out: two seeds do not sweep together', () => {
  let same = 0;
  for (let t = 0; t < FOIL_PERIOD_MS; t += 50) if ((foilBand(t, 'a') == null) === (foilBand(t, 'b') == null)) same++;
  assert.ok(same < FOIL_PERIOD_MS / 50, 'not in step');
});

test('each coat its own hue turn, between 0.2 and 0.45 of the wheel, the same every time', () => {
  for (const c of ['midnight', 'ember', 'x']) {
    const h = foilHue(c);
    assert.ok(h >= 0.2 && h <= 0.45, c);
    assert.equal(foilHue(c), h);
  }
});

test("coatFoil: only a coat a Billie carries, never a regional form's, never when off", () => {
  let t = 0;
  while (foilBand(t, 'midnight:1') == null) t += FOIL_CELL_MS;
  const f = coatFoil('midnight', COATS, t, 1, true);
  assert.ok(Array.isArray(f) && f.length === 4);
  assert.equal(f[2], FOIL_HALF);
  assert.equal(f[3], foilHue('midnight'));
  assert.equal(coatFoil('midnight', COATS, t, 1, false), null);
  assert.equal(coatFoil(null, COATS, t, 1, true), null);
  assert.equal(coatFoil('cloud', COATS, t, 1, true), null);
  assert.equal(coatFoil('nope', COATS, t, 1, true), null);
});

test('the sprite shader takes uFoil (both programs, the instanced one never sets it)', () => {
  const src = readFileSync(new URL('../../game/js/walk/walk-shaders.js', import.meta.url), 'utf8');
  assert.match(src, /uniform vec4 uFoil;/);
  assert.match(src, /if\(uFoil\.x>0\.\)/);
});
