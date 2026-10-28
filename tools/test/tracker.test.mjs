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
const { trackerArc, trackerCompose, trackerCreate, trackerNight, trackerRecipe, trackerTense } = /** @type {any} */ (
  globalThis
);

const MUSIC = JSON.parse(readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8'));
// town's recipe without its written lines (SND-4 gave it a placeholder hook): the tests write their own
const town = Object.fromEntries(
  Object.entries(MUSIC.songs.town).filter(([k]) => !['hook', 'counter', 'hookName'].includes(k))
);

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

// SND-5: intros and the drums held until the throw
test('an intro lasts the bars its notes reach (one or two), and only steps 0-31 count', () => {
  assert.equal(trackerCompose(town).introSteps, 0);
  const a = trackerCompose({
    ...town,
    intro: [
      [0, 76, 2],
      [14, 64, 2],
    ],
  });
  assert.equal(a.introSteps, 16);
  assert.deepEqual(a.introNotes[0], [76, 2]);
  const b = trackerCompose({
    ...town,
    intro: [
      [0, 76, 2],
      [30, 64, 6],
      [40, 60, 2],
    ],
  });
  assert.equal(b.introSteps, 32);
  assert.deepEqual(b.introNotes[30], [64, 2], "a note is cut at the intro's end");
  assert.deepEqual(trackerCompose({ ...town, intro: [[0, 76, 2]] }).notes, trackerCompose(town).notes);
});

test('trackerRecipe: the song, its night version, null for what does not exist', () => {
  const songs = { town };
  assert.equal(trackerRecipe(songs, 'town'), town);
  assert.deepEqual(trackerRecipe(songs, 'town@night'), trackerNight(town));
  assert.equal(trackerRecipe(songs, 'nosuch'), null);
  assert.equal(trackerRecipe(songs, 'town@nosuch'), null);
  assert.equal(trackerRecipe({ town: { ...town, night: false } }, 'town@night'), null);
});

/** a context that does nothing: every node and param takes any call; the clock is set by hand */
function fakeContext() {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'value' ? 0 : any()), apply: () => any() });
  const c = new Proxy(
    { currentTime: 0, sampleRate: 8000 },
    {
      get: (t, k) =>
        k in t ? t[k] : k === 'createBuffer' ? () => ({ getChannelData: () => new Float32Array(8) }) : any(),
    }
  );
  return c;
}
/** what a song plays over its first `steps` steps: [step, voice] (lead, drum) */
function playFor(D, o, steps, after) {
  const c = fakeContext(),
    T = trackerCreate(c, {}, { songs: { s: D } }),
    out = [];
  let step = 0;
  T.synthVoice = (bus, v) => out.push([T.song.step, 'voice', v.type]);
  T.synthNoise = () => out.push([T.song.step, 'drum']);
  T.synthKick = () => out.push([T.song.step, 'drum']);
  T.play('s', o);
  clearInterval(T.timer);
  const spb = 60 / D.bpm / 4;
  for (; step < steps; step++) {
    if (after && step === after.at) after.do(T);
    c.currentTime = T.song.next - 0.13;
    T.tick();
  }
  return out;
}

test('with an intro asked for, the intro plays first on the lead alone, then the song from its start', () => {
  const D = {
      ...town,
      drums: 'drive',
      intro: [
        [0, 76, 1],
        [1, 75, 1],
        [2, 74, 1],
      ],
    },
    out = playFor(D, { intro: true }, 20);
  const intro = out.filter(([st]) => st < 0);
  assert.equal(intro.length, 3, 'three intro notes, nothing else');
  assert.ok(intro.every(([, k, type]) => k === 'voice' && type === D.lead));
  assert.ok(
    out.some(([st, k]) => st >= 0 && k === 'drum'),
    'the drums come with the song'
  );
  assert.ok(!playFor(D, {}, 4).some(([st]) => st < 0), 'no intro unless asked');
});

test('held drums stay out until drumsIn (the throw)', () => {
  const D = { ...town, drums: 'drive' };
  assert.ok(!playFor(D, { hold: true }, 24).some(([, k]) => k === 'drum'));
  const out = playFor(D, { hold: true }, 24, { at: 8, do: T => T.drumsIn() });
  assert.ok(out.some(([, k]) => k === 'drum'));
  assert.ok(!out.some(([st, k]) => k === 'drum' && st < 8));
});

test('the tense version (the red zone): written changes win; with none, 16 bpm faster, march drums, the pedal bass', () => {
  const w = MUSIC.songs.wild,
    t = trackerTense(w);
  assert.equal(t.bpm, w.bpm + 16);
  assert.equal(t.drums, 'march');
  assert.equal(t.bass, 'pedal');
  assert.equal(t.key, w.key);
  assert.deepEqual(t.hook, w.hook, 'the hook stays');
  assert.equal(
    trackerTense({ ...w, tense: { bpm: 170 } }).drums,
    w.drums,
    'a written tense changes only what it names'
  );
  assert.equal(trackerTense({ ...w, tense: false }), null);
  assert.deepEqual(trackerRecipe({ wild: w }, 'wild@tense'), t);
});

