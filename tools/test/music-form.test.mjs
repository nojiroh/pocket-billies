// Sound track SND-12: a song's form (music.json songs' `form` and `sections`): the composer lays its sections end to
// end (game/js/audio/tracker.js trackerCompose, through the test globals), varies the repeats, and leaves a fill and a
// turnaround at each section's end (game/js/logic/music-patterns.js). A song with no form composes as before.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
globalThis.window = globalThis;
globalThis.PB_TEST_GLOBALS = true;
await import('../../game/js/audio/tracker.js');
const { trackerCompose, trackerNight } = /** @type {any} */ (globalThis);
/* imported after the test globals are on (the tracker reads its logic through them) */
const {
  MUSIC_FILL_LEVEL,
  MUSIC_FORM_FILLS,
  musicBassAt,
  musicChordTones,
  musicDrumsAt,
  musicEnsembleStep,
  musicFillAt,
  musicFormPlan,
  musicSectionAt,
} = await import('../../game/js/logic/music-patterns.js');
const { musicFindings } = await import('../../game/js/logic/music-studio.js');

const MUSIC = JSON.parse(readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8'));
const base = {
  bpm: 100,
  key: 60,
  scale: 'major',
  prog: [0, 5, 3, 4, 0, 5, 1, 4],
  lead: 'p25',
  bass: 'bounce',
  arp: 'up',
  drums: 'soft',
  seed: 3,
  hook: [
    [0, 72, 4],
    [4, 76, 4],
    [8, 79, 8],
  ],
};
const B = { prog: [3, 4, 2, 5, 3, 4, 1, 4] };
const formed = (form = ['A', 'A', 'B', 'A'], o = {}) => ({ ...base, form, sections: { B }, ...o });

test('a song with no form plays one section: the plan is null and nothing per bar is added', () => {
  assert.equal(musicFormPlan(base), null);
  assert.equal(musicFormPlan({ ...base, form: [] }), null);
  const D = trackerCompose(base);
  assert.equal(D.steps, 128);
  for (const k of ['fills', 'starts', 'lift', 'played']) assert.equal(D[k], undefined, k);
});

test('every song in music.json with no form composes exactly as the song of one section', () => {
  for (const [id, S] of Object.entries(MUSIC.songs)) {
    if (S.form) continue;
    const a = trackerCompose(S),
      b = trackerCompose({ ...S, form: undefined, sections: undefined });
    assert.deepEqual(a.notes, b.notes, id);
    assert.deepEqual(a.counterNotes, b.counterNotes, id);
    assert.equal(a.fills, undefined, id);
  }
});

test('the plan: each section in order with its repeat, its fill, every other repeat lifted, the last marked', () => {
  const P = musicFormPlan(formed());
  assert.deepEqual(
    P.map(o => [o.name, o.k, o.lift, o.last]),
    [
      ['A', 0, 0, false],
      ['A', 1, 1, false],
      ['B', 0, 0, false],
      ['A', 2, 0, true],
    ]
  );
  for (const o of P) assert.ok(o.fill >= 0 && o.fill < MUSIC_FORM_FILLS);
  assert.deepEqual(P[2].recipe.prog, B.prog);
  assert.equal(P[2].recipe.hook, null, "B doesn't take A's hook");
  assert.equal(P[2].recipe.seed, base.seed + 97, "B's seed when none is written");
  assert.deepEqual(P[0].recipe.hook, base.hook);
  assert.deepEqual(musicFormPlan(formed()), P, 'the same song, the same plan (no random)');
  assert.deepEqual(
    musicFormPlan(formed(['A', 'C', 'B'])).map(o => o.name),
    ['A', 'B'],
    'a section the song lacks is left out'
  );
});

test('the composed form: 32 bars end to end, the chords of each section, per-bar fills and starts', () => {
  const D = trackerCompose(formed());
  assert.equal(D.steps, 32 * 16);
  assert.deepEqual(D.prog, [...base.prog, ...base.prog, ...B.prog, ...base.prog]);
  assert.equal(D.notes.length, D.steps);
  assert.deepEqual(
    D.played.map(S => [S.name, S.bar, S.bars, S.k]),
    [
      ['A', 0, 8, 0],
      ['A', 8, 8, 1],
      ['B', 16, 8, 0],
      ['A', 24, 8, 2],
    ]
  );
  assert.deepEqual(
    D.starts.map((x, b) => (x ? b : -1)).filter(b => b >= 0),
    [0, 8, 16, 24]
  );
  assert.deepEqual(
    D.fills.map((f, b) => (f >= 0 ? b : -1)).filter(b => b >= 0),
    [7, 15, 23, 31]
  );
  assert.equal(musicSectionAt(D, 17).name, 'B');
  assert.equal(musicSectionAt(D, 40), null);
});

test('the hook stays the owner’s: every A plays it in bars 1-2 and 5-6; B has its own walk', () => {
  const D = trackerCompose(formed());
  for (const bar0 of [0, 8, 24])
    for (const [st, m, l] of base.hook) {
      assert.deepEqual(D.notes[bar0 * 16 + st], [m, l]);
      assert.deepEqual(D.notes[bar0 * 16 + 64 + st], [m, l]);
    }
  const one = trackerCompose(base);
  assert.notDeepEqual(D.notes.slice(16 * 16, 24 * 16), one.notes, 'B is not A');
});

test('a repeat is varied: its bar 7 walked again; its other bars the same', () => {
  const D = trackerCompose(formed()),
    bars = (b0, b) => D.notes.slice((b0 + b) * 16, (b0 + b + 1) * 16);
  for (let b = 0; b < 6; b++) assert.deepEqual(bars(0, b), bars(8, b), 'bar ' + (b + 1));
  assert.notDeepEqual(bars(0, 6), bars(8, 6), 'bar 7 of the repeat');
  assert.deepEqual(D.lift.slice(8, 16), Array(8).fill(1), 'the repeat lifts its arpeggio');
  assert.deepEqual(D.lift.slice(0, 8), Array(8).fill(0));
});

test('a section’s end turns around into the next chord; the loop’s end comes home as before', () => {
  const D = trackerCompose(formed()),
    one = trackerCompose(base),
    last = b => D.notes.slice(b * 16, b * 16 + 16).filter(Boolean);
  /* bar 16, into B (whose first chord is IV, F): the tune ends a step over F's root, on G */
  const into = last(15);
  assert.equal(into.length, 3);
  assert.equal(into[2][0] % 12, 7);
  assert.deepEqual(last(31), one.notes.slice(7 * 16, 8 * 16).filter(Boolean), 'the loop comes home');
});

test('the night version moves every section’s hook with the key', () => {
  const N = trackerNight(formed(['A', 'B'], { sections: { B: { ...B, hook: [[0, 74, 8]] } } }));
  assert.equal(N.key, 55);
  assert.deepEqual(N.sections.B.hook, [[0, 69, 8]]);
  assert.deepEqual(N.sections.B.prog, B.prog);
});

test('fills: each shape replaces the pattern from its start; walk and none never fill; a soft song’s is softer', () => {
  for (let shape = 0; shape < MUSIC_FORM_FILLS; shape++) {
    const start = bar(i => musicFillAt(shape, i, 1)).findIndex(Boolean);
    assert.ok(start === 8 || start === 12, 'shape ' + shape);
    for (let i = 0; i < 16; i++) {
      const plain = musicDrumsAt('drive', i),
        F = musicDrumsAt('drive', i, shape);
      if (i < start) assert.deepEqual(F, plain);
      else assert.ok(F.every(h => h.hit === 'kick' || (h.hit === 'snare' && h.gb && h.gb.bp > 0)));
    }
  }
  for (const style of ['walk', 'none'])
    for (let i = 0; i < 16; i++) assert.deepEqual(musicDrumsAt(style, i, 0), musicDrumsAt(style, i));
  const vol = style => musicDrumsAt(style, 15, 0).reduce((a, h) => a + h.vol, 0);
  assert.ok(vol('soft') < vol('drive'));
  assert.ok(MUSIC_FILL_LEVEL.soft < 1);
});

test('the bass walks up into the next section’s chord on beat 4; a held bass stops for it', () => {
  const D = trackerCompose(formed());
  /* bar 16 (V) into B's IV (F): two steps under F, then one: D, E */
  assert.equal(musicBassAt(D, 15, 12).m % 12, 2);
  assert.equal(musicBassAt(D, 15, 14).m % 12, 4);
  assert.equal(musicBassAt(D, 15, 13), null);
  assert.deepEqual(musicBassAt(D, 14, 12), musicBassAt(trackerCompose(base), 6, 12), 'other bars as before');
  assert.equal(musicBassAt(D, 15, 0, 'long').len, 11.5);
  assert.equal(musicBassAt(D, 14, 0, 'long').len, 15);
  assert.equal(musicBassAt(D, 15, 12, 'none'), null);
});

test('the arpeggio’s lift never goes past the run’s own octave', () => {
  const D = trackerCompose(formed());
  assert.equal(musicChordTones(D, 9)[0] - musicChordTones(D, 1)[0], 12);
  assert.equal(musicChordTones({ ...D, arpOctave: 1 }, 9)[0], musicChordTones({ ...D, arpOctave: 1 }, 1)[0]);
});

test('the new lines: ostinato in eighths, chime now and then, a drone from each section, hits as sections start', () => {
  const D = trackerCompose(formed()),
    E = {
      parts: [
        { line: 'ostinato', inst: 'spiccato' },
        { line: 'chime', inst: 'bell' },
        { line: 'drone', inst: 'drone' },
        { line: 'hits', inst: 'orchhit' },
        { line: 'timp', inst: 'timpani' },
      ],
    },
    at = st => musicEnsembleStep(D, E, st),
    of = (st, part) => at(st).filter(N => N.part === part);
  assert.deepEqual(
    bar(i => of(i, 0).length),
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
  );
  assert.equal(of(0, 1).length, 1);
  assert.equal(of(16 + 8, 1).length, 1);
  assert.equal(of(16, 1).length, 0);
  assert.equal(of(0, 2).length, 2);
  assert.equal(of(16, 2).length, 0);
  assert.equal(of(8 * 16, 2).length, 2, 'a drone at a section’s start');
  assert.equal(of(0, 3).length, 3);
  assert.equal(of(16 * 16, 3).length, 3, 'hits as B starts');
  assert.equal(of(15 * 16 + 12, 3).length, 3, 'and on the fill');
  assert.equal(of(15 * 16 + 8, 4).length, 1, 'a timpani roll into each section');
  assert.equal(of(14 * 16 + 8, 4).length, 0);
});

test('a part with `in` plays only in those sections; a song with no form is all A', () => {
  const D = trackerCompose(formed()),
    E = {
      parts: [
        { line: 'pad', inst: 'strings', in: ['B'] },
        { line: 'pad', inst: 'strings', in: ['A'] },
      ],
    },
    parts = st => musicEnsembleStep(D, E, st).map(N => N.part);
  assert.deepEqual([...new Set(parts(0))], [1]);
  assert.deepEqual([...new Set(parts(16 * 16))], [0]);
  assert.deepEqual([...new Set(musicEnsembleStep(trackerCompose(base), E, 0).map(N => N.part))], [1]);
});

test('musicFindings: a form naming no section, a section never played, a loop out of 16-32 bars', () => {
  const M = JSON.parse(JSON.stringify(MUSIC)),
    msgs = () => musicFindings(M).map(f => f.lvl + ': ' + f.msg);
  M.songs.town = { ...M.songs.town, form: ['A', 'C'], sections: { B } };
  assert.ok(msgs().some(m => /^error: song "town" form: no section "C"/.test(m)));
  assert.ok(msgs().some(m => /^warn: song "town": the form never plays section B/.test(m)));
  assert.ok(msgs().some(m => /^warn: song "town": its form loops after 8 bars/.test(m)));
  M.songs.town.form = ['A', 'B'];
  assert.ok(!msgs().some(m => /song "town"/.test(m) && !/^info/.test(m)));
  M.songs.town.sections = { B: { ...B, hook: [[40, 60, 2]] } };
  assert.ok(msgs().some(m => /section B: its hook plays only steps 0-31/.test(m)));
});

function bar(f) {
  return Array.from({ length: 16 }, (_, i) => f(i));
}

/* SND-12b: batch 2, the cave, the biome songs and the run's map: each in a form on an ensemble of its own, with peak
   parts (the run's arc, SND-13: rows 3-5 at 0.6, 6-8 full), a walking beat and weather layers; the night version (and
   the tense and arc versions) keep it */
const BATCH2 = ['cave', 'meadow', 'spore', 'trench', 'hills', 'innersun', 'crystal', 'spire', 'map'];
test('batch 2: the cave, the biome songs and the map in forms of 16-32 bars, each on its own ensemble', () => {
  for (const id of BATCH2) {
    const S = MUSIC.songs[id];
    assert.equal(S.ensemble, id, id);
    assert.ok(MUSIC.ensembles[id], id);
    const D = trackerCompose(S),
      bars = D.steps / 16;
    assert.ok(bars >= 16 && bars <= 32, `${id}: ${bars} bars`);
    assert.ok(D.played && D.played.some(P => P.name === 'B'), `${id} plays its B`);
    if (S.night !== false) assert.equal(trackerNight(S).ensemble, id, `${id} at night`);
  }
});

test('batch 2: every ensemble has peak parts (the arc), a walking beat, rain and snow; at most 16 parts', () => {
  for (const id of BATCH2) {
    const E = MUSIC.ensembles[id],
      layers = new Set(E.parts.map(P => P.layer).filter(Boolean));
    for (const k of ['peak', 'walk', 'rain', 'snow']) assert.ok(layers.has(k), `${id}: ${k}`);
    assert.ok(E.parts.length <= 16, id);
    assert.ok(
      E.parts.some(P => !P.layer && P.wave),
      `${id} keeps a chip lead`
    );
    assert.match(E.name, /^placeholder: /, id);
  }
});

/* SND-12c: batch 3, the battles, the boss and the rest */
const BATCH3 = ['wild', 'trainer', 'rival', 'leader', 'boss', 'mall', 'hazel', 'title', 'fall', 'variants'];
const FIGHTS = ['trainer', 'rival', 'leader', 'boss'];
test('batch 3: the battle songs, the boss and the rest in forms of 16-32 bars, each on an ensemble (wild keeps battle)', () => {
  for (const id of BATCH3) {
    const S = MUSIC.songs[id];
    assert.equal(S.ensemble, id === 'wild' ? 'battle' : id, id);
    assert.ok(MUSIC.ensembles[S.ensemble], id);
    const D = trackerCompose(S),
      bars = D.steps / 16;
    assert.ok(bars >= 16 && bars <= 32, `${id}: ${bars} bars`);
    assert.ok(D.played && D.played.some(P => P.name === 'B'), `${id} plays its B`);
    if (S.intro) assert.ok(D.introSteps > 0, `${id} keeps its intro`);
    const E = MUSIC.ensembles[S.ensemble];
    assert.ok(
      E.parts.some(P => !P.layer && P.wave === S.lead),
      `${id} keeps its chip lead`
    );
    assert.match(E.name, /^placeholder: /, id);
    assert.ok(E.parts.length <= 16, id);
  }
});

test('batch 3: a battle builds (brass, timpani and the kit dimmed while calm) and peaks; trainers, the rival and leaders over a string ostinato, the boss with a choir and hits', () => {
  for (const id of ['wild', ...FIGHTS]) {
    const E = MUSIC.ensembles[MUSIC.songs[id].ensemble],
      has = (/** @type {any} */ f) => E.parts.some(f);
    assert.ok(
      has((/** @type {any} */ P) => P.layer === 'peak'),
      `${id}: peak parts`
    );
    for (const inst of ['brass', 'timpani'])
      assert.ok(
        has((/** @type {any} */ P) => P.inst === inst && P.dim && P.dim.calm != null),
        `${id}: ${inst} builds`
      );
    assert.ok(
      has((/** @type {any} */ P) => P.line === 'drums' && P.kit.kick && P.kit.snare && P.kit.hat),
      `${id}: a full kit`
    );
  }
  for (const id of FIGHTS)
    assert.ok(
      MUSIC.ensembles[id].parts.some(P => P.line === 'ostinato' && P.inst === 'spiccato' && !P.layer),
      `${id}: a string ostinato`
    );
  const B = MUSIC.ensembles.boss.parts;
  assert.ok(
    B.some(P => P.inst === 'choir' && !P.layer) && B.some(P => P.line === 'hits' && P.inst === 'orchhit' && !P.layer)
  );
});
