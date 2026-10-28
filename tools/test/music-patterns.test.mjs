// Sound track SND-11: the song's fixed lines as pure "what plays at this step" functions (game/js/logic/music-patterns.js),
// which the tracker's `gb` path and its ensembles both read. The gb path's sound itself is held by the fingerprints
// (tools/check-sound.py); these hold the patterns' shapes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  MUSIC_PATTERN_ARP,
  MUSIC_PATTERN_BASS,
  MUSIC_PATTERN_DRUMS,
  musicArpAt,
  musicBassAt,
  musicChordTones,
  musicDrumsAt,
} from '../../game/js/logic/music-patterns.js';

const schema = JSON.parse(readFileSync(new URL('../../game/data/schema/music.schema.json', import.meta.url), 'utf8'));
const major = [0, 2, 4, 5, 7, 9, 11];
/* a song in C major (key 60), I-IV-V-I...: deg as trackerCompose makes it */
const song = (o = {}) => ({
  prog: [0, 3, 4, 0, 0, 3, 4, 0],
  key: 60,
  deg: n => 60 + 12 * Math.floor(n / 7) + major[((n % 7) + 7) % 7],
  ...o,
});
const bar = (f, ...a) => Array.from({ length: 16 }, (_, i) => f(i, ...a));

test('the patterns are the schema’s choices', () => {
  const R = schema.$defs.recipe.properties;
  assert.deepEqual(MUSIC_PATTERN_BASS, R.bass.enum);
  assert.deepEqual(MUSIC_PATTERN_ARP, R.arp.enum);
  assert.deepEqual(MUSIC_PATTERN_DRUMS, R.drums.enum);
});

test('bass: each pattern’s steps, notes and lengths', () => {
  const D = song(),
    at = (style, b = 0) => bar(i => musicBassAt(D, b, i, style));
  /* the root two octaves under the chord: C major's I is 36 */
  assert.deepEqual(
    at('bounce').flatMap((n, i) => (n ? [[i, n.m, n.len]] : [])),
    [
      [0, 36, 3],
      [4, 43, 3],
      [8, 36, 3],
      [12, 43, 3],
    ]
  );
  assert.deepEqual(
    at('gallop').flatMap((n, i) => (n ? [i] : [])),
    [0, 3, 4, 8, 11, 12]
  );
  assert.equal(at('gallop')[4].m, 48);
  assert.deepEqual(
    at('long').flatMap((n, i) => (n ? [[i, n.m, n.len]] : [])),
    [[0, 36, 15]]
  );
  /* the walk goes up IV's chord: F A C D (bar 1) */
  assert.deepEqual(
    at('walk', 1).flatMap(n => (n ? [n.m] : [])),
    [41, 45, 48, 50]
  );
  assert.deepEqual(
    at('drive').flatMap(n => (n ? [n.m] : [])),
    [36, 36, 36, 48, 36, 36, 36, 48]
  );
  /* the pedal sits on the key's flat seventh whatever the chord */
  assert.deepEqual(
    at('pedal', 2).flatMap(n => (n ? [n.m] : [])),
    at('pedal', 0).flatMap(n => (n ? [n.m] : []))
  );
  assert.equal(at('pedal')[0].m, 34);
  assert.ok(at('none').every(n => n === null));
  /* left out, the song's own */
  assert.deepEqual(musicBassAt(song({ bass: 'long' }), 0, 0), { m: 36, len: 15 });
});

test('the chord tones: the triad and the octave, or the seventh; arpOctave lifts them', () => {
  assert.deepEqual(musicChordTones(song(), 0), [60, 64, 67, 72]);
  assert.deepEqual(musicChordTones(song({ seventh: 1 }), 0), [60, 64, 67, 71]);
  assert.deepEqual(musicChordTones(song({ arpOctave: 1 }), 1), [77, 81, 84, 89]);
});

test('arpeggio: four-voice songs thinner than an extra song’s; up and updown the same in both', () => {
  const D = song();
  const notes = (style, four) =>
    bar(i => musicArpAt(D, 0, i, four, style)).flatMap((a, i) => (a ? [[i, a.notes]] : []));
  assert.deepEqual(
    notes('up', true).map(([, n]) => n[0]),
    [72, 76, 79, 84, 72, 76, 79, 84]
  );
  assert.deepEqual(notes('up', false), notes('up', true));
  assert.deepEqual(
    notes('updown', true).map(([, n]) => n[0]),
    [72, 76, 79, 84, 79, 76, 72, 76]
  );
  /* drip: three drops; an extra song's an octave higher */
  assert.deepEqual(
    notes('drip', true).map(([i, n]) => [i, n[0]]),
    [
      [0, 72],
      [6, 79],
      [11, 84],
    ]
  );
  assert.deepEqual(
    notes('drip', false).map(([, n]) => n[0]),
    [84, 91, 96]
  );
  /* chord7: one note an eighth in a four-voice song, a whole chord three times a bar in an extra one */
  assert.equal(notes('chord7', true).length, 8);
  assert.ok(notes('chord7', true).every(([, n]) => n.length === 1));
  assert.deepEqual(
    notes('chord7', false).map(([i, n]) => [i, n.length]),
    [
      [0, 4],
      [6, 4],
      [10, 4],
    ]
  );
  assert.equal(musicArpAt(D, 0, 0, false, 'chord7').len, 5);
  assert.ok(notes('none', true).length === 0 && notes('none', false).length === 0);
});

test('drums: each pattern’s hits in the gb path’s order (kick, snare, hat), every noise with its shape', () => {
  for (const style of MUSIC_PATTERN_DRUMS) {
    const hits = bar(i => musicDrumsAt(style, i)).flat();
    if (style === 'none') assert.equal(hits.length, 0);
    for (const h of hits) {
      assert.ok(h.vol > 0 && h.vol < 1, style);
      if (h.hit !== 'kick') assert.ok(h.gb && h.gb.dur > 0 && (h.gb.hp || h.gb.bp), style + ' ' + h.hit);
    }
  }
  assert.deepEqual(
    musicDrumsAt('skip', 4).map(h => h.hit),
    ['snare', 'hat']
  );
  assert.deepEqual(
    musicDrumsAt('drive', 4).map(h => h.hit),
    ['kick', 'snare', 'hat']
  );
  assert.deepEqual(
    bar(i => musicDrumsAt('bossa', i).map(h => h.hit)).flatMap((h, i) => (h.includes('rim') ? [i] : [])),
    [3, 6, 10, 13]
  );
  assert.equal(musicDrumsAt('march', 15)[0].hit, 'snare');
});