test('a song that takes over a held one keeps the drums out until the throw', () => {
  const c = fakeContext(),
    T = trackerCreate(c, {}, { songs: { a: { ...town, drums: 'drive' }, b: { ...town, drums: 'drive', bpm: 120 } } });
  T.play('a', { hold: true });
  T.play('b');
  clearInterval(T.timer);
  assert.ok(T.song.hold);
  T.drumsIn();
  assert.equal(T.song.hold, 0);
});

test('the run arc: a band changes the recipe; arc: false leaves it; parts stack (meadow@late@night)', () => {
  const band = { name: 'late', row: [6, 8], changes: { drums: 'march', arpOctave: 1, counterAuto: true } },
    run = { arc: [band] },
    m = MUSIC.songs.meadow;
  const a = trackerArc(m, band);
  assert.equal(a.drums, 'march');
  assert.equal(a.arpOctave, 1);
  assert.equal(trackerArc({ ...m, arc: false }, band).drums, m.drums);
  assert.deepEqual(trackerRecipe({ meadow: m }, 'meadow@late', run), a);
  assert.deepEqual(trackerRecipe({ meadow: m }, 'meadow@late@night', run), trackerNight(a));
  assert.equal(trackerRecipe({ meadow: m }, 'meadow@nosuch', run), null);
  assert.equal(trackerRecipe({ meadow: m }, 'meadow@late'), null, 'no arc given, no band');
});

test('counterAuto: a counter from the hook, each note a chord tone at least a third below; a written counter wins', () => {
  const hook = [
      [0, 72, 4],
      [16, 76, 4],
    ],
    D = trackerCompose({ ...town, hook, counterAuto: true });
  for (const st of [0, 16]) {
    const [c] = D.counterNotes[st],
      h = D.notes[st][0];
    assert.ok(c <= h - 3 && c > h - 15, `step ${st}: ${c} under ${h}`);
    const ch = town.prog[st / 16],
      tones = [0, 2, 4].map(x => D.deg(ch + x) % 12);
    assert.ok(tones.includes(c % 12), `step ${st}: ${c} is a chord tone`);
  }
  const w = trackerCompose({ ...town, hook, counter: [[0, 60, 4]], counterAuto: true });
  assert.deepEqual(w.counterNotes[0], [60, 4]);
  assert.ok(
    trackerCompose({ ...town, counterAuto: true }).counterNotes.every(n => n === null),
    'no hook, no counter'
  );
});

test('restart starts a playing song again (a new battle with the same song); without it the song plays on', () => {
  const c = fakeContext(),
    T = trackerCreate(c, {}, { songs: { a: { ...town, intro: [[0, 76, 4]] } } });
  const first = T.play('a');
  assert.equal(T.play('a', { intro: true }), first);
  const again = T.play('a', { intro: true, hold: true, restart: true });
  clearInterval(T.timer);
  assert.notEqual(again, first);
  assert.equal(again.step, -16, 'from its intro');
  assert.ok(again.hold);
});

test('SND-8b: a song with echo 0 sends nothing to the echo; one with none written sends 0.15', () => {
  const leadEcho = D => {
    const c = fakeContext(),
      T = trackerCreate(c, {}, { songs: { s: D } }),
      out = [];
    T.synthVoice = (bus, v) => v.type === D.lead && out.push(v.echo);
    T.synthNoise = T.synthKick = () => {};
    T.play('s');
    clearInterval(T.timer);
    for (let i = 0; i < 32; i++) {
      c.currentTime = T.song.next - 0.13;
      T.tick();
    }
    return [...new Set(out)];
  };
  const plain = { ...town };
  delete plain.echo;
  assert.deepEqual(leadEcho({ ...town, echo: 0 }), [0]);
  assert.deepEqual(leadEcho(plain), [0.15]);
});

/** a context whose gains record what is scheduled on them: [method, value, time] */
function recordingContext() {
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'value' ? 0 : any()), apply: () => any() }),
    gains = [];
  const param = () => {
    const p = { value: 0, calls: [] };
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'cancelScheduledValues', 'setTargetAtTime'])
      p[m] = (...a) => p.calls.push([m, ...a]);
    return p;
  };
  const c = new Proxy(
    { currentTime: 0, sampleRate: 8000, gains },
    {
      get: (t, k) =>
        k in t
          ? t[k]
          : k === 'createBuffer'
            ? () => ({ getChannelData: () => new Float32Array(8) })
            : k === 'createGain'
              ? () => {
                  const g = { gain: param(), to: [], connect: n => g.to.push(n), disconnect: () => (g.to = []) };
                  gains.push(g);
                  return g;
                }
              : any(),
    }
  );
  return c;
}

