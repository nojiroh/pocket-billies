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
  musicChordNear,
  musicEnsembleFit,
  musicEnsembleNeeds,
  musicEnsembleStep,
  MUSIC_JINGLE_KIT,
  musicJingleNeeds,
  musicJingleParts,
  musicJingleTune,
  musicStingerAt,
  musicStingerShift,
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

/* SND-11: what an ensemble's parts play */
const composed = (o = {}) => {
  const D = song({ bass: 'gallop', arp: 'up', drums: 'skip', ...o }),
    steps = 128,
    notes = new Array(steps).fill(null);
  for (let st = 0; st < steps; st += 4) notes[st] = [72 + (st % 8), 2];
  return {
    ...D,
    steps,
    notes,
    counterNotes: new Array(steps).fill(null),
    introNotes: [[76, 1], null, [74, 1]],
    introSteps: 3,
  };
};
const ENS = {
  parts: [
    { line: 'lead', wave: 'p25' },
    { line: 'lead', inst: 'musicbox', oct: 1, level: 0.5 },
    { line: 'bass', inst: 'pizz' },
    { line: 'pad', inst: 'strings' },
    { line: 'drums', kit: { kick: 'kick', snare: 'osnare' } },
    { line: 'timp', inst: 'timpani' },
  ],
};
const INST = {
  musicbox: { lo: 60, hi: 103 },
  pizz: { lo: 31, hi: 91 },
  strings: { lo: 36, hi: 96 },
  kick: { lo: 60, hi: 60 },
  osnare: { lo: 60, hi: 60 },
  timpani: { lo: 36, hi: 60 },
};

test('ensembles: a note fits its instrument by octaves; a chord sits close round its centre', () => {
  assert.equal(musicEnsembleFit(24, { lo: 36, hi: 60 }), 36);
  assert.equal(musicEnsembleFit(84, { lo: 36, hi: 60 }), 60);
  assert.equal(musicEnsembleFit(50, undefined), 50);
  const C = musicChordNear(song(), 1, 62);
  assert.deepEqual(C, [57, 60, 65]);
  assert.ok(C.every(m => Math.abs(m - 62) <= 6));
});

test('ensembles: each part plays its line; the intro is the lead parts alone; held drums wait', () => {
  const D = composed(),
    at = (st, o) => musicEnsembleStep(D, ENS, st, { instruments: INST, ...o });
  const s0 = at(0);
  assert.deepEqual(
    s0.filter(n => n.part === 0).map(n => [n.m, n.wave]),
    [[72, 'p25']]
  );
  assert.deepEqual(
    s0.filter(n => n.part === 1).map(n => n.m),
    [84],
    'the music box an octave up'
  );
  assert.ok(Math.abs(s0.find(n => n.part === 1).vel - 0.08) < 1e-9, 'its level halves the lead’s velocity');
  assert.equal(s0.filter(n => n.part === 3).length, 3, 'the pad: the bar’s chord');
  assert.ok(s0.some(n => n.hit === 'kick' && n.inst === 'kick'));
  assert.ok(!at(4).some(n => n.part === 4 && n.hit === 'hat'), 'a hit the kit lacks plays nothing');
  assert.ok(at(4).some(n => n.inst === 'osnare'));
  assert.ok(!at(0, { held: true }).some(n => n.hit), 'held: no drums');
  /* the timpani: the root on bars 1 and 5, a roll in the last half bar */
  assert.equal(at(0).filter(n => n.part === 5).length, 1);
  assert.equal(at(16).filter(n => n.part === 5).length, 0);
  assert.ok(at(7 * 16 + 15).find(n => n.part === 5).vel > at(7 * 16 + 8).find(n => n.part === 5).vel);
  /* the intro (steps -3..-1) */
  assert.deepEqual(
    at(-3).map(n => [n.part, n.m]),
    [
      [0, 76],
      [1, 88],
    ]
  );
  assert.deepEqual(at(-2), []);
});

test('ensembles: the needs are every baked note the song plays, intro included, and nothing for a chip part', () => {
  const N = musicEnsembleNeeds(composed(), ENS, INST);
  assert.deepEqual(Object.keys(N).sort(), ['kick', 'musicbox', 'osnare', 'pizz', 'strings', 'timpani']);
  assert.ok(N.musicbox.includes(88), 'the intro’s note');
  assert.deepEqual(N.kick, [60]);
  assert.ok(N.timpani.every(m => m >= 36 && m <= 60));
});

/* ---------- SND-17: jingles on an ensemble ---------- */
const jingle = {
  notes: [
    [72, 2],
    [0, 2],
    [79, 4],
  ],
  harmony: [
    [0, 60, 4],
    [0, 64, 4],
    [0, 67, 4],
  ],
  bass: [[0, 48, 8]],
  perc: [
    [0, 36, 1],
    [2, 38, 1],
    [4, 50, 4],
    [6, 41, 1],
  ],
};
const parts = lines => ({ parts: lines.map(l => (typeof l === 'string' ? { line: l, inst: 'harp' } : l)) });

