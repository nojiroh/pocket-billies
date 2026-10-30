// Assets track AS-0: every biome's flora layers (game/data/biomes.json) grow on the game's own data: each layer
// places points, only of kinds from the list it names, all of them real props (scenery.json).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { scatterFlora } from '../../game/js/logic/scatter.js';

const read = f => JSON.parse(readFileSync(new URL(`../../game/data/${f}`, import.meta.url), 'utf8'));
const biomes = read('biomes.json'),
  props = read('scenery.json').props;

test('every biome has flora, and each layer grows its own real kinds on a 48 m square', () => {
  for (const [b, B] of Object.entries(biomes)) {
    assert.ok(B.flora && B.flora.length, `${b}: no flora`);
    const pts = scatterFlora(B, { w: 48, h: 48, seed: `real-${b}` });
    for (const L of B.flora) {
      const mine = pts.filter(p => p.layer === L.layer);
      assert.ok(mine.length > 0, `${b}.${L.layer}: nothing grew`);
      for (const p of mine) {
        assert.ok(Object.hasOwn(B[L.from], p.id), `${b}.${L.layer}: ${p.id} is not in its ${L.from}`);
        assert.ok(props[p.id], `${b}.${L.layer}: no prop ${p.id}`);
      }
    }
  }
});