test("SND-8b: a song's echo send moves with its fader (the fade-in, a jingle's duck, a stop)", () => {
  const c = recordingContext(),
    T = trackerCreate(c, {}, { songs: { s: town } }),
    sg = T.play('s');
  clearInterval(T.timer);
  assert.ok(sg.echo.to.includes(T.echoIn), 'the send goes to the echo');
  const moves = n => n.gain.calls.map(([m, v]) => [m, v]);
  assert.deepEqual(moves(sg.echo), moves(sg.gain), 'the fade-in');
  assert.deepEqual(moves(sg.gain).at(-1), ['linearRampToValueAtTime', 1]);
  T.jingle([[72, 4]], 150, 'p25', {});
  assert.deepEqual(moves(sg.echo), moves(sg.gain), 'the duck');
  assert.ok(moves(sg.echo).some(([m, v]) => m === 'linearRampToValueAtTime' && v === 0.15));
  T.stop();
  assert.deepEqual(moves(sg.echo), moves(sg.gain), 'the stop');
  assert.deepEqual(moves(sg.echo).at(-1), ['linearRampToValueAtTime', 0]);
  // the song's voices send their echo to the song's send, not straight to the echo
  const c2 = fakeContext(),
    T2 = trackerCreate(c2, {}, { songs: { s: town } }),
    to = [];
  T2.synthVoice = (bus, v) => v.echo && to.push(v.echoTo);
  T2.synthNoise = T2.synthKick = () => {};
  const sg2 = T2.play('s');
  clearInterval(T2.timer);
  for (let i = 0; i < 32; i++) {
    c2.currentTime = T2.song.next - 0.13;
    T2.tick();
  }
  assert.ok(to.length && to.every(n => n === sg2.echo));
});

test("SND-8b: a jingle echoes on the effects' own echo; on the music bus (Settings' test) on the music's", () => {
  const c = recordingContext(),
    music = { name: 'music' },
    fx = { name: 'fx' },
    T = trackerCreate(c, music, { fx }),
    to = [];
  assert.ok(T.echoFx && T.echoFx !== T.echoIn);
  T.synthVoice = (bus, v) => v.echo && to.push(v.echoTo);
  T.jingle([[72, 4]], 150, 'p25', fx);
  T.jingle([[72, 4]], 150, 'p25', music);
  assert.deepEqual(to, [T.echoFx, T.echoIn]);
  assert.equal(trackerCreate(recordingContext(), music).echoFx, null, 'no effects bus, no effects echo');
});

test("SND-8b: a song's trim (dB) is its fader's top; a jingle ducks it to 0.15 of that; none written is exactly 1", () => {
  const c = recordingContext(),
    T = trackerCreate(c, {}, { songs: { up: { ...town, trim: 6 }, plain: town } }),
    tops = n => n.gain.calls.filter(([m]) => m === 'linearRampToValueAtTime').map(([, v]) => Math.round(v * 1e4) / 1e4);
  const sg = T.play('up');
  clearInterval(T.timer);
  const lv = Math.round(Math.pow(10, 6 / 20) * 1e4) / 1e4;
  assert.deepEqual(tops(sg.gain), [lv]);
  T.jingle([[72, 4]], 150, 'p25', {});
  assert.deepEqual(tops(sg.echo), [lv, Math.round(0.15 * lv * 1e4) / 1e4, Math.round(0.15 * lv * 1e4) / 1e4, lv]);
  const p = T.play('plain');
  clearInterval(T.timer);
  assert.equal(p.level, 1);
  assert.equal(trackerNight({ ...town, trim: 6 }).trim, 6, 'the night version keeps it');
});

/** a context that makes real buffers and records the sources and gains it makes (the bank's tests) */
function bankContext(rate) {
  const made = { sources: [], gains: [] },
    param = () => {
      const p = { value: 0, calls: [] };
      for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'cancelScheduledValues', 'setTargetAtTime'])
        p[m] = (...a) => p.calls.push([m, ...a]);
      return p;
    },
    node = () => ({
      to: [],
      connect(n) {
        this.to.push(n);
      },
      disconnect() {},
    });
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'value' ? 0 : any()), apply: () => any() });
  const t = {
    currentTime: 0,
    sampleRate: rate,
    made,
    createBuffer: (ch, n, r) => {
      const d = Array.from({ length: ch }, () => new Float32Array(n));
      return { length: n, sampleRate: r, getChannelData: i => d[i], copyToChannel: (a, i) => d[i].set(a) };
    },
    createBufferSource: () => {
      const s = {
        ...node(),
        playbackRate: param(),
        started: null,
        start: at => (s.started = at),
        stop: at => (s.stopped = at),
      };
      made.sources.push(s);
      return s;
    },
    createGain: () => {
      const g = { ...node(), gain: param() };
      made.gains.push(g);
      return g;
    },
  };
  return new Proxy(t, { get: (o, k) => (k in o ? o[k] : any()) });
}
const { soundBakeBank, SOUND_BAKE_BUDGET } = /** @type {any} */ (globalThis);
/* SND-11: the instruments are music.json's, given to a tracker as opts.instruments (the bank's recipes are shared) */
trackerCreate(fakeContext(), {}, { instruments: MUSIC.instruments });

