// Sound track SND-3: the tracker's composer (game/js/audio/tracker.js trackerCompose) with a written hook and a
// countermelody. With neither, a song composes as before (the fingerprints, tools/check-sound.py, hold the sound).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// the tracker is a page module, not logic: it exports only what pages import, so its composer is read through the
// test globals (game/js/test-globals.js), turned on before it loads
globalThis.window = globalThis;
globalThis.PB_TEST_GLOBALS = true;
await import('../../game/js/audio/tracker.js');
const { trackerCompose } = /** @type {any} */ (globalThis);

const MUSIC = JSON.parse(readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8'));
const town = MUSIC.songs.town;

test('an empty hook and counter change nothing', () => {
  const a = trackerCompose(town),
    b = trackerCompose({ ...town, hook: [], counter: [] });
  assert.deepEqual(b.notes, a.notes);
  assert.ok(b.counterNotes.every(n => n === null));
});

test('a hook takes bars 1-2 and their repeat in bars 5-6; the other bars stay', () => {
  const hook = [
    [0, 72, 4],
    [4, 74, 4],
    [8, 76, 8],
    [16, 79, 16],
    [40, 60, 4],
  ];
  const a = trackerCompose(town),
    b = trackerCompose({ ...town, hook });
  const at = (C, from, to) =>
    C.notes
      .slice(from, to)
      .map((n, i) => (n ? [from + i, ...n] : null))
      .filter(Boolean);
  const want = [
    [0, 72, 4],
    [4, 74, 4],
    [8, 76, 8],
    [16, 79, 16],
  ];
  assert.deepEqual(at(b, 0, 32), want, 'a note past bar 2 is left out');
  assert.deepEqual(
    at(b, 64, 96),
    want.map(([s, m, l]) => [s + 64, m, l])
  );
  assert.deepEqual(b.notes.slice(32, 64), a.notes.slice(32, 64));
  assert.deepEqual(b.notes.slice(96), a.notes.slice(96));
});

test('a countermelody sits beside the lead, in bars 1-2 and 5-6', () => {
  const b = trackerCompose({ ...town, counter: [[2, 64, 6]] });
  assert.deepEqual(b.counterNotes[2], [64, 6]);
  assert.deepEqual(b.counterNotes[66], [64, 6]);
  assert.equal(b.counterNotes.filter(Boolean).length, 2);
  assert.deepEqual(b.notes, trackerCompose(town).notes);
});

test('the composer does not change the recipe it is given', () => {
  const R = structuredClone({ ...town, hook: [[0, 72, 4]] });
  trackerCompose(R);
  assert.deepEqual(R, { ...town, hook: [[0, 72, 4]] });
});
