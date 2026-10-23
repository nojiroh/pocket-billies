// Sound track SND-3, SND-6: a Billy's cry (game/js/logic/cries.js): a base kind, a pitch and a length, set by its
// species or made from its id.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cryHash, cryLowHealth, cryRecipe, cryVoices } from '../../game/js/logic/cries.js';

const BASES = JSON.parse(readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8')).cries.bases;

const KINDS = Object.keys(BASES);

test('SND-6: eight base cries by kind, each named as a draft until the owner renames it', () => {
  assert.deepEqual(KINDS, ['beast', 'bird', 'slime', 'machine', 'fish', 'insect', 'ghost', 'suit']);
  for (const k of KINDS) assert.ok(BASES[k].voices.length >= 1, k);
});

test('with nothing set, a cry comes from the id: the kind and pitch from its hash', () => {
  for (const id of ['bezos0', 'musk2', 'swift1']) {
    const h = cryHash(id),
      C = cryRecipe(id, null, BASES);
    assert.equal(C.base, KINDS[h % KINDS.length]);
    assert.equal(C.wave, BASES[C.base].wave);
    assert.equal(C.pitch, 48 + (h % 24));
    assert.equal(C.length, 1);
  }
});

test('a species sets base, pitch and length; a base that does not exist is passed over', () => {
  const C = cryRecipe('bezos0', { base: 'ghost', pitch: 60, length: 1.5 }, BASES);
  assert.deepEqual([C.base, C.wave, C.pitch, C.length], ['ghost', BASES.ghost.wave, 60, 1.5]);
  assert.equal(cryRecipe('bezos0', { base: 'dragon' }, BASES).base, KINDS[cryHash('bezos0') % KINDS.length]);
  assert.equal(cryRecipe('bezos0', { pitch: 50 }, BASES).pitch, 50);
});

test("the voices: the base's notes over the species' pitch; length stretches when and how long", () => {
  const B = {
    wave: 'p12',
    voices: [
      { at: 0, note: 0, len: 0.2, slide: 1.5 },
      { at: 0.1, note: 7, len: 0.1, wave: 'p50' },
    ],
  };
  const V = cryVoices(cryRecipe('x', { base: 'k', pitch: 60, length: 2 }, { k: B }));
  assert.deepEqual(
    V.map(v => [v.at, v.type, v.midi, v.dur, v.slide]),
    [
      [0, 'p12', 60, 0.4, 1.5],
      [0.2, 'p50', 67, 0.2, 1],
    ]
  );
  const C = cryRecipe('x', { base: 'k', pitch: 60, length: 1 }, { k: B }),
    L = cryLowHealth(C);
  assert.ok(L.pitch < 60 && L.length !== 1 && L.base === 'k');
});
