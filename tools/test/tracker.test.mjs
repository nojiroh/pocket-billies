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
const { trackerCompose, trackerNight } = /** @type {any} */ (globalThis);

const MUSIC = JSON.parse(readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8'));
const town = MUSIC.songs.town;

test('an empty hook and counter change nothing', () => {
  const a = trackerCompose(town),
    b = trackerCompose({ ...town, hook: [], counter: [] });
  assert.deepEqual(b.notes, a.notes);
  assert.ok(b.counterNotes.every(n => n === null));
});

test('a hook takes bars 1-2 and their repeat in bars 5-6; bars 3-4 answer it; 7-8 stay', () => {
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
  assert.deepEqual(b.notes.slice(96), a.notes.slice(96));
  /* SND-4: bars 3-4 keep the hook's rhythm, each note on the nearest tone of the bar's chord (town: bar 3 is IV, F A C
     in C; bar 4 is V, G B D) */
  assert.deepEqual(at(b, 32, 64), [
    [32, 72, 4],
    [36, 72, 4],
    [40, 77, 8],
    [48, 79, 16],
  ]);
});

test('bars 3-4 answer a hook already on the new chord with the same note; a tie goes down', () => {
  /* town bar 3 is IV (F A C): C stays C; G is as near F as A, and goes down to F */
  const b = trackerCompose({
    ...town,
    hook: [
      [0, 72, 8],
      [8, 67, 8],
    ],
  });
  assert.deepEqual(b.notes[32], [72, 8]);
  assert.deepEqual(b.notes[40], [65, 8]);
});

test('a countermelody sits beside the lead in bars 1-2, answers in 3-4, again in 5-6', () => {
  const b = trackerCompose({ ...town, counter: [[2, 64, 6]] });
  assert.deepEqual(b.counterNotes[2], [64, 6]);
  assert.deepEqual(b.counterNotes[66], [64, 6]);
  assert.equal(b.counterNotes.filter(Boolean).length, 3, 'bars 1-2, the answer in 3-4, the repeat in 5-6');
  assert.deepEqual(b.counterNotes[34], [65, 6], 'E answers on F, the nearest tone of town bar 3 (IV: F A C)');
  assert.deepEqual(b.notes, trackerCompose(town).notes);
  assert.deepEqual(b.counterBars, [true, false, true, false, true, false, false, false]);
});

test('the composer does not change the recipe it is given', () => {
  const R = structuredClone({ ...town, hook: [[0, 72, 4]] });
  trackerCompose(R);
  assert.deepEqual(R, { ...town, hook: [[0, 72, 4]] });
});

test('the night version: written changes win; with none, 8 bpm slower, a fourth down, soft drums', () => {
  const n = trackerNight(town);
  assert.equal(n.bpm, town.bpm - 8);
  assert.equal(n.key, town.key - 5);
  assert.equal(n.drums, 'soft');
  assert.equal('night' in n, false);
  assert.equal(trackerNight({ ...MUSIC.songs.cave, night: undefined }).drums, 'none', 'no drums stay none');
  const w = trackerNight({ ...town, night: { bpm: 90 } });
  assert.equal(w.bpm, 90);
  assert.equal(w.key, town.key, 'a written night changes only what it names');
  assert.equal(trackerNight({ ...town, night: false }), null);
});

test('at night a written hook and counter move with the key', () => {
  const n = trackerNight({ ...town, hook: [[0, 72, 4]], counter: [[0, 64, 4]] });
  assert.deepEqual(n.hook, [[0, 67, 4]]);
  assert.deepEqual(n.counter, [[0, 59, 4]]);
  assert.equal(trackerNight(town).hook, undefined);
});