test('SND-9: the bank bakes in slices, once per rate; bankReady resolves when every zone is in', async () => {
  const c = bankContext(22050),
    T = trackerCreate(c, {}, {}),
    slices = soundBakeBank.slices;
  await T.bankReady('harp');
  const E = soundBakeBank.entries.get('harp@22050');
  assert.ok(E.zones.every(Boolean));
  assert.ok(soundBakeBank.slices - slices > 1, 'more than one slice');
  for (const z of E.zones) assert.equal(z.buffer.sampleRate, 22050, "a buffer at the context's own rate");
  /* a second context at the same rate bakes nothing again */
  const zones = soundBakeBank.zones,
    T2 = trackerCreate(bankContext(22050), {}, {});
  await T2.bankReady(['harp']);
  assert.equal(soundBakeBank.zones, zones);
  /* the stats say what the debug log needs */
  const S = T.bankStats();
  assert.ok(S.instruments.includes('harp@22050 10/10'));
  assert.ok(S.slices > 0 && S.sliceMaxMs >= 0 && S.lastSlicesMs.length > 0 && S.mb > 0);
  /* an instrument that doesn't exist is null, not an error */
  assert.deepEqual(await T.bankReady('nothing'), [null]);
});

test('SND-9: sampleVoice is one buffer source and one gain, the nearest zone moved to the note, its loop held', async () => {
  const c = bankContext(16000),
    T = trackerCreate(c, {}, {}),
    out = {};
  assert.equal(T.sampleVoice(out, { inst: 'harp', midi: 60, t: 0, dur: 1 }), null, 'nothing baked yet');
  await T.bankReady('harp');
  const s0 = c.made.sources.length,
    g0 = c.made.gains.length,
    started = T.started,
    v = T.sampleVoice(out, { inst: 'harp', midi: 61, t: 1, dur: 2, vol: 0.3 });
  assert.equal(c.made.sources.length - s0, 1);
  assert.equal(c.made.gains.length - g0, 1);
  assert.equal(T.started, started + 1);
  const E = soundBakeBank.entries.get('harp@16000'),
    Z = E.zones.find(z => z.lo <= 61 && z.hi >= 61);
  assert.equal(v.source.buffer, Z.buffer);
  assert.ok(Math.abs(v.source.playbackRate.value - Math.pow(2, (61 - Z.root) / 12)) < 1e-12);
  assert.ok(v.source.loop && v.source.loopStart === Z.loopStart && v.source.loopEnd === Z.loopEnd);
  assert.deepEqual(v.source.to, [v.gain]);
  assert.deepEqual(v.gain.to, [out]);
  assert.equal(v.source.started, 1);
  assert.ok(v.source.stopped > 3);
  /* the gain: its level, then the pluck's tail once the loop starts, then the release at the note's end */
  const calls = v.gain.gain.calls;
  assert.deepEqual(calls[0], ['setValueAtTime', 0.3, 1]);
  assert.equal(calls.at(-1)[0], 'setTargetAtTime');
  assert.equal(calls.at(-1)[2], 3);
});

test('SND-9: past the budget the least recently played zone goes; a note there plays from the nearest and bakes it again', async () => {
  /* the earlier tests' zones are older than these: only this test's count */
  soundBakeBank.entries.clear();
  const c = bankContext(12000),
    T = trackerCreate(c, {}, {});
  await T.bankReady('harp');
  const E = soundBakeBank.entries.get('harp@12000');
  /* play every zone but the lowest, so the lowest is the one played longest ago */
  for (const z of E.zones.slice(1)) T.sampleVoice({}, { inst: 'harp', midi: z.root, t: 0, dur: 0.1 });
  const other = soundBakeBank.other,
    low = E.zones[0];
  const bank = () =>
    [...soundBakeBank.entries.values()].reduce((a, e) => a + e.zones.reduce((b, z) => b + (z ? z.bytes : 0), 0), 0);
  try {
    /* the other buffers fill the budget but for less than the bank holds: something must go */
    const room = SOUND_BAKE_BUDGET - bank() + 1;
    soundBakeBank.other = () => room;
    const dropped = soundBakeBank.dropped;
    /* baking one more zone (a fresh rate's single zone) prunes */
    E.zones[E.zones.length - 1] = null;
    await T.bankReady('harp');
    assert.ok(soundBakeBank.dropped > dropped);
    assert.equal(E.zones[0], null, 'the least recently played zone went');
    soundBakeBank.other = () => 0;
    const v = T.sampleVoice({}, { inst: 'harp', midi: low.root, t: 0, dur: 0.1 });
    assert.ok(v && v.source.buffer !== low.buffer, 'the nearest zone left plays it');
    await T.bankReady('harp');
    assert.ok(E.zones[0], 'and the dropped zone is baked again');
  } finally {
    soundBakeBank.other = other;
  }
});

