// Sound track SND-3: a Billy's cry (game/js/logic/cries.js): set by its species or made from its id as before.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cryHash, cryLowHealth, cryRecipe, cryVoices } from '../../game/js/logic/cries.js';

const BASES = JSON.parse(readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8')).cries.bases;

test('with nothing set, a cry is what the id made before: base, pitch and slide from its hash', () => {
  for (const id of ['bezos0', 'musk2', 'swift1']) {
    const h = cryHash(id),
      C = cryRecipe(id, null, BASES);
    assert.equal(C.wave, BASES[h % BASES.length].wave);
    assert.equal(C.pitch, 48 + (h % 24));
    assert.equal(C.slide, 1.5 + (h % 5) * 0.2);
    assert.equal(C.length, 1);
  }
});

test('a species sets base, pitch and length; a base that does not exist is passed over', () => {
  const C = cryRecipe('bezos0', { base: 3, pitch: 60, length: 1.5 }, BASES);
  assert.deepEqual([C.base, C.wave, C.pitch, C.length], [3, BASES[3].wave, 60, 1.5]);
  assert.equal(cryRecipe('bezos0', { base: 99 }, BASES).base, cryHash('bezos0') % BASES.length);
  assert.equal(cryRecipe('bezos0', { pitch: 50 }, BASES).pitch, 50);
});

test('the voices: the base sliding up, then a pulse a fourth up; length stretches both', () => {
  const V = cryVoices({ wave: 'p12', pitch: 60, length: 2, slide: 1.7 });
  assert.deepEqual(
    V.map(v => [v.at, v.type, v.midi, v.dur]),
    [
      [0, 'p12', 60, 0.36],
      [0.34, 'p25', 65, 0.4],
    ]
  );
  const L = cryLowHealth({ wave: 'p12', pitch: 60, length: 1, slide: 1.7 });
  assert.ok(L.pitch < 60 && L.length > 1 && L.slide < 1);
});