test('SND-17: a jingle on a timeline: rests left out, steps counted', () => {
  assert.deepEqual(musicJingleTune(jingle.notes), [
    [0, 72, 2],
    [4, 79, 4],
  ]);
});

test("SND-17: each part reads its line of the jingle: the tune, the harmony held, short or broken upward, the bass, the perc's kit and timpani notes", () => {
  const E = parts([
    'lead',
    'counter',
    'pad',
    'stabs',
    'arp',
    'bass',
    { line: 'timp', inst: 'timpani' },
    { line: 'drums', kit: { kick: 'kick', snare: 'snare' } },
  ]);
  const { notes, steps } = musicJingleParts(jingle, E);
  const of = p => notes.filter(N => N.part === p).map(N => [N.at, N.m, N.len]);
  assert.deepEqual(of(0), [
    [0, 72, 2],
    [4, 79, 4],
  ]);
  assert.deepEqual(of(1), of(0));
  assert.deepEqual(of(2), jingle.harmony);
  assert.deepEqual(
    of(3),
    jingle.harmony.map(([a, m]) => [a, m, 1.6])
  );
  /* the chord C E G for 4 steps: C E G and C an octave up */
  assert.deepEqual(of(4), [
    [0, 60, 2],
    [1, 64, 2],
    [2, 67, 2],
    [3, 72, 2],
  ]);
  assert.deepEqual(of(5), [[0, 48, 8]]);
  /* the timpani skips the kit's notes (36, 38) and plays the others */
  assert.deepEqual(of(6), [
    [4, 50, 4],
    [6, 41, 1],
  ]);
  assert.deepEqual(
    notes.filter(N => N.part === 7).map(N => [N.at, N.inst, N.hit]),
    [
      [0, 'kick', 'kick'],
      [2, 'snare', 'snare'],
    ]
  );
  assert.equal(steps, 8);
  assert.ok(notes.every(N => N.vel > 0 && Number.isFinite(N.vel)));
});

test('SND-17: a kit piece the kit lacks plays nothing; a part with no line of its own in the jingle plays nothing', () => {
  const { notes } = musicJingleParts(
    { notes: [[72, 4]], perc: [[0, 42, 1]] },
    parts(['pad', 'bass', { line: 'drums', kit: { kick: 'kick' } }])
  );
  assert.deepEqual(notes, []);
  assert.equal(MUSIC_JINGLE_KIT[42], 'hat');
});

test('SND-17: a shift moves every pitched note (not the kit); notes fit the instrument; the needs cover each shift', () => {
  const E = {
      parts: [
        { line: 'lead', inst: 'glock' },
        { line: 'drums', kit: { kick: 'kick' } },
      ],
    },
    I = { glock: { lo: 67, hi: 108 }, kick: { lo: 60, hi: 60 } };
  const at0 = musicJingleParts({ notes: [[60, 2]], perc: [[0, 36, 1]] }, E, { instruments: I }).notes,
    at2 = musicJingleParts({ notes: [[60, 2]], perc: [[0, 36, 1]] }, E, { instruments: I, shift: 2 }).notes;
  assert.equal(at0[0].m, 72);
  assert.equal(at2[0].m, 74);
  assert.equal(at0[1].m, 60);
  assert.equal(at2[1].m, 60);
  assert.deepEqual(musicJingleNeeds({ notes: [[60, 2]], perc: [[0, 36, 1]] }, E, I, [0, 2, 4]), {
    glock: [72, 74, 76],
    kick: [60],
  });
});

test("SND-17: a stinger starts on the song's next beat, at least a moment from now, and moves to the song's key the nearer way", () => {
  const spb = 0.1;
  /* the next step to schedule is 5 at 1.0 s: steps 3 and 4 are scheduled; now 0.85: step 4 (0.9 s) is a beat */
  assert.deepEqual(musicStingerAt(0.85, 1.0, 5, spb), { t: 0.9, step: 4 });
  /* now 0.95: step 4 has gone, step 8 is the next beat */
  const b = musicStingerAt(0.95, 1.0, 5, spb);
  assert.equal(b.step, 8);
  assert.ok(Math.abs(b.t - 1.3) < 1e-9);
  /* an intro's steps are negative: beats still every 4 */
  assert.equal(musicStingerAt(0, 0.1, -6, spb).step, -4);
  assert.equal(musicStingerShift(62), 2);
  assert.equal(musicStingerShift(67), -5);
  assert.equal(musicStingerShift(66), 6);
  assert.equal(musicStingerShift(48), 0);
});