test('SND-9: the reverb is made only when something sends to it; sends follow the sliders and the place; one impulse per rate', async () => {
  const c = bankContext(11025),
    made = { conv: 0 },
    master = { name: 'master' };
  c.createConvolver = () => (
    made.conv++,
    {
      to: [],
      connect(n) {
        this.to.push(n);
      },
      buffer: null,
    }
  );
  const T = trackerCreate(c, {}, { songs: { s: town }, master });
  /* a song plays its bars and never makes it (today's songs, the future gb) */
  T.synthVoice = T.synthNoise = T.synthKick = () => {};
  T.play('s');
  clearInterval(T.timer);
  for (let i = 0; i < 64; i++) {
    c.currentTime = T.song.next - 0.13;
    T.tick();
  }
  T.reverbLevels(0.5, 0.25);
  assert.equal(made.conv, 0);
  assert.equal(T.reverbStats(), null);
  /* the first send makes it: the room returns to the master */
  const send = T.reverbSend('music');
  assert.equal(made.conv, 1);
  assert.equal(T.reverbSend('sfx') !== send, true);
  const conv = await T.reverbReady();
  assert.equal(made.conv, 1, 'one convolver');
  assert.ok(conv.buffer && conv.buffer.length <= 1.2 * 11025 + 1);
  assert.equal(conv.buffer.sampleRate, 11025);
  assert.deepEqual(c.made.gains.find(g => g.to.includes(master)).to, [master]);
  /* post-fader: the music send is the Music slider times the place (a town 0.8); a cave sends more */
  assert.ok(Math.abs(send.gain.value - 0.4) < 1e-9);
  T.reverbPlace('cave');
  assert.ok(Math.abs(send.gain.calls.at(-1)[1] - 0.9) < 1e-9);
  T.reverbLevels(0, 0);
  assert.equal(send.gain.calls.at(-1)[1], 0, 'a slider at 0 sends nothing');
  const S = T.reverbStats();
  assert.equal(S.place, 'cave');
  assert.ok(S.sec <= 1.2 && S.kb > 0);
  /* a second context at the rate reuses the impulse */
  const c2 = bankContext(11025);
  c2.createConvolver = c.createConvolver;
  const T2 = trackerCreate(c2, {}, {});
  assert.equal((await T2.reverbReady()).buffer, conv.buffer);
});

test('SND-10: the bank takes recipes from data; sampleShot plays a zone once, moved to the note and by rate', async () => {
  const c = bankContext(16000),
    T = trackerCreate(c, {}, {}),
    out = { name: 'out' };
  T.bankAdd({
    tdrop: { kind: 'bubble', lo: 60, hi: 84, every: 6, xi: 0.1, level: 0.9 },
    harp: { kind: 'bubble', lo: 1, hi: 2, every: 1, xi: 0, level: 1 },
  });
  assert.equal(T.sampleShot(out, { inst: 'nothing', midi: 60, t: 0 }), null);
  assert.equal(T.sampleShot(out, { inst: 'tdrop', midi: 70, t: 0 }), null, 'nothing baked yet');
  await T.bankReady('tdrop');
  assert.ok(T.bankStats().instruments.some(k => k.startsWith('tdrop@16000')));
  /* the harp keeps its own recipe (an id the bank has is never replaced) */
  assert.equal(soundBakeBank.recipes.harp, MUSIC.instruments.harp);
  const v = T.sampleShot(out, { inst: 'tdrop', midi: 71, t: 2, vol: 0.4, rate: 1.1 });
  const z = soundBakeBank.entries.get('tdrop@16000').zones.find(q => 71 >= q.lo && 71 <= q.hi);
  assert.ok(Math.abs(v.source.playbackRate.value - Math.pow(2, (71 - z.root) / 12) * 1.1) < 1e-9);
  assert.equal(v.source.loop, undefined, 'never looped');
  assert.equal(v.source.started, 2);
  assert.ok(Math.abs(v.source.stopped - (2 + z.buffer.length / 16000 / v.source.playbackRate.value + 0.01)) < 1e-9);
  assert.equal(v.gain.gain.value, 0.4);
  assert.deepEqual(v.gain.to, [out]);
});

test('SND-10: the reverb has a World send, scaled by the World slider', async () => {
  const c = bankContext(11025);
  c.createConvolver = () => ({
    to: [],
    connect(n) {
      this.to.push(n);
    },
    buffer: null,
  });
  const T = trackerCreate(c, {}, { master: {} });
  T.reverbLevels(0.5, 0.25, 0.2);
  const w = T.reverbSend('world');
  assert.ok(w !== T.reverbSend('music') && w !== T.reverbSend('sfx'));
  assert.ok(Math.abs(w.gain.value - 0.2 * 0.8) < 1e-9, 'a town sends 0.8 of the slider');
  T.reverbLevels(0.5, 0.25);
  assert.ok(Math.abs(w.gain.calls.at(-1)[1] - 0.2 * 0.8) < 1e-9, 'left out, the World level stays');
});

/* SND-11: a context whose nodes remember what they connect to and what made them */
function wireContext() {
  const made = [],
    param = () => new Proxy({ value: 1 }, { get: (t, k) => (k in t ? t[k] : () => {}) }),
    node = kind => {
      const n = { kind, to: [], gain: param(), connect: x => n.to.push(x), disconnect: () => (n.to = []) };
      made.push(n);
      return n;
    };
  const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'value' ? 0 : any()), apply: () => any() });
  const c = new Proxy(
    { currentTime: 0, sampleRate: 8000, made },
    {
      get: (t, k) =>
        k in t
          ? t[k]
          : k === 'createGain'
            ? () => node('gain')
            : k === 'createStereoPanner'
              ? () => node('panner')
              : k === 'createBuffer'
                ? () => ({ getChannelData: () => new Float32Array(8), length: 8 })
                : any(),
    }
  );
  return c;
}

test('SND-11: the gb path plays each line into its own stem: plain gains under the fader, no panner', () => {
  const D = { ...MUSIC.songs.route, extra: false },
    c = wireContext(),
    T = trackerCreate(c, {}, { songs: { s: { ...D, night: false } } }),
    seen = new Map();
  const tap = k => (bus, o) => seen.set(bus, (seen.get(bus) || new Set()).add(k));
  T.synthVoice = (bus, o) => tap(o.type)(bus);
  T.synthNoise = tap('noise');
  T.synthKick = tap('kick');
  T.play('s');
  clearInterval(T.timer);
  c.currentTime = 4;
  T.tick();
  clearInterval(T.timer);
  const S = T.song.stems;
  assert.deepEqual(Object.keys(S).sort(), ['bass', 'counter', 'drums', 'harmony', 'lead', 'pad']);
  assert.equal(S.drums, T.song.drums, "the drums' stem is the drums' own bus");
  for (const k of ['lead', 'counter', 'bass', 'harmony', 'pad']) {
    assert.equal(S[k].gain.value, 1, k);
    assert.deepEqual(S[k].to, [T.song.gain], k + ' goes straight to the fader');
  }
  assert.ok(!seen.has(T.song.gain), 'nothing plays on the fader itself');
  assert.ok(seen.get(S.lead).has(D.lead) && seen.get(S.bass).has('triangle') && seen.get(S.harmony).has('p12'));
  assert.ok(seen.get(S.drums).has('kick') && seen.get(S.drums).has('noise'));
  assert.ok(!c.made.some(n => n.kind === 'panner'), 'no StereoPanner on the gb path (a centred one costs 3 dB)');
});

/* SND-11: a small ensemble: the chip lead, a pizzicato bass, a kick and a hat */
const BAND = {
  parts: [
    { line: 'lead', wave: 'p25' },
    { line: 'bass', inst: 'pizz', pan: -0.3, verb: 0.2 },
    { line: 'drums', kit: { kick: 'kick', hat: 'hat' } },
  ],
};
function bandPlay(rate, o = {}) {
  const c = bankContext(rate);
  /* a plain convolver (the catch-all stand-in would look like a promise to the reverb's ready) */
  c.createConvolver = () => ({ connect() {}, buffer: null });
  const S = { ...MUSIC.songs.route, ensemble: 'band', night: false },
    gb = { on: !!o.gb },
    T = trackerCreate(
      c,
      {},
      { songs: { s: S, g: { ...S, ensemble: 'gb' } }, ensembles: { band: BAND }, gb: () => gb.on }
    ),
    seen = [];
  T.synthVoice = (bus, v) => seen.push(['chip', T.song.step, bus, v.type]);
  T.synthNoise = bus => seen.push(['noise', T.song.step, bus]);
  T.synthKick = bus => seen.push(['kick', T.song.step, bus]);
  const sample = T.sampleVoice;
  T.sampleVoice = (bus, v) => (seen.push(['baked', T.song.step, bus, v.inst]), sample(bus, v));
  return { c, T, seen, gb };
}
const run16 = (c, T, bars = 1) => {
  for (let k = 0; k < 16 * bars; k++) {
    c.currentTime = T.song.next - 0.13;
    T.tick();
  }
  clearInterval(T.timer);
};

test('SND-11: a song with an ensemble plays gb until its notes are baked, then the ensemble from the next bar line', async () => {
  const { c, T, seen } = bandPlay(11025);
  T.play('s');
  clearInterval(T.timer);
  run16(c, T);
  assert.ok(
    seen.some(([k]) => k === 'noise'),
    'the first bar is gb (its noise drums)'
  );
  assert.ok(!seen.some(([k]) => k === 'baked'));
  await T.prepare('s');
  assert.ok(T.ensembleReady('s'));
  seen.length = 0;
  run16(c, T, 2);
  assert.ok(!seen.some(([k]) => k === 'noise'), 'then no chip drums');
  const baked = new Set(seen.filter(([k]) => k === 'baked').map(x => x[3]));
  assert.deepEqual([...baked].sort(), ['hat', 'kick', 'pizz']);
  /* each part into its own stem; the drums' through the drums' bus */
  const sg = T.song;
  assert.equal(sg.parts.length, 3);
  assert.ok(seen.filter(([k, , , i]) => i === 'pizz').every(([, , bus]) => bus === sg.parts[1]));
  assert.deepEqual(sg.parts[2].to, [sg.drums]);
  assert.ok(
    seen.some(([k, , bus, type]) => k === 'chip' && type === 'p25' && bus === sg.parts[0]),
    'the chip lead'
  );
  /* the bass's reverb send goes to the song's own reverb fader */
  assert.ok(sg.verb, 'a reverb fader');
});

test('SND-11: only the zones an ensemble plays are baked; GB Sounds plays gb whatever is baked; gb is reserved', async () => {
  const { c, T, seen, gb } = bandPlay(12000, { gb: true });
  const N = T.needs('s');
  assert.ok(N.pizz.length >= 1 && N.kick.length === 1 && !N.harp);
  await T.prepare('s');
  const E = soundBakeBank.entries.get('pizz@12000');
  assert.ok(
    E.zones.some(z => !z),
    'the pizz zones nothing plays stay unbaked'
  );
  assert.ok(E.zones.some(Boolean));
  T.play('s');
  clearInterval(T.timer);
  run16(c, T);
  assert.ok(seen.some(([k]) => k === 'noise') && !seen.some(([k]) => k === 'baked'), 'GB Sounds: gb');
  gb.on = false;
  seen.length = 0;
  run16(c, T);
  assert.ok(
    seen.some(([k]) => k === 'baked'),
    'GB Sounds off: the ensemble from the next bar'
  );
  /* a song (or a version) naming gb plays today's code, with nothing to bake */
  assert.equal(T.needs('g'), null);
  assert.equal(await T.prepare('g'), false);
});

/* ---------- SND-17: jingles on an ensemble ---------- */
const JBAND = {
  trim: -6,
  parts: [
    { line: 'lead', wave: 'p25' },
    { line: 'lead', inst: 'glock', pan: 0.2, verb: 0.3 },
    { line: 'pad', inst: 'strings' },
    { line: 'drums', kit: { snare: 'snare' } },
  ],
};
const JING = {
  notes: [
    [72, 2],
    [76, 2],
    [79, 4],
  ],
  ensemble: 'fan',
  harmony: [
    [0, 60, 8],
    [0, 64, 8],
  ],
  perc: [[0, 38, 1]],
};
function jinglePlayer(rate, o = {}) {
  const c = bankContext(rate);
  c.createConvolver = () => ({ connect() {}, buffer: null });
  const gb = { on: !!o.gb },
    T = trackerCreate(c, {}, { songs: { s: MUSIC.songs.route }, ensembles: { fan: JBAND }, gb: () => gb.on, fx: {} }),
    seen = [];
  const synth = T.synthVoice,
    sample = T.sampleVoice;
  T.synthVoice = (bus, v) => (seen.push(['chip', v.t, bus, v.type, v.vol]), synth(bus, v));
  T.sampleVoice = (bus, v) => (seen.push(['baked', v.t, bus, v.inst, v.midi]), sample(bus, v));
  /* the song's drums (the fake params have no exponential ramps) */
  T.synthKick = T.synthNoise = () => {};
  return { c, T, seen, gb };
}

test('SND-17: a jingle naming an ensemble plays the 8-bit jingle until its notes are baked, then on its parts', async () => {
  const { c, T, seen } = jinglePlayer(13000);
  const fx = { fx: true };
  const end0 = T.jingle(JING.notes, 150, 'p25', fx, { jingle: JING });
  assert.deepEqual(
    seen.map(x => x[3]),
    ['p25', 'triangle', 'p25', 'triangle', 'p25', 'triangle'],
    'the first time: the 8-bit jingle (its notes asked for)'
  );
  await T.jinglePrepare(JING);
  assert.ok(T.jingleReady(JING));
  seen.length = 0;
  const end = T.jingle(JING.notes, 150, 'p25', fx, { jingle: JING });
  assert.ok(Math.abs(end - end0) < 1e-9, 'the same length (its tune is the longest line)');
  const kinds = seen.map(x => x[0] + ':' + x[3]);
  assert.equal(kinds.filter(k => k === 'chip:p25').length, 3, 'the chip lead plays the tune');
  assert.ok(!kinds.includes('chip:triangle'), 'no triangle under it');
  assert.equal(kinds.filter(k => k === 'baked:glock').length, 3);
  assert.equal(kinds.filter(k => k === 'baked:strings').length, 2);
  assert.equal(kinds.filter(k => k === 'baked:snare').length, 1);
  /* the chip lead at level 1 plays as loud as the 8-bit jingle's (0.12) */
  assert.ok(seen.filter(x => x[3] === 'p25').every(x => Math.abs(x[4] - 0.12) < 1e-9));
  /* each part into a gain of its own carrying the ensemble's trim */
  const buses = new Set(seen.map(x => x[2]));
  assert.equal(buses.size, 4);
  for (const g of buses) assert.ok(Math.abs(g.gain.value - Math.pow(10, -6 / 20)) < 1e-9);
  void c;
});

test('SND-17: GB Sounds plays the 8-bit jingle whatever is baked; a jingle naming gb or nothing bakes nothing', async () => {
  const { T, seen, gb } = jinglePlayer(14000, { gb: true });
  await T.jinglePrepare(JING);
  T.jingle(JING.notes, 150, 'p25', {}, { jingle: JING });
  assert.ok(seen.every(x => x[0] === 'chip') && seen.length === 6);
  gb.on = false;
  seen.length = 0;
  T.jingle(JING.notes, 150, 'p25', {}, { jingle: JING });
  assert.ok(seen.some(x => x[0] === 'baked'));
  assert.equal(T.jingleNeeds({ notes: [[72, 2]], ensemble: 'gb' }), null);
  assert.equal(await T.jinglePrepare({ notes: [[72, 2]] }), false);
});

test("SND-17: a stinger over a song starts on the song's next beat, in its key, and drops its busy stems, not its fader", async () => {
  const { c, T, seen } = jinglePlayer(15000);
  const ST = { ...JING, stinger: true, perc: [] };
  await T.jinglePrepare(ST);
  const sg = T.play('s');
  clearInterval(T.timer);
  /* six steps scheduled: the next is step 6 */
  for (let k = 0; k < 6; k++) {
    c.currentTime = sg.next - 0.13;
    T.tick();
  }
  clearInterval(T.timer);
  const spb = 60 / sg.D.bpm / 4;
  c.currentTime = sg.next - 0.05;
  const fader0 = sg.gain.gain.calls.length;
  seen.length = 0;
  T.jingle(ST.notes, 150, 'p25', {}, { jingle: ST });
  const first = Math.min(...seen.map(x => x[1]));
  /* the beat after now: step 8 */
  assert.ok(Math.abs(first - (sg.next + 2 * spb)) < 1e-9, 'on step 8');
  const shift = ((((((sg.D.key - 60) % 12) + 12) % 12) + 6) % 12) - 6;
  assert.equal(seen.filter(x => x[0] === 'chip').length, 3, 'the chip lead');
  const glock = seen.filter(x => x[3] === 'glock').map(x => x[4]);
  assert.deepEqual(
    glock.map(m => (((m - 72 - shift) % 12) + 12) % 12),
    [0, 4, 7],
    "the tune moved into the song's key"
  );
  assert.equal(sg.gain.gain.calls.length, fader0, 'the fader is left alone');
  for (const k of ['lead', 'counter', 'harmony']) {
    const calls = sg.stems[k].gain.calls;
    assert.ok(
      calls.some(([m, v]) => m === 'linearRampToValueAtTime' && v === 0.2),
      k + ' drops'
    );
    assert.equal(calls.at(-1)[1], 1, k + ' comes back');
  }
  assert.equal(sg.stems.bass.gain.calls.length, 0, 'the bass stays');
  /* a second stinger at once goes to the beat after */
  seen.length = 0;
  T.jingle(ST.notes, 150, 'p25', {}, { jingle: ST });
  assert.ok(Math.min(...seen.map(x => x[1])) > first + 0.01);
});

test('SND-17: a jingle that is no stinger ducks the song (the battle fanfares)', async () => {
  const { c, T } = jinglePlayer(16000);
  await T.jinglePrepare(JING);
  const sg = T.play('s');
  clearInterval(T.timer);
  c.currentTime = 0.5;
  T.jingle(JING.notes, 150, 'p25', {}, { jingle: JING });
  assert.ok(
    sg.gain.gain.calls.some(([m, v]) => m === 'linearRampToValueAtTime' && Math.abs(v - 0.15 * sg.level) < 1e-9)
  );
  assert.equal(sg.stems.lead.gain.calls.length, 0);
});
